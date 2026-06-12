import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import api from "../services/api";

function formatCurrency(value) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

function formatDate(dateStr) {
  if (!dateStr) return "—";
  return new Intl.DateTimeFormat("pt-BR").format(new Date(dateStr));
}

const STATUS_LABELS = {
  draft: "Rascunho",
  open: "Aberto",
  in_progress: "Em andamento",
  completed: "Concluído",
  cancelled: "Cancelado",
};

function LoadingSkeleton() {
  return (
    <div className="animate-pulse space-y-6">
      <div className="h-4 bg-slate-200 rounded w-1/4" />
      <div className="h-8 bg-slate-200 rounded w-2/3" />
      <div className="space-y-2">
        <div className="h-4 bg-slate-100 rounded w-full" />
        <div className="h-4 bg-slate-100 rounded w-5/6" />
        <div className="h-4 bg-slate-100 rounded w-4/6" />
      </div>
      <div className="grid grid-cols-2 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-20 bg-slate-100 rounded-xl" />
        ))}
      </div>
    </div>
  );
}

function InfoTile({ label, value, accent }) {
  return (
    <div className={`rounded-xl p-4 border ${accent ? "bg-[#EDE9FE] border-[#DDD6FE]" : "bg-[#F9FAFB] border-[#E5E7EB]"}`}>
      <p className={`text-[11px] font-medium uppercase tracking-wide mb-1 ${accent ? "text-[#7C3AED]" : "text-[#6B7280]"}`}>
        {label}
      </p>
      <p className={`text-sm font-semibold ${accent ? "text-[#6D28D9]" : "text-[#111827]"}`}>
        {value}
      </p>
    </div>
  );
}

export default function ServiceDetail() {
  const { uuid } = useParams();
  const [service, setService] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    async function fetchService() {
      setLoading(true);
      setError(null);
      setNotFound(false);
      try {
        const { data } = await api.get(`/services/${uuid}`);
        setService(data);
      } catch (err) {
        if (err?.response?.status === 404) {
          setNotFound(true);
        } else {
          setError(err.response?.data?.message || "Erro ao carregar serviço.");
        }
      } finally {
        setLoading(false);
      }
    }
    fetchService();
  }, [uuid]);

  if (notFound) {
    return (
      <div className="min-h-screen bg-[#F9FAFB] flex flex-col items-center justify-center text-center px-4">
        <div className="w-16 h-16 rounded-full bg-amber-50 flex items-center justify-center mb-4">
          <svg className="w-8 h-8 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
          </svg>
        </div>
        <h2 className="text-xl font-semibold text-[#111827] mb-2">Serviço não encontrado</h2>
        <p className="text-[#6B7280] text-sm mb-6">Este serviço pode ter sido removido ou o link está incorreto.</p>
        <Link to="/" className="inline-flex items-center gap-2 rounded-lg bg-[#7C3AED] px-4 py-2 text-sm font-medium text-white hover:bg-[#6D28D9] transition-colors">
          ← Voltar ao início
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F9FAFB]">
      <div className="bg-white border-b border-[#E5E7EB]">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-4">
          <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-[#6B7280] hover:text-[#7C3AED] transition-colors">
            ← Todos os serviços
          </Link>
        </div>
      </div>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-10">
        {error && (
          <div className="mb-6 rounded-xl bg-red-50 border border-red-200 text-red-700 px-4 py-3 text-sm flex items-center gap-2">
            <span>⚠</span> {error}
          </div>
        )}

        {loading && <LoadingSkeleton />}

        {!loading && service && (
          <article className="space-y-8">
            <div>
              <span className="inline-block text-xs font-medium bg-[#EDE9FE] text-[#7C3AED] px-2.5 py-1 rounded-full mb-3">
                {service.category?.name ?? "Sem categoria"}
              </span>
              <h1 className="text-2xl sm:text-3xl font-bold text-[#111827] leading-tight mb-4">
                {service.title}
              </h1>
              <p className="text-[#6B7280] leading-relaxed text-sm sm:text-base">
                {service.description}
              </p>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <InfoTile label="Budget mínimo" value={formatCurrency(service.budgetMin)} accent />
              <InfoTile label="Budget máximo" value={formatCurrency(service.budgetMax)} accent />
              <InfoTile label="Prazo" value={formatDate(service.deadline)} />
              <InfoTile label="Status" value={STATUS_LABELS[service.status] ?? service.status} />
            </div>

            <div className="bg-white rounded-2xl border border-[#E5E7EB] p-6">
              <h2 className="text-xs font-medium text-[#6B7280] uppercase tracking-wide mb-4">
                Publicado por
              </h2>
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-[#EDE9FE] flex items-center justify-center text-[#7C3AED] font-bold text-sm flex-shrink-0">
                  {(service.client?.firstName ?? "?")[0].toUpperCase()}
                </div>
                <div>
                  <p className="text-sm font-semibold text-[#111827]">
                    {service.client?.firstName} {service.client?.lastName}
                  </p>
                </div>
              </div>
            </div>

            <div className="flex gap-3">
              <Link
                to={`/servicos/${uuid}/enviar-proposta`}
                className="flex-1 text-center bg-[#7C3AED] hover:bg-[#6D28D9] text-white font-semibold rounded-lg py-2.5 text-sm transition-colors"
              >
                Enviar proposta
              </Link>
              <Link
                to={`/servicos/${uuid}/propostas`}
                className="flex-1 text-center border border-[#7C3AED] text-[#7C3AED] hover:bg-[#EDE9FE] font-semibold rounded-lg py-2.5 text-sm transition-colors"
              >
                Ver propostas
              </Link>
            </div>
          </article>
        )}
      </main>
    </div>
  );
}