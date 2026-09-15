export default function ProfessionalPrice({ mode = 'hourly', hourly, daily }) {
  const money = value => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value));
  if (mode === 'quote') return <>Sob orçamento</>;
  return <>{money(mode === 'daily' ? daily : hourly)}{mode === 'daily' ? '/dia' : '/hora'}</>;
}
