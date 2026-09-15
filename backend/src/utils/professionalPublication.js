export function assertPublishable(profile) {
  const fail = message => { throw new Error(message + ' antes de publicar.'); };
  if (!profile.displayName?.trim()) fail('Informe o nome profissional');
  if (!profile.headline?.trim()) fail('Informe o título profissional');
  if (!profile.bio?.trim()) fail('Escreva sua apresentação');
  if (!profile.city || !profile.state) fail('Informe cidade e estado');
  if (!profile.serviceRegion?.trim()) fail('Informe a região de atendimento');
  if (!profile.catalogServiceIds?.length) fail('Selecione pelo menos um serviço');
  if (!profile.availabilityDates?.length) fail('Adicione pelo menos uma data disponível');
  if (profile.billingMode === 'hourly' && !(Number(profile.hourlyRate) > 0)) fail('Defina um valor por hora');
  if (profile.billingMode === 'daily' && !(Number(profile.dailyRate) > 0)) fail('Defina um valor por diária');
  if (!['hourly', 'daily', 'quote'].includes(profile.billingMode)) fail('Selecione a forma de cobrança');
}
