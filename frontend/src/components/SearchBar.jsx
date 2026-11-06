import { useEffect, useMemo, useRef, useState } from 'react';
import { useMatch, useNavigate, useSearchParams } from 'react-router-dom';
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
        <div><p className="text-sm font-semibold text-ink">Qual serviço você procura?</p><p className="mt-1 text-xs text-ink-muted">Busque um serviço ou explore por categoria.</p></div>
        {category && !query && <button type="button" onClick={() => onCategoryChange(null)} className="text-sm font-medium text-primary hover:text-primary-hover">Voltar</button>}
      </div>
      <label className="flex items-center gap-3 rounded-card border border-line bg-canvas px-4 py-3 focus-within:ring-2 focus-within:ring-primary">
        <svg className="h-4 w-4 flex-shrink-0 text-ink-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="m21 21-4.35-4.35m2.1-5.4a7.5 7.5 0 1 1-15 0 7.5 7.5 0 0 1 15 0Z" /></svg>
        <input type="search" value={query} onChange={(event) => onQueryChange(event.target.value)} placeholder="Busque um serviço" className="w-full bg-transparent text-sm text-ink placeholder:text-ink-muted outline-none" />
      </label>
      {loading && <p className="py-6 text-center text-sm text-ink-muted">Carregando serviços...</p>}
      {error && <p className="rounded-card border border-danger-line bg-danger-soft px-4 py-3 text-sm text-danger">{error}</p>}
      {!loading && !error && !query && !category && <div><p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-ink-muted">Categorias</p><div className="grid gap-2 sm:grid-cols-2">{categories.map((item) => <button key={item.id} type="button" onClick={() => onCategoryChange(item)} className="rounded-card border border-line bg-surface px-4 py-3 text-left text-sm font-medium text-ink transition-colors hover:bg-primary-softer hover:text-primary">{item.name}</button>)}</div></div>}
      {!loading && !error && <div><p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-ink-muted">{title}</p><div className="grid max-h-[220px] gap-2 overflow-y-auto pr-1">{results.map((item) => <button key={item.id} type="button" onClick={() => onSelect(item)} className={`flex items-center justify-between rounded-card border px-4 py-3 text-left text-sm transition-colors ${selectedService?.id === item.id ? 'border-primary-line bg-primary-soft text-primary-strong' : 'border-line bg-surface text-ink hover:bg-canvas'}`}><span>{item.name}</span>{query && <span className="ml-3 text-xs text-ink-muted">{item.category.name}</span>}</button>)}{results.length === 0 && <p className="rounded-card border border-dashed border-line px-4 py-6 text-center text-sm text-ink-muted">Nenhum serviço encontrado.</p>}</div></div>}
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

  if (selectedState) {
    return (
      <div className="space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-ink">Escolha a cidade em {selectedState.name}</p>
            <p className="mt-1 text-xs text-ink-muted">Cidades fornecidas pelo IBGE.</p>
          </div>
          <button type="button" onClick={() => { setSelectedState(null); setCityQuery(''); }} className="text-sm font-medium text-primary hover:text-primary-hover">
            Trocar estado
          </button>
        </div>

        <label className="flex items-center gap-3 rounded-card border border-line bg-canvas px-4 py-3 focus-within:ring-2 focus-within:ring-primary">
          <svg className="h-4 w-4 flex-shrink-0 text-ink-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="m21 21-4.35-4.35m2.1-5.4a7.5 7.5 0 1 1-15 0 7.5 7.5 0 0 1 15 0Z" /></svg>
          <input value={cityQuery} onChange={(event) => setCityQuery(event.target.value)} type="text" placeholder="Buscar cidade" className="w-full bg-transparent text-sm text-ink placeholder:text-ink-muted outline-none" />
        </label>

        {loadingCities ? <p className="py-6 text-center text-sm text-ink-muted">Carregando cidades...</p> : (
          <div className="grid max-h-[280px] gap-2 overflow-y-auto pr-1">
            {filteredCities.map((city) => {
              const label = `${city}, ${selectedState.code}`;
              return <button key={city} type="button" onClick={() => onSelect(city)} className={`rounded-card border px-4 py-3 text-left text-sm transition-colors ${selectedLocation === city ? 'border-primary-line bg-primary-soft text-primary-strong' : 'border-line bg-surface text-ink hover:bg-canvas'}`}>{label}</button>;
            })}
          </div>
        )}
        {locationStatus && <p className="text-sm text-danger">{locationStatus}</p>}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm font-semibold text-ink">Onde você precisa do serviço?</p>
        <p className="mt-1 text-xs text-ink-muted">Selecione o estado e depois a cidade.</p>
      </div>
      {locationStatus && <p className="text-sm text-danger">{locationStatus}</p>}
      <label className="flex items-center gap-3 rounded-card border border-line bg-canvas px-4 py-3 focus-within:ring-2 focus-within:ring-primary">
        <svg className="h-4 w-4 flex-shrink-0 text-ink-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="m21 21-4.35-4.35m2.1-5.4a7.5 7.5 0 1 1-15 0 7.5 7.5 0 0 1 15 0Z" /></svg>
        <input value={cityQuery} onChange={(event) => setCityQuery(event.target.value)} type="text" placeholder="Buscar estado" className="w-full bg-transparent text-sm text-ink placeholder:text-ink-muted outline-none" />
      </label>
      <div className="grid max-h-[280px] gap-2 overflow-y-auto pr-1 sm:grid-cols-2">
        {filteredStates.map((state) => <button key={state.code} type="button" onClick={() => chooseState(state)} className="rounded-card border border-line bg-surface px-4 py-3 text-left text-sm text-ink transition-colors hover:bg-canvas"><span className="font-semibold">{state.code}</span><span className="ml-2">{state.name}</span></button>)}
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
          <p className="text-sm font-semibold text-ink">Escolha uma data</p>
          <p className="text-xs text-ink-muted mt-1">Datas anteriores ao dia atual permanecem indisponíveis.</p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={!canGoBack}
            onClick={() => onMonthChange(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1))}
            className="flex h-10 w-10 items-center justify-center rounded-full border border-line text-ink-soft transition-colors hover:bg-canvas disabled:cursor-not-allowed disabled:border-transparent disabled:text-line-strong disabled:hover:bg-transparent"
            aria-label="Mês anterior"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="m15 19-7-7 7-7" />
            </svg>
          </button>
          <button type="button" onClick={() => setShowMonthPicker((current) => !current)} className="min-w-36 rounded-control px-3 py-2 text-center text-sm font-semibold text-ink transition-colors hover:bg-primary-softer" aria-expanded={showMonthPicker}>
            {formatMonthTitle(currentMonth)}
          </button>
          <button
            type="button"
            onClick={() => onMonthChange(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1))}
            className="flex h-10 w-10 items-center justify-center rounded-full border border-line text-ink-soft transition-colors hover:bg-canvas"
            aria-label="Próximo mês"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="m9 5 7 7-7 7" />
            </svg>
          </button>
        </div>
      </div>

      {showMonthPicker && (
        <div className="grid grid-cols-1 gap-3 rounded-card bg-canvas p-4 sm:grid-cols-2">
          <label className="text-xs font-medium text-ink-muted">Mês
            <select value={currentMonth.getMonth()} onChange={(event) => changeMonth(Number(event.target.value))} className="mt-1.5 w-full rounded-control border border-line bg-surface px-3 py-2 text-sm text-ink outline-none focus:ring-2 focus:ring-primary">
              {MONTH_LABELS.map((month, index) => <option key={month} value={index} disabled={currentMonth.getFullYear() === firstAllowedMonth.getFullYear() && index < firstAllowedMonth.getMonth()}>{month}</option>)}
            </select>
          </label>
          <label className="text-xs font-medium text-ink-muted">Ano
            <select value={currentMonth.getFullYear()} onChange={(event) => changeYear(Number(event.target.value))} className="mt-1.5 w-full rounded-control border border-line bg-surface px-3 py-2 text-sm text-ink outline-none focus:ring-2 focus:ring-primary">
              {yearOptions.map((year) => <option key={year} value={year}>{year}</option>)}
            </select>
          </label>
        </div>
      )}

      <div className="grid grid-cols-7 gap-2 text-center text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-muted">
        {WEEKDAY_LABELS.map((weekday, index) => (
          <span key={`${weekday}-${index}`}>{weekday}</span>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-2">
        {calendarDays.map((date, index) => {
          if (!date) {
            return <div key={`empty-${index}`} className="h-11 rounded-card" />;
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
              className={`h-11 rounded-card text-sm font-medium transition-all ${active
                ? 'bg-primary text-white shadow-raised shadow-primary/25'
                : disabled
                  ? 'cursor-not-allowed bg-canvas text-line-strong'
                  : `border bg-surface text-ink hover:bg-primary-softer hover:text-primary ${today ? 'border-primary-line ring-1 ring-primary-line' : 'border-line'}`}`}
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
      className={`group flex w-full min-w-0 items-center justify-between rounded-card px-4 py-3 text-left transition-colors md:h-14 md:flex-1 md:rounded-none md:px-5 md:py-0 ${active ? 'bg-primary-softer' : 'hover:bg-canvas'}`}
    >
      <span className="flex min-w-0 flex-col">
        <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-ink">{title}</span>
        <span className={`mt-1 truncate text-sm ${value ? 'text-ink' : 'text-ink-muted'}`}>
          {value || placeholder}
        </span>
      </span>

      <svg className="ml-3 h-4 w-4 flex-shrink-0 text-primary opacity-70 transition-transform group-hover:translate-x-0.5 md:hidden" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="m9 5 7 7-7 7" />
      </svg>
    </button>
  );
}

export default function SearchBar({ onSearched }) {
  const navigate = useNavigate();
  const onSearchPage = !!useMatch('/buscar');
  const [params] = useSearchParams();
  const urlParam = (name) => (onSearchPage ? params.get(name) ?? '' : '');
  const wrapperRef = useRef(null);
  const [activeField, setActiveField] = useState(null);
  const [serviceQuery, setServiceQuery] = useState('');
  const [selectedLocation, setSelectedLocation] = useState(() => urlParam('cidade'));
  const [selectedService, setSelectedService] = useState(() => (urlParam('serviceId') ? { id: urlParam('serviceId'), name: urlParam('servico') } : null));
  const [catalogItems, setCatalogItems] = useState([]);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [catalogError, setCatalogError] = useState('');
  const [selectedServiceCategory, setSelectedServiceCategory] = useState(null);
  const [selectedDate, setSelectedDate] = useState(() => (urlParam('data') ? new Date(`${urlParam('data')}T12:00:00`) : null));
  const [currentMonth, setCurrentMonth] = useState(() => {
    const today = new Date();
    return new Date(today.getFullYear(), today.getMonth(), 1);
  });

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
    if (field === 'date' && !selectedDate) {
      const today = new Date();
      setCurrentMonth(new Date(today.getFullYear(), today.getMonth(), 1));
    }

    if (field === 'service') {
      setSelectedServiceCategory(null);
    }

    setActiveField((current) => (current === field ? null : field));
  }

  function selectLocation(location) {
    setSelectedLocation(location);
    setActiveField(null);
  }

  function selectService(service) {
    setSelectedService({ id: service.id, name: service.name, category: service.category });
    setServiceQuery('');
    setActiveField(null);
  }

  function selectDate(date) {
    if (isBeforeToday(date)) {
      return;
    }

    setSelectedDate(date);
    setActiveField(null);
  }

  function handleSearch() {
    // Todos os campos são opcionais: sem filtros, a busca lista todos os profissionais publicados.
    const next = new URLSearchParams();
    const category = urlParam('categoria');
    if (selectedLocation) next.set('cidade', selectedLocation);
    if (selectedDate) next.set('data', toDateKey(selectedDate));
    if (selectedService) {
      next.set('serviceId', String(selectedService.id));
      next.set('servico', selectedService.name);
    }
    if (category) next.set('categoria', category);
    const query = next.toString();
    setActiveField(null);
    navigate(query ? `/buscar?${query}` : '/buscar');
    onSearched?.();
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
      <div className="flex flex-col overflow-hidden rounded-panel border border-line-strong bg-surface shadow-card md:flex-row md:items-stretch">
        <div className="md:flex-1 md:min-w-0 md:border-r md:border-line">
          <SearchFieldButton
            title="Onde"
            value={selectedLocation}
            placeholder="Qualquer cidade"
            active={activeField === 'location'}
            onClick={() => openField('location')}
          />
        </div>

        <div className="md:flex-1 md:min-w-0 md:border-r md:border-line">
          <SearchFieldButton
            title="Quando"
            value={selectedDate ? formatShortDate(selectedDate) : ''}
            placeholder="Qualquer data"
            active={activeField === 'date'}
            onClick={() => openField('date')}
          />
        </div>

        <div className="md:flex-1 md:min-w-0 md:border-r md:border-line">
          <SearchFieldButton
            title="Que tipo de serviço"
            value={selectedService?.name}
            placeholder="Qualquer serviço"
            active={activeField === 'service'}
            onClick={() => openField('service')}
          />
        </div>

        <div className="flex justify-end px-4 pb-4 md:flex-none md:items-center md:px-3 md:pb-0 md:pl-3 md:pr-3">
          <button
            type="button"
            onClick={handleSearch}
            aria-label="Buscar profissionais"
            className="flex h-11 w-11 items-center justify-center rounded-full bg-primary text-white transition-colors hover:bg-primary-hover"
          >
            <svg className="h-4 w-4 md:h-5 md:w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="m21 21-4.35-4.35m2.1-5.4a7.5 7.5 0 1 1-15 0 7.5 7.5 0 0 1 15 0Z" />
            </svg>
          </button>
        </div>
      </div>

      {activeField && (
        <div className={`left-0 top-full z-50 mt-3 w-full max-h-[70dvh] overflow-y-auto rounded-panel md:absolute md:max-w-[calc(100vw-2rem)] border border-line bg-surface p-5 shadow-overlay ${panelPosition}`}>
          {activeField === 'location' && (
            <LocationPicker
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
              className="mt-5 text-sm font-medium text-primary hover:text-primary-hover"
            >
              Fechar
            </button>
          )}
        </div>
      )}
    </div>
  );
}
