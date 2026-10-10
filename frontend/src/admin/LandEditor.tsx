import {
  AlertTriangle,
  CheckCircle2,
  FileText,
  ImagePlus,
  Layers3,
  MapPinned,
  Plus,
  Save,
  Sparkles,
  Trash2,
  Upload,
  WalletCards,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import LandCard from '../features/catalog/LandCard';
import { formatArea, formatAriary } from '../lib/format';
import { getLands, saveLand } from '../lib/store';
import { Land, LandDocument, Lot } from '../types';
import { removeFile } from './crm/files';
import {
  Field,
  FileChip,
  FileDrop,
  Preview,
  Section,
  Tabs,
  btnOutline,
} from './crm/kit';
import type { StoredFile } from './crm/model';
import {
  LAND_STATUSES,
  PAYMENT_MODES,
  PUBLICATION_STATUSES,
  RELIEF_OPTIONS,
  TITLE_STATUSES,
  createEmptyLand,
  landFrontMissing,
  landFrontScore,
  landPublishIssues,
  publicationLabel,
  publicationTone,
} from './landCatalog';
import LandFrontPreview from './LandFrontPreview';
import { FormFooter, RecordHeader } from './records';
import { Badge, Card, btnGhost, btnPrimary, inputClass } from './ui';

// Mêmes sous-sections (onglets) que les fiches « Demandes de vente » / « Demandes
// d'achat » : un seul schéma d'affichage pour toutes les fiches terrain.
type TabId = 'identite' | 'visuels' | 'terrain' | 'prix' | 'documents' | 'lots';

function parseLines(text: string): string[] {
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
}

function joinLines(lines?: string[]): string {
  return (lines ?? []).join('\n');
}

function buildGallery(cover: string, extras: string[]): string[] {
  return [
    ...new Set(
      [cover.trim(), ...extras.map((item) => item.trim())].filter(Boolean),
    ),
  ];
}

function scoreTone(score: number) {
  if (score >= 90) return 'bg-green-100 text-green-800';
  if (score >= 70) return 'bg-amber-100 text-amber-800';
  return 'bg-red-100 text-red-700';
}

function MediaThumb({
  src,
  label,
  onRemove,
  onPromote,
  cover = false,
}: {
  src: string;
  label?: string;
  onRemove: () => void;
  onPromote?: () => void;
  cover?: boolean;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white">
      <div className="relative aspect-[4/3] bg-gray-100">
        <img
          src={src}
          alt={label ?? ''}
          className="h-full w-full object-cover"
          referrerPolicy="no-referrer"
          loading="lazy"
          decoding="async"
        />
        {cover && (
          <span className="absolute left-3 top-3 rounded-full bg-navy-900 px-2.5 py-1 text-[11px] font-semibold text-white">
            Couverture
          </span>
        )}
      </div>
      <div className="space-y-2 p-3">
        <p className="truncate text-xs text-gray-500">{label ?? src}</p>
        <div className="flex flex-wrap gap-2">
          {onPromote && (
            <button type="button" onClick={onPromote} className={btnOutline}>
              Mettre en couverture
            </button>
          )}
          <button
            type="button"
            onClick={onRemove}
            className={`${btnGhost} hover:text-red-600`}
          >
            <Trash2 className="h-4 w-4" /> Retirer
          </button>
        </div>
      </div>
    </div>
  );
}

export default function LandEditor() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const existing = useMemo(
    () => (id ? getLands().find((land) => land.id === id) : undefined),
    [id],
  );
  const isNew = !id;

  const [form, setForm] = useState<Land>(() => existing ?? createEmptyLand());
  const [featuresText, setFeaturesText] = useState(
    joinLines(existing?.features),
  );
  const [galleryItems, setGalleryItems] = useState<string[]>(
    (existing?.gallery ?? []).filter((src) => src !== existing?.imageUrl),
  );
  const [documents, setDocuments] = useState<LandDocument[]>(
    existing?.documents ?? [],
  );
  const [docPreview, setDocPreview] = useState<StoredFile | null>(null);
  const [lat, setLat] = useState(existing?.coordinates?.[0]?.toString() ?? '');
  const [lng, setLng] = useState(existing?.coordinates?.[1]?.toString() ?? '');
  const [lots, setLots] = useState<Lot[]>(existing?.lots ?? []);
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState<TabId>('identite');

  useEffect(() => {
    const next = existing ?? createEmptyLand();
    setForm(next);
    setFeaturesText(joinLines(next.features));
    setGalleryItems(
      (next.gallery ?? []).filter((src) => src !== next.imageUrl),
    );
    setDocuments(next.documents ?? []);
    setLat(next.coordinates?.[0]?.toString() ?? '');
    setLng(next.coordinates?.[1]?.toString() ?? '');
    setLots(next.lots ?? []);
  }, [existing?.id, isNew]);

  const set = <K extends keyof Land>(key: K, value: Land[K]) =>
    setForm((current) => ({ ...current, [key]: value }));
  const setLot = <K extends keyof Lot>(lotId: string, key: K, value: Lot[K]) =>
    setLots((current) =>
      current.map((lot) => (lot.id === lotId ? { ...lot, [key]: value } : lot)),
    );

  const appendGalleryUrls = (urls: string[]) => {
    setGalleryItems((current) => [
      ...new Set([...current, ...urls.filter(Boolean)]),
    ]);
  };

  const setCoverImage = (url: string) => {
    const next = url.trim();
    if (!next) return;
    setForm((current) => {
      const previous = current.imageUrl?.trim();
      if (previous && previous !== next) {
        setGalleryItems((items) => [
          ...new Set([previous, ...items.filter((item) => item !== next)]),
        ]);
      }
      return { ...current, imageUrl: next };
    });
  };

  const gallery = useMemo(
    () => buildGallery(form.imageUrl, galleryItems),
    [form.imageUrl, galleryItems],
  );
  const galleryExtras = useMemo(
    () => galleryItems.filter(Boolean),
    [galleryItems],
  );
  const features = useMemo(() => parseLines(featuresText), [featuresText]);
  const coordinates = useMemo<[number, number] | undefined>(() => {
    if (!lat.trim() || !lng.trim()) return undefined;
    const latitude = Number(lat);
    const longitude = Number(lng);
    if (Number.isNaN(latitude) || Number.isNaN(longitude)) return undefined;
    return [latitude, longitude];
  }, [lat, lng]);

  const previewLand = useMemo<Land>(
    () => ({
      ...form,
      publicationStatus: form.publicationStatus ?? 'brouillon',
      features,
      gallery,
      documents,
      coordinates,
      lots,
    }),
    [coordinates, documents, features, form, gallery, lots],
  );

  const missing = landFrontMissing(previewLand);
  const publishIssues = landPublishIssues(previewLand);
  const score = landFrontScore(previewLand);
  const lotArea = lots.reduce(
    (total, lot) => total + (Number(lot.area) || 0),
    0,
  );
  const invalidCoords =
    (lat.trim() && !lng.trim()) ||
    (!lat.trim() && lng.trim()) ||
    (lat.trim() && Number.isNaN(Number(lat))) ||
    (lng.trim() && Number.isNaN(Number(lng)));
  const invalidLots =
    lots.some((lot) => !lot.number.trim() || lot.area <= 0 || lot.price <= 0) ||
    lotArea > (previewLand.area || 0);
  const invalidCore =
    !previewLand.title.trim() ||
    !previewLand.price ||
    !previewLand.area ||
    !previewLand.region.trim() ||
    !previewLand.location.trim();
  const publishBlocked =
    previewLand.publicationStatus === 'publie' && publishIssues.length > 0;
  const canSave =
    !invalidCore && !invalidCoords && !invalidLots && !publishBlocked;
  const isPublished = previewLand.publicationStatus === 'publie';
  const canPreviewCard = Boolean(
    previewLand.imageUrl || previewLand.gallery?.length,
  );

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!canSave || saving) return;
    setSaving(true);
    await saveLand(previewLand);
    setSaving(false);
    navigate('/admin/terrains');
  };

  const addLot = () =>
    setLots((current) => [
      ...current,
      {
        id: `lot-${Date.now().toString(36)}-${current.length + 1}`,
        number: `Lot ${current.length + 1}`,
        area: 0,
        price: 0,
        status: 'disponible',
        imageUrl: '',
        details: '',
      },
    ]);

  const removeLot = (lotId: string) =>
    setLots((current) => current.filter((lot) => lot.id !== lotId));
  const removeGalleryUrl = (url: string) =>
    setGalleryItems((current) => current.filter((item) => item !== url));
  const promoteAsCover = (url: string) => {
    setGalleryItems((current) => {
      const withoutTarget = current.filter((item) => item !== url);
      const previous = form.imageUrl?.trim();
      return previous && previous !== url
        ? [...new Set([previous, ...withoutTarget])]
        : withoutTarget;
    });
    set('imageUrl', url);
  };
  const removeCover = () => {
    if (galleryItems.length) {
      const [nextCover, ...rest] = galleryItems;
      set('imageUrl', nextCover);
      setGalleryItems(rest);
      return;
    }
    set('imageUrl', '');
  };
  const uploadedUrls = (files: StoredFile[]) =>
    files.map((file) => file.url).filter(Boolean) as string[];

  if (id && !existing) return <Navigate to="/admin/terrains" replace />;

  return (
    <form onSubmit={submit} className="space-y-6">
      <RecordHeader
        module="Catalogue du site"
        backTo={existing ? `/admin/terrains/${existing.id}` : '/admin/terrains'}
        mode={isNew ? 'create' : 'edit'}
        title={isNew ? 'Nouveau terrain' : 'Modifier le terrain'}
        reference={existing ? `#${existing.id}` : undefined}
        subtitle={
          existing?.title || 'Informations du terrain, médias et publication.'
        }
        action={
          <button
            type="submit"
            className={btnPrimary}
            disabled={!canSave || saving}
          >
            <Save size={15} />
            {saving ? 'Enregistrement…' : 'Enregistrer'}
          </button>
        }
      />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_24rem]">
        <div className="space-y-6">
          <Tabs
            value={tab}
            onChange={(t) => setTab(t)}
            tabs={[
              { id: 'identite', label: '1. Identité & publication' },
              { id: 'visuels', label: '2. Visuels' },
              { id: 'terrain', label: '3. Terrain & localisation' },
              { id: 'prix', label: '4. Prix & conditions' },
              { id: 'documents', label: `5. Documents (${documents.length})` },
              { id: 'lots', label: `6. Lotissement (${lots.length})` },
            ]}
          />

          {tab === 'identite' && (
            <Section
              title="Identité, statut et publication"
              hint="On distingue désormais le statut commercial du workflow éditorial du front office."
              icon={<Sparkles className="h-5 w-5" />}
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Titre *" full>
                  <input
                    required
                    value={form.title}
                    onChange={(e) => set('title', e.target.value)}
                    className={inputClass}
                    placeholder="Ex : Terrain résidentiel à Ivato"
                  />
                </Field>
                <Field
                  label="Description *"
                  full
                  hint="Elle alimente directement la fiche publique."
                >
                  <textarea
                    required
                    rows={5}
                    value={form.description}
                    onChange={(e) => set('description', e.target.value)}
                    className={inputClass}
                    placeholder="Décrivez l’environnement, le potentiel, les points forts…"
                  />
                </Field>
                <Field label="Région *">
                  <input
                    required
                    value={form.region}
                    onChange={(e) => set('region', e.target.value)}
                    className={inputClass}
                    placeholder="Ex : Analamanga"
                  />
                </Field>
                <Field
                  label="Zone / commune"
                  hint="Affinage des filtres et cohérence fiche publique."
                >
                  <input
                    value={form.zone ?? ''}
                    onChange={(e) => set('zone', e.target.value)}
                    className={inputClass}
                    placeholder="Ex : Ivato"
                  />
                </Field>
                <Field label="Localisation affichée *" full>
                  <input
                    required
                    value={form.location}
                    onChange={(e) => set('location', e.target.value)}
                    className={inputClass}
                    placeholder="Ex : Ivato, Antananarivo"
                  />
                </Field>
                <Field label="Statut juridique">
                  <select
                    value={form.titleStatus}
                    onChange={(e) =>
                      set('titleStatus', e.target.value as Land['titleStatus'])
                    }
                    className={inputClass}
                  >
                    {TITLE_STATUSES.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Disponibilité commerciale">
                  <select
                    value={form.status}
                    onChange={(e) =>
                      set('status', e.target.value as Land['status'])
                    }
                    className={inputClass}
                  >
                    {LAND_STATUSES.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field
                  label="Workflow de publication"
                  hint="Seuls les terrains publiés apparaissent sur le site public."
                >
                  <select
                    value={form.publicationStatus ?? 'brouillon'}
                    onChange={(e) =>
                      set(
                        'publicationStatus',
                        e.target.value as Land['publicationStatus'],
                      )
                    }
                    className={inputClass}
                  >
                    {PUBLICATION_STATUSES.map((option) => (
                      <option key={option} value={option}>
                        {publicationLabel(option)}
                      </option>
                    ))}
                  </select>
                </Field>
                <div className="sm:col-span-2 grid gap-3 sm:grid-cols-2">
                  <label className="flex items-start gap-3 rounded-xl border border-gray-200 p-4">
                    <input
                      type="checkbox"
                      className="mt-1"
                      checked={Boolean(form.featured)}
                      onChange={(e) => set('featured', e.target.checked)}
                    />
                    <span>
                      <span className="block text-sm font-medium text-navy-900">
                        Mettre à la une
                      </span>
                      <span className="mt-1 block text-xs text-gray-500">
                        Le bien remonte en priorité dans le catalogue public.
                      </span>
                    </span>
                  </label>
                </div>
                {publishBlocked && (
                  <div className="sm:col-span-2 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
                    <p className="font-semibold">Publication bloquée</p>
                    <p className="mt-1 text-xs">
                      Complète ces éléments avant de passer le terrain en «
                      Publié » :
                    </p>
                    <ul className="mt-2 list-disc space-y-1 pl-5 text-xs">
                      {publishIssues.map((issue) => (
                        <li key={issue}>{issue}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </Section>
          )}

          {tab === 'visuels' && (
            <Section
              title="Visuels et arguments commerciaux"
              hint="Upload direct des images uniquement : plus de saisie manuelle d’URL pour les visuels du catalogue."
              icon={<ImagePlus className="h-5 w-5" />}
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <Field
                  label="Photo de couverture"
                  full
                  hint="Image principale utilisée sur les cartes du catalogue."
                >
                  <div className="space-y-3">
                    <FileDrop
                      visibility="public"
                      accept="image/jpeg,image/png,image/webp"
                      maxMb={15}
                      label="Téléverser la couverture"
                      hint="JPG, PNG, WEBP · 15 Mo max"
                      onFiles={(files) => {
                        const first = uploadedUrls(files)[0];
                        if (first) setCoverImage(first);
                      }}
                    />
                    {form.imageUrl ? (
                      <MediaThumb
                        src={form.imageUrl}
                        label="Image de couverture"
                        cover
                        onRemove={removeCover}
                      />
                    ) : (
                      <div className="rounded-2xl border border-dashed border-gray-300 bg-gray-50 px-4 py-8 text-center text-sm text-gray-500">
                        Aucune couverture pour le moment.
                      </div>
                    )}
                  </div>
                </Field>

                <Field
                  label="Galerie complémentaire"
                  full
                  hint="Les images de galerie sont uploadées puis stockées côté serveur."
                >
                  <div className="space-y-3">
                    <FileDrop
                      visibility="public"
                      accept="image/jpeg,image/png,image/webp"
                      maxMb={15}
                      multiple
                      label="Téléverser des images de galerie"
                      hint="Plusieurs fichiers possibles"
                      onFiles={(files) =>
                        appendGalleryUrls(uploadedUrls(files))
                      }
                    />
                    {galleryExtras.length > 0 ? (
                      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                        {galleryExtras.map((src) => (
                          <MediaThumb
                            key={src}
                            src={src}
                            onRemove={() => removeGalleryUrl(src)}
                            onPromote={() => promoteAsCover(src)}
                          />
                        ))}
                      </div>
                    ) : (
                      <div className="rounded-2xl border border-dashed border-gray-300 bg-gray-50 px-4 py-8 text-center text-sm text-gray-500">
                        Aucune image de galerie ajoutée.
                      </div>
                    )}
                  </div>
                </Field>

                <Field
                  label="Atouts du terrain"
                  full
                  hint="Un atout par ligne : ils deviennent des badges sur le front office."
                >
                  <textarea
                    rows={5}
                    value={featuresText}
                    onChange={(e) => setFeaturesText(e.target.value)}
                    className={inputClass}
                    placeholder="Terrain plat&#10;Accès route goudronnée&#10;Quartier résidentiel"
                  />
                </Field>
              </div>
            </Section>
          )}

          {tab === 'terrain' && (
            <Section
              title="Caractéristiques, localisation et viabilisation"
              hint="Informations opérationnelles que le visiteur retrouve sur la fiche détaillée."
              icon={<MapPinned className="h-5 w-5" />}
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Surface (m²) *">
                  <input
                    required
                    type="number"
                    min={0}
                    value={form.area || ''}
                    onChange={(e) => set('area', Number(e.target.value))}
                    className={inputClass}
                  />
                </Field>
                <Field label="Relief">
                  <select
                    value={form.relief ?? 'Plat'}
                    onChange={(e) =>
                      set('relief', e.target.value as Land['relief'])
                    }
                    className={inputClass}
                  >
                    {RELIEF_OPTIONS.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Accès / voirie" full>
                  <input
                    value={form.access ?? ''}
                    onChange={(e) => set('access', e.target.value)}
                    className={inputClass}
                    placeholder="Ex : Route bitumée à 80 m"
                  />
                </Field>
                <Field
                  label="Latitude"
                  hint="Laisser vide si la carte n’est pas encore prête."
                >
                  <input
                    type="number"
                    step="any"
                    value={lat}
                    onChange={(e) => setLat(e.target.value)}
                    className={inputClass}
                    placeholder="-18.79"
                  />
                </Field>
                <Field label="Longitude">
                  <input
                    type="number"
                    step="any"
                    value={lng}
                    onChange={(e) => setLng(e.target.value)}
                    className={inputClass}
                    placeholder="47.47"
                  />
                </Field>
                <div className="sm:col-span-2 grid gap-3 sm:grid-cols-2">
                  <label className="flex items-start gap-3 rounded-xl border border-gray-200 p-4">
                    <input
                      type="checkbox"
                      className="mt-1"
                      checked={Boolean(form.water)}
                      onChange={(e) => set('water', e.target.checked)}
                    />
                    <span>
                      <span className="block text-sm font-medium text-navy-900">
                        Eau disponible
                      </span>
                      <span className="mt-1 block text-xs text-gray-500">
                        Sinon, le front indiquera « à prévoir ».
                      </span>
                    </span>
                  </label>
                  <label className="flex items-start gap-3 rounded-xl border border-gray-200 p-4">
                    <input
                      type="checkbox"
                      className="mt-1"
                      checked={Boolean(form.electricity)}
                      onChange={(e) => set('electricity', e.target.checked)}
                    />
                    <span>
                      <span className="block text-sm font-medium text-navy-900">
                        Électricité disponible
                      </span>
                      <span className="mt-1 block text-xs text-gray-500">
                        Sinon, le front indiquera « à raccorder ».
                      </span>
                    </span>
                  </label>
                </div>
              </div>
            </Section>
          )}

          {tab === 'prix' && (
            <Section
              title="Prix, modalités et pièces juridiques"
              hint="Bloc essentiel pour la cohérence avec la page détail du front office."
              icon={<WalletCards className="h-5 w-5" />}
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Prix total (Ar) *">
                  <input
                    required
                    type="number"
                    min={0}
                    value={form.price || ''}
                    onChange={(e) => set('price', Number(e.target.value))}
                    className={inputClass}
                  />
                </Field>
                <Field label="Mode de paiement">
                  <select
                    value={form.paymentMode ?? 'comptant'}
                    onChange={(e) =>
                      set('paymentMode', e.target.value as Land['paymentMode'])
                    }
                    className={inputClass}
                  >
                    {PAYMENT_MODES.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field
                  label="Texte commercial de paiement"
                  full
                  hint="Ex : Comptant ou facilité, négociable selon le projet."
                >
                  <input
                    value={form.payment ?? ''}
                    onChange={(e) => set('payment', e.target.value)}
                    className={inputClass}
                    placeholder="Ex : Comptant ou facilité"
                  />
                </Field>
                <Field label="Acompte demandé">
                  <input
                    value={form.downPayment ?? ''}
                    onChange={(e) => set('downPayment', e.target.value)}
                    className={inputClass}
                    placeholder="Ex : 30 % minimum"
                  />
                </Field>
                <Field label="Durée maximale / échéancier">
                  <input
                    value={form.installments ?? ''}
                    onChange={(e) => set('installments', e.target.value)}
                    className={inputClass}
                    placeholder="Ex : Jusqu’à 12 mois"
                  />
                </Field>
              </div>
            </Section>
          )}

          {tab === 'documents' && (
            <Section
              title="Documents du terrain"
              hint="Déposez les vrais fichiers (titre foncier, plan, certificat…) : ils sont consultables et téléchargeables depuis cette fiche, pas de simple texte."
              icon={<FileText className="h-5 w-5" />}
            >
              <Field label="Documents du dossier" full>
                <div className="space-y-3">
                  <FileDrop
                    visibility="private"
                    accept="application/pdf,image/jpeg,image/png,image/webp"
                    maxMb={20}
                    multiple
                    label="Déposer des documents"
                    hint="PDF, JPG, PNG, WEBP · 20 Mo max par fichier"
                    onFiles={(files) =>
                      setDocuments((current) => [...current, ...files])
                    }
                  />
                  {documents.length > 0 ? (
                    <div className="space-y-2">
                      {documents.map((doc) => (
                        <FileChip
                          key={doc.id}
                          file={doc}
                          onPreview={() => setDocPreview(doc)}
                          onRemove={() => {
                            removeFile(doc);
                            setDocuments((current) =>
                              current.filter((d) => d.id !== doc.id),
                            );
                          }}
                        />
                      ))}
                    </div>
                  ) : (
                    <div className="rounded-2xl border border-dashed border-gray-300 bg-gray-50 px-4 py-6 text-center text-sm text-gray-500">
                      Aucun document déposé pour le moment.
                    </div>
                  )}
                </div>
              </Field>
            </Section>
          )}

          {tab === 'lots' && (
            <Section
              title="Lotissement et parcelles"
              hint="Gestion plus riche des lots sans passer par une modale compacte."
              icon={<Layers3 className="h-5 w-5" />}
            >
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-brand-50 p-4 text-sm">
                <div>
                  <p className="font-medium text-navy-900">
                    {lots.length
                      ? `${lots.length} lot(s) — ${formatArea(lotArea)} cumulés`
                      : 'Aucun lot défini'}
                  </p>
                  <p className="text-gray-500">
                    Si aucun lot n’est saisi, le terrain est présenté comme
                    vendu en un seul bloc.
                  </p>
                </div>
                <button type="button" onClick={addLot} className={btnOutline}>
                  <Plus className="h-4 w-4" /> Ajouter un lot
                </button>
              </div>
              {lotArea > (previewLand.area || 0) && (
                <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  La surface cumulée des lots ({formatArea(lotArea)}) dépasse la
                  surface totale du terrain ({formatArea(previewLand.area)}).
                </div>
              )}
              <div className="space-y-4">
                {lots.map((lot) => (
                  <div
                    key={lot.id}
                    className="rounded-2xl border border-gray-200 p-4"
                  >
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <div>
                        <p className="font-medium text-navy-900">
                          {lot.number || 'Lot sans nom'}
                        </p>
                        <p className="text-xs text-gray-500">
                          Ce détail enrichit le back office, sans dégrader la
                          fiche publique.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeLot(lot.id)}
                        className={`${btnGhost} hover:text-red-600`}
                      >
                        <Trash2 className="h-4 w-4" /> Supprimer
                      </button>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                      <input
                        value={lot.number}
                        onChange={(e) =>
                          setLot(lot.id, 'number', e.target.value)
                        }
                        className={inputClass}
                        placeholder="Lot 1"
                      />
                      <input
                        type="number"
                        min={0}
                        value={lot.area || ''}
                        onChange={(e) =>
                          setLot(lot.id, 'area', Number(e.target.value))
                        }
                        className={inputClass}
                        placeholder="Surface m²"
                      />
                      <input
                        type="number"
                        min={0}
                        value={lot.price || ''}
                        onChange={(e) =>
                          setLot(lot.id, 'price', Number(e.target.value))
                        }
                        className={inputClass}
                        placeholder="Prix Ar"
                      />
                      <select
                        value={lot.status}
                        onChange={(e) =>
                          setLot(
                            lot.id,
                            'status',
                            e.target.value as Lot['status'],
                          )
                        }
                        className={inputClass}
                      >
                        {LAND_STATUSES.map((option) => (
                          <option key={option} value={option}>
                            {option}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="mt-3 grid gap-3 sm:grid-cols-2">
                      <div className="space-y-3">
                        <FileDrop
                          visibility="public"
                          accept="image/jpeg,image/png,image/webp"
                          maxMb={15}
                          label={`Téléverser la photo de ${lot.number || 'ce lot'}`}
                          hint="JPG, PNG, WEBP · 15 Mo max"
                          onFiles={(files) => {
                            const first = uploadedUrls(files)[0];
                            if (first) setLot(lot.id, 'imageUrl', first);
                          }}
                        />
                        {lot.imageUrl ? (
                          <MediaThumb
                            src={lot.imageUrl}
                            label={lot.number || 'Photo du lot'}
                            onRemove={() => setLot(lot.id, 'imageUrl', '')}
                          />
                        ) : (
                          <div className="rounded-2xl border border-dashed border-gray-300 bg-gray-50 px-4 py-8 text-center text-sm text-gray-500">
                            Aucune photo uploadée pour ce lot.
                          </div>
                        )}
                      </div>
                      <textarea
                        rows={2}
                        value={lot.details ?? ''}
                        onChange={(e) =>
                          setLot(lot.id, 'details', e.target.value)
                        }
                        className={inputClass}
                        placeholder="Détails : exposition, voisinage, accès…"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </Section>
          )}
        </div>

        <div className="space-y-6 xl:sticky xl:top-8 xl:self-start">
          <Card className="p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-navy-900">
                  Cohérence front office
                </p>
                <p className="mt-1 text-xs text-gray-600">
                  Indicateur éditorial indicatif : il mesure la présence de
                  contenus publics, mais ne constitue pas une règle de
                  publication.
                </p>
              </div>
              <span
                className={`rounded-full px-3 py-1 text-sm font-semibold ${scoreTone(score)}`}
              >
                {score}%
              </span>
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <Badge value={previewLand.status} />
              <span
                className={`rounded-full px-2.5 py-1 text-xs font-semibold ${publicationTone(previewLand.publicationStatus)}`}
              >
                {publicationLabel(previewLand.publicationStatus)}
              </span>
              {previewLand.featured && (
                <span className="rounded-full bg-gold-500 px-2.5 py-1 text-xs font-semibold text-navy-950">
                  À la une
                </span>
              )}
            </div>
            {missing.length === 0 ? (
              <div className="mt-4 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
                <div className="flex items-center gap-2 font-medium">
                  <CheckCircle2 className="h-4 w-4" /> La fiche couvre bien les
                  éléments majeurs visibles sur le front office.
                </div>
              </div>
            ) : (
              <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                <div className="flex items-center gap-2 font-medium">
                  <AlertTriangle className="h-4 w-4" /> Points encore manquants
                </div>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-xs">
                  {missing.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            )}
            <p className="mt-4 text-xs leading-relaxed text-gray-600">
              Les blocages ci-dessous sont les contrôles techniques actuels du
              logiciel ; la règle de validation et de publication de CA IMMO
              reste à confirmer.
            </p>
            {publishBlocked ? (
              <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
                <div className="flex items-center gap-2 font-medium">
                  <AlertTriangle className="h-4 w-4" /> Publication impossible
                  en l’état.
                </div>
                <p className="mt-1 text-xs">
                  Champs à compléter : {publishIssues.join(', ')}.
                </p>
              </div>
            ) : !isPublished ? (
              <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                <div className="flex items-center gap-2 font-medium">
                  <Upload className="h-4 w-4" /> Ce terrain n’est pas visible
                  publiquement.
                </div>
                <p className="mt-1 text-xs">
                  Passez le workflow en « Publié » pour le faire remonter dans
                  le catalogue du site.
                </p>
              </div>
            ) : null}
          </Card>

          <Card className="p-5">
            <p className="mb-3 text-sm font-semibold text-navy-900">
              Aperçu carte catalogue
            </p>
            {canPreviewCard ? (
              <div className="pointer-events-none">
                <LandCard land={previewLand} />
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-gray-300 bg-gray-50 px-4 py-8 text-center text-sm text-gray-500">
                Ajoute une image de couverture pour voir l’aperçu de la carte
                catalogue.
              </div>
            )}
          </Card>

          <Card className="p-5">
            <p className="mb-4 text-sm font-semibold text-navy-900">
              Résumé éditorial
            </p>
            <div className="grid gap-3">
              <div className="rounded-xl bg-brand-50 p-4">
                <p className="text-xs uppercase tracking-wide text-gray-500">
                  Photos visibles
                </p>
                <p className="mt-1 font-semibold text-navy-900">
                  {gallery.length} visuel(x)
                </p>
              </div>
              <div className="rounded-xl bg-brand-50 p-4">
                <p className="text-xs uppercase tracking-wide text-gray-500">
                  Documents affichables
                </p>
                <p className="mt-1 font-semibold text-navy-900">
                  {documents.length || 0} pièce(s)
                </p>
              </div>
              <div className="rounded-xl bg-brand-50 p-4">
                <p className="text-xs uppercase tracking-wide text-gray-500">
                  Paiement
                </p>
                <p className="mt-1 font-semibold text-navy-900">
                  {previewLand.payment || 'À préciser'}
                </p>
                <p className="mt-1 text-xs text-gray-500">
                  {previewLand.downPayment || 'Acompte non renseigné'}
                  {previewLand.installments
                    ? ` · ${previewLand.installments}`
                    : ''}
                </p>
              </div>
              <div className="rounded-xl bg-brand-50 p-4">
                <p className="text-xs uppercase tracking-wide text-gray-500">
                  Lots
                </p>
                <p className="mt-1 font-semibold text-navy-900">
                  {lots.length ? `${lots.length} lot(s)` : 'Terrain entier'}
                </p>
                <p className="mt-1 text-xs text-gray-500">
                  {lots.length
                    ? `${formatArea(lotArea)} sur ${formatArea(previewLand.area)}`
                    : 'Pas de subdivision déclarée'}
                </p>
              </div>
            </div>
          </Card>

          <Card className="p-5 text-sm text-gray-600">
            <p className="font-semibold text-navy-900">Contrôles rapides</p>
            <ul className="mt-3 space-y-2">
              <li className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-gold-700" /> Prix :{' '}
                <strong className="text-navy-900">
                  {previewLand.price
                    ? formatAriary(previewLand.price)
                    : 'non renseigné'}
                </strong>
              </li>
              <li className="flex items-center gap-2">
                <MapPinned className="h-4 w-4 text-gold-700" /> Localisation :{' '}
                <strong className="text-navy-900">
                  {previewLand.location || 'non renseignée'}
                </strong>
              </li>
              <li className="flex items-center gap-2">
                <WalletCards className="h-4 w-4 text-gold-700" /> Surface :{' '}
                <strong className="text-navy-900">
                  {previewLand.area
                    ? formatArea(previewLand.area)
                    : 'non renseignée'}
                </strong>
              </li>
            </ul>
          </Card>
        </div>
      </div>

      <details className="admin-surface border border-slate-200 rounded-lg bg-white">
        <summary className="px-5 py-4 cursor-pointer text-sm font-medium">
          Prévisualiser la fiche publique complète
        </summary>
        <div className="p-5 border-t border-slate-200">
          <LandFrontPreview land={previewLand} />
        </div>
      </details>
      <Preview file={docPreview} onClose={() => setDocPreview(null)} />
      <FormFooter>
        <Link
          to={existing ? `/admin/terrains/${existing.id}` : '/admin/terrains'}
          className={btnOutline}
        >
          Annuler
        </Link>
        <button
          type="submit"
          className={btnPrimary}
          disabled={!canSave || saving}
        >
          {saving ? 'Enregistrement…' : 'Enregistrer la fiche'}
        </button>
      </FormFooter>
    </form>
  );
}
