import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import api from "../services/api";
export default function ResetPassword() {
  const [params] = useSearchParams();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  async function submit(event) {
    event.preventDefault();
    if (password !== confirm) return setMessage("As senhas não coincidem.");
    setLoading(true);
    try {
      const { data } = await api.post("/auth/reset-password", {
        token: params.get("token"),
        newPassword: password,
      });
      setMessage(data.message);
    } catch (err) {
      setMessage(
        err.response?.data?.message || "Não foi possível redefinir sua senha.",
      );
    } finally {
      setLoading(false);
    }
  }
  return (
    <main className="min-h-screen bg-[#F9FAFB] flex items-center justify-center px-4">
      <form
        onSubmit={submit}
        className="w-full max-w-md rounded-2xl border bg-white p-8"
      >
        <h1 className="text-xl font-semibold">Crie uma nova senha</h1>
        <input
          required
          minLength="8"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Nova senha"
          className="mt-5 w-full rounded-lg border px-4 py-2.5"
        />
        <input
          required
          minLength="8"
          type="password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          placeholder="Confirmar nova senha"
          className="mt-3 w-full rounded-lg border px-4 py-2.5"
        />
        {message && <p className="mt-3 text-sm text-[#6B7280]">{message}</p>}
        <button
          disabled={loading}
          className="mt-4 w-full rounded-lg bg-[#7C3AED] py-2.5 font-semibold text-white"
        >
          {loading ? "Redefinindo..." : "Redefinir senha"}
        </button>
        <Link
          to="/login"
          className="mt-5 block text-center text-sm text-[#7C3AED]"
        >
          Voltar para o login
        </Link>
      </form>
    </main>
  );
}
