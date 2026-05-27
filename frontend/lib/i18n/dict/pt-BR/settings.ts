export const settings = {
  pageTitle: 'Configurações',
  pageSubtitle: 'Gerencie sua organização e seus membros.',
  tabs: {
    general: 'Geral',
    members: 'Membros',
  },
  general: {
    sectionTitle: 'Informações',
    sectionSubtitle: 'Dados básicos da organização.',
    nameLabel: 'Nome',
    slugLabel: 'Identificador (slug)',
    slugWarning:
      'Trocar o identificador altera todas as URLs da organização.',
    cancel: 'Cancelar',
    save: 'Salvar alterações',
    saving: 'Salvando...',
    savedToast: 'Alterações salvas.',
    readonlyAdminNote: 'Apenas administradores podem editar.',
    memberBanner:
      'Você está visualizando como membro. Algumas opções não estão disponíveis.',
    confirmSlugTitle: 'Trocar o identificador?',
    confirmSlugBody: (oldSlug: string, newSlug: string) =>
      `A organização "${oldSlug}" passará a ser acessada em "${newSlug}". Links antigos pararão de funcionar.`,
    confirmSlugConfirm: 'Confirmar',
    confirmSlugCancel: 'Cancelar',
  },
  dangerZone: {
    title: 'Zona de perigo',
    deleteTitle: 'Excluir organização',
    deleteBody:
      'Esta ação não pode ser desfeita. Todos os membros perderão acesso.',
    deleteCta: 'Excluir organização',
    confirmTitle: 'Excluir organização',
    confirmBody: 'Esta ação não pode ser desfeita.',
    confirmTypePrompt:
      'Para confirmar, digite o nome da organização abaixo:',
    confirmTypeLabel:
      'Digite o nome da organização para confirmar',
    cancel: 'Cancelar',
    confirm: 'Excluir',
    deletedToast: 'Organização excluída',
    deleteForbidden:
      'Você não tem permissão para excluir esta organização.',
  },
  members: {
    countLabel: (n: number) => `Membros (${n})`,
    searchPlaceholder: 'Buscar nome ou e-mail',
    roleFilter: 'Função',
    roleFilterAll: 'Todas',
    roleFilterOwners: 'Donos',
    roleFilterAdmins: 'Admins',
    roleFilterMembers: 'Membros',
    inviteCta: 'Convidar membro',
    actionsMenu: (name: string) => `Mais ações para ${name}`,
    roleTrigger: (name: string, role: string) =>
      `Função de ${name}: ${role}. Clique para alterar.`,
    cantDemoteLastOwner: 'Não é possível rebaixar o único proprietário.',
    cantRemoveLastOwner: 'Não é possível remover o único proprietário.',
    cantChangeSelf: 'Você não pode alterar a si mesmo.',
    confirmRemoveTitle: (name: string) => `Remover ${name}?`,
    confirmRemoveBody: (name: string, orgName: string) =>
      `${name} perderá acesso a ${orgName} imediatamente.`,
    confirmRemoveCta: 'Remover',
    confirmCancel: 'Cancelar',
    remove: 'Remover do time',
    roleUpdated: 'Função atualizada.',
    roleUpdateError: 'Não foi possível atualizar a função.',
    removed: (name: string) => `${name} removido da organização`,
    removeError: 'Não foi possível remover o membro.',
    states: {
      loadingError: 'Não foi possível carregar os membros.',
      noFilteredResults: 'Nenhum membro corresponde aos filtros.',
      clearFilters: 'Limpar filtros',
      onlyViewer: 'Você é o único membro desta organização.',
      retry: 'Tentar novamente',
    },
    relativeTime: 'Há',
  },
} as const;
