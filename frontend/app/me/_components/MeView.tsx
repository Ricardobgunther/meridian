import Image from 'next/image';

import { LogoutButton } from './LogoutButton';
import { ProviderBadge } from './ProviderBadge';

export interface MeProfile {
  id: string;
  email: string;
  name: string | null;
  avatar_url: string | null;
  provider: string;
  providers: string[];
  created_at: string;
}

export interface MeViewProps {
  profile: MeProfile;
}

function getInitial(name: string | null, email: string): string {
  const source = (name?.trim() || email).trim();
  return source.charAt(0).toUpperCase() || '?';
}

function formatDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return iso;
  }
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'long' }).format(date);
}

/**
 * Renderiza o conteúdo principal de `/me`. Server-safe: o único client child é
 * o `LogoutButton`.
 */
export function MeView({ profile }: MeViewProps) {
  const displayName = profile.name?.trim() || profile.email;
  const initial = getInitial(profile.name, profile.email);
  const createdAt = formatDate(profile.created_at);

  return (
    <>
      <header className="flex items-center gap-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        {profile.avatar_url ? (
          <Image
            src={profile.avatar_url}
            alt={`Foto de perfil de ${displayName}`}
            width={56}
            height={56}
            className="h-14 w-14 shrink-0 rounded-full border border-slate-200 bg-slate-100 object-cover"
            unoptimized
          />
        ) : (
          <div
            aria-label={`Avatar de ${displayName}`}
            className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-slate-100 font-semibold text-slate-700"
          >
            {initial}
          </div>
        )}
        <div className="flex min-w-0 flex-col gap-0.5">
          <h1 className="truncate text-xl font-semibold tracking-tight text-slate-900">
            {displayName}
          </h1>
          <p className="truncate text-sm text-slate-600">{profile.email}</p>
        </div>
      </header>

      <section
        aria-labelledby="account-details"
        className="flex flex-col gap-5 rounded-xl border border-slate-200 bg-white p-6 shadow-sm"
      >
        <h2
          id="account-details"
          className="text-base font-semibold text-slate-900"
        >
          Detalhes da conta
        </h2>

        <dl className="grid grid-cols-1 gap-3 sm:grid-cols-[160px_1fr] sm:gap-x-6 sm:gap-y-3">
          <dt className="text-sm text-slate-600">Entrou com</dt>
          <dd className="text-sm font-medium text-slate-900">
            <ProviderBadge provider={profile.provider} />
          </dd>

          <dt className="text-sm text-slate-600">Conta criada em</dt>
          <dd className="text-sm font-medium text-slate-900">{createdAt}</dd>
        </dl>

        <div className="flex justify-end border-t border-slate-100 pt-2">
          <LogoutButton />
        </div>
      </section>
    </>
  );
}
