/**
 * Pehchaan — Design System
 * Central theme tokens used across all screens.
 * Worker mode uses navy blue, admin mode uses deep indigo.
 */

export const C = {
  // ── Brand ──────────────────────────────────────────────────────────────
  primary:       '#003566',   // deep navy — worker mode primary
  primaryDark:   '#002147',   // darker navy for pressed states
  primaryLight:  '#E8F0FE',   // pale blue tint
  adminPrimary:  '#1A3A5C',   // admin mode primary — distinct from worker
  adminDark:     '#0F2540',
  adminLight:    '#EEF3FA',
  accent:        '#0057A8',   // mid-blue for links, active states

  // ── Backgrounds ────────────────────────────────────────────────────────
  bg:            '#F0F4F8',   // pale blue-white page background
  surface:       '#FFFFFF',   // card surface
  surfaceAlt:    '#F7FAFC',   // slightly off-white for inner sections

  // ── Text ───────────────────────────────────────────────────────────────
  textPrimary:   '#0A1628',   // near-black
  textSecondary: '#5B7A99',   // medium slate
  textMuted:     '#9DAFC5',   // light muted
  textOnPrimary: '#FFFFFF',   // white text on navy buttons

  // ── Borders / Dividers ─────────────────────────────────────────────────
  border:        '#C5D5E8',
  divider:       '#E8EFF6',

  // ── Status ─────────────────────────────────────────────────────────────
  success:       '#10B981',
  successBg:     '#D1FAE5',
  successText:   '#065F46',
  warning:       '#F59E0B',
  warningBg:     '#FEF3C7',
  warningText:   '#92400E',
  error:         '#EF4444',
  errorBg:       '#FEE2E2',
  errorText:     '#991B1B',

  // ── Sync states ────────────────────────────────────────────────────────
  syncPendingBg:   '#FEF3C7',
  syncPendingText: '#92400E',
  syncDoneBg:      '#D1FAE5',
  syncDoneText:    '#065F46',
};

export const FONT = {
  // Inter-style weight mapping
  thin:       '300',
  regular:    '400',
  medium:     '500',
  semiBold:   '600',
  bold:       '700',
  extraBold:  '800',
  black:      '900',
};

export const RADIUS = {
  sm:   8,
  md:   12,
  lg:   16,
  xl:   20,
  full: 999,
};

export const SHADOW = {
  sm: {
    elevation: 2,
    shadowColor: '#0A1628',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
  },
  md: {
    elevation: 4,
    shadowColor: '#0A1628',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
  },
  lg: {
    elevation: 8,
    shadowColor: '#003566',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
  },
};
