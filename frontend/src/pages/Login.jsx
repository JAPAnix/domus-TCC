import { useCallback, useState } from 'react';
import { Link, Navigate, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import api, { apiError } from '../services/api';
import { useAuth } from '../context/useAuth';
import { PRO_START_PATH } from '../utils/routes';
import GoogleSignInButton from '../components/GoogleSignInButton';
import { Button, Input } from '../components/ui';
import AuthLayout from './AuthLayout';

const linkClass = 'font-medium text-primary-strong underline-offset-2 hover:underline';

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, login } = useAuth();
  const [params] = useSearchParams();
  const destination = location.state?.from ?? (params.get('profissional') === '1' ? PRO_START_PATH : '/');

  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const change = (event) => setForm((current) => ({ ...current, [event.target.name]: event.target.value }));

  const finish = useCallback((data) => {
    login(data.token, data.user);
    navigate(destination, { replace: true });
  }, [login, navigate, destination]);

  async function submit(event) {
    event.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { data } = await api.post('/auth/login', form);
      finish(data);
    } catch (err) {
      setError(err.response?.status === 401 ? 'E-mail ou senha incorretos.' : apiError(err, 'Não foi possível entrar.'));
      setLoading(false);
    }
  }

  const onGoogle = useCallback(async (credential) => {
    setError('');
    setLoading(true);
    try {
      const { data } = await api.post('/auth/google', { credential });
      finish(data);
    } catch (err) {
      setError(apiError(err, 'Não foi possível entrar com o Google.'));
      setLoading(false);
    }
  }, [finish]);

  if (user && !loading) return <Navigate to={destination} replace />;

  return (
    <AuthLayout title="Bem-vindo de volta">
      {error && <p role="alert" className="mb-4 rounded-control border border-danger-line bg-danger-soft p-3 text-sm text-danger">{error}</p>}
      <form onSubmit={submit} className="space-y-4">
        <Input label="E-mail" type="email" name="email" autoComplete="email" required value={form.email} onChange={change} />
        <Input label="Senha" type="password" name="password" autoComplete="current-password" required value={form.password} onChange={change} />
        <Button type="submit" block loading={loading}>{loading ? 'Entrando...' : 'Entrar'}</Button>
      </form>
      <p className="mt-3 text-right text-sm"><Link to="/forgot-password" className={linkClass}>Esqueceu sua senha?</Link></p>
      <div className="flex items-center gap-3 py-4 text-xs text-ink-muted"><span className="h-px flex-1 bg-line" />ou<span className="h-px flex-1 bg-line" /></div>
      <GoogleSignInButton onCredential={onGoogle} disabled={loading} />
      <p className="mt-6 text-center text-sm text-ink-muted">Não tem uma conta? <Link to="/cadastro" className={linkClass}>Cadastre-se</Link></p>
    </AuthLayout>
  );
}
