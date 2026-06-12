import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';

import Login from './pages/Login';
import Register from './pages/Register';
import Profile from './pages/Profile';
import CreateProfessionalProfile from './pages/CreateProfessionalProfile';
import Home from './pages/Home';
import ServiceDetail from './pages/ServiceDetail';
import CreateService from './pages/CreateService';
import MyServices from './pages/MyServices';
import ServiceProposals from './pages/ServiceProposals';
import SendProposal from './pages/SendProposal';
import CreateReview from './pages/CreateReview';
import ProfessionalProfile from './pages/ProfessionalProfile';
import Navbar from './components/Navbar';

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Navbar />
        <Routes>
          {/* Públicas */}
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Login />} />
          <Route path="/cadastro" element={<Register />} />
          <Route path="/servicos/:uuid" element={<ServiceDetail />} />
          <Route path="/profissionais/:uuid" element={<ProfessionalProfile />} />

          {/* Autenticadas */}
          <Route path="/perfil" element={<Profile />} />
          <Route path="/perfil/profissional" element={<CreateProfessionalProfile />} />
          <Route path="/servicos/novo" element={<CreateService />} />
          <Route path="/meus-servicos" element={<MyServices />} />
          <Route path="/servicos/:uuid/propostas" element={<ServiceProposals />} />
          <Route path="/servicos/:uuid/enviar-proposta" element={<SendProposal />} />
          <Route path="/servicos/:uuid/avaliar" element={<CreateReview />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;