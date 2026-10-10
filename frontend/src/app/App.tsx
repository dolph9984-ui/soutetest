/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { lazy, Suspense, useLayoutEffect } from 'react';
import {
  Navigate,
  Outlet,
  Route,
  BrowserRouter as Router,
  Routes,
  useLocation,
} from 'react-router-dom';
const Footer = lazy(() => import('../layout/Footer'));
const Navbar = lazy(() => import('../layout/Navbar'));
const NotFound = lazy(() => import('../shared/NotFound'));

const Home = lazy(() => import('../features/home/Home'));
const Lands = lazy(() => import('../features/catalog/Lands'));
const LandDetail = lazy(() => import('../features/catalog/LandDetail'));
const SearchRequest = lazy(() => import('../features/search/SearchRequest'));
const About = lazy(() => import('../features/about/About'));
const Sell = lazy(() => import('../features/sell/Sell'));
const Realisations = lazy(
  () => import('../features/realisations/Realisations'),
);
const ContactPage = lazy(() => import('../features/contact/ContactPage'));
const PrivacyInfo = lazy(() => import('../features/privacy/PrivacyInfo'));

const AdminLayout = lazy(() => import('../admin/AdminLayout'));
const AdminLogin = lazy(() =>
  import('../admin/AdminLayout').then((m) => ({ default: m.AdminLogin })),
);
const Dashboard = lazy(() => import('../admin/Dashboard'));
const AdminLands = lazy(() => import('../admin/AdminLands'));
const AdminLandDetail = lazy(() => import('../admin/AdminLandDetail'));
const LandEditor = lazy(() => import('../admin/LandEditor'));
const MessageDetail = lazy(() =>
  import('../admin/AdminRequests').then((m) => ({ default: m.MessageDetail })),
);
const RealisationDetail = lazy(() =>
  import('../admin/Realisations').then((m) => ({
    default: m.RealisationDetail,
  })),
);
const AdminMessages = lazy(() =>
  import('../admin/AdminRequests').then((m) => ({ default: m.AdminMessages })),
);
const BuyRequestDetail = lazy(() =>
  import('../admin/BuyRequests').then((m) => ({ default: m.BuyRequestDetail })),
);
const BuyRequestForm = lazy(() =>
  import('../admin/BuyRequests').then((m) => ({ default: m.BuyRequestForm })),
);
const BuyRequestList = lazy(() =>
  import('../admin/BuyRequests').then((m) => ({ default: m.BuyRequestList })),
);
const VisitDetail = lazy(() =>
  import('../admin/Visits').then((m) => ({ default: m.VisitDetail })),
);
const VisitList = lazy(() =>
  import('../admin/Visits').then((m) => ({ default: m.VisitList })),
);
const LandFileDetail = lazy(() =>
  import('../admin/LandFiles').then((m) => ({ default: m.LandFileDetail })),
);
const LandFileForm = lazy(() =>
  import('../admin/LandFiles').then((m) => ({ default: m.LandFileForm })),
);
const LandFileList = lazy(() =>
  import('../admin/LandFiles').then((m) => ({ default: m.LandFileList })),
);
const ClientDetail = lazy(() =>
  import('../admin/Clients').then((m) => ({ default: m.ClientDetail })),
);
const ClientList = lazy(() =>
  import('../admin/Clients').then((m) => ({ default: m.ClientList })),
);
const SearchDetail = lazy(() =>
  import('../admin/Searches').then((m) => ({ default: m.SearchDetail })),
);
const SearchList = lazy(() =>
  import('../admin/Searches').then((m) => ({ default: m.SearchList })),
);
const AdminRealisations = lazy(() => import('../admin/Realisations'));
const Agenda = lazy(() => import('../admin/Agenda'));

const adminPositions = new Map<string, number>();
const collectionPaths = new Set([
  '/admin/clients',
  '/admin/achats',
  '/admin/visites',
  '/admin/recherches',
  '/admin/dossiers-terrains',
  '/admin/terrains',
  '/admin/realisations',
  '/admin/messages',
]);
/** Le site revient en haut ; un retour à une collection admin restaure son contexte. */
function ScrollToTop() {
  const { pathname } = useLocation();
  useLayoutEffect(() => {
    const restore = collectionPaths.has(pathname)
      ? (adminPositions.get(pathname) ?? 0)
      : 0;
    window.scrollTo({ top: restore, left: 0, behavior: 'instant' });
    const remember = () => {
      if (collectionPaths.has(pathname))
        adminPositions.set(pathname, window.scrollY);
    };
    window.addEventListener('scroll', remember, { passive: true });
    return () => window.removeEventListener('scroll', remember);
  }, [pathname]);
  return null;
}

function PublicLayout() {
  return (
    <div className="min-h-screen flex flex-col bg-brand-50 text-brand-900 font-sans">
      <Navbar />
      <main className="flex-grow">
        <Outlet />
      </main>
      <Footer />
    </div>
  );
}

function RouteLoading() {
  return (
    <div
      className="grid min-h-[45vh] place-items-center px-6 py-16 text-center"
      role="status"
      aria-live="polite"
    >
      <p className="text-sm font-medium text-navy-900">
        Chargement de la page…
      </p>
    </div>
  );
}

export default function App() {
  return (
    <Router>
      <ScrollToTop />
      <Suspense fallback={<RouteLoading />}>
        <Routes>
          <Route element={<PublicLayout />}>
            <Route path="/" element={<Home />} />
            <Route path="/terrains" element={<Lands />} />
            <Route path="/terrains/:id" element={<LandDetail />} />
            <Route path="/recherche" element={<SearchRequest />} />
            <Route path="/about" element={<About />} />
            {/* Contact : page dédiée (style page de référence — hero, coordonnées, formulaire) */}
            <Route path="/contact" element={<ContactPage />} />
            <Route path="/confidentialite" element={<PrivacyInfo />} />
            <Route path="/connexion" element={<Navigate to="/" replace />} />
            <Route path="/vendre" element={<Sell />} />
            {/* Redirection conservée en attente de validation de la règle métier. */}
            <Route
              path="/reservation"
              element={<Navigate to="/vendre" replace />}
            />
            <Route path="/realisations" element={<Realisations />} />
            <Route path="*" element={<NotFound />} />
          </Route>
          <Route path="/admin/login" element={<AdminLogin />} />
          <Route path="/admin" element={<AdminLayout />}>
            <Route index element={<Dashboard />} />
            <Route path="terrains" element={<AdminLands />} />
            <Route path="terrains/nouveau" element={<LandEditor />} />
            <Route path="terrains/:id/modifier" element={<LandEditor />} />
            <Route path="terrains/:id" element={<AdminLandDetail />} />
            <Route path="achats" element={<BuyRequestList />} />
            <Route path="achats/nouveau" element={<BuyRequestForm />} />
            <Route path="achats/:id" element={<BuyRequestDetail />} />
            <Route
              path="achats/:id/modifier"
              element={<BuyRequestForm key="edit" />}
            />
            <Route path="visites" element={<VisitList />} />
            <Route path="visites/:id" element={<VisitDetail />} />
            <Route path="dossiers-terrains" element={<LandFileList />} />
            <Route
              path="dossiers-terrains/nouveau"
              element={<LandFileForm />}
            />
            <Route path="dossiers-terrains/:id" element={<LandFileDetail />} />
            <Route
              path="dossiers-terrains/:id/modifier"
              element={<LandFileForm key="edit" />}
            />
            <Route path="agenda" element={<Agenda />} />
            <Route path="clients" element={<ClientList />} />
            <Route path="clients/:id" element={<ClientDetail />} />
            <Route path="recherches" element={<SearchList />} />
            <Route path="recherches/:id" element={<SearchDetail />} />
            <Route path="realisations" element={<AdminRealisations />} />
            <Route path="realisations/:id" element={<RealisationDetail />} />
            <Route path="messages" element={<AdminMessages />} />
            <Route path="messages/:id" element={<MessageDetail />} />
          </Route>
        </Routes>
      </Suspense>
    </Router>
  );
}
