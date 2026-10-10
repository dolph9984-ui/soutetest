import { Pencil, Plus, Trash2, User } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  PHONE_PLACEHOLDER,
  formatPhone,
  normalizePhone,
  phoneHref,
} from '../lib/phone';
import { getLands } from '../lib/store';
import { phoneError, sanitizePhone } from '../lib/validate';
import { askConfirm } from './crm/dialog';
import {
  Badge,
  Column,
  DataTable,
  Field,
  Info,
  ListToolbar,
  Modal,
  PageHeader,
  RelDate,
  Section,
  Select,
  Stat,
  Tabs,
  TelLink,
  btnGold,
  btnIcon,
  btnOutline,
  btnPrimary,
  fmtAr,
  fmtDate,
  input,
} from './crm/kit';
import {
  getBuyRequests,
  getLandFiles,
  phoneOf,
  fullName as requestName,
} from './crm/model';
import {
  Client,
  ClientFields,
  createClient,
  deleteClient,
  emptyClientFields,
  getClient,
  getClients,
  getSearches,
  saveClient,
} from './crm/people';
import { refreshCache, subscribeCache } from './crm/sync';
import {
  RecordHeader,
  RecordIdentity,
  SummaryStrip,
  useCollectionState,
} from './records';
import { visitStatusOf } from './Visits';

/** Compare deux numéros en ignorant la mise en forme (espaces, indicatif…). */
const digitsOnly = (p?: string) => normalizePhone(p).replace(/\D/g, '');

const BASE = '/admin/clients';

