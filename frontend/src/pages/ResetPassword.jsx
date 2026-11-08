import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import api, { apiError, apiFieldErrors } from '../services/api';
import { Button, Input } from '../components/ui';
import AuthLayout from './AuthLayout';

const linkClass = 'font-medium text-primary-strong underline-offset-2 hover:underline';

export default function ResetPassword() {
  const [params] = useSearchParams();
  const token = params.get('token');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [errors, setErrors] = useState({});
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setError('');
    const nextErrors = {};
    if (password.length < 8) nextErrors.password = 'A senha precisa ter pelo menos 8 caracteres.';
    if (password !== confirm) nextErrors.confirm = 'As senhas não coincidem.';
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;

    setLoading(true);
    try {
      await api.post('/auth/reset-password', { token, newPassword: password });
      setDone(true);
    } catch (err) {
      const fields = apiFieldErrors(err);
      if (fields.newPassword) setErrors({ password: fields.newPassword });
      else setError(apiError(err, 'Não foi possível redefinir sua senha.'));
    } finally {
      setLoading(false);
    }
  }

  if (!token) {
    return (
      <AuthLayout title="Link inválido" subtitle="Este link de redefinição está incompleto. Peça um novo para continuar.">
        <Button to="/forgot-password" block>Pedir novo link</Button>
      </AuthLayout>
    );
  }

  if (done) {
    return (
      <AuthLayout title="Senha redefinida" subtitle="Sua nova senha já está valendo. Por segurança, os outros aparelhos foram desconectados.">
        <Button to="/login" block>Entrar</Button>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title="Crie uma nova senha">
      <form onSubmit={submit} noValidate className="space-y-4">
        {error && <p role="alert" className="rounded-control border border-danger-line bg-danger-soft p-3 text-sm text-danger">{error} <Link to="/forgot-password" className="font-semibold underline">Pedir novo link</Link></p>}
        <Input label="Nova senha" type="password" autoComplete="new-password" required hint="Use pelo menos 8 caracteres e evite senhas comuns, como 12345678." value={password} onChange={(event) => setPassword(event.target.value)} error={errors.password} />
        <Input label="Confirmar nova senha" type="password" autoComplete="new-password" required value={confirm} onChange={(event) => setConfirm(event.target.value)} error={errors.confirm} />
        <Button type="submit" block loading={loading}>{loading ? 'Redefinindo...' : 'Redefinir senha'}</Button>
      </form>
      <p className="mt-5 text-center text-sm"><Link to="/login" className={linkClass}>Voltar para o login</Link></p>
    </AuthLayout>
  );
}
