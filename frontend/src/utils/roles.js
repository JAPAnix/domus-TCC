export function roleLabel(roles = []) {
  const client = roles.includes('client');
  const professional = roles.includes('professional');
  if (client && professional) return 'Cliente e profissional';
  if (professional) return 'Profissional';
  return 'Cliente';
}

export const STATES = 'AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS RO RR SC SP SE TO'.split(' ');
