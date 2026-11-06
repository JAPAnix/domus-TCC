import { lazy, Suspense } from 'react';
import { createBrowserRouter, createRoutesFromElements, RouterProvider, Outlet, Route, Navigate, useMatch, useParams, ScrollRestoration } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ModeProvider } from './context/ModeContext';
import { ToastProvider } from './components/ui';
import NotFound, { RouteError } from './pages/NotFound';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import ProtectedRoute from './components/ProtectedRoute';
import RouteTitle from './components/RouteTitle';
import { useAuth } from './context/useAuth';
import { useMode } from './context/useMode';
import { PRO_HOME_PATH } from './utils/routes';

// Cada página é carregada só quando a pessoa chega nela, para o primeiro carregamento ser mais leve.
const PersonalSettingsLayout = lazy(() => import('./pages/settings/PersonalSettings').then((module) => ({ default: module.PersonalSettingsLayout })));
const PersonalSettings = lazy(() => import('./pages/settings/PersonalSettings').then((module) => ({ default: module.PersonalSettings })));
const PersonalEditor = lazy(() => import('./pages/settings/PersonalEditor').then((module) => ({ default: module.PersonalEditor })));
const ContactConfirmation = lazy(() => import('./pages/settings/PersonalEditor').then((module) => ({ default: module.ContactConfirmation })));
const IdentityVerification = lazy(() => import('./pages/settings/IdentityVerification'));
const SettingsLayout = lazy(() => import('./pages/settings/SettingsLayout'));
const LanguageSettings = lazy(() => import('./pages/settings/SettingsPages').then((module) => ({ default: module.LanguageSettings })));
const PaymentSettings = lazy(() => import('./pages/settings/PaymentSettings'));
const PaymentReceipt = lazy(() => import('./pages/PaymentReceipt'));
const SecuritySettings = lazy(() => import('./pages/settings/SecuritySettings'));
const PrivacySettings = lazy(() => import('./pages/settings/PrivacySettings'));
const NotificationSettings = lazy(() => import('./pages/settings/NotificationSettings'));
const TaxSettings = lazy(() => import('./pages/settings/TaxSettings'));
const Login = lazy(() => import('./pages/Login'));
const Register = lazy(() => import('./pages/Register'));
const Profile = lazy(() => import('./pages/Profile'));
const EditProfile = lazy(() => import('./pages/EditProfile'));
const PublicProfile = lazy(() => import('./pages/PublicProfile'));
const ProfileAbout = lazy(() => import('./pages/profile/ProfileSections').then((module) => ({ default: module.ProfileAbout })));
const ProfileConnections = lazy(() => import('./pages/profile/ProfileSections').then((module) => ({ default: module.ProfileConnections })));
const ReceivedReviews = lazy(() => import('./pages/profile/ProfileSections').then((module) => ({ default: module.ReceivedReviews })));
const WrittenReviews = lazy(() => import('./pages/profile/ProfileSections').then((module) => ({ default: module.WrittenReviews })));
const Home = lazy(() => import('./pages/Home'));
const ServiceDetail = lazy(() => import('./pages/ServiceDetail'));
const CreateService = lazy(() => import('./pages/CreateService'));
const MyServices = lazy(() => import('./pages/MyServices'));
const ServiceProposals = lazy(() => import('./pages/ServiceProposals'));
const SendProposal = lazy(() => import('./pages/SendProposal'));
const CreateReview = lazy(() => import('./pages/CreateReview'));
const Logout = lazy(() => import('./pages/Logout'));
const Landing = lazy(() => import('./pages/Landing'));
const ListingSearch = lazy(() => import('./pages/ListingSearch'));
const ListingPage = lazy(() => import('./pages/ListingPage'));
const RequestFlow = lazy(() => import('./pages/RequestFlow'));
const Styleguide = import.meta.env.DEV ? lazy(() => import('./pages/Styleguide')) : null;
const OrderPage = lazy(() => import('./pages/OrderPage'));
const OrderReview = lazy(() => import('./pages/OrderReview'));
const ForgotPassword = lazy(() => import('./pages/ForgotPassword'));
const ResetPassword = lazy(() => import('./pages/ResetPassword'));
const Notifications = lazy(() => import('./pages/Notifications'));
const HelpHome = lazy(() => import('./pages/help/HelpHome'));
const HelpCategory = lazy(() => import('./pages/help/HelpCategory'));
const HelpArticle = lazy(() => import('./pages/help/HelpArticle'));
const HelpContact = lazy(() => import('./pages/help/HelpContact'));
const LegalPage = lazy(() => import('./pages/help/LegalPage'));
const Favorites = lazy(() => import('./pages/Favorites'));
const FavoriteList = lazy(() => import('./pages/FavoriteList'));
const Messages = lazy(() => import('./pages/Messages'));
const ProLayout = lazy(() => import('./pages/pro/ProLayout'));
const ProDashboard = lazy(() => import('./pages/pro/ProDashboard'));
const ProOrders = lazy(() => import('./pages/pro/ProOrders'));
const ProListings = lazy(() => import('./pages/pro/ProListings'));
const ProEarnings = lazy(() => import('./pages/pro/ProEarnings'));
const QuickReplies = lazy(() => import('./pages/messages/QuickReplies'));
const ProStart = lazy(() => import('./pages/pro/ProStart'));
const ListingWizard = lazy(() => import('./pages/pro/wizard/ListingWizard'));

