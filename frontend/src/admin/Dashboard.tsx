/* ==========================================================================
   Tableau de bord — vue d'ensemble de l'activité CA IMMO.
   Lecture seule sur le cache synchronisé : aucune donnée transformée ici.
   ========================================================================== */

import {
  ArrowRight,
  CalendarCheck,
  CalendarDays,
  CheckCircle2,
  Mail,
  ShoppingBag,
  Wallet,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { formatAriary } from '../lib/format';
import { getLands, getMessages } from '../lib/store';
import { ActionLabel } from './crm/client';
import { btnOutline } from './crm/kit';
import { fullName, getBuyRequests, getLandFiles } from './crm/model';
import { refreshCache, subscribeCache } from './crm/sync';
import { Badge, Card, PageHeader, btnPrimary } from './ui';

/** Date relative courte : « aujourd'hui », « hier », « il y a 3 j ». */
function fmtRel(iso: string): string {
  const d = new Date(iso);
  const days = Math.floor((Date.now() - d.getTime()) / 86400000);
  if (days <= 0) return "aujourd'hui";
  if (days === 1) return 'hier';
  return `il y a ${days} j`;
}

/** Pastille avec les initiales du nom (couleur stable pour un même nom). */
const AVATAR_COLORS = [
  'bg-blue-50 text-blue-700',
  'bg-emerald-50 text-emerald-700',
  'bg-amber-50 text-amber-700',
  'bg-indigo-50 text-indigo-700',
];
function Avatar({ name }: { name: string }) {
  const initials = name
    .trim()
    .split(/\s+/)
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
  const color =
    AVATAR_COLORS[
      [...name].reduce((a, c) => a + c.charCodeAt(0), 0) % AVATAR_COLORS.length
    ];
  return (
    <span
      className={`grid h-9 w-9 shrink-0 place-items-center rounded-full text-xs font-bold ${color}`}
    >
      {initials}
    </span>
  );
}

export default function Dashboard() {
  /* Mise à jour auto sans F5 : le tableau de bord se re-rend à chaque resynchronisation du cache. */
  const [, setTick] = useState(0);
  useEffect(() => {
    refreshCache();
    return subscribeCache(() => setTick((t) => t + 1));
  }, []);

  const lands = getLands();
  // Les visites ont leur propre écran : ici, uniquement les demandes d'achat.
  const purchases = [...getBuyRequests()].filter(
    (r) => (r.kind ?? 'interet') !== 'visite',
  );
  const visits = getBuyRequests().filter(
    (r) => (r.kind ?? 'interet') === 'visite',
  );
  const messages = getMessages();
  const files = getLandFiles();

  const available = lands.filter((l) => l.status === 'disponible');
  const reserved = lands.filter((l) => l.status === 'réservé');
  const sold = lands.filter((l) => l.status === 'vendu');
  const stockValue = available.reduce((sum, l) => sum + l.price, 0);
  const avgPrice = available.length
    ? Math.round(stockValue / available.length)
    : 0;

  const today = new Date().toDateString();
  const todo = [
    ...purchases.flatMap((r) => r.actions),
    ...files.flatMap((f) => f.actions),
  ]
    .filter((a) => !a.done)
    .sort((a, b) => a.at.localeCompare(b.at));
  const late = todo.filter(
    (a) =>
      new Date(a.at).getTime() < Date.now() &&
      new Date(a.at).toDateString() !== today,
  );
  const dueToday = todo.filter((a) => new Date(a.at).toDateString() === today);

  const newPurchases = purchases.filter(
    (r) => (r.kind ?? 'interet') === 'interet' && r.status === 'Nouvelle',
  ).length;
  const visitsToConfirm = visits.filter((r) =>
    ['Demandée', 'Nouvelle'].includes(r.status),
  ).length;
  const unread = messages.filter((m) => m.status === 'nouveau').length;

  const stats = [
    {
      label: 'Actions en retard',
      value: late.length,
      sub: `${dueToday.length} prévue(s) aujourd'hui`,
      icon: CalendarDays,
      tint: late.length ? 'bg-red-50 text-red-700' : 'bg-slate-100 text-navy-900',
      to: '/admin/agenda?view=late',
    },
    {
      label: 'Disponibles',
      value: available.length,
      sub: `${lands.length} terrains au catalogue`,
      icon: CheckCircle2,
      tint: 'bg-emerald-50 text-emerald-700',
      to: '/admin/terrains',
    },
    {
      label: 'Achats nouveaux',
      value: newPurchases,
      sub: 'demandes à qualifier',
      icon: ShoppingBag,
      tint: 'bg-blue-50 text-blue-700',
      to: '/admin/achats?status=Nouvelle',
    },
    {
      label: 'Visites à confirmer',
      value: visitsToConfirm,
      sub: 'créneaux à rappeler',
      icon: CalendarCheck,
      tint: 'bg-amber-50 text-amber-700',
      to: '/admin/visites?status=Demand%C3%A9e',
    },
    {
      label: 'Messages non lus',
      value: unread,
      sub: `${messages.length} au total`,
      icon: Mail,
      tint: 'bg-indigo-50 text-indigo-700',
      to: '/admin/messages?status=nouveau',
    },
  ];

  // Pipeline des achats : répartition par statut (ordre du cycle de vente).
  const FLOW = [
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
  const pipeline = FLOW.map((status) => ({
    status,
    count: purchases.filter((r) => r.status === status).length,
  })).filter((s) => s.count > 0);
  const pipelineMax = Math.max(1, ...pipeline.map((s) => s.count));
  const activePurchases = purchases.filter(
    (r) => !['Achat finalisé', 'Refusée', 'Archivée'].includes(r.status),
  ).length;

  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? 'Bonjour' : hour < 18 ? 'Bon après-midi' : 'Bonsoir';
  const todayLabel = new Date().toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  return (
    <>
      <PageHeader
        title="Tableau de bord"
        subtitle={`${todayLabel} · ${activePurchases} achat(s) en cours, ${visits.length} visite(s), ${files.length} dossier(s) de vente.`}
        action={
          <>
            <Link to="/admin/agenda" className={btnOutline}>
              <CalendarDays size={15} />
              Ouvrir l’agenda
            </Link>
            <Link to="/admin/achats/nouveau" className={btnPrimary}>
              <ShoppingBag size={15} />
              Nouvelle demande
            </Link>
          </>
        }
      />
      {late.length > 0 && (
        <p className="text-sm text-red-700 border border-red-200 bg-red-50 rounded-lg p-3 mb-5">
          {late.length} action(s) en retard. <Link to="/admin/agenda?view=late" className="font-semibold underline hover:text-red-900 transition-colors">
            Voir la liste →
          </Link>
        </p>
      )}
      {/* — Cartes statistiques — */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {stats.map(({ label, value, sub, icon: Icon, tint, to }) => (
          <Link key={label} to={to} className="group">
            <Card className="p-5 h-full transition-all group-hover:border-slate-400">
              <div className="flex items-start justify-between">
                <span
                  className={`grid h-10 w-10 place-items-center rounded-xl ${tint}`}
                >
                  <Icon className="w-5 h-5" />
                </span>
                <ArrowRight className="w-4 h-4 text-gray-300 group-hover:text-navy-800 transition-colors" />
              </div>
              <p className="mt-3 text-3xl font-bold text-navy-900">{value}</p>
              <p className="text-sm font-medium text-gray-600">{label}</p>
              <p className="text-xs text-gray-600 mt-0.5">{sub}</p>
            </Card>
          </Link>
        ))}
      </div>

      {/* — Pipeline + Catalogue — */}
      <div className="grid lg:grid-cols-3 gap-4 mt-4">
        <Card className="p-5 lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold font-display">Pipeline des achats</h2>
            <Link
              to="/admin/achats"
              className="text-xs font-semibold text-navy-800 hover:underline"
            >
              Voir tout →
            </Link>
          </div>
          {pipeline.length === 0 && (
            <p className="text-sm text-gray-500">
              Aucune demande d'achat pour l'instant.
            </p>
          )}
          <div className="space-y-2.5">
            {pipeline.map(({ status, count }) => (
              <Link
                key={status}
                to="/admin/achats"
                className="flex items-center gap-3 group"
              >
                <span className="w-36 shrink-0 text-xs text-gray-600 group-hover:text-navy-900 truncate">
                  {status}
                </span>
                <span className="flex-1 h-6 bg-gray-100 rounded-md overflow-hidden">
                  <span
                    className={`block h-full rounded-md ${['Achat finalisé', 'Validée'].includes(status) ? 'bg-emerald-500' : ['À contacter', 'Contacté', 'En étude', 'Proposition envoyée', 'Visite programmée', 'Négociation'].includes(status) ? 'bg-amber-400' : status === 'Nouvelle' ? 'bg-blue-500' : 'bg-navy-900/75'}`}
                    style={{
                      width: `${Math.max(8, (count / pipelineMax) * 100)}%`,
                    }}
                  />
                </span>
                <span className="w-8 text-right text-sm font-bold text-navy-900">
                  {count}
                </span>
              </Link>
            ))}
          </div>
        </Card>

        <Card className="p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold font-display">Catalogue</h2>
            <Link
              to="/admin/terrains"
              className="text-xs font-semibold text-navy-800 hover:underline"
            >
              Gérer →
            </Link>
          </div>
          <p className="text-xs text-gray-500">
            Valeur des terrains disponibles
          </p>
          <p className="text-2xl font-bold text-navy-900 mt-1">
            {formatAriary(stockValue)}
          </p>
          <p className="text-xs text-gray-600 mt-1">
            prix moyen : {formatAriary(avgPrice)}
          </p>
          <div className="mt-4 space-y-2 text-sm">
            <p className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />{' '}
              Disponibles{' '}
              <span className="ml-auto font-semibold text-navy-900">
                {available.length}
              </span>
            </p>
            <p className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />{' '}
              Réservés{' '}
              <span className="ml-auto font-semibold text-navy-900">
                {reserved.length}
              </span>
            </p>
            <p className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-gray-400" /> Vendus{' '}
              <span className="ml-auto font-semibold text-navy-900">
                {sold.length}
              </span>
            </p>
          </div>
        </Card>
      </div>

      {/* — Demandes, actions, messages — */}
      <div className="grid lg:grid-cols-3 gap-4 mt-4">
        <Card className="p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold font-display">
              Dernières demandes d'achat
            </h2>
            <Link
              to="/admin/achats"
              className="text-xs font-semibold text-navy-800 hover:underline"
            >
              Voir tout →
            </Link>
          </div>
          {purchases.length === 0 && (
            <p className="text-sm text-gray-500">
              Aucune demande pour l'instant.
            </p>
          )}
          <ul className="divide-y divide-gray-100 -mx-2">
            {purchases.slice(0, 5).map((r) => (
              <li key={r.id}>
                <Link
                  to={`/admin/achats/${r.id}`}
                  className="flex items-center gap-3 py-2.5 px-2 rounded-lg hover:bg-slate-50 transition-colors"
                >
                  <Avatar name={fullName(r)} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-navy-900">
                      {fullName(r)}
                    </span>
                    <span className="block text-xs text-gray-600">
                      {r.ref} · {fmtRel(r.createdAt)}
                    </span>
                  </span>
                  <Badge value={r.status} />
                </Link>
              </li>
            ))}
          </ul>
        </Card>

        <Card className="p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold font-display">À faire</h2>
            <Link
              to="/admin/agenda"
              className="text-xs font-semibold text-navy-800 hover:underline"
            >
              Agenda →
            </Link>
          </div>
          {todo.length === 0 && (
            <p className="text-sm text-gray-500">
              Aucune action en attente. 🎉
            </p>
          )}
          <ul className="space-y-2.5">
            {todo.slice(0, 4).map((a) => (
              <li key={a.id} className="text-sm">
                <ActionLabel a={a} />
                {a.note && (
                  <p className="text-xs text-gray-600 truncate ml-5">
                    {a.note}
                  </p>
                )}
              </li>
            ))}
          </ul>
          {todo.length > 4 && (
            <p className="text-xs text-gray-600 mt-3">
              + {todo.length - 4} autre(s) action(s)
            </p>
          )}
        </Card>

        <Card className="p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold font-display">Derniers messages</h2>
            <Link
              to="/admin/messages"
              className="text-xs font-semibold text-navy-800 hover:underline"
            >
              Voir tout →
            </Link>
          </div>
          {messages.length === 0 && (
            <p className="text-sm text-gray-500">
              Aucun message pour l'instant.
            </p>
          )}
          <ul className="divide-y divide-gray-100 -mx-2">
            {messages.slice(0, 5).map((m) => (
              <li key={m.id}>
                <Link
                  to={`/admin/messages/${m.id}`}
                  className="flex items-center gap-3 py-2.5 px-2 rounded-lg hover:bg-slate-50 transition-colors"
                >
                  <Avatar name={`${m.firstName} ${m.lastName}`} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-navy-900">
                      {m.firstName} {m.lastName}
                    </span>
                    <span className="block text-xs text-gray-600 truncate">
                      {m.subject || m.message}
                    </span>
                  </span>
                  {m.status === 'nouveau' && (
                    <span
                      className="shrink-0 h-2 w-2 rounded-full bg-blue-600"
                      aria-label="non traité"
                    />
                  )}
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      {/* — Rappel discret : valeur du stock — */}
      <p className="mt-4 flex items-center justify-center gap-2 text-xs text-gray-600">
        <Wallet className="w-3.5 h-3.5" />
        Valeur du stock disponible : {formatAriary(stockValue)} ·{' '}
        {available.length} terrain(s)
      </p>
    </>
  );
}
