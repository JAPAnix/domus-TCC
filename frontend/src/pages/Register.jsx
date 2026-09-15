import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import BrandLogo from '../components/BrandLogo';

const Register = () => {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [params] = useSearchParams();
  const [professional, setProfessional] = useState(params.get('tipo') === 'profissional');

  const [form, setForm] = useState({
    first_name: '',
    last_name: '',
    email: '',
    password: ''
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // Cadastra o usuário
      await api.post('/auth/register', form);

      // Faz login automático
      const { data } = await api.post('/auth/login', {
        email: form.email,
        password: form.password
      });

      login(data.token, data.user);
      navigate(professional ? '/perfil/profissional' : '/bem-vindo');
    } catch (err) {
      setError(err.response?.data?.message || 'Erro ao criar conta');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F9FAFB] flex items-center justify-center px-4">
      <div className="w-full max-w-md">

        <div className="text-center mb-8">
          <h1><BrandLogo className="mx-auto" /></h1>
          <p className="text-[#6B7280] mt-2">Conectamos talentos com oportunidades</p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-[#E5E7EB] p-8">
          <h2 className="text-xl font-semibold text-[#111827] mb-6">Criar conta</h2>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-600 rounded-lg px-4 py-3 mb-4 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <fieldset className="space-y-2">
              <legend className="mb-2 text-sm font-medium">Como você quer usar o Domus?</legend>
              <label className="block text-sm"><input type="radio" name="account_type" checked={!professional} onChange={() => setProfessional(false)} /> Contratar serviços</label>
              <label className="block text-sm"><input type="radio" name="account_type" checked={professional} onChange={() => setProfessional(true)} /> Oferecer serviços (também posso contratar)</label>
            </fieldset>
            {professional && <p className="rounded-lg bg-violet-50 p-3 text-sm text-violet-700">Passo 1 de 2: crie sua conta. Em seguida, configure seu perfil profissional.</p>}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-[#111827] mb-1">Nome</label>
                <input
                  type="text"
                  name="first_name"
                  value={form.first_name}
                  onChange={handleChange}
                  placeholder="João"
                  required
                  className="w-full border border-[#E5E7EB] rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#7C3AED] focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#111827] mb-1">Sobrenome</label>
                <input
                  type="text"
                  name="last_name"
                  value={form.last_name}
                  onChange={handleChange}
                  placeholder="Silva"
                  required
                  className="w-full border border-[#E5E7EB] rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#7C3AED] focus:border-transparent"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-[#111827] mb-1">E-mail</label>
              <input
                type="email"
                name="email"
                value={form.email}
                onChange={handleChange}
                placeholder="seu@email.com"
                required
                className="w-full border border-[#E5E7EB] rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#7C3AED] focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-[#111827] mb-1">Senha</label>
              <input
                type="password"
                name="password"
                value={form.password}
                onChange={handleChange}
                placeholder="mínimo 8 caracteres"
                required
                className="w-full border border-[#E5E7EB] rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#7C3AED] focus:border-transparent"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#7C3AED] hover:bg-[#6D28D9] text-white font-semibold rounded-lg py-2.5 text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Criando conta...' : professional ? 'Criar conta e continuar' : 'Criar conta'}
            </button>
          </form>

          <p className="text-center text-sm text-[#6B7280] mt-6">
            Já tem uma conta?{' '}
            <Link to={professional ? '/login?profissional=1' : '/login'} className="text-[#7C3AED] font-medium hover:underline">
              Entrar
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Register;
