// `professional: true` só aparece para quem tem perfil profissional.
export const settingsSections = [
  { path: 'pessoais', title: 'Informações pessoais', icon: 'M20 21v-2a7 7 0 0 0-14 0v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8' },
  { path: 'seguranca', title: 'Login e segurança', icon: 'M12 3 4 6v6c0 5 8 9 8 9s8-4 8-9V6l-8-3ZM9 12l2 2 4-4' },
  { path: 'privacidade', title: 'Privacidade', icon: 'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12ZM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6' },
  { path: 'notificacoes', title: 'Notificações', icon: 'M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4' },
  { path: 'impostos', title: 'Impostos', professional: true, icon: 'M7 3h10l4 4v14H3V3h4ZM8 11h8M8 15h8M8 7h4' },
  { path: 'pagamentos', title: 'Pagamentos', icon: 'M3 4h18v16H3V4ZM3 9h18M7 15h4' },
  { path: 'idioma', title: 'Idioma e tradução', icon: 'M21 12a9 9 0 1 0-18 0 9 9 0 0 0 18 0ZM3 12h18M12 3c-5 5-5 13 0 18 5-5 5-13 0-18Z' },
];
