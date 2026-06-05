// ── Background images ────────────────────────────────────────────────────────
// Override via NEXT_PUBLIC_GYM_BG_URL / NEXT_PUBLIC_MEAL_BG_URL in .env.local

export const GYM_BG_URL =
  process.env.NEXT_PUBLIC_GYM_BG_URL ??
  'https://images.unsplash.com/photo-1571902943202-507ec2618e8f?auto=format&fit=crop&w=900&q=40';

export const MEAL_BG_URL =
  process.env.NEXT_PUBLIC_MEAL_BG_URL ??
  'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=900&q=40';

export const BG_OPACITY = 0.07;

// ── Typography ────────────────────────────────────────────────────────────────
export const HERO_FONT_SIZE    = 'clamp(76px, 23vw, 120px)' as const;
export const TIMER_FONT_SIZE   = 'clamp(64px, 20vw, 108px)' as const;

// ── Storage keys ──────────────────────────────────────────────────────────────
export const STORAGE_KEY_DATA_TAB = 'fmt_data_tab';
