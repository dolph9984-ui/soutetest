import {
  BadgeCheck,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  Eye,
  FileDown,
  FileText,
  Film,
  IdCard,
  Image as ImageIcon,
  Landmark,
  MapPin,
  MessageSquarePlus,
  Pencil,
  Phone,
  Plus,
  Save,
  Star,
  Trash2,
  User,
  Wallet,
  XCircle,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { PHONE_PLACEHOLDER, formatPhone, phoneHref } from '../lib/phone';
import { phoneError, sanitizePhone } from '../lib/validate';
import { NotFound } from './BuyRequests';
import { ActionPlanner, CompleteDialog, PlanDialog } from './crm/client';
import { askConfirm } from './crm/dialog';
import { removeFile, useFileUrl } from './crm/files';
import {
  Badge,
  Choice,
  Column,
  DataTable,
  Field,
  FileChip,
  FileDrop,
  Grid,
  Info,
  ListToolbar,
  MapPicker,
  Modal,
  MultiChoice,
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
  Thumb,
  Timeline,
  btnDanger,
  btnGold,
  btnIcon,
  btnOutline,
  btnPrimary,
  escapeHtml,
  fmtAr,
  fmtDate,
  fmtDateTime,
  fmtM2,
  fmtNum,
  input,
  printHtml,
} from './crm/kit';
import {
  ACCESSES,
  AGENTS,
  CHECKLIST,
  COUNTRIES,
  DEPOSITS,
  DOC_CATEGORIES,
  DOC_STATUSES,
  FREQUENCIES,
  ID_TYPES,
  LAND_CATEGORIES,
  LAND_STATUSES,
  LandDoc,
  LandFile,
  LandFileStatus,
  MAX_DURATIONS,
  OCCUPATIONS,
  PRIORITIES,
  PlannedAction,
  REGIONS,
  RELIEFS,
  SALE_PAYMENT,
  StoredFile,
  USAGES,
  YES_NO_NEAR,
  depositPercent,
  fullName,
  getLandFile,
  getLandFiles,
  historyEntry,
  newLandFile,
  phoneOf,
  pricePerM2,
  saveLandFile,
} from './crm/model';
import { refreshCache, subscribeCache } from './crm/sync';
import {
  FormFooter,
  RecordHeader,
  RecordIdentity,
  SummaryStrip,
  useCollectionState,
} from './records';

const BASE = '/admin/dossiers-terrains';
const FLOW: LandFileStatus[] = [
  'Nouveau',
  "À l'étude",
  'À examiner',
  'Visite terrain programmée',
  'Analyse des pièces',
  'Prêt à publier',
  'Publié',
  'En négociation',
  'Réservé',
  'Vendu',
];
const FLOW_LABELS = [
  'Nouveau',
  "À l'étude",
  'À examiner',
  'Visite terrain',
  'Pièces',
  'Prêt à publier',
  'Publié',
  'Négociation',
  'Réservé',
  'Vendu',
];
const MIN_PHOTOS = 3;

/* ---------- Fichiers reçus du site public (formulaire « Vendre ») ----------
   Les photos, documents fonciers et la 1ère pièce d'identité envoyés depuis le
   site vont DIRECTEMENT dans les onglets « Photos » / « Documents » / pièce
   d'identité du dossier (plus besoin d'aller les chercher dans un tiroir à
   part). Seules les vidéos (pas de case dédiée dans la fiche) et une éventuelle
   2e pièce d'identité restent ici.
   IMPORTANT : l'aperçu/téléchargement de chaque pièce n'est déclenché QUE sur
   clic explicite (bouton « Aperçu »). Avant, chaque pièce du dossier était
   récupérée automatiquement dès l'ouverture du dossier — un dossier avec une
   dizaine de pièces déclenchait autant de requêtes binaires simultanées,
   qu'un gestionnaire de téléchargement externe (IDM, etc.) interceptait en
   rafale à CHAQUE réouverture du dossier. On ne charge plus rien tant que
   l'utilisateur ne clique pas sur la pièce qui l'intéresse. */
const isVideoUrl = (v: string) => /\.(mp4|mov|webm|avi|mkv)$/i.test(v);
const isImageUrl = (v: string) => /\.(jpe?g|png|webp|gif)$/i.test(v);

function SiteFileItem({
  value,
  onPreview,
}: {
  value: string | StoredFile;
  onPreview: (file: StoredFile) => void;
}) {
  // Anciens dossiers (avant cette version) : simple URL ou nom de fichier.
  // Nouveaux dossiers : objet complet avec le vrai type MIME déjà connu.
  const isRich = typeof value !== 'string';
  const url = isRich ? value.url : value;
  const name = isRich
    ? value.name
    : decodeURIComponent(value.split('/').pop() ?? value);
  if (
    !url ||
    (!isRich && !/^(\/storage\/|\/api\/v1\/admin\/files\/|http)/.test(url))
  ) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-lg bg-gray-100 px-2.5 py-1.5 text-xs text-gray-600">
        {name}
      </span>
    );
  }
  const video = isRich ? value.type.startsWith('video/') : isVideoUrl(url);
  const image = isRich ? value.type.startsWith('image/') : isImageUrl(url);
  const Icon = video ? Film : image ? ImageIcon : FileText;
  const type = isRich
    ? value.type
    : video
      ? 'video/mp4'
      : image
        ? 'image/*'
        : '';
  return (
    <button
      type="button"
      onClick={() =>
        onPreview({
          id: isRich ? value.id : url,
          name,
          type,
          size: isRich ? value.size : 0,
          url,
        })
      }
      className="group inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs font-medium text-gray-700 transition hover:border-amber-400 hover:text-gray-900"
    >
      <Icon className="w-4 h-4 text-gray-600 shrink-0" />
      <span className="underline-offset-2 group-hover:underline max-w-[200px] truncate">
        {name}
      </span>
      <Eye className="w-3.5 h-3.5 text-gray-600 shrink-0" />
    </button>
  );
}

function SiteFilesBlock({
  f,
  onPreview,
}: {
  f: LandFile;
  onPreview: (file: StoredFile) => void;
}) {
  const sf = f.siteFiles;
  if (!sf) return null;
  const groups: Array<[string, (string | StoredFile)[]]> = [
    ['Vidéos', sf.videos ?? []],
    ['Pièce d’identité (complémentaire)', sf.idCards ?? []],
    // Rétrocompatibilité : anciens dossiers où photos/documents n'avaient pas
    // encore été déplacés vers les onglets principaux.
    ['Photos (dossier antérieur)', sf.photos ?? []],
    [
      `Documents (dossier antérieur)${sf.docTypes?.length ? ` — ${sf.docTypes.join(', ')}` : ''}`,
      sf.documents ?? [],
    ],
  ];
  if (groups.every(([, items]) => items.length === 0)) return null;
  return (
    <Section
      title="Fichiers reçus du site web"
      icon={<FileDown className="w-4 h-4" />}
      confidential
    >
      <div className="space-y-4">
        {groups
          .filter(([, items]) => items.length > 0)
          .map(([label, items]) => (
            <div key={label}>
              <p className="mb-2 text-xs font-semibold text-gray-500">
                {label}
              </p>
              <div className="flex flex-wrap gap-2">
                {items.map((v, i) => (
                  <SiteFileItem
                    key={typeof v === 'string' ? `${v}-${i}` : v.id}
                    value={v}
                    onPreview={onPreview}
                  />
                ))}
              </div>
            </div>
          ))}
      </div>
    </Section>
  );
}

const MAX_PHOTOS = 12;

const payShort = (f: LandFile) =>
  f.salePayment ? f.salePayment.split(' –')[0] : '—';
const place = (f: LandFile) =>
  [
    f.fokontany,
    f.commune,
    f.district,
    f.region === 'Autre' ? f.regionOther : f.region,
  ]
    .filter(Boolean)
    .join(', ');
const depositAmount = (f: LandFile) =>
  Math.round((f.price * depositPercent(f)) / 100);

const columns: Column<LandFile>[] = [
  {
    key: 'identity',
    label: 'Terrain / référence',
    render: (f) => (
      <RecordIdentity
        title={f.title || 'Sans titre'}
        reference={f.ref}
        secondary={f.commune}
        image={f.photos[0]?.url}
        media
      />
    ),
    sort: (f) => f.title,
    csv: (f) => f.title,
  },
  {
    key: 'status',
    label: 'Étape du dossier',
    width: 150,
    render: (f) => <Badge value={f.status} dot />,
    sort: (f) => LAND_STATUSES.indexOf(f.status),
    csv: (f) => f.status,
  },
  {
    key: 'area',
    label: 'Surface',
    width: 105,
    align: 'right',
    render: (f) => (f.area > 0 ? `${fmtNum(f.area)} m²` : '—'),
    sort: (f) => f.area,
    csv: (f) => f.area,
  },
  {
    key: 'price',
    label: 'Prix',
    width: 170,
    align: 'right',
    render: (f) => fmtAr(f.price),
    sort: (f) => f.price,
    csv: (f) => f.price,
  },
  {
    key: 'owner',
    label: 'Propriétaire',
    width: 155,
    render: (f) => (
      <span className="block truncate" title={fullName(f.owner)}>
        {fullName(f.owner) || '—'}
      </span>
    ),
    sort: (f) => fullName(f.owner),
    csv: (f) => fullName(f.owner),
  },
  {
    key: 'date',
    label: 'Reçu le',
    width: 110,
    render: (f) => <RelDate iso={f.receivedAt || f.createdAt} />,
    sort: (f) => f.receivedAt || f.createdAt,
    csv: (f) => fmtDate(f.receivedAt || f.createdAt),
  },
  {
    key: 'agent',
    label: 'Agent',
    render: (f) => f.agent,
    csv: (f) => f.agent,
    defaultVisible: false,
  },
  {
    key: 'phone',
    label: 'Téléphone',
    render: (f) => <TelLink phone={phoneOf(f.owner)} />,
    csv: (f) => phoneOf(f.owner),
    defaultVisible: false,
  },
  {
    key: 'payment',
    label: 'Paiement',
    render: (f) => payShort(f),
    csv: (f) => f.salePayment,
    defaultVisible: false,
  },
  {
    key: 'priority',
    label: 'Priorité',
    render: (f) => <Badge value={f.priority} />,
    csv: (f) => f.priority,
    defaultVisible: false,
  },
  {
    key: 'decision',
    label: 'Décision',
    render: (f) => f.decision || '—',
    csv: (f) => f.decision ?? '',
    defaultVisible: false,
  },
  {
    key: 'ref',
    label: 'Référence',
    render: (f) => f.ref,
    csv: (f) => f.ref,
    defaultVisible: false,
  },
];

// ======================= LISTE =======================
export function LandFileList() {
  const navigate = useNavigate();
  const [rows, setRows] = useState(getLandFiles);
  useEffect(() => {
    refreshCache().then(() => setRows(getLandFiles()));
    return subscribeCache(() => setRows(getLandFiles()));
  }, []); // resync à l'ouverture + mise à jour auto sans F5
  const [q, setQ] = useCollectionState(BASE, 'q', '');
  const [selected, setSelected] = useCollectionState<string[]>(
    BASE,
    'selected',
    [],
  );
  const [bulkStatus, setBulkStatus] = useState('');
  const [view, setView] = useCollectionState<'active' | 'archive'>(
    BASE,
    'view',
    'active',
  );

  const filtered = useMemo(() => {
    const s = q.toLowerCase().trim();
    return rows
      .filter(
        (r) =>
          (view === 'archive'
            ? r.status === 'Archivé'
            : r.status !== 'Archivé') &&
          (!s ||
            [
              r.ref,
              r.title,
              fullName(r.owner),
              r.owner.phone,
              r.owner.email,
              r.region,
              r.district,
              r.commune,
              r.fokontany,
              r.status,
              r.agent,
            ]
              .join(' ')
              .toLowerCase()
              .includes(s)),
      )
      .sort((a, b) => {
        const fresh = (r: LandFile) =>
          r.status === 'Nouveau' || r.status === 'Dossier incomplet' ? 0 : 1;
        return fresh(a) - fresh(b) || b.createdAt.localeCompare(a.createdAt); // à traiter d'abord, puis plus récents
      });
  }, [rows, q, view]);

  const applyBulk = () => {
    if (!bulkStatus) return;
    selected.forEach((id) => {
      const r = getLandFile(id);
      if (r && r.status !== bulkStatus)
        saveLandFile({
          ...r,
          status: bulkStatus as LandFileStatus,
          history: [
            ...r.history,
            historyEntry(`Statut changé : ${r.status} → ${bulkStatus}`),
          ],
        });
    });
    setRows(getLandFiles());
    setSelected([]);
    setBulkStatus('');
  };
  const chosen = () =>
    selected.length
      ? filtered.filter((r) => selected.includes(r.id))
      : filtered;
  const toCheck = rows.filter((r) =>
    [
      'Nouveau',
      "À l'étude",
      'Dossier incomplet',
      'À examiner',
      'Visite terrain programmée',
      'Analyse des pièces',
    ].includes(r.status),
  );
  const published = rows.filter(
    (r) => r.status === 'Publié' || r.status === 'En négociation',
  );

  return (
    <>
      <PageHeader
        title="Demandes de vente"
        subtitle="Terrains que des propriétaires proposent à CA IMMO de vendre"
        action={
          <Link to={`${BASE}/nouveau`} className={btnGold}>
            <Plus className="w-4 h-4" /> Nouveau terrain à vendre
          </Link>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        <Stat label="Dossiers" value={rows.length} />
        <Stat
          label="En cours d’étude"
          value={toCheck.length}
          tone="text-amber-600"
        />
        <Stat
          label="Publiés / en négociation"
          value={published.length}
          tone="text-blue-700"
        />
        <Stat
          label="Valeur publiée"
          value={
            <span className="text-base">
              {fmtAr(published.reduce((t, r) => t + r.price, 0))}
            </span>
          }
        />
      </div>

      <ListToolbar
        q={q}
        onReset={() => setQ('')}
        onQ={setQ}
        placeholder="Rechercher : référence, titre, propriétaire, téléphone, région, commune, statut, agent…"
        bulk={
          selected.length > 0 && (
            <>
              <Select
                value={bulkStatus}
                onChange={setBulkStatus}
                options={LAND_STATUSES}
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
        exportName="dossiers-terrains"
        exportTitle="Dossiers terrains"
      />

      <Tabs
        value={view}
        onChange={(v) => {
          setView(v);
          setSelected([]);
        }}
        tabs={[
          {
            id: 'active',
            label: `En cours (${rows.filter((r) => r.status !== 'Archivé').length})`,
          },
          {
            id: 'archive',
            label: `Archives (${rows.filter((r) => r.status === 'Archivé').length})`,
          },
        ]}
      />
      <DataTable
        entityLabel="dossiers"
        filtered={!!q}
        onClearFilters={() => setQ('')}
        key={view}
        rows={filtered}
        columns={columns}
        selected={selected}
        onSelect={setSelected}
        rowClass={(r) =>
          r.status === 'Nouveau' ||
          r.status === "À l'étude" ||
          r.status === 'Dossier incomplet'
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
              href={phoneHref(r.owner.phone, r.owner.dialCode)}
              className={btnIcon}
              title="Appeler le propriétaire"
            >
              <Phone className="w-4 h-4" />
            </a>
          </>
        )}
      />
    </>
  );
}

// ======================= FORMULAIRE =======================
type TabId =
  'owner' | 'land' | 'location' | 'media' | 'docs' | 'sale' | 'internal';
type Errors = Partial<Record<string, string>>;

// Chaque erreur est préfixée par l'onglet où elle se trouve, pour afficher un compteur par onglet.
function validate(f: LandFile): Errors {
  const e: Errors = {};
  const o = f.owner;
  const need = (
    tab: TabId,
    key: string,
    v: unknown,
    msg = 'Champ obligatoire',
  ) => {
    if (!String(v ?? '').trim() || v === 0) e[`${tab}.${key}`] = msg;
  };
  need('owner', 'firstName', o.firstName);
  need('owner', 'lastName', o.lastName);
  need('owner', 'phone', o.phone);
  if (o.phone.trim() && phoneError(o.phone))
    e['owner.phone'] = phoneError(o.phone) ?? undefined;
  need('owner', 'email', o.email);
  if (o.email && !/^\S+@\S+\.\S+$/.test(o.email))
    e['owner.email'] = 'Adresse email invalide';
  need('owner', 'birthDate', o.birthDate);
  need('owner', 'profession', o.profession);
  need('owner', 'hasBankAccount', o.hasBankAccount);
  if (o.country === 'Autre')
    need('owner', 'countryOther', o.countryOther, 'Précisez le pays');
  need('owner', 'idType', f.idDoc.type);
  need('owner', 'idNumber', f.idDoc.number);
  if (!f.idDoc.file)
    e['owner.idFile'] = 'Le justificatif d’identité est obligatoire';

  need('land', 'ref', f.ref);
  need('land', 'title', f.title);
  need('land', 'area', f.area);
  need('land', 'price', f.price);
  need('land', 'description', f.description);
  need('land', 'relief', f.relief);
  need('land', 'water', f.water);
  need('land', 'electricity', f.electricity);
  if (!f.accesses.length) e['land.accesses'] = 'Sélectionnez au moins un accès';

  if (f.region === 'Autre')
    need('location', 'region', f.regionOther, 'Précisez la région');
  else need('location', 'region', f.region);
  need('location', 'district', f.district);
  need('location', 'commune', f.commune);
  need('location', 'fokontany', f.fokontany);
  need('location', 'addressHint', f.addressHint);

  if (f.photos.length < MIN_PHOTOS)
    e['media.photos'] =
      `Au moins ${MIN_PHOTOS} photos sont requises (vue générale, accès, limites)`;

  need('sale', 'salePayment', f.salePayment);
  need('sale', 'maxDuration', f.maxDuration);
  need('sale', 'depositRange', f.depositRange);
  if (f.maxDuration === 'Autre durée')
    need('sale', 'maxDurationOther', f.maxDurationOther, 'Précisez la durée');
  if (
    f.depositRange === 'Personnalisé' &&
    !(f.depositCustom > 0 && f.depositCustom <= 100)
  )
    e['sale.depositCustom'] = 'Entre 1 et 100 %';
  return e;
}

export function LandFileForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const original = id ? getLandFile(id) : undefined;
  const [f, setF] = useState<LandFile>(() => {
    const initial = original ?? newLandFile();
    return {
      ...initial,
      owner: {
        ...initial.owner,
        phone: formatPhone(initial.owner.phone, initial.owner.dialCode),
        dialCode: '',
      },
    };
  });
  const [tab, setTab] = useState<TabId>('owner');
  const [errors, setErrors] = useState<Errors>({});
  const [submitted, setSubmitted] = useState(false);
  const [preview, setPreview] = useState<StoredFile | null>(null);

  if (id && !original) return <NotFound />;

  const set = <K extends keyof LandFile>(k: K, v: LandFile[K]) =>
    setF((x) => {
      const next = { ...x, [k]: v };
      if ((k === 'price' || k === 'area') && !next.pricePerM2Manual)
        next.pricePerM2 = pricePerM2(next.price, next.area);
      return next;
    });
  const setOwner = <K extends keyof LandFile['owner']>(
    k: K,
    v: LandFile['owner'][K],
  ) => setF((x) => ({ ...x, owner: { ...x.owner, [k]: v } }));
  const setId = <K extends keyof LandFile['idDoc']>(
    k: K,
    v: LandFile['idDoc'][K],
  ) => setF((x) => ({ ...x, idDoc: { ...x.idDoc, [k]: v } }));
  const err = (key: string) => (submitted ? errors[key] : undefined);
  const liveErrors = submitted ? validate(f) : {};
  const count = (t: TabId) =>
    Object.keys(liveErrors).filter((k) => k.startsWith(`${t}.`)).length;

  const save = async (asDraft: boolean) => {
    const errs = validate(f);
    setErrors(errs);
    setSubmitted(true);
    if (!asDraft && Object.keys(errs).length) {
      const first = Object.keys(errs)[0].split('.')[0] as TabId;
      setTab(first);
      document
        .getElementById('fiche-dossier-terrain')
        ?.scrollIntoView({ behavior: 'smooth', block: 'start' }); // on remonte jusqu'en haut du formulaire, pas de la page
      return;
    }
    let status = f.status;
    if (asDraft && !original) status = 'Brouillon';
    else if (!asDraft && status === 'Brouillon') status = 'Nouveau';
    const history = [...f.history];
    if (original) {
      if (original.status !== status)
        history.push(
          historyEntry(`Statut changé : ${original.status} → ${status}`),
        );
      if (original.price !== f.price)
        history.push(
          historyEntry(
            `Prix modifié : ${fmtAr(original.price)} → ${fmtAr(f.price)}`,
          ),
        );
      if (original.agent !== f.agent)
        history.push(historyEntry(`Dossier affecté à ${f.agent}`));
      history.push(
        historyEntry(asDraft ? 'Brouillon enregistré' : 'Dossier modifié'),
      );
    } else if (!asDraft) history.push(historyEntry('Dossier soumis'));
    const saved = await saveLandFile({ ...f, status, history });
    navigate(`${BASE}/${saved.id}`);
  };

  const movePhoto = (i: number, d: -1 | 1) => {
    const p = [...f.photos];
    [p[i], p[i + d]] = [p[i + d], p[i]];
    set('photos', p);
  };
  const setMain = (i: number) =>
    set('photos', [f.photos[i], ...f.photos.filter((_, k) => k !== i)]);
  const removePhoto = (i: number) => {
    removeFile(f.photos[i]);
    set(
      'photos',
      f.photos.filter((_, k) => k !== i),
    );
  };
  const setDoc = (docId: string, patch: Partial<LandDoc>) =>
    set(
      'documents',
      f.documents.map((d) => (d.id === docId ? { ...d, ...patch } : d)),
    );
  const pct = depositPercent(f);

  const tabs: { id: TabId; label: string; badge?: number }[] = [
    { id: 'owner', label: '1. Propriétaire', badge: count('owner') },
    { id: 'land', label: '2. Terrain', badge: count('land') },
    { id: 'location', label: '3. Localisation', badge: count('location') },
    {
      id: 'media',
      label: `4. Photos & médias (${f.photos.length})`,
      badge: count('media'),
    },
    { id: 'docs', label: `5. Documents fonciers (${f.documents.length})` },
    { id: 'sale', label: '6. Conditions de vente', badge: count('sale') },
    { id: 'internal', label: '7. Suivi interne' },
  ];
  const tabIndex = tabs.findIndex((t) => t.id === tab);

  /* Bouton « Enregistrer le dossier » grisé tant que des champs obligatoires manquent (le brouillon reste toujours possible). */
  const incomplete = Object.values(validate(f)).some(
    (m) => m !== 'Adresse email invalide',
  );

  return (
    <form
      id="fiche-dossier-terrain"
      onSubmit={(e) => {
        e.preventDefault();
        save(false);
      }}
      noValidate
      className="scroll-mt-24"
    >
      <RecordHeader
        module="Demandes de vente"
        backTo={original ? `${BASE}/${original.id}` : BASE}
        mode={original ? 'edit' : 'create'}
        title={
          original ? 'Modifier le dossier terrain' : 'Nouveau dossier terrain'
        }
        reference={original ? f.ref : undefined}
        subtitle="Propriétaire, caractéristiques du terrain et suivi du dossier."
        action={
          <>
            <button
              type="button"
              onClick={() => save(true)}
              className={btnOutline}
            >
              Enregistrer le brouillon
            </button>
            <button type="submit" className={btnPrimary} disabled={incomplete}>
              <Save size={15} />
              Enregistrer le dossier
            </button>
          </>
        }
      />

      {submitted && Object.keys(liveErrors).length > 0 && (
        <div className="mb-4 px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700">
          {Object.keys(liveErrors).length} champ(s) obligatoire(s) à compléter —
          voir les onglets marqués en rouge. Vous pouvez aussi enregistrer en
          brouillon.
        </div>
      )}

      <Tabs tabs={tabs} value={tab} onChange={(t) => setTab(t)} />

      <div className="space-y-5">
        {tab === 'owner' && (
          <>
            <Section
              title="Informations du propriétaire"
              icon={<User className="w-4 h-4" />}
            >
              <Grid>
                <Field
                  label="Identifiant du propriétaire"
                  hint="Généré automatiquement, non modifiable"
                >
                  <input
                    className={`${input} disabled:text-gray-500 disabled:cursor-not-allowed`}
                    value={f.ownerId}
                    disabled
                  />
                </Field>
                <Field label="Prénom" required error={err('owner.firstName')}>
                  <input
                    className={input}
                    value={f.owner.firstName}
                    onChange={(e) => setOwner('firstName', e.target.value)}
                  />
                </Field>
                <Field label="Nom" required error={err('owner.lastName')}>
                  <input
                    className={input}
                    value={f.owner.lastName}
                    onChange={(e) => setOwner('lastName', e.target.value)}
                  />
                </Field>
                <Field label="Téléphone" required error={err('owner.phone')}>
                  <input
                    type="tel"
                    inputMode="tel"
                    className={input}
                    value={f.owner.phone}
                    onChange={(e) =>
                      setF((x) => ({
                        ...x,
                        owner: {
                          ...x.owner,
                          phone: sanitizePhone(e.target.value),
                          dialCode: '',
                        },
                      }))
                    }
                    placeholder={PHONE_PLACEHOLDER}
                  />
                </Field>
                <Field
                  label="Adresse email"
                  required
                  error={err('owner.email')}
                >
                  <input
                    type="email"
                    className={input}
                    value={f.owner.email}
                    onChange={(e) => setOwner('email', e.target.value)}
                  />
                </Field>
                <Field
                  label="Date de naissance"
                  required
                  error={err('owner.birthDate')}
                >
                  <input
                    type="date"
                    className={input}
                    value={f.owner.birthDate}
                    onChange={(e) => setOwner('birthDate', e.target.value)}
                  />
                </Field>
                <Field
                  label="Profession"
                  required
                  error={err('owner.profession')}
                >
                  <input
                    className={input}
                    value={f.owner.profession}
                    onChange={(e) => setOwner('profession', e.target.value)}
                  />
                </Field>
                <Field label="Pays de résidence" required>
                  <Choice
                    value={f.owner.country}
                    onChange={(v) => setOwner('country', v)}
                    options={COUNTRIES}
                  />
                </Field>
                {f.owner.country === 'Autre' && (
                  <Field
                    label="Précisez le pays"
                    required
                    error={err('owner.countryOther')}
                  >
                    <input
                      className={input}
                      value={f.owner.countryOther}
                      onChange={(e) => setOwner('countryOther', e.target.value)}
                    />
                  </Field>
                )}
                <Field label="Adresse actuelle" span={2}>
                  <input
                    className={input}
                    value={f.owner.address}
                    onChange={(e) => setOwner('address', e.target.value)}
                  />
                </Field>
                <Field
                  label="Titulaire d’un compte bancaire"
                  required
                  error={err('owner.hasBankAccount')}
                >
                  <Choice
                    value={f.owner.hasBankAccount}
                    onChange={(v) =>
                      setOwner('hasBankAccount', v as 'Oui' | 'Non')
                    }
                    options={['Oui', 'Non']}
                  />
                </Field>
                {f.owner.hasBankAccount === 'Oui' && (
                  <>
                    <Field label="Nom de la banque">
                      <input
                        className={input}
                        value={f.owner.bank}
                        onChange={(e) => setOwner('bank', e.target.value)}
                      />
                    </Field>
                    <Field label="Numéro de compte">
                      <input
                        className={input}
                        value={f.owner.accountNumber}
                        onChange={(e) =>
                          setOwner('accountNumber', e.target.value)
                        }
                      />
                    </Field>
                  </>
                )}
              </Grid>
            </Section>
            <Section
              title="Justificatif d’identité"
              icon={<IdCard className="w-4 h-4" />}
              confidential
            >
              <Grid>
                <Field label="Type de pièce" required>
                  <Choice
                    value={f.idDoc.type}
                    onChange={(v) => setId('type', v)}
                    options={ID_TYPES}
                  />
                </Field>
                <Field
                  label="Numéro de pièce"
                  required
                  error={err('owner.idNumber')}
                >
                  <input
                    className={input}
                    value={f.idDoc.number}
                    onChange={(e) => setId('number', e.target.value)}
                  />
                </Field>
                <Field label="Autorité de délivrance">
                  <input
                    className={input}
                    value={f.idDoc.authority}
                    onChange={(e) => setId('authority', e.target.value)}
                  />
                </Field>
                <Field label="Date de délivrance">
                  <input
                    type="date"
                    className={input}
                    value={f.idDoc.issuedAt}
                    onChange={(e) => setId('issuedAt', e.target.value)}
                  />
                </Field>
                <Field label="Date d’expiration" hint="Si applicable">
                  <input
                    type="date"
                    className={input}
                    value={f.idDoc.expiresAt}
                    onChange={(e) => setId('expiresAt', e.target.value)}
                  />
                </Field>
              </Grid>
              <div className="mt-4">
                <p className="text-xs font-medium text-gray-600 mb-1.5">
                  Justificatif d’identité{' '}
                  <span className="text-red-500">*</span>
                </p>
                {f.idDoc.file ? (
                  <div className="flex items-center gap-4">
                    <Thumb
                      file={f.idDoc.file}
                      className="w-32 h-20 rounded-lg border"
                    />
                    <div className="flex-1">
                      <FileChip
                        file={f.idDoc.file}
                        onPreview={() => setPreview(f.idDoc.file!)}
                        onRemove={() => {
                          removeFile(f.idDoc.file!);
                          setId('file', undefined);
                        }}
                      />
                    </div>
                  </div>
                ) : (
                  <FileDrop
                    accept="image/jpeg,image/png,image/webp,application/pdf"
                    maxMb={15}
                    label="Téléverser la pièce d’identité"
                    hint="PDF, JPG, PNG, WEBP · 15 Mo max"
                    onFiles={([file]) => setId('file', file)}
                  />
                )}
                {err('owner.idFile') && (
                  <p className="text-xs text-red-600 mt-1">
                    {err('owner.idFile')}
                  </p>
                )}
              </div>
            </Section>
          </>
        )}

        {tab === 'land' && (
          <Section
            title="Informations du terrain"
            icon={<Landmark className="w-4 h-4" />}
          >
            <Grid>
              <Field
                label="Référence interne"
                required
                error={err('land.ref')}
                hint="Générée automatiquement, non modifiable"
              >
                <input
                  className={`${input} font-mono disabled:text-gray-500 disabled:cursor-not-allowed`}
                  value={f.ref}
                  disabled
                />
              </Field>
              <Field
                label="Titre du terrain"
                required
                error={err('land.title')}
                span={2}
              >
                <input
                  className={input}
                  value={f.title}
                  onChange={(e) => set('title', e.target.value)}
                  placeholder="Ex : Terrain plat 1 200 m² vue dégagée – Ivato"
                />
              </Field>
              <Field label="Catégorie">
                <Select
                  value={f.category}
                  onChange={(v) => set('category', v)}
                  options={LAND_CATEGORIES}
                />
              </Field>
              <Field
                label="Superficie totale"
                required
                error={err('land.area')}
              >
                <NumberInput
                  value={f.area}
                  onChange={(v) => set('area', v)}
                  suffix="m²"
                />
              </Field>
              <Field
                label="Prix total souhaité"
                required
                error={err('land.price')}
              >
                <NumberInput
                  value={f.price}
                  onChange={(v) => set('price', v)}
                  suffix="Ar"
                />
              </Field>
              <Field
                label="Prix au m²"
                hint={
                  f.pricePerM2Manual
                    ? 'Saisi manuellement'
                    : 'Calculé automatiquement'
                }
              >
                <div className="flex gap-2">
                  <NumberInput
                    value={f.pricePerM2}
                    onChange={(v) =>
                      setF((x) => ({
                        ...x,
                        pricePerM2: v,
                        pricePerM2Manual: true,
                      }))
                    }
                    suffix="Ar/m²"
                  />
                  {f.pricePerM2Manual && (
                    <button
                      type="button"
                      className={btnOutline}
                      title="Recalculer"
                      onClick={() =>
                        setF((x) => ({
                          ...x,
                          pricePerM2Manual: false,
                          pricePerM2: pricePerM2(x.price, x.area),
                        }))
                      }
                    >
                      Auto
                    </button>
                  )}
                </div>
              </Field>
              <Field label="Prix négociable">
                <Choice
                  value={f.negotiable}
                  onChange={(v) => set('negotiable', v as 'Oui' | 'Non')}
                  options={['Oui', 'Non']}
                />
              </Field>
              <Field
                label="Description détaillée"
                required
                error={err('land.description')}
                span="full"
                hint="Environnement, atouts, limites, voisinage, usage idéal"
              >
                <textarea
                  rows={5}
                  className={input}
                  value={f.description}
                  onChange={(e) => set('description', e.target.value)}
                />
              </Field>
              <Field
                label="Type de relief"
                required
                error={err('land.relief')}
                span="full"
              >
                <Choice
                  value={f.relief}
                  onChange={(v) => set('relief', v)}
                  options={RELIEFS}
                />
              </Field>
              <Field
                label="Accessibilité (plusieurs choix possibles)"
                required
                error={err('land.accesses')}
                span="full"
              >
                <MultiChoice
                  value={f.accesses}
                  onChange={(v) => set('accesses', v)}
                  options={ACCESSES}
                />
              </Field>
              <Field label="Largeur de la voie d’accès">
                <input
                  className={input}
                  value={f.roadWidth}
                  onChange={(e) => set('roadWidth', e.target.value)}
                  placeholder="Ex : 6 m"
                />
              </Field>
              <Field label="Distance à la route principale">
                <input
                  className={input}
                  value={f.distanceMainRoad}
                  onChange={(e) => set('distanceMainRoad', e.target.value)}
                  placeholder="Ex : 300 m"
                />
              </Field>
              <Field label="Usage recommandé">
                <Select
                  value={f.usage}
                  onChange={(v) => set('usage', v)}
                  options={USAGES}
                />
              </Field>
              <Field label="Eau disponible" required error={err('land.water')}>
                <Choice
                  value={f.water}
                  onChange={(v) => set('water', v)}
                  options={YES_NO_NEAR}
                />
              </Field>
              <Field
                label="Électricité disponible"
                required
                error={err('land.electricity')}
              >
                <Choice
                  value={f.electricity}
                  onChange={(v) => set('electricity', v)}
                  options={YES_NO_NEAR}
                />
              </Field>
              <Field label="Assainissement">
                <input
                  className={input}
                  value={f.sanitation}
                  onChange={(e) => set('sanitation', e.target.value)}
                  placeholder="Fosse septique, réseau…"
                />
              </Field>
              <Field label="Réseau mobile">
                <Choice
                  value={f.mobile}
                  onChange={(v) => set('mobile', v as 'Oui' | 'Non')}
                  options={['Oui', 'Non']}
                />
              </Field>
              <Field label="Connexion internet">
                <Choice
                  value={f.internet}
                  onChange={(v) => set('internet', v as 'Oui' | 'Non')}
                  options={['Oui', 'Non']}
                />
              </Field>
              <Field label="Clôture existante">
                <Choice
                  value={f.fence}
                  onChange={(v) => set('fence', v as 'Oui' | 'Non')}
                  options={['Oui', 'Non']}
                />
              </Field>
              <Field label="Bâtiment / construction sur le terrain">
                <Choice
                  value={f.building}
                  onChange={(v) => set('building', v as 'Oui' | 'Non')}
                  options={['Oui', 'Non']}
                />
              </Field>
              {f.building === 'Oui' && (
                <Field label="Description de la construction" span={2}>
                  <input
                    className={input}
                    value={f.buildingDesc}
                    onChange={(e) => set('buildingDesc', e.target.value)}
                  />
                </Field>
              )}
              <Field label="Statut d’occupation">
                <Choice
                  value={f.occupation}
                  onChange={(v) => set('occupation', v)}
                  options={OCCUPATIONS}
                />
              </Field>
              <Field label="Disponibilité immédiate">
                <Choice
                  value={f.immediate}
                  onChange={(v) => set('immediate', v as 'Oui' | 'Non')}
                  options={['Oui', 'Non']}
                />
              </Field>
            </Grid>
          </Section>
        )}

        {tab === 'location' && (
          <Section
            title="Localisation précise du terrain"
            icon={<MapPin className="w-4 h-4" />}
          >
            <Grid>
              <Field label="Région" required error={err('location.region')}>
                <Select
                  value={f.region}
                  onChange={(v) => set('region', v)}
                  options={[...REGIONS, 'Autre']}
                  placeholder="—"
                />
              </Field>
              {f.region === 'Autre' && (
                <Field label="Précisez la région" required>
                  <input
                    className={input}
                    value={f.regionOther}
                    onChange={(e) => set('regionOther', e.target.value)}
                  />
                </Field>
              )}
              <Field label="District" required error={err('location.district')}>
                <input
                  className={input}
                  value={f.district}
                  onChange={(e) => set('district', e.target.value)}
                />
              </Field>
              <Field label="Commune" required error={err('location.commune')}>
                <input
                  className={input}
                  value={f.commune}
                  onChange={(e) => set('commune', e.target.value)}
                />
              </Field>
              <Field
                label="Fokontany"
                required
                error={err('location.fokontany')}
              >
                <input
                  className={input}
                  value={f.fokontany}
                  onChange={(e) => set('fokontany', e.target.value)}
                />
              </Field>
              <Field
                label="Indication / adresse"
                required
                error={err('location.addressHint')}
                span={2}
              >
                <input
                  className={input}
                  value={f.addressHint}
                  onChange={(e) => set('addressHint', e.target.value)}
                />
              </Field>
              <Field label="Repère à proximité">
                <input
                  className={input}
                  value={f.landmark}
                  onChange={(e) => set('landmark', e.target.value)}
                  placeholder="Église, école, marché…"
                />
              </Field>
              <Field label="Latitude">
                <input
                  type="number"
                  step="any"
                  className={input}
                  value={f.lat ?? ''}
                  onChange={(e) =>
                    set(
                      'lat',
                      e.target.value === ''
                        ? undefined
                        : Number(e.target.value),
                    )
                  }
                />
              </Field>
              <Field label="Longitude">
                <input
                  type="number"
                  step="any"
                  className={input}
                  value={f.lng ?? ''}
                  onChange={(e) =>
                    set(
                      'lng',
                      e.target.value === ''
                        ? undefined
                        : Number(e.target.value),
                    )
                  }
                />
              </Field>
            </Grid>
            <div className="mt-4">
              <MapPicker
                lat={f.lat}
                lng={f.lng}
                onChange={(lat, lng) => setF((x) => ({ ...x, lat, lng }))}
                height="h-[420px]"
              />
            </div>
          </Section>
        )}

        {tab === 'media' && (
          <>
            <Section
              title="Photos du terrain"
              icon={<ImageIcon className="w-4 h-4" />}
              action={
                <span className="text-xs text-gray-500">
                  {f.photos.length} / {MAX_PHOTOS}
                </span>
              }
            >
              <p className="text-sm text-gray-600 mb-3">
                Minimum {MIN_PHOTOS} photos : <strong>vue générale</strong>,{' '}
                <strong>accès</strong> et <strong>limites du terrain</strong>.
                La première photo est la photo principale.
              </p>
              {f.photos.length < MAX_PHOTOS && (
                <FileDrop
                  accept="image/jpeg,image/png,image/webp"
                  maxMb={15}
                  multiple
                  label="Ajouter des photos"
                  hint={`JPG, PNG, WEBP · 15 Mo max · ${MAX_PHOTOS - f.photos.length} restante(s)`}
                  onFiles={(files) => {
                    const room = MAX_PHOTOS - f.photos.length;
                    files.slice(room).forEach(removeFile);
                    set('photos', [...f.photos, ...files.slice(0, room)]);
                  }}
                />
              )}
              {err('media.photos') && (
                <p className="text-xs text-red-600 mt-2">
                  {err('media.photos')}
                </p>
              )}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 mt-4">
                {f.photos.map((p, i) => (
                  <div
                    key={p.id}
                    className={`relative group rounded-xl overflow-hidden border-2 ${i === 0 ? 'border-gold-500' : 'border-transparent'}`}
                  >
                    <button
                      type="button"
                      onClick={() => setPreview(p)}
                      className="block w-full"
                    >
                      <Thumb file={p} className="w-full aspect-[4/3]" />
                    </button>
                    {i === 0 && (
                      <span className="absolute top-2 left-2 px-2 py-0.5 rounded-full bg-gold-500 text-navy-950 text-[10px] font-bold">
                        PRINCIPALE
                      </span>
                    )}
                    <div className="absolute bottom-0 inset-x-0 flex justify-between p-1.5 bg-gradient-to-t from-black/70 to-transparent">
                      <div className="flex">
                        <button
                          type="button"
                          disabled={i === 0}
                          onClick={() => movePhoto(i, -1)}
                          className="p-1 text-white disabled:opacity-30"
                          aria-label="Déplacer à gauche"
                        >
                          <ChevronLeft className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          disabled={i === f.photos.length - 1}
                          onClick={() => movePhoto(i, 1)}
                          className="p-1 text-white disabled:opacity-30"
                          aria-label="Déplacer à droite"
                        >
                          <ChevronRight className="w-4 h-4" />
                        </button>
                      </div>
                      <div className="flex">
                        {i !== 0 && (
                          <button
                            type="button"
                            onClick={() => setMain(i)}
                            className="p-1 text-white"
                            title="Définir comme photo principale"
                          >
                            <Star className="w-4 h-4" />
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => removePhoto(i)}
                          className="p-1 text-white hover:text-red-300"
                          aria-label="Supprimer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </Section>
            <Section
              title="Vidéo du terrain"
              icon={<Film className="w-4 h-4" />}
            >
              {f.video ? (
                <VideoPlayer
                  file={f.video}
                  onRemove={() => {
                    removeFile(f.video!);
                    set('video', undefined);
                  }}
                />
              ) : (
                <FileDrop
                  accept="video/mp4,video/quicktime,.mp4,.mov"
                  maxMb={100}
                  label="Ajouter une vidéo"
                  hint="MP4 ou MOV · 100 Mo max"
                  onFiles={([v]) => set('video', v)}
                />
              )}
            </Section>
          </>
        )}

        {tab === 'docs' && (
          <Section
            title="Documents fonciers"
            icon={<FileText className="w-4 h-4" />}
            confidential
          >
            <FileDrop
              accept="application/pdf,image/jpeg,image/png,image/webp"
              maxMb={15}
              multiple
              label="Ajouter des documents fonciers"
              hint="PDF, JPG, PNG, WEBP · 15 Mo max"
              onFiles={(files) =>
                set('documents', [
                  ...f.documents,
                  ...files.map((x) => ({
                    ...x,
                    category: 'Titre foncier',
                    number: '',
                    issuedAt: '',
                    ownerName: fullName(f.owner),
                    status: 'À examiner' as const,
                  })),
                ])
              }
            />
            <div className="space-y-3 mt-4">
              {f.documents.map((d) => (
                <div
                  key={d.id}
                  className="p-3 rounded-xl border border-gray-200"
                >
                  <FileChip
                    file={d}
                    onPreview={() => setPreview(d)}
                    onRemove={() => {
                      removeFile(d);
                      set(
                        'documents',
                        f.documents.filter((x) => x.id !== d.id),
                      );
                    }}
                  />
                  <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-2 mt-3">
                    <Field label="Catégorie">
                      <Select
                        value={d.category}
                        onChange={(v) => setDoc(d.id, { category: v })}
                        options={DOC_CATEGORIES}
                      />
                    </Field>
                    <Field label="N° titre / certificat">
                      <input
                        className={input}
                        value={d.number}
                        onChange={(e) =>
                          setDoc(d.id, { number: e.target.value })
                        }
                      />
                    </Field>
                    <Field label="Date d’émission">
                      <input
                        type="date"
                        className={input}
                        value={d.issuedAt}
                        onChange={(e) =>
                          setDoc(d.id, { issuedAt: e.target.value })
                        }
                      />
                    </Field>
                    <Field label="Propriétaire sur le document">
                      <input
                        className={input}
                        value={d.ownerName}
                        onChange={(e) =>
                          setDoc(d.id, { ownerName: e.target.value })
                        }
                      />
                    </Field>
                    <Field label="Statut">
                      <Select
                        value={d.status}
                        onChange={(v) =>
                          setDoc(d.id, { status: v as LandDoc['status'] })
                        }
                        options={DOC_STATUSES}
                      />
                    </Field>
                  </div>
                </div>
              ))}
              {!f.documents.length && (
                <p className="text-sm text-gray-600">Aucun document foncier.</p>
              )}
            </div>
          </Section>
        )}

        {tab === 'sale' && (
          <Section
            title="Conditions de vente"
            icon={<Wallet className="w-4 h-4" />}
          >
            <Grid>
              <Field
                label="Mode de paiement accepté"
                required
                error={err('sale.salePayment')}
                span="full"
              >
                <Choice
                  value={f.salePayment}
                  onChange={(v) => set('salePayment', v)}
                  options={SALE_PAYMENT}
                />
              </Field>
              <Field
                label="Durée maximale acceptée"
                required
                error={err('sale.maxDuration')}
                span="full"
              >
                <Choice
                  value={f.maxDuration}
                  onChange={(v) => set('maxDuration', v)}
                  options={MAX_DURATIONS}
                />
              </Field>
              {f.maxDuration === 'Autre durée' && (
                <Field
                  label="Durée personnalisée"
                  required
                  error={err('sale.maxDurationOther')}
                >
                  <input
                    className={input}
                    value={f.maxDurationOther}
                    onChange={(e) => set('maxDurationOther', e.target.value)}
                    placeholder="Ex : 18 mois"
                  />
                </Field>
              )}
              <Field
                label="Acompte minimum demandé"
                required
                error={err('sale.depositRange')}
                span="full"
              >
                <Choice
                  value={f.depositRange}
                  onChange={(v) => set('depositRange', v)}
                  options={DEPOSITS.map(([l]) => l)}
                />
              </Field>
              {f.depositRange === 'Personnalisé' && (
                <Field
                  label="Pourcentage personnalisé"
                  required
                  error={err('sale.depositCustom')}
                >
                  <NumberInput
                    value={f.depositCustom}
                    onChange={(v) => set('depositCustom', v)}
                    suffix="%"
                  />
                </Field>
              )}
              <Field
                label="Acompte minimum (calculé)"
                hint={
                  pct
                    ? `${pct} % de ${fmtAr(f.price)}`
                    : 'Renseignez le prix et l’acompte'
                }
              >
                <div className={`${input} bg-gray-50 font-semibold`}>
                  {fmtAr(depositAmount(f))}
                </div>
              </Field>
              <Field label="Fréquence de paiement">
                <Select
                  value={f.frequency}
                  onChange={(v) => set('frequency', v)}
                  options={FREQUENCIES}
                />
              </Field>
              {f.frequency === 'Personnalisée' && (
                <Field label="Fréquence personnalisée">
                  <input
                    className={input}
                    value={f.frequencyOther}
                    onChange={(e) => set('frequencyOther', e.target.value)}
                  />
                </Field>
              )}
              <Field label="Négociation possible">
                <Choice
                  value={f.saleNegotiable}
                  onChange={(v) => set('saleNegotiable', v as 'Oui' | 'Non')}
                  options={['Oui', 'Non']}
                />
              </Field>
              {f.saleNegotiable === 'Oui' && (
                <Field label="Marge de négociation">
                  <input
                    className={input}
                    value={f.negotiationMargin}
                    onChange={(e) => set('negotiationMargin', e.target.value)}
                    placeholder="Ex : 5 % ou 3 000 000 Ar"
                  />
                </Field>
              )}
              <Field label="Conditions particulières" span="full">
                <textarea
                  rows={3}
                  className={input}
                  value={f.specialConditions}
                  onChange={(e) => set('specialConditions', e.target.value)}
                />
              </Field>
              <Field label="Commentaires du propriétaire" span="full">
                <textarea
                  rows={3}
                  className={input}
                  value={f.ownerComments}
                  onChange={(e) => set('ownerComments', e.target.value)}
                />
              </Field>
            </Grid>
          </Section>
        )}

        {tab === 'internal' && (
          <Section
            title="Étude et suivi du dossier"
            icon={<ClipboardCheck className="w-4 h-4" />}
            confidential
          >
            <Grid cols={4}>
              <Field label="Agent responsable">
                <Select
                  value={f.agent}
                  onChange={(v) => set('agent', v)}
                  options={AGENTS}
                />
              </Field>
              <Field label="Date de réception">
                <input
                  type="date"
                  className={input}
                  value={f.receivedAt}
                  onChange={(e) => set('receivedAt', e.target.value)}
                />
              </Field>
              <Field label="Priorité">
                <Select
                  value={f.priority}
                  onChange={(v) => set('priority', v as LandFile['priority'])}
                  options={PRIORITIES}
                />
              </Field>
              <Field label="Statut général">
                <Select
                  value={f.status}
                  onChange={(v) => set('status', v as LandFileStatus)}
                  options={LAND_STATUSES}
                />
              </Field>
              <Field label="Compte rendu de visite" span={2}>
                <textarea
                  rows={2}
                  className={input}
                  value={f.fieldCheck}
                  onChange={(e) => set('fieldCheck', e.target.value)}
                />
              </Field>
              <Field label="Notes sur les pièces du dossier" span={2}>
                <textarea
                  rows={2}
                  className={input}
                  value={f.legalCheck}
                  onChange={(e) => set('legalCheck', e.target.value)}
                />
              </Field>
              <Field label="Estimation interne du prix">
                <NumberInput
                  value={f.internalEstimate}
                  onChange={(v) => set('internalEstimate', v)}
                  suffix="Ar"
                />
              </Field>
              <Field label="Prix recommandé par l’agence">
                <NumberInput
                  value={f.recommendedPrice}
                  onChange={(v) => set('recommendedPrice', v)}
                  suffix="Ar"
                />
              </Field>
              <Field
                label="Commission de l’agence"
                hint={
                  f.price && f.commission
                    ? `≈ ${fmtAr(Math.round((f.price * f.commission) / 100))}`
                    : undefined
                }
              >
                <NumberInput
                  value={f.commission}
                  onChange={(v) => set('commission', v)}
                  suffix="%"
                />
              </Field>
              <Field label="Dernière modification">
                <div className={`${input} bg-gray-50`}>
                  {fmtDateTime(f.updatedAt)}
                </div>
              </Field>
              <Field label="Commentaires internes" span="full">
                <textarea
                  rows={3}
                  className={input}
                  value={f.internalComments}
                  onChange={(e) => set('internalComments', e.target.value)}
                />
              </Field>
            </Grid>
            <div className="mt-5">
              <p className="text-xs font-medium text-gray-600 mb-2">
                Suivi de complétude du dossier
              </p>
              <Checklist
                value={f.checklist}
                onChange={(v) => set('checklist', v)}
              />
            </div>
          </Section>
        )}
      </div>

      <FormFooter>
        <button
          type="button"
          onClick={() => navigate(original ? `${BASE}/${original.id}` : BASE)}
          className={btnOutline}
        >
          Annuler
        </button>
        <button
          type="button"
          disabled={tabIndex === 0}
          onClick={() => setTab(tabs[tabIndex - 1].id)}
          className={btnOutline}
        >
          Précédent
        </button>
        {tabIndex < tabs.length - 1 && (
          <button
            type="button"
            onClick={() => setTab(tabs[tabIndex + 1].id)}
            className={btnOutline}
          >
            Suivant
          </button>
        )}
        <button type="submit" className={btnPrimary} disabled={incomplete}>
          Enregistrer le dossier
        </button>
      </FormFooter>
      <Preview file={preview} onClose={() => setPreview(null)} />
    </form>
  );
}

function Checklist({
  value,
  onChange,
  readOnly,
}: {
  value: string[];
  onChange?: (v: string[]) => void;
  readOnly?: boolean;
}) {
  return (
    <div>
      <div className="h-1.5 rounded-full bg-gray-100 mb-3 overflow-hidden">
        <div
          className="h-full bg-gold-500 transition-all"
          style={{ width: `${(value.length / CHECKLIST.length) * 100}%` }}
        />
      </div>
      <ul className="space-y-1.5">
        {CHECKLIST.map((c) => (
          <li key={c}>
            <label
              className={`flex items-center gap-2 text-sm ${readOnly ? '' : 'cursor-pointer'}`}
            >
              <input
                type="checkbox"
                checked={value.includes(c)}
                disabled={readOnly}
                onChange={() =>
                  onChange?.(
                    value.includes(c)
                      ? value.filter((x) => x !== c)
                      : [...value, c],
                  )
                }
              />
              <span
                className={
                  value.includes(c) ? 'text-navy-900' : 'text-gray-500'
                }
              >
                {c}
              </span>
            </label>
          </li>
        ))}
      </ul>
    </div>
  );
}

function VideoPlayer({
  file,
  onRemove,
}: {
  file: StoredFile;
  onRemove?: () => void;
}) {
  const url = useFileUrl(file);
  return (
    <div>
      {url ? (
        <video
          src={url}
          controls
          className="w-full max-h-96 rounded-xl bg-black"
        />
      ) : (
        <div className="h-48 rounded-xl bg-gray-100" />
      )}
      <div className="flex items-center justify-between mt-2 text-sm text-gray-500">
        <span className="truncate">{file.name}</span>
        {onRemove && (
          <button type="button" onClick={onRemove} className={btnDanger}>
            <Trash2 className="w-4 h-4" /> Retirer
          </button>
        )}
      </div>
    </div>
  );
}

// ======================= FICHE DÉTAILLÉE =======================
type Dialog = null | 'plan' | 'Validé' | 'Refusé';

export function LandFileDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [f, setF] = useState(() => (id ? getLandFile(id) : undefined));
  const [tab, setTab] = useState<
    'overview' | 'media' | 'docs' | 'notes' | 'history'
  >('overview');
  const [completing, setCompleting] = useState<PlannedAction | null>(null);
  const [photo, setPhoto] = useState(0);
  const [dialog, setDialog] = useState<Dialog>(null);
  const [preview, setPreview] = useState<StoredFile | null>(null);

  // Resync à l'ouverture du dossier + mise à jour auto sans F5 : sans ce bloc,
  // le dossier affiche un instantané figé du cache mémoire — potentiellement
  // périmé si un nouveau dépôt du site web a mis à jour ce dossier entre-temps.
  useEffect(() => {
    if (id) {
      refreshCache(true).then(() => setF(getLandFile(id)));
    }
    return subscribeCache(() => {
      if (id) setF(getLandFile(id));
    });
  }, [id]);

  if (!f) return <NotFound />;

  const update = (patch: Partial<LandFile>, log?: string) =>
    void saveLandFile({
      ...f,
      ...patch,
      history: log ? [...f.history, historyEntry(log)] : f.history,
    }).then(setF);
  const setStatus = (status: LandFileStatus, extra?: string) =>
    status !== f.status &&
    update(
      { status },
      `Statut changé : ${f.status} → ${status}${extra ? ` — ${extra}` : ''}`,
    );
  const stepIndex = FLOW.indexOf(f.status);
  const failed = ['Rejeté', 'Archivé', 'Dossier incomplet'].includes(f.status)
    ? f.status
    : undefined;
  const docsToCheck = f.documents.filter((d) => d.status !== 'Reçu').length;
  const cur = f.photos[Math.min(photo, f.photos.length - 1)];

  const printSheet = () =>
    printHtml(
      `Fiche terrain ${f.ref}`,
      `
    <h2>${escapeHtml(f.title)}</h2>
    ${f.photos
      .slice(0, 3)
      .filter((p) => p.url)
      .map((p) => `<img src="${escapeHtml(p.url)}" alt="Photo du terrain">`)
      .join('')}
    <dl>
      <dt>Référence</dt><dd>${escapeHtml(f.ref)}</dd><dt>Statut</dt><dd>${escapeHtml(f.status)}</dd>
      <dt>Superficie</dt><dd>${escapeHtml(fmtM2(f.area))}</dd><dt>Prix</dt><dd>${escapeHtml(fmtAr(f.price))} (${escapeHtml(fmtNum(f.pricePerM2))} Ar/m²)</dd>
      <dt>Localisation</dt><dd>${escapeHtml(place(f))}</dd><dt>Indication</dt><dd>${escapeHtml(f.addressHint)}</dd>
      <dt>GPS</dt><dd>${escapeHtml(`${f.lat ?? '—'}, ${f.lng ?? '—'}`)}</dd><dt>Relief</dt><dd>${escapeHtml(f.relief)}</dd>
      <dt>Accès</dt><dd>${escapeHtml(f.accesses.join(', '))}</dd><dt>Eau / Électricité</dt><dd>${escapeHtml(`${f.water} / ${f.electricity}`)}</dd>
      <dt>Usage recommandé</dt><dd>${escapeHtml(f.usage)}</dd><dt>Occupation</dt><dd>${escapeHtml(f.occupation)}</dd>
    </dl>
    <h2>Description</h2><p>${escapeHtml(f.description)}</p>
    <h2>Conditions de vente</h2><dl>
      <dt>Paiement</dt><dd>${escapeHtml(f.salePayment)}</dd><dt>Durée max.</dt><dd>${escapeHtml(f.maxDuration === 'Autre durée' ? f.maxDurationOther : f.maxDuration)}</dd>
      <dt>Acompte minimum</dt><dd>${escapeHtml(`${f.depositRange} · ${fmtAr(depositAmount(f))}`)}</dd><dt>Fréquence</dt><dd>${escapeHtml(f.frequency)}</dd>
      <dt>Négociable</dt><dd>${escapeHtml(`${f.saleNegotiable}${f.negotiationMargin ? ` (${f.negotiationMargin})` : ''}`)}</dd>
    </dl>
    <h2>Propriétaire</h2><dl><dt>Nom</dt><dd>${escapeHtml(fullName(f.owner))}</dd><dt>Téléphone</dt><dd>${escapeHtml(phoneOf(f.owner))}</dd></dl>`,
    );

  const plan = (a: PlannedAction) => {
    update(
      { actions: [...f.actions, a] },
      a.done
        ? `${a.type} effectué(e) le ${fmtDateTime(a.at)} : ${a.result}`
        : `${a.type} planifié(e) le ${fmtDateTime(a.at)}${a.note ? ` — ${a.note}` : ''}`,
    );
    setDialog(null);
  };
  const complete = (a: PlannedAction, result: string, followUp: boolean) => {
    update(
      {
        actions: f.actions.map((x) =>
          x.id === a.id
            ? { ...x, done: true, doneAt: new Date().toISOString(), result }
            : x,
        ),
      },
      `${a.type} effectué(e) : ${result}`,
    );
    setCompleting(null);
    if (followUp) setDialog('plan');
  };
  const cancelAction = async (a: PlannedAction) => {
    if (!(await askConfirm(`Annuler « ${a.type} » du ${fmtDateTime(a.at)} ?`)))
      return;
    update(
      { actions: f.actions.filter((x) => x.id !== a.id) },
      `${a.type} du ${fmtDateTime(a.at)} annulé(e)`,
    );
  };
  const decide = (decision: 'Validé' | 'Refusé', reason: string) =>
    update(
      {
        decision,
        decisionReason: reason,
        decidedAt: new Date().toISOString(),
        status: 'Archivé',
      },
      `Dossier ${decision.toLowerCase()}${reason ? ` — ${reason}` : ''} · archivé (statut : ${f.status} → Archivé)`,
    );
  const reopen = async () => {
    if (!(await askConfirm('Rouvrir ce dossier et le sortir des archives ?')))
      return;
    update(
      {
        decision: undefined,
        decisionReason: undefined,
        decidedAt: undefined,
        status: 'À examiner',
      },
      'Dossier rouvert (sorti des archives)',
    );
  };

  return (
    <>
      {/* En-tête / résumé */}
      <RecordHeader
        module="Demandes de vente"
        backTo={BASE}
        title={f.title || 'Sans titre'}
        reference={f.ref}
        status={f.status}
        subtitle={`${place(f) || 'Localisation non renseignée'} · reçu le ${fmtDate(f.receivedAt)}`}
        action={
          <>
            <Link to={`${BASE}/${f.id}/modifier`} className={btnOutline}>
              <Pencil size={15} />
              Modifier
            </Link>
            <button className={btnOutline} onClick={printSheet}>
              <FileDown size={15} />
              Fiche PDF
            </button>
          </>
        }
      />
      <SummaryStrip
        facts={[
          { label: 'Prix total', value: fmtAr(f.price) },
          { label: 'Surface', value: f.area ? `${fmtNum(f.area)} m²` : '' },
          { label: 'Propriétaire', value: fullName(f.owner) },
          { label: 'Agent', value: f.agent },
        ]}
      />

      <div className="grid lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 space-y-5">
          <Tabs
            value={tab}
            onChange={(t) => setTab(t)}
            tabs={[
              { id: 'overview', label: 'Résumé' },
              { id: 'media', label: `Photos (${f.photos.length})` },
              {
                id: 'docs',
                label: `Documents (${f.documents.length})`,
                badge: docsToCheck,
              },
              { id: 'notes', label: `Notes internes (${f.notes.length})` },
              { id: 'history', label: 'Historique' },
            ]}
          />

          {tab === 'media' && (
            <>
              {/* Galerie */}
              <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                {cur ? (
                  <>
                    <button
                      type="button"
                      onClick={() => setPreview(cur)}
                      className="block w-full"
                    >
                      <Thumb file={cur} className="w-full aspect-[16/9]" />
                    </button>
                    <div className="admin-scroll-x flex gap-2 p-3">
                      {f.photos.map((p, i) => (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => setPhoto(i)}
                          className={`shrink-0 rounded-lg overflow-hidden border-2 ${i === photo ? 'border-gold-500' : 'border-transparent'}`}
                        >
                          <Thumb file={p} className="w-20 h-14" />
                        </button>
                      ))}
                    </div>
                  </>
                ) : (
                  <div className="aspect-[16/9] flex flex-col items-center justify-center text-gray-600 bg-gray-50">
                    <ImageIcon className="w-8 h-8" />
                    <p className="text-sm mt-2">Aucune photo</p>
                  </div>
                )}
                {f.photos.length < MIN_PHOTOS && (
                  <p className="px-4 pb-3 text-xs text-orange-600">
                    ⚠ {f.photos.length} photo(s) sur {MIN_PHOTOS} minimum
                    requises.
                  </p>
                )}
              </div>
            </>
          )}

          {tab === 'overview' && (
            <>
              <Section
                title="Description"
                icon={<Landmark className="w-4 h-4" />}
              >
                <p className="text-sm whitespace-pre-line leading-relaxed">
                  {f.description || '—'}
                </p>
                <dl className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-5">
                  <Info label="Catégorie" value={f.category} />
                  <Info label="Relief" value={f.relief} />
                  <Info label="Usage recommandé" value={f.usage} />
                  <Info label="Accès" value={f.accesses.join(', ')} />
                  <Info label="Largeur de voie" value={f.roadWidth} />
                  <Info
                    label="Distance route principale"
                    value={f.distanceMainRoad}
                  />
                  <Info label="Eau" value={f.water} />
                  <Info label="Électricité" value={f.electricity} />
                  <Info label="Assainissement" value={f.sanitation} />
                  <Info
                    label="Réseau mobile / internet"
                    value={`${f.mobile || '—'} / ${f.internet || '—'}`}
                  />
                  <Info label="Clôture" value={f.fence} />
                  <Info
                    label="Construction"
                    value={
                      f.building === 'Oui'
                        ? `Oui — ${f.buildingDesc}`
                        : f.building
                    }
                  />
                  <Info label="Occupation" value={f.occupation} />
                  <Info label="Disponibilité immédiate" value={f.immediate} />
                  <Info label="Prix négociable" value={f.negotiable} />
                </dl>
              </Section>
              <Section
                title="Localisation"
                icon={<MapPin className="w-4 h-4" />}
              >
                <dl className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
                  <Info label="Indication" value={f.addressHint} />
                  <Info label="Repère" value={f.landmark} />
                  <Info
                    label="Coordonnées GPS"
                    value={
                      f.lat != null ? `${f.lat}, ${f.lng}` : 'Non renseignées'
                    }
                  />
                </dl>
                {f.lat != null && f.lng != null && (
                  <MapPicker lat={f.lat} lng={f.lng} readOnly />
                )}
              </Section>
              <Section
                title="Conditions financières"
                icon={<Wallet className="w-4 h-4" />}
              >
                <dl className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  <Info label="Mode de paiement" value={f.salePayment} />
                  <Info
                    label="Durée maximale"
                    value={
                      f.maxDuration === 'Autre durée'
                        ? f.maxDurationOther
                        : f.maxDuration
                    }
                  />
                  <Info
                    label="Acompte minimum"
                    value={`${f.depositRange === 'Personnalisé' ? `${f.depositCustom} %` : f.depositRange} · ${fmtAr(depositAmount(f))}`}
                  />
                  <Info
                    label="Fréquence"
                    value={
                      f.frequency === 'Personnalisée'
                        ? f.frequencyOther
                        : f.frequency
                    }
                  />
                  <Info
                    label="Négociation"
                    value={
                      f.saleNegotiable === 'Oui'
                        ? `Oui${f.negotiationMargin ? ` (${f.negotiationMargin})` : ''}`
                        : 'Non'
                    }
                  />
                  <Info
                    label="Estimation interne"
                    value={fmtAr(f.internalEstimate)}
                  />
                  <Info
                    label="Prix recommandé agence"
                    value={fmtAr(f.recommendedPrice)}
                  />
                  <Info
                    label="Commission"
                    value={f.commission ? `${f.commission} %` : '—'}
                  />
                </dl>
                {f.specialConditions && (
                  <p className="mt-4 text-sm bg-gray-50 rounded-lg p-3">
                    <strong>Conditions particulières : </strong>
                    {f.specialConditions}
                  </p>
                )}
                {f.ownerComments && (
                  <p className="mt-2 text-sm bg-gray-50 rounded-lg p-3">
                    <strong>Commentaires du propriétaire : </strong>
                    {f.ownerComments}
                  </p>
                )}
              </Section>
              <SiteFilesBlock f={f} onPreview={setPreview} />
              {f.video && (
                <Section title="Vidéo" icon={<Film className="w-4 h-4" />}>
                  <VideoPlayer file={f.video} />
                </Section>
              )}
            </>
          )}

          {tab === 'docs' && (
            <Section
              title="Documents fonciers"
              icon={<FileText className="w-4 h-4" />}
              confidential
            >
              {!f.documents.length && (
                <p className="text-sm text-gray-600">
                  Aucun document. Ajoutez-les depuis « Modifier ».
                </p>
              )}
              <div className="space-y-3">
                {f.documents.map((d) => (
                  <div
                    key={d.id}
                    className="p-3 rounded-xl border border-gray-200"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                      <div>
                        <p className="text-sm font-semibold text-navy-900">
                          {d.category}
                          {d.number && (
                            <span className="font-mono font-normal text-gray-500">
                              {' '}
                              · n° {d.number}
                            </span>
                          )}
                        </p>
                        <p className="text-xs text-gray-500">
                          Émis le {fmtDate(d.issuedAt)} · au nom de{' '}
                          {d.ownerName || '—'}
                        </p>
                      </div>
                      <Badge value={d.status} dot />
                    </div>
                    <FileChip file={d} onPreview={() => setPreview(d)} />
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {DOC_STATUSES.map((s) => (
                        <button
                          key={s}
                          type="button"
                          disabled={d.status === s}
                          onClick={() =>
                            update(
                              {
                                documents: f.documents.map((x) =>
                                  x.id === d.id ? { ...x, status: s } : x,
                                ),
                              },
                              `Document « ${d.category} » : ${d.status} → ${s}`,
                            )
                          }
                          className={`px-2.5 py-1 rounded-md text-xs border ${d.status === s ? 'bg-navy-900 text-white border-navy-900' : 'border-gray-300 hover:border-navy-900'}`}
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              {f.idDoc.file && (
                <div className="mt-5 pt-4 border-t">
                  <p className="text-xs font-medium text-gray-600 mb-2">
                    Pièce d’identité du propriétaire ({f.idDoc.type} n°{' '}
                    {f.idDoc.number})
                  </p>
                  <FileChip
                    file={f.idDoc.file}
                    onPreview={() => setPreview(f.idDoc.file!)}
                  />
                </div>
              )}
            </Section>
          )}

          {tab === 'notes' && (
            <Section
              title="Notes internes"
              icon={<MessageSquarePlus className="w-4 h-4" />}
              confidential
            >
              {f.internalComments && (
                <p className="mb-4 text-sm bg-gray-50 rounded-lg p-3 whitespace-pre-line">
                  <strong>Commentaires internes : </strong>
                  {f.internalComments}
                </p>
              )}
              <NotesPanel
                notes={f.notes}
                onAdd={(n) =>
                  update({ notes: [...f.notes, n] }, 'Note interne ajoutée')
                }
              />
            </Section>
          )}

          {tab === 'history' && (
            <Section title="Historique complet des actions">
              <Timeline items={f.history} />
            </Section>
          )}
        </div>

        {/* Colonne latérale */}
        <aside className="space-y-4">
          <Section title="Décision">
            {f.decision ? (
              <div className="space-y-3">
                <p
                  className={`text-sm font-semibold ${f.decision === 'Validé' ? 'text-blue-700' : 'text-red-700'}`}
                >
                  Dossier {f.decision.toLowerCase()} le{' '}
                  {fmtDateTime(f.decidedAt)} · archivé
                </p>
                {f.decisionReason && (
                  <p className="text-sm bg-gray-50 rounded-lg p-3 whitespace-pre-line">
                    {f.decisionReason}
                  </p>
                )}
                <button className={btnOutline} onClick={reopen}>
                  Rouvrir le dossier
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                <button
                  className={btnPrimary}
                  onClick={() => setDialog('Validé')}
                >
                  <BadgeCheck className="w-4 h-4" /> Accepter le dossier
                </button>
                <button
                  className={btnDanger}
                  onClick={() => setDialog('Refusé')}
                >
                  <XCircle className="w-4 h-4" /> Refuser
                </button>
                <p className="col-span-2 text-xs text-gray-600">
                  La décision est inscrite dans l’historique et le dossier passe
                  dans les archives.
                </p>
              </div>
            )}
          </Section>

          <Section title="Actions rapides">
            <button
              className={`${btnOutline} w-full`}
              onClick={() => setTab('notes')}
            >
              <MessageSquarePlus className="w-4 h-4" /> Ajouter une note
            </button>
          </Section>

          <ActionPlanner
            actions={f.actions}
            onPlan={() => setDialog('plan')}
            onComplete={setCompleting}
            onDelete={cancelAction}
          />

          <Section title="Propriétaire" icon={<User className="w-4 h-4" />}>
            <dl className="space-y-3">
              <Info label="Nom" value={`${fullName(f.owner)} (${f.ownerId})`} />
              <Info
                label="Téléphone"
                value={
                  <a
                    href={phoneHref(f.owner.phone, f.owner.dialCode)}
                    className="hover:text-gold-700"
                  >
                    {phoneOf(f.owner)}
                  </a>
                }
              />
              <Info
                label="Email"
                value={
                  <a
                    href={`mailto:${f.owner.email}`}
                    className="hover:text-gold-700"
                  >
                    {f.owner.email}
                  </a>
                }
              />
              <Info label="Profession" value={f.owner.profession} />
              <Info
                label="Pays de résidence"
                value={
                  f.owner.country === 'Autre'
                    ? f.owner.countryOther
                    : f.owner.country
                }
              />
              <Info
                label="Pièce d’identité"
                value={`${f.idDoc.type} · ${f.idDoc.number}${f.idDoc.file ? ' ✓' : ' (non fournie)'}`}
              />
              <Info
                label="Banque"
                value={
                  f.owner.hasBankAccount === 'Oui'
                    ? f.owner.bank || 'Oui'
                    : f.owner.hasBankAccount
                }
              />
            </dl>
          </Section>

          <Section
            title="Étude du dossier"
            icon={<ClipboardCheck className="w-4 h-4" />}
          >
            <Checklist
              value={f.checklist}
              onChange={(v) =>
                update(
                  { checklist: v },
                  'Suivi de complétude du dossier mise à jour',
                )
              }
            />
            <dl className="space-y-3 mt-4 pt-4 border-t">
              <Info
                label="Visite terrain"
                value={f.visitAt ? fmtDateTime(f.visitAt) : '—'}
              />
              <Info label="Compte rendu de visite" value={f.fieldCheck} />
              <Info label="Analyse des pièces" value={f.legalCheck} />
              <Info
                label="Dernière modification"
                value={fmtDateTime(f.updatedAt)}
              />
            </dl>
          </Section>
        </aside>
      </div>

      {dialog === 'plan' && (
        <PlanDialog onClose={() => setDialog(null)} onSave={plan} />
      )}
      {completing && (
        <CompleteDialog
          action={completing}
          onClose={() => setCompleting(null)}
          onSave={(res, next) => complete(completing, res, next)}
        />
      )}
      {(dialog === 'Validé' || dialog === 'Refusé') && (
        <DecisionDialog
          decision={dialog}
          onClose={() => setDialog(null)}
          onSave={(reason) => {
            decide(dialog, reason);
            setDialog(null);
          }}
        />
      )}
      <Preview file={preview} onClose={() => setPreview(null)} />
    </>
  );
}

function DecisionDialog({
  decision,
  onClose,
  onSave,
}: {
  decision: 'Validé' | 'Refusé';
  onClose: () => void;
  onSave: (reason: string) => void;
}) {
  const [reason, setReason] = useState('');
  const refuse = decision === 'Refusé';
  return (
    <Modal
      title={
        refuse
          ? 'Refuser le dossier'
          : 'Accepter le dossier pour commercialisation'
      }
      onClose={onClose}
      footer={
        <>
          <button className={btnOutline} onClick={onClose}>
            Annuler
          </button>
          <button
            className={
              refuse ? `${btnPrimary} bg-red-600 hover:bg-red-700` : btnPrimary
            }
            disabled={refuse && !reason.trim()}
            onClick={() => onSave(reason.trim())}
          >
            {refuse ? 'Refuser et archiver' : 'Accepter et archiver'}
          </button>
        </>
      }
    >
      <Field
        label={refuse ? 'Motif du refus' : 'Commentaire'}
        required={refuse}
      >
        <textarea
          rows={3}
          className={input}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder={
            refuse
              ? 'Documents non conformes, litige foncier…'
              : 'Ex : conditions commerciales convenues, dossier prêt à être présenté'
          }
        />
      </Field>
      <p className="text-xs text-gray-500">
        Le dossier sera déplacé dans les archives. Il pourra être rouvert si
        besoin.
      </p>
    </Modal>
  );
}