/** Formulaire client : mêmes champs que le formulaire de réservation du site. */
export function ClientForm({
  initial,
  title,
  onClose,
  onSave,
}: {
  initial?: ClientFields;
  title: string;
  onClose: () => void;
  onSave: (f: ClientFields) => void | Promise<void>;
}) {
  const [f, setF] = useState<ClientFields>(() => {
    const fields = initial ?? emptyClientFields();
    return { ...fields, phone: formatPhone(fields.phone) };
  });
  const [tried, setTried] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const set = (k: keyof ClientFields, v: string) =>
    setF((x) => ({ ...x, [k]: v }));
  const missing = !f.fullName.trim() || !f.phone.trim();
  const badPhone = !!phoneError(f.phone);
  const badEmail = !!f.email && !/^\S+@\S+\.\S+$/.test(f.email);

  const submit = async () => {
    setTried(true);
    if (missing || badPhone || badEmail) return;
    setBusy(true);
    setError('');
    try {
      await onSave({
        ...f,
        fullName: f.fullName.trim(),
        phone: normalizePhone(f.phone),
        email: f.email.trim(),
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Enregistrement impossible.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      title={title}
      onClose={onClose}
      footer={
        <>
          <button className={btnOutline} onClick={onClose}>
            Annuler
          </button>
          <button
            className={btnPrimary}
            onClick={submit}
            disabled={missing || busy}
            title="Complétez les champs obligatoires (*)"
          >
            {busy ? 'Enregistrement…' : 'Enregistrer'}
          </button>
        </>
      }
    >
      {error && (
        <p role="alert" className="text-sm text-red-700 mb-4">
          {error}
        </p>
      )}
      <div className="grid sm:grid-cols-2 gap-4">
        <Field
          label="Nom complet"
          required
          error={tried && !f.fullName.trim() ? 'Champ obligatoire' : undefined}
          span={2}
        >
          <input
            className={input}
            value={f.fullName}
            onChange={(e) => set('fullName', e.target.value)}
            placeholder="Rakoto Andrianina"
          />
        </Field>
        <Field
          label="Téléphone"
          required
          error={tried ? (phoneError(f.phone) ?? undefined) : undefined}
        >
          <input
            type="tel"
            inputMode="tel"
            className={input}
            value={f.phone}
            onChange={(e) => set('phone', sanitizePhone(e.target.value))}
            placeholder={PHONE_PLACEHOLDER}
          />
        </Field>
        <Field
          label="Email"
          error={tried && badEmail ? 'Adresse email invalide' : undefined}
        >
          <input
            type="email"
            className={input}
            value={f.email}
            onChange={(e) => set('email', e.target.value)}
            placeholder="vous@exemple.com"
          />
        </Field>
        <Field label="Budget approximatif (Ar)">
          <input
            className={input}
            value={f.budget}
            onChange={(e) => set('budget', e.target.value)}
            placeholder="Ex : 50 000 000"
          />
        </Field>
        <Field label="Profession">
          <input
            className={input}
            value={f.profession}
            onChange={(e) => set('profession', e.target.value)}
          />
        </Field>
        <Field label="Âge">
          <input
            type="number"
            min={18}
            className={input}
            value={f.age}
            onChange={(e) => set('age', e.target.value)}
          />
        </Field>
        <Field label="Nationalité">
          <input
            className={input}
            value={f.nationality}
            onChange={(e) => set('nationality', e.target.value)}
            placeholder="Malgache"
          />
        </Field>
        <Field label="Compte bancaire" span={2}>
          <input
            className={input}
            value={f.bankAccount}
            onChange={(e) => set('bankAccount', e.target.value)}
            placeholder="Banque"
          />
        </Field>
        <Field label="Message / notes" span={2}>
          <textarea
            rows={3}
            className={input}
            value={f.message}
            onChange={(e) => set('message', e.target.value)}
          />
        </Field>
      </div>
    </Modal>
  );
}

/** Ventes rattachées au client : via ses dossiers d'achat OU le téléphone de l'acheteur. */
function salesOfClient(c: Client) {
  const reqIds = getBuyRequests()
    .filter((r) => r.clientId === c.id)
    .map((r) => r.id);
  return getLands().flatMap((land) =>
    (land.sales ?? [])
      .filter(
        (s) =>
          reqIds.includes(s.buyRequestId) ||
          (digitsOnly(s.buyer.phone) !== '' &&
            digitsOnly(s.buyer.phone) === digitsOnly(c.phone)),
      )
      .map((sale) => ({ land, sale })),
  );
}

/** Dossiers « Demandes de vente » (LandFile) déposés par ce client : rapprochés par
 * fiche client liée à la soumission, ou à défaut par téléphone du propriétaire. */
function landFilesOfClient(c: Client) {
  return getLandFiles().filter(
    (f) =>
      f.clientId === c.id ||
      (digitsOnly(phoneOf(f.owner)) !== '' &&
        digitsOnly(phoneOf(f.owner)) === digitsOnly(c.phone)),
  );
}

const columns: Column<Client>[] = [
  {
    key: 'identity',
    label: 'Client / référence',
    render: (c) => <RecordIdentity title={c.fullName} reference={c.ref} />,
    sort: (c) => c.fullName.toLowerCase(),
    csv: (c) => c.fullName,
  },
  {
    key: 'source',
    label: 'Origine',
    width: 130,
    render: (c) => <Badge value={c.source} />,
    sort: (c) => c.source,
    csv: (c) => c.source,
  },
  {
    key: 'phone',
    label: 'Téléphone',
    width: 145,
    render: (c) => <TelLink phone={c.phone} />,
    csv: (c) => formatPhone(c.phone),
  },
  {
    key: 'email',
    label: 'Email',
    width: 200,
    render: (c) => (
      <span className="block truncate" title={c.email}>
        {c.email || '—'}
      </span>
    ),
    csv: (c) => c.email,
    defaultVisible: false,
  },
  {
    key: 'budget',
    label: 'Budget',
    width: 165,
    align: 'right',
    render: (c) =>
      c.budget ? (Number(c.budget) ? fmtAr(Number(c.budget)) : c.budget) : '—',
    sort: (c) => (c.budget === '' ? '' : Number(c.budget)),
    csv: (c) => c.budget,
  },
  {
    key: 'sales',
    label: 'Achats',
    width: 80,
    align: 'right',
    render: (c) => salesOfClient(c).length,
    sort: (c) => salesOfClient(c).length,
    csv: (c) => salesOfClient(c).length,
  },
  {
    key: 'date',
    label: 'Inscrit le',
    width: 110,
    render: (c) => <RelDate iso={c.createdAt} />,
    sort: (c) => c.createdAt,
    csv: (c) => fmtDate(c.createdAt),
  },
  {
    key: 'ref',
    label: 'Référence',
    render: (c) => c.ref,
    csv: (c) => c.ref,
    defaultVisible: false,
  },
  {
    key: 'profession',
    label: 'Profession',
    render: (c) => c.profession || '—',
    csv: (c) => c.profession,
    defaultVisible: false,
  },
  {
    key: 'nationality',
    label: 'Nationalité',
    render: (c) => c.nationality || '—',
    csv: (c) => c.nationality,
    defaultVisible: false,
  },
];

export function ClientList() {
  const navigate = useNavigate();
  const [rows, setRows] = useState(getClients);
  useEffect(() => {
    refreshCache().then(() => setRows(getClients()));
    return subscribeCache(() => setRows(getClients()));
  }, []); // resync à l'ouverture + mise à jour auto sans F5
  const [q, setQ] = useCollectionState(BASE, 'q', '');
  const [source, setSource] = useCollectionState(BASE, 'source', '');
  const [selected, setSelected] = useCollectionState<string[]>(
    BASE,
    'selected',
    [],
  );
  const [creating, setCreating] = useState(false);

  const filtered = useMemo(() => {
    const s = q.toLowerCase().trim();
    return rows
      .filter(
        (c) =>
          (!s ||
            [c.ref, c.fullName, c.phone, c.email, c.profession, c.nationality]
              .join(' ')
              .toLowerCase()
              .includes(s)) &&
          (!source || c.source === source),
      )
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt)); // inscrits les plus récents d'abord
  }, [rows, q, source]);

  return (
    <>
      <PageHeader
        title="Base clients"
        subtitle="Clients inscrits depuis le site ou créés dans le backoffice"
        action={
          <button onClick={() => setCreating(true)} className={btnGold}>
            <Plus className="w-4 h-4" /> Nouveau client
          </button>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 mb-5">
        <Stat label="Clients" value={rows.length} />
        <Stat
          label="Inscrits via le site"
          value={rows.filter((c) => c.source === 'Site web').length}
          tone="text-blue-700"
        />
        <Stat
          label="Créés au backoffice"
          value={rows.filter((c) => c.source === 'Backoffice').length}
        />
      </div>

      <ListToolbar
        q={q}
        onQ={setQ}
        placeholder="Rechercher : nom, téléphone, email, profession…"
        filters={
          <Select
            value={source}
            onChange={setSource}
            options={['Site web', 'Backoffice']}
            placeholder="Toutes sources"
          />
        }
        activeFilters={source ? 1 : 0}
        onReset={() => {
          setQ('');
          setSource('');
        }}
        exportRows={() =>
          selected.length
            ? filtered.filter((c) => selected.includes(c.id))
            : filtered
        }
        exportColumns={columns}
        exportName="clients"
        exportTitle="Base clients"
      />

      <DataTable
        entityLabel="clients"
        filtered={!!(q || source)}
        onClearFilters={() => {
          setQ('');
          setSource('');
        }}
        rows={filtered}
        columns={columns}
        selected={selected}
        onSelect={setSelected}
        onOpen={(c) => navigate(`${BASE}/${c.id}`)}
      />

      {creating && (
        <ClientForm
          title="Nouveau client"
          onClose={() => setCreating(false)}
          onSave={async (f) => {
            const c = await createClient(f, 'Backoffice');
            setRows(getClients());
            setCreating(false);
            navigate(`${BASE}/${c.id}`);
          }}
        />
      )}
    </>
  );
}

export function ClientDetail() {
  const { id } = useParams(),
    navigate = useNavigate();
  const [c, setC] = useState(() => (id ? getClient(id) : undefined)),
    [editing, setEditing] = useState(false);
  const [tab, setTab] = useState<'overview' | 'related' | 'notes'>('overview');
  useEffect(() => {
    if (id) refreshCache(true).then(() => setC(getClient(id)));
    return subscribeCache(() => {
      if (id) setC(getClient(id));
    });
  }, [id]);
  if (!c)
    return (
      <p className="py-12 text-slate-500">
        Client introuvable. <Link to={BASE}>Retour à la liste</Link>
      </p>
    );
  const all = getBuyRequests().filter((r) => r.clientId === c.id),
    requests = all.filter((r) => r.kind !== 'visite'),
    visits = all.filter((r) => r.kind === 'visite');
  const searches = getSearches().filter((r) => r.clientId === c.id),
    files = landFilesOfClient(c),
    purchases = salesOfClient(c);
  const budgetValue = c.budget
    ? Number(c.budget)
      ? fmtAr(Number(c.budget))
      : c.budget
    : '';
  const related = [
    ...requests.map((r) => ({
      id: 'buy-' + r.id,
      to: `/admin/achats/${r.id}`,
      title: getLands().find((l) => l.id === r.landId)?.title || requestName(r),
      reference: r.ref,
      kind: 'Achat',
      status: r.status,
    })),
    ...visits.map((r) => ({
      id: 'visit-' + r.id,
      to: `/admin/visites/${r.id}`,
      title: getLands().find((l) => l.id === r.landId)?.title || requestName(r),
      reference: r.ref,
      kind: 'Visite',
      status: visitStatusOf(r),
    })),
    ...searches.map((r) => ({
      id: 'search-' + r.id,
      to: `/admin/recherches/${r.id}`,
      title: r.mainZone,
      reference: r.ref,
      kind: 'Recherche',
      status: r.status,
    })),
    ...files.map((r) => ({
      id: 'file-' + r.id,
      to: `/admin/dossiers-terrains/${r.id}`,
      title: r.title,
      reference: r.ref,
      kind: 'Vente',
      status: r.status,
    })),
  ];
  return (
    <>
      <RecordHeader
        module="Base clients"
        backTo={BASE}
        title={c.fullName}
        reference={c.ref}
        subtitle={`${c.source} · inscrit le ${fmtDate(c.createdAt)}`}
        action={
          <>
            <button className={btnOutline} onClick={() => setEditing(true)}>
              <Pencil size={15} />
              Modifier
            </button>
            <Link
              to={`/admin/achats/nouveau?client=${c.id}`}
              className={btnPrimary}
            >
              <Plus size={15} />
              Nouvelle demande
            </Link>
            <button
              className={btnIcon}
              aria-label="Supprimer le client"
              onClick={async () => {
                if (
                  await askConfirm(
                    'Supprimer ce client ? Ses dossiers sont conservés.',
                  )
                ) {
                  await deleteClient(c.id);
                  navigate(BASE);
                }
              }}
            >
              <Trash2 size={15} />
            </button>
          </>
        }
      />
      <SummaryStrip
        facts={[
          { label: 'Téléphone', value: c.phone ? formatPhone(c.phone) : '' },
          { label: 'Email', value: c.email },
          { label: 'Budget', value: budgetValue },
          { label: 'Dossiers liés', value: related.length },
        ]}
      />
      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          { id: 'overview', label: 'Résumé' },
          { id: 'related', label: `Dossiers liés (${related.length})` },
          { id: 'notes', label: 'Notes' },
        ]}
      />
      {tab === 'overview' && (
        <div className="grid lg:grid-cols-3 gap-5">
          <div className="lg:col-span-2 space-y-5">
            <Section title="Coordonnées du client" icon={<User size={16} />}>
              <dl className="grid sm:grid-cols-2 gap-5">
                <Info label="Nom complet" value={c.fullName} />
                <Info
                  label="Téléphone"
                  value={
                    c.phone ? (
                      <a href={phoneHref(c.phone)}>{formatPhone(c.phone)}</a>
                    ) : (
                      ''
                    )
                  }
                />
                <Info
                  label="Email"
                  value={
                    c.email ? <a href={`mailto:${c.email}`}>{c.email}</a> : ''
                  }
                />
                <Info label="Profession" value={c.profession} />
                <Info label="Âge" value={c.age} />
                <Info label="Nationalité" value={c.nationality} />
              </dl>
            </Section>
            <Section title="Informations complémentaires" confidential>
              <dl className="grid sm:grid-cols-2 gap-5">
                <Info label="Budget approximatif" value={budgetValue} />
                <Info label="Compte bancaire" value={c.bankAccount} />
                <Info label="Origine de la fiche" value={c.source} />
                <Info label="Date d’inscription" value={fmtDate(c.createdAt)} />
              </dl>
            </Section>
          </div>
          <aside>
            <Section title="Activité">
              <dl className="space-y-4">
                <Info label="Demandes d’achat" value={requests.length} />
                <Info label="Visites" value={visits.length} />
                <Info label="Recherches" value={searches.length} />
                <Info label="Dossiers de vente" value={files.length} />
                <Info label="Achats finalisés" value={purchases.length} />
              </dl>
              <button
                className={`${btnOutline} mt-5 w-full`}
                onClick={() => setTab('related')}
              >
                Consulter les dossiers
              </button>
            </Section>
          </aside>
        </div>
      )}
      {tab === 'related' && (
        <Section title="Dossiers rattachés au client">
          {related.length ? (
            <ul className="divide-y divide-slate-100">
              {related.map((r) => (
                <li key={r.id}>
                  <Link
                    to={r.to}
                    className="flex items-center justify-between gap-4 py-4"
                  >
                    <RecordIdentity
                      title={r.title}
                      reference={r.reference}
                      secondary={r.kind}
                    />
                    <Badge value={r.status} />
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-slate-500">
              Aucun dossier rattaché à ce client.
            </p>
          )}
          {purchases.length > 0 && (
            <div className="mt-6">
              <h3 className="text-sm font-medium mb-3">Achats finalisés</h3>
              {purchases.map(({ land, sale }) => (
                <p key={sale.id} className="text-sm py-2">
                  {land.title} · {fmtDate(sale.date)} · {fmtAr(sale.price)}
                </p>
              ))}
            </div>
          )}
        </Section>
      )}
      {tab === 'notes' && (
        <Section title="Notes du client" confidential>
          <p className="text-sm whitespace-pre-line text-slate-600">
            {c.message || 'Aucune note renseignée.'}
          </p>
          <button
            className={`${btnOutline} mt-5`}
            onClick={() => setEditing(true)}
          >
            Modifier les notes
          </button>
        </Section>
      )}
      {editing && (
        <ClientForm
          title="Modifier le client"
          initial={c}
          onClose={() => setEditing(false)}
          onSave={async (fields) => {
            const updated = await saveClient({ ...c, ...fields });
            setC(updated);
            setEditing(false);
          }}
        />
      )}
    </>
  );
}
