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
    hourly_rate: ''
  });
  const [skills, setSkills] = useState([]);
  const [availableSkills, setAvailableSkills] = useState([]);
  const [selectedSkill, setSelectedSkill] = useState('');
  const [selectedProficiency, setSelectedProficiency] = useState('intermediate');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

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
      await api.post('/professionals', {
        ...form,
        hourly_rate: Number(form.hourly_rate),
        skills: skills.map(({ skill_id, proficiency_level }) => ({ skill_id, proficiency_level }))
      });

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
          <h1 className="text-2xl font-bold text-[#111827]">Criar Perfil Profissional</h1>
          <p className="text-[#6B7280] mt-1">Configure seu perfil para receber propostas</p>
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
                {loading ? 'Criando...' : 'Criar perfil'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default CreateProfessionalProfile;