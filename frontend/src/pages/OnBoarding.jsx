import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';

const steps = ['Contato', 'Endereço'];

const Onboarding = () => {
  const navigate = useNavigate();
  const { user, login, token } = useAuth();

  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [fetchingCep, setFetchingCep] = useState(false);
  const [error, setError] = useState('');
  const [cepError, setCepError] = useState('');

  const [form, setForm] = useState({
    phone_number: '',
    zip_code: '',
    street: '',
    number: '',
    complement: '',
    neighborhood: '',
    city: '',
    state: ''
  });

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleCepBlur = async () => {
    const cep = form.zip_code.replace(/\D/g, '');
    if (cep.length !== 8) return;

    setCepError('');
    setFetchingCep(true);

    try {
      const response = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
      const data = await response.json();

      if (data.erro) {
        setCepError('CEP não encontrado.');
        return;
      }

      setForm(prev => ({
        ...prev,
        street: data.logradouro || '',
        neighborhood: data.bairro || '',
        city: data.localidade || '',
        state: data.uf || ''
      }));
    } catch {
      setCepError('Erro ao buscar CEP. Tente novamente.');
    } finally {
      setFetchingCep(false);
    }
  };

  const handleNext = () => {
    if (step === 0 && !form.phone_number) {
      setError('Telefone é obrigatório.');
      return;
    }
    setError('');
    setStep(1);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!form.zip_code || !form.street || !form.number || !form.city || !form.state) {
      setError('Preencha todos os campos obrigatórios do endereço.');
      return;
    }

    setSaving(true);

    try {
      const { data } = await api.patch(`/users/${user.uuid}`, form);
      login(token, { ...user, ...data });
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.message || 'Erro ao salvar informações.');
    } finally {
      setSaving(false);
    }
  };

  const inputClass = "w-full border border-[#E5E7EB] rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#7C3AED] focus:border-transparent";

  return (
    <div className="min-h-screen bg-[#F9FAFB] flex items-center justify-center px-4">
      <div className="w-full max-w-md">

        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-[#7C3AED]">domus</h1>
          <p className="text-[#6B7280] mt-2">Olá, {user?.firstName}! Vamos completar seu cadastro.</p>
        </div>

        {/* Steps */}
        <div className="flex items-center gap-2 mb-8">
          {steps.map((s, i) => (
            <div key={s} className="flex items-center gap-2 flex-1">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold flex-shrink-0 transition-colors ${
                i <= step ? 'bg-[#7C3AED] text-white' : 'bg-[#E5E7EB] text-[#6B7280]'
              }`}>
                {i < step ? '✓' : i + 1}
              </div>
              <span className={`text-sm ${i === step ? 'text-[#111827] font-medium' : 'text-[#6B7280]'}`}>
                {s}
              </span>
              {i < steps.length - 1 && (
                <div className={`flex-1 h-0.5 mx-2 ${i < step ? 'bg-[#7C3AED]' : 'bg-[#E5E7EB]'}`} />
              )}
            </div>
          ))}
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-sm border border-[#E5E7EB] p-8">

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-600 rounded-lg px-4 py-3 mb-4 text-sm">
              {error}
            </div>
          )}

          {/* Step 1 — Contato */}
          {step === 0 && (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold text-[#111827] mb-4">Informações de contato</h2>

              <div>
                <label className="block text-sm font-medium text-[#111827] mb-1">
                  Telefone <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  name="phone_number"
                  value={form.phone_number}
                  onChange={handleChange}
                  placeholder="(11) 99999-9999"
                  className={inputClass}
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => navigate('/')}
                  className="flex-1 border border-[#E5E7EB] text-[#6B7280] hover:bg-[#F9FAFB] font-semibold rounded-lg py-2.5 text-sm transition-colors"
                >
                  Pular por agora
                </button>
                <button
                  type="button"
                  onClick={handleNext}
                  className="flex-1 bg-[#7C3AED] hover:bg-[#6D28D9] text-white font-semibold rounded-lg py-2.5 text-sm transition-colors"
                >
                  Próximo →
                </button>
              </div>
            </div>
          )}

          {/* Step 2 — Endereço */}
          {step === 1 && (
            <form onSubmit={handleSubmit} className="space-y-4">
              <h2 className="text-lg font-semibold text-[#111827] mb-4">Endereço</h2>

              <div>
                <label className="block text-sm font-medium text-[#111827] mb-1">
                  CEP <span className="text-red-400">*</span>
                </label>
                <div className="relative">
                  <input
                    type="text"
                    name="zip_code"
                    value={form.zip_code}
                    onChange={handleChange}
                    onBlur={handleCepBlur}
                    placeholder="00000-000"
                    maxLength={9}
                    className={inputClass}
                  />
                  {fetchingCep && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                      <span className="w-4 h-4 border-2 border-[#7C3AED] border-t-transparent rounded-full animate-spin inline-block" />
                    </div>
                  )}
                </div>
                {cepError && <p className="text-xs text-red-500 mt-1">{cepError}</p>}
                <p className="text-xs text-[#6B7280] mt-1">Digite o CEP para preencher automaticamente</p>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-[#111827] mb-1">
                    Rua <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    name="street"
                    value={form.street}
                    onChange={handleChange}
                    placeholder="Preenchido automaticamente"
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[#111827] mb-1">
                    Número <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    name="number"
                    value={form.number}
                    onChange={handleChange}
                    placeholder="123"
                    className={inputClass}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-[#111827] mb-1">Complemento</label>
                <input
                  type="text"
                  name="complement"
                  value={form.complement}
                  onChange={handleChange}
                  placeholder="Apto, sala, bloco... (opcional)"
                  className={inputClass}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-[#111827] mb-1">Bairro</label>
                <input
                  type="text"
                  name="neighborhood"
                  value={form.neighborhood}
                  onChange={handleChange}
                  placeholder="Preenchido automaticamente"
                  className={inputClass}
                />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-[#111827] mb-1">
                    Cidade <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    name="city"
                    value={form.city}
                    onChange={handleChange}
                    placeholder="Preenchido automaticamente"
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[#111827] mb-1">
                    Estado <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    name="state"
                    value={form.state}
                    onChange={handleChange}
                    placeholder="SP"
                    maxLength={2}
                    className={`${inputClass} uppercase`}
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setStep(0)}
                  className="flex-1 border border-[#E5E7EB] text-[#6B7280] hover:bg-[#F9FAFB] font-semibold rounded-lg py-2.5 text-sm transition-colors"
                >
                  ← Voltar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 bg-[#7C3AED] hover:bg-[#6D28D9] text-white font-semibold rounded-lg py-2.5 text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {saving ? 'Salvando...' : 'Concluir cadastro'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

export default Onboarding;