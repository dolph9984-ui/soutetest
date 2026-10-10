import {
  Eye,
  History,
  Landmark,
  Mail,
  MapPin,
  MessageSquarePlus,
  Paperclip,
  Pencil,
  Phone,
  PhoneCall,
  Plus,
  Save,
  ShieldCheck,
  Target,
  User,
  Wallet,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import {
  Link,
  useNavigate,
  useParams,
  useSearchParams,
} from 'react-router-dom';
import {
  PHONE_PLACEHOLDER,
  formatPhone,
  normalizePhone,
  phoneHref,
} from '../lib/phone';
import { getLands } from '../lib/store';
import { phoneError, sanitizePhone } from '../lib/validate';
import {
  ActionLabel,
  ActionPlanner,
  CompleteDialog,
  DoneActions,
  LandDetails,
  LandPicker,
  PlanDialog,
  lateCount,
  nextAction,
} from './crm/client';
import { askConfirm } from './crm/dialog';
import { removeFile } from './crm/files';
import {
  Badge,
  Choice,
  Column,
  DataTable,
  DateFilter,
  Field,
  FileChip,
  FileDrop,
  Grid,
  Info,
  ListToolbar,
  Modal,
  NotesPanel,
  NumberInput,
  PageHeader,
  Preview,
  RelDate,
  Section,
  Select,
  Stat,
  Tabs,
  TelLink,
  Timeline,
  btnGold,
  btnIcon,
  btnOutline,
  btnPrimary,
  fmtAr,
  fmtDate,
  fmtDateTime,
  fmtNum,
  input,
} from './crm/kit';
import {
  AGENTS,
  BUY_GOALS,
  BUY_PAYMENT,
  BUY_STATUSES,
  BuyRequest,
  BuyStatus,
  COUNTRIES,
  PRIORITIES,
  PROPERTY_TYPES,
  PlannedAction,
  REGIONS,
  SOURCES,
  StoredFile,
  fullName,
  getBuyRequest,
  getBuyRequests,
  historyEntry,
  newBuyRequest,
  phoneOf,
  saveBuyRequest,
} from './crm/model';
import {
  emptyClientFields,
  findOrCreateClient,
  getClient,
  splitName,
} from './crm/people';
import { refreshCache, subscribeCache } from './crm/sync';
import {
  FormFooter,
  RecordHeader,
  RecordIdentity,
  SummaryStrip,
  useCollectionState,
} from './records';

const BASE = '/admin/achats';
const FLOW: BuyStatus[] = [
  'Nouvelle',
  'À contacter',
  'Contacté',
  'En étude',
  'Proposition envoyée',
  'Visite programmée',
  'Négociation',
  'Validée',
  'Achat finalisé',
];
const FLOW_LABELS = [
  'Nouvelle',
  'À contacter',
  'Contacté',
  'Étude',
  'Proposition',
  'Visite',
  'Négociation',
  'Validée',
  'Finalisé',
];
const isInstalment = (r: BuyRequest) => r.paymentMode === BUY_PAYMENT[1];

function budget(r: BuyRequest) {
  if (!r.budgetMin && !r.budgetMax) return '—';
  if (!r.budgetMax) return `≥ ${fmtAr(r.budgetMin)}`;
  return `${fmtAr(r.budgetMin).replace(' Ar', '')} – ${fmtAr(r.budgetMax)}`;
}

function landLabel(r: BuyRequest) {
  const land = getLands().find((l) => l.id === r.landId);
  if (!land) return '';
  const lot = land.lots?.find((l) => l.id === r.lotId);
  return `${land.title}${lot ? ` — ${lot.number}` : ''}`;
}

const columns: Column<BuyRequest>[] = [
  {
    key: 'identity',
    label: 'Client / référence',
    render: (r) => (
      <RecordIdentity
        title={fullName(r)}
        reference={r.ref}
        secondary={r.source}
      />
    ),
    sort: (r) => fullName(r).toLowerCase(),
    csv: (r) => fullName(r),
  },
  {
    key: 'status',
    label: 'Étape du dossier',
    width: 170,
    render: (r) => <Badge value={r.status} dot />,
    sort: (r) => BUY_STATUSES.indexOf(r.status),
    csv: (r) => r.status,
  },
  {
    key: 'land',
    label: 'Terrain souhaité',
    width: 185,
    render: (r) => (
      <span className="block truncate" title={landLabel(r)}>
        {landLabel(r) || 'Non rattaché'}
      </span>
    ),
    sort: (r) => landLabel(r),
    csv: (r) => landLabel(r),
  },
  {
    key: 'budget',
    label: 'Budget max.',
    width: 165,
    align: 'right',
    render: (r) => fmtAr(r.budgetMax || r.budgetMin),
    sort: (r) => r.budgetMax || r.budgetMin,
    csv: (r) => r.budgetMax || r.budgetMin,
  },
  {
    key: 'agent',
    label: 'Agent',
    width: 135,
    render: (r) => r.agent,
    sort: (r) => r.agent,
    csv: (r) => r.agent,
  },
  {
    key: 'date',
    label: 'Reçue le',
    width: 110,
    render: (r) => <RelDate iso={r.createdAt} />,
    sort: (r) => r.createdAt,
    csv: (r) => fmtDate(r.createdAt),
  },
  {
    key: 'next',
    label: 'Prochaine action',
    render: (r) => <ActionLabel a={nextAction(r.actions)} />,
    csv: (r) => nextAction(r.actions)?.at ?? '',
    defaultVisible: false,
  },
  {
    key: 'priority',
    label: 'Priorité',
    render: (r) => <Badge value={r.priority} />,
    csv: (r) => r.priority,
    defaultVisible: false,
  },
  {
    key: 'phone',
    label: 'Téléphone',
    render: (r) => <TelLink phone={phoneOf(r)} />,
    csv: (r) => phoneOf(r),
    defaultVisible: false,
  },
  {
    key: 'budgetRange',
    label: 'Fourchette du budget',
    render: (r) => budget(r),
    csv: (r) => `${r.budgetMin}-${r.budgetMax}`,
    defaultVisible: false,
  },
  {
    key: 'ref',
    label: 'Référence',
    render: (r) => r.ref,
    csv: (r) => r.ref,
    defaultVisible: false,
  },
];

// ======================= LISTE =======================
/** L'écran n'affiche que les achats — les visites ont leur propre écran. */
const loadPurchaseRequests = () =>
  getBuyRequests().filter((r) => (r.kind ?? 'interet') !== 'visite');

export function BuyRequestList() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [rows, setRows] = useState(loadPurchaseRequests);
  useEffect(() => {
    refreshCache().then(() => setRows(loadPurchaseRequests()));
    return subscribeCache(() => setRows(loadPurchaseRequests()));
  }, []); // resync à l'ouverture + mise à jour auto sans F5
  const [q, setQ] = useCollectionState(BASE, 'q', '');
  const [f, setF] = useCollectionState(BASE, 'filters', {
    region: '',
    status: '',
    agent: '',
    pay: '',
    priority: '',
    from: '',
    to: '',
    budgetMax: 0,
  });
  const [selected, setSelected] = useCollectionState<string[]>(
    BASE,
    'selected',
    [],
  );
  const [bulkStatus, setBulkStatus] = useState('');
  // Pré-filtrage depuis l'URL (ex: lien « Achats nouveaux » du tableau de bord
  // envoie ?status=Nouvelle pour afficher directement les demandes récentes).
  useEffect(() => {
    const urlStatus = params.get('status');
    if (urlStatus && urlStatus !== f.status) {
      setF({ ...f, status: urlStatus });
    }
  }, [params]); // eslint-disable-line react-hooks/exhaustive-deps
  const set = (k: keyof typeof f, v: string | number) => setF({ ...f, [k]: v });

  const filtered = useMemo(() => {
    const s = q.toLowerCase().trim();
    return rows
      .filter(
        (r) =>
          (!s ||
            [r.ref, fullName(r), r.phone, r.email, r.commune, r.district]
              .join(' ')
              .toLowerCase()
              .includes(s)) &&
          (!f.region || r.region === f.region) &&
          (!f.status || r.status === f.status) &&
          (!f.agent || r.agent === f.agent) &&
          (!f.priority || r.priority === f.priority) &&
          (!f.pay || r.paymentMode === f.pay) &&
          (!f.from || r.createdAt.slice(0, 10) >= f.from) &&
          (!f.to || r.createdAt.slice(0, 10) <= f.to) &&
          (!f.budgetMax || (r.budgetMin || 0) <= f.budgetMax),
      )
      .sort((a, b) => {
        const fresh = (r: BuyRequest) =>
          r.status === 'Nouvelle' || r.status === 'À contacter' ? 0 : 1;
        return fresh(a) - fresh(b) || b.createdAt.localeCompare(a.createdAt); // à traiter d'abord, puis plus récentes
      });
  }, [rows, q, f]);

  const applyBulk = () => {
    if (!bulkStatus) return;
    selected.forEach((id) => {
      const r = getBuyRequest(id);
      if (r && r.status !== bulkStatus)
        saveBuyRequest({
          ...r,
          status: bulkStatus as BuyStatus,
          history: [
            ...r.history,
            historyEntry(`Statut changé : ${r.status} → ${bulkStatus}`),
          ],
        });
    });
    setRows(loadPurchaseRequests());
    setSelected([]);
    setBulkStatus('');
  };
  const chosen = () =>
    selected.length
      ? filtered.filter((r) => selected.includes(r.id))
      : filtered;
  const activeFilters =
    [f.region, f.status, f.agent, f.priority, f.pay, f.from, f.to].filter(
      Boolean,
    ).length + (f.budgetMax ? 1 : 0);
  const active = rows.filter(
    (r) => !['Achat finalisé', 'Refusée', 'Archivée'].includes(r.status),
  );

  return (
    <>
      <PageHeader
        title="Demandes d’achat"
        subtitle="Personnes souhaitant acheter un terrain ou un bien immobilier"
        action={
          <Link to={`${BASE}/nouveau`} className={btnGold}>
            <Plus className="w-4 h-4" /> Nouvelle demande
          </Link>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        <Stat label="Dossiers actifs" value={active.length} />
        <Stat
          label="Nouvelles / à contacter"
          value={
            rows.filter(
              (r) => r.status === 'Nouvelle' || r.status === 'À contacter',
            ).length
          }
          tone="text-blue-700"
        />
        <Stat
          label="Actions en retard"
          value={rows.reduce((t, r) => t + lateCount(r.actions), 0)}
          tone="text-red-600"
        />
        <Stat
          label="Achats finalisés"
          value={rows.filter((r) => r.status === 'Achat finalisé').length}
          tone="text-blue-700"
        />
      </div>

      <ListToolbar
        q={q}
        onQ={setQ}
        placeholder="Rechercher par référence, nom, téléphone, email, commune…"
        activeFilters={activeFilters}
        onReset={() => {
          setQ('');
          setF({
            ...f,
            region: '',
            status: '',
            agent: '',
            priority: '',
            pay: '',
            budgetMax: 0,
            from: '',
            to: '',
          });
        }}
        filters={
          <>
            <Select
              value={f.region}
              onChange={(v) => set('region', v)}
              options={REGIONS}
              placeholder="Toutes régions"
            />
            <Select
              value={f.status}
              onChange={(v) => set('status', v)}
              options={BUY_STATUSES}
              placeholder="Tous statuts"
            />
            <Select
              value={f.agent}
              onChange={(v) => set('agent', v)}
              options={AGENTS}
              placeholder="Tous agents"
            />
            <Select
              value={f.priority}
              onChange={(v) => set('priority', v)}
              options={PRIORITIES}
              placeholder="Toutes priorités"
            />
            <Select
              value={f.pay}
              onChange={(v) => set('pay', v)}
              options={BUY_PAYMENT}
              placeholder="Tout paiement"
            />
            <NumberInput
              value={f.budgetMax}
              onChange={(v) => set('budgetMax', v)}
              placeholder="Budget ≤"
              suffix="Ar"
            />
            <DateFilter
              label="Du"
              value={f.from}
              onChange={(v) => set('from', v)}
            />
            <DateFilter
              label="Au"
              value={f.to}
              onChange={(v) => set('to', v)}
            />
          </>
        }
        bulk={
          selected.length > 0 && (
            <>
              <Select
                value={bulkStatus}
                onChange={setBulkStatus}
                options={BUY_STATUSES}
                placeholder={`Statut pour ${selected.length} dossier(s)…`}
                className="w-auto"
              />
              <button
                className={btnPrimary}
                onClick={applyBulk}
                disabled={!bulkStatus}
              >
                Appliquer
              </button>
            </>
          )
        }
        exportRows={chosen}
        exportColumns={columns}
        exportName="demandes-achat"
        exportTitle="Demandes d’achat"
      />

      <DataTable
        entityLabel="demandes"
        filtered={!!q || activeFilters > 0}
        onClearFilters={() => {
          setQ('');
          setF({
            ...f,
            region: '',
            status: '',
            agent: '',
            priority: '',
            pay: '',
            budgetMax: 0,
            from: '',
            to: '',
          });
        }}
        rows={filtered}
        columns={columns}
        selected={selected}
        onSelect={setSelected}
        rowClass={(r) =>
          r.status === 'Nouvelle' || r.status === 'À contacter'
            ? 'bg-blue-50/60'
            : ''
        }
        onOpen={(r) => navigate(`${BASE}/${r.id}`)}
        rowActions={(r) => (
          <>
            <Link to={`${BASE}/${r.id}`} className={btnIcon} title="Consulter">
              <Eye className="w-4 h-4" />
            </Link>
            <Link
              to={`${BASE}/${r.id}/modifier`}
              className={btnIcon}
              title="Modifier"
            >
              <Pencil className="w-4 h-4" />
            </Link>
            <a
              href={phoneHref(r.phone, r.dialCode)}
              className={btnIcon}
              title="Appeler"
            >
              <Phone className="w-4 h-4" />
            </a>
            <a
              href={`mailto:${r.email}`}
              className={btnIcon}
              title="Envoyer un email"
            >
              <Mail className="w-4 h-4" />
            </a>
          </>
        )}
      />
    </>
  );
}

// ======================= FORMULAIRE =======================
type Errors = Partial<Record<string, string>>;

function validate(r: BuyRequest): Errors {
  const e: Errors = {};
  const req = (k: keyof BuyRequest, label = 'Champ obligatoire') => {
    if (!String(r[k] ?? '').trim()) e[k] = label;
  };
  req('firstName');
  req('lastName');
  req('phone');
  req('birthDate');
  req('profession');
  req('country');
  req('hasBankAccount');
  req('paymentMode');
  if (r.phone.trim() && phoneError(r.phone))
    e.phone = phoneError(r.phone) ?? undefined;
  if (!r.email.trim()) e.email = 'Champ obligatoire';
  else if (!/^\S+@\S+\.\S+$/.test(r.email)) e.email = 'Adresse email invalide';
  if (r.country === 'Autre' && !r.countryOther.trim())
    e.countryOther = 'Précisez le pays';
  if (r.budgetMax && r.budgetMin > r.budgetMax)
    e.budgetMax = 'Doit être supérieur au budget minimum';
  if (r.areaMax && r.areaMin > r.areaMax)
    e.areaMax = 'Doit être supérieure à la superficie minimale';
  if (!r.consent) e.consent = 'Le consentement du client est requis';
  if (!r.landId) e.landId = 'Choisissez le terrain que le client veut acheter';
  return e;
}

export function BuyRequestForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const original = id ? getBuyRequest(id) : undefined;
  const [params] = useSearchParams();
  const [r, setR] = useState<BuyRequest>(() => {
    if (original)
      return {
        ...original,
        phone: formatPhone(original.phone, original.dialCode),
        dialCode: '',
      };
    const r = newBuyRequest();
    const c = params.get('client')
      ? getClient(params.get('client')!)
      : undefined;
    if (!c) return r;
    return {
      ...r,
      ...splitName(c.fullName),
      clientId: c.id,
      phone: formatPhone(c.phone),
      email: c.email,
      profession: c.profession,
      budgetMax: Number(c.budget) || 0,
      source: c.source === 'Site web' ? 'Site web' : 'Agence',
      country:
        !c.nationality || /malgache|madagascar/i.test(c.nationality)
          ? 'Madagascar'
          : 'Autre',
      countryOther:
        c.nationality && !/malgache|madagascar/i.test(c.nationality)
          ? c.nationality
          : '',
      hasBankAccount: c.bankAccount
        ? /^non/i.test(c.bankAccount)
          ? 'Non'
          : 'Oui'
        : '',
      bank:
        c.bankAccount && !/^(oui|non)$/i.test(c.bankAccount)
          ? c.bankAccount
          : '',
      consent: c.source === 'Site web',
    };
  });
  const [errors, setErrors] = useState<Errors>({});
  const set = <K extends keyof BuyRequest>(k: K, v: BuyRequest[K]) =>
    setR((x) => ({ ...x, [k]: v }));

  if (id && !original) return <NotFound />;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs = validate(r);
    setErrors(errs);
    if (Object.keys(errs).length) {
      e.currentTarget.scrollIntoView({ behavior: 'smooth', block: 'start' }); // on remonte jusqu'en haut du formulaire, pas de la page
      return;
    }
    const history = [...r.history];
    if (original) {
      if (original.status !== r.status)
        history.push(
          historyEntry(`Statut changé : ${original.status} → ${r.status}`),
        );
      if (original.agent !== r.agent)
        history.push(historyEntry(`Dossier affecté à ${r.agent}`));
      if (original.landId !== r.landId || original.lotId !== r.lotId)
        history.push(
          historyEntry(`Terrain souhaité modifié : ${landLabel(r)}`),
        );
      history.push(historyEntry('Dossier modifié'));
    }
    // Le client est aussi enregistré dans la base clients
    const client = r.clientId
      ? undefined
      : await findOrCreateClient(
          {
            ...emptyClientFields(),
            fullName: fullName(r),
            phone: normalizePhone(r.phone, r.dialCode),
            email: r.email,
            profession: r.profession,
            budget: r.budgetMax ? String(r.budgetMax) : '',
            nationality: r.country === 'Autre' ? r.countryOther : r.country,
            bankAccount:
              r.hasBankAccount === 'Oui' ? r.bank || 'Oui' : r.hasBankAccount,
          },
          'Backoffice',
        );
    const clientId = r.clientId ?? client!.id;
    const saved = await saveBuyRequest({ ...r, clientId, history });
    navigate(`${BASE}/${saved.id}`);
  };
  const errCount = Object.keys(errors).length;

  /* Bouton « Enregistrer » grisé tant que des champs obligatoires manquent (les erreurs de format restent signalées au clic). */
  const incomplete = Object.values(validate(r)).some(
    (m) =>
      m === 'Champ obligatoire' ||
      m.startsWith('Précisez') ||
      m.startsWith('Le consentement') ||
      m.startsWith('Choisissez'),
  );

  return (
    <form onSubmit={submit} noValidate className="scroll-mt-24">
      <RecordHeader
        module="Demandes d’achat"
        backTo={original ? `${BASE}/${original.id}` : BASE}
        mode={original ? 'edit' : 'create'}
        title={original ? 'Modifier la demande' : 'Nouvelle demande d’achat'}
        reference={original ? r.ref : undefined}
        subtitle="Identité, terrain souhaité et conditions du projet."
        action={
          <button type="submit" className={btnPrimary} disabled={incomplete}>
            <Save size={15} />
            Enregistrer
          </button>
        }
      />

      {errCount > 0 && (
        <div className="mb-4 px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700">
          {errCount} champ(s) à corriger avant d’enregistrer.
        </div>
      )}

      <div className="space-y-5">
        <Section
          title="Terrain que le client veut acheter"
          icon={<Landmark className="w-4 h-4" />}
        >
          <LandPicker
            landId={r.landId}
            lotId={r.lotId}
            error={errors.landId}
            onChange={(landId, lotId) => setR((x) => ({ ...x, landId, lotId }))}
          />
        </Section>

        <Section title="Identité du client" icon={<User className="w-4 h-4" />}>
          <Grid>
            <Field label="Source de la demande">
              <Select
                value={r.source}
                onChange={(v) => set('source', v)}
                options={SOURCES}
              />
            </Field>
            <Field label="Prénom" required error={errors.firstName}>
              <input
                className={input}
                value={r.firstName}
                onChange={(e) => set('firstName', e.target.value)}
              />
            </Field>
            <Field label="Nom" required error={errors.lastName}>
              <input
                className={input}
                value={r.lastName}
                onChange={(e) => set('lastName', e.target.value)}
              />
            </Field>
            <Field label="Téléphone" required error={errors.phone}>
              <input
                type="tel"
                inputMode="tel"
                className={input}
                value={r.phone}
                onChange={(e) =>
                  setR((x) => ({
                    ...x,
                    phone: sanitizePhone(e.target.value),
                    dialCode: '',
                  }))
                }
                placeholder={PHONE_PLACEHOLDER}
              />
            </Field>
            <Field label="Adresse email" required error={errors.email}>
              <input
                type="email"
                className={input}
                value={r.email}
                onChange={(e) => set('email', e.target.value)}
              />
            </Field>
            <Field label="Date de naissance" required error={errors.birthDate}>
              <input
                type="date"
                className={input}
                value={r.birthDate}
                onChange={(e) => set('birthDate', e.target.value)}
              />
            </Field>
            <Field label="Profession" required error={errors.profession}>
              <input
                className={input}
                value={r.profession}
                onChange={(e) => set('profession', e.target.value)}
              />
            </Field>
            <Field label="Pays de résidence" required error={errors.country}>
              <Choice
                value={r.country}
                onChange={(v) => set('country', v)}
                options={COUNTRIES}
              />
            </Field>
            {r.country === 'Autre' && (
              <Field
                label="Précisez le pays"
                required
                error={errors.countryOther}
              >
                <input
                  className={input}
                  value={r.countryOther}
                  onChange={(e) => set('countryOther', e.target.value)}
                />
              </Field>
            )}
            <Field label="Adresse actuelle" span={2}>
              <input
                className={input}
                value={r.address}
                onChange={(e) => set('address', e.target.value)}
              />
            </Field>
          </Grid>
        </Section>

        <Section
          title="Situation financière"
          icon={<Wallet className="w-4 h-4" />}
        >
          <Grid>
            <Field
              label="Titulaire d’un compte bancaire"
              required
              error={errors.hasBankAccount}
            >
              <Choice
                value={r.hasBankAccount}
                onChange={(v) => set('hasBankAccount', v as 'Oui' | 'Non')}
                options={['Oui', 'Non']}
              />
            </Field>
            {r.hasBankAccount === 'Oui' && (
              <Field label="Banque">
                <input
                  className={input}
                  value={r.bank}
                  onChange={(e) => set('bank', e.target.value)}
                  placeholder="BNI, BOA, BFV-SG…"
                />
              </Field>
            )}
            <Field
              label="Mode de paiement souhaité"
              required
              error={errors.paymentMode}
              span="full"
            >
              <Choice
                value={r.paymentMode}
                onChange={(v) => set('paymentMode', v)}
                options={BUY_PAYMENT}
              />
            </Field>
            <Field label="Budget minimum">
              <NumberInput
                value={r.budgetMin}
                onChange={(v) => set('budgetMin', v)}
                suffix="Ar"
              />
            </Field>
            <Field label="Budget maximum" error={errors.budgetMax}>
              <NumberInput
                value={r.budgetMax}
                onChange={(v) => set('budgetMax', v)}
                suffix="Ar"
              />
            </Field>
            <Field label="Apport disponible">
              <NumberInput
                value={r.deposit}
                onChange={(v) => set('deposit', v)}
                suffix="Ar"
              />
            </Field>
            {isInstalment(r) && (
              <Field label="Durée de paiement souhaitée">
                <input
                  className={input}
                  value={r.paymentDuration}
                  onChange={(e) => set('paymentDuration', e.target.value)}
                  placeholder="Ex : 12 mois"
                />
              </Field>
            )}
          </Grid>
        </Section>

        <Section
          title="Autres critères de recherche"
          icon={<MapPin className="w-4 h-4" />}
        >
          <Grid>
            <Field label="Type de bien" span="full">
              <Choice
                value={r.propertyType}
                onChange={(v) => set('propertyType', v)}
                options={PROPERTY_TYPES}
              />
            </Field>
            <Field label="Région">
              <Select
                value={r.region}
                onChange={(v) => set('region', v)}
                options={REGIONS}
                placeholder="—"
              />
            </Field>
            <Field label="District">
              <input
                className={input}
                value={r.district}
                onChange={(e) => set('district', e.target.value)}
              />
            </Field>
            <Field label="Commune">
              <input
                className={input}
                value={r.commune}
                onChange={(e) => set('commune', e.target.value)}
              />
            </Field>
            <Field label="Fokontany">
              <input
                className={input}
                value={r.fokontany}
                onChange={(e) => set('fokontany', e.target.value)}
              />
            </Field>
            <Field label="Superficie minimale">
              <NumberInput
                value={r.areaMin}
                onChange={(v) => set('areaMin', v)}
                suffix="m²"
              />
            </Field>
            <Field label="Superficie maximale" error={errors.areaMax}>
              <NumberInput
                value={r.areaMax}
                onChange={(v) => set('areaMax', v)}
                suffix="m²"
              />
            </Field>
            <Field label="Critères particuliers" span="full">
              <textarea
                rows={2}
                className={input}
                value={r.criteria}
                onChange={(e) => set('criteria', e.target.value)}
                placeholder="Terrain plat, accès voiture, eau et électricité…"
              />
            </Field>
          </Grid>
        </Section>

        <Section title="Projet d’achat" icon={<Target className="w-4 h-4" />}>
          <Grid>
            <Field label="Objectif de l’achat" span="full">
              <Choice
                value={r.goal}
                onChange={(v) => set('goal', v)}
                options={BUY_GOALS}
              />
            </Field>
            <Field label="Délai souhaité pour l’achat">
              <input
                className={input}
                value={r.deadline}
                onChange={(e) => set('deadline', e.target.value)}
                placeholder="Ex : dans 3 mois"
              />
            </Field>
            <Field label="Informations supplémentaires" span={2}>
              <textarea
                rows={2}
                className={input}
                value={r.extraInfo}
                onChange={(e) => set('extraInfo', e.target.value)}
              />
            </Field>
          </Grid>
          <label className="flex items-start gap-3 mt-4 p-3 rounded-lg bg-gray-50">
            <input
              type="checkbox"
              checked={r.consent}
              onChange={(e) => set('consent', e.target.checked)}
              className="mt-1"
            />
            <span className="text-sm">
              Le client consent au traitement de ses données personnelles par CA
              IMMO dans le cadre de sa recherche.{' '}
              <span className="text-red-500">*</span>
              {errors.consent && (
                <span className="block text-xs text-red-600 mt-1">
                  {errors.consent}
                </span>
              )}
            </span>
          </label>
        </Section>

        <Section
          title="Suivi interne"
          icon={<ShieldCheck className="w-4 h-4" />}
          confidential
        >
          <Grid cols={4}>
            <Field label="Agent responsable">
              <Select
                value={r.agent}
                onChange={(v) => set('agent', v)}
                options={AGENTS}
              />
            </Field>
            <Field label="Priorité">
              <Select
                value={r.priority}
                onChange={(v) => set('priority', v as BuyRequest['priority'])}
                options={PRIORITIES}
              />
            </Field>
            <Field label="Statut de la demande">
              <Select
                value={r.status}
                onChange={(v) => set('status', v as BuyStatus)}
                options={BUY_STATUSES}
              />
            </Field>
            <Field label="Prochain suivi">
              <input
                type="date"
                className={input}
                value={r.nextFollowUp}
                onChange={(e) => set('nextFollowUp', e.target.value)}
              />
            </Field>
          </Grid>
        </Section>
      </div>

      <FormFooter>
        <button
          type="button"
          onClick={() => navigate(original ? `${BASE}/${original.id}` : BASE)}
          className={btnOutline}
        >
          Annuler
        </button>
        <button type="submit" className={btnPrimary} disabled={incomplete}>
          <Save size={15} />
          Enregistrer
        </button>
      </FormFooter>
    </form>
  );
}

// ======================= FICHE DÉTAILLÉE =======================
type Dialog = null | 'status' | 'plan' | 'agent';

export function BuyRequestDetail() {
  const { id } = useParams();
  const [r, setR] = useState(() => (id ? getBuyRequest(id) : undefined));
  const [tab, setTab] = useState<
    'overview' | 'suivi' | 'terrain' | 'client' | 'notes' | 'documents'
  >('overview');
  const [dialog, setDialog] = useState<Dialog>(null);
  const [completing, setCompleting] = useState<PlannedAction | null>(null);
  const [preview, setPreview] = useState<StoredFile | null>(null);

  // Resync à l'ouverture de la fiche + mise à jour auto sans F5 : sans ce bloc,
  // la fiche affiche un instantané figé du cache mémoire (potentiellement
  // périmé si la demande a été modifiée ailleurs entre-temps).
  useEffect(() => {
    if (id) {
      refreshCache(true).then(() => setR(getBuyRequest(id)));
    }
    return subscribeCache(() => {
      if (id) setR(getBuyRequest(id));
    });
  }, [id]);

  if (!r) return <NotFound />;

  const update = (patch: Partial<BuyRequest>, log?: string) => {
    void saveBuyRequest({
      ...r,
      ...patch,
      history: log ? [...r.history, historyEntry(log)] : r.history,
    }).then(setR);
  };
  const changeStatus = (status: BuyStatus) =>
    status !== r.status &&
    update({ status }, `Statut changé : ${r.status} → ${status}`);
  const stepIndex = FLOW.indexOf(r.status);
  const failed =
    r.status === 'Refusée' || r.status === 'Archivée' ? r.status : undefined;
  const land = getLands().find((l) => l.id === r.landId);
  const lot = land?.lots?.find((l) => l.id === r.lotId);
  const next = nextAction(r.actions);
  const late = lateCount(r.actions);

  const plan = (a: PlannedAction) => {
    update(
      {
        actions: [...r.actions, a],
        ...(a.done ? {} : { nextFollowUp: a.at.slice(0, 10) }),
      },
      a.done
        ? `${a.type} effectué(e) le ${fmtDateTime(a.at)} : ${a.result}`
        : `${a.type} planifié(e) le ${fmtDateTime(a.at)}${a.note ? ` — ${a.note}` : ''}`,
    );
    setDialog(null);
  };
  const complete = (a: PlannedAction, result: string, followUp: boolean) => {
    const actions = r.actions.map((x) =>
      x.id === a.id
        ? { ...x, done: true, doneAt: new Date().toISOString(), result }
        : x,
    );
    const status: BuyStatus =
      r.status === 'Nouvelle' || r.status === 'À contacter'
        ? 'Contacté'
        : r.status;
    update(
      {
        actions,
        status,
        nextFollowUp: nextAction(actions)?.at.slice(0, 10) ?? '',
      },
      `${a.type} effectué(e) : ${result}${status !== r.status ? ` (statut : ${r.status} → ${status})` : ''}`,
    );
    setCompleting(null);
    if (followUp) setDialog('plan');
  };
  const cancel = async (a: PlannedAction) => {
    if (!(await askConfirm(`Annuler « ${a.type} » du ${fmtDateTime(a.at)} ?`)))
      return;
    const actions = r.actions.filter((x) => x.id !== a.id);
    update(
      { actions, nextFollowUp: nextAction(actions)?.at.slice(0, 10) ?? '' },
      `${a.type} du ${fmtDateTime(a.at)} annulé(e)`,
    );
  };

  return (
    <>
      <RecordHeader
        module="Demandes d’achat"
        backTo={BASE}
        title={fullName(r)}
        reference={r.ref}
        status={r.status}
        subtitle={`${r.source} · reçue le ${fmtDate(r.createdAt)}`}
        action={
          <>
            <Link to={`${BASE}/${r.id}/modifier`} className={btnOutline}>
              <Pencil size={15} />
              Modifier
            </Link>
            <button className={btnOutline} onClick={() => setDialog('agent')}>
              <User size={15} />
              Affecter
            </button>
            <button className={btnPrimary} onClick={() => setDialog('status')}>
              Changer le statut
            </button>
          </>
        }
      />
      <SummaryStrip
        facts={[
          { label: 'Budget max.', value: fmtAr(r.budgetMax || r.budgetMin) },
          {
            label: 'Terrain souhaité',
            value: land ? `${land.title}${lot ? ` — ${lot.number}` : ''}` : '',
          },
          { label: 'Agent', value: r.agent },
          {
            label: 'Prochaine action',
            value: next ? fmtDateTime(next.at) : '',
          },
        ]}
      />

      <div className="grid lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 min-w-0">
          <Tabs
            value={tab}
            onChange={(t) => setTab(t)}
            tabs={[
              { id: 'overview', label: 'Résumé' },
              { id: 'suivi', label: 'Suivi & historique' },
              { id: 'terrain', label: 'Terrain' },
              { id: 'client', label: 'Client' },
              { id: 'notes', label: `Notes (${r.notes.length})` },
              { id: 'documents', label: `Documents (${r.attachments.length})` },
            ]}
          />

          {tab === 'overview' && (
            <div className="space-y-5">
              <Section title="Projet du client">
                <dl className="grid sm:grid-cols-2 gap-5">
                  <Info label="Objectif" value={r.goal} />
                  <Info label="Budget" value={budget(r)} />
                  <Info label="Mode de paiement" value={r.paymentMode} />
                  <Info
                    label="Surface recherchée"
                    value={
                      r.areaMax
                        ? `${fmtNum(r.areaMin)}–${fmtNum(r.areaMax)} m²`
                        : ''
                    }
                  />
                  <Info label="Priorité" value={<Badge value={r.priority} />} />
                  <Info label="Délai envisagé" value={r.deadline} />
                </dl>
                {r.message && (
                  <p className="mt-5 text-sm whitespace-pre-line text-slate-600">
                    {r.message}
                  </p>
                )}
              </Section>
              <Section title="Coordonnées">
                <dl className="grid sm:grid-cols-2 gap-5">
                  <Info label="Téléphone" value={phoneOf(r)} />
                  <Info label="Email" value={r.email} />
                  <Info label="Critères" value={r.criteria} />
                  <Info
                    label="Meilleur moment pour rappeler"
                    value={r.callTime}
                  />
                </dl>
              </Section>
            </div>
          )}

          {tab === 'suivi' && (
            <div className="space-y-5">
              <Section
                title="Actions effectuées"
                icon={<PhoneCall className="w-4 h-4" />}
              >
                <DoneActions actions={r.actions} />
              </Section>
              <Section
                title="Historique complet du dossier"
                icon={<History className="w-4 h-4" />}
              >
                <Timeline items={r.history} />
              </Section>
            </div>
          )}

          {tab === 'terrain' && (
            <LandDetails landId={r.landId} lotId={r.lotId} />
          )}

          {tab === 'client' && (
            <div className="space-y-5">
              <Section title="Coordonnées" icon={<User className="w-4 h-4" />}>
                <dl className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  <Info label="Téléphone" value={phoneOf(r)} />
                  <Info label="Email" value={r.email} />
                  <Info
                    label="Meilleur moment pour appeler"
                    value={r.callTime}
                  />
                  <Info
                    label="Date de naissance"
                    value={fmtDate(r.birthDate)}
                  />
                  <Info label="Profession" value={r.profession} />
                  <Info
                    label="Pays de résidence"
                    value={r.country === 'Autre' ? r.countryOther : r.country}
                  />
                  <Info label="Adresse" value={r.address} />
                  <Info
                    label="Compte bancaire"
                    value={
                      r.hasBankAccount === 'Oui'
                        ? `Oui${r.bank ? ` · ${r.bank}` : ''}`
                        : r.hasBankAccount
                    }
                  />
                  <Info
                    label="Consentement données"
                    value={r.consent ? 'Oui' : 'Non'}
                  />
                </dl>
              </Section>
              <Section
                title="Financement et projet"
                icon={<Wallet className="w-4 h-4" />}
              >
                <dl className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  <Info label="Mode de paiement" value={r.paymentMode} />
                  {isInstalment(r) && (
                    <Info label="Durée souhaitée" value={r.paymentDuration} />
                  )}
                  <Info label="Budget" value={budget(r)} />
                  <Info label="Apport disponible" value={fmtAr(r.deposit)} />
                  <Info label="Objectif" value={r.goal} />
                  <Info label="Délai" value={r.deadline} />
                </dl>
                {r.criteria && (
                  <p className="mt-4 text-sm bg-gray-50 rounded-lg p-3 whitespace-pre-line">
                    <strong>Critères : </strong>
                    {r.criteria}
                  </p>
                )}
                {r.extraInfo && (
                  <p className="mt-2 text-sm bg-gray-50 rounded-lg p-3 whitespace-pre-line">
                    <strong>Infos : </strong>
                    {r.extraInfo}
                  </p>
                )}
              </Section>
            </div>
          )}

          {tab === 'notes' && (
            <Section
              title="Notes internes"
              icon={<MessageSquarePlus className="w-4 h-4" />}
              confidential
            >
              <NotesPanel
                notes={r.notes}
                onAdd={(n) =>
                  update(
                    { notes: [...r.notes, n] },
                    `Note ajoutée : ${n.text.slice(0, 80)}${n.text.length > 80 ? '…' : ''}`,
                  )
                }
              />
            </Section>
          )}

          {tab === 'documents' && (
            <Section
              title="Documents du client"
              icon={<Paperclip className="w-4 h-4" />}
            >
              <FileDrop
                accept="image/jpeg,image/png,image/webp,application/pdf,.doc,.docx"
                maxMb={15}
                multiple
                label="Joindre un document"
                hint="CIN, justificatifs, contrat… · PDF, JPG, PNG, WEBP, Word · 15 Mo max"
                onFiles={(files) =>
                  update(
                    { attachments: [...r.attachments, ...files] },
                    `Document(s) joint(s) : ${files.map((f) => f.name).join(', ')}`,
                  )
                }
              />
              <div className="grid sm:grid-cols-2 gap-2 mt-4">
                {r.attachments.map((f) => (
                  <FileChip
                    key={f.id}
                    file={f}
                    onPreview={() => setPreview(f)}
                    onRemove={async () => {
                      if (await askConfirm(`Retirer ${f.name} ?`)) {
                        removeFile(f);
                        update(
                          {
                            attachments: r.attachments.filter(
                              (x) => x.id !== f.id,
                            ),
                          },
                          `Document retiré : ${f.name}`,
                        );
                      }
                    }}
                  />
                ))}
              </div>
            </Section>
          )}
        </div>

        <aside className="space-y-4">
          <Section title="Actions rapides">
            <div className="grid gap-2">
              <button className={btnOutline} onClick={() => setTab('notes')}>
                <MessageSquarePlus className="w-4 h-4" /> Ajouter une note
              </button>
              <button
                className={btnOutline}
                onClick={() => setTab('documents')}
              >
                <Paperclip className="w-4 h-4" /> Ajouter un document
              </button>
            </div>
          </Section>
          <ActionPlanner
            actions={r.actions}
            onPlan={() => setDialog('plan')}
            onComplete={setCompleting}
            onDelete={cancel}
          />
          <Section title="Suivi">
            <dl className="space-y-3">
              <Info label="Prochaine action" value={<ActionLabel a={next} />} />
              {late > 0 && (
                <Info
                  label="En retard"
                  value={<span className="text-red-600">{late} action(s)</span>}
                />
              )}
              <Info
                label="Dernière modification"
                value={fmtDateTime(r.updatedAt)}
              />
            </dl>
          </Section>
        </aside>
      </div>

      {dialog === 'status' && (
        <StatusDialog
          current={r.status}
          onClose={() => setDialog(null)}
          onSave={(s) => {
            changeStatus(s);
            setDialog(null);
          }}
        />
      )}
      {dialog === 'agent' && (
        <AgentDialog
          current={r.agent}
          onClose={() => setDialog(null)}
          onSave={(a) => {
            update({ agent: a }, `Dossier affecté à ${a}`);
            setDialog(null);
          }}
        />
      )}
      {dialog === 'plan' && (
        <PlanDialog onClose={() => setDialog(null)} onSave={plan} />
      )}
      {completing && (
        <CompleteDialog
          action={completing}
          onClose={() => setCompleting(null)}
          onSave={(res, f) => complete(completing, res, f)}
        />
      )}
      <Preview file={preview} onClose={() => setPreview(null)} />
    </>
  );
}

// ======================= Boîtes de dialogue =======================
function StatusDialog({
  current,
  onClose,
  onSave,
}: {
  current: BuyStatus;
  onClose: () => void;
  onSave: (s: BuyStatus) => void;
}) {
  const [s, setS] = useState(current);
  return (
    <Modal
      title="Changer le statut"
      onClose={onClose}
      footer={
        <>
          <button className={btnOutline} onClick={onClose}>
            Annuler
          </button>
          <button className={btnPrimary} onClick={() => onSave(s)}>
            Enregistrer
          </button>
        </>
      }
    >
      <div className="grid grid-cols-2 gap-2">
        {BUY_STATUSES.map((x) => (
          <button
            key={x}
            type="button"
            onClick={() => setS(x)}
            className={`p-2 rounded-lg border text-left text-sm ${s === x ? 'border-navy-900 ring-2 ring-gold-500' : 'border-gray-200 hover:border-gray-400'}`}
          >
            <Badge value={x} dot />
          </button>
        ))}
      </div>
    </Modal>
  );
}

export function AgentDialog({
  current,
  onClose,
  onSave,
}: {
  current: string;
  onClose: () => void;
  onSave: (a: string) => void;
}) {
  const [a, setA] = useState(current);
  return (
    <Modal
      title="Affecter à un agent"
      onClose={onClose}
      footer={
        <>
          <button className={btnOutline} onClick={onClose}>
            Annuler
          </button>
          <button className={btnPrimary} onClick={() => onSave(a)}>
            Affecter
          </button>
        </>
      }
    >
      <Select value={a} onChange={setA} options={AGENTS} />
    </Modal>
  );
}

export function VisitDialog({
  current,
  onClose,
  onSave,
}: {
  current: string;
  onClose: () => void;
  onSave: (at: string) => void;
}) {
  const [at, setAt] = useState(current ? current.slice(0, 16) : '');
  return (
    <Modal
      title="Programmer une visite"
      onClose={onClose}
      footer={
        <>
          <button className={btnOutline} onClick={onClose}>
            Annuler
          </button>
          <button
            className={btnPrimary}
            disabled={!at}
            onClick={() => onSave(new Date(at).toISOString())}
          >
            Programmer
          </button>
        </>
      }
    >
      <Field label="Date et heure de la visite" required>
        <input
          type="datetime-local"
          className={input}
          value={at}
          onChange={(e) => setAt(e.target.value)}
        />
      </Field>
    </Modal>
  );
}

export function NotFound() {
  return (
    <div className="text-center py-20">
      <p className="text-gray-500">Dossier introuvable.</p>
      <Link to="/admin" className={`${btnOutline} mt-4`}>
        Retour au tableau de bord
      </Link>
    </div>
  );
}
