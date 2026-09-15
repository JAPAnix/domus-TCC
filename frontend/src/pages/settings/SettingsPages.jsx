export function SettingsPlaceholder({ title, description }) {
  return (
    <>
      <h2 id="settings-page-title" className="text-xl font-semibold text-[#111827] sm:text-2xl">{title}</h2>
      <p className="mt-3 max-w-xl text-sm leading-relaxed text-[#6B7280]">{description}</p>
      <div className="mt-8 border-t border-[#E5E7EB] pt-8 pb-12">
        <span className="inline-block rounded-full bg-[#F5F3FF] px-3 py-1 text-xs font-medium text-[#5B21B6]">Em breve</span>
        <p className="mt-3 text-sm text-[#6B7280]">Esta seção está em preparação.</p>
      </div>
    </>
  );
}
