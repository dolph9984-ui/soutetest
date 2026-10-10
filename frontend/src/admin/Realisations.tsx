import {
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Globe,
  LayoutGrid,
  List,
  Pencil,
  Plus,
  Star,
  Trash2,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { formatMonthYear } from '../lib/format';
import { askConfirm } from './crm/dialog';
import { removeFile } from './crm/files';
import {
  Badge,
  Column,
  DataTable,
  Field,
  FileDrop,
  ListToolbar,
  Modal,
  NumberInput,
  PageHeader,
  Section,
  Select,
  Stat,
  Tabs,
  Thumb,
  btnOutline,
  btnPrimary,
  fmtDate,
  fmtM2,
  input,
} from './crm/kit';
import {
  REALISATION_CATEGORIES,
  Realisation,
  deleteRealisation,
  getRealisations,
  newRealisation,
  saveRealisation,
} from './crm/people';
import { refreshCache, subscribeCache } from './crm/sync';
import {
  RecordCard,
  RecordHeader,
  RecordIdentity,
  SummaryStrip,
  useCollectionState,
} from './records';
const BASE = '/admin/realisations';
const monthLabel = (ym: string) => (ym ? formatMonthYear(`${ym}-01`) : '');
const columns: Column<Realisation>[] = [
  {
    key: 'identity',
    label: 'Projet / référence',
    render: (r) => (
      <RecordIdentity
        title={r.title || 'Sans titre'}
        reference={`#${r.id}`}
        secondary={r.location}
        image={r.photos[0]?.url}
        media
      />
    ),
    sort: (r) => r.title,
    csv: (r) => r.title,
  },
  {
    key: 'status',
    label: 'Publication',
    width: 125,
    render: (r) => <Badge value={r.published ? 'Publié' : 'Brouillon'} />,
    sort: (r) => Number(r.published),
    csv: (r) => (r.published ? 'Publié' : 'Brouillon'),
  },
  {
    key: 'category',
    label: 'Catégorie',
    width: 190,
    render: (r) => r.category,
    csv: (r) => r.category,
  },
  {
    key: 'area',
    label: 'Surface',
    width: 110,
    align: 'right',
    render: (r) => fmtM2(r.area),
    sort: (r) => r.area,
    csv: (r) => r.area,
  },
  {
    key: 'photos',
    label: 'Visuels',
    width: 80,
    align: 'right',
    render: (r) => r.photos.length,
    csv: (r) => r.photos.length,
  },
  {
    key: 'date',
    label: 'Modifié le',
    width: 110,
    render: (r) => fmtDate(r.updatedAt),
    sort: (r) => r.updatedAt,
    csv: (r) => r.updatedAt,
  },
];
export default function Realisations() {
  const navigate = useNavigate();
  const [rows, setRows] = useState(getRealisations),
    [editing, setEditing] = useState<Realisation | null>(null),
    [selected, setSelected] = useState<string[]>([]);
  const [q, setQ] = useCollectionState(BASE, 'q', ''),
    [filter, setFilter] = useCollectionState(BASE, 'filter', ''),
    [view, setView] = useCollectionState<'list' | 'grid'>(BASE, 'view', 'grid');
  const refresh = () => setRows(getRealisations());
  useEffect(() => {
    refreshCache().then(refresh);
    return subscribeCache(refresh);
  }, []);
  const shown = rows.filter(
    (r) =>
      (!filter || (filter === 'published' ? r.published : !r.published)) &&
      (!q ||
        [r.title, r.category, r.location]
          .join(' ')
          .toLowerCase()
          .includes(q.toLowerCase())),
  );
  const toggle = (r: Realisation, patch: Partial<Realisation>) => {
    void saveRealisation({ ...r, ...patch });
  };
  const remove = async (r: Realisation) => {
    if (await askConfirm(`Supprimer « ${r.title} » ?`)) {
      r.photos.forEach(removeFile);
      await deleteRealisation(r.id);
      refresh();
    }
  };
  const reset = () => {
    setQ('');
    setFilter('');
  };
  const actions = (r: Realisation) => (
    <>
      <button title="Modifier le projet" onClick={() => setEditing(r)}>
        <Pencil size={15} />
      </button>
      <button
        title={r.published ? 'Dépublier' : 'Publier'}
        onClick={() => toggle(r, { published: !r.published })}
      >
        <Globe size={15} />
      </button>
      <button
        title={r.featured ? 'Retirer de la une' : 'Mettre à la une'}
        onClick={() => toggle(r, { featured: !r.featured })}
      >
        <Star size={15} />
      </button>
      <button
        title="Supprimer"
        className="text-red-600"
        onClick={() => remove(r)}
      >
        <Trash2 size={15} />
      </button>
    </>
  );
  return (
    <>
      <PageHeader
        title="Réalisations"
        subtitle="Galerie de projets et suivi de leur publication sur le site."
        action={
          <>
            <a
              href="/realisations"
              target="_blank"
              rel="noopener noreferrer"
              className={btnOutline}
            >
              <ExternalLink size={15} />
              Voir sur le site
            </a>
            <button
              className={btnPrimary}
              onClick={() => setEditing(newRealisation())}
            >
              <Plus size={15} />
              Nouvelle réalisation
            </button>
          </>
        }
      />
      <div className="grid grid-cols-3 gap-3 mb-5">
        <Stat label="Projets" value={rows.length} />
        <Stat label="Publiés" value={rows.filter((r) => r.published).length} />
        <Stat
          label="Brouillons"
          value={rows.filter((r) => !r.published).length}
        />
      </div>
      <ListToolbar
        q={q}
        onQ={setQ}
        onReset={reset}
        placeholder="Rechercher : projet, lieu, catégorie…"
        activeFilters={filter ? 1 : 0}
        filters={
          <label>
            <span className="sr-only">Publication</span>
            <select
              className={input}
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            >
              <option value="">Toutes les publications</option>
              <option value="published">Publiés</option>
              <option value="draft">Brouillons</option>
            </select>
          </label>
        }
        exportRows={() => shown}
        exportColumns={columns}
        exportName="realisations"
        extra={
          <div
            className="record-view-switch"
            role="group"
            aria-label="Mode d’affichage"
          >
            <button
              aria-pressed={view === 'list'}
              onClick={() => setView('list')}
            >
              <List size={14} />
              Liste
            </button>
            <button
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
          rows={shown}
          columns={columns}
          selected={selected}
          onSelect={setSelected}
          entityLabel="projets"
          filtered={!!(q || filter)}
          onClearFilters={reset}
          onOpen={(r) => navigate(`${BASE}/${r.id}`)}
          rowActions={actions}
        />
      ) : (
        <div className="record-card-grid">
          {shown.map((r) => (
            <RecordCard
              key={r.id}
              title={r.title || 'Sans titre'}
              reference={`#${r.id}`}
              secondary={r.location}
              image={r.photos[0]?.url}
              media
              status={r.published ? 'Publié' : 'Brouillon'}
              onOpen={() => navigate(`${BASE}/${r.id}`)}
              facts={[
                { label: 'Catégorie', value: r.category },
                { label: 'Surface', value: fmtM2(r.area) },
                { label: 'Visuels', value: r.photos.length },
                { label: 'Modifié le', value: fmtDate(r.updatedAt) },
              ]}
            >
              {actions(r)}
            </RecordCard>
          ))}
          {!shown.length && (
            <p className="col-span-full p-10 text-center text-slate-500">
              Aucun projet pour ces filtres.
            </p>
          )}
        </div>
      )}
      {editing && (
        <RealisationForm
          initial={editing}
          onClose={() => setEditing(null)}
          onSave={async (r) => {
            await saveRealisation(r);
            setEditing(null);
            refresh();
          }}
        />
      )}
    </>
  );
}

