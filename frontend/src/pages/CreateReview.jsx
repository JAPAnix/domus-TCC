import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import api from "../services/api";
import { useAuth } from "../context/AuthContext";

export default function CreateReview() {
  const { uuid } = useParams();
  const { user } = useAuth();

  const [service, setService] = useState(null);
  const [loadingService, setLoadingService] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [form, setForm] = useState({ reviewed_uuid: "", rating: "5", comment: "" });

  useEffect(() => {
    let active = true;

    async function loadService() {
      try {
        setLoadingService(true);
        setError("");
        const { data } = await api.get(`/services/${uuid}`);
        if (active) setService(data);
      } catch (err) {
        if (active) setError(err.response?.data?.message || "Não foi possível carregar os dados do serviço.");
      } finally {
        if (active) setLoadingService(false);
      }
    }

    if (uuid) loadService();
    else {
      setLoadingService(false);
      setError("UUID do serviço não informado.");
    }

    return () => { active = false; };
  }, [uuid]);

  function handleChange(e) {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!service || service.status !== "completed") {
      setError("Avaliações só podem ser enviadas para serviços concluídos.");
      return;
    }

    if (!form.reviewed_uuid) {
      setError("Informe o UUID do usuário a ser avaliado.");
      return;
    }

    try {
      setSubmitting(true);
      await api.post(`/services/${uuid}/reviews`, {
        reviewed_uuid: form.reviewed_uuid,
        rating: Number(form.rating),
        comment: form.comment
      });
      setSuccess("Avaliação enviada com sucesso.");
      setForm({ reviewed_uuid: "", rating: "5", comment: "" });
    } catch (err) {
      setError(err.response?.data?.message || "Não foi possível enviar a avaliação.");
    } finally {
      setSubmitting(false);
    }
  }

  const completed = service?.status === "completed";

  return (
    <div className="min-h-screen bg-[#F9FAFB] px-4 py-10">
      <div className="max-w-2xl mx-auto">

        <div className="mb-8">
          <h1 className="text-2xl font-bold text-[#111827]">Criar avaliação</h1>
          <p className="text-[#6B7280] mt-1">Avalie o profissional ou cliente do serviço</p>
        </div>

        {loadingService && (
          <div className="bg-white rounded-2xl border border-[#E5E7EB] p-6 text-[#6B7280] text-sm">
            Carregando informações do serviço...
          </div>
        )}

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

        {service && !loadingService && (
          <div className="bg-white rounded-2xl border border-[#E5E7EB] p-4 mb-6">
            <p className="text-sm text-[#6B7280]">Serviço</p>
            <p className="font-semibold text-[#111827]">{service.title}</p>
            <span className={`inline-block mt-2 text-xs font-medium px-2.5 py-1 rounded-full ${
              completed
                ? 'bg-emerald-100 text-emerald-700'
                : 'bg-yellow-100 text-yellow-700'
            }`}>
              {service.status}
            </span>
          </div>
        )}

        {service && completed && !loadingService ? (
          <div className="bg-white rounded-2xl border border-[#E5E7EB] p-8">
            <form onSubmit={handleSubmit} className="space-y-5">

              <div>
                <label className="block text-sm font-medium text-[#111827] mb-1">
                  UUID do usuário avaliado
                </label>
                <input
                  type="text"
                  name="reviewed_uuid"
                  value={form.reviewed_uuid}
                  onChange={handleChange}
                  placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                  required
                  className="w-full border border-[#E5E7EB] rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#7C3AED] focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-[#111827] mb-1">
                  Nota
                </label>
                <div className="flex gap-2">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setForm((prev) => ({ ...prev, rating: String(star) }))}
                      className={`w-10 h-10 rounded-lg text-lg transition-colors ${
                        Number(form.rating) >= star
                          ? 'bg-[#7C3AED] text-white'
                          : 'bg-[#F3F4F6] text-[#6B7280] hover:bg-[#EDE9FE] hover:text-[#7C3AED]'
                      }`}
                    >
                      ★
                    </button>
                  ))}
                  <span className="ml-2 self-center text-sm text-[#6B7280]">
                    {form.rating}/5
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-[#111827] mb-1">
                  Comentário
                </label>
                <textarea
                  name="comment"
                  rows={5}
                  value={form.comment}
                  onChange={handleChange}
                  placeholder="Descreva a experiência com o serviço e com o profissional."
                  className="w-full border border-[#E5E7EB] rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#7C3AED] focus:border-transparent resize-none"
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full bg-[#7C3AED] hover:bg-[#6D28D9] text-white font-semibold rounded-lg py-2.5 text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? "Enviando..." : "Enviar avaliação"}
              </button>
            </form>
          </div>
        ) : service && !completed && !loadingService ? (
          <div className="bg-white rounded-2xl border border-[#E5E7EB] p-6 text-[#6B7280] text-sm">
            Este formulário só fica disponível para serviços com status <strong>completed</strong>.
          </div>
        ) : null}
      </div>
    </div>
  );
}