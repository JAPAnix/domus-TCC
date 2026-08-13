import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import api from "../services/api";

function formatCurrency(value) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
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
      className="group bg-white rounded-2xl border border-[#E5E7EB] hover:border-[#7C3AED] hover:shadow-xl transition-all duration-200 flex flex-col overflow-hidden"
    >
      {/* Cor de destaque no topo */}
      <div className="h-2 bg-gradient-to-r from-[#7C3AED] to-[#4F46E5]" />

      <div className="p-6 flex flex-col gap-3 flex-1">
        {/* Categoria */}
        <span className="inline-block self-start text-xs font-medium bg-[#EDE9FE] text-[#7C3AED] px-2.5 py-1 rounded-full">
          {service.category?.name ?? "Sem categoria"}
        </span>

        {/* Título */}
        <h2 className="text-[#111827] font-semibold text-base leading-snug group-hover:text-[#7C3AED] transition-colors line-clamp-2">
          {service.title}
        </h2>

        {/* Descrição */}
        <p className="text-sm text-[#6B7280] line-clamp-2 flex-1">
          {service.description}
        </p>

        {/* Cliente */}
        <div className="flex items-center gap-2 pt-1">
          <div className="w-6 h-6 rounded-full bg-[#EDE9FE] flex items-center justify-center text-[#7C3AED] text-xs font-bold flex-shrink-0">
            {service.client?.firstName?.[0]?.toUpperCase() ?? '?'}
          </div>
          <span className="text-xs text-[#6B7280]">
            {service.client?.firstName} {service.client?.lastName}
          </span>
        </div>

        {/* Budget */}
        <div className="pt-3 border-t border-[#E5E7EB] flex items-center justify-between">
          <div>
            <p className="text-[11px] text-[#6B7280] uppercase tracking-wide mb-0.5">Budget</p>
            <p className="text-sm font-semibold text-[#111827]">
              {formatCurrency(service.budgetMin)} – {formatCurrency(service.budgetMax)}
            </p>
          </div>
          <span className="text-[#7C3AED] group-hover:translate-x-1 transition-transform text-lg">→</span>
        </div>
      </div>
    </Link>
  );
}

export default function Home() {
  const [services, setServices] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [budgetMin, setBudgetMin] = useState('');
  const [budgetMax, setBudgetMax] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  const hasFilters = !!(categoryId || budgetMin || budgetMax || search);

  useEffect(() => {
    api.get('/categories').then((res) => setCategories(res.data)).catch(() => {});
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
    setCategoryId('');
    setBudgetMin('');
    setBudgetMax('');
    setSearch('');
  }

  const filtered = services.filter(s =>
    search === '' ||
    s.title.toLowerCase().includes(search.toLowerCase()) ||
    s.description?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-[#F9FAFB]">

      {/* Hero com busca */}
      <section className="bg-gradient-to-br from-[#7C3AED] to-[#4F46E5] px-4 py-16">
        <div className="max-w-3xl mx-auto text-center">
          <h1 className="text-3xl sm:text-4xl font-bold text-white mb-3">
            Encontre o profissional certo
          </h1>
          <p className="text-white/80 mb-8 text-sm sm:text-base">
            Mais de 500 profissionais prontos para o seu projeto
          </p>

          {/* Barra de busca */}
          <div className="bg-white rounded-2xl p-2 flex gap-2 shadow-xl">
            <div className="flex-1 flex items-center gap-3 px-3">
              <svg className="w-5 h-5 text-[#6B7280] flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar serviços, habilidades ou profissionais..."
                className="flex-1 text-sm text-[#111827] placeholder:text-[#9CA3AF] focus:outline-none py-2"
              />
            </div>
            <select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className="hidden sm:block border-l border-[#E5E7EB] pl-3 pr-8 text-sm text-[#6B7280] focus:outline-none bg-transparent"
            >
              <option value="">Categoria</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            <button className="bg-[#7C3AED] hover:bg-[#6D28D9] text-white font-semibold rounded-xl px-6 py-2.5 text-sm transition-colors flex-shrink-0">
              Buscar
            </button>
          </div>

          {/* Tags populares */}
          <div className="flex flex-wrap gap-2 justify-center mt-5">
            {['Desenvolvimento Web', 'Design', 'Marketing', 'Redação'].map((tag) => (
              <button
                key={tag}
                onClick={() => setSearch(tag)}
                className="bg-white/20 hover:bg-white/30 text-white text-xs font-medium px-3 py-1.5 rounded-full transition-colors"
              >
                {tag}
              </button>
            ))}
          </div>
        </div>
      </section>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-10">

        {/* Barra de filtros e resultados */}
        <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
          <div>
            {!loading && (
              <p className="text-sm text-[#6B7280]">
                <span className="font-semibold text-[#111827]">{filtered.length}</span> serviço{filtered.length !== 1 ? 's' : ''} encontrado{filtered.length !== 1 ? 's' : ''}
              </p>
            )}
          </div>
          <div className="flex gap-2">
            {hasFilters && (
              <button
                onClick={clearFilters}
                className="text-xs border border-[#E5E7EB] text-[#6B7280] hover:bg-white px-3 py-1.5 rounded-lg transition-colors"
              >
                Limpar filtros
              </button>
            )}
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="text-xs border border-[#E5E7EB] bg-white text-[#111827] hover:border-[#7C3AED] px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2a1 1 0 01-.293.707L13 13.414V19a1 1 0 01-.553.894l-4 2A1 1 0 017 21v-7.586L3.293 6.707A1 1 0 013 6V4z" />
              </svg>
              Filtros
            </button>
          </div>
        </div>

        {/* Filtros avançados */}
        {showFilters && (
          <div className="bg-white rounded-2xl border border-[#E5E7EB] p-5 mb-6">
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
            </div>
          </div>
        )}

        {error && (
          <div className="mb-6 rounded-xl bg-red-50 border border-red-200 text-red-700 px-4 py-3 text-sm flex items-center gap-2">
            <span>⚠</span> {error}
          </div>
        )}

        {loading ? (
          <LoadingGrid />
        ) : filtered.length === 0 ? (
          <EmptyState hasFilters={hasFilters} onClear={clearFilters} />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {filtered.map((s) => (
              <ServiceCard key={s.uuid} service={s} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}