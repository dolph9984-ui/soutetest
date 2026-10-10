// Catalogue : fiche d'une parcelle (historique, acheteur, clients intéressés)
// et ajout d'un client intéressé sur un terrain ou une parcelle.
import {
  HandCoins,
  History,
  MessageSquarePlus,
  Phone,
  Plus,
  Receipt,
  UserPlus,
  Users,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { formatPhone, phoneHref } from '../lib/phone';
import { getLands, saveLand } from '../lib/store';
import { Land, Lot } from '../types';
import { ClientForm } from './Clients';
import { ActionLabel, nextAction } from './crm/client';
import {
  Badge,
  Field,
  Modal,
  Timeline,
  btnGold,
  btnOutline,
  btnPrimary,
  fmtAr,
  fmtDate,
  fmtM2,
  input,
} from './crm/kit';
import {
  BuyRequest,
  fullName,
  getBuyRequests,
  historyEntry,
  newBuyRequest,
  phoneOf,
  saveBuyRequest,
} from './crm/model';
import { Client, createClient, getClients, splitName } from './crm/people';
import { SummaryStrip } from './records';

/** Ajoute une entrée à l'historique d'une parcelle et enregistre le terrain. */
export function logLot(land: Land, lotId: string, text: string): Land {
  const lots = (land.lots ?? []).map((l) =>
    l.id === lotId
      ? { ...l, history: [...(l.history ?? []), historyEntry(text)] }
      : l,
  );
  const next = { ...land, lots };
  saveLand(next);
  return next;
}

/** Ouvre un dossier « Demande d'achat » pour un client intéressé par ce terrain / cette parcelle. */
async function addInterest(
  land: Land,
  lot: Lot | undefined,
  client: Client,
  note: string,
): Promise<BuyRequest> {
  const r = newBuyRequest();
  const where = lot ? `${land.title} — ${lot.number}` : land.title;
  const req = await saveBuyRequest({
    ...r,
    ...splitName(client.fullName),
    clientId: client.id,
    phone: client.phone,
    email: client.email,
    profession: client.profession,
    country:
      !client.nationality || /malgache|madagascar/i.test(client.nationality)
        ? 'Madagascar'
        : 'Autre',
    countryOther:
      client.nationality && !/malgache|madagascar/i.test(client.nationality)
        ? client.nationality
        : '',
    budgetMax: Number(client.budget) || 0,
    landId: land.id,
    lotId: lot?.id,
    source: 'Agence',
    consent: true,
    extraInfo: note,
    history: [
      historyEntry(
        `Client intéressé par ${where} (ajouté depuis le catalogue)${note ? ` — ${note}` : ''}`,
      ),
    ],
  });
  if (lot)
    logLot(
      land,
      lot.id,
      `Client intéressé ajouté : ${client.fullName} (${req.ref})${note ? ` — ${note}` : ''}`,
    );
  return req;
}

export function InterestDialog({
  land,
  lotId,
  onClose,
  onDone,
}: {
  land: Land;
  lotId?: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const [clients, setClients] = useState(getClients);
  const already = useMemo(
    () =>
      new Set(
        getBuyRequests()
          .filter(
            (r) => r.landId === land.id && (r.lotId ?? '') === (lotId ?? ''),
          )
          .map((r) => r.clientId),
      ),
    [land.id, lotId],
  );
  const [clientId, setClientId] = useState('');
  const [note, setNote] = useState('');
  const [creating, setCreating] = useState(false);
  const lot = land.lots?.find((l) => l.id === lotId);
  const client = clients.find((c) => c.id === clientId);

  if (creating) {
    return (
      <ClientForm
        title="Nouveau client"
        onClose={() => setCreating(false)}
        onSave={async (f) => {
          const c = await createClient(f, 'Backoffice');
          setClients(getClients());
          setClientId(c.id);
          setCreating(false);
        }}
      />
    );
  }

  return (
    <Modal
      title={`Client intéressé — ${lot ? `${land.title} · ${lot.number}` : land.title}`}
      onClose={onClose}
      footer={
        <>
          <button className={btnOutline} onClick={onClose}>
            Annuler
          </button>
          <button
            className={btnPrimary}
            disabled={!client || already.has(client.id)}
            onClick={async () => {
              await addInterest(land, lot, client!, note.trim());
              onDone();
            }}
          >
            Ajouter
          </button>
        </>
      }
    >
      <Field label="Client (base clients)">
        <div className="flex gap-2">
          <select
            value={clientId}
            onChange={(e) => setClientId(e.target.value)}
            className={input}
          >
            <option value="">— Choisir un client —</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id} disabled={already.has(c.id)}>
                {c.fullName} · {formatPhone(c.phone)}
                {already.has(c.id) ? ' (déjà intéressé)' : ''}
              </option>
            ))}
          </select>
          <button
            type="button"
            className={btnOutline}
            onClick={() => setCreating(true)}
            title="Créer un client"
          >
            <UserPlus className="w-4 h-4" />
          </button>
        </div>
      </Field>
      <Field label="Remarque">
        <textarea
          rows={2}
          className={input}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Ex : a visité le terrain, attend son financement"
        />
      </Field>
      <p className="text-xs text-gray-500">
        Un dossier « Demande d’achat » est ouvert pour ce client : vous pourrez
        y planifier des appels ou rendez-vous et suivre son historique.
      </p>
    </Modal>
  );
}

