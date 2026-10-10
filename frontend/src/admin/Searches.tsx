import {
  FileText,
  History,
  MapPin,
  Plus,
  Send,
  Target,
  Trash2,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { PHONE_PLACEHOLDER, normalizePhone } from '../lib/phone';
import { getLands, newId } from '../lib/store';
import { phoneError, sanitizePhone } from '../lib/validate';
import { Land } from '../types';
import { askConfirm } from './crm/dialog';
import {
  Badge,
  Choice,
  Column,
  DataTable,
  Field,
  FileChip,
  Info,
  ListToolbar,
  MapPicker,
  Modal,
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
  fmtM2,
  input,
} from './crm/kit';
import { StoredFile, historyEntry } from './crm/model';
import {
  Proposal,
  RADIUS_OPTIONS,
  SEARCH_STATUSES,
  SEARCH_USAGES,
  SearchFields,
  SearchStatus,
  SpecificSearch,
  createSearch,
  deleteSearch,
  emptySearchFields,
  getSearch,
  getSearches,
  saveSearch,
} from './crm/people';
import { refreshCache, subscribeCache } from './crm/sync';
import {
  RecordHeader,
  RecordIdentity,
  SummaryStrip,
  useCollectionState,
} from './records';

const BASE = '/admin/recherches';

// ---------- Formulaire (partagé avec le site public) ----------
export function SearchFormFields({
  f,
  set,
  errors = {},
}: {
  f: SearchFields;
  set: <K extends keyof SearchFields>(k: K, v: SearchFields[K]) => void;
  errors?: Partial<Record<keyof SearchFields, string>>;
}) {
  return (
    <div className="space-y-5">
      <div className="grid sm:grid-cols-3 gap-4">
        <Field label="Nom complet" required error={errors.fullName}>
          <input
            className={input}
            value={f.fullName}
            onChange={(e) => set('fullName', e.target.value)}
          />
        </Field>
        <Field label="Téléphone" required error={errors.phone}>
          <input
            type="tel"
            inputMode="tel"
            className={input}
            value={f.phone}
            onChange={(e) => set('phone', sanitizePhone(e.target.value))}
            placeholder={PHONE_PLACEHOLDER}
          />
        </Field>
        <Field label="Email">
          <input
            type="email"
            className={input}
            value={f.email}
            onChange={(e) => set('email', e.target.value)}
          />
        </Field>
      </div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Field label="Usage du terrain">
          <Select
            value={f.usage}
            onChange={(v) => set('usage', v)}
            options={SEARCH_USAGES}
          />
        </Field>
        <Field label="Budget maximum">
          <NumberInput
            value={f.budgetMax}
            onChange={(v) => set('budgetMax', v)}
            suffix="Ar"
          />
        </Field>
        <Field label="Surface minimale">
          <NumberInput
            value={f.areaMin}
            onChange={(v) => set('areaMin', v)}
            suffix="m²"
          />
        </Field>
        <Field label="Surface maximale">
          <NumberInput
            value={f.areaMax}
            onChange={(v) => set('areaMax', v)}
            suffix="m²"
          />
        </Field>
      </div>
      <div className="grid sm:grid-cols-2 gap-4">
        <Field
          label="Zone principale recherchée"
          required
          error={errors.mainZone}
        >
          <input
            className={input}
            value={f.mainZone}
            onChange={(e) => set('mainZone', e.target.value)}
            placeholder="Ex : Ivato, Antananarivo"
          />
        </Field>
        <Field label="Autres zones acceptées">
          <input
            className={input}
            value={f.otherZones}
            onChange={(e) => set('otherZones', e.target.value)}
            placeholder="Ex : Talatamaty, Ambohidratrimo"
          />
        </Field>
        <Field
          label="Zone ciblée"
          hint="Quartier, repère… puis placez le point sur la carte"
        >
          <input
            className={input}
            value={f.targetZone}
            onChange={(e) => set('targetZone', e.target.value)}
            placeholder="Ex : près de l’aéroport"
          />
        </Field>
        <Field label="Rayon suggéré">
          <Choice
            value={`${f.radiusKm} km`}
            onChange={(v) => set('radiusKm', parseInt(v, 10))}
            options={RADIUS_OPTIONS.map((r) => `${r} km`)}
          />
        </Field>
      </div>
      <MapPicker
        lat={f.lat}
        lng={f.lng}
        radiusKm={f.radiusKm}
        onChange={(lat, lng) => {
          set('lat', lat);
          set('lng', lng);
        }}
        height="h-72"
      />
      <div className="grid sm:grid-cols-2 gap-4">
        <Field label="Êtes-vous flexible sur la localisation ?" required>
          <Choice
            value={f.flexible}
            onChange={(v) => set('flexible', v as 'Oui' | 'Non')}
            options={['Oui', 'Non']}
          />
        </Field>
        <label className="flex items-center gap-2 text-sm self-end pb-2">
          <input
            type="checkbox"
            checked={f.suggestNearby}
            onChange={(e) => set('suggestNearby', e.target.checked)}
          />{' '}
          Proposez-moi les zones proches
        </label>
      </div>
      <Field label="Critères particuliers">
        <textarea
          rows={3}
          className={input}
          value={f.criteria}
          onChange={(e) => set('criteria', e.target.value)}
          placeholder="Terrain plat, titre foncier, accès voiture…"
        />
      </Field>
    </div>
  );
}

export function validateSearch(f: SearchFields) {
  const e: Partial<Record<keyof SearchFields, string>> = {};
  if (!f.fullName.trim()) e.fullName = 'Champ obligatoire';
  if (!f.phone.trim()) e.phone = 'Champ obligatoire';
  else if (phoneError(f.phone)) e.phone = phoneError(f.phone) ?? undefined;
  if (!f.mainZone.trim()) e.mainZone = 'Champ obligatoire';
  return e;
}

// ---------- Terrains correspondants ----------
function matchScore(s: SpecificSearch, land: Land) {
  const text = `${land.title} ${land.location} ${land.region}`.toLowerCase();
  const zones = [s.mainZone, s.otherZones, s.targetZone]
    .join(',')
    .toLowerCase()
    .split(/[,;/]/)
    .map((z) => z.trim())
    .filter((z) => z.length > 2);
  let score = zones.some((z) => text.includes(z.split(' ')[0])) ? 3 : 0;
  if (s.lat != null && s.lng != null && land.coordinates) {
    const km = distanceKm([s.lat, s.lng], land.coordinates);
    if (km <= s.radiusKm) score += 3;
    else if (s.suggestNearby && km <= s.radiusKm * 3) score += 1;
  }
  if (
    !s.budgetMax ||
    land.price <= s.budgetMax ||
    (land.lots ?? []).some(
      (l) => l.price <= s.budgetMax && l.status !== 'vendu',
    )
  )
    score += 2;
  if (
    !s.areaMin ||
    land.area >= s.areaMin ||
    (land.lots ?? []).some((l) => l.area >= s.areaMin)
  )
    score += 1;
  return score;
}

function distanceKm(a: [number, number], b: [number, number]) {
  const r = (d: number) => (d * Math.PI) / 180;
  const h =
    Math.sin(r(b[0] - a[0]) / 2) ** 2 +
    Math.cos(r(a[0])) * Math.cos(r(b[0])) * Math.sin(r(b[1] - a[1]) / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(h));
}

// ======================= LISTE =======================
const columns: Column<SpecificSearch>[] = [
  {
    key: 'identity',
    label: 'Client / référence',
    render: (s) => <RecordIdentity title={s.fullName} reference={s.ref} />,
    sort: (s) => s.fullName.toLowerCase(),
    csv: (s) => s.fullName,
  },
  {
    key: 'status',
    label: 'Étape de recherche',
    width: 170,
    render: (s) => <Badge value={s.status} dot />,
    sort: (s) => SEARCH_STATUSES.indexOf(s.status),
    csv: (s) => s.status,
  },
  {
    key: 'zone',
    label: 'Zone principale',
    width: 155,
    render: (s) => s.mainZone || '—',
    sort: (s) => s.mainZone,
    csv: (s) => s.mainZone,
  },
  {
    key: 'budget',
    label: 'Budget max.',
    width: 165,
    align: 'right',
    render: (s) => fmtAr(s.budgetMax),
    sort: (s) => s.budgetMax,
    csv: (s) => s.budgetMax,
  },
  {
    key: 'proposals',
    label: 'Propositions',
    width: 95,
    align: 'right',
    render: (s) => s.proposals.length,
    sort: (s) => s.proposals.length,
    csv: (s) => s.proposals.length,
  },
  {
    key: 'date',
    label: 'Reçue le',
    width: 110,
    render: (s) => <RelDate iso={s.createdAt} />,
    sort: (s) => s.createdAt,
    csv: (s) => fmtDate(s.createdAt),
  },
  {
    key: 'phone',
    label: 'Téléphone',
    render: (s) => <TelLink phone={s.phone} />,
    csv: (s) => s.phone,
    defaultVisible: false,
  },
  {
    key: 'ref',
    label: 'Référence',
    render: (s) => s.ref,
    csv: (s) => s.ref,
    defaultVisible: false,
  },
];

export function SearchList() {
  const navigate = useNavigate();
  const [rows, setRows] = useState(getSearches);
  useEffect(() => {
    refreshCache().then(() => setRows(getSearches()));
    return subscribeCache(() => setRows(getSearches()));
  }, []); // resync à l'ouverture + mise à jour auto sans F5
  const [q, setQ] = useCollectionState(BASE, 'q', '');
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
        (r) =>
          !s ||
          [
            r.ref,
            r.fullName,
            r.phone,
            r.mainZone,
            r.otherZones,
            r.targetZone,
            r.status,
          ]
            .join(' ')
            .toLowerCase()
            .includes(s),
      )
      .sort((a, b) => {
        const fresh = (r: SpecificSearch) => (r.status === 'Nouvelle' ? 0 : 1);
        return fresh(a) - fresh(b) || b.createdAt.localeCompare(a.createdAt); // nouvelles d'abord, puis plus récentes
      });
  }, [rows, q]);

  return (
    <>
      <PageHeader
        title="Recherches de terrain spécifique"
        subtitle="Clients qui cherchent un terrain précis, et les terrains qu’on leur a proposés"
        action={
          <button className={btnGold} onClick={() => setCreating(true)}>
            <Plus className="w-4 h-4" /> Nouvelle recherche
          </button>
        }
      />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        <Stat label="Recherches" value={rows.length} />
        <Stat
          label="Nouvelles"
          value={rows.filter((r) => r.status === 'Nouvelle').length}
          tone="text-blue-700"
        />
        <Stat
          label="Avec terrains proposés"
          value={rows.filter((r) => r.proposals.length).length}
          tone="text-amber-600"
        />
        <Stat
          label="Trouvées"
          value={rows.filter((r) => r.status === 'Trouvé').length}
          tone="text-blue-700"
        />
      </div>
      <ListToolbar
        q={q}
        onReset={() => setQ('')}
        onQ={setQ}
        placeholder="Rechercher : client, téléphone, zone, statut…"
        exportRows={() =>
          selected.length
            ? filtered.filter((r) => selected.includes(r.id))
            : filtered
        }
        exportColumns={columns}
        exportName="recherches"
        exportTitle="Recherches de terrain"
      />
      <DataTable
        entityLabel="recherches"
        filtered={!!q}
        onClearFilters={() => setQ('')}
        rows={filtered}
        columns={columns}
        selected={selected}
        onSelect={setSelected}
        rowClass={(r) => (r.status === 'Nouvelle' ? 'bg-blue-50/60' : '')}
        onOpen={(r) => navigate(`${BASE}/${r.id}`)}
      />
      {creating && (
        <NewSearchDialog
          onClose={() => setCreating(false)}
          onCreated={(s) => {
            setRows(getSearches());
            navigate(`${BASE}/${s.id}`);
          }}
        />
      )}
    </>
  );
}

