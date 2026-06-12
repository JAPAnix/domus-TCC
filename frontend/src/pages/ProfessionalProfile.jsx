import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import api from "../services/api";

const AVAILABILITY_LABELS = {
  available: "Disponível",
  busy: "Ocupado",
  offline: "Offline",
};

const AVAILABILITY_STYLES = {
  available: "bg-emerald-100 text-emerald-700",
  busy: "bg-amber-100 text-amber-700",
  offline: "bg-slate-100 text-slate-500",
};

const PROFICIENCY_LABELS = {
  beginner: "Iniciante",
  intermediate: "Intermediário",
  advanced: "Avançado",
  expert: "Especialista",
};

function formatCurrency(value) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(value));
}

function StarRating({ rating }) {
  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <span key={star} className={`text-lg ${Number(rating) >= star ? "text-amber-400" : "text-slate-200"}`}>★</span>
      ))}
      <span className="ml-1 text-sm font-semibold text-[#111827]">{Number(rating).toFixed(1)}</span>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="animate-pulse space-y-6">
      <div className="flex items-center gap-4">
        <div className="w-20 h-20 rounded-full bg-slate-200" />
        <div className="space-y-2 flex-1">
          <div className="h-6 bg-slate-200 rounded w-1/3" />
          <div className="h-4 bg-slate-100 rounded w-1/2" />
        </div>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-24 bg-slate-100 rounded-xl" />
        ))}
      </div>
    </div>
  );
}

export default function ProfessionalProfile() {
  const { uuid } = useParams();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    async function loadProfile() {
      try {
        setLoading(true);
        setError("");
        const { data } = await api.get(`/professionals/${uuid}`);
        if (active) setProfile(data);
      } catch (err) {
        if (active) setError(err.response?.data?.message || "Não foi possível carregar o perfil.");
      } finally {
        if (active) setLoading(false);
      }
    }

    if (uuid) loadProfile();
    else {
      setLoading(false);
      setError("UUID do profissional não informado.");
    }

    return () => { active = false; };
  }, [uuid]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F9FAFB] px-4 py-10">
        <div className="max-w-4xl mx-auto">
          <LoadingSkeleton />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#F9FAFB] flex flex-col items-center justify-center text-center px-4">
        <div className="mb-4 text-4xl">😕</div>
        <h2 className="text-xl font-semibold text-[#111827] mb-2">Perfil não encontrado</h2>
        <p className="text-[#6B7280] text-sm mb-6">{error}</p>
        <Link to="/" className="rounded-lg bg-[#7C3AED] px-4 py-2 text-sm font-medium text-white hover:bg-[#6D28D9] transition-colors">
          ← Voltar ao início
        </Link>
      </div>
    );
  }

  const skills = profile?.skills ?? [];

  return (
    <div className="min-h-screen bg-[#F9FAFB] px-4 py-10">
      <div className="max-w-4xl mx-auto space-y-6">

        {/* Header */}
        <div className="bg-white rounded-2xl border border-[#E5E7EB] p-6 sm:p-8">
          <div className="flex items-center gap-5">
            <div className="w-20 h-20 rounded-full bg-[#EDE9FE] flex items-center justify-center text-[#7C3AED] text-2xl font-bold flex-shrink-0">
              {(profile?.firstName ?? "?")[0].toUpperCase()}
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-xl font-bold text-[#111827]">
                  {profile?.firstName} {profile?.lastName}
                </h1>
                {profile?.isVerified && (
                  <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">
                    ✓ Verificado
                  </span>
                )}
                <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${AVAILABILITY_STYLES[profile?.availabilityStatus] ?? AVAILABILITY_STYLES.offline}`}>
                  {AVAILABILITY_LABELS[profile?.availabilityStatus] ?? profile?.availabilityStatus}
                </span>
              </div>
              {profile?.headline && (
                <p className="text-[#6B7280] text-sm mt-1">{profile.headline}</p>
              )}
              <div className="mt-2">
                <StarRating rating={profile?.averageRating ?? 0} />
                <p className="text-xs text-[#6B7280] mt-0.5">{profile?.totalReviews ?? 0} avaliações</p>
              </div>
            </div>
            <div className="text-right flex-shrink-0">
              <p className="text-xs text-[#6B7280] uppercase tracking-wide">Valor/hora</p>
              <p className="text-xl font-bold text-[#7C3AED]">{formatCurrency(profile?.hourlyRate ?? 0)}</p>
            </div>
          </div>
        </div>

        {/* Bio */}
        {profile?.bio && (
          <div className="bg-white rounded-2xl border border-[#E5E7EB] p-6">
            <h2 className="text-sm font-semibold text-[#111827] uppercase tracking-wide mb-3">Sobre</h2>
            <p className="text-[#6B7280] leading-relaxed text-sm">{profile.bio}</p>
          </div>
        )}

        {/* Skills */}
        <div className="bg-white rounded-2xl border border-[#E5E7EB] p-6">
          <h2 className="text-sm font-semibold text-[#111827] uppercase tracking-wide mb-4">Habilidades</h2>
          {skills.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {skills.map((s) => (
                <span
                  key={s.skillId ?? s.skill?.id}
                  className="flex items-center gap-1.5 bg-[#EDE9FE] text-[#7C3AED] text-xs font-medium px-3 py-1.5 rounded-full"
                >
                  {s.skill?.name}
                  <span className="text-[#A78BFA]">· {PROFICIENCY_LABELS[s.proficiencyLevel] ?? s.proficiencyLevel}</span>
                </span>
              ))}
            </div>
          ) : (
            <p className="text-[#6B7280] text-sm">Nenhuma habilidade cadastrada.</p>
          )}
        </div>

      </div>
    </div>
  );
}