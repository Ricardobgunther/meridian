import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { SlugAvailability } from './SlugAvailability';
import { t } from '@/lib/i18n/t';

describe('SlugAvailability', () => {
  it('renders an empty reserved row for idle (no text, min-h kept)', () => {
    const { container } = render(<SlugAvailability status="idle" />);

    const region = container.querySelector('[aria-live="polite"]');
    expect(region).toBeInTheDocument();
    expect(region).toHaveTextContent('');
    expect(region?.className).toContain('min-h-5');
  });

  it('shows the checking message while the verdict is pending', () => {
    render(<SlugAvailability status="checking" />);

    expect(
      screen.getByText(t.orgs.create.slugCheck.checking),
    ).toBeInTheDocument();
  });

  it('shows "Disponível" when the slug is available', () => {
    render(<SlugAvailability status="available" />);

    expect(
      screen.getByText(t.orgs.create.slugCheck.available),
    ).toBeInTheDocument();
  });

  it('shows the same taken message as the post-submit 422 path', () => {
    render(<SlugAvailability status="taken" />);

    // Uma mensagem, dois momentos (spec 03 §2): preview === errors.slugTaken.
    expect(
      screen.getByText(t.orgs.create.errors.slugTaken),
    ).toBeInTheDocument();
  });

  it('keeps a single always-mounted live region across status changes', () => {
    // O elemento aria-live não pode ser re-montado por estado — SRs
    // re-anunciariam a região inteira (spec 05 §7).
    const { container, rerender } = render(<SlugAvailability status="idle" />);
    const before = container.querySelector('[aria-live="polite"]');
    expect(before).toHaveAttribute('aria-atomic', 'true');

    rerender(<SlugAvailability status="available" />);
    const after = container.querySelector('[aria-live="polite"]');

    expect(after).toBe(before);
    expect(container.querySelectorAll('[aria-live]')).toHaveLength(1);
  });
});
