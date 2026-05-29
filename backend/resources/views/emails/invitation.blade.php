<x-mail::message>
# Você foi convidado a entrar em {{ $organizationName }}

Olá!

**{{ $inviterName }}** convidou você para entrar em **{{ $organizationName }}** como **{{ $roleLabel }}**.

Para aceitar o convite e criar sua conta (se ainda não tiver uma), clique no botão abaixo.

<x-mail::button :url="$acceptUrl" color="primary">
Aceitar convite
</x-mail::button>

Este convite expira em **{{ $expiresAt }}**. Se você não esperava receber este convite, basta ignorar este email — nenhuma conta será criada.

Se o botão não funcionar, copie e cole o endereço abaixo no seu navegador:

<small>{{ $acceptUrl }}</small>

Atenciosamente,<br>
Equipe {{ config('app.name') }}
</x-mail::message>
