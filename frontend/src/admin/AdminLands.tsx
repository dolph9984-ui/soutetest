import {
  HandCoins,
  LayoutGrid,
  List,
  Pencil,
  Plus,
  RotateCcw,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { formatAriary, formatNumber } from '../lib/format';
import { getLands, resetLands } from '../lib/store';
import { Land } from '../types';
import { askConfirm } from './crm/dialog';
import {
  Badge,
  Column,
  DataTable,
  ListToolbar,
  Select,
  Stat,
  btnOutline,
  btnPrimary,
} from './crm/kit';
import { canLoadPresentation, refreshCache, subscribeCache } from './crm/sync';
import {
  LAND_STATUSES,
  PUBLICATION_STATUSES,
  publicationLabel,
} from './landCatalog';
import { RecordCard, RecordIdentity, useCollectionState } from './records';
import SaleDialog from './SaleDialog';
import { PageHeader } from './ui';

const BASE = '/admin/terrains';
const surface = (area: number) => (area > 0 ? `${formatNumber(area)} m²` : '—');
const columns: Column<Land>[] = [
  {
    key: 'identity',
    label: 'Terrain / référence',
    render: (l) => (
      <RecordIdentity
        title={l.title}
        reference={`#${l.id}`}
        secondary={l.zone || l.region}
        image={l.imageUrl}
        media
      />
    ),
    sort: (l) => l.title,
    csv: (l) => l.title,
  },
  {
    key: 'publication',
    label: 'Publication',
    width: 125,
    render: (l) => <Badge value={publicationLabel(l.publicationStatus)} dot />,
    sort: (l) => l.publicationStatus ?? '',
    csv: (l) => publicationLabel(l.publicationStatus),
  },
  {
    key: 'availability',
    label: 'Disponibilité',
    width: 130,
    render: (l) => <Badge value={l.status} />,
    sort: (l) => l.status,
    csv: (l) => l.status,
  },
  {
    key: 'area',
    label: 'Surface',
    width: 105,
    align: 'right',
    render: (l) => surface(l.area),
    sort: (l) => l.area,
    csv: (l) => l.area,
  },
  {
    key: 'price',
    label: 'Prix',
    width: 170,
    align: 'right',
    render: (l) => formatAriary(l.price),
    sort: (l) => l.price,
    csv: (l) => l.price,
  },
  {
    key: 'documents',
    label: 'Pièces',
    width: 70,
    align: 'right',
    render: (l) => l.documents?.length ?? 0,
    csv: (l) => l.documents?.length ?? 0,
  },
  {
    key: 'lots',
    label: 'Parcelles',
    render: (l) => l.lots?.length ?? 0,
    csv: (l) => l.lots?.length ?? 0,
    defaultVisible: false,
  },
  {
    key: 'location',
    label: 'Localisation',
    render: (l) => l.location,
    csv: (l) => l.location,
    defaultVisible: false,
  },
  {
    key: 'landStatus',
    label: 'Information foncière déclarée',
    render: (l) => l.titleStatus,
    csv: (l) => l.titleStatus,
    defaultVisible: false,
  },
];

export default function AdminLands() {
  const navigate = useNavigate();
  const [lands, setLands] = useState(getLands),
    [selected, setSelected] = useState<string[]>([]),
    [selling, setSelling] = useState<Land | null>(null);
  const [q, setQ] = useCollectionState(BASE, 'q', ''),
    [status, setStatus] = useCollectionState(BASE, 'status', ''),
    [publication, setPublication] = useCollectionState(BASE, 'publication', '');
  const [view, setView] = useCollectionState<'list' | 'grid'>(
    BASE,
    'view',
    'list',
  );
  const [loading, setLoading] = useState(false),
    [error, setError] = useState('');
  useEffect(() => {
    refreshCache().then(() => setLands(getLands()));
    return subscribeCache(() => setLands(getLands()));
  }, []);
  const filtered = lands.filter(
    (l) =>
      (!q ||
        [l.title, l.location, l.zone ?? '', l.id]
          .join(' ')
          .toLowerCase()
          .includes(q.toLowerCase())) &&
      (!status || l.status === status) &&
      (!publication || (l.publicationStatus ?? 'publie') === publication),
  );
  const resetFilters = () => {
    setQ('');
    setStatus('');
    setPublication('');
  };
  const actions = (l: Land) => (
    <>
      <Link to={`${BASE}/${l.id}/modifier`} title="Modifier le terrain">
        <Pencil size={15} />
      </Link>
      {l.status !== 'vendu' && (
        <button title="Enregistrer une vente" onClick={() => setSelling(l)}>
          <HandCoins size={15} />
        </button>
      )}
    </>
  );
  const addExamples = async () => {
    if (
      !(await askConfirm(
        'Ajouter les exemples sans supprimer ni modifier les données existantes ?',
      ))
    )
      return;
    setLoading(true);
    setError('');
    try {
      await resetLands();
      await refreshCache(true);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : 'Impossible de charger les exemples.',
      );
    } finally {
      setLoading(false);
    }
  };
  return (
    <>
      <PageHeader
        title="Catalogue du site"
        subtitle="Gérez les informations, la disponibilité et la publication de vos terrains."
        action={
          <>
            {canLoadPresentation() && (
              <button
                className={btnOutline}
                disabled={loading}
                onClick={addExamples}
              >
                <RotateCcw size={15} />
                Charger les exemples
              </button>
            )}
            <Link to={`${BASE}/nouveau`} className={btnPrimary}>
              <Plus size={15} />
              Ajouter un terrain
            </Link>
          </>
        }
      />
      <div className="grid grid-cols-3 gap-3 mb-5">
        <Stat label="Terrains" value={lands.length} />
        <Stat
          label="Publiés"
          value={lands.filter((l) => l.publicationStatus === 'publie').length}
        />
        <Stat
          label="Disponibles"
          value={lands.filter((l) => l.status === 'disponible').length}
        />
      </div>
      {error && (
        <p role="alert" className="text-red-700 text-sm mb-4">
          {error}
        </p>
      )}
      <ListToolbar
        q={q}
        onQ={setQ}
        placeholder="Rechercher : terrain, localisation, référence…"
        onReset={resetFilters}
        activeFilters={Number(!!status) + Number(!!publication)}
        filters={
          <>
            <Select
              value={status}
              onChange={setStatus}
              options={LAND_STATUSES}
              placeholder="Toutes les disponibilités"
            />
            <label>
              <span className="sr-only">Publication</span>
              <select
                className="admin-input w-full min-h-10 border border-slate-300 rounded-lg px-3 text-sm"
                value={publication}
                onChange={(e) => setPublication(e.target.value)}
              >
                <option value="">Toutes les publications</option>
                {PUBLICATION_STATUSES.map((s) => (
                  <option value={s} key={s}>
                    {publicationLabel(s)}
                  </option>
                ))}
              </select>
            </label>
          </>
        }
        exportRows={() =>
          selected.length
            ? filtered.filter((l) => selected.includes(l.id))
            : filtered
        }
        exportColumns={columns}
        exportName="catalogue-terrains"
        extra={
          <div
            className="record-view-switch"
            role="group"
            aria-label="Mode d’affichage"
          >
            <button
              type="button"
              aria-pressed={view === 'list'}
              onClick={() => setView('list')}
            >
              <List size={14} />
              Liste
            </button>
            <button
              type="button"
              aria-pressed={view === 'grid'}
              onClick={() => setView('grid')}
            >
              <LayoutGrid size={14} />
              Grille
            </button>
          </div>
        }
      />
      {view === 'list' ? (
        <DataTable
          rows={filtered}
          columns={columns}
          selected={selected}
          onSelect={setSelected}
          entityLabel="terrains"
          filtered={!!(q || status || publication)}
          onClearFilters={resetFilters}
          onOpen={(l) => navigate(`${BASE}/${l.id}`)}
          rowActions={actions}
        />
      ) : (
        <div className="record-card-grid">
          {filtered.map((l) => (
            <RecordCard
              key={l.id}
              title={l.title}
              reference={`#${l.id}`}
              secondary={l.zone || l.region}
              status={publicationLabel(l.publicationStatus)}
              image={l.imageUrl}
              media
              onOpen={() => navigate(`${BASE}/${l.id}`)}
              facts={[
                { label: 'Surface', value: surface(l.area) },
                { label: 'Prix', value: formatAriary(l.price) },
                { label: 'Disponibilité', value: <Badge value={l.status} /> },
                { label: 'Pièces', value: l.documents?.length ?? 0 },
              ]}
            >
              {actions(l)}
            </RecordCard>
          ))}
          {!filtered.length && (
            <div className="col-span-full bg-white rounded-lg border border-slate-200 p-10 text-center text-sm text-slate-500">
              Aucun terrain pour ces filtres.{' '}
              <button className="underline" onClick={resetFilters}>
                Effacer les filtres
              </button>
            </div>
          )}
        </div>
      )}
      {selling && (
        <SaleDialog
          land={selling}
          onClose={() => setSelling(null)}
          onDone={() => {
            setSelling(null);
            setLands(getLands());
          }}
        />
      )}
    </>
  );
}
