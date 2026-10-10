// Agenda : toutes les actions planifiées (visites, appels, rendez-vous…) des demandes d'achat
// et des terrains à vendre, regroupées par jour.
import {
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  Eye,
  LayoutList,
  Mail,
  MessageCircle,
  MoreHorizontal,
  Move,
  PenLine,
  Phone,
  Plus,
  Repeat,
  Search,
  User,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { formatTime } from '../lib/format';
import { phoneHref } from '../lib/phone';
import { getLands } from '../lib/store';
import { CompleteDialog, PlanDialog } from './crm/client';
import {
  Field,
  Modal,
  PageHeader,
  Select,
  Stat,
  btnIcon,
  btnOutline,
  btnPrimary,
  fmtDateTime,
  input,
} from './crm/kit';
import {
  ACTION_TYPES,
  ActionType,
  BuyRequest,
  LandFile,
  PlannedAction,
  fullName,
  getBuyRequests,
  getLandFiles,
  historyEntry,
  phoneOf,
  saveBuyRequest,
  saveLandFile,
} from './crm/model';
import { refreshCache, subscribeCache } from './crm/sync';

const ICONS: Record<ActionType, typeof Phone> = {
  Appel: Phone,
  'Rendez-vous': CalendarDays,
  'Visite du terrain': Eye,
  Email: Mail,
  'WhatsApp / SMS': MessageCircle,
  Relance: Repeat,
  Signature: PenLine,
  Autre: MoreHorizontal,
};

type Item = {
  action: PlannedAction;
  kind: 'achat' | 'vente';
  dossierId: string;
  ref: string;
  who: string;
  phone: string;
  what: string;
  link: string;
};

function collect(): Item[] {
  const lands = getLands();
  const buy = getBuyRequests().flatMap((r: BuyRequest) => {
    const land = lands.find((l) => l.id === r.landId);
    const lot = land?.lots?.find((l) => l.id === r.lotId);
    return r.actions.map((action) => ({
      action,
      kind: 'achat' as const,
      dossierId: r.id,
      ref: r.ref,
      who: fullName(r),
      phone: phoneOf(r),
      what: land
        ? `${land.title}${lot ? ` — ${lot.number}` : ''}`
        : 'Terrain non rattaché',
      link: `/admin/achats/${r.id}`,
    }));
  });
  const sell = getLandFiles().flatMap((f: LandFile) =>
    f.actions.map((action) => ({
      action,
      kind: 'vente' as const,
      dossierId: f.id,
      ref: f.ref,
      who: `${f.owner.firstName} ${f.owner.lastName}`.trim(),
      phone: phoneOf(f.owner),
      what: f.title || 'Terrain à vendre',
      link: `/admin/dossiers-terrains/${f.id}`,
    })),
  );
  return [...buy, ...sell];
}

const dayKey = (iso: string) => {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const todayKey = () => dayKey(new Date().toISOString());

function dayLabel(key: string) {
  const today = todayKey();
  const tomorrow = dayKey(new Date(Date.now() + 86400000).toISOString());
  const yesterday = dayKey(new Date(Date.now() - 86400000).toISOString());
  const d = new Date(`${key}T12:00:00`);
  const long = d.toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
  if (key === today) return `Aujourd’hui · ${long}`;
  if (key === tomorrow) return `Demain · ${long}`;
  if (key === yesterday) return `Hier · ${long}`;
  return long.charAt(0).toUpperCase() + long.slice(1);
}

type View = 'upcoming' | 'late' | 'done';

export default function Agenda() {
  const [version, setVersion] = useState(0);
  const items = useMemo(collect, [version]);
  useEffect(() => {
    refreshCache().then(() => setVersion((v) => v + 1));
    return subscribeCache(() => setVersion((v) => v + 1));
  }, []); // mise à jour auto sans F5
  const [view, setView] = useState<View>('upcoming');
  const [mode, setModeState] = useState<'calendar' | 'list'>(() => {
    try {
      return localStorage.getItem('caimmo.agenda.mode') === 'list'
        ? 'list'
        : 'calendar';
    } catch {
      return 'calendar';
    }
  });
  const setMode = (m: 'calendar' | 'list') => {
    setModeState(m);
    try {
      localStorage.setItem('caimmo.agenda.mode', m);
    } catch {
      /* préférence non enregistrée */
    }
  };
  const [type, setType] = useState('');
  const [kind, setKind] = useState('');
  const [q, setQ] = useState('');
  const [completing, setCompleting] = useState<Item | null>(null);
  const [following, setFollowing] = useState<Item | null>(null);

  const now = Date.now();
  const isLate = (i: Item) =>
    !i.action.done && new Date(i.action.at).getTime() < now;
  const today = todayKey();

  const filtered = items
    .filter((i) => !type || i.action.type === type)
    .filter(
      (i) => !kind || i.kind === (kind === 'Acheteurs' ? 'achat' : 'vente'),
    )
    .filter((i) => {
      const s = q.trim().toLowerCase();
      return (
        !s ||
        [i.who, i.phone, i.what, i.ref, i.action.note]
          .join(' ')
          .toLowerCase()
          .includes(s)
      );
    });
  const shown = filtered
    .filter((i) =>
      view === 'done'
        ? i.action.done
        : view === 'late'
          ? isLate(i)
          : !i.action.done && !isLate(i),
    )
    .sort((a, b) =>
      view === 'done'
        ? (b.action.doneAt ?? b.action.at).localeCompare(
            a.action.doneAt ?? a.action.at,
          )
        : a.action.at.localeCompare(b.action.at),
    );

  const groups = shown.reduce<Record<string, Item[]>>((g, i) => {
    const k = dayKey(
      view === 'done' ? (i.action.doneAt ?? i.action.at) : i.action.at,
    );
    (g[k] ??= []).push(i);
    return g;
  }, {});

  // Enregistre une modification d'action dans le bon dossier, avec une ligne d'historique
  const updateAction = (
    i: Pick<Item, 'kind' | 'dossierId'>,
    next: (a: PlannedAction[]) => PlannedAction[],
    log: string,
    statusIfNew?: boolean,
  ) => {
    if (i.kind === 'achat') {
      const r = getBuyRequests().find((x) => x.id === i.dossierId);
      if (!r) return;
      const status =
        statusIfNew && (r.status === 'Nouvelle' || r.status === 'À contacter')
          ? 'Contacté'
          : r.status;
      saveBuyRequest({
        ...r,
        status,
        actions: next(r.actions),
        history: [...r.history, historyEntry(log)],
      });
    } else {
      const f = getLandFiles().find((x) => x.id === i.dossierId);
      if (!f) return;
      saveLandFile({
        ...f,
        actions: next(f.actions),
        history: [...f.history, historyEntry(log)],
      });
    }
    setVersion((v) => v + 1);
  };

  const complete = (i: Item, result: string, followUp: boolean) => {
    updateAction(
      i,
      (list) =>
        list.map((a) =>
          a.id === i.action.id
            ? { ...a, done: true, doneAt: new Date().toISOString(), result }
            : a,
        ),
      `${i.action.type} effectué(e) : ${result}`,
      true,
    );
    setCompleting(null);
    if (followUp) setFollowing(i);
  };
  const move = (i: Item, at: string) => {
    if (at === i.action.at) return;
    updateAction(
      i,
      (list) => list.map((a) => (a.id === i.action.id ? { ...a, at } : a)),
      `${i.action.type} déplacé(e) du ${fmtDateTime(i.action.at)} au ${fmtDateTime(at)}`,
    );
  };
  const plan = (i: Pick<Item, 'kind' | 'dossierId'>, a: PlannedAction) => {
    updateAction(
      i,
      (list) => [...list, a],
      a.done
        ? `${a.type} effectué(e) le ${fmtDateTime(a.at)} : ${a.result}`
        : `${a.type} planifié(e) le ${fmtDateTime(a.at)}${a.note ? ` — ${a.note}` : ''}`,
    );
    setFollowing(null);
  };

  const count = (v: View) =>
    items.filter((i) =>
      v === 'done'
        ? i.action.done
        : v === 'late'
          ? isLate(i)
          : !i.action.done && !isLate(i),
    ).length;

  return (
    <>
      <PageHeader
        title="Agenda"
        subtitle="Visites, appels et rendez-vous planifiés avec les clients et les propriétaires."
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        <Stat
          label="Aujourd’hui"
          value={
            items.filter((i) => !i.action.done && dayKey(i.action.at) === today)
              .length
          }
          tone="text-amber-600"
        />
        <Stat
          label="Visites à venir"
          value={
            items.filter(
              (i) =>
                !i.action.done &&
                !isLate(i) &&
                i.action.type === 'Visite du terrain',
            ).length
          }
        />
        <Stat label="En retard" value={count('late')} tone="text-red-600" />
        <Stat label="Effectuées" value={count('done')} tone="text-blue-700" />
      </div>

      <div className="bg-white rounded-lg border border-slate-200 p-4 mb-5 space-y-3">
        <div className="flex flex-wrap items-center gap-1">
          <div className="inline-flex rounded-lg border border-gray-200 p-0.5 mr-2">
            <button
              onClick={() => setMode('calendar')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium ${mode === 'calendar' ? 'bg-navy-900 text-white' : 'text-gray-600 hover:bg-gray-100'}`}
            >
              <CalendarDays className="w-4 h-4" /> Calendrier
            </button>
            <button
              onClick={() => setMode('list')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium ${mode === 'list' ? 'bg-navy-900 text-white' : 'text-gray-600 hover:bg-gray-100'}`}
            >
              <LayoutList className="w-4 h-4" /> Liste
            </button>
          </div>
          {mode === 'list' &&
            (
              [
                ['upcoming', 'À venir'],
                ['late', 'En retard'],
                ['done', 'Effectuées'],
              ] as const
            ).map(([v, label]) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${view === v ? (v === 'late' ? 'bg-red-600 text-white' : 'bg-navy-900 text-white') : 'text-gray-600 hover:bg-gray-100'}`}
              >
                {label} ({count(v)})
              </button>
            ))}
        </div>
        <div className="grid sm:grid-cols-3 gap-2">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-600" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Client, téléphone, terrain…"
              className={`${input} pl-9`}
            />
          </div>
          <Select
            value={type}
            onChange={setType}
            options={ACTION_TYPES}
            placeholder="Tous les types"
          />
          <Select
            value={kind}
            onChange={setKind}
            options={['Acheteurs', 'Vendeurs']}
            placeholder="Acheteurs et vendeurs"
          />
        </div>
      </div>

      {mode === 'calendar' && (
        <CalendarView
          items={filtered}
          isLate={isLate}
          onComplete={setCompleting}
          onPlan={(target, a) => plan(target, a)}
          onMove={move}
        />
      )}

      {mode === 'list' && (
        <>
          {!shown.length && (
            <div className="bg-white rounded-2xl border border-gray-200 p-10 text-center text-gray-600">
              {view === 'late'
                ? 'Aucune action en retard.'
                : view === 'done'
                  ? 'Aucune action effectuée.'
                  : 'Aucune action à venir. Planifiez-en depuis un dossier (demande d’achat ou terrain à vendre).'}
            </div>
          )}

          <div className="space-y-6">
            {Object.entries(groups).map(([key, list]) => (
              <section key={key}>
                <h2
                  className={`text-sm font-semibold mb-2 ${key === today ? 'text-amber-600' : view === 'late' ? 'text-red-600' : 'text-navy-900'}`}
                >
                  {dayLabel(key)}{' '}
                  <span className="text-gray-600 font-normal">
                    · {list.length}
                  </span>
                </h2>
                <ul className="bg-white rounded-2xl border border-gray-200 shadow-sm divide-y divide-gray-100">
                  {list.map((i) => {
                    const Icon = ICONS[i.action.type];
                    const late = isLate(i);
                    return (
                      <li
                        key={i.action.id}
                        className="p-4 flex flex-col sm:flex-row sm:items-center gap-3"
                      >
                        <div className="flex items-center gap-3 sm:w-40 shrink-0">
                          <span
                            className={`w-9 h-9 rounded-full flex items-center justify-center ${i.action.done ? 'bg-blue-100 text-blue-700' : late ? 'bg-red-600 text-white' : 'bg-navy-900 text-white'}`}
                          >
                            <Icon className="w-4 h-4" />
                          </span>
                          <div>
                            <p
                              className={`text-sm font-semibold flex items-center gap-1 ${late ? 'text-red-600' : 'text-navy-900'}`}
                            >
                              <Clock className="w-3.5 h-3.5" />{' '}
                              {formatTime(
                                i.action.done
                                  ? (i.action.doneAt ?? i.action.at)
                                  : i.action.at,
                              )}
                            </p>
                            <p className="text-xs text-gray-500">
                              {i.action.type}
                            </p>
                          </div>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm">
                            <span className="font-semibold text-navy-900">
                              {i.who || '—'}
                            </span>
                            <span
                              className={`ml-2 text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded ${i.kind === 'achat' ? 'bg-gold-400/20 text-navy-900' : 'bg-navy-900/10 text-navy-900'}`}
                            >
                              {i.kind === 'achat' ? 'Acheteur' : 'Vendeur'}
                            </span>
                          </p>
                          <p className="text-sm text-gray-600 truncate">
                            {i.what}
                          </p>
                          {i.action.note && (
                            <p className="text-xs text-gray-500 mt-0.5">
                              {i.action.note}
                            </p>
                          )}
                          {i.action.done && i.action.result && (
                            <p className="text-sm mt-1 bg-gray-50 rounded-lg px-3 py-2">
                              {i.action.result}
                            </p>
                          )}
                          {late && (
                            <p className="text-xs text-red-600 font-semibold mt-0.5">
                              Prévue le {fmtDateTime(i.action.at)}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-1 sm:justify-end">
                          {i.phone && (
                            <a
                              href={phoneHref(i.phone)}
                              className={btnIcon}
                              title={`Appeler ${i.phone}`}
                            >
                              <Phone className="w-4 h-4" />
                            </a>
                          )}
                          <Link
                            to={i.link}
                            className={btnIcon}
                            title={`Ouvrir le dossier ${i.ref}`}
                          >
                            <User className="w-4 h-4" />
                          </Link>
                          {!i.action.done && (
                            <button
                              className={`${btnPrimary} py-1.5`}
                              onClick={() => setCompleting(i)}
                            >
                              <Check className="w-4 h-4" /> Fait
                            </button>
                          )}
                          {i.action.done && (
                            <Link
                              to={i.link}
                              className="text-xs text-gold-700 inline-flex items-center"
                            >
                              Dossier <ChevronRight className="w-3 h-3" />
                            </Link>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </section>
            ))}
          </div>
        </>
      )}

      {completing && (
        <CompleteDialog
          action={completing.action}
          onClose={() => setCompleting(null)}
          onSave={(res, f) => complete(completing, res, f)}
        />
      )}
      {following && (
        <PlanDialog
          onClose={() => setFollowing(null)}
          onSave={(a) => plan(following, a)}
        />
      )}
    </>
  );
}

// ======================= VUE CALENDRIER =======================
const WEEKDAYS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];

type Target = Pick<Item, 'kind' | 'dossierId'>;

function CalendarView({
  items,
  isLate,
  onComplete,
  onPlan,
  onMove,
}: {
  items: Item[];
  isLate: (i: Item) => boolean;
  onComplete: (i: Item) => void;
  onPlan: (t: Target, a: PlannedAction) => void;
  onMove: (i: Item, at: string) => void;
}) {
  const [dragId, setDragId] = useState<string | null>(null); // action en cours de glisser-déposer
  const [dropDay, setDropDay] = useState<string | null>(null);
  const [moving, setMoving] = useState<Item | null>(null);
  // Garde l'heure de l'action et change seulement le jour
  const toDay = (i: Item, key: string) => {
    const d = new Date(i.action.at);
    const [y, m, dd] = key.split('-').map(Number);
    return new Date(y, m - 1, dd, d.getHours(), d.getMinutes()).toISOString();
  };
  const [planning, setPlanning] = useState<string | null>(null); // jour AAAA-MM-JJ en cours de planification
  const [month, setMonth] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const [selected, setSelected] = useState(todayKey());
  const today = todayKey();

  const byDay = items.reduce<Record<string, Item[]>>((g, i) => {
    (g[dayKey(i.action.at)] ??= []).push(i);
    return g;
  }, {});
  Object.values(byDay).forEach((l) =>
    l.sort((a, b) => a.action.at.localeCompare(b.action.at)),
  );

  // Grille du lundi au dimanche, 6 semaines au plus
  const first = new Date(month);
  const offset = (first.getDay() + 6) % 7;
  const start = new Date(first.getFullYear(), first.getMonth(), 1 - offset);
  const weeks = Math.ceil(
    (offset +
      new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate()) /
      7,
  );
  const days = Array.from(
    { length: weeks * 7 },
    (_, n) =>
      new Date(start.getFullYear(), start.getMonth(), start.getDate() + n),
  );

  const chipClass = (i: Item) =>
    i.action.done
      ? 'bg-blue-50 text-blue-700 line-through decoration-blue-300'
      : isLate(i)
        ? 'bg-red-100 text-red-700'
        : i.action.type === 'Visite du terrain'
          ? 'bg-gold-400/30 text-navy-900'
          : 'bg-navy-900/10 text-navy-900';
  const move = (n: number) =>
    setMonth(new Date(month.getFullYear(), month.getMonth() + n, 1));
  const goToday = () => {
    const d = new Date();
    setMonth(new Date(d.getFullYear(), d.getMonth(), 1));
    setSelected(today);
  };
  const dayItems = byDay[selected] ?? [];

  return (
    <div className="grid xl:grid-cols-[1fr_340px] gap-5">
      <div className="admin-calendar bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="admin-calendar-heading flex items-center justify-between gap-2 px-4 py-3 border-b">
          <h2 className="font-semibold text-navy-900 capitalize">
            {month.toLocaleDateString('fr-FR', {
              month: 'long',
              year: 'numeric',
            })}
          </h2>
          <div className="flex items-center gap-1">
            <button
              className={btnIcon}
              onClick={() => move(-1)}
              aria-label="Mois précédent"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              className="px-3 py-1.5 rounded-lg text-sm font-medium border border-gray-200 hover:bg-gray-50"
              onClick={goToday}
            >
              Aujourd’hui
            </button>
            <button
              className={btnIcon}
              onClick={() => move(1)}
              aria-label="Mois suivant"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
        <div className="admin-calendar-weekdays grid grid-cols-7 bg-gray-50 border-b text-center text-xs font-medium text-gray-500">
          {WEEKDAYS.map((d) => (
            <div key={d} className="py-2">
              {d}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {days.map((d) => {
            const key = dayKey(d.toISOString());
            const inMonth = d.getMonth() === month.getMonth();
            const list = byDay[key] ?? [];
            const isSel = key === selected;
            return (
              <div
                key={key}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') setSelected(key);
                }}
                onClick={() => setSelected(key)}
                onDoubleClick={() => {
                  setSelected(key);
                  setPlanning(key);
                }}
                onDragOver={(e) => {
                  if (dragId) {
                    e.preventDefault();
                    setDropDay(key);
                  }
                }}
                onDragLeave={() => setDropDay((d) => (d === key ? null : d))}
                onDrop={(e) => {
                  e.preventDefault();
                  const it = items.find((x) => x.action.id === dragId);
                  if (it) {
                    onMove(it, toDay(it, key));
                    setSelected(key);
                  }
                  setDragId(null);
                  setDropDay(null);
                }}
                data-calendar-selected={isSel}
                data-calendar-weekend={d.getDay() === 0 || d.getDay() === 6}
                data-calendar-in-month={inMonth}
                title="Double-cliquez pour planifier ce jour"
                className={`group relative cursor-pointer min-h-[64px] sm:min-h-[104px] p-1 sm:p-1.5 text-left border-b border-r border-gray-100 align-top transition-colors ${inMonth ? 'bg-white' : 'bg-gray-50/70'} ${dropDay === key ? 'bg-gold-400/25 ring-2 ring-inset ring-gold-500' : isSel ? 'ring-2 ring-inset ring-gold-500' : 'hover:bg-gold-400/5'}`}
              >
                <span
                  role="button"
                  tabIndex={-1}
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelected(key);
                    setPlanning(key);
                  }}
                  className="absolute right-1 top-1 hidden sm:group-hover:flex w-5 h-5 items-center justify-center rounded-full bg-navy-900 text-white text-sm leading-none"
                  aria-label="Planifier ce jour"
                >
                  +
                </span>
                <span
                  className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs ${key === today ? 'bg-navy-900 text-white font-bold' : inMonth ? 'text-navy-900' : 'text-gray-300'}`}
                >
                  {d.getDate()}
                </span>
                {/* Téléphone : pastilles ; écran large : étiquettes */}
                <div className="flex flex-wrap gap-0.5 mt-1 sm:hidden">
                  {list.slice(0, 4).map((i) => (
                    <span
                      key={i.action.id}
                      className={`w-1.5 h-1.5 rounded-full ${i.action.done ? 'bg-blue-400' : isLate(i) ? 'bg-red-500' : 'bg-gold-500'}`}
                    />
                  ))}
                </div>
                <div className="hidden sm:block space-y-0.5 mt-0.5">
                  {list.slice(0, 3).map((i) => (
                    <span
                      key={i.action.id}
                      draggable={!i.action.done}
                      onDragStart={(e) => {
                        setDragId(i.action.id);
                        e.dataTransfer.effectAllowed = 'move';
                        e.dataTransfer.setData('text/plain', i.action.id);
                      }}
                      onDragEnd={() => {
                        setDragId(null);
                        setDropDay(null);
                      }}
                      title={
                        i.action.done
                          ? `${i.action.type} · ${i.who}`
                          : 'Glissez pour déplacer'
                      }
                      className={`block truncate rounded px-1 py-0.5 text-[11px] leading-tight ${chipClass(i)} ${i.action.done ? '' : 'cursor-grab active:cursor-grabbing'} ${dragId === i.action.id ? 'opacity-40' : ''}`}
                    >
                      {formatTime(i.action.at)}{' '}
                      {i.action.type === 'Visite du terrain'
                        ? 'Visite'
                        : i.action.type}{' '}
                      · {i.who}
                    </span>
                  ))}
                  {list.length > 3 && (
                    <span className="block text-[11px] text-gray-500 px-1">
                      + {list.length - 3} autre(s)
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-1 px-4 py-3 border-t text-xs text-gray-500">
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-gold-400/30" /> Visite
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-navy-900/10" /> Appel,
            rendez-vous…
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-red-100" /> En retard
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-blue-50" /> Effectuée
          </span>
          <span className="hidden sm:flex items-center gap-1.5 ml-auto">
            <Move className="w-3 h-3" /> Glissez une tâche vers un autre jour
            pour la déplacer
          </span>
        </div>
      </div>

      {/* Détail du jour sélectionné */}
      <aside className="bg-white rounded-2xl border border-gray-200 shadow-sm h-fit xl:sticky xl:top-4">
        <div className="admin-calendar-heading flex items-center justify-between gap-2 px-4 py-3 border-b">
          <h3
            className={`font-semibold ${selected === today ? 'text-amber-600' : 'text-navy-900'}`}
          >
            {dayLabel(selected)}{' '}
            <span className="text-gray-600 font-normal">
              · {dayItems.length}
            </span>
          </h3>
          <button
            className={`${btnPrimary} bg-navy-900 text-white hover:bg-gold-400 py-1.5 shrink-0`}
            onClick={() => setPlanning(selected)}
          >
            <Plus className="w-4 h-4" /> Planifier
          </button>
        </div>
        {!dayItems.length && (
          <p className="p-4 text-sm text-gray-600">Rien de prévu ce jour-là.</p>
        )}
        <ul className="divide-y divide-gray-100">
          {dayItems.map((i) => {
            const Icon = ICONS[i.action.type];
            const late = isLate(i);
            return (
              <li key={i.action.id} className="p-4">
                <div className="flex items-start gap-3">
                  <span
                    className={`shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${i.action.done ? 'bg-blue-100 text-blue-700' : late ? 'bg-red-600 text-white' : 'bg-navy-900 text-white'}`}
                  >
                    <Icon className="w-4 h-4" />
                  </span>
                  <div className="flex-1 min-w-0">
                    <p
                      className={`text-sm font-semibold ${late ? 'text-red-600' : 'text-navy-900'}`}
                    >
                      {formatTime(i.action.at)} · {i.action.type}
                    </p>
                    <p className="text-sm">
                      {i.who}
                      <span
                        className={`ml-1.5 text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded ${i.kind === 'achat' ? 'bg-gold-400/20' : 'bg-navy-900/10'}`}
                      >
                        {i.kind === 'achat' ? 'Acheteur' : 'Vendeur'}
                      </span>
                    </p>
                    <p className="text-xs text-gray-500 truncate">{i.what}</p>
                    {i.action.note && (
                      <p className="text-xs text-gray-600 mt-1">
                        {i.action.note}
                      </p>
                    )}
                    {i.action.done && i.action.result && (
                      <p className="text-xs mt-1 bg-gray-50 rounded px-2 py-1">
                        {i.action.result}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-center justify-end gap-1 mt-2">
                  {i.phone && (
                    <a
                      href={phoneHref(i.phone)}
                      className={btnIcon}
                      title={`Appeler ${i.phone}`}
                    >
                      <Phone className="w-4 h-4" />
                    </a>
                  )}
                  <Link
                    to={i.link}
                    className={btnIcon}
                    title={`Ouvrir le dossier ${i.ref}`}
                  >
                    <User className="w-4 h-4" />
                  </Link>
                  {!i.action.done && (
                    <button
                      className={btnIcon}
                      onClick={() => setMoving(i)}
                      title="Déplacer (changer la date ou l’heure)"
                    >
                      <Move className="w-4 h-4" />
                    </button>
                  )}
                  {!i.action.done && (
                    <button
                      className={`${btnPrimary} py-1.5`}
                      onClick={() => onComplete(i)}
                    >
                      <Check className="w-4 h-4" /> Fait
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </aside>
      {moving && (
        <MoveDialog
          item={moving}
          onClose={() => setMoving(null)}
          onSave={(at) => {
            onMove(moving, at);
            setSelected(dayKey(at));
            setMoving(null);
          }}
        />
      )}
      {planning && (
        <PlanOnDay
          day={planning}
          onClose={() => setPlanning(null)}
          onSave={(t, a) => {
            onPlan(t, a);
            setPlanning(null);
            setSelected(dayKey(a.at));
          }}
        />
      )}
    </div>
  );
}

/** Planifier depuis le calendrier : on choisit d'abord le dossier (acheteur ou vendeur). */
function PlanOnDay({
  day,
  onClose,
  onSave,
}: {
  day: string;
  onClose: () => void;
  onSave: (t: Target, a: PlannedAction) => void;
}) {
  const lands = getLands();
  const buyers = getBuyRequests().filter(
    (r) => !['Achat finalisé', 'Refusée', 'Archivée'].includes(r.status),
  );
  const sellers = getLandFiles().filter((f) => f.status !== 'Archivé');
  const [target, setTarget] = useState('');
  const [kind, dossierId] = target.split(':') as ['achat' | 'vente', string];
  const isPast = day < todayKey();
  return (
    <PlanDialog
      defaultDate={day}
      defaultTime={isPast ? '09:00' : '10:00'}
      canSave={Boolean(target)}
      onClose={onClose}
      onSave={(a) => onSave({ kind, dossierId }, a)}
      header={
        <label className="block">
          <span className="block text-xs font-medium text-gray-600 mb-1.5">
            Avec qui ? <span className="text-red-500">*</span>
          </span>
          <select
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            className={input}
          >
            <option value="">— Choisir un client ou un propriétaire —</option>
            <optgroup label="Acheteurs (demandes d’achat)">
              {buyers.map((r) => {
                const land = lands.find((l) => l.id === r.landId);
                return (
                  <option key={r.id} value={`achat:${r.id}`}>
                    {fullName(r)} · {land?.title ?? 'terrain ?'} ({r.ref})
                  </option>
                );
              })}
            </optgroup>
            <optgroup label="Vendeurs (terrains à vendre)">
              {sellers.map((f) => (
                <option key={f.id} value={`vente:${f.id}`}>
                  {f.owner.firstName} {f.owner.lastName} ·{' '}
                  {f.title || 'terrain'} ({f.ref})
                </option>
              ))}
            </optgroup>
          </select>
          {isPast && (
            <span className="block text-xs text-amber-600 mt-1">
              Jour passé : cochez « Action déjà effectuée » pour inscrire un
              compte rendu.
            </span>
          )}
        </label>
      }
    />
  );
}

/** Déplacer une tâche en choisissant une nouvelle date et une nouvelle heure (utile sur téléphone). */
function MoveDialog({
  item,
  onClose,
  onSave,
}: {
  item: Item;
  onClose: () => void;
  onSave: (at: string) => void;
}) {
  const d = new Date(item.action.at);
  const [date, setDate] = useState(dayKey(item.action.at));
  const [time, setTime] = useState(
    `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`,
  );
  return (
    <Modal
      title={`Déplacer : ${item.action.type} · ${item.who}`}
      onClose={onClose}
      footer={
        <>
          <button className={btnOutline} onClick={onClose}>
            Annuler
          </button>
          <button
            className={btnPrimary}
            disabled={!date || !time}
            onClick={() => onSave(new Date(`${date}T${time}`).toISOString())}
          >
            Déplacer
          </button>
        </>
      }
    >
      <p className="text-sm text-gray-500">
        Actuellement prévu le {fmtDateTime(item.action.at)}
      </p>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Nouvelle date" required>
          <input
            type="date"
            className={input}
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </Field>
        <Field label="Nouvelle heure" required>
          <input
            type="time"
            className={input}
            value={time}
            onChange={(e) => setTime(e.target.value)}
          />
        </Field>
      </div>
    </Modal>
  );
}
