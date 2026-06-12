import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import Login from './pages/Login';
import Register from './pages/Register';
import Profile from './pages/Profile';
import CreateProfessionalProfile from './pages/CreateProfessionalProfile';

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/cadastro" element={<Register />} />
          <Route path="/perfil" element={<Profile />} />
          <Route path="/perfil/profissional" element={<CreateProfessionalProfile />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;