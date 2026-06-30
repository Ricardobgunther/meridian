export const orgs = {
  switcher: {
    title: 'Suas organizações',
    searchPlaceholder: 'Buscar organização',
    searchLabel: 'Buscar organização',
    triggerLabel: (orgName: string) =>
      `Trocar organização. Atual: ${orgName}.`,
    createCta: 'Criar organização',
    createCtaShort: '+ Criar organização',
    emptyError: 'Não foi possível carregar a lista de organizações.',
    retry: 'Tentar novamente',
    listLabel: 'Suas organizações',
    switchedTo: (name: string) => `Organização trocada para ${name}`,
    switchError: 'Não foi possível trocar de organização. Tente novamente.',
  },
  roleBadge: {
    owner: 'Dono',
    admin: 'Admin',
    member: 'Membro',
  },
  roleFull: {
    owner: 'Proprietário',
    admin: 'Administrador',
    member: 'Membro',
  },
  create: {
    title: 'Criar organização',
    description: 'Organize seu time em um espaço compartilhado.',
    nameLabel: 'Nome',
    nameHelper: 'Aparece para todos os membros.',
    namePlaceholder: 'Ex: Acme Brasil',
    slugLabel: 'Identificador (slug)',
    slugHelper: 'Será usado em URLs: app.exemplo.com/org/{slug}',
    slugPlaceholder: 'Ex: acme-brasil',
    cancel: 'Cancelar',
    submit: 'Criar',
    submitting: 'Criando...',
    success: 'Organização criada',
    networkError:
      'Falha de rede. Verifique sua conexão e tente novamente.',
    errors: {
      nameRequired: 'Informe um nome para a organização.',
      nameMin: 'O nome precisa ter pelo menos 2 caracteres.',
      nameMax: 'O nome pode ter no máximo 120 caracteres.',
      slugRequired: 'Informe um identificador.',
      slugPattern:
        'Use apenas letras minúsculas, números e hífens (sem espaços).',
      slugMin: 'O identificador precisa ter pelo menos 3 caracteres.',
      slugMax: 'O identificador pode ter no máximo 60 caracteres.',
      slugTaken: 'Este identificador já está em uso. Tente outro.',
    },
    slugCheck: {
      checking: 'Verificando disponibilidade…',
      available: 'Disponível',
      // "taken" reusa t.orgs.create.errors.slugTaken — uma mensagem, dois
      // momentos (preview e 422 pós-submit). Não duplicar a string.
    },
  },
} as const;
