'use client';

import { createBrowserClient } from '@supabase/auth-helpers-nextjs';

// Singleton client for all client-component usage (auth + data)
export const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
);