function NewSearchDialog({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (s: SpecificSearch) => void;
}) {
  const [f, setF] = useState<SearchFields>(emptySearchFields);
  const [errors, setErrors] = useState<ReturnType<typeof validateSearch>>({});
  const set = <K extends keyof SearchFields>(k: K, v: SearchFields[K]) =>
    setF((x) => ({ ...x, [k]: v }));
  const save = async () => {
    const e = validateSearch(f);
    setErrors(e);
    if (Object.keys(e).length) return;
    onCreated(await createSearch(f, 'Backoffice'));
  };
  return (
    <Modal
      title="Nouvelle recherche"
      wide
      onClose={onClose}
      footer={
        <>
          <button className={btnOutline} onClick={onClose}>
            Annuler
          </button>
          <button
            className={btnPrimary}
            onClick={save}
            disabled={
              !f.fullName.trim() || !f.phone.trim() || !f.mainZone.trim()
            }
          >
            Enregistrer
          </button>
        </>
      }
    >
      <SearchFormFields f={f} set={set} errors={errors} />
    </Modal>
  );
}

// ======================= FICHE =======================
export function SearchDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [tab, setTab] = useState<'overview' | 'documents' | 'history'>(
    'overview',
  );
  const [editing, setEditing] = useState(false);
  const [s, setS] = useState(() => (id ? getSearch(id) : undefined));
  const [proposing, setProposing] = useState(false);
  const [preview, setPreview] = useState<StoredFile | null>(null);

  // Resync à l'ouverture de la fiche + mise à jour auto sans F5 : sans ce bloc,
  // la fiche affiche un instantané figé du cache mémoire (potentiellement
  // périmé si la recherche a été modifiée ailleurs entre-temps).
  useEffect(() => {
    if (id) {
      refreshCache(true).then(() => setS(getSearch(id)));
    }
    return subscribeCache(() => {
      if (id) setS(getSearch(id));
    });
  }, [id]);

  if (!s)
    return (
      <p className="text-center py-20 text-gray-500">
        Recherche introuvable.{' '}
        <Link to={BASE} className="underline">
          Retour
        </Link>
      </p>
    );

  const lands = getLands();
  const update = (patch: Partial<SpecificSearch>, log?: string) =>
    void saveSearch({
      ...s,
      ...patch,
      history: log ? [...s.history, historyEntry(log)] : s.history,
    }).then(setS);
  const landOf = (p: Proposal) => lands.find((l) => l.id === p.landId);

  return (
    <>
      <RecordHeader
        module="Recherches"
        backTo={BASE}
        title={s.fullName}
        reference={s.ref}
        status={s.status}
        subtitle={`${s.source} · reçue le ${fmtDate(s.createdAt)}`}
        action={
          <>
            <button className={btnOutline} onClick={() => setEditing(true)}>
              Modifier
            </button>
            <Select
              value={s.status}
              onChange={(v) =>
                update(
                  { status: v as SearchStatus },
                  `Statut changé : ${s.status} → ${v}`,
                )
              }
              options={SEARCH_STATUSES}
              className="w-auto"
            />
            <button
              className={btnIcon}
              aria-label="Supprimer la recherche"
              onClick={async () => {
                if (await askConfirm('Supprimer cette recherche ?')) {
                  await deleteSearch(s.id);
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
          { label: 'Zone recherchée', value: s.mainZone },
          { label: 'Budget max.', value: fmtAr(s.budgetMax) },
          { label: 'Surface max.', value: fmtM2(s.areaMax) },
          { label: 'Terrains proposés', value: s.proposals.length },
        ]}
      />
      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          { id: 'overview', label: 'Résumé' },
          {
            id: 'documents',
            label: `Documents (${s.attachments?.length ?? 0})`,
          },
          { id: 'history', label: 'Historique' },
        ]}
      />
      {editing && (
        <SearchEditDialog
          initial={s}
          onClose={() => setEditing(false)}
          onSave={(fields) => {
            update(fields, 'Recherche modifiée.');
            setEditing(false);
          }}
        />
      )}

      <div className="grid lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 space-y-5">
          {tab === 'overview' && (
            <>
              <Section
                title="Localisation recherchée"
                icon={<MapPin className="w-4 h-4" />}
              >
                <dl className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
                  <Info label="Zone principale recherchée" value={s.mainZone} />
                  <Info label="Autres zones acceptées" value={s.otherZones} />
                  <Info label="Zone ciblée" value={s.targetZone} />
                  <Info label="Rayon suggéré" value={`${s.radiusKm} km`} />
                  <Info
                    label="Flexible sur la localisation ?"
                    value={s.flexible}
                  />
                  <Info
                    label="Proposer les zones proches"
                    value={s.suggestNearby ? 'Oui' : 'Non'}
                  />
                </dl>
                {s.lat != null && s.lng != null ? (
                  <MapPicker
                    lat={s.lat}
                    lng={s.lng}
                    radiusKm={s.radiusKm}
                    readOnly
                  />
                ) : (
                  <p className="text-sm text-gray-600">
                    Pas de point placé sur la carte.
                  </p>
                )}
              </Section>

              <Section
                title={`Terrains proposés (${s.proposals.length})`}
                icon={<Send className="w-4 h-4" />}
                action={
                  <button
                    className={btnGold}
                    onClick={() => setProposing(true)}
                  >
                    <Plus className="w-4 h-4" /> Proposer un terrain
                  </button>
                }
              >
                {!s.proposals.length && (
                  <p className="text-sm text-gray-600">
                    Aucun terrain proposé pour l’instant.
                  </p>
                )}
                <ul className="space-y-3">
                  {s.proposals.map((p) => {
                    const land = landOf(p);
                    const lot = land?.lots?.find((l) => l.id === p.lotId);
                    return (
                      <li
                        key={p.id}
                        className="flex flex-col sm:flex-row gap-3 p-3 rounded-xl border border-gray-200"
                      >
                        {land && (
                          <img
                            src={lot?.imageUrl || land.imageUrl}
                            alt=""
                            className="sm:w-32 h-24 rounded-lg object-cover"
                            referrerPolicy="no-referrer"
                            loading="lazy"
                            decoding="async"
                          />
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-navy-900">
                            {land ? land.title : 'Terrain supprimé'}
                            {lot && ` — ${lot.number}`}
                          </p>
                          {land && (
                            <p className="text-sm text-gray-500">
                              {land.location} · {fmtM2(lot?.area ?? land.area)}{' '}
                              · {fmtAr(lot?.price ?? land.price)}
                            </p>
                          )}
                          <p className="text-xs text-gray-600 mt-1">
                            Proposé le {fmtDateTime(p.at)}
                            {p.note && ` · ${p.note}`}
                          </p>
                        </div>
                        <div className="flex sm:flex-col items-end gap-2">
                          <select
                            value={p.answer}
                            onChange={(e) =>
                              update(
                                {
                                  proposals: s.proposals.map((x) =>
                                    x.id === p.id
                                      ? {
                                          ...x,
                                          answer: e.target
                                            .value as Proposal['answer'],
                                        }
                                      : x,
                                  ),
                                },
                                `Réponse du client pour « ${land?.title} » : ${e.target.value}`,
                              )
                            }
                            className={`${input} w-auto py-1`}
                          >
                            {[
                              'En attente',
                              'Intéressé',
                              'Pas intéressé',
                              'Visite demandée',
                            ].map((a) => (
                              <option key={a}>{a}</option>
                            ))}
                          </select>
                          <button
                            className={`${btnIcon} hover:text-red-600`}
                            onClick={() =>
                              update(
                                {
                                  proposals: s.proposals.filter(
                                    (x) => x.id !== p.id,
                                  ),
                                },
                                `Proposition retirée : ${land?.title}`,
                              )
                            }
                            aria-label="Retirer"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </Section>
            </>
          )}

          {tab === 'documents' && (
            <Section
              title="Cahier de recherche"
              icon={<FileText className="w-4 h-4" />}
            >
              <div className="grid gap-2 sm:grid-cols-2">
                {(s.attachments ?? []).map((file) => (
                  <FileChip
                    key={file.id}
                    file={file}
                    onPreview={() => setPreview(file)}
                  />
                ))}
              </div>
            </Section>
          )}

          {tab === 'history' && (
            <Section title="Historique" icon={<History className="w-4 h-4" />}>
              <Timeline items={s.history} />
            </Section>
          )}
        </div>

        <aside className="space-y-4">
          <Section
            title="Besoin du client"
            icon={<Target className="w-4 h-4" />}
          >
            <dl className="space-y-3">
              <Info label="Usage" value={s.usage} />
              <Info label="Budget maximum" value={fmtAr(s.budgetMax)} />
              <Info
                label="Surface"
                value={
                  s.areaMin || s.areaMax
                    ? `${fmtM2(s.areaMin)} – ${fmtM2(s.areaMax)}`
                    : ''
                }
              />
              <Info
                label="Critères"
                value={
                  s.criteria && (
                    <span className="font-normal whitespace-pre-line">
                      {s.criteria}
                    </span>
                  )
                }
              />
            </dl>
          </Section>
        </aside>
      </div>

      <Preview file={preview} onClose={() => setPreview(null)} />

      {proposing && (
        <ProposeDialog
          search={s}
          onClose={() => setProposing(false)}
          onSave={(p) => {
            const land = lands.find((l) => l.id === p.landId);
            update(
              {
                proposals: [...s.proposals, p],
                status:
                  s.status === 'Nouvelle' || s.status === 'En recherche'
                    ? 'Terrains proposés'
                    : s.status,
              },
              `Terrain proposé : ${land?.title}${p.note ? ` — ${p.note}` : ''}`,
            );
            setProposing(false);
          }}
        />
      )}
    </>
  );
}

function ProposeDialog({
  search,
  onClose,
  onSave,
}: {
  search: SpecificSearch;
  onClose: () => void;
  onSave: (p: Proposal) => void;
}) {
  const already = new Set(
    search.proposals.map((p) => `${p.landId}:${p.lotId ?? ''}`),
  );
  const lands = getLands()
    .filter((l) => l.status !== 'vendu')
    .map((l) => ({ l, score: matchScore(search, l) }))
    .sort((a, b) => b.score - a.score);
  const [landId, setLandId] = useState(lands[0]?.l.id ?? '');
  const [lotId, setLotId] = useState('');
  const [note, setNote] = useState('');
  const land = lands.find((x) => x.l.id === landId)?.l;
  return (
    <Modal
      title="Proposer un terrain"
      onClose={onClose}
      footer={
        <>
          <button className={btnOutline} onClick={onClose}>
            Annuler
          </button>
          <button
            className={btnPrimary}
            disabled={!landId || already.has(`${landId}:${lotId}`)}
            onClick={() =>
              onSave({
                id: newId(),
                landId,
                lotId: lotId || undefined,
                at: new Date().toISOString(),
                note: note.trim(),
                answer: 'En attente',
              })
            }
          >
            Proposer
          </button>
        </>
      }
    >
      <Field label="Terrain (les plus pertinents en premier)">
        <select
          value={landId}
          onChange={(e) => {
            setLandId(e.target.value);
            setLotId('');
          }}
          className={input}
        >
          {lands.map(({ l, score }) => (
            <option key={l.id} value={l.id}>
              {score >= 6 ? '★★ ' : score >= 4 ? '★ ' : ''}
              {l.title} · {l.location} · {fmtAr(l.price)}
            </option>
          ))}
        </select>
        <span className="block text-xs text-gray-600 mt-1">
          ★ = correspond à la zone, au rayon et au budget du client.
        </span>
      </Field>
      {land?.lots?.length ? (
        <Field label="Parcelle">
          <select
            value={lotId}
            onChange={(e) => setLotId(e.target.value)}
            className={input}
          >
            <option value="">Terrain entier / toutes parcelles</option>
            {land.lots
              .filter((l) => l.status !== 'vendu')
              .map((l) => (
                <option key={l.id} value={l.id}>
                  {l.number} · {fmtM2(l.area)} · {fmtAr(l.price)}
                </option>
              ))}
          </select>
        </Field>
      ) : null}
      <Field label="Message / remarque">
        <textarea
          rows={2}
          className={input}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Ex : proche de la zone ciblée, dans le budget"
        />
      </Field>
      {already.has(`${landId}:${lotId}`) && (
        <p className="text-xs text-amber-600">
          Ce terrain a déjà été proposé à ce client.
        </p>
      )}
    </Modal>
  );
}

function SearchEditDialog({
  initial,
  onClose,
  onSave,
}: {
  initial: SpecificSearch;
  onClose: () => void;
  onSave: (fields: SearchFields) => void;
}) {
  const [fields, setFields] = useState<SearchFields>(initial),
    [tried, setTried] = useState(false);
  const errors = tried ? validateSearch(fields) : {};
  const submit = () => {
    setTried(true);
    if (Object.keys(validateSearch(fields)).length) return;
    onSave({ ...fields, phone: normalizePhone(fields.phone) });
  };
  return (
    <Modal
      title="Modifier la recherche"
      wide
      onClose={onClose}
      footer={
        <>
          <button className={btnOutline} onClick={onClose}>
            Annuler
          </button>
          <button className={btnPrimary} onClick={submit}>
            Enregistrer
          </button>
        </>
      }
    >
      <SearchFormFields
        f={fields}
        set={(key, value) => setFields((old) => ({ ...old, [key]: value }))}
        errors={errors}
      />
    </Modal>
  );
}