function ApplicationLayout() {
  const identityPage = useMatch('/configuracoes/pessoais/verificacao-identidade');
  const wizard = useMatch('/pro/anuncio/:uuid/*');
  return (
    <AuthProvider>
      <ModeProvider>
        <ToastProvider>
          <a href="#conteudo" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[80] focus:rounded-control focus:bg-surface focus:px-4 focus:py-2 focus:shadow-raised">Pular para o conteúdo</a>
          <RouteTitle />
          <Navbar simplified={!!identityPage} />
          <div id="conteudo" tabIndex={-1} className="pb-[var(--spacing-bottom-nav)] outline-none md:pb-0">
            <Suspense fallback={<div role="status" aria-label="Carregando página" className="mx-auto max-w-page px-4 py-16 text-center text-sm text-ink-muted">Carregando...</div>}>
              <Outlet />
            </Suspense>
            {!identityPage && !wizard && <Footer />}
          </div>
          <ScrollRestoration />
        </ToastProvider>
      </ModeProvider>
    </AuthProvider>
  );
}

// A página inicial com apresentação é só para visitantes. Quem está logado vai direto ao que usa.
function RootRoute() {
  const { user } = useAuth();
  const { mode } = useMode();
  if (!user) return <Landing />;
  return <Navigate to={mode === 'professional' ? PRO_HOME_PATH : '/buscar'} replace />;
}

// O perfil do profissional agora é o perfil público da pessoa, com os serviços dela.
function RedirectToUser() {
  const { uuid } = useParams();
  return <Navigate to={`/usuarios/${uuid}`} replace />;
}

