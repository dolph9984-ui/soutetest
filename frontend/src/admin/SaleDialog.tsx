// Enregistrement d'une vente depuis le catalogue, directement dans le backoffice.
// L'acheteur vient de la base clients (ou y est créé, avec les mêmes champs que sur le site),
// et la vente est inscrite dans son dossier d'achat pour garder tout l'historique.
import { CheckCircle2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { formatPhone, PHONE_PLACEHOLDER } from '../lib/phone';
import { newId, saveLand } from '../lib/store';
import { phoneError, sanitizePhone } from '../lib/validate';
import { Land, Sale } from '../types';
import {
  btnOutline,
  btnPrimary,
  Choice,
  Field,
  fmtAr,
  fmtDate,
  fmtM2,
  input,
  Modal,
} from './crm/kit';
import {
  BUY_PAYMENT,
  BuyRequest,
  getBuyRequests,
  historyEntry,
  newBuyRequest,
  saveBuyRequest,
} from './crm/model';
import {
  ClientFields,
  createClient,
  emptyClientFields,
  getClients,
  splitName,
} from './crm/people';

export default function SaleDialog({
  land,
  lotId: initialLot,
  onClose,
  onDone,
}: {
  land: Land;
  lotId?: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const lots = land.lots ?? [];
  const sellable = lots.filter((l) => l.status !== 'vendu');
  const [lotId, setLotId] = useState(
    initialLot ?? (lots.length ? (sellable[0]?.id ?? '') : ''),
  );
  const lot = lots.find((l) => l.id === lotId);

  const openRequests = useMemo(
    () =>
      getBuyRequests().filter(
        (r) => r.status !== 'Achat finalisé' && r.status !== 'Archivée',
      ),
    [],
  );
  const clients = useMemo(() => {
    const interested = new Set(
      openRequests.filter((r) => r.landId === land.id).map((r) => r.clientId),
    );
    return getClients()
      .map((c) => ({ c, star: interested.has(c.id) }))
      .sort(
        (a, b) =>
          Number(b.star) - Number(a.star) ||
          a.c.fullName.localeCompare(b.c.fullName),
      );
  }, [openRequests, land.id]);

  const [clientId, setClientId] = useState(
    () => clients.find((x) => x.star)?.c.id ?? 'new',
  );
  const client = clients.find((x) => x.c.id === clientId)?.c;
  const [fields, setFields] = useState<ClientFields>(emptyClientFields);
  const [price, setPrice] = useState(lot?.price ?? land.price);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [paymentMode, setPaymentMode] = useState<string>(BUY_PAYMENT[0]);
  const [notes, setNotes] = useState('');
  const [error, setError] = useState(''),
    [busy, setBusy] = useState(false);

  const setF = (k: keyof ClientFields, v: string) =>
    setFields((f) => ({ ...f, [k]: v }));
  const chooseLot = (id: string) => {
    setLotId(id);
    setPrice(lots.find((x) => x.id === id)?.price ?? land.price);
  };

  const save = async () => {
    if (lots.length && !lotId)
      return setError('Choisissez la parcelle vendue.');
    if (!price) return setError('Indiquez le prix de vente.');
    if (!client && (!fields.fullName.trim() || !fields.phone.trim()))
      return setError(
        'Nom complet et téléphone de l’acheteur sont obligatoires.',
      );
    if (!client && phoneError(fields.phone))
      return setError(
        phoneError(fields.phone) ?? 'Numéro de téléphone invalide.',
      );

    setBusy(true);
    try {
      const what = lot ? `${land.title} — ${lot.number}` : land.title;
      const log = `Vente enregistrée : ${what} · ${fmtAr(price)} · ${paymentMode} · le ${fmtDate(date)}${notes ? ` — ${notes}` : ''}`;

      // 1. Client (base clients)
      const buyer =
        client ??
        (await createClient(
          {
            ...fields,
            fullName: fields.fullName.trim(),
            phone: fields.phone.trim(),
          },
          'Backoffice',
        ));

      // 2. Dossier d'achat : celui du client pour ce terrain s'il existe, sinon un nouveau
      const mine = openRequests.filter((r) => r.clientId === buyer.id);
      const existing =
        mine.find((r) => r.landId === land.id && r.lotId === lot?.id) ??
        mine.find((r) => r.landId === land.id);
      let request: BuyRequest;
      if (existing) {
        request = await saveBuyRequest({
          ...existing,
          landId: land.id,
          lotId: lot?.id,
          paymentMode,
          status: 'Achat finalisé',
          actions: existing.actions.map((a) =>
            a.done
              ? a
              : {
                  ...a,
                  done: true,
                  doneAt: new Date().toISOString(),
                  result: 'Clôturée : vente finalisée',
                },
          ),
          history: [
            ...existing.history,
            historyEntry(`Statut changé : ${existing.status} → Achat finalisé`),
            historyEntry(log),
          ],
        });
      } else {
        const r = newBuyRequest();
        const { firstName, lastName } = splitName(buyer.fullName);
        request = await saveBuyRequest({
          ...r,
          clientId: buyer.id,
          firstName,
          lastName,
          phone: buyer.phone,
          email: buyer.email,
          profession: buyer.profession,
          country:
            !buyer.nationality || /malgache|madagascar/i.test(buyer.nationality)
              ? 'Madagascar'
              : 'Autre',
          countryOther:
            buyer.nationality && !/malgache|madagascar/i.test(buyer.nationality)
              ? buyer.nationality
              : '',
          hasBankAccount: buyer.bankAccount
            ? /^non/i.test(buyer.bankAccount)
              ? 'Non'
              : 'Oui'
            : '',
          bank:
            buyer.bankAccount && !/^(oui|non)$/i.test(buyer.bankAccount)
              ? buyer.bankAccount
              : '',
          landId: land.id,
          lotId: lot?.id,
          paymentMode,
          budgetMin: price,
          budgetMax: price,
          source: 'Agence',
          consent: true,
          status: 'Achat finalisé',
          extraInfo: buyer.message,
          history: [
            historyEntry('Dossier créé lors de la vente (catalogue)'),
            historyEntry(log),
          ],
        });
      }

      // 3. Terrain : vente + statuts
      const { firstName, lastName } = splitName(buyer.fullName);
      const sale: Sale = {
        id: newId(),
        date,
        lotId: lot?.id,
        price,
        paymentMode,
        notes,
        buyRequestId: request.id,
        buyer: {
          firstName,
          lastName,
          phone: buyer.phone,
          email: buyer.email,
          address: '',
          idNumber: '',
        },
      };
      const newLots = lots.map((l) =>
        l.id === lot?.id
          ? {
              ...l,
              status: 'vendu' as const,
              history: [
                ...(l.history ?? []),
                historyEntry(
                  `Vendue à ${buyer.fullName} (${formatPhone(buyer.phone)}) · ${fmtAr(price)} · ${paymentMode.split(' –')[0]}${notes ? ` — ${notes}` : ''}`,
                ),
              ],
            }
          : l,
      );
      const allSold = newLots.length
        ? newLots.every((l) => l.status === 'vendu')
        : true;
      await saveLand({
        ...land,
        lots: lots.length ? newLots : land.lots,
        status: allSold ? 'vendu' : land.status,
        sales: [...(land.sales ?? []), sale],
      });
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Vente non enregistrée.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      title="Enregistrer une vente"
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
              busy ||
              (lots.length > 0 && !sellable.length) ||
              !price ||
              !date ||
              (!client && (!fields.fullName.trim() || !fields.phone.trim()))
            }
          >
            <CheckCircle2 size={15} />
            {busy ? 'Enregistrement…' : 'Enregistrer la vente'}
          </button>
        </>
      }
    >
      <p className="text-sm text-slate-500 mb-5">{land.title}</p>
      <div className="space-y-5">
        {lots.length > 0 && (
          <Field label="Parcelle vendue" required>
            {sellable.length ? (
              <select
                value={lotId}
                onChange={(e) => chooseLot(e.target.value)}
                className={input}
              >
                {sellable.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.number} · {fmtM2(l.area)} · {fmtAr(l.price)} ({l.status})
                  </option>
                ))}
              </select>
            ) : (
              <p className="text-sm text-red-600">
                Toutes les parcelles sont déjà vendues.
              </p>
            )}
          </Field>
        )}

        <Field label="Acheteur (base clients)">
          <select
            value={clientId}
            onChange={(e) => setClientId(e.target.value)}
            className={input}
          >
            <option value="new">+ Nouveau client</option>
            {clients.map(({ c, star }) => (
              <option key={c.id} value={c.id}>
                {star ? '★ ' : ''}
                {c.fullName} · {formatPhone(c.phone)} · {c.ref}
              </option>
            ))}
          </select>
          <span className="block text-xs text-gray-600 mt-1">
            ★ = client ayant une demande d’achat sur ce terrain.
          </span>
        </Field>

        {client ? (
          <div className="p-3 rounded-xl bg-gray-50 text-sm flex flex-wrap justify-between gap-2">
            <span>
              <strong>{client.fullName}</strong> · {formatPhone(client.phone)}
              {client.email && ` · ${client.email}`}
              {client.profession && ` · ${client.profession}`}
            </span>
            <Link
              to={`/admin/clients/${client.id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-gold-700 hover:underline"
            >
              Fiche client
            </Link>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 gap-4 p-4 rounded-xl border border-gray-200">
            <p className="sm:col-span-2 text-xs text-gray-500">
              Mêmes informations que l’inscription sur le site. Le client sera
              ajouté à la base clients.
            </p>
            <Field label="Nom complet" required span={2}>
              <input
                className={input}
                value={fields.fullName}
                onChange={(e) => setF('fullName', e.target.value)}
              />
            </Field>
            <Field label="Téléphone" required>
              <input
                type="tel"
                inputMode="tel"
                className={input}
                value={fields.phone}
                onChange={(e) => setF('phone', sanitizePhone(e.target.value))}
                placeholder={PHONE_PLACEHOLDER}
              />
            </Field>
            <Field label="Email">
              <input
                type="email"
                className={input}
                value={fields.email}
                onChange={(e) => setF('email', e.target.value)}
              />
            </Field>
            <Field label="Budget approximatif (Ar)">
              <input
                className={input}
                value={fields.budget}
                onChange={(e) => setF('budget', e.target.value)}
              />
            </Field>
            <Field label="Profession">
              <input
                className={input}
                value={fields.profession}
                onChange={(e) => setF('profession', e.target.value)}
              />
            </Field>
            <Field label="Âge">
              <input
                type="number"
                className={input}
                value={fields.age}
                onChange={(e) => setF('age', e.target.value)}
              />
            </Field>
            <Field label="Nationalité">
              <input
                className={input}
                value={fields.nationality}
                onChange={(e) => setF('nationality', e.target.value)}
              />
            </Field>
            <Field label="Compte bancaire" span={2}>
              <input
                className={input}
                value={fields.bankAccount}
                onChange={(e) => setF('bankAccount', e.target.value)}
              />
            </Field>
          </div>
        )}

        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="Prix de vente" required>
            <div className="relative">
              <input
                type="number"
                min={0}
                className={`${input} pr-10`}
                value={price || ''}
                onChange={(e) => setPrice(Number(e.target.value))}
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-600">
                Ar
              </span>
            </div>
          </Field>
          <Field label="Date de la vente" required>
            <input
              type="date"
              className={input}
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </Field>
        </div>
        <Field label="Mode de paiement">
          <Choice
            value={paymentMode}
            onChange={setPaymentMode}
            options={BUY_PAYMENT}
          />
        </Field>
        <Field label="Notes (acompte versé, échéancier, notaire…)">
          <textarea
            rows={3}
            className={input}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </Field>
        {error && <p className="text-sm text-red-600">{error}</p>}
      </div>
    </Modal>
  );
}