export function LotDialog({
  land: initial,
  lotId,
  onClose,
  onSell,
  onChanged,
}: {
  land: Land;
  lotId: string;
  onClose: () => void;
  onSell: () => void;
  onChanged: () => void;
}) {
  const [land, setLand] = useState(initial);
  const [note, setNote] = useState('');
  const [adding, setAdding] = useState(false);
  const [version, setVersion] = useState(0);
  const lot = land.lots?.find((l) => l.id === lotId);
  const requests = useMemo(
    () => getBuyRequests().filter((r) => r.landId === land.id),
    [land.id, version],
  );
  if (!lot) return null;

  const sale = land.sales?.find((s) => s.lotId === lot.id);
  const interested = requests.filter((r) => r.lotId === lot.id);
  const landLevel = requests.filter(
    (r) => !r.lotId && r.status !== 'Achat finalisé',
  );
  const history = [
    ...(lot.history ?? []),
    ...(sale
      ? [
          {
            id: `sale-${sale.id}`,
            at: `${sale.date}T12:00:00`,
            author: 'Administrateur',
            text: `Vendue à ${sale.buyer.firstName} ${sale.buyer.lastName} pour ${fmtAr(sale.price)}`,
          },
        ]
      : []),
  ];

  const addNote = () => {
    if (!note.trim()) return;
    setLand(logLot(land, lot.id, `Note : ${note.trim()}`));
    setNote('');
    onChanged();
  };

  return (
    <>
      <Modal
        title={`${lot.number} — ${land.title}`}
        wide
        kind="detail"
        onClose={onClose}
        footer={
          <button className={btnOutline} onClick={onClose}>
            Fermer
          </button>
        }
      >
        <SummaryStrip
          facts={[
            { label: 'Surface', value: fmtM2(lot.area) },
            { label: 'Prix', value: fmtAr(lot.price) },
            { label: 'Disponibilité', value: <Badge value={lot.status} /> },
            { label: 'Clients intéressés', value: interested.length },
          ]}
        />
        <div className="space-y-6">
          {lot.details && (
            <p className="text-sm bg-gray-50 rounded-lg p-3">{lot.details}</p>
          )}

          {/* Acheteur */}
          <section>
            <h3 className="flex items-center gap-2 font-semibold text-navy-900 mb-2">
              <Receipt className="w-4 h-4 text-gold-700" /> Acheteur
            </h3>
            {sale ? (
              <div className="p-3 rounded-xl border border-blue-200 bg-blue-50 text-sm">
                <p className="font-semibold">
                  {sale.buyer.firstName} {sale.buyer.lastName}
                </p>
                <p className="text-gray-600">
                  {formatPhone(sale.buyer.phone)}
                  {sale.buyer.email && ` · ${sale.buyer.email}`}
                </p>
                <p className="text-gray-600">
                  Vendue le {fmtDate(sale.date)} · {fmtAr(sale.price)} ·{' '}
                  {sale.paymentMode.split(' –')[0]}
                </p>
                {sale.notes && <p className="mt-1">{sale.notes}</p>}
                <Link
                  to={`/admin/achats/${sale.buyRequestId}`}
                  className="text-gold-700 hover:underline text-xs"
                >
                  Voir le dossier de l’acheteur
                </Link>
              </div>
            ) : (
              <div className="flex flex-wrap items-center justify-between gap-2 p-3 rounded-xl bg-gray-50 text-sm">
                <span className="text-gray-500">Pas encore vendue.</span>
                <button className={btnGold} onClick={onSell}>
                  <HandCoins className="w-4 h-4" /> Vendre cette parcelle
                </button>
              </div>
            )}
          </section>

          {/* Clients intéressés */}
          <section>
            <div className="flex items-center justify-between gap-2 mb-2">
              <h3 className="flex items-center gap-2 font-semibold text-navy-900">
                <Users className="w-4 h-4 text-gold-700" /> Clients intéressés (
                {interested.length})
              </h3>
              {!sale && (
                <button className={btnOutline} onClick={() => setAdding(true)}>
                  <Plus className="w-4 h-4" /> Ajouter
                </button>
              )}
            </div>
            {!interested.length && (
              <p className="text-sm text-gray-600">
                Aucun client intéressé par cette parcelle.
              </p>
            )}
            <ClientRows rows={interested} />
            {landLevel.length > 0 && (
              <p className="text-xs text-gray-500 mt-2">
                + {landLevel.length} client(s) intéressé(s) par le terrain sans
                parcelle précise :{' '}
                {landLevel.map((r) => fullName(r)).join(', ')}.
              </p>
            )}
          </section>
          <section>
            <h3 className="flex items-center gap-2 font-semibold text-navy-900 mb-2">
              <History size={16} />
              Historique de la parcelle
            </h3>
            <div className="flex gap-2 mb-4">
              <input
                className={input}
                aria-label="Note pour l’historique de la parcelle"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addNote()}
                placeholder="Ajouter une note à l’historique…"
              />
              <button
                className={btnPrimary}
                onClick={addNote}
                aria-label="Ajouter la note"
              >
                <MessageSquarePlus size={16} />
              </button>
            </div>
            <Timeline items={history} />
          </section>
        </div>
      </Modal>{' '}
      {adding && (
        <div onClick={(e) => e.stopPropagation()}>
          <InterestDialog
            land={land}
            lotId={lot.id}
            onClose={() => setAdding(false)}
            onDone={() => {
              setAdding(false);
              setVersion((v) => v + 1);
              setLand(getLandById(land));
              onChanged();
            }}
          />
        </div>
      )}
    </>
  );
}

