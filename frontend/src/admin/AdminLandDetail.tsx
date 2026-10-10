import { RecordHeader, RecordMenu, SummaryStrip } from './records';
// Fiche détaillée d'un terrain du catalogue (backoffice) : toutes les
// informations qui vivaient auparavant dans la ligne dépliée du tableau,
// plus les actions Modifier / Supprimer / Vendre regroupées ici plutôt que
// dispersées en icônes dans la liste.
import {
  Droplets,
  Expand,
  FileText,
  HandCoins,
  History,
  ImageIcon,
  MapPin,
  Pencil,
  Plug,
  Receipt,
  Ruler,
  ShieldCheck,
  Sparkles,
  Trash2,
  UserPlus,
  Users,
  Wallet,
  X,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { formatArea, formatAriary, formatDateShort } from '../lib/format';
import { formatPhone } from '../lib/phone';
import { deleteLand, getLands } from '../lib/store';
import { Land } from '../types';
import { askConfirm } from './crm/dialog';
import {
  btnOutline,
  FileChip,
  Info,
  MapPicker,
  Preview,
  Section,
  Tabs,
} from './crm/kit';
import type { StoredFile } from './crm/model';
import { getBuyRequests } from './crm/model';
import { refreshCache, subscribeCache } from './crm/sync';
import { landFrontSummary, publicationLabel } from './landCatalog';
import { ClientRows, InterestDialog, LotDialog } from './LotDialog';
import SaleDialog from './SaleDialog';
import { Badge, btnGhost, Card } from './ui';

export default function AdminLandDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [lands, setLands] = useState(getLands);
  useEffect(() => {
    refreshCache().then(() => setLands(getLands()));
    return subscribeCache(() => setLands(getLands()));
  }, []);
  const land = useMemo(() => lands.find((l) => l.id === id), [lands, id]);

  const [selling, setSelling] = useState<{ land: Land; lotId?: string } | null>(
    null,
  );
  const [lotView, setLotView] = useState<string | null>(null);
  const [interest, setInterest] = useState(false);
  const [lightbox, setLightbox] = useState<number | null>(null);
  const [docPreview, setDocPreview] = useState<StoredFile | null>(null);
  // Mêmes sous-sections (onglets) que les fiches « Demandes de vente » / « Demandes
  // d'achat » : un seul schéma d'affichage pour toutes les fiches terrain.
  const [tab, setTab] = useState<'overview' | 'media' | 'docs' | 'sales'>(
    'overview',
  );
  const requests = useMemo(() => getBuyRequests(), [lands]);

  if (!land) return <Navigate to="/admin/terrains" replace />;

  const refresh = () => setLands(getLands());
  const summary = landFrontSummary(land);

  const remove = async () => {
    if (
      !(await askConfirm(
        `Supprimer « ${land.title} » ? Cette action est définitive.`,
      ))
    )
      return;
    await deleteLand(land.id);
    navigate('/admin/terrains');
  };

  return (
    <>
      <RecordHeader
        module="Catalogue du site"
        backTo="/admin/terrains"
        title={land.title}
        reference={`#${land.id}`}
        status={publicationLabel(land.publicationStatus)}
        subtitle={land.location}
        action={
          <>
            <Link
              to={`/admin/terrains/${land.id}/modifier`}
              className={btnOutline}
            >
              <Pencil size={15} />
              Modifier
            </Link>
            {land.status !== 'vendu' && (
              <button
                className={btnOutline}
                onClick={() => setSelling({ land })}
              >
                <HandCoins size={15} />
                Enregistrer une vente
              </button>
            )}
            <RecordMenu label="Autres actions du terrain">
              <button
                onClick={remove}
                title="Supprimer le terrain"
                className="text-red-700"
              >
                <Trash2 size={15} />
                Supprimer
              </button>
            </RecordMenu>
          </>
        }
      />
      <SummaryStrip
        facts={[
          { label: 'Prix', value: formatAriary(land.price) },
          {
            label: 'Surface',
            value:
              land.area > 0
                ? `${new Intl.NumberFormat('fr-FR').format(land.area)} m²`
                : '',
          },
          { label: 'Disponibilité', value: <Badge value={land.status} /> },
          { label: 'Documents', value: land.documents?.length ?? 0 },
        ]}
      />

      <Tabs
        value={tab}
        onChange={(t) => setTab(t)}
        tabs={[
          { id: 'overview', label: 'Résumé' },
          { id: 'media', label: `Photos (${summary.gallery.length})` },
          { id: 'docs', label: `Documents (${land.documents?.length ?? 0})` },
          {
            id: 'sales',
            label: `Ventes & clients intéressés (${(land.sales?.length ?? 0) + requests.filter((request) => request.landId === land.id && request.status !== 'Achat finalisé').length})`,
          },
        ]}
      />

      {tab === 'media' && (
        <>
          {summary.gallery.length > 0 ? (
            <div className="mb-5">
              <button
                onClick={() => setLightbox(0)}
                className="group relative block h-56 w-full overflow-hidden rounded-2xl bg-navy-900/5 sm:h-72"
              >
                <img
                  src={summary.gallery[0]}
                  alt={land.title}
                  className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.02]"
                  referrerPolicy="no-referrer"
                  loading="lazy"
                  decoding="async"
                />
                <span className="absolute bottom-4 left-4 flex items-center gap-1.5 rounded-full bg-white/90 px-3 py-1.5 text-xs font-semibold text-navy-900 backdrop-blur-md">
                  <Expand className="h-3.5 w-3.5" /> Agrandir
                </span>
                {summary.gallery.length > 1 && (
                  <span className="absolute bottom-4 right-4 rounded-full bg-navy-900/80 px-3 py-1.5 text-xs font-semibold text-white backdrop-blur-md">
                    {summary.gallery.length} photos
                  </span>
                )}
              </button>
              {summary.gallery.length > 1 && (
                <div className="mt-2 grid grid-cols-4 gap-2 sm:grid-cols-6 lg:grid-cols-8">
                  {summary.gallery.map((src, i) => (
                    <button
                      key={`${src}-${i}`}
                      onClick={() => setLightbox(i)}
                      aria-label={`Photo ${i + 1} sur ${summary.gallery.length}`}
                      className={`relative h-16 overflow-hidden rounded-lg bg-navy-900/5 sm:h-20 ${i === 0 ? 'ring-2 ring-gold-500 ring-offset-1' : ''}`}
                    >
                      <img
                        src={src}
                        alt=""
                        className="h-full w-full object-cover"
                        referrerPolicy="no-referrer"
                        loading="lazy"
                        decoding="async"
                      />
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="mb-5 flex h-32 items-center justify-center rounded-2xl border border-dashed border-gray-300 bg-gray-50 text-sm text-gray-600">
              Aucun visuel déposé pour cette fiche — ajoutez-en depuis «
              Modifier ».
            </div>
          )}
        </>
      )}

      {tab === 'overview' && (
        <div className="space-y-5">
          <Section title="Présentation" icon={<Sparkles className="w-4 h-4" />}>
            <p className="whitespace-pre-line text-sm leading-relaxed text-gray-700">
              {land.description || 'Aucune description renseignée.'}
            </p>
            {land.features.length > 0 && (
              <ul className="mt-4 flex flex-wrap gap-1.5">
                {land.features.map((f) => (
                  <li
                    key={f}
                    className="rounded-full bg-gold-400/15 px-2.5 py-1 text-xs text-navy-900"
                  >
                    {f}
                  </li>
                ))}
              </ul>
            )}
          </Section>

          <Section
            title="Caractéristiques"
            icon={<Ruler className="w-4 h-4" />}
          >
            <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Info label="Surface" value={formatArea(land.area)} />
              <Info label="Prix total" value={formatAriary(land.price)} />
              <Info
                label="Prix au m²"
                value={
                  land.area
                    ? formatAriary(Math.round(land.price / land.area))
                    : '—'
                }
              />
              <Info
                label="Statut juridique"
                value={
                  <span className="inline-flex items-center gap-1">
                    <ShieldCheck className="h-3.5 w-3.5 text-gold-700" />{' '}
                    {land.titleStatus}
                  </span>
                }
              />
              <Info label="Relief" value={land.relief || 'Non précisé'} />
              <Info label="Localisation affichée" value={land.location} />
              <Info
                label="Eau"
                value={
                  <span className="inline-flex items-center gap-1">
                    <Droplets className="h-3.5 w-3.5 text-blue-500" />{' '}
                    {land.water ? 'Disponible' : 'Non précisé'}
                  </span>
                }
              />
              <Info
                label="Électricité"
                value={
                  <span className="inline-flex items-center gap-1">
                    <Plug className="h-3.5 w-3.5 text-amber-500" />{' '}
                    {land.electricity ? 'Disponible' : 'Non précisé'}
                  </span>
                }
              />
            </dl>
          </Section>

          <Section
            title="Prix, accès et paiement"
            icon={<Wallet className="w-4 h-4" />}
          >
            <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <Info label="Modalités de paiement" value={summary.payment} />
              <Info
                label="Acompte"
                value={land.downPayment || 'Non renseigné'}
              />
              <Info
                label="Durée maximale / échéancier"
                value={land.installments || 'Non renseigné'}
              />
              <Info label="Accès au terrain" value={summary.access} />
            </dl>
          </Section>

          {land.coordinates && (
            <Section title="Localisation" icon={<MapPin className="w-4 h-4" />}>
              <p className="mb-3 text-sm text-gray-500">
                GPS : {land.coordinates[0]}, {land.coordinates[1]}
              </p>
              <MapPicker
                lat={land.coordinates[0]}
                lng={land.coordinates[1]}
                readOnly
                height="h-72"
              />
            </Section>
          )}

          {land.lots && land.lots.length > 0 && (
            <Card className="p-5">
              <p className="mb-2 flex items-center gap-2 font-medium text-navy-900">
                <ImageIcon className="h-4 w-4 text-gold-700" /> Parcelles :{' '}
                {formatArea(
                  land.lots.reduce((total, lot) => total + lot.area, 0),
                )}{' '}
                sur {formatArea(land.area)}
              </p>
              <p className="mb-3 text-xs text-gray-500">
                Le site public les affiche et les demandes reçues précisent la
                parcelle choisie.
              </p>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                {land.lots.map((lot) => (
                  <div
                    key={lot.id}
                    className="flex flex-col overflow-hidden rounded-lg border border-gray-200 bg-white"
                  >
                    {lot.imageUrl && (
                      <img
                        src={lot.imageUrl}
                        alt=""
                        className="h-24 w-full object-cover"
                        referrerPolicy="no-referrer"
                        loading="lazy"
                        decoding="async"
                      />
                    )}
                    <div className="flex flex-1 flex-col p-3">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium text-navy-900">
                          {lot.number}
                        </span>
                        <Badge value={lot.status} />
                      </div>
                      <p className="mt-1 text-gray-600">
                        {formatArea(lot.area)} · {formatAriary(lot.price)}
                      </p>
                      {lot.details && (
                        <p className="mt-1 line-clamp-3 text-xs text-gray-500">
                          {lot.details}
                        </p>
                      )}
                      {(() => {
                        const count = requests.filter(
                          (request) =>
                            request.landId === land.id &&
                            request.lotId === lot.id &&
                            request.status !== 'Achat finalisé',
                        ).length;
                        const buyer = land.sales?.find(
                          (sale) => sale.lotId === lot.id,
                        )?.buyer;
                        return (
                          <p className="mt-2 flex items-center gap-1 text-xs text-gray-600">
                            <Users className="h-3.5 w-3.5 text-gold-700" />
                            {buyer
                              ? `Acheteur : ${buyer.firstName} ${buyer.lastName}`
                              : `${count} client(s) intéressé(s)`}
                          </p>
                        );
                      })()}
                      <div className="mt-auto flex flex-wrap gap-x-3 pt-2">
                        <button
                          onClick={() => setLotView(lot.id)}
                          className={`${btnGhost} justify-start px-0`}
                        >
                          <History className="w-4 h-4" /> Détails & historique
                        </button>
                        {lot.status !== 'vendu' && (
                          <button
                            onClick={() => setSelling({ land, lotId: lot.id })}
                            className={`${btnGhost} justify-start px-0 text-blue-700`}
                          >
                            <HandCoins className="w-4 h-4" /> Vendre
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>
      )}

      {tab === 'docs' && (
        <Section
          title="Documents du terrain"
          icon={<FileText className="w-4 h-4" />}
        >
          {land.documents && land.documents.length > 0 ? (
            <>
              <p className="mb-3 text-xs text-gray-500">
                Pièces déposées sur la fiche (titre foncier, plan, certificat…)
                — consultables ici, modifiables depuis « Modifier ».
              </p>
              <div className="grid gap-2 sm:grid-cols-2">
                {land.documents.map((doc) => (
                  <FileChip
                    key={doc.id}
                    file={doc}
                    onPreview={() => setDocPreview(doc)}
                  />
                ))}
              </div>
            </>
          ) : (
            <p className="text-sm text-gray-600">Aucun document déposé.</p>
          )}
        </Section>
      )}

      {tab === 'sales' && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card className="p-4">
            <p className="mb-2 flex items-center gap-2 font-medium text-navy-900">
              <Receipt className="w-4 h-4 text-gold-700" /> Historique des
              ventes
            </p>
            {!land.sales?.length ? (
              <p className="text-sm text-gray-600">Aucune vente enregistrée.</p>
            ) : (
              <ul className="divide-y divide-gray-100">
                {[...land.sales]
                  .sort((x, y) => y.date.localeCompare(x.date))
                  .map((sale) => (
                    <li key={sale.id} className="py-2 text-sm">
                      <div className="flex flex-wrap justify-between gap-2">
                        <Link
                          to={`/admin/achats/${sale.buyRequestId}`}
                          className="font-medium hover:text-gold-700"
                        >
                          {sale.buyer.firstName} {sale.buyer.lastName}
                        </Link>
                        <span className="font-semibold">
                          {formatAriary(sale.price)}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500">
                        {formatDateShort(sale.date)} ·{' '}
                        {sale.lotId
                          ? (land.lots?.find((lot) => lot.id === sale.lotId)
                              ?.number ?? 'Parcelle')
                          : 'Terrain entier'}{' '}
                        · {formatPhone(sale.buyer.phone)} ·{' '}
                        {sale.paymentMode.split(' –')[0]}
                      </p>
                      {sale.notes && (
                        <p className="mt-0.5 text-xs text-gray-600">
                          {sale.notes}
                        </p>
                      )}
                    </li>
                  ))}
              </ul>
            )}
          </Card>
          <Card className="p-4">
            <div className="mb-2 flex items-center justify-between gap-2">
              <p className="flex items-center gap-2 font-medium text-navy-900">
                <Users className="w-4 h-4 text-gold-700" /> Clients intéressés
              </p>
              {land.status !== 'vendu' && (
                <button
                  onClick={() => setInterest(true)}
                  className={`${btnGhost} text-navy-900`}
                >
                  <UserPlus className="w-4 h-4" /> Ajouter
                </button>
              )}
            </div>
            {(() => {
              const list = requests.filter(
                (request) =>
                  request.landId === land.id &&
                  request.status !== 'Achat finalisé',
              );
              if (!list.length)
                return (
                  <p className="text-sm text-gray-600">
                    Aucun client intéressé pour l’instant.
                  </p>
                );
              return <ClientRows rows={list} />;
            })()}
          </Card>
        </div>
      )}

      {lightbox !== null && summary.gallery.length > 0 && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-navy-950/90 p-4"
          onClick={() => setLightbox(null)}
        >
          <button
            onClick={() => setLightbox(null)}
            className="absolute right-4 top-4 rounded-full bg-white/10 p-2 text-white hover:bg-white/20"
            aria-label="Fermer"
          >
            <X className="h-5 w-5" />
          </button>
          <img
            src={summary.gallery[lightbox]}
            alt={land.title}
            className="max-h-[85vh] max-w-full rounded-xl object-contain"
            referrerPolicy="no-referrer"
            onClick={(e) => e.stopPropagation()}
          />
          {summary.gallery.length > 1 && (
            <div className="absolute bottom-6 rounded-full bg-white/10 px-4 py-1.5 text-sm text-white">
              {lightbox + 1} / {summary.gallery.length}
            </div>
          )}
        </div>
      )}

      <Preview file={docPreview} onClose={() => setDocPreview(null)} />

      {lotView && (
        <LotDialog
          land={land}
          lotId={lotView}
          onClose={() => setLotView(null)}
          onChanged={refresh}
          onSell={() => {
            setSelling({ land, lotId: lotView });
            setLotView(null);
          }}
        />
      )}

      {interest && (
        <InterestDialog
          land={land}
          onClose={() => setInterest(false)}
          onDone={() => {
            setInterest(false);
            refresh();
          }}
        />
      )}

      {selling && (
        <SaleDialog
          land={selling.land}
          lotId={selling.lotId}
          onClose={() => setSelling(null)}
          onDone={() => {
            refresh();
            setSelling(null);
          }}
        />
      )}
    </>
  );
}
