import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';

const proficiencyOptions = [
  { value: 'beginner', label: 'Iniciante' },
  { value: 'intermediate', label: 'Intermediário' },
  { value: 'advanced', label: 'Avançado' },
  { value: 'expert', label: 'Especialista' }
];

const CreateProfessionalProfile = () => {
  const navigate = useNavigate();
  const { user, login, token } = useAuth();

  const [form, setForm] = useState({
    headline: '',
    bio: '',
    hourly_rate: '', daily_rate: '', city: '', state: '', catalog_service_ids: [], availability_dates: []
  });
  const [catalogItems, setCatalogItems] = useState([]);
  const [availabilityDate, setAvailabilityDate] = useState('');
  const [skills, setSkills] = useState([]);
  const [availableSkills, setAvailableSkills] = useState([]);
  const [selectedSkill, setSelectedSkill] = useState('');
  const [selectedProficiency, setSelectedProficiency] = useState('intermediate');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    const fetchSkills = async () => {
      try {
        const { data } = await api.get('/skills');
        setAvailableSkills(data);
      } catch {
        // skills opcionais, ignora erro
      }
    };
    fetchSkills();
  }, []);

  useEffect(() => { api.get('/service-catalog').then(({ data }) => setCatalogItems(data)).catch(() => setError('Não foi possível carregar o catálogo de serviços.')); }, []);

  useEffect(() => {
    if (!user?.uuid) return;
    let active = true;
    async function loadExistingProfile() {
      try {
        const { data } = await api.get(`/professionals/${user.uuid}`);
        if (!active) return;
        setIsEditing(true);
        setForm({ headline: data.headline ?? '', bio: data.bio ?? '', hourly_rate: data.hourlyRate ?? '', daily_rate: data.dailyRate ?? '', city: data.city ?? '', state: data.state ?? '', catalog_service_ids: (data.catalogServices ?? []).map((item) => item.catalogItemId), availability_dates: (data.availabilityEntries ?? []).map((item) => String(item.date).slice(0, 10)) });
        setSkills((data.skills ?? []).map((item) => ({ skill_id: item.skillId, proficiency_level: item.proficiencyLevel, name: item.skill?.name })));
      } catch (err) {
        if (err.response?.status !== 404 && active) setError('Não foi possível carregar seu perfil profissional.');
      }
    }
    loadExistingProfile();
    return () => { active = false; };
  }, [user?.uuid]);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const addSkill = () => {
    if (!selectedSkill) return;

    const already = skills.find(s => s.skill_id === Number(selectedSkill));
    if (already) return;

    const skill = availableSkills.find(s => s.id === Number(selectedSkill));
    setSkills([...skills, {
      skill_id: Number(selectedSkill),
      proficiency_level: selectedProficiency,
      name: skill?.name
    }]);
    setSelectedSkill('');
    setSelectedProficiency('intermediate');
  };

  const removeSkill = (skillId) => {
    setSkills(skills.filter(s => s.skill_id !== skillId));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const payload = {
        ...form,
        hourly_rate: Number(form.hourly_rate),
        daily_rate: form.daily_rate === '' ? null : Number(form.daily_rate),
        publish: true,
        skills: skills.map(({ skill_id, proficiency_level }) => ({ skill_id, proficiency_level }))
      };
      if (isEditing) await api.patch(`/professionals/${user.uuid}`, payload);
      else await api.post('/professionals', payload);

      login(token, { ...user, hasProfessionalProfile: true });
      navigate('/perfil');
    } catch (err) {
      setError(err.response?.data?.message || 'Erro ao criar perfil profissional');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F9FAFB] px-4 py-10">
      <div className="max-w-xl mx-auto">

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-[#111827]">{isEditing ? 'Editar perfil profissional' : 'Criar perfil profissional'}</h1>
          <p className="text-[#6B7280] mt-1">Configure seu perfil para aparecer nas buscas.</p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-sm border border-[#E5E7EB] p-8">

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-600 rounded-lg px-4 py-3 mb-4 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-[#111827] mb-1">
                Título profissional
              </label>
              <input
                type="text"
                name="headline"
                value={form.headline}
                onChange={handleChange}
                placeholder="Ex: Desenvolvedor Full Stack"
                className="w-full border border-[#E5E7EB] rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#7C3AED] focus:border-transparent"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <label className="block text-sm font-medium text-[#111827]">Valor por diária (R$)<input type="number" name="daily_rate" value={form.daily_rate} onChange={handleChange} min="0" step="0.01" className="mt-1 w-full border border-[#E5E7EB] rounded-lg px-4 py-2.5 text-sm" /></label>
              <label className="block text-sm font-medium text-[#111827]">UF<input type="text" name="state" value={form.state} onChange={handleChange} maxLength={2} required className="mt-1 w-full border border-[#E5E7EB] rounded-lg px-4 py-2.5 text-sm uppercase" /></label>
            </div>
            <label className="block text-sm font-medium text-[#111827]">Cidade de atendimento<input type="text" name="city" value={form.city} onChange={handleChange} required className="mt-1 w-full border border-[#E5E7EB] rounded-lg px-4 py-2.5 text-sm" /></label>
            <label className="block text-sm font-medium text-[#111827]">Serviços oferecidos
              <select multiple required value={form.catalog_service_ids} onChange={(event) => setForm({ ...form, catalog_service_ids: Array.from(event.target.selectedOptions, (option) => Number(option.value)) })} className="mt-1 h-36 w-full border border-[#E5E7EB] rounded-lg px-3 py-2 text-sm">
                {catalogItems.map((item) => <option key={item.id} value={item.id}>{item.category.name} — {item.name}</option>)}
              </select><span className="mt-1 block text-xs text-[#6B7280]">Use Ctrl/Cmd para selecionar mais de um serviço.</span>
            </label>
            <div><label className="block text-sm font-medium text-[#111827]">Datas disponíveis</label><div className="mt-1 flex gap-2"><input type="date" value={availabilityDate} min={new Date().toISOString().slice(0, 10)} onChange={(event) => setAvailabilityDate(event.target.value)} className="flex-1 border border-[#E5E7EB] rounded-lg px-3 py-2.5 text-sm" /><button type="button" onClick={() => { if (availabilityDate && !form.availability_dates.includes(availabilityDate)) setForm({ ...form, availability_dates: [...form.availability_dates, availabilityDate] }); setAvailabilityDate(''); }} className="rounded-lg bg-[#EDE9FE] px-3 text-sm font-semibold text-[#7C3AED]">Adicionar</button></div>{form.availability_dates.map((date) => <button type="button" key={date} onClick={() => setForm({ ...form, availability_dates: form.availability_dates.filter((item) => item !== date) })} className="mt-2 mr-2 rounded-full bg-[#EDE9FE] px-3 py-1 text-xs text-[#7C3AED]">{date} ×</button>)}</div>

            <div>
              <label className="block text-sm font-medium text-[#111827] mb-1">
                Biografia
              </label>
              <textarea
                name="bio"
                value={form.bio}
                onChange={handleChange}
                placeholder="Conte um pouco sobre você e sua experiência..."
                rows={4}
                className="w-full border border-[#E5E7EB] rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#7C3AED] focus:border-transparent resize-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-[#111827] mb-1">
                Valor por hora (R$)
              </label>
              <input
                type="number"
                name="hourly_rate"
                value={form.hourly_rate}
                onChange={handleChange}
                placeholder="0.00"
                min="0"
                step="0.01"
                required
                className="w-full border border-[#E5E7EB] rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#7C3AED] focus:border-transparent"
              />
            </div>

            {/* Skills */}
            {availableSkills.length > 0 && (
              <div>
                <label className="block text-sm font-medium text-[#111827] mb-1">
                  Habilidades
                </label>
                <div className="flex gap-2 mb-3">
                  <select
                    value={selectedSkill}
                    onChange={e => setSelectedSkill(e.target.value)}
                    className="flex-1 border border-[#E5E7EB] rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#7C3AED] focus:border-transparent"
                  >
                    <option value="">Selecione uma habilidade</option>
                    {availableSkills.map(s => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                  <select
                    value={selectedProficiency}
                    onChange={e => setSelectedProficiency(e.target.value)}
                    className="border border-[#E5E7EB] rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#7C3AED] focus:border-transparent"
                  >
                    {proficiencyOptions.map(o => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={addSkill}
                    className="bg-[#EDE9FE] text-[#7C3AED] font-semibold rounded-lg px-4 py-2.5 text-sm hover:bg-[#DDD6FE] transition-colors"
                  >
                    + Add
                  </button>
                </div>

                {skills.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {skills.map(s => (
                      <span
                        key={s.skill_id}
                        className="flex items-center gap-1 bg-[#EDE9FE] text-[#7C3AED] text-xs font-medium px-3 py-1.5 rounded-full"
                      >
                        {s.name}
                        <button
                          type="button"
                          onClick={() => removeSkill(s.skill_id)}
                          className="ml-1 hover:text-red-500 transition-colors"
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => navigate('/perfil')}
                className="flex-1 border border-[#E5E7EB] text-[#6B7280] hover:bg-[#F9FAFB] font-semibold rounded-lg py-2.5 text-sm transition-colors"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-1 bg-[#7C3AED] hover:bg-[#6D28D9] text-white font-semibold rounded-lg py-2.5 text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Salvando...' : isEditing ? 'Salvar alterações' : 'Criar perfil'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default CreateProfessionalProfile;
