import { useState } from "react";
import { Link } from "react-router-dom";
import api from "../services/api";
export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);
  async function submit(event) {
    event.preventDefault();
    setLoading(true);
    try {
      await api.post("/auth/forgot-password", { email });
    } finally {
      setDone(true);
      setLoading(false);
    }
  }
  return (
    <main className="min-h-screen bg-[#F9FAFB] flex items-center justify-center px-4">
      <form
        onSubmit={submit}
        className="w-full max-w-md rounded-2xl border bg-white p-8"
      >
        <h1 className="text-xl font-semibold">Esqueceu sua senha?</h1>
        <p className="mt-2 text-sm text-[#6B7280]">
          Informe seu email e enviaremos um link para redefinir sua senha.
        </p>
        {done ? (
          <p className="mt-5 rounded-lg bg-green-50 p-3 text-sm text-green-700">
            Se existir uma conta com este email, enviaremos as instruções para
            redefinir sua senha.
          </p>
        ) : (
          <>
            <input
              required
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="seu@email.com"
              className="mt-5 w-full rounded-lg border px-4 py-2.5"
            />
            <button
              disabled={loading}
              className="mt-4 w-full rounded-lg bg-[#7C3AED] py-2.5 font-semibold text-white"
            >
              {loading ? "Enviando..." : "Enviar link"}
            </button>
          </>
        )}
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
