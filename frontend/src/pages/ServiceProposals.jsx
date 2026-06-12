import { useCallback, useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import api from "../services/api";
import { useAuth } from "../context/AuthContext";

const STATUS_LABELS = {
  pending: "Pendente",
  accepted: "Aceita",
  rejected: "Rejeitada",
  withdrawn: "Retirada"
};

const STATUS_STYLES = {
  pending: "bg-amber-100 text-amber-700",
  accepted: "bg-emerald-100 text-emerald-700",
  rejected: "bg-red-100 text-red-600",
  withdrawn: "bg-slate-100 text-slate-500"
};

function formatCurrency(value) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(value));
}

function LoadingSkeleton() {
  return (
    <div className="space-y-4">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="bg-white rounded-2xl border border-[#E5E7EB] p-6 animate-pulse">
          <div className="flex justify-between gap-4">
            <div className="space-y-2 flex-1">
              <div className="h-4 bg-slate-200 rounded w-1/4" />
              <div className="h-5 bg-slate-200 rounded w-1/3" />
              <div className="h-4 bg-slate-100 rounded w-1/2" />
            </div>
            <div className="flex gap-2">
              <div className="h-9 w-20 bg-slate-100 rounded-lg" />
              <div className="h-9 w-20 bg-slate-100 rounded-lg" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export default function ServiceProposals() {
  const { uuid } = useParams();
  const { user } = useAuth();

  const [proposals, setProposals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionError, setActionError] = useState("");
  const [actionLoading, setActionLoading] = useState(null);

  const loadProposals = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const { data } = await api.get(`/services/${uuid}/proposals`);
      setProposals(Array.isArray(data) ? data : data?.data ?? []);
    } catch (err) {
      setError(err.response?.data?.message || "Erro ao carregar propostas.");
    } finally {
      setLoading(false);
    }
  }, [uuid]);

  useEffect(() => {
    if (uuid) loadProposals();
    else {
      setLoading(false);
      setError("UUID do serviço não informado.");
    }
  }, [loadProposals, uuid]);

  async function updateProposalStatus(proposalUuid, status) {
    try {
      setActionError("");
      setActionLoading(proposalUuid);
      await api.patch(`/proposals/${proposalUuid}/status`, { status });
      await loadProposals();
    } catch (err) {
      setActionError(err.response?.data?.message || "Não foi possível atualizar o status da proposta.");
    } finally {
      setActionLoading(null);
    }
  }

  return (
    <div className="min-h-screen bg-[#F9FAFB] px-4 py-10">
      <div className="max-w-4xl mx-auto">

        <div className="mb-8 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-2">
          <div>
            <h1 className="text-2xl font-bold text-[#111827]">Propostas recebidas</h1>
            <p className="text-[#6B7280] mt-1 text-sm">Gerencie as propostas do seu serviço</p>
          </div>
          <p className="text-xs text-[#6B7280]">Apenas o dono do serviço pode aceitar ou rejeitar</p>
        </div>

        {error && (
          <div className="mb-6 rounded-xl bg-red-50 border border-red-200 text-red-700 px-4 py-3 text-sm">
            {error}
          </div>
        )}

        {actionError && (
          <div className="mb-6 rounded-xl bg-amber-50 border border-amber-200 text-amber-700 px-4 py-3 text-sm">
            {actionError}
          </div>
        )}

        {loading ? (
          <LoadingSkeleton />
        ) : proposals.length === 0 ? (
          <div className="bg-white rounded-2xl border border-[#E5E7EB] p-12 text-center">
            <div className="w-16 h-16 rounded-full bg-[#EDE9FE] flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-[#7C3AED]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-[#111827] mb-1">Nenhuma proposta ainda</h3>
            <p className="text-[#6B7280] text-sm">As propostas dos profissionais aparecerão aqui.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {proposals.map((proposal) => {
              const isFinal = ["accepted", "rejected", "withdrawn"].includes(proposal.status);
              const isLoading = actionLoading === proposal.uuid;
              const professional = proposal.professional?.user;

              return (
                <article key={proposal.uuid} className="bg-white rounded-2xl border border-[#E5E7EB] p-6">
                  <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
                    <div className="space-y-3 flex-1">

                      {/* Profissional */}
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-[#EDE9FE] flex items-center justify-center text-[#7C3AED] font-bold text-sm flex-shrink-0">
                          {(professional?.firstName ?? "?")[0].toUpperCase()}
                        </div>
                        <div>
                          <p className="font-semibold text-[#111827] text-sm">
                            {professional?.firstName} {professional?.lastName}
                          </p>
                          <span className={`inline-block text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_STYLES[proposal.status]}`}>
                            {STATUS_LABELS[proposal.status] ?? proposal.status}
                          </span>
                        </div>
                      </div>

                      {/* Detalhes */}
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                        <div className="bg-[#F9FAFB] rounded-lg p-3">
                          <p className="text-xs text-[#6B7280] mb-0.5">Valor proposto</p>
                          <p className="text-sm font-semibold text-[#111827]">{formatCurrency(proposal.proposedPrice)}</p>
                        </div>
                        <div className="bg-[#F9FAFB] rounded-lg p-3">
                          <p className="text-xs text-[#6B7280] mb-0.5">Prazo</p>
                          <p className="text-sm font-semibold text-[#111827]">{proposal.deliveryTimeDays ?? "—"} dias</p>
                        </div>
                      </div>

                      {/* Carta */}
                      {proposal.coverLetter && (
                        <div className="bg-[#F9FAFB] rounded-lg p-4 text-sm text-[#6B7280] leading-relaxed">
                          {proposal.coverLetter}
                        </div>
                      )}
                    </div>

                    {/* Ações */}
                    {!isFinal && (
                      <div className="flex gap-2 flex-shrink-0">
                        <button
                          type="button"
                          disabled={isLoading}
                          onClick={() => updateProposalStatus(proposal.uuid, "accepted")}
                          className="rounded-lg bg-emerald-500 hover:bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
                        >
                          {isLoading ? (
                            <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          ) : "✓ Aceitar"}
                        </button>
                        <button
                          type="button"
                          disabled={isLoading}
                          onClick={() => updateProposalStatus(proposal.uuid, "rejected")}
                          className="rounded-lg bg-red-500 hover:bg-red-600 px-4 py-2 text-sm font-semibold text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          ✕ Rejeitar
                        </button>
                      </div>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}