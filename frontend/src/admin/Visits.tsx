import {
  RecordHeader,
  RecordIdentity,
  SummaryStrip,
  useCollectionState,
} from './records';
/* ==========================================================================
   Demandes de visite (VIS) — écran dédié du back office.
   Les visites ne suivent pas le tunnel d'achat : leur cycle est
   Demandée → Confirmée → Effectuée (ou Reportée / Annulée).
   Données : mêmes lignes que les demandes (kind = "visite"), lues via le
   cache synchronisé (crm/model) — aucune duplication côté API.
   ========================================================================== */

import {
  CalendarDays,
  CalendarPlus,
  FileText,
  Mail,
  MapPin,
  Phone,
  User,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { formatPhone, phoneHref } from '../lib/phone';
import { getLands } from '../lib/store';
import {
  Badge,
  Column,
  DataTable,
  Field,
  FileChip,
  ListToolbar,
  Modal,
  PageHeader,
  Preview,
  RelDate,
  Section,
  Select,
  Stat,
  Tabs,
  TelLink,
  Timeline,
  btnOutline,
  btnPrimary,
  fmtAr,
  fmtDate,
} from './crm/kit';
import {
  BuyRequest,
  StoredFile,
  fullName,
  getBuyRequest,
  getBuyRequests,
  historyEntry,
  saveBuyRequest,
} from './crm/model';
import { getClient } from './crm/people';
import { refreshCache, subscribeCache } from './crm/sync';

const BASE = '/admin/visites';

export const VISIT_STATUSES = [
  'Demandée',
  'Confirmée',
  'Reportée',
  'Effectuée',
  'Annulée',
] as const;
export type VisitStatus = (typeof VISIT_STATUSES)[number];

/** Les demandes de visite uniquement (le reste part sur l'écran Achats). */
export function getVisitRequests(): BuyRequest[] {
  return getBuyRequests().filter((r) => (r.kind ?? 'interet') === 'visite');
}

/** Statuts historiques → vocabulaire des visites. */
export const visitStatusOf = (r: BuyRequest): VisitStatus =>
  (VISIT_STATUSES as readonly string[]).includes(r.status)
    ? (r.status as VisitStatus)
    : 'Demandée';

const fmtVisitDate = (r: BuyRequest) =>
  r.visitDate
    ? `${fmtDate(r.visitDate)}${r.visitTime ? ` · ${r.visitTime}` : ''}`
    : '—';

// ======================= LISTE =======================
const columns: Column<BuyRequest>[] = [
  {
    key: 'identity',
    label: 'Client / référence',
    render: (r) => <RecordIdentity title={fullName(r)} reference={r.ref} />,
    sort: (r) => fullName(r).toLowerCase(),
    csv: (r) => fullName(r),
  },
  {
    key: 'status',
    label: 'État de la visite',
    width: 135,
    render: (r) => <Badge value={visitStatusOf(r)} dot />,
    sort: (r) => VISIT_STATUSES.indexOf(visitStatusOf(r)),
    csv: (r) => visitStatusOf(r),
  },
  {
    key: 'land',
    label: 'Terrain',
    width: 210,
    render: (r) => (
      <span
        className="block truncate"
        title={getLands().find((l) => l.id === r.landId)?.title}
      >
        {getLands().find((l) => l.id === r.landId)?.title || '—'}
      </span>
    ),
    csv: (r) => getLands().find((l) => l.id === r.landId)?.title ?? '',
  },
  {
    key: 'visit',
    label: 'Visite prévue',
    width: 155,
    render: (r) => <span className="whitespace-nowrap">{fmtVisitDate(r)}</span>,
    sort: (r) => r.visitDate ?? '',
    csv: (r) => fmtVisitDate(r),
  },
  {
    key: 'phone',
    label: 'Téléphone',
    width: 145,
    render: (r) => <TelLink phone={r.phone} />,
    csv: (r) => r.phone,
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
    key: 'ref',
    label: 'Référence',
    render: (r) => r.ref,
    csv: (r) => r.ref,
    defaultVisible: false,
  },
];

export function VisitList() {
  const navigate = useNavigate();
  const [rows, setRows] = useState(getVisitRequests);
  useEffect(() => {
    refreshCache().then(() => setRows(getVisitRequests()));
    return subscribeCache(() => setRows(getVisitRequests()));
  }, []); // resync à l'ouverture + mise à jour auto sans F5
  const [q, setQ] = useCollectionState(BASE, 'q', '');
  const [status, setStatus] = useCollectionState(BASE, 'status', '');
  const [selected, setSelected] = useCollectionState<string[]>(
    BASE,
    'selected',
    [],
  );

  const filtered = rows
    .filter((r) => {
      const s = q.toLowerCase().trim();
      const land = getLands().find((l) => l.id === r.landId);
      return (
        (!status || visitStatusOf(r) === status) &&
        (!s ||
          [r.ref, fullName(r), r.phone, r.email, land?.title ?? '']
            .join(' ')
            .toLowerCase()
            .includes(s))
      );
    })
    .sort((a, b) => {
      const fresh = (r: BuyRequest) =>
        visitStatusOf(r) === 'Demandée' ? 0 : 1;
      return fresh(a) - fresh(b) || b.createdAt.localeCompare(a.createdAt); // à confirmer d'abord, puis plus récentes
    });

  const demandees = rows.filter((r) => visitStatusOf(r) === 'Demandée').length;
  const confirmees = rows.filter(
    (r) => visitStatusOf(r) === 'Confirmée',
  ).length;
  const effectuees = rows.filter(
    (r) => visitStatusOf(r) === 'Effectuée',
  ).length;

  return (
    <>
      <PageHeader
        title="Demandes de visite"
        subtitle="Visites demandées depuis le site — confirmation et suivi"
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        <Stat label="À confirmer" value={demandees} tone="text-blue-700" />
        <Stat label="Confirmées" value={confirmees} tone="text-green-700" />
        <Stat label="Effectuées" value={effectuees} />
        <Stat label="Total" value={rows.length} />
      </div>

      <ListToolbar
        q={q}
        onReset={() => {
          setQ('');
          setStatus('');
        }}
        onQ={setQ}
        placeholder="Rechercher par référence, nom, téléphone, terrain…"
        filters={
          <Select
            value={status}
            onChange={setStatus}
            options={[...VISIT_STATUSES]}
            placeholder="Tous statuts"
          />
        }
        activeFilters={status ? 1 : 0}
        exportRows={() => filtered}
        exportColumns={columns}
        exportName="visites"
        exportTitle="Demandes de visite"
      />

      <DataTable
        entityLabel="visites"
        filtered={!!(q || status)}
        onClearFilters={() => {
          setQ('');
          setStatus('');
        }}
        rows={filtered}
        columns={columns}
        selected={selected}
        onSelect={setSelected}
        rowClass={(r) =>
          visitStatusOf(r) === 'Demandée' ? 'bg-blue-50/60' : ''
        }
        onOpen={(r) => navigate(`${BASE}/${r.id}`)}
      />
    </>
  );
}

// ======================= FICHE =======================
export function VisitDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [r, setR] = useState(() => (id ? getBuyRequest(id) : undefined));
  const [tab, setTab] = useState<'overview' | 'documents' | 'history'>(
    'overview',
  );
  const [editing, setEditing] = useState(false);
  const [draftStatus, setDraftStatus] = useState<string>(
    r ? visitStatusOf(r) : 'Demandée',
  );
  const [preview, setPreview] = useState<StoredFile | null>(null);

  // Resync à l'ouverture de la fiche + mise à jour auto sans F5 : sans ce bloc,
  // la fiche affiche un instantané figé du cache mémoire (potentiellement
  // périmé si la visite a été modifiée ailleurs entre-temps).
  useEffect(() => {
    if (id) {
      refreshCache(true).then(() => setR(getBuyRequest(id)));
    }
    return subscribeCache(() => {
      if (id) setR(getBuyRequest(id));
    });
  }, [id]);

  if (!r || (r.kind ?? 'interet') !== 'visite') {
    return (
      <p className="text-center py-20 text-gray-500">
        Visite introuvable.{' '}
        <Link to={BASE} className="underline">
          Retour
        </Link>
      </p>
    );
  }

  const land = getLands().find((l) => l.id === r.landId);
  const client = r.clientId ? getClient(String(r.clientId)) : undefined;

  /** Change le statut et l'inscrit dans l'historique. */
  const changeStatus = (status: VisitStatus) => {
    if (status === visitStatusOf(r)) return;
    void saveBuyRequest({
      ...r,
      status: status as BuyRequest['status'],
      history: [
        ...r.history,
        historyEntry(`Statut changé : ${visitStatusOf(r)} → ${status}`),
      ],
    }).then(setR);
  };

  return (
    <>
      <RecordHeader
        module="Visites"
        backTo={BASE}
        title={client?.fullName ?? fullName(r)}
        reference={r.ref}
        status={visitStatusOf(r)}
        subtitle={`Demande reçue le ${fmtDate(r.createdAt)}`}
        action={
          <button className={btnOutline} onClick={() => setEditing(true)}>
            Modifier le suivi
          </button>
        }
      />
      <SummaryStrip
        facts={[
          { label: 'Visite prévue', value: fmtVisitDate(r) },
          { label: 'Terrain', value: land?.title },
          { label: 'Téléphone', value: formatPhone(r.phone, r.dialCode) },
          { label: 'Agent', value: r.agent },
        ]}
      />
      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          { id: 'overview', label: 'Résumé' },
          { id: 'documents', label: `Documents (${r.attachments.length})` },
          { id: 'history', label: 'Historique' },
        ]}
      />
      {editing && (
        <Modal
          title="Modifier la visite"
          onClose={() => setEditing(false)}
          footer={
            <>
              <button className={btnOutline} onClick={() => setEditing(false)}>
                Annuler
              </button>
              <button
                className={btnPrimary}
                onClick={() => {
                  changeStatus(draftStatus as VisitStatus);
                  setEditing(false);
                }}
              >
                Enregistrer
              </button>
            </>
          }
        >
          <Field label="État de la visite">
            <Select
              value={draftStatus}
              onChange={setDraftStatus}
              options={[...VISIT_STATUSES]}
            />
          </Field>
        </Modal>
      )}
      {tab === 'overview' && (
        <>
          <div className="grid lg:grid-cols-2 gap-4">
            {/* Visite */}
            <Section
              title="Visite souhaitée"
              icon={<CalendarDays className="w-4 h-4" />}
            >
              <div className="space-y-2 text-sm">
                <p className="flex items-center gap-2">
                  <CalendarPlus className="w-4 h-4 text-gold-700" />
                  <span className="font-medium text-navy-900">
                    {fmtVisitDate(r)}
                  </span>
                </p>
                {r.message && (
                  <p className="text-gray-600 whitespace-pre-line mt-3">
                    « {r.message} »
                  </p>
                )}
              </div>
            </Section>

            {/* Client */}
            <Section title="Client" icon={<User className="w-4 h-4" />}>
              <div className="space-y-2 text-sm">
                <p className="font-medium text-navy-900">
                  {client?.fullName ?? fullName(r)}
                </p>
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-gray-600">
                  <a
                    href={phoneHref(r.phone, r.dialCode)}
                    className="flex items-center gap-1 hover:text-navy-900"
                  >
                    <Phone className="w-3.5 h-3.5" />{' '}
                    {formatPhone(r.phone, r.dialCode)}
                  </a>
                  {r.email && (
                    <a
                      href={`mailto:${r.email}`}
                      className="flex items-center gap-1 hover:text-navy-900"
                    >
                      <Mail className="w-3.5 h-3.5" /> {r.email}
                    </a>
                  )}
                </div>
                {client && (
                  <Link
                    to={`/admin/clients/${client.id}`}
                    className="inline-block mt-2 text-xs font-semibold text-gold-700 hover:underline"
                  >
                    Voir la fiche client →
                  </Link>
                )}
              </div>
            </Section>
          </div>

          {/* Terrain */}
          {land && (
            <div className="mt-4">
              <Section
                title="Terrain concerné"
                icon={<MapPin className="w-4 h-4" />}
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="font-medium text-navy-900">{land.title}</p>
                    <p className="text-sm text-gray-500">
                      {land.location} · {fmtAr(land.price)}
                    </p>
                  </div>
                  <Link
                    to={`/terrains/${land.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={btnOutline}
                  >
                    Voir sur le site
                  </Link>
                </div>
              </Section>
            </div>
          )}
        </>
      )}
      {tab === 'documents' && (
        <div className="mt-4">
          <Section
            title="Documents de la visite"
            icon={<FileText className="w-4 h-4" />}
          >
            <div className="grid gap-2 sm:grid-cols-2">
              {r.attachments.map((file) => (
                <FileChip
                  key={file.id}
                  file={file}
                  onPreview={() => setPreview(file)}
                />
              ))}
            </div>
          </Section>
        </div>
      )}
      <Preview file={preview} onClose={() => setPreview(null)} />

      {/* Historique */}
      {tab === 'history' && (
        <div className="mt-4">
          <Section
            title="Historique"
            icon={<CalendarDays className="w-4 h-4" />}
          >
            <Timeline items={r.history} />
          </Section>
        </div>
      )}
    </>
  );
}
