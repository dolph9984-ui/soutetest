import {
  CalendarCheck,
  CalendarDays,
  ChevronRight,
  Compass,
  ExternalLink,
  Hammer,
  LayoutDashboard,
  Lock,
  LogOut,
  Mail,
  Map,
  Menu,
  RotateCcw,
  ShoppingBag,
  Tag,
  Users,
  X,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import {
  NavLink,
  Navigate,
  Outlet,
  useLocation,
  useNavigate,
} from 'react-router-dom';
import { isAuthenticated, login, logout } from '../lib/store';
import {
  ApiError,
  bootstrap,
  ensurePreviewSession,
  restorePreviewApi,
} from '../services/adminService';
import './admin.css';
import { DialogHost, askConfirm, notice } from './crm/dialog';
import {
  getRefreshError,
  hydrate,
  isHydrated,
  refreshCache,
  resetCache,
  subscribeSyncState,
} from './crm/sync';
import { IS_ADMIN_PREVIEW } from './preview';
import { clearRecordViewState } from './records';
import { btnPrimary, inputClass } from './ui';

const links = [
  {
    to: '/admin',
    label: 'Tableau de bord',
    icon: LayoutDashboard,
    end: true,
    group: 'Vue d’ensemble',
  },
  { to: '/admin/agenda', label: 'Agenda', icon: CalendarDays, group: '' },
  {
    to: '/admin/clients',
    label: 'Base clients',
    icon: Users,
    group: 'Relations clients',
  },
  {
    to: '/admin/achats',
    label: 'Demandes d’achat',
    icon: ShoppingBag,
    group: '',
  },
  { to: '/admin/visites', label: 'Visites', icon: CalendarCheck, group: '' },
  { to: '/admin/recherches', label: 'Recherches', icon: Compass, group: '' },
  {
    to: '/admin/dossiers-terrains',
    label: 'Demandes de vente',
    icon: Tag,
    group: 'Biens & publications',
  },
  { to: '/admin/terrains', label: 'Catalogue du site', icon: Map, group: '' },
  { to: '/admin/realisations', label: 'Réalisations', icon: Hammer, group: '' },
  {
    to: '/admin/messages',
    label: 'Messages',
    icon: Mail,
    group: 'Communication',
  },
];

export default function AdminLayout() {
  const navigate = useNavigate(),
    location = useLocation();
  const [open, setOpen] = useState(false),
    [ready, setReady] = useState(isHydrated()),
    [restoring, setRestoring] = useState(false);
  const [loadError, setLoadError] = useState(''),
    [syncError, setSyncError] = useState(getRefreshError);
  useEffect(
    () => subscribeSyncState(() => setSyncError(getRefreshError())),
    [],
  );
  const current = [...links]
    .reverse()
    .find((l) =>
      l.end ? location.pathname === l.to : location.pathname.startsWith(l.to),
    );
  useEffect(() => {
    if (!IS_ADMIN_PREVIEW && !isAuthenticated()) return;
    // Précharger l'écran d'accueil en parallèle de la session et des données,
    // plutôt qu'attendre la fin du bootstrap pour télécharger son code.
    if (window.location.pathname === '/admin' || window.location.pathname === '/admin/') {
      void import('./Dashboard').catch(() => undefined);
    }
    if (isHydrated()) {
      setReady(true);
      return;
    }
    (IS_ADMIN_PREVIEW ? ensurePreviewSession().then(() => bootstrap()) : bootstrap())
      .then((data) => {
        hydrate(data as never);
        setReady(true);
      })
      .catch((error) => {
        if (error instanceof ApiError && error.status === 401)
          navigate('/admin/login', { replace: true });
        else
          setLoadError(
            error instanceof Error
              ? error.message
              : 'Impossible de charger le back-office.',
          );
      });
  }, [navigate]);
  useEffect(() => {
    const t = setInterval(() => {
      refreshCache();
    }, 15000);
    return () => clearInterval(t);
  }, []);
  useEffect(() => {
    const escape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    if (open) document.addEventListener('keydown', escape);
    return () => document.removeEventListener('keydown', escape);
  }, [open]);
  if (!IS_ADMIN_PREVIEW && !isAuthenticated()) return <Navigate to="/admin/login" replace />;
  if (!ready)
    return (
      <div className="admin-app grid min-h-screen place-items-center">
        <div role={loadError ? 'alert' : 'status'} className="text-center">
          <img
            src="/Logo.jpeg"
            alt="CA IMMO"
            className="h-12 w-12 mx-auto rounded-lg"
          />
          <p className="mt-4 text-sm text-slate-500">
            {loadError || 'Chargement du back-office…'}
          </p>
          {loadError && (
            <button
              className={btnPrimary}
              onClick={() => {
                setLoadError('');
                bootstrap()
                  .then((data) => {
                    hydrate(data as never);
                    setReady(true);
                  })
                  .catch((error) =>
                    setLoadError(
                      error instanceof Error
                        ? error.message
                        : 'Chargement impossible.',
                    ),
                  );
              }}
            >
              Réessayer
            </button>
          )}
        </div>
      </div>
    );
  const handleLogout = async () => {
    await logout();
    resetCache();
    clearRecordViewState();
    navigate('/admin/login');
  };
  const restore = async () => {
    if (
      !(await askConfirm(
        'Restaurer les données fictives de l’aperçu ? Seules vos modifications de test seront effacées. Votre projet et sa base réelle ne sont pas concernés.',
      ))
    )
      return;
    setRestoring(true);
    try {
      await restorePreviewApi();
      hydrate((await bootstrap()) as never);
      navigate('/admin');
    } catch (error) {
      void notice(
        error instanceof Error ? error.message : 'Restauration impossible.',
      );
    } finally {
      setRestoring(false);
    }
  };
  return (
    <div className="admin-app" data-admin-module={location.pathname.split('/')[2] || 'dashboard'}>
      <DialogHost />
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-60 admin-sidebar bg-navy-950 text-white flex flex-col transition-transform lg:translate-x-0 ${open ? 'translate-x-0' : '-translate-x-full'}`}
        aria-label="Navigation du back-office"
      >
        <div className="h-[72px] px-5 border-b border-white/10 flex items-center gap-3 shrink-0">
          <img
            src="/Logo.jpeg"
            alt=""
            className="h-9 w-9 rounded-md object-cover"
          />
          <div>
            <p className="text-[15px] font-bold tracking-wide">CA <span className="text-gold-500">IMMO</span></p>
            <p className="text-[10px] text-white/65 mt-0.5">
              Espace de gestion
            </p>
          </div>
          <button
            className="lg:hidden ml-auto p-2"
            onClick={() => setOpen(false)}
            aria-label="Fermer la navigation"
          >
            <X size={18} />
          </button>
        </div>
        <nav
          className="min-h-0 flex-1 overflow-y-auto px-3 py-4"
          aria-label="Modules de gestion"
        >
          {links.map(({ to, label, icon: Icon, end, group }) => (
            <div key={to}>
              {group && (
                <p className="text-[10px] font-semibold tracking-[.08em] uppercase text-white/60 px-3 pt-4 pb-2 first:pt-0">
                  {group}
                </p>
              )}
              <NavLink
                to={to}
                end={end}
                onClick={() => setOpen(false)}
                className={({ isActive }) =>
                  `admin-nav-link flex items-center gap-3 min-h-10 px-3 mb-1 rounded-md text-[12px] font-medium transition-colors ${isActive ? 'bg-gold-500 text-navy-950' : 'text-white/80 hover:bg-white/10 hover:text-white'}`
                }
              >
                <Icon size={16} strokeWidth={1.6} />
                {label}
              </NavLink>
            </div>
          ))}
        </nav>
        <div className="p-3 border-t border-white/10 space-y-1">
          <a
            href={IS_ADMIN_PREVIEW ? '/?site=1' : '/'}
            target="_blank"
            rel="noopener noreferrer"
            className="flex gap-3 items-center px-3 min-h-10 text-xs text-white/75 rounded-md hover:bg-white/10"
          >
            <ExternalLink size={16} />
            Voir le site public
          </a>
          <button
            onClick={handleLogout}
            className="flex gap-3 items-center px-3 min-h-10 w-full text-xs text-white/75 rounded-md hover:bg-white/10"
          >
            <LogOut size={16} />
            Déconnexion
          </button>
        </div>
      </aside>
      {open && (
        <button
          type="button"
          aria-label="Fermer la navigation"
          className="fixed inset-0 z-30 bg-navy-950/30 lg:hidden"
          onClick={() => setOpen(false)}
        />
      )}
      <div className="admin-content min-w-0 lg:ml-60">
        <header className="admin-topbar sticky top-0 z-20 h-[60px] bg-white/95 border-b border-slate-200 flex items-center justify-between gap-3 px-4 sm:px-7">
          <div className="flex items-center gap-3 min-w-0">
            <button
              className="lg:hidden p-2"
              onClick={() => setOpen(!open)}
              aria-label="Ouvrir la navigation"
              aria-expanded={open}
            >
              <Menu size={20} />
            </button>
            <span className="hidden sm:inline text-xs text-slate-400">
              Administration
            </span>
            <ChevronRight
              className="hidden sm:block text-slate-300"
              size={13}
            />
            <span className="text-xs font-medium truncate">
              {current?.label ?? 'CA IMMO'}
            </span>
          </div>
          <div className="flex items-center gap-3">
            {IS_ADMIN_PREVIEW && (
              <>
                <span className="admin-preview-badge">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                  Aperçu isolé
                </span>
                <button
                  onClick={restore}
                  disabled={restoring}
                  className="text-xs text-slate-500 inline-flex gap-1.5 items-center min-h-10"
                  title="Restaurer uniquement les données de test"
                >
                  <RotateCcw size={14} />
                  <span className="hidden md:inline">
                    {restoring ? 'Restauration…' : 'Réinitialiser les tests'}
                  </span>
                </button>
              </>
            )}
            <span className="admin-user-avatar hidden sm:grid h-8 w-8 place-items-center rounded-full bg-slate-100 text-[10px] font-semibold">
              CA
            </span>
          </div>
        </header>
        <main className="min-w-0 w-full max-w-[1680px] p-4 sm:p-7 lg:p-8 mx-auto">
          {syncError && (
            <div
              role="alert"
              className="mb-5 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800 flex flex-wrap items-center justify-between gap-3"
            >
              <div>
                <strong>Actualisation indisponible</strong>
                <p className="mt-1 text-xs">
                  {syncError} Les dernières données chargées restent affichées.
                </p>
              </div>
              <button className={btnPrimary} onClick={() => refreshCache(true)}>
                Réessayer
              </button>
            </div>
          )}
          <Outlet />
        </main>
      </div>
    </div>
  );
}

export function AdminLogin() {
  const navigate = useNavigate();
  const [email, setEmail] = useState(
      IS_ADMIN_PREVIEW ? 'validation@caimmo.example' : '',
    ),
    [password, setPassword] = useState(
      IS_ADMIN_PREVIEW ? 'apercu-ca-immo' : '',
    );
  const [error, setError] = useState<string | null>(null),
    [busy, setBusy] = useState(false);
  if (IS_ADMIN_PREVIEW || isAuthenticated()) return <Navigate to="/admin" replace />;
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const failure = await login(email, password);
    if (failure) {
      setError(failure);
      setBusy(false);
      return;
    }
    try {
      hydrate((await bootstrap()) as never);
      navigate('/admin');
    } catch (error) {
      setError(
        error instanceof ApiError
          ? error.message
          : 'Impossible de charger les données.',
      );
      setBusy(false);
    }
  };
  return (
    <div className="admin-app min-h-screen flex items-center justify-center p-5">
      <form
        onSubmit={submit}
        className="w-full max-w-[400px] bg-white border border-slate-200 rounded-xl p-8 shadow-sm"
      >
        <div className="mb-7">
          <img
            src="/Logo.jpeg"
            alt="CA IMMO"
            className="h-12 w-12 rounded-lg object-cover mb-5"
          />
          <p className="record-eyebrow">CA IMMO · Espace de gestion</p>
          <h1 className="text-2xl font-semibold tracking-tight">
            {IS_ADMIN_PREVIEW ? 'Valider le nouveau back-office' : 'Connexion'}
          </h1>
          <p className="text-xs text-slate-500 mt-3 leading-relaxed">
            {IS_ADMIN_PREVIEW
              ? 'Données fictives isolées. Vous pouvez modifier, créer et supprimer sans toucher à votre base réelle.'
              : 'Accès réservé à l’administration.'}
          </p>
        </div>
        <label
          className="block text-xs text-slate-600 mb-2"
          htmlFor="admin-login-email"
        >
          Adresse e-mail
        </label>
        <input
          id="admin-login-email"
          name="email"
          type="email"
          autoComplete="username"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className={inputClass}
        />
        <label
          className="block text-xs text-slate-600 mt-4 mb-2"
          htmlFor="admin-login-password"
        >
          Mot de passe
        </label>
        <div className="relative">
          <Lock className="absolute left-3 top-3 text-slate-400" size={15} />
          <input
            id="admin-login-password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={`${inputClass} pl-9`}
          />
        </div>
        {error && (
          <p role="alert" className="text-xs text-red-600 mt-3">
            {error}
          </p>
        )}
        <button
          type="submit"
          disabled={busy}
          className={`${btnPrimary} w-full mt-6`}
        >
          {busy
            ? 'Connexion…'
            : IS_ADMIN_PREVIEW
              ? 'Ouvrir l’aperçu'
              : 'Se connecter'}
        </button>
        {IS_ADMIN_PREVIEW && (
          <p className="text-[11px] text-slate-400 mt-4 text-center">
            Les identifiants de test sont préremplis.
          </p>
        )}
      </form>
    </div>
  );
}
