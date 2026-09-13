import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';

const BRAZILIAN_STATES = [
  { code: 'AC', name: 'Acre' }, { code: 'AL', name: 'Alagoas' }, { code: 'AP', name: 'Amapá' },
  { code: 'AM', name: 'Amazonas' }, { code: 'BA', name: 'Bahia' }, { code: 'CE', name: 'Ceará' },
  { code: 'DF', name: 'Distrito Federal' }, { code: 'ES', name: 'Espírito Santo' }, { code: 'GO', name: 'Goiás' },
  { code: 'MA', name: 'Maranhão' }, { code: 'MT', name: 'Mato Grosso' }, { code: 'MS', name: 'Mato Grosso do Sul' },
  { code: 'MG', name: 'Minas Gerais' }, { code: 'PA', name: 'Pará' }, { code: 'PB', name: 'Paraíba' },
  { code: 'PR', name: 'Paraná' }, { code: 'PE', name: 'Pernambuco' }, { code: 'PI', name: 'Piauí' },
  { code: 'RJ', name: 'Rio de Janeiro' }, { code: 'RN', name: 'Rio Grande do Norte' }, { code: 'RS', name: 'Rio Grande do Sul' },
  { code: 'RO', name: 'Rondônia' }, { code: 'RR', name: 'Roraima' }, { code: 'SC', name: 'Santa Catarina' },
  { code: 'SP', name: 'São Paulo' }, { code: 'SE', name: 'Sergipe' }, { code: 'TO', name: 'Tocantins' },
];

const WEEKDAY_LABELS = ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB'];
const MONTH_LABELS = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
const POPULAR_SERVICE_NAMES = ['Diarista', 'Eletricista residencial', 'Encanador', 'Pintor', 'Montador de móveis', 'Manutenção de computador', 'Instalação de ar-condicionado', 'Marido de aluguel'];

function toDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function sameDay(firstDate, secondDate) {
  return firstDate.getFullYear() === secondDate.getFullYear()
    && firstDate.getMonth() === secondDate.getMonth()
    && firstDate.getDate() === secondDate.getDate();
}

function isBeforeToday(date) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const candidate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  return candidate < today;
}

function capitalizeFirst(text) {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function formatShortDate(date) {
  return capitalizeFirst(new Intl.DateTimeFormat('pt-BR', { day: 'numeric', month: 'long' }).format(date));
}

function formatMonthTitle(date) {
  return capitalizeFirst(new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' }).format(date));
}

function buildCalendarDays(viewDate) {
  const firstDayOfMonth = new Date(viewDate.getFullYear(), viewDate.getMonth(), 1);
  const daysInMonth = new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 0).getDate();
  const leadingEmptyDays = firstDayOfMonth.getDay();

  return [
    ...Array.from({ length: leadingEmptyDays }, () => null),
    ...Array.from({ length: daysInMonth }, (_, index) => new Date(viewDate.getFullYear(), viewDate.getMonth(), index + 1)),
  ];
}

export function SearchOptionList({ title, query, onQueryChange, options, onSelect, emptyLabel, selectedValue }) {
  const filteredOptions = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) {
      return options;
    }

    return options.filter((option) => option.toLowerCase().includes(normalizedQuery));
  }, [options, query]);

  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm font-semibold text-[#111827]">{title}</p>
        <p className="text-xs text-[#6B7280] mt-1">Digite para filtrar ou escolha uma sugestão.</p>
      </div>

      <label className="flex items-center gap-3 rounded-2xl border border-[#E5E7EB] bg-[#F9FAFB] px-4 py-3 focus-within:ring-2 focus-within:ring-[#7C3AED]">
        <svg className="h-4 w-4 flex-shrink-0 text-[#6B7280]" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="m21 21-4.35-4.35m2.1-5.4a7.5 7.5 0 1 1-15 0 7.5 7.5 0 0 1 15 0Z" />
        </svg>
        <input
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          type="text"
          placeholder={emptyLabel}
          className="w-full bg-transparent text-sm text-[#111827] placeholder:text-[#9CA3AF] outline-none"
        />
      </label>

      <div className="grid gap-2 max-h-[280px] overflow-y-auto pr-1">
        {filteredOptions.length > 0 ? filteredOptions.map((option) => {
          const isSelected = selectedValue === option;

          return (
            <button
              key={option}
              type="button"
              onClick={() => onSelect(option)}
              className={`flex items-center justify-between rounded-2xl border px-4 py-3 text-left text-sm transition-colors ${isSelected ? 'border-[#DDD6FE] bg-[#EDE9FE] text-[#5B21B6]' : 'border-[#E5E7EB] bg-white text-[#111827] hover:bg-[#F9FAFB]'}`}
            >
              <span>{option}</span>
              {isSelected && <span className="text-xs font-semibold uppercase tracking-wide">Selecionado</span>}
            </button>
          );
        }) : (
          <p className="rounded-2xl border border-dashed border-[#E5E7EB] px-4 py-6 text-center text-sm text-[#6B7280]">
            Nenhuma opção encontrada.
          </p>
        )}
      </div>
    </div>
  );
}

