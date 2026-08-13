import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const stats = [
  { value: '+500', label: 'Profissionais ativos' },
  { value: '+1.200', label: 'Projetos realizados' },
  { value: '+800', label: 'Clientes satisfeitos' },
  { value: '4.9★', label: 'Avaliação média' },
];

const categories = [
  { icon: '💻', name: 'Desenvolvimento Web' },
  { icon: '📱', name: 'Desenvolvimento Mobile' },
  { icon: '🎨', name: 'UI/UX Design' },
  { icon: '📈', name: 'Marketing Digital' },
  { icon: '✍️', name: 'Redação e Conteúdo' },
  { icon: '🔧', name: 'Consultoria de TI' },
];

const howItWorksClient = [
  { step: '1', title: 'Publique seu projeto', description: 'Descreva o que precisa, defina o orçamento e o prazo.' },
  { step: '2', title: 'Receba propostas', description: 'Profissionais qualificados enviam propostas para o seu projeto.' },
  { step: '3', title: 'Escolha e contrate', description: 'Avalie os perfis, escolha o melhor e comece o trabalho.' },
];

const howItWorksPro = [
  { step: '1', title: 'Crie seu perfil', description: 'Mostre suas habilidades, experiência e valor por hora.' },
  { step: '2', title: 'Encontre projetos', description: 'Navegue pelos serviços disponíveis e envie propostas.' },
  { step: '3', title: 'Trabalhe e seja avaliado', description: 'Entregue um ótimo trabalho e construa sua reputação.' },
];

const testimonials = [
  { name: 'Maria Silva', role: 'Designer Freelancer', text: 'Encontrei ótimos clientes pelo domus. A plataforma é simples e os pagamentos são seguros.', rating: 5 },
  { name: 'Carlos Souza', role: 'Dono de startup', text: 'Contratei um desenvolvedor em menos de 24h. Qualidade incrível pelo preço justo.', rating: 5 },
  { name: 'Ana Lima', role: 'Redatora', text: 'O domus transformou minha carreira freelancer. Recomendo para todos os profissionais.', rating: 5 },
];

