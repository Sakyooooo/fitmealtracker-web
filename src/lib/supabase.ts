import { createClient, SupabaseClient } from '@supabase/supabase-js';

const url  = process.env.NEXT_PUBLIC_SUPABASE_URL  ?? '';
const key  = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';

/** Supabase が有効かどうか（環境変数が両方セットされている場合のみ true） */
export const supabaseEnabled = url !== '' && key !== '';

/**
 * Supabase クライアント。
 * 環境変数が未設定の場合は null。
 * 利用側は必ず `supabaseEnabled` を確認してから使うこと。
 */
export const supabase: SupabaseClient | null = supabaseEnabled
  ? createClient(url, key)
  : null;
