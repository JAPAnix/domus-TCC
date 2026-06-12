import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import api from "../services/api";
import { useAuth } from "../context/AuthContext";

const STATUS_OPTIONS = [
  { value: "open", label: "Aberto" },
  { value: "in_progress", label: "Em andamento" },
  { value: "completed", label: "Concluído" },
  { value: "cancelled", label: "Cancelado" },
];

const STATUS_STYLES = {
  draft: "bg-slate-100 text-slate-600 border-slate-200",
  open: "bg-blue-50 text-blue-700 border-blue-200",
  in_progress: "bg-amber-50 text-amber-700 border-amber-200",
  completed: "bg-emerald-50 text-emerald-700 border-emerald-200",
  cancelled: "bg-red-50 text-red-500 border-red-200",
};

const STATUS_LABELS = {
  draft: "Rascunho",
  open: "Aberto",
  in_progress: "Em andamento",
  completed: "Concluído",
  cancelled: "Cancelado",
};

function formatCurrency(value) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

function ConfirmDialog({ message, onConfirm, onCancel }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl border border-[#E5E7EB] p-6 max-w-sm w-full">
        <h3 className="text-base font-semibold text-[#111827] mb-2">Confirmar ação</h3>
        <p className="text-sm text-[#6B7280] mb-6">{message}</p>
        <div className="flex gap-3 justify-end">
          <button
            onClick={onCancel}
            className="rounded-lg border border-[#E5E7EB] px-4 py-2 text-sm text-[#6B7280] hover:bg-[#F9FAFB] transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={onConfirm}
            className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 transition-colors"
          >
            Excluir
          </button>
        </div>
      </div>
    </div>
  );
}

function ServiceRow({ service, onStatusChange, onDelete, updatingStatus, deletingUuid }) {
  const isUpdating = updatingStatus === service.uuid;
  const isDeleting = deletingUuid === service.uuid;

  return (
    <div className={`bg-white rounded-2xl border border-[#E5E7EB] p-5 flex flex-col sm:flex-row sm:items-center gap-4 transition-opacity ${isDeleting ? "opacity-50 pointer-events-none" : ""}`}>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1 flex-wrap">
          <span className="text-xs font-medium text-[#6B7280]">
            {service.category?.name ?? "Sem categoria"}
          </span>
          <span className={`inline-block text-[11px] font-semibold px-2 py-0.5 rounded-full border ${STATUS_STYLES[service.status] ?? STATUS_STYLES["open"]}`}>
            {STATUS_LABELS[service.status] ?? service.status}
          </span>
        </div>
        <Link
          to={`/servicos/${service.uuid}`}
          className="text-base font-semibold text-[#111827] hover:text-[#7C3AED] transition-colors line-clamp-1"
        >
          {service.title}
        </Link>
        <p className="text-sm text-[#6B7280] mt-0.5">
          {formatCurrency(service.budgetMin)} – {formatCurrency(service.budgetMax)}
        </p>
      </div>

      <div className="flex items-center gap-3 flex-shrink-0">
        <div className="relative">
          {isUpdating && (
            <span className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 border-2 border-[#7C3AED] border-t-transparent rounded-full animate-spin" />
          )}
          <select
            value={service.status ?? "open"}
            onChange={(e) => onStatusChange(service.uuid, e.target.value)}
            disabled={isUpdating || service.status === 'completed' || service.status === 'cancelled'}
            className="appearance-none rounded-lg border border-[#E5E7EB] bg-[#F9FAFB] pl-3 pr-7 py-2 text-sm text-[#111827] focus:outline-none focus:ring-2 focus:ring-[#7C3AED] disabled:opacity-60"
          >
            {STATUS_OPTIONS.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
        </div>

        <button
          onClick={() => onDelete(service.uuid, service.title)}
          disabled={isDeleting || service.status === 'in_progress'}
          className="rounded-lg border border-red-200 text-red-500 hover:bg-red-50 px-3 py-2 text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          title="Excluir serviço"
        >
          {isDeleting ? (
            <span className="w-4 h-4 border-2 border-red-400 border-t-transparent rounded-full animate-spin inline-block" />
          ) : "Excluir"}
        </button>
      </div>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="bg-white rounded-2xl border border-[#E5E7EB] p-5 animate-pulse flex gap-4">
          <div className="flex-1 space-y-2">
            <div className="h-3 bg-slate-200 rounded w-1/4" />
            <div className="h-5 bg-slate-200 rounded w-2/3" />
            <div className="h-3 bg-slate-100 rounded w-1/3" />
          </div>
          <div className="flex gap-2 items-center">
            <div className="h-9 w-28 bg-slate-100 rounded-lg" />
            <div className="h-9 w-16 bg-slate-100 rounded-lg" />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function MyServices() {
  const { user } = useAuth();

  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [globalError, setGlobalError] = useState(null);
  const [toastMessage, setToastMessage] = useState(null);
  const [updatingStatus, setUpdatingStatus] = useState(null);
  const [deletingUuid, setDeletingUuid] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);

  function showToast(type, text) {
    setToastMessage({ type, text });
    setTimeout(() => setToastMessage(null), 3000);
  }

  const fetchServices = useCallback(async () => {
    setLoading(true);
    setGlobalError(null);
    try {
      const { data } = await api.get('/services', {
        params: { all: true }
      });
      // filtra apenas os serviços do usuário logado
      const mine = (data.data ?? []).filter(s => s.client?.uuid === user?.uuid);
      setServices(mine);
    } catch (err) {
      setGlobalError(err.response?.data?.message || "Erro ao carregar serviços.");
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchServices();
  }, [fetchServices]);

  async function handleStatusChange(uuid, newStatus) {
    setUpdatingStatus(uuid);
    try {
      await api.patch(`/services/${uuid}/status`, { status: newStatus });
      setServices((prev) => prev.map((s) => s.uuid === uuid ? { ...s, status: newStatus } : s));
      showToast("success", "Status atualizado.");
    } catch (err) {
      showToast("error", err.response?.data?.message || "Erro ao atualizar status.");
    } finally {
      setUpdatingStatus(null);
    }
  }

  function handleDeleteRequest(uuid, title) {
    setConfirmDelete({ uuid, title });
  }

  async function handleDeleteConfirm() {
    const { uuid } = confirmDelete;
    setConfirmDelete(null);
    setDeletingUuid(uuid);
    try {
      await api.delete(`/services/${uuid}`);
      setServices((prev) => prev.filter((s) => s.uuid !== uuid));
      showToast("success", "Serviço excluído.");
    } catch (err) {
      showToast("error", err.response?.data?.message || "Erro ao excluir serviço.");
    } finally {
      setDeletingUuid(null);
    }
  }

  return (
    <div className="min-h-screen bg-[#F9FAFB]">
      {confirmDelete && (
        <ConfirmDialog
          message={`Tem certeza que deseja excluir "${confirmDelete.title}"? Esta ação não pode ser desfeita.`}
          onConfirm={handleDeleteConfirm}
          onCancel={() => setConfirmDelete(null)}
        />
      )}

      <header className="bg-white border-b border-[#E5E7EB]">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 flex items-center justify-between">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-[#111827] mb-1">Meus serviços</h1>
            <p className="text-[#6B7280] text-sm">Gerencie os serviços que você publicou.</p>
          </div>
          <Link
            to="/servicos/novo"
            className="hidden sm:inline-flex items-center gap-2 rounded-lg bg-[#7C3AED] hover:bg-[#6D28D9] px-4 py-2 text-sm font-semibold text-white transition-colors"
          >
            + Novo serviço
          </Link>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
        {toastMessage && (
          <div className={`fixed bottom-6 right-6 z-50 rounded-xl px-4 py-3 text-sm font-medium shadow-lg border flex items-center gap-2 ${
            toastMessage.type === "success"
              ? "bg-emerald-50 border-emerald-200 text-emerald-700"
              : "bg-red-50 border-red-200 text-red-700"
          }`}>
            <span>{toastMessage.type === "success" ? "✓" : "⚠"}</span>
            {toastMessage.text}
          </div>
        )}

        {globalError && (
          <div className="mb-6 rounded-xl bg-red-50 border border-red-200 text-red-700 px-4 py-3 text-sm flex items-center gap-2">
            <span>⚠</span> {globalError}
          </div>
        )}

        {loading && <LoadingSkeleton />}

        {!loading && services.length === 0 && !globalError && (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="w-16 h-16 rounded-full bg-[#EDE9FE] flex items-center justify-center mb-4">
              <svg className="w-8 h-8 text-[#7C3AED]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-[#111827] mb-1">Nenhum serviço publicado</h3>
            <p className="text-[#6B7280] text-sm mb-6 max-w-xs">Publique seu primeiro serviço e comece a receber propostas.</p>
            <Link
              to="/servicos/novo"
              className="inline-flex items-center gap-2 rounded-lg bg-[#7C3AED] hover:bg-[#6D28D9] px-4 py-2 text-sm font-semibold text-white transition-colors"
            >
              + Publicar serviço
            </Link>
          </div>
        )}

        {!loading && services.length > 0 && (
          <>
            <p className="text-sm text-[#6B7280] mb-4">
              {services.length} serviço{services.length !== 1 ? "s" : ""}
            </p>
            <div className="space-y-4">
              {services.map((s) => (
                <ServiceRow
                  key={s.uuid}
                  service={s}
                  onStatusChange={handleStatusChange}
                  onDelete={handleDeleteRequest}
                  updatingStatus={updatingStatus}
                  deletingUuid={deletingUuid}
                />
              ))}
            </div>
          </>
        )}

        {!loading && (
          <div className="sm:hidden mt-8">
            <Link
              to="/servicos/novo"
              className="block w-full text-center rounded-lg bg-[#7C3AED] hover:bg-[#6D28D9] px-6 py-3 text-sm font-semibold text-white transition-colors"
            >
              + Publicar novo serviço
            </Link>
          </div>
        )}
      </main>
    </div>
  );
}