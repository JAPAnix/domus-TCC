import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import api from "../services/api";
import SearchBar from "../components/SearchBar";

const formatMoney = (value) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
    Number(value),
  );
const formatSearchDate = (value) =>
  value
    ? new Intl.DateTimeFormat("pt-BR", {
        day: "numeric",
        month: "long",
        year: "numeric",
      }).format(new Date(`${value}T12:00:00`))
    : "";

function ResultSkeleton() {
  return (
    <div className="grid gap-6 lg:grid-cols-[55%_1fr] animate-pulse">
      <div className="space-y-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="h-40 rounded-2xl bg-slate-200" />
        ))}
      </div>
      <div className="h-[520px] rounded-3xl bg-slate-200" />
    </div>
  );
}

function ProfessionalCard({ professional, selected, onSelect }) {
  const mainService = professional.services[0];
  return (
    <button
      type="button"
      onClick={() => onSelect(professional)}
      className={`w-full rounded-2xl border p-4 text-left transition-all ${selected ? "border-[#7C3AED] bg-[#F5F3FF] shadow-md" : "border-[#E5E7EB] bg-white hover:border-[#C4B5FD] hover:shadow-sm"}`}
    >
      <div className="flex gap-4">
        <div className="h-20 w-20 flex-shrink-0 overflow-hidden rounded-xl bg-[#EDE9FE]">
          {professional.images[0] ? (
            <img
              src={professional.images[0]}
              alt="Trabalho realizado"
              className="h-full w-full object-cover"
            />
          ) : professional.profilePictureUrl ? (
            <img
              src={professional.profilePictureUrl}
              alt=""
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full items-center justify-center text-2xl font-bold text-[#7C3AED]">
              {professional.name[0]}
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="font-semibold text-[#111827]">
                {professional.name}
              </h2>
              <p className="mt-0.5 text-sm text-[#7C3AED]">
                {mainService?.name ?? professional.headline ?? "Profissional"}
              </p>
            </div>
            {professional.reviewCount ? (
              <span className="whitespace-nowrap text-sm font-medium text-[#111827]">
                ★ {professional.rating.toFixed(1)}{" "}
                <span className="text-[#6B7280]">
                  ({professional.reviewCount})
                </span>
              </span>
            ) : (
              <span className="text-xs font-medium text-[#6B7280]">Novo</span>
            )}
          </div>
          <p className="mt-2 line-clamp-2 text-sm text-[#6B7280]">
            {professional.bio ||
              professional.headline ||
              "Profissional disponível para novos serviços."}
          </p>
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm">
            <span className="font-semibold text-[#111827]">
              {professional.billingMode === 'quote' ? 'Sob orçamento' : professional.billingMode === 'daily' ? `${formatMoney(professional.dailyPrice)}/dia` : `${formatMoney(professional.hourlyPrice)}/h`}
            </span>
            {professional.billingMode == null && professional.dailyPrice != null && (
              <span className="text-[#374151]">
                {formatMoney(professional.dailyPrice)}/dia
              </span>
            )}
          </div>
        </div>
      </div>
    </button>
  );
}

function Highlight({ professional }) {
  const [imageIndex, setImageIndex] = useState(0);
  if (!professional)
    return (
      <div className="hidden lg:flex min-h-[460px] items-center justify-center rounded-3xl border border-dashed border-[#E5E7EB] bg-white p-8 text-center text-sm text-[#6B7280]">
        Selecione um profissional para ver os detalhes.
      </div>
    );
  const images = professional.images;
  const image = images[imageIndex];
  const move = (direction) =>
    setImageIndex(
      (current) => (current + direction + images.length) % images.length,
    );
  return (
    <aside className="rounded-3xl border border-[#E5E7EB] bg-white p-4 shadow-sm lg:sticky lg:top-24 lg:self-start">
      <div className="relative aspect-[4/3] overflow-hidden rounded-2xl bg-gradient-to-br from-[#EDE9FE] to-[#DDD6FE]">
        {image ? (
          <img
            src={image}
            alt={`Trabalho de ${professional.name}`}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full items-center justify-center px-8 text-center text-sm text-[#6B7280]">
            Este profissional ainda não adicionou fotos dos trabalhos.
          </div>
        )}
        {images.length > 1 && (
          <>
            <button
              type="button"
              onClick={() => move(-1)}
              aria-label="Foto anterior"
              className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full bg-white/90 p-2 text-[#374151] shadow"
            >
              ‹
            </button>
            <button
              type="button"
              onClick={() => move(1)}
              aria-label="Próxima foto"
              className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-white/90 p-2 text-[#374151] shadow"
            >
              ›
            </button>
            <span className="absolute bottom-3 right-3 rounded-full bg-black/60 px-2.5 py-1 text-xs text-white">
              {imageIndex + 1} / {images.length}
            </span>
          </>
        )}
      </div>
      <div className="px-2 pb-2 pt-5">
        <h2 className="text-xl font-bold text-[#111827]">
          {professional.name}
        </h2>
        <p className="mt-1 text-sm text-[#7C3AED]">
          {professional.services[0]?.name ??
            professional.headline ??
            "Profissional"}
        </p>
        <p className="mt-3 text-sm text-[#6B7280]">
          {professional.reviewCount
            ? `★ ${professional.rating.toFixed(1)} · ${professional.reviewCount} avaliações`
            : "Novo na plataforma"}
        </p>
        <div className="mt-4 flex gap-4 text-sm">
          <span className="font-semibold text-[#111827]">
            {professional.billingMode === 'quote' ? 'Sob orçamento' : professional.billingMode === 'daily' ? `${formatMoney(professional.dailyPrice)}/dia` : `${formatMoney(professional.hourlyPrice)}/h`}
          </span>
          {professional.billingMode == null && professional.dailyPrice != null && (
            <span className="text-[#374151]">
              {formatMoney(professional.dailyPrice)}/dia
            </span>
          )}
        </div>
        <Link
          to={`/profissionais/${professional.id}`}
          className="mt-5 block rounded-xl bg-[#7C3AED] px-4 py-3 text-center text-sm font-semibold text-white transition-colors hover:bg-[#6D28D9]"
        >
          Ver perfil
        </Link>
      </div>
    </aside>
  );
}

export default function ProfessionalSearch() {
  const [params] = useSearchParams();
  const city = params.get("cidade") ?? "";
  const date = params.get("data") ?? "";
  const serviceId = params.get("serviceId") ?? "";
  const serviceName = params.get("servico") ?? "";
  const [professionals, setProfessionals] = useState([]);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [sort, setSort] = useState("rating");
  const [retryKey, setRetryKey] = useState(0);
  const [maxHourly, setMaxHourly] = useState(500);
  const [maxDaily, setMaxDaily] = useState(2000);
  const [minimumRating, setMinimumRating] = useState(0);
  const [filtersOpen, setFiltersOpen] = useState(false);

  useEffect(() => {
    let active = true;
    async function load() {
      if (!city || !date) {
        if (active) {
          setLoading(false);
          setError("Escolha uma cidade e uma data para buscar profissionais.");
        }
        return;
      }
      setLoading(true);
      setError("");
      try {
        const { data } = await api.get("/professionals/search", {
          params: { city, date, serviceId: serviceId || undefined },
        });
        if (active) {
          setProfessionals(data.data);
          setSelected(data.data[0] ?? null);
        }
      } catch (err) {
        if (active)
          setError(
            err.response?.data?.message ||
              "Não foi possível carregar os profissionais.",
          );
      } finally {
        if (active) setLoading(false);
      }
    }
    load();
    return () => {
      active = false;
    };
  }, [city, date, serviceId, retryKey]);
  const ordered = useMemo(
    () =>
      [...professionals]
        .filter(
          (professional) =>
            (professional.hourlyPrice == null || professional.hourlyPrice <= maxHourly) &&
            (professional.dailyPrice == null ||
              professional.dailyPrice <= maxDaily) &&
            professional.rating >= minimumRating,
        )
        .sort((a, b) =>
          sort === "reviews"
            ? b.reviewCount - a.reviewCount
            : sort === "hourly-asc"
              ? (a.hourlyPrice ?? Infinity) - (b.hourlyPrice ?? Infinity)
              : sort === "hourly-desc"
                ? (b.hourlyPrice ?? -Infinity) - (a.hourlyPrice ?? -Infinity)
                : sort === "daily-asc"
                  ? (a.dailyPrice ?? Infinity) - (b.dailyPrice ?? Infinity)
                  : sort === "daily-desc"
                    ? (b.dailyPrice ?? -Infinity) - (a.dailyPrice ?? -Infinity)
                    : b.rating - a.rating || b.reviewCount - a.reviewCount,
        ),
    [professionals, sort, maxHourly, maxDaily, minimumRating],
  );
  const title = serviceName
    ? `${serviceName} disponíveis em ${city}`
    : `Profissionais disponíveis em ${city}`;
  return (
    <div className="min-h-screen bg-[#F9FAFB]">
      <section className="border-b border-[#E5E7EB] bg-white px-4 py-6">
        <div className="mx-auto max-w-6xl">
          <SearchBar />
        </div>
      </section>
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <div className="mb-5 flex gap-3 overflow-x-auto pb-2">
          <button
            type="button"
            onClick={() => setFiltersOpen(true)}
            className="flex-shrink-0 rounded-full border border-[#D1D5DB] bg-white px-4 py-2.5 text-sm font-medium text-[#111827]"
          >
            ☷ Filtros
          </button>
          <span className="flex-shrink-0 rounded-full border border-[#E5E7EB] bg-white px-4 py-2.5 text-sm text-[#374151]">
            Melhor avaliação
          </span>
          <span className="flex-shrink-0 rounded-full border border-[#E5E7EB] bg-white px-4 py-2.5 text-sm text-[#374151]">
            Preço
          </span>
        </div>
        {filtersOpen && (
          <div
            className="fixed inset-0 z-[60] flex items-end justify-center bg-black/35 sm:items-center sm:p-6"
            onClick={() => setFiltersOpen(false)}
          >
            <div
              className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-t-3xl bg-white p-6 shadow-2xl sm:rounded-3xl"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="mb-5 flex items-center justify-between border-b border-[#E5E7EB] pb-4">
                <h2 className="text-xl font-bold text-[#111827]">Filtros</h2>
                <button
                  type="button"
                  onClick={() => setFiltersOpen(false)}
                  className="text-xl"
                >
                  ×
                </button>
              </div>
              <div className="mb-6 flex gap-3 overflow-x-auto pb-2">
                <label className="min-w-48 rounded-xl border border-[#E5E7EB] bg-white px-3 py-2 text-xs text-[#6B7280]">
                  Até {formatMoney(maxHourly)}/h
                  <input
                    className="mt-1 w-full accent-[#7C3AED]"
                    type="range"
                    min="0"
                    max="500"
                    step="10"
                    value={maxHourly}
                    onChange={(event) =>
                      setMaxHourly(Number(event.target.value))
                    }
                  />
                </label>
                <label className="min-w-48 rounded-xl border border-[#E5E7EB] bg-white px-3 py-2 text-xs text-[#6B7280]">
                  Até {formatMoney(maxDaily)}/dia
                  <input
                    className="mt-1 w-full accent-[#7C3AED]"
                    type="range"
                    min="0"
                    max="2000"
                    step="50"
                    value={maxDaily}
                    onChange={(event) =>
                      setMaxDaily(Number(event.target.value))
                    }
                  />
                </label>
                <label className="rounded-xl border border-[#E5E7EB] bg-white px-3 py-2 text-xs text-[#6B7280]">
                  Avaliação
                  <select
                    value={minimumRating}
                    onChange={(event) =>
                      setMinimumRating(Number(event.target.value))
                    }
                    className="ml-2 bg-transparent text-sm text-[#111827]"
                  >
                    <option value="0">Todas</option>
                    <option value="4">4,0+</option>
                    <option value="4.5">4,5+</option>
                    <option value="4.8">4,8+</option>
                  </select>
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setMaxHourly(500);
                    setMaxDaily(2000);
                    setMinimumRating(0);
                  }}
                  className="rounded-xl border border-[#E5E7EB] bg-white px-4 text-sm text-[#374151]"
                >
                  Limpar filtros
                </button>
              </div>
              <div className="flex items-center justify-between border-t border-[#E5E7EB] pt-5">
                <button
                  type="button"
                  onClick={() => {
                    setMaxHourly(500);
                    setMaxDaily(2000);
                    setMinimumRating(0);
                  }}
                  className="text-sm font-semibold text-[#7C3AED]"
                >
                  Limpar filtros
                </button>
                <button
                  type="button"
                  onClick={() => setFiltersOpen(false)}
                  className="rounded-xl bg-[#7C3AED] px-5 py-3 text-sm font-semibold text-white"
                >
                  Mostrar {ordered.length} resultados
                </button>
              </div>
            </div>
          </div>
        )}
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-[#7C3AED]">
              {formatSearchDate(date)}
            </p>
            <h1 className="mt-1 text-2xl font-bold text-[#111827]">{title}</h1>
            <p className="mt-1 text-sm text-[#6B7280]">
              {loading
                ? "Buscando profissionais..."
                : `${professionals.length} profissional${professionals.length !== 1 ? "is" : ""} encontrado${professionals.length !== 1 ? "s" : ""}`}
            </p>
          </div>
          <label className="text-sm text-[#6B7280]">
            Ordenar por
            <select
              value={sort}
              onChange={(event) => setSort(event.target.value)}
              className="ml-2 rounded-xl border border-[#E5E7EB] bg-white px-3 py-2 text-sm text-[#111827]"
            >
              <option value="rating">Melhor avaliação</option>
              <option value="reviews">Mais avaliações</option>
              <option value="hourly-asc">Menor preço/hora</option>
              <option value="hourly-desc">Maior preço/hora</option>
              <option value="daily-asc">Menor preço/dia</option>
              <option value="daily-desc">Maior preço/dia</option>
            </select>
          </label>
        </div>
        {loading ? (
          <ResultSkeleton />
        ) : error ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-red-700">
            <p>{error}</p>
            <button
              type="button"
              onClick={() => setRetryKey((key) => key + 1)}
              className="mt-3 font-semibold underline"
            >
              Tentar novamente
            </button>
          </div>
        ) : ordered.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-[#DDD6FE] bg-white px-6 py-20 text-center">
            <h2 className="text-xl font-semibold text-[#111827]">
              Nenhum profissional disponível para essa busca.
            </h2>
            <p className="mt-2 text-sm text-[#6B7280]">
              Tente alterar a data, localização ou serviço.
            </p>
            <Link
              to="/servicos"
              className="mt-5 inline-block rounded-xl bg-[#7C3AED] px-4 py-3 text-sm font-semibold text-white"
            >
              Alterar busca
            </Link>
          </div>
        ) : (
          <div className="grid gap-6 lg:grid-cols-[55%_1fr]">
            <div className="space-y-3">
              {ordered.map((professional) => (
                <ProfessionalCard
                  key={professional.id}
                  professional={professional}
                  selected={selected?.id === professional.id}
                  onSelect={setSelected}
                />
              ))}
            </div>
            <Highlight key={selected?.id} professional={selected} />
          </div>
        )}
      </main>
    </div>
  );
}
