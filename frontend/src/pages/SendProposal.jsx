import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import api from "../services/api";
import { useAuth } from "../context/AuthContext";

export default function SendProposal() {
  const { uuid } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [form, setForm] = useState({
    proposed_price: "",
    cover_letter: "",
    delivery_time_days: ""
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const isProfessional = user?.roles?.includes("professional");

  function handleChange(e) {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!isProfessional) {
      setError("Apenas profissionais podem enviar propostas.");
      return;
    }

    try {
      setLoading(true);
      await api.post(`/services/${uuid}/proposals`, {
        proposed_price: Number(form.proposed_price),
        cover_letter: form.cover_letter,
        delivery_time_days: Number(form.delivery_time_days)
      });
      setSuccess("Proposta enviada com sucesso.");
      setForm({ proposed_price: "", cover_letter: "", delivery_time_days: "" });
    } catch (err) {
      setError(err.response?.data?.message || "Não foi possível enviar a proposta.");
    } finally {
      setLoading(false);
    }
  }

  if (!isProfessional) {
    return (
      <div className="min-h-screen bg-[#F9FAFB] flex flex-col items-center justify-center text-center px-4">
        <div className="mb-4 text-4xl">🔒</div>
        <h2 className="text-xl font-semibold text-[#111827] mb-2">Acesso restrito</h2>
        <p className="text-[#6B7280] text-sm mb-6">Apenas profissionais podem enviar propostas.</p>
        <button
          onClick={() => navigate(-1)}
          className="rounded-lg bg-[#7C3AED] px-4 py-2 text-sm font-medium text-white hover:bg-[#6D28D9] transition-colors"
        >
          ← Voltar
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F9FAFB] px-4 py-10">
      <div className="max-w-2xl mx-auto">

        <div className="mb-8">
          <h1 className="text-2xl font-bold text-[#111827]">Enviar proposta</h1>
          <p className="text-[#6B7280] mt-1">Apresente sua proposta para esse serviço</p>
        </div>

        {error && (
          <div className="mb-6 rounded-xl bg-red-50 border border-red-200 text-red-700 px-4 py-3 text-sm">
            {error}
          </div>
        )}

        {success && (
          <div className="mb-6 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 px-4 py-3 text-sm">
            {success}
          </div>
        )}

        <div className="bg-white rounded-2xl border border-[#E5E7EB] p-8">
          <form onSubmit={handleSubmit} className="space-y-5">

            <div>
              <label className="block text-sm font-medium text-[#111827] mb-1">
                Valor proposto (R$)
              </label>
              <input
                type="number"
                name="proposed_price"
                min="0"
                step="0.01"
                value={form.proposed_price}
                onChange={handleChange}
                required
                placeholder="0,00"
                className="w-full border border-[#E5E7EB] rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#7C3AED] focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-[#111827] mb-1">
                Prazo de entrega (dias)
              </label>
              <input
                type="number"
                name="delivery_time_days"
                min="1"
                step="1"
                value={form.delivery_time_days}
                onChange={handleChange}
                placeholder="Ex.: 7"
                className="w-full border border-[#E5E7EB] rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#7C3AED] focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-[#111827] mb-1">
                Carta de apresentação
              </label>
              <textarea
                name="cover_letter"
                rows={6}
                value={form.cover_letter}
                onChange={handleChange}
                placeholder="Explique sua experiência, proposta de valor e como pretende entregar o trabalho."
                className="w-full border border-[#E5E7EB] rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#7C3AED] focus:border-transparent resize-none"
              />
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => navigate(-1)}
                className="flex-1 border border-[#E5E7EB] text-[#6B7280] hover:bg-[#F9FAFB] font-semibold rounded-lg py-2.5 text-sm transition-colors"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-1 bg-[#7C3AED] hover:bg-[#6D28D9] text-white font-semibold rounded-lg py-2.5 text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? "Enviando..." : "Enviar proposta"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}