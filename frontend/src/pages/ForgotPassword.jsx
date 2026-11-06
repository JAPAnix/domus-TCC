import { useState } from 'react';
import { Link } from 'react-router-dom';
import api, { apiError } from '../services/api';
import { Button, Input } from '../components/ui';
import AuthLayout from './AuthLayout';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setLoading(true);
    setError('');
    try {
      await api.post('/auth/forgot-password', { email });
      setDone(true);
    } catch (err) {
      setError(apiError(err, 'Não foi possível enviar o link. Tente novamente.'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthLayout title="Esqueceu sua senha?" subtitle="Informe seu e-mail e enviaremos um link para criar uma nova senha.">
      {done ? (
        <p role="status" className="rounded-control border border-success-line bg-success-soft p-3 text-sm text-success">Se existir uma conta com este e-mail, enviaremos as instruções para redefinir sua senha. Confira também a caixa de spam.</p>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          {error && <p role="alert" className="rounded-control border border-danger-line bg-danger-soft p-3 text-sm text-danger">{error}</p>}
          <Input label="E-mail" type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} />
          <Button type="submit" block loading={loading}>{loading ? 'Enviando...' : 'Enviar link'}</Button>
        </form>
      )}
      <p className="mt-5 text-center text-sm"><Link to="/login" className="font-medium text-primary-strong underline-offset-2 hover:underline">Voltar para o login</Link></p>
    </AuthLayout>
  );
}
