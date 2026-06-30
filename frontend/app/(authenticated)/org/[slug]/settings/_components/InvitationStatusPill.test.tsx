import { render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { InvitationStatusPill } from './InvitationStatusPill';
import { t } from '@/lib/i18n/t';

const FIXED_NOW = new Date('2026-05-28T12:00:00.000Z');

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(FIXED_NOW);
});

afterEach(() => {
  vi.useRealTimers();
});

function isoFromNow(ms: number): string {
  return new Date(FIXED_NOW.getTime() + ms).toISOString();
}

const DAY_MS = 24 * 60 * 60 * 1000;

describe('InvitationStatusPill', () => {
  describe('label formatting', () => {
    it('renders "em N dias" for a date several days in the future', () => {
      render(<InvitationStatusPill expiresAt={isoFromNow(6 * DAY_MS)} />);

      expect(screen.getByText(/em 6 dias/i)).toBeInTheDocument();
    });

    it('renders "em N horas" when less than a day remains', () => {
      // 6 hours from now — rounds to < 1 day so the hours branch wins.
      render(<InvitationStatusPill expiresAt={isoFromNow(6 * 60 * 60 * 1000)} />);

      expect(screen.getByText(/em 6 horas/i)).toBeInTheDocument();
    });

    it('renders "expirado" when the date is already past', () => {
      render(<InvitationStatusPill expiresAt={isoFromNow(-DAY_MS)} />);

      expect(screen.getByText(/expirado/i)).toBeInTheDocument();
    });

    it('falls back to the raw value when expiresAt is not a valid date', () => {
      render(<InvitationStatusPill expiresAt="not-a-date" />);

      expect(screen.getByText('not-a-date')).toBeInTheDocument();
    });
  });

  describe('urgency variants', () => {
    it('includes the SR-only "Expira em breve" hint when within 24h', () => {
      render(<InvitationStatusPill expiresAt={isoFromNow(6 * 60 * 60 * 1000)} />);

      expect(
        screen.getByText(t.invitations.list.expiresUrgent),
      ).toBeInTheDocument();
    });

    it('includes the urgent hint when expired (past)', () => {
      render(<InvitationStatusPill expiresAt={isoFromNow(-DAY_MS)} />);

      expect(
        screen.getByText(t.invitations.list.expiresUrgent),
      ).toBeInTheDocument();
    });

    it('omits the urgent hint when far in the future (> 3 days)', () => {
      render(<InvitationStatusPill expiresAt={isoFromNow(6 * DAY_MS)} />);

      expect(
        screen.queryByText(t.invitations.list.expiresUrgent),
      ).not.toBeInTheDocument();
    });

    it('includes the urgent hint within the 1-3 day warning band', () => {
      render(<InvitationStatusPill expiresAt={isoFromNow(2 * DAY_MS)} />);

      expect(
        screen.getByText(t.invitations.list.expiresUrgent),
      ).toBeInTheDocument();
    });
  });
});