export function RealisationDetail() {
  const { id } = useParams();
  const [r, setR] = useState(() => getRealisations().find((r) => r.id === id)),
    [editing, setEditing] = useState(false),
    [tab, setTab] = useState<'overview' | 'photos'>('overview');
  useEffect(() => {
    refreshCache(true).then(() =>
      setR(getRealisations().find((r) => r.id === id)),
    );
    return subscribeCache(() =>
      setR(getRealisations().find((r) => r.id === id)),
    );
  }, [id]);
  if (!r)
    return (
      <p className="py-12">
        Projet introuvable. <Link to={BASE}>Retour</Link>
      </p>
    );
  return (
    <>
      <RecordHeader
        module="Réalisations"
        backTo={BASE}
        title={r.title || 'Sans titre'}
        reference={`#${r.id}`}
        status={r.published ? 'Publié' : 'Brouillon'}
        subtitle={r.location}
        action={
          <>
            <button className={btnOutline} onClick={() => setEditing(true)}>
              <Pencil size={15} />
              Modifier
            </button>
            <button
              className={btnPrimary}
              onClick={() => {
                void saveRealisation({ ...r, published: !r.published });
              }}
            >
              {r.published ? 'Dépublier' : 'Publier'}
            </button>
          </>
        }
      />
      <SummaryStrip
        facts={[
          { label: 'Catégorie', value: r.category },
          { label: 'Surface', value: fmtM2(r.area) },
          { label: 'Visuels', value: r.photos.length },
          { label: 'Modifié le', value: fmtDate(r.updatedAt) },
        ]}
      />
      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          { id: 'overview', label: 'Résumé' },
          { id: 'photos', label: `Photos (${r.photos.length})` },
        ]}
      />
      {tab === 'overview' && (
        <Section title="Présentation du projet">
          <p className="text-sm leading-7 whitespace-pre-line text-slate-600">
            {r.description || 'Description non renseignée.'}
          </p>
          <dl className="record-facts mt-6">
            <div>
              <dt>Client</dt>
              <dd>{r.client || '—'}</dd>
            </div>
            <div>
              <dt>Durée</dt>
              <dd>{r.duration || '—'}</dd>
            </div>
            <div>
              <dt>Fin des travaux</dt>
              <dd>{monthLabel(r.completedAt) || 'Non renseignée'}</dd>
            </div>
            <div>
              <dt>Mis à la une</dt>
              <dd>{r.featured ? 'Oui' : 'Non'}</dd>
            </div>
          </dl>
        </Section>
      )}
      {tab === 'photos' && (
        <Section title="Galerie du projet">
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {r.photos.map((p) => (
              <Thumb
                key={p.id}
                file={p}
                className="w-full aspect-video rounded-lg"
              />
            ))}
          </div>
        </Section>
      )}
      {editing && (
        <RealisationForm
          initial={r}
          onClose={() => setEditing(false)}
          onSave={async (updated) => {
            await saveRealisation(updated);
            setEditing(false);
          }}
        />
      )}
    </>
  );
}

