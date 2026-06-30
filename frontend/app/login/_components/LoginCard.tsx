'use client';

import { useState } from 'react';

import { AuthErrorBanner } from './AuthErrorBanner';
import { ProviderButton } from './ProviderButton';
import { GithubIcon } from '@/app/_icons/GithubIcon';
import { GoogleIcon } from '@/app/_icons/GoogleIcon';

const GOOGLE_BUTTON_CLASSES =
  'inline-flex w-full items-center justify-center gap-3 h-11 rounded-md px-4 bg-white text-slate-900 border border-slate-300 text-sm font-medium transition-colors duration-150 hover:bg-slate-50 active:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 motion-reduce:transition-none';

const GITHUB_BUTTON_CLASSES =
  'inline-flex w-full items-center justify-center gap-3 h-11 rounded-md px-4 bg-slate-900 text-white border border-slate-900 text-sm font-medium transition-colors duration-150 hover:bg-slate-800 active:bg-slate-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 motion-reduce:transition-none';

export interface LoginCardProps {
  /** Código de erro vindo de `?error=` no callback (opcional). */
  initialError?: string;
  /** Token de convite (`?invite=...`) a propagar para o OAuth. */
  inviteToken?: string;
}

/**
 * Wrapper client que orquestra o erro entre os dois `ProviderButton`s.
 * Permite que falhas síncronas de `signInWithOAuth` apareçam na faixa única,
 * sem duplicar banner em cada botão.
 *
 * Quando `inviteToken` está presente, os botões propagam o token via
 * `redirectTo` para que o callback retorne à página de aceite.
 */
export function LoginCard({ initialError, inviteToken }: LoginCardProps) {
  const [runtimeError, setRuntimeError] = useState<string | null>(null);

  const errorCode = runtimeError ?? initialError ?? null;

  return (
    <section
      role="region"
      aria-labelledby="login-title"
      className="flex w-full max-w-sm flex-col gap-6 rounded-xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8"
    >
      <div className="flex flex-col gap-2">
        <h1
          id="login-title"
          className="text-2xl font-semibold tracking-tight text-slate-900"
        >
          Entrar no Projeto1
        </h1>
        <p className="text-sm leading-relaxed text-slate-600">
          Continue com sua conta Google ou GitHub.
        </p>
      </div>

      {errorCode ? <AuthErrorBanner code={errorCode} /> : null}

      <div className="flex flex-col gap-3">
        <ProviderButton
          provider="google"
          label="Continuar com Google"
          icon={<GoogleIcon className="h-5 w-5 shrink-0" />}
          className={GOOGLE_BUTTON_CLASSES}
          onError={() => setRuntimeError('oauth_failed')}
          inviteToken={inviteToken}
        />
        <ProviderButton
          provider="github"
          label="Continuar com GitHub"
          icon={<GithubIcon className="h-5 w-5 shrink-0" />}
          className={GITHUB_BUTTON_CLASSES}
          onError={() => setRuntimeError('oauth_failed')}
          inviteToken={inviteToken}
        />
      </div>
    </section>
  );
}
