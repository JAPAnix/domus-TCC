import { PersonalSettingsLayout, PersonalSettings } from './pages/settings/PersonalSettings';
import { PersonalEditor, ContactConfirmation } from './pages/settings/PersonalEditor';
import { createBrowserRouter, createRoutesFromElements, RouterProvider, Outlet, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';

import Login from './pages/Login';
import Register from './pages/Register';
import Profile from './pages/Profile';
import { ProfileAbout, ProfileReviews, ProfessionalProfileSummary } from './pages/profile/ProfileSections';
import CreateProfessionalProfile from './pages/CreateProfessionalProfile';
import Home from './pages/Home';
import ProfessionalDashboard from './pages/ProfessionalDashboard';
import ServiceDetail from './pages/ServiceDetail';
import CreateService from './pages/CreateService';
import MyServices from './pages/MyServices';
import ServiceProposals from './pages/ServiceProposals';
import SendProposal from './pages/SendProposal';
import CreateReview from './pages/CreateReview';
import ProfessionalProfile from './pages/ProfessionalProfile';
import Navbar from './components/Navbar';
import Logout from './pages/Logout';
import Landing from './pages/Landing';
import ProfessionalSearch from './pages/ProfessionalSearch';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import ProtectedRoute from './components/ProtectedRoute';
import SettingsLayout from './pages/settings/SettingsLayout';
import { SettingsPlaceholder } from './pages/settings/SettingsPages';
import { settingsSections } from './pages/settings/settingsSections';

import Notifications from './pages/Notifications';

const router = createBrowserRouter(createRoutesFromElements(
  <Route element={<AuthProvider><Navbar /><Outlet /></AuthProvider>}>
          {/* Públicas */}
          <Route path="/" element={<Landing />} />
          <Route path="/servicos" element={<Home />} />
          <Route path="/buscar" element={<ProfessionalSearch />} />
          <Route path="/login" element={<Login />} />
          <Route path="/sair" element={<Logout />} />
          <Route path="/cadastro" element={<Register />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/servicos/:uuid" element={<ServiceDetail />} />
          <Route path="/profissionais/:uuid" element={<ProfessionalProfile />} />

          {/* Autenticadas */}
          <Route path="/notificacoes" element={<ProtectedRoute><Notifications /></ProtectedRoute>} />
          <Route path="/painel-profissional" element={<ProtectedRoute roles={['professional']}><ProfessionalDashboard /></ProtectedRoute>} />
          <Route path="/configuracoes" element={<ProtectedRoute><SettingsLayout /></ProtectedRoute>}>
            <Route index element={<Navigate to="pessoais" replace />} />
            <Route path="pessoais" element={<PersonalSettingsLayout />}>
              <Route index element={<PersonalSettings />} />
              <Route path=":section" element={<PersonalEditor />} />
              <Route path=":section/confirmar" element={<ContactConfirmation />} />
            </Route>
            {settingsSections.filter(({ path }) => path !== 'pessoais').map(({ path, title, description }) => (
              <Route key={path} path={path} element={<SettingsPlaceholder title={title} description={description} />} />
            ))}
            <Route path="*" element={<Navigate to="/configuracoes/pessoais" replace />} />
          </Route>
          <Route path="/bem-vindo" element={<ProtectedRoute><Navigate to="/configuracoes/pessoais" replace /></ProtectedRoute>} />
          <Route path="/perfil" element={<ProtectedRoute><Profile /></ProtectedRoute>}>
            <Route index element={<Navigate to="sobre" replace />} />
            <Route path="sobre" element={<ProfileAbout />} />
            <Route path="avaliacoes" element={<ProfileReviews />} />
            <Route path="resumo-profissional" element={<ProfessionalProfileSummary />} />
            <Route path="*" element={<Navigate to="/perfil/sobre" replace />} />
          </Route>
          <Route path="/perfil/profissional" element={<ProtectedRoute><CreateProfessionalProfile /></ProtectedRoute>} />
          <Route path="/servicos/novo" element={<CreateService />} />
          <Route path="/meus-servicos" element={<MyServices />} />
          <Route path="/servicos/:uuid/propostas" element={<ProtectedRoute roles={['client']}><ServiceProposals /></ProtectedRoute>} />
          <Route path="/servicos/:uuid/enviar-proposta" element={<SendProposal />} />
          <Route path="/servicos/:uuid/avaliar" element={<ProtectedRoute><CreateReview /></ProtectedRoute>} />
  </Route>
));

export default function App() { return <RouterProvider router={router} />; }
