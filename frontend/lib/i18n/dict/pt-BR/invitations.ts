/**
 * Strings PT-BR do bloco de convites (spec invitations-ui/04-i18n-strings.md).
 *
 * Acesso via `t.invitations.*`. Nunca colar literais em componentes — adicione
 * a chave aqui e re-use. Quando a segunda língua chegar, este arquivo é
 * espelhado.
 */
export const invitations = {
  list: {
    sectionTitle: 'Convites pendentes',
    sectionTitleWithCount: (n: number) => `Convites pendentes (${n})`,
    collapseToggleHide: 'Ocultar convites pendentes',
    collapseToggleShow: 'Mostrar convites pendentes',
    columnEmail: 'Email',
    columnRole: 'Função',
    columnInviter: 'Convidado por',
    columnExpires: 'Expira em',
    columnActions: 'Ações',
    invitedBy: (name: string) => `convidado por ${name}`,
    invitedByLabel: 'convidado por ',
    inviterNoLongerMember: 'Não é mais membro.',
    expiresInTooltip: (fullDate: string) => `Expira em ${fullDate}`,
    expiresUrgent: 'Expira em breve',
    actionsMenu: (email: string) => `Mais ações para ${email}`,
    actionResend: 'Reenviar convite',
    actionRevoke: 'Revogar convite',
    resendBusy: 'Reenviando...',
    resentToast: 'Convite reenviado',
    resentToastBody: (email: string) => `Enviamos um novo link para ${email}.`,
    resentAnnouncement: (email: string) => `Convite reenviado para ${email}`,
    resendError: 'Não foi possível reenviar o convite.',
    resendRateLimitedTitle: 'Aguarde para reenviar',
    resendRateLimitedBody:
      'Você já reenviou este convite recentemente. Tente novamente em alguns instantes.',
    confirmRevokeTitle: 'Revogar convite?',
    confirmRevokeBody: (email: string) =>
      `O link enviado para ${email} deixará de funcionar imediatamente. Você pode enviar um novo convite a qualquer momento.`,
    confirmRevokeCta: 'Revogar',
    confirmRevokeCancel: 'Cancelar',
    revoking: 'Revogando...',
    revokedToast: 'Convite revogado',
    revokedToastBody: (email: string) =>
      `O convite para ${email} foi cancelado.`,
    revokedAnnouncement: (email: string) =>
      `Convite para ${email} revogado`,
    revokeError: 'Não foi possível revogar o convite.',
    emptyTitle: 'Nenhum convite pendente.',
    emptyHint: 'Use o botão "Convidar membro" acima para começar.',
    loadingError: 'Não foi possível carregar os convites.',
    retry: 'Tentar novamente',
  },
  modal: {
    triggerCta: 'Convidar membro',
    quotaExceededTooltip: 'Limite de membros atingido. Atualize o plano.',
    title: 'Convidar membro',
    description:
      'Envie um convite por email para alguém entrar na sua organização.',
    closeLabel: 'Fechar',
    emailLabel: 'Email',
    emailPlaceholder: 'exemplo@empresa.com',
    emailHelper: 'Enviaremos um convite com link para essa pessoa.',
    roleLabel: 'Função',
    roleMemberTitle: 'Membro',
    roleMemberDescription: 'Acesso padrão ao workspace.',
    roleAdminTitle: 'Administrador',
    roleAdminDescription: 'Pode gerenciar membros e configurações.',
    cancel: 'Cancelar',
    submit: 'Enviar convite',
    submitting: 'Enviando...',
    sentToastTitle: 'Convite enviado',
    sentToastBody: (email: string) => `Enviamos um link para ${email}.`,
    sentAnnouncement: (email: string) => `Convite enviado para ${email}`,
    errors: {
      emailRequired: 'Informe um email.',
      emailInvalid: 'Email inválido.',
      emailAlreadyMember: 'Esta pessoa já é membro desta organização.',
      emailAlreadyPending: 'Já existe um convite pendente para este email.',
      roleRequired: 'Selecione uma função.',
      roleInvalid: 'Função inválida.',
      rateLimitedTitle: 'Limite de convites atingido',
      rateLimitedBody:
        'Você atingiu o limite de convites por agora. Tente novamente em alguns instantes.',
      forbidden: 'Você não tem permissão para enviar convites.',
      network: 'Verifique sua internet e tente novamente.',
      generic: 'Não foi possível enviar o convite.',
    },
  },
  accept: {
    pageTitleWithOrg: (orgName: string) => `Convite — ${orgName}`,
    pageTitleGeneric: 'Convite',
    helpFooter: 'Precisa de ajuda? Fale com a pessoa que enviou o convite.',
    goHome: 'Ir para a página inicial',

    readyTitlePrefix: 'Você foi convidado a entrar em',
    readySubtitle: (role: string, inviter: string) =>
      `como ${role}, por ${inviter}.`,
    readySubtitleNoInviter: (role: string) => `como ${role}.`,
    readyEmailLabel: (email: string) => `Convite para: ${email}`,
    decline: 'Recusar',
    accept: 'Aceitar',
    accepting: 'Aceitando...',
    declining: 'Recusando...',
    acceptSuccessAnnouncement: (orgName: string) =>
      `Convite aceito. Bem-vindo(a) a ${orgName}.`,
    declineSuccessAnnouncement: 'Convite recusado.',
    inlineErrorTitle: 'Não foi possível concluir',
    inlineErrorGeneric: 'Tente novamente em instantes.',

    anonTitlePrefix: 'Você foi convidado a entrar em',
    anonBody: (email: string) =>
      `Faça login ou crie uma conta com ${email} para aceitar.`,
    anonCta: 'Entrar ou criar conta',
    anonHelper:
      'Ao continuar, seu convite ficará pendente até você finalizar o login.',

    expiredTitle: 'Este convite expirou.',
    expiredBody: 'Peça um novo ao administrador da organização.',

    revokedTitle: 'Este convite foi revogado.',
    revokedBody:
      'O administrador cancelou este convite. Entre em contato com a organização se precisar de acesso.',

    invalidTitle: 'Convite não encontrado.',
    invalidBody: 'O link pode estar incompleto ou ter sido digitado errado.',

    acceptedTitle: 'Convite já aceito.',
    acceptedBody:
      'Você já faz parte desta organização. Acesse seu workspace para continuar.',
    acceptedCta: 'Ir para o workspace',

    wrongEmailTitle: 'Este convite foi enviado para outro email.',
    wrongEmailConnectedAs: (email: string) =>
      `Você está conectado como ${email}.`,
    wrongEmailExpected: (email: string) =>
      `Para aceitar este convite, entre com ${email}.`,
    wrongEmailSignOut: 'Sair desta conta',
    signingOut: 'Saindo...',
  },
  errors: {
    invitation_not_found: {
      title: 'Convite não encontrado',
      body: 'O link pode estar incompleto ou ter sido digitado errado.',
    },
    invitation_expired: {
      title: 'Convite expirado',
      body: 'Peça um novo ao administrador da organização.',
    },
    invitation_revoked: {
      title: 'Convite revogado',
      body: 'Este convite foi cancelado.',
    },
    invitation_email_mismatch: {
      title: 'Email não confere',
      body: 'Este convite foi enviado para outro email.',
    },
    invitation_already_member: {
      title: 'Já é membro',
      body: 'Esta pessoa já é membro desta organização.',
    },
    invitation_already_pending: {
      title: 'Convite já enviado',
      body: 'Já existe um convite pendente para este email.',
    },
    invitation_rate_limited: {
      title: 'Limite de convites atingido',
      body: 'Você atingiu o limite de convites por agora.',
    },
    invitation_resend_rate_limited: {
      title: 'Aguarde para reenviar',
      body: 'Você já reenviou este convite recentemente.',
    },
    invitation_role_invalid: {
      title: 'Função inválida',
      body: 'Escolha entre Membro ou Administrador.',
    },
    invitation_quota_exceeded: {
      title: 'Limite de membros atingido',
      body: 'Atualize o plano para convidar mais pessoas.',
    },
    forbidden: {
      title: 'Sem permissão',
      body: 'Você não tem permissão para esta ação.',
    },
    validation: {
      title: 'Verifique os campos',
      body: 'Algumas informações estão incompletas ou incorretas.',
    },
    server: {
      title: 'Erro inesperado',
      body: 'Algo deu errado do nosso lado. Tente novamente em instantes.',
    },
    network: {
      title: 'Sem conexão',
      body: 'Verifique sua internet e tente novamente.',
    },
  },
  roles: {
    member: 'Membro',
    admin: 'Admin',
    memberFull: 'Membro',
    adminFull: 'Administrador',
  },
} as const;