function isSameMonth(firstDate, secondDate) {
  return firstDate.getFullYear() === secondDate.getFullYear()
    && firstDate.getMonth() === secondDate.getMonth();
}

function getCurrentMonth() {
  const today = new Date();
  return new Date(today.getFullYear(), today.getMonth(), 1);
}

function normalizeText(value) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR');
}

function CatalogServicePicker({ items, loading, error, query, onQueryChange, category, onCategoryChange, onSelect, selectedService }) {
  const categories = useMemo(() => {
    const byId = new Map(items.map((item) => [item.category.id, item.category]));
    return [...byId.values()].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
  }, [items]);
  const results = useMemo(() => {
    const value = normalizeText(query.trim());
    if (value) return items.filter((item) => normalizeText(`${item.name} ${item.category.name}`).includes(value));
    if (category) return items.filter((item) => item.category.id === category.id);
    return POPULAR_SERVICE_NAMES.map((name) => items.find((item) => item.name === name)).filter(Boolean);
  }, [category, items, query]);
  const title = query ? 'Resultados da busca' : category ? category.name : 'Serviços populares';

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div><p className="text-sm font-semibold text-[#111827]">Qual serviço você procura?</p><p className="mt-1 text-xs text-[#6B7280]">Busque um serviço ou explore por categoria.</p></div>
        {category && !query && <button type="button" onClick={() => onCategoryChange(null)} className="text-sm font-medium text-[#7C3AED] hover:text-[#6D28D9]">Voltar</button>}
      </div>
      <label className="flex items-center gap-3 rounded-2xl border border-[#E5E7EB] bg-[#F9FAFB] px-4 py-3 focus-within:ring-2 focus-within:ring-[#7C3AED]">
        <svg className="h-4 w-4 flex-shrink-0 text-[#6B7280]" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="m21 21-4.35-4.35m2.1-5.4a7.5 7.5 0 1 1-15 0 7.5 7.5 0 0 1 15 0Z" /></svg>
        <input type="search" value={query} onChange={(event) => onQueryChange(event.target.value)} placeholder="Busque um serviço" className="w-full bg-transparent text-sm text-[#111827] placeholder:text-[#9CA3AF] outline-none" />
      </label>
      {loading && <p className="py-6 text-center text-sm text-[#6B7280]">Carregando serviços...</p>}
      {error && <p className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
      {!loading && !error && !query && !category && <div><p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-[#6B7280]">Categorias</p><div className="grid gap-2 sm:grid-cols-2">{categories.map((item) => <button key={item.id} type="button" onClick={() => onCategoryChange(item)} className="rounded-2xl border border-[#E5E7EB] bg-white px-4 py-3 text-left text-sm font-medium text-[#111827] transition-colors hover:bg-[#F5F3FF] hover:text-[#7C3AED]">{item.name}</button>)}</div></div>}
      {!loading && !error && <div><p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-[#6B7280]">{title}</p><div className="grid max-h-[220px] gap-2 overflow-y-auto pr-1">{results.map((item) => <button key={item.id} type="button" onClick={() => onSelect(item)} className={`flex items-center justify-between rounded-2xl border px-4 py-3 text-left text-sm transition-colors ${selectedService?.id === item.id ? 'border-[#DDD6FE] bg-[#EDE9FE] text-[#5B21B6]' : 'border-[#E5E7EB] bg-white text-[#111827] hover:bg-[#F9FAFB]'}`}><span>{item.name}</span>{query && <span className="ml-3 text-xs text-[#6B7280]">{item.category.name}</span>}</button>)}{results.length === 0 && <p className="rounded-2xl border border-dashed border-[#E5E7EB] px-4 py-6 text-center text-sm text-[#6B7280]">Nenhum serviço encontrado.</p>}</div></div>}
    </div>
  );
}

function LocationPicker({ selectedLocation, onSelect }) {
  const [selectedState, setSelectedState] = useState(null);
  const [cityQuery, setCityQuery] = useState('');
  const [cities, setCities] = useState([]);
  const [loadingCities, setLoadingCities] = useState(false);
  const [locationStatus, setLocationStatus] = useState('');

  useEffect(() => {
    if (!selectedState) {
      return undefined;
    }

    const controller = new AbortController();

    async function loadCities() {
      setLoadingCities(true);
      setLocationStatus('');

      try {
        const response = await fetch(`https://servicodados.ibge.gov.br/api/v1/localidades/estados/${selectedState.code}/municipios?orderBy=nome`, { signal: controller.signal });
        if (!response.ok) throw new Error('Não foi possível carregar as cidades.');
        const data = await response.json();
        setCities(data.map((city) => city.nome));
      } catch (error) {
        if (error.name !== 'AbortError') setLocationStatus('Não foi possível carregar as cidades. Tente novamente.');
      } finally {
        if (!controller.signal.aborted) setLoadingCities(false);
      }
    }

    loadCities();
    return () => controller.abort();
  }, [selectedState]);

  const filteredStates = useMemo(() => {
    const query = cityQuery.trim().toLocaleLowerCase('pt-BR');
    return query
      ? BRAZILIAN_STATES.filter((state) => `${state.name} ${state.code}`.toLocaleLowerCase('pt-BR').includes(query))
      : BRAZILIAN_STATES;
  }, [cityQuery]);

  const filteredCities = useMemo(() => {
    const query = cityQuery.trim().toLocaleLowerCase('pt-BR');
    return query ? cities.filter((city) => city.toLocaleLowerCase('pt-BR').includes(query)) : cities;
  }, [cities, cityQuery]);

  function chooseState(state) {
    setSelectedState(state);
    setCityQuery('');
  }

  function useCurrentLocation() {
    if (!navigator.geolocation) {
      setLocationStatus('Seu navegador não oferece suporte à localização. Escolha um estado e uma cidade.');
      return;
    }

    setLocationStatus('Solicitando permissão para acessar sua localização...');
    navigator.geolocation.getCurrentPosition(
      (position) => {
        onSelect('Perto de você', {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
      },
      (error) => {
        const message = error.code === error.PERMISSION_DENIED
          ? 'Permissão de localização negada. Escolha um estado e uma cidade.'
          : 'Não foi possível identificar sua localização. Tente novamente ou escolha uma cidade.';
        setLocationStatus(message);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 300000 },
    );
  }

  if (selectedState) {
    return (
      <div className="space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-[#111827]">Escolha a cidade em {selectedState.name}</p>
            <p className="mt-1 text-xs text-[#6B7280]">Cidades fornecidas pelo IBGE.</p>
          </div>
          <button type="button" onClick={() => { setSelectedState(null); setCityQuery(''); }} className="text-sm font-medium text-[#7C3AED] hover:text-[#6D28D9]">
            Trocar estado
          </button>
        </div>

        <label className="flex items-center gap-3 rounded-2xl border border-[#E5E7EB] bg-[#F9FAFB] px-4 py-3 focus-within:ring-2 focus-within:ring-[#7C3AED]">
          <svg className="h-4 w-4 flex-shrink-0 text-[#6B7280]" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="m21 21-4.35-4.35m2.1-5.4a7.5 7.5 0 1 1-15 0 7.5 7.5 0 0 1 15 0Z" /></svg>
          <input value={cityQuery} onChange={(event) => setCityQuery(event.target.value)} type="text" placeholder="Buscar cidade" className="w-full bg-transparent text-sm text-[#111827] placeholder:text-[#9CA3AF] outline-none" />
        </label>

        {loadingCities ? <p className="py-6 text-center text-sm text-[#6B7280]">Carregando cidades...</p> : (
          <div className="grid max-h-[280px] gap-2 overflow-y-auto pr-1">
            {filteredCities.map((city) => {
              const label = `${city}, ${selectedState.code}`;
              return <button key={city} type="button" onClick={() => onSelect(label)} className={`rounded-2xl border px-4 py-3 text-left text-sm transition-colors ${selectedLocation === label ? 'border-[#DDD6FE] bg-[#EDE9FE] text-[#5B21B6]' : 'border-[#E5E7EB] bg-white text-[#111827] hover:bg-[#F9FAFB]'}`}>{label}</button>;
            })}
          </div>
        )}
        {locationStatus && <p className="text-sm text-[#DC2626]">{locationStatus}</p>}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm font-semibold text-[#111827]">Onde você precisa do serviço?</p>
        <p className="mt-1 text-xs text-[#6B7280]">Use sua localização atual ou selecione um estado e uma cidade.</p>
      </div>
      <button type="button" onClick={useCurrentLocation} className="flex w-full items-center gap-3 rounded-2xl border border-[#C4B5FD] bg-[#F5F3FF] px-4 py-3 text-left text-sm font-medium text-[#5B21B6] transition-colors hover:bg-[#EDE9FE]">
        <svg className="h-5 w-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm0-13v4l2.5 2.5" /></svg>
        Usar minha localização atual
      </button>
      {locationStatus && <p className="text-sm text-[#DC2626]">{locationStatus}</p>}
      <label className="flex items-center gap-3 rounded-2xl border border-[#E5E7EB] bg-[#F9FAFB] px-4 py-3 focus-within:ring-2 focus-within:ring-[#7C3AED]">
        <svg className="h-4 w-4 flex-shrink-0 text-[#6B7280]" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="m21 21-4.35-4.35m2.1-5.4a7.5 7.5 0 1 1-15 0 7.5 7.5 0 0 1 15 0Z" /></svg>
        <input value={cityQuery} onChange={(event) => setCityQuery(event.target.value)} type="text" placeholder="Buscar estado" className="w-full bg-transparent text-sm text-[#111827] placeholder:text-[#9CA3AF] outline-none" />
      </label>
      <div className="grid max-h-[280px] gap-2 overflow-y-auto pr-1 sm:grid-cols-2">
        {filteredStates.map((state) => <button key={state.code} type="button" onClick={() => chooseState(state)} className="rounded-2xl border border-[#E5E7EB] bg-white px-4 py-3 text-left text-sm text-[#111827] transition-colors hover:bg-[#F9FAFB]"><span className="font-semibold">{state.code}</span><span className="ml-2">{state.name}</span></button>)}
      </div>
    </div>
  );
}

function DateCalendar({ currentMonth, selectedDate, onMonthChange, onSelectDate }) {
  const calendarDays = useMemo(() => buildCalendarDays(currentMonth), [currentMonth]);
  const [showMonthPicker, setShowMonthPicker] = useState(false);
  const firstAllowedMonth = getCurrentMonth();
  const canGoBack = !isSameMonth(currentMonth, firstAllowedMonth);
  const yearOptions = Array.from(
    { length: Math.max(6, currentMonth.getFullYear() - firstAllowedMonth.getFullYear() + 6) },
    (_, index) => firstAllowedMonth.getFullYear() + index,
  );

  function changeMonth(month) {
    const nextMonth = new Date(currentMonth.getFullYear(), month, 1);
    if (nextMonth >= firstAllowedMonth) onMonthChange(nextMonth);
  }

  function changeYear(year) {
    const nextMonth = new Date(year, currentMonth.getMonth(), 1);
    onMonthChange(nextMonth < firstAllowedMonth ? firstAllowedMonth : nextMonth);
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-[#111827]">Escolha uma data</p>
          <p className="text-xs text-[#6B7280] mt-1">Datas anteriores ao dia atual permanecem indisponíveis.</p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={!canGoBack}
            onClick={() => onMonthChange(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1))}
            className="flex h-10 w-10 items-center justify-center rounded-full border border-[#E5E7EB] text-[#374151] transition-colors hover:bg-[#F9FAFB] disabled:cursor-not-allowed disabled:border-transparent disabled:text-[#D1D5DB] disabled:hover:bg-transparent"
            aria-label="Mês anterior"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="m15 19-7-7 7-7" />
            </svg>
          </button>
          <button type="button" onClick={() => setShowMonthPicker((current) => !current)} className="min-w-36 rounded-xl px-3 py-2 text-center text-sm font-semibold text-[#111827] transition-colors hover:bg-[#F5F3FF]" aria-expanded={showMonthPicker}>
            {formatMonthTitle(currentMonth)}
          </button>
          <button
            type="button"
            onClick={() => onMonthChange(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1))}
            className="flex h-10 w-10 items-center justify-center rounded-full border border-[#E5E7EB] text-[#374151] transition-colors hover:bg-[#F9FAFB]"
            aria-label="Próximo mês"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="m9 5 7 7-7 7" />
            </svg>
          </button>
        </div>
      </div>

      {showMonthPicker && (
        <div className="grid grid-cols-1 gap-3 rounded-2xl bg-[#F9FAFB] p-4 sm:grid-cols-2">
          <label className="text-xs font-medium text-[#6B7280]">Mês
            <select value={currentMonth.getMonth()} onChange={(event) => changeMonth(Number(event.target.value))} className="mt-1.5 w-full rounded-xl border border-[#E5E7EB] bg-white px-3 py-2 text-sm text-[#111827] outline-none focus:ring-2 focus:ring-[#7C3AED]">
              {MONTH_LABELS.map((month, index) => <option key={month} value={index} disabled={currentMonth.getFullYear() === firstAllowedMonth.getFullYear() && index < firstAllowedMonth.getMonth()}>{month}</option>)}
            </select>
          </label>
          <label className="text-xs font-medium text-[#6B7280]">Ano
            <select value={currentMonth.getFullYear()} onChange={(event) => changeYear(Number(event.target.value))} className="mt-1.5 w-full rounded-xl border border-[#E5E7EB] bg-white px-3 py-2 text-sm text-[#111827] outline-none focus:ring-2 focus:ring-[#7C3AED]">
              {yearOptions.map((year) => <option key={year} value={year}>{year}</option>)}
            </select>
          </label>
        </div>
      )}

      <div className="grid grid-cols-7 gap-2 text-center text-[11px] font-semibold uppercase tracking-[0.16em] text-[#6B7280]">
        {WEEKDAY_LABELS.map((weekday, index) => (
          <span key={`${weekday}-${index}`}>{weekday}</span>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-2">
        {calendarDays.map((date, index) => {
          if (!date) {
            return <div key={`empty-${index}`} className="h-11 rounded-2xl" />;
          }

          const disabled = isBeforeToday(date);
          const active = selectedDate ? sameDay(date, selectedDate) : false;
          const today = sameDay(date, new Date());

          return (
            <button
              key={toDateKey(date)}
              type="button"
              disabled={disabled}
              onClick={() => onSelectDate(date)}
              className={`h-11 rounded-2xl text-sm font-medium transition-all ${active
                ? 'bg-[#7C3AED] text-white shadow-md shadow-[#7C3AED]/25'
                : disabled
                  ? 'cursor-not-allowed bg-[#F9FAFB] text-[#D1D5DB]'
                  : `border bg-white text-[#111827] hover:bg-[#F5F3FF] hover:text-[#7C3AED] ${today ? 'border-[#A78BFA] ring-1 ring-[#DDD6FE]' : 'border-[#E5E7EB]'}`}`}
            >
              {date.getDate()}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function SearchFieldButton({ title, value, placeholder, active, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`group flex w-full min-w-0 items-center justify-between rounded-2xl px-4 py-3 text-left transition-colors md:h-[62px] md:flex-1 md:rounded-none md:px-5 md:py-0 ${active ? 'bg-[#F5F3FF]' : 'hover:bg-[#F9FAFB]'}`}
    >
      <span className="flex min-w-0 flex-col">
        <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#111827]">{title}</span>
        <span className={`mt-1 truncate text-sm ${value ? 'text-[#111827]' : 'text-[#6B7280]'}`}>
          {value || placeholder}
        </span>
      </span>

      <svg className="ml-3 h-4 w-4 flex-shrink-0 text-[#7C3AED] opacity-70 transition-transform group-hover:translate-x-0.5 md:hidden" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="m9 5 7 7-7 7" />
      </svg>
    </button>
  );
}

export default function SearchBar() {
  const navigate = useNavigate();
  const wrapperRef = useRef(null);
  const [activeField, setActiveField] = useState(null);
  const [serviceQuery, setServiceQuery] = useState('');
  const [selectedLocation, setSelectedLocation] = useState('');
  const [locationCoordinates, setLocationCoordinates] = useState(null);
  const [selectedService, setSelectedService] = useState(null);
  const [catalogItems, setCatalogItems] = useState([]);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [catalogError, setCatalogError] = useState('');
  const [selectedServiceCategory, setSelectedServiceCategory] = useState(null);
  const [selectedDate, setSelectedDate] = useState(null);
  const [currentMonth, setCurrentMonth] = useState(() => {
    const today = new Date();
    return new Date(today.getFullYear(), today.getMonth(), 1);
  });
  const [feedbackMessage, setFeedbackMessage] = useState('');

  useEffect(() => {
    function handleOutsideClick(event) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        setActiveField(null);
      }
    }

    document.addEventListener('mousedown', handleOutsideClick);
    document.addEventListener('touchstart', handleOutsideClick);

    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('touchstart', handleOutsideClick);
    };
  }, []);

  useEffect(() => {
    if (activeField !== 'service' || catalogItems.length > 0) return undefined;

    let active = true;

    async function loadCatalog() {
      setCatalogLoading(true);
      setCatalogError('');
      try {
        const { data } = await api.get('/service-catalog');
        if (active) setCatalogItems(data);
      } catch {
        if (active) setCatalogError('Não foi possível carregar os serviços. Tente novamente.');
      } finally {
        if (active) setCatalogLoading(false);
      }
    }

    loadCatalog();
    return () => { active = false; };
  }, [activeField, catalogItems.length]);

  function openField(field) {
    setFeedbackMessage('');

    if (field === 'date' && !selectedDate) {
      const today = new Date();
      setCurrentMonth(new Date(today.getFullYear(), today.getMonth(), 1));
    }

    if (field === 'service') {
      setSelectedServiceCategory(null);
    }

    setActiveField((current) => (current === field ? null : field));
  }

  function selectLocation(location, coordinates = null) {
    setSelectedLocation(location);
    setLocationCoordinates(coordinates);
    setFeedbackMessage('');
    setActiveField(null);
  }

  function selectService(service) {
    setSelectedService({ id: service.id, name: service.name, category: service.category });
    setServiceQuery('');
    setFeedbackMessage('');
    setActiveField(null);
  }

  function selectDate(date) {
    if (isBeforeToday(date)) {
      return;
    }

    setSelectedDate(date);
    setFeedbackMessage('');
    setActiveField(null);
  }

  function handleSearch() {
    if (!selectedLocation) {
      setFeedbackMessage('Selecione onde o serviço será realizado.');
      setActiveField('location');
      return;
    }

    if (!selectedDate) {
      setFeedbackMessage('Escolha uma data.');
      setActiveField('date');
      return;
    }

    if (!selectedService) {
      setFeedbackMessage('Selecione o tipo de serviço.');
      setActiveField('service');
      return;
    }

    const preparedSearch = {
      location: selectedLocation,
      coordinates: locationCoordinates,
      date: toDateKey(selectedDate),
      serviceId: selectedService.id,
      service: selectedService.name,
      serviceCategory: selectedService.category.name,
    };

    setFeedbackMessage('Busca preparada.');
    navigate('/servicos', { state: { search: preparedSearch } });
  }

  const activeValue =
    activeField === 'location' ? selectedLocation : activeField === 'date' ? selectedDate : activeField === 'service' ? selectedService : null;
  const panelPosition = activeField === 'location'
    ? 'md:left-0 md:right-auto md:w-[min(34rem,calc(100vw-2rem))]'
    : activeField === 'date'
      ? 'md:left-1/2 md:right-auto md:w-[min(32rem,calc(100vw-2rem))] md:-translate-x-1/2'
      : 'md:left-auto md:right-0 md:w-[min(42rem,calc(100vw-2rem))]';

  return (
    <div ref={wrapperRef} className="relative w-full min-w-0">
      <div className="flex flex-col overflow-hidden rounded-[32px] border border-[#E5E7EB] bg-white shadow-[0_16px_45px_rgba(17,24,39,0.08)] md:flex-row md:items-stretch">
        <div className="md:flex-1 md:min-w-0 md:border-r md:border-[#E5E7EB]">
          <SearchFieldButton
            title="Onde"
            value={selectedLocation}
            placeholder="Buscar localização"
            active={activeField === 'location'}
            onClick={() => openField('location')}
          />
        </div>

        <div className="md:flex-1 md:min-w-0 md:border-r md:border-[#E5E7EB]">
          <SearchFieldButton
            title="Quando"
            value={selectedDate ? formatShortDate(selectedDate) : ''}
            placeholder="Escolha uma data"
            active={activeField === 'date'}
            onClick={() => openField('date')}
          />
        </div>

        <div className="md:flex-1 md:min-w-0 md:border-r md:border-[#E5E7EB]">
          <SearchFieldButton
            title="Qual serviço"
            value={selectedService?.name}
            placeholder="O que procura?"
            active={activeField === 'service'}
            onClick={() => openField('service')}
          />
        </div>

        <div className="flex justify-end px-4 pb-4 md:flex-none md:items-center md:px-3 md:pb-0 md:pl-3 md:pr-3">
          <button
            type="button"
            onClick={handleSearch}
            aria-label="Pesquisar serviços"
            className="flex h-12 w-12 items-center justify-center rounded-full bg-[#7C3AED] text-white transition-colors hover:bg-[#6D28D9] md:h-14 md:w-14"
          >
            <svg className="h-4 w-4 md:h-5 md:w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="m21 21-4.35-4.35m2.1-5.4a7.5 7.5 0 1 1-15 0 7.5 7.5 0 0 1 15 0Z" />
            </svg>
          </button>
        </div>
      </div>

      {feedbackMessage && (
        <p className="mt-2 px-1 text-sm text-[#DC2626]">
          {feedbackMessage}
        </p>
      )}

      {activeField && (
        <div className={`absolute left-0 top-full z-50 mt-3 w-full max-w-[calc(100vw-2rem)] max-h-[calc(100vh-2rem)] overflow-y-auto rounded-[28px] border border-[#E5E7EB] bg-white p-5 shadow-[0_24px_70px_rgba(17,24,39,0.16)] ${panelPosition}`}>
          {activeField === 'location' && (
            <LocationPicker
              selectedValue={selectedLocation}
              selectedLocation={selectedLocation}
              onSelect={selectLocation}
            />
          )}

          {activeField === 'date' && (
            <DateCalendar
              currentMonth={currentMonth}
              selectedDate={selectedDate}
              onMonthChange={setCurrentMonth}
              onSelectDate={selectDate}
            />
          )}

          {activeField === 'service' && (
            <CatalogServicePicker
              items={catalogItems}
              loading={catalogLoading}
              error={catalogError}
              query={serviceQuery}
              onQueryChange={setServiceQuery}
              category={selectedServiceCategory}
              onCategoryChange={setSelectedServiceCategory}
              onSelect={selectService}
              selectedService={selectedService}
            />
          )}

          {activeValue && activeField !== 'date' && (
            <button
              type="button"
              onClick={() => setActiveField(null)}
              className="mt-5 text-sm font-medium text-[#7C3AED] hover:text-[#6D28D9]"
            >
              Fechar
            </button>
          )}
        </div>
      )}
    </div>
  );
}