export default function Landing() {
  const { user } = useAuth();

  return (
    <div className="min-h-screen bg-white">

      {/* Hero */}
      <section className="bg-gradient-to-br from-[#7C3AED] to-[#4F46E5] text-white px-4 py-24 sm:py-32">
        <div className="max-w-4xl mx-auto text-center">
          <span className="inline-block bg-white/20 text-white text-xs font-semibold px-3 py-1.5 rounded-full mb-6 tracking-wide">
            🚀 A plataforma de serviços freelance do Brasil
          </span>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold leading-tight mb-6">
            Conectamos <span className="text-[#A78BFA]">talentos</span> com{' '}
            <span className="text-[#A78BFA]">oportunidades</span> incríveis
          </h1>
          <p className="text-lg sm:text-xl text-white/80 mb-10 max-w-2xl mx-auto">
            Encontre os melhores profissionais para o seu projeto ou ofereça seus serviços e impulsione sua carreira.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              to="/servicos"
              className="bg-white text-[#7C3AED] font-semibold px-8 py-3.5 rounded-xl hover:bg-[#F5F3FF] transition-colors text-sm"
            >
              Contratar profissional
            </Link>
            {user ? (
              <Link
                to="/perfil/profissional"
                className="bg-white/10 border border-white/30 text-white font-semibold px-8 py-3.5 rounded-xl hover:bg-white/20 transition-colors text-sm"
              >
                Oferecer serviços
              </Link>
            ) : (
              <Link
                to="/cadastro"
                className="bg-white/10 border border-white/30 text-white font-semibold px-8 py-3.5 rounded-xl hover:bg-white/20 transition-colors text-sm"
              >
                Cadastrar como profissional
              </Link>
            )}
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="bg-[#F9FAFB] border-b border-[#E5E7EB]">
        <div className="max-w-4xl mx-auto px-4 py-12 grid grid-cols-2 sm:grid-cols-4 gap-8 text-center">
          {stats.map((s) => (
            <div key={s.label}>
              <p className="text-3xl font-bold text-[#7C3AED]">{s.value}</p>
              <p className="text-sm text-[#6B7280] mt-1">{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Categorias */}
      <section className="max-w-5xl mx-auto px-4 py-20">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-[#111827]">Explore por categoria</h2>
          <p className="text-[#6B7280] mt-3">Encontre profissionais em diversas áreas</p>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
          {categories.map((c) => (
            <Link
              key={c.name}
              to="/servicos"
              className="bg-white border border-[#E5E7EB] rounded-2xl p-5 text-center hover:border-[#7C3AED] hover:shadow-md transition-all group"
            >
              <span className="text-3xl block mb-3">{c.icon}</span>
              <p className="text-xs font-medium text-[#111827] group-hover:text-[#7C3AED] transition-colors leading-tight">
                {c.name}
              </p>
            </Link>
          ))}
        </div>
      </section>

      {/* Como funciona — Cliente */}
      <section className="bg-[#F9FAFB] px-4 py-20">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <span className="text-xs font-semibold text-[#7C3AED] uppercase tracking-wide">Para clientes</span>
            <h2 className="text-3xl font-bold text-[#111827] mt-2">Como contratar um profissional</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-8">
            {howItWorksClient.map((item) => (
              <div key={item.step} className="text-center">
                <div className="w-12 h-12 rounded-full bg-[#7C3AED] text-white text-lg font-bold flex items-center justify-center mx-auto mb-4">
                  {item.step}
                </div>
                <h3 className="font-semibold text-[#111827] mb-2">{item.title}</h3>
                <p className="text-sm text-[#6B7280]">{item.description}</p>
              </div>
            ))}
          </div>
          <div className="text-center mt-10">
            <Link
              to="/servicos"
              className="bg-[#7C3AED] hover:bg-[#6D28D9] text-white font-semibold px-8 py-3 rounded-xl text-sm transition-colors"
            >
              Ver serviços disponíveis →
            </Link>
          </div>
        </div>
      </section>

      {/* Como funciona — Profissional */}
      <section className="px-4 py-20">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <span className="text-xs font-semibold text-[#7C3AED] uppercase tracking-wide">Para profissionais</span>
            <h2 className="text-3xl font-bold text-[#111827] mt-2">Como começar a trabalhar</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-8">
            {howItWorksPro.map((item) => (
              <div key={item.step} className="text-center">
                <div className="w-12 h-12 rounded-full bg-[#EDE9FE] text-[#7C3AED] text-lg font-bold flex items-center justify-center mx-auto mb-4">
                  {item.step}
                </div>
                <h3 className="font-semibold text-[#111827] mb-2">{item.title}</h3>
                <p className="text-sm text-[#6B7280]">{item.description}</p>
              </div>
            ))}
          </div>
          <div className="text-center mt-10">
            <Link
              to={user ? '/perfil/profissional' : '/cadastro'}
              className="border border-[#7C3AED] text-[#7C3AED] hover:bg-[#EDE9FE] font-semibold px-8 py-3 rounded-xl text-sm transition-colors"
            >
              Criar perfil profissional →
            </Link>
          </div>
        </div>
      </section>

      {/* Depoimentos */}
      <section className="bg-[#F9FAFB] px-4 py-20">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-[#111827]">O que dizem nossos usuários</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            {testimonials.map((t) => (
              <div key={t.name} className="bg-white rounded-2xl border border-[#E5E7EB] p-6">
                <div className="flex gap-1 mb-3">
                  {Array.from({ length: t.rating }).map((_, i) => (
                    <span key={i} className="text-amber-400">★</span>
                  ))}
                </div>
                <p className="text-sm text-[#6B7280] leading-relaxed mb-4">"{t.text}"</p>
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-[#EDE9FE] flex items-center justify-center text-[#7C3AED] font-bold text-sm">
                    {t.name[0]}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-[#111827]">{t.name}</p>
                    <p className="text-xs text-[#6B7280]">{t.role}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Final */}
      <section className="bg-gradient-to-br from-[#7C3AED] to-[#4F46E5] text-white px-4 py-20 text-center">
        <div className="max-w-2xl mx-auto">
          <h2 className="text-3xl sm:text-4xl font-bold mb-4">Pronto para começar?</h2>
          <p className="text-white/80 mb-8">Junte-se a milhares de profissionais e clientes que já usam o domus.</p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              to="/cadastro"
              className="bg-white text-[#7C3AED] font-semibold px-8 py-3.5 rounded-xl hover:bg-[#F5F3FF] transition-colors text-sm"
            >
              Criar conta grátis
            </Link>
            <Link
              to="/servicos"
              className="bg-white/10 border border-white/30 text-white font-semibold px-8 py-3.5 rounded-xl hover:bg-white/20 transition-colors text-sm"
            >
              Explorar serviços
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-white border-t border-[#E5E7EB] px-4 py-8 text-center">
        <p className="text-[#7C3AED] font-bold text-xl mb-2">domus</p>
        <p className="text-xs text-[#6B7280]">© 2026 domus. Todos os direitos reservados.</p>
      </footer>

    </div>
  );
}