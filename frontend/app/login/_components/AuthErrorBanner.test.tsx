import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { AuthErrorBanner } from './AuthErrorBanner';

describe('AuthErrorBanner', () => {
  it('renders the mapped message for a known error code', () => {
    render(<AuthErrorBanner code="oauth_failed" />);

    expect(
      screen.getByText('Não conseguimos entrar. Tente novamente.'),
    ).toBeInTheDocument();
  });

  it('renders the access_denied message when the user cancels', () => {
    render(<AuthErrorBanner code="access_denied" />);

    expect(
      screen.getByText('Você cancelou o login. Tente novamente quando quiser.'),
    ).toBeInTheDocument();
  });

  it('falls back to a generic message for unknown codes', () => {
    render(<AuthErrorBanner code="totally_unknown" />);

    expect(
      screen.getByText('Algo deu errado no login. Tente novamente.'),
    ).toBeInTheDocument();
  });

  it('exposes itself as a polite live region for screen readers', () => {
    render(<AuthErrorBanner code="oauth_failed" />);

    const banner = screen.getByRole('status');
    expect(banner).toHaveAttribute('aria-live', 'polite');
    expect(banner).toHaveAttribute('tabindex', '-1');
  });

  it('receives focus on mount so the error is announced', () => {
    render(<AuthErrorBanner code="oauth_failed" />);

    expect(screen.getByRole('status')).toHaveFocus();
  });
});
