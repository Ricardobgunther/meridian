import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { MeView, type MeProfile } from './MeView';

// Stub do next/image: renderiza um <img> simples para podermos consultar alt e src.
vi.mock('next/image', () => ({
  default: (props: { src: string; alt: string; width: number; height: number }) => {
    // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
    return <img {...props} />;
  },
}));

// LogoutButton usa o supabase client em runtime — stub para isolar o MeView.
vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    auth: {
      signOut: vi.fn().mockResolvedValue({ error: null }),
    },
  }),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

function buildProfile(overrides: Partial<MeProfile> = {}): MeProfile {
  return {
    id: 'user-1',
    email: 'ada@example.com',
    name: 'Ada Lovelace',
    avatar_url: 'https://cdn.test/avatar.png',
    provider: 'google',
    providers: ['google'],
    created_at: '2026-01-15T12:00:00.000Z',
    ...overrides,
  };
}

describe('MeView', () => {
  it('renders the display name and email', () => {
    render(<MeView profile={buildProfile()} />);

    expect(screen.getByRole('heading', { level: 1, name: 'Ada Lovelace' })).toBeInTheDocument();
    expect(screen.getByText('ada@example.com')).toBeInTheDocument();
  });

  it('falls back to the email as heading when name is null', () => {
    render(<MeView profile={buildProfile({ name: null })} />);

    expect(screen.getByRole('heading', { level: 1, name: 'ada@example.com' })).toBeInTheDocument();
  });

  it('renders the Google badge when provider is google', () => {
    render(<MeView profile={buildProfile({ provider: 'google' })} />);

    expect(screen.getByText('Google')).toBeInTheDocument();
    expect(screen.queryByText('GitHub')).not.toBeInTheDocument();
  });

  it('renders the GitHub badge when provider is github', () => {
    render(<MeView profile={buildProfile({ provider: 'github' })} />);

    expect(screen.getByText('GitHub')).toBeInTheDocument();
    expect(screen.queryByText('Google')).not.toBeInTheDocument();
  });

  it('renders an accessible avatar image with the user name in the alt text', () => {
    render(<MeView profile={buildProfile()} />);

    const avatar = screen.getByRole('img', { name: 'Foto de perfil de Ada Lovelace' });
    expect(avatar).toHaveAttribute('src', 'https://cdn.test/avatar.png');
  });

  it('renders an initial-based avatar with aria-label when avatar_url is missing', () => {
    render(<MeView profile={buildProfile({ avatar_url: null })} />);

    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    const fallback = screen.getByLabelText('Avatar de Ada Lovelace');
    expect(fallback).toHaveTextContent('A');
  });

  it('formats the created_at date with Intl pt-BR long style', () => {
    render(<MeView profile={buildProfile({ created_at: '2026-01-15T12:00:00.000Z' })} />);

    const expected = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'long' }).format(
      new Date('2026-01-15T12:00:00.000Z'),
    );
    expect(screen.getByText(expected)).toBeInTheDocument();
  });

  it('renders the raw value when created_at is not a valid date', () => {
    render(<MeView profile={buildProfile({ created_at: 'not-a-date' })} />);

    expect(screen.getByText('not-a-date')).toBeInTheDocument();
  });
});
