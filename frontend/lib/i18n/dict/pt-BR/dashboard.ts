export const dashboard = {
  header: {
    greetingMorning: (name?: string) => (name ? `Bom dia, ${name}` : 'Bom dia'),
    greetingAfternoon: (name?: string) =>
      name ? `Boa tarde, ${name}` : 'Boa tarde',
    greetingEvening: (name?: string) =>
      name ? `Boa noite, ${name}` : 'Boa noite',
    subtitle: (orgName: string) => `Aqui está um resumo de ${orgName}.`,
    subtitleNoOrg: 'Aqui está um resumo da sua organização.',
  },
  stats: {
    sectionTitle: 'Visão geral',
    members: 'Membros',
    pendingInvites: 'Convites pendentes',
    role: 'Sua função',
    createdAt: 'Criada em',
    viewDetails: 'Ver detalhes',
    loadError: 'Não foi possível carregar',
    retry: (label: string) => `Tentar novamente: ${label}`,
  },
  actions: {
    sectionTitle: 'Ações rápidas',
    inviteTitle: 'Convidar membro',
    inviteDescription: 'Chame alguém para o seu time.',
    settingsTitle: 'Configurações',
    settingsDescription: 'Nome, identificador e membros.',
    createOrgTitle: 'Nova organização',
    createOrgDescription: 'Crie outro espaço de trabalho.',
  },
  states: {
    noActiveOrgTitle: 'Nenhuma organização ativa',
    noActiveOrgBody:
      'Escolha uma organização no seletor acima ou crie uma nova para começar.',
    noActiveOrgCta: 'Criar organização',
    orgErrorBody: 'Não foi possível carregar os dados da organização.',
    orgErrorRetry: 'Tentar novamente',
  },
} as const;