function RealisationForm({
  initial,
  onClose,
  onSave,
}: {
  initial: Realisation;
  onClose: () => void;
  onSave: (r: Realisation) => void | Promise<void>;
}) {
  const [r, setR] = useState(initial);
  const [tried, setTried] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const set = <K extends keyof Realisation>(k: K, v: Realisation[K]) =>
    setR((x) => ({ ...x, [k]: v }));
  const move = (i: number, d: -1 | 1) => {
    const p = [...r.photos];
    [p[i], p[i + d]] = [p[i + d], p[i]];
    set('photos', p);
  };
  const invalid = !r.title.trim() || !r.description.trim() || !r.photos.length;

  const submit = async (publish: boolean) => {
    setTried(true);
    if (invalid) return;
    setBusy(true);
    setError('');
    try {
      await onSave({ ...r, published: publish });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Enregistrement impossible.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      title={initial.title ? 'Modifier la réalisation' : 'Nouvelle réalisation'}
      wide
      onClose={onClose}
      footer={
        <>
          <button className={btnOutline} onClick={onClose}>
            Annuler
          </button>
          <button
            className={btnOutline}
            disabled={busy}
            onClick={() => submit(false)}
          >
            {busy ? 'Enregistrement…' : 'Enregistrer le brouillon'}
          </button>
          <button
            className={btnPrimary}
            onClick={() => submit(true)}
            disabled={busy || !r.title.trim() || !r.description.trim()}
          >
            Publier
          </button>
        </>
      }
    >
      <div className="space-y-4">
        {error && (
          <p role="alert" className="text-sm text-red-700">
            {error}
          </p>
        )}
        <div className="grid sm:grid-cols-2 gap-4">
          <Field
            label="Titre"
            required
            error={tried && !r.title.trim() ? 'Champ obligatoire' : undefined}
            span={2}
          >
            <input
              className={input}
              value={r.title}
              onChange={(e) => set('title', e.target.value)}
              placeholder="Ex : Villa R+1 à Ivato"
            />
          </Field>
          <Field label="Catégorie">
            <Select
              value={r.category}
              onChange={(v) => set('category', v)}
              options={REALISATION_CATEGORIES}
            />
          </Field>
          <Field label="Lieu">
            <input
              className={input}
              value={r.location}
              onChange={(e) => set('location', e.target.value)}
              placeholder="Ex : Ivato, Antananarivo"
            />
          </Field>
          <Field label="Date de fin des travaux">
            <input
              type="month"
              className={input}
              value={r.completedAt}
              onChange={(e) => set('completedAt', e.target.value)}
            />
          </Field>
          <Field label="Durée du chantier">
            <input
              className={input}
              value={r.duration}
              onChange={(e) => set('duration', e.target.value)}
              placeholder="Ex : 8 mois"
            />
          </Field>
          <Field label="Surface" hint={r.area ? fmtM2(r.area) : undefined}>
            <NumberInput
              value={r.area}
              onChange={(v) => set('area', v)}
              suffix="m²"
            />
          </Field>
          <Field label="Client (affiché si renseigné)">
            <input
              className={input}
              value={r.client}
              onChange={(e) => set('client', e.target.value)}
              placeholder="Ex : Famille R."
            />
          </Field>
          <Field
            label="Description"
            required
            error={
              tried && !r.description.trim() ? 'Champ obligatoire' : undefined
            }
            span={2}
          >
            <textarea
              rows={5}
              className={input}
              value={r.description}
              onChange={(e) => set('description', e.target.value)}
              placeholder="Le projet, les travaux réalisés, le résultat…"
            />
          </Field>
        </div>

        <div>
          <p className="text-xs font-medium text-gray-600 mb-1.5">
            Photos <span className="text-red-500">*</span>{' '}
            <span className="text-gray-600">
              (la première sert de couverture)
            </span>
          </p>
          <FileDrop
            visibility="public"
            accept="image/jpeg,image/png,image/webp"
            maxMb={15}
            multiple
            label="Ajouter des photos"
            hint="JPG, PNG, WEBP · 15 Mo max"
            onFiles={(files) => set('photos', [...r.photos, ...files])}
          />
          {tried && !r.photos.length && (
            <p className="text-xs text-red-600 mt-1">
              Ajoutez au moins une photo.
            </p>
          )}
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 mt-3">
            {r.photos.map((p, i) => (
              <div
                key={p.id}
                className={`relative rounded-lg overflow-hidden border-2 ${i === 0 ? 'border-gold-500' : 'border-transparent'}`}
              >
                <Thumb file={p} className="w-full aspect-[4/3]" />
                <div className="absolute bottom-0 inset-x-0 flex justify-between bg-gradient-to-t from-black/70 to-transparent p-1">
                  <div className="flex">
                    <button
                      disabled={i === 0}
                      onClick={() => move(i, -1)}
                      className="p-1 text-white disabled:opacity-30"
                      aria-label="Gauche"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <button
                      disabled={i === r.photos.length - 1}
                      onClick={() => move(i, 1)}
                      className="p-1 text-white disabled:opacity-30"
                      aria-label="Droite"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                  <button
                    onClick={() => {
                      removeFile(p);
                      set(
                        'photos',
                        r.photos.filter((x) => x.id !== p.id),
                      );
                    }}
                    className="p-1 text-white hover:text-red-300"
                    aria-label="Supprimer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={r.featured}
            onChange={(e) => set('featured', e.target.checked)}
          />{' '}
          Mettre à la une (affichée en premier)
        </label>
      </div>
    </Modal>
  );
}
