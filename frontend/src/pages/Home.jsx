import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import api from "../services/api";

function formatCurrency(value) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

function LoadingGrid() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="bg-white rounded-2xl border border-[#E5E7EB] p-6 animate-pulse">
          <div className="h-4 bg-slate-200 rounded w-1/3 mb-3" />
          <div className="h-6 bg-slate-200 rounded w-3/4 mb-4" />
          <div className="h-4 bg-slate-100 rounded w-1/2" />
        </div>
      ))}
    </div>
  );
}

function EmptyState({ hasFilters, onClear }) {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <div className="w-16 h-16 rounded-full bg-[#EDE9FE] flex items-center justify-center mb-4">
        <svg className="w-8 h-8 text-[#7C3AED]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.75 9.75l4.5 4.5m0-4.5l-4.5 4.5M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </div>
      <h3 className="text-lg font-semibold text-[#111827] mb-1">Nenhum serviço encontrado</h3>
      <p className="text-[#6B7280] text-sm max-w-xs">
        {hasFilters ? "Tente ajustar os filtros para ver mais resultados." : "Ainda não há serviços cadastrados."}
      </p>
      {hasFilters && (
        <button onClick={onClear} className="mt-4 text-sm text-[#7C3AED] hover:underline">
          Limpar filtros
        </button>
      )}
    </div>
  );
}

function ServiceCard({ service }) {
  return (
    <Link
      to={`/servicos/${service.uuid}`}
      className="group bg-white rounded-2xl border border-[#E5E7EB] hover:border-[#7C3AED] hover:shadow-lg transition-all duration-200 p-6 flex flex-col gap-3"
    >
      <span className="inline-block self-start text-xs font-medium bg-[#EDE9FE] text-[#7C3AED] px-2.5 py-1 rounded-full">
        {service.category?.name ?? "Sem categoria"}
      </span>

      <h2 className="text-[#111827] font-semibold text-base leading-snug group-hover:text-[#7C3AED] transition-colors line-clamp-2">
        {service.title}
      </h2>

      <div className="mt-auto pt-3 border-t border-[#E5E7EB] flex items-center justify-between">
        <div>
          <p className="text-[11px] text-[#6B7280] uppercase tracking-wide mb-0.5">Budget</p>
          <p className="text-sm font-semibold text-[#111827]">
            {formatCurrency(service.budgetMin)} – {formatCurrency(service.budgetMax)}
          </p>
        </div>
        <span className="text-[#7C3AED] group-hover:translate-x-1 transition-transform">→</span>
      </div>
    </Link>
  );
}

export default function Home() {
  const [services, setServices] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [categoryId, setCategoryId] = useState("");
  const [budgetMin, setBudgetMin] = useState("");
  const [budgetMax, setBudgetMax] = useState("");

  const hasFilters = !!(categoryId || budgetMin || budgetMax);

  useEffect(() => {
    api.get('/categories')
      .then((res) => setCategories(res.data))
      .catch(() => {});
  }, []);

  const fetchServices = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = {};
      if (categoryId) params.category_id = categoryId;
      if (budgetMin) params.budget_min = budgetMin;
      if (budgetMax) params.budget_max = budgetMax;

      const { data } = await api.get('/services', { params });
      setServices(data.data ?? []);
    } catch (err) {
      setError(err.response?.data?.message || "Erro ao carregar serviços.");
    } finally {
      setLoading(false);
    }
  }, [categoryId, budgetMin, budgetMax]);

  useEffect(() => {
    fetchServices();
  }, [fetchServices]);

  function clearFilters() {
    setCategoryId("");
    setBudgetMin("");
    setBudgetMax("");
  }

  return (
    <div className="min-h-screen bg-[#F9FAFB]">
      <header className="bg-white border-b border-[#E5E7EB]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
          <h1 className="text-2xl sm:text-3xl font-bold text-[#111827] mb-1">Serviços disponíveis</h1>
          <p className="text-[#6B7280] text-sm">Encontre o profissional certo para o seu projeto.</p>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        {/* Filtros */}
        <section className="bg-white rounded-2xl border border-[#E5E7EB] p-5 mb-8">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <label className="block text-xs font-medium text-[#6B7280] mb-1.5">Categoria</label>
              <select
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className="w-full rounded-lg border border-[#E5E7EB] bg-[#F9FAFB] px-3 py-2 text-sm text-[#111827] focus:outline-none focus:ring-2 focus:ring-[#7C3AED]"
              >
                <option value="">Todas as categorias</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>

            <div className="flex-1">
              <label className="block text-xs font-medium text-[#6B7280] mb-1.5">Budget mínimo (R$)</label>
              <input
                type="number"
                min="0"
                value={budgetMin}
                onChange={(e) => setBudgetMin(e.target.value)}
                placeholder="0,00"
                className="w-full rounded-lg border border-[#E5E7EB] bg-[#F9FAFB] px-3 py-2 text-sm text-[#111827] focus:outline-none focus:ring-2 focus:ring-[#7C3AED]"
              />
            </div>

            <div className="flex-1">
              <label className="block text-xs font-medium text-[#6B7280] mb-1.5">Budget máximo (R$)</label>
              <input
                type="number"
                min="0"
                value={budgetMax}
                onChange={(e) => setBudgetMax(e.target.value)}
                placeholder="999.999"
                className="w-full rounded-lg border border-[#E5E7EB] bg-[#F9FAFB] px-3 py-2 text-sm text-[#111827] focus:outline-none focus:ring-2 focus:ring-[#7C3AED]"
              />
            </div>

            {hasFilters && (
              <div className="flex items-end">
                <button
                  onClick={clearFilters}
                  className="w-full sm:w-auto rounded-lg border border-[#E5E7EB] px-4 py-2 text-sm text-[#6B7280] hover:bg-[#F9FAFB] transition-colors"
                >
                  Limpar
                </button>
              </div>
            )}
          </div>
        </section>

        {error && (
          <div className="mb-6 rounded-xl bg-red-50 border border-red-200 text-red-700 px-4 py-3 text-sm flex items-center gap-2">
            <span>⚠</span> {error}
          </div>
        )}

        {loading ? (
          <LoadingGrid />
        ) : services.length === 0 ? (
          <EmptyState hasFilters={hasFilters} onClear={clearFilters} />
        ) : (
          <>
            <p className="text-sm text-[#6B7280] mb-4">
              {services.length} serviço{services.length !== 1 ? "s" : ""} encontrado{services.length !== 1 ? "s" : ""}
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {services.map((s) => (
                <ServiceCard key={s.uuid} service={s} />
              ))}
            </div>
          </>
        )}
      </main>
    </div>
  );
}