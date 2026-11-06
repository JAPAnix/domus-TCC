import { useCallback, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import api, { apiError, apiFieldErrors } from '../services/api';
import { useAuth } from '../context/useAuth';
import { PRO_START_PATH } from '../utils/routes';
import GoogleSignInButton from '../components/GoogleSignInButton';
import { Button, Input } from '../components/ui';
import AuthLayout from './AuthLayout';

export default function Register() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [params] = useSearchParams();
  const [professional, setProfessional] = useState(params.get('tipo') === 'profissional');
  const [form, setForm] = useState({ first_name: '', last_name: '', email: '', password: '' });
  const [errors, setErrors] = useState({});
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const destination = professional ? PRO_START_PATH : '/';

  function change(event) {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
    setErrors((current) => ({ ...current, [name]: undefined }));
  }

  async function submit(event) {
    event.preventDefault();
    setError('');
    setErrors({});
    if (form.password.length < 8) {
      setErrors({ password: 'A senha precisa ter pelo menos 8 caracteres.' });
      return;
    }
    setLoading(true);
    try {
      await api.post('/auth/register', form);
      const { data } = await api.post('/auth/login', { email: form.email, password: form.password });
      login(data.token, data.user);
      navigate(destination);
    } catch (err) {
      const fieldErrors = apiFieldErrors(err);
      setErrors(fieldErrors);
      setError(Object.keys(fieldErrors).length ? 'Confira os campos destacados.' : apiError(err, 'Não foi possível criar a conta.'));
      setLoading(false);
    }
  }

  const onGoogle = useCallback(async (credential) => {
    setError('');
    setLoading(true);
    try {
      const { data } = await api.post('/auth/google', { credential });
      login(data.token, data.user);
      navigate(destination);
    } catch (err) {
      setError(apiError(err, 'Não foi possível continuar com o Google.'));
      setLoading(false);
    }
  }, [login, navigate, destination]);

  return (
    <AuthLayout title="Criar conta" subtitle={professional ? 'Passo 1 de 2: crie sua conta. Em seguida, você monta seu perfil profissional.' : undefined}>
      {error && <p role="alert" className="mb-4 rounded-control border border-danger-line bg-danger-soft p-3 text-sm text-danger">{error}</p>}
      <form onSubmit={submit} className="space-y-4">
        <fieldset>
          <legend className="mb-2 text-sm font-medium">Como você quer usar o Dommos?</legend>
          <div className="space-y-1">
            <label className="flex min-h-control-sm cursor-pointer items-center gap-2 text-sm"><input type="radio" name="account_type" checked={!professional} onChange={() => setProfessional(false)} />Contratar serviços</label>
            <label className="flex min-h-control-sm cursor-pointer items-center gap-2 text-sm"><input type="radio" name="account_type" checked={professional} onChange={() => setProfessional(true)} />Oferecer serviços (também posso contratar)</label>
          </div>
        </fieldset>
        <div className="grid grid-cols-2 gap-4">
          <Input label="Nome" name="first_name" autoComplete="given-name" required value={form.first_name} onChange={change} error={errors.first_name} />
          <Input label="Sobrenome" name="last_name" autoComplete="family-name" required value={form.last_name} onChange={change} error={errors.last_name} />
        </div>
        <Input label="E-mail" type="email" name="email" autoComplete="email" required value={form.email} onChange={change} error={errors.email} />
        <Input label="Senha" type="password" name="password" autoComplete="new-password" required hint="Use pelo menos 8 caracteres." value={form.password} onChange={change} error={errors.password} />
        <Button type="submit" block loading={loading}>{loading ? 'Criando conta...' : professional ? 'Criar conta e continuar' : 'Criar conta'}</Button>
      </form>
      <div className="flex items-center gap-3 py-4 text-xs text-ink-muted"><span className="h-px flex-1 bg-line" />ou<span className="h-px flex-1 bg-line" /></div>
      <GoogleSignInButton onCredential={onGoogle} disabled={loading} />
      <p className="mt-6 text-center text-sm text-ink-muted">Já tem uma conta? <Link to={professional ? '/login?profissional=1' : '/login'} className="font-medium text-primary-strong underline-offset-2 hover:underline">Entrar</Link></p>
    </AuthLayout>
  );
}