const router = createBrowserRouter(createRoutesFromElements(
  <Route element={<ApplicationLayout />} errorElement={<RouteError />}>
    {/* Públicas */}
    <Route path="/" element={<RootRoute />} />
    <Route path="/servicos" element={<Home />} />
    <Route path="/buscar" element={<ListingSearch />} />
    {Styleguide && <Route path="/styleguide" element={<Styleguide />} />}
    <Route path="/anuncios/:uuid" element={<ListingPage />} />
    <Route path="/anuncios/:uuid/solicitar" element={<ProtectedRoute><RequestFlow /></ProtectedRoute>} />
    <Route path="/ajuda" element={<HelpHome />} />
    <Route path="/ajuda/categoria/:slug" element={<HelpCategory />} />
    <Route path="/ajuda/artigo/:slug" element={<HelpArticle />} />
    <Route path="/ajuda/contato" element={<HelpContact />} />
    <Route path="/termos-de-uso" element={<LegalPage document="termos-de-uso" />} />
    <Route path="/politica-de-privacidade" element={<LegalPage document="politica-de-privacidade" />} />
    <Route path="/politica-de-cancelamento" element={<LegalPage document="politica-de-cancelamento" />} />
    <Route path="/login" element={<Login />} />
    <Route path="/sair" element={<Logout />} />
    <Route path="/cadastro" element={<Register />} />
    <Route path="/forgot-password" element={<ForgotPassword />} />
    <Route path="/reset-password" element={<ResetPassword />} />
    <Route path="/servicos/:uuid" element={<ServiceDetail />} />
    <Route path="/profissionais/:uuid" element={<RedirectToUser />} />
    <Route path="/usuarios/:uuid" element={<PublicProfile />} />

    {/* Modo profissional ("Vou trabalhar") */}
    <Route path="/pro" element={<ProtectedRoute roles={['professional']}><ProLayout /></ProtectedRoute>}>
      <Route index element={<ProDashboard />} />
      <Route path="pedidos" element={<ProOrders />} />
      <Route path="servicos" element={<ProListings />} />
      <Route path="ganhos" element={<ProEarnings />} />
      <Route path="mensagens" element={<Navigate to="/mensagens" replace />} />
      <Route path="*" element={<Navigate to="/pro" replace />} />
    </Route>
    <Route path="/pro/comecar" element={<ProtectedRoute><ProStart /></ProtectedRoute>} />
    <Route path="/pro/anuncio/:uuid" element={<ProtectedRoute><ListingWizard /></ProtectedRoute>} />
    <Route path="/pro/anuncio/:uuid/etapa/:step" element={<ProtectedRoute><ListingWizard /></ProtectedRoute>} />
    <Route path="/painel-profissional" element={<Navigate to="/pro" replace />} />

    {/* Autenticadas */}
    <Route path="/contratacoes/:uuid" element={<ProtectedRoute><OrderPage /></ProtectedRoute>} />
    <Route path="/pagamentos/:uuid/recibo" element={<ProtectedRoute><PaymentReceipt /></ProtectedRoute>} />
    <Route path="/contratacoes/:uuid/avaliar" element={<ProtectedRoute><OrderReview /></ProtectedRoute>} />
    <Route path="/favoritos" element={<ProtectedRoute><Favorites /></ProtectedRoute>} />
    <Route path="/favoritos/:id" element={<ProtectedRoute><FavoriteList /></ProtectedRoute>} />
    <Route path="/mensagens" element={<ProtectedRoute><Messages /></ProtectedRoute>} />
    <Route path="/mensagens/respostas-rapidas" element={<ProtectedRoute><QuickReplies /></ProtectedRoute>} />
    <Route path="/mensagens/:uuid" element={<ProtectedRoute><Messages /></ProtectedRoute>} />
    <Route path="/notificacoes" element={<ProtectedRoute><Notifications /></ProtectedRoute>} />
    <Route path="/configuracoes" element={<ProtectedRoute><SettingsLayout /></ProtectedRoute>}>
      <Route index element={<Navigate to="pessoais" replace />} />
      <Route path="pessoais" element={<PersonalSettingsLayout />}>
        <Route index element={<PersonalSettings />} />
        <Route path="verificacao-identidade" element={<IdentityVerification />} />
        <Route path=":section" element={<PersonalEditor />} />
        <Route path=":section/confirmar" element={<ContactConfirmation />} />
      </Route>
      <Route path="seguranca" element={<SecuritySettings />} />
      <Route path="privacidade" element={<PrivacySettings />} />
      <Route path="notificacoes" element={<NotificationSettings />} />
      <Route path="impostos" element={<TaxSettings />} />
      <Route path="pagamentos" element={<PaymentSettings />} />
      <Route path="idioma" element={<LanguageSettings />} />
      <Route path="*" element={<Navigate to="/configuracoes/pessoais" replace />} />
    </Route>
    <Route path="/bem-vindo" element={<ProtectedRoute><Navigate to="/configuracoes/pessoais" replace /></ProtectedRoute>} />
    <Route path="/perfil" element={<ProtectedRoute><Profile /></ProtectedRoute>}>
      <Route index element={<Navigate to="sobre" replace />} />
      <Route path="sobre" element={<ProfileAbout />} />
      <Route path="conexoes" element={<ProfileConnections />} />
      <Route path="resumo-profissional" element={<Navigate to="/pro" replace />} />
      <Route path="*" element={<Navigate to="/perfil/sobre" replace />} />
    </Route>
    <Route path="/perfil/editar" element={<ProtectedRoute><EditProfile /></ProtectedRoute>} />
    <Route path="/perfil/avaliacoes" element={<ProtectedRoute><ReceivedReviews /></ProtectedRoute>} />
    <Route path="/perfil/avaliacoes-escritas" element={<ProtectedRoute><WrittenReviews /></ProtectedRoute>} />
    <Route path="/perfil/profissional" element={<Navigate to="/pro/comecar" replace />} />
    <Route path="/servicos/novo" element={<ProtectedRoute roles={['client']}><CreateService /></ProtectedRoute>} />
    <Route path="/meus-servicos" element={<ProtectedRoute><MyServices /></ProtectedRoute>} />
    <Route path="/servicos/:uuid/propostas" element={<ProtectedRoute roles={['client']}><ServiceProposals /></ProtectedRoute>} />
    <Route path="/servicos/:uuid/enviar-proposta" element={<ProtectedRoute><SendProposal /></ProtectedRoute>} />
    <Route path="/servicos/:uuid/avaliar" element={<ProtectedRoute><CreateReview /></ProtectedRoute>} />

    <Route path="*" element={<NotFound />} />
  </Route>
), { basename: import.meta.env.BASE_URL });

export default function App() { return <RouterProvider router={router} />; }
