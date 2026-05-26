import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ProviderButton } from './ProviderButton';

// Mock do Supabase client. signInWithOAuth é controlado por testes individuais
// via `signInMock.mockResolvedValueOnce(...)`.
const signInMock = vi.fn();
vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    auth: {
      signInWithOAuth: signInMock,
    },
  }),
}));

const icon = <svg data-testid="provider-icon" />;

function renderGoogle(overrides: Partial<React.ComponentProps<typeof ProviderButton>> = {}) {
  return render(
    <ProviderButton
      provider="google"
      label="Continuar com Google"
      icon={icon}
      className="btn"
      {...overrides}
    />,
  );
}

beforeEach(() => {
  signInMock.mockReset();
  signInMock.mockResolvedValue({ data: { url: 'https://supabase.test/redirect' }, error: null });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('ProviderButton', () => {
  it('renders the Google label when provider is google', () => {
    renderGoogle();

    expect(screen.getByRole('button', { name: 'Continuar com Google' })).toBeInTheDocument();
  });

  it('renders the GitHub label when provider is github', () => {
    renderGoogle({ provider: 'github', label: 'Continuar com GitHub' });

    expect(screen.getByRole('button', { name: 'Continuar com GitHub' })).toBeInTheDocument();
  });

  it('calls signInWithOAuth with the matching provider on click', async () => {
    const user = userEvent.setup();
    renderGoogle({ provider: 'github', label: 'Continuar com GitHub' });

    await user.click(screen.getByRole('button', { name: 'Continuar com GitHub' }));

    expect(signInMock).toHaveBeenCalledTimes(1);
    expect(signInMock).toHaveBeenCalledWith(
      expect.objectContaining({
        provider: 'github',
        options: expect.objectContaining({
          redirectTo: expect.stringContaining('/auth/callback?next=/me'),
        }),
      }),
    );
  });

  it('shows the loading label, sets aria-busy and disables the button while signing in', async () => {
    const user = userEvent.setup();
    // Promise que nunca resolve nesse teste, mantendo o estado de loading.
    let resolveSignIn: (value: { data: { url: string }; error: null }) => void = () => undefined;
    signInMock.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveSignIn = resolve;
      }),
    );

    renderGoogle();

    await user.click(screen.getByRole('button', { name: 'Continuar com Google' }));

    const loadingButton = await screen.findByRole('button', { name: 'Conectando…' });
    expect(loadingButton).toBeDisabled();
    expect(loadingButton).toHaveAttribute('aria-busy', 'true');

    // Limpa o pending request para evitar warning de promise não resolvida.
    resolveSignIn({ data: { url: 'https://supabase.test/redirect' }, error: null });
  });

  it('uses a custom loadingLabel when provided', async () => {
    const user = userEvent.setup();
    signInMock.mockReturnValueOnce(new Promise(() => undefined));

    renderGoogle({ loadingLabel: 'Aguarde…' });

    await user.click(screen.getByRole('button', { name: 'Continuar com Google' }));

    expect(await screen.findByRole('button', { name: 'Aguarde…' })).toBeDisabled();
  });

  it('invokes onError and exits loading when signInWithOAuth returns an error', async () => {
    const user = userEvent.setup();
    const onError = vi.fn();
    signInMock.mockResolvedValueOnce({ data: { url: null }, error: { message: 'boom' } });

    renderGoogle({ onError });

    await user.click(screen.getByRole('button', { name: 'Continuar com Google' }));

    const button = await screen.findByRole('button', { name: 'Continuar com Google' });
    expect(button).not.toBeDisabled();
    expect(button).toHaveAttribute('aria-busy', 'false');
    expect(onError).toHaveBeenCalledWith('Não conseguimos iniciar o login. Tente novamente.');
  });

  it('invokes onError when signInWithOAuth throws', async () => {
    const user = userEvent.setup();
    const onError = vi.fn();
    signInMock.mockRejectedValueOnce(new Error('network down'));

    renderGoogle({ onError });

    await user.click(screen.getByRole('button', { name: 'Continuar com Google' }));

    const button = await screen.findByRole('button', { name: 'Continuar com Google' });
    expect(button).not.toBeDisabled();
    expect(onError).toHaveBeenCalledWith('Não conseguimos iniciar o login. Tente novamente.');
  });
});
