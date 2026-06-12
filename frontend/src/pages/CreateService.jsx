import { useState, useEffect } from "react";
import api from "../services/api";
import { useAuth } from "../context/AuthContext";

function errorMessage(err) {
  const status = err?.response?.status;
  if (status === 400) return err?.response?.data?.message || "Dados inválidos. Verifique os campos e tente novamente.";
  if (status === 401) return "Sessão expirada. Faça login novamente.";
  if (status === 403) return "Você não tem permissão para criar serviços.";
  if (status === 500) return "Erro interno do servidor. Tente novamente.";
  return err?.response?.data?.message || "Erro ao criar serviço.";
}

const INITIAL_FORM = {
  title: "",
  description: "",
  category_id: "",
  budget_min: "",
  budget_max: "",
  deadline: "",
};

function Field({ label, error, required, children }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-medium text-slate-700">
        {label}
        {required && <span className="text-red-400 ml-0.5">*</span>}
      </label>
      {children}
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
}

const inputClass = "rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#7C3AED] focus:border-transparent transition-shadow";
const inputErrorClass = "rounded-lg border border-red-300 bg-red-50 px-3 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-red-400 focus:border-transparent transition-shadow";

function getInputClass(hasError) {
  return hasError ? inputErrorClass : inputClass;
}

export default function CreateService() {
  const { user } = useAuth();

  const [form, setForm] = useState(INITIAL_FORM);
  const [fieldErrors, setFieldErrors] = useState({});
  const [categories, setCategories] = useState([]);
  const [loadingCategories, setLoadingCategories] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [globalError, setGlobalError] = useState(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    async function fetchCategories() {
      try {
        const { data } = await api.get('/categories');
        setCategories(data);
      } catch {
        // non-critical
      } finally {
        setLoadingCategories(false);
      }
    }
    fetchCategories();
  }, []);

  function handleChange(e) {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    if (fieldErrors[name]) {
      setFieldErrors((prev) => ({ ...prev, [name]: null }));
    }
    setSuccess(false);
    setGlobalError(null);
  }

  function validate() {
    const errors = {};
    if (!form.title.trim()) errors.title = "Título é obrigatório.";
    if (!form.description.trim()) errors.description = "Descrição é obrigatória.";
    if (!form.category_id) errors.category_id = "Categoria é obrigatória.";
    if (!form.budget_min) {
      errors.budget_min = "Budget mínimo é obrigatório.";
    } else if (Number(form.budget_min) < 0) {
      errors.budget_min = "Budget mínimo não pode ser negativo.";
    }
    if (!form.budget_max) {
      errors.budget_max = "Budget máximo é obrigatório.";
    } else if (Number(form.budget_max) < 0) {
      errors.budget_max = "Budget máximo não pode ser negativo.";
    }
    if (form.budget_min && form.budget_max && Number(form.budget_min) > Number(form.budget_max)) {
      errors.budget_min = "Budget mínimo não pode ser maior que o máximo.";
    }
    if (!form.deadline) errors.deadline = "Prazo é obrigatório.";
    return errors;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const errors = validate();
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    setSubmitting(true);
    setGlobalError(null);
    setSuccess(false);

    try {
      await api.post('/services', {
        title: form.title.trim(),
        description: form.description.trim(),
        category_id: Number(form.category_id),
        budget_min: Number(form.budget_min),
        budget_max: Number(form.budget_max),
        deadline: form.deadline,
      });

      setForm(INITIAL_FORM);
      setFieldErrors({});
      setSuccess(true);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      setGlobalError(errorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#F9FAFB]">
      <header className="bg-white border-b border-[#E5E7EB]">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8">
          <h1 className="text-2xl sm:text-3xl font-bold text-[#111827] mb-1">
            Publicar serviço
          </h1>
          <p className="text-[#6B7280] text-sm">
            Descreva o que precisa e receba propostas de profissionais.
          </p>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 sm:px-6 py-8">
        {success && (
          <div className="mb-6 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 px-4 py-3 text-sm flex items-center gap-2">
            <span>✓</span> Serviço publicado com sucesso! Aguarde propostas.
          </div>
        )}

        {globalError && (
          <div className="mb-6 rounded-xl bg-red-50 border border-red-200 text-red-700 px-4 py-3 text-sm flex items-center gap-2">
            <span>⚠</span> {globalError}
          </div>
        )}

        <form
          onSubmit={handleSubmit}
          noValidate
          className="bg-white rounded-2xl border border-[#E5E7EB] p-6 sm:p-8 space-y-6"
        >
          <Field label="Título" required error={fieldErrors.title}>
            <input
              type="text"
              name="title"
              value={form.title}
              onChange={handleChange}
              placeholder="Ex.: Desenvolvimento de landing page"
              className={getInputClass(!!fieldErrors.title)}
            />
          </Field>

          <Field label="Descrição" required error={fieldErrors.description}>
            <textarea
              name="description"
              value={form.description}
              onChange={handleChange}
              rows={4}
              placeholder="Descreva em detalhes o que você precisa..."
              className={getInputClass(!!fieldErrors.description)}
            />
          </Field>

          <Field label="Categoria" required error={fieldErrors.category_id}>
            <select
              name="category_id"
              value={form.category_id}
              onChange={handleChange}
              disabled={loadingCategories}
              className={getInputClass(!!fieldErrors.category_id)}
            >
              <option value="">
                {loadingCategories ? "Carregando categorias..." : "Selecione uma categoria"}
              </option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </Field>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Budget mínimo (R$)" required error={fieldErrors.budget_min}>
              <input
                type="number"
                name="budget_min"
                value={form.budget_min}
                onChange={handleChange}
                min="0"
                step="0.01"
                placeholder="500"
                className={getInputClass(!!fieldErrors.budget_min)}
              />
            </Field>

            <Field label="Budget máximo (R$)" required error={fieldErrors.budget_max}>
              <input
                type="number"
                name="budget_max"
                value={form.budget_max}
                onChange={handleChange}
                min="0"
                step="0.01"
                placeholder="3000"
                className={getInputClass(!!fieldErrors.budget_max)}
              />
            </Field>
          </div>

          <Field label="Prazo" required error={fieldErrors.deadline}>
            <input
              type="date"
              name="deadline"
              value={form.deadline}
              onChange={handleChange}
              min={new Date().toISOString().split("T")[0]}
              className={getInputClass(!!fieldErrors.deadline)}
            />
          </Field>

          <div className="pt-2">
            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-lg bg-[#7C3AED] hover:bg-[#6D28D9] px-6 py-3 text-sm font-semibold text-white disabled:opacity-60 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
            >
              {submitting ? (
                <>
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Publicando...
                </>
              ) : (
                "Publicar serviço"
              )}
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}