/** Relit le terrain après modification (historique de la parcelle). */
function getLandById(land: Land): Land {
  return getLands().find((l) => l.id === land.id) ?? land;
}

/** Liste de clients (dossiers d'achat) avec statut et prochaine action. */
export function ClientRows({ rows }: { rows: BuyRequest[] }) {
  if (!rows.length) return null;
  return (
    <ul className="divide-y divide-gray-100 border border-gray-200 rounded-xl">
      {rows.map((r) => (
        <li
          key={r.id}
          className="p-3 flex flex-wrap items-center justify-between gap-2 text-sm"
        >
          <div className="min-w-0">
            <Link
              to={`/admin/achats/${r.id}`}
              className="font-medium hover:text-gold-700"
            >
              {fullName(r)}
            </Link>
            <p className="text-xs text-gray-500 flex flex-wrap gap-x-3">
              <a
                href={phoneHref(r.phone, r.dialCode)}
                className="inline-flex items-center gap-1 hover:text-navy-900"
              >
                <Phone className="w-3 h-3" /> {phoneOf(r)}
              </a>
              <span>
                Prochaine action : <ActionLabel a={nextAction(r.actions)} />
              </span>
            </p>
          </div>
          <Badge value={r.status} dot />
        </li>
      ))}
    </ul>
  );
}
