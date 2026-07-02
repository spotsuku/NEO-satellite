// =============================================================================
// Supabase クライアント。
//  - 書き込みは必ずサーバー（Route Handler / Server Action）で service_role を使用。
//  - ブラウザには anon キーのみ公開。anon の書き込みは RLS で全面拒否、
//    Realtime 購読（読み取り）専用。
// =============================================================================

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
export const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

/** URL と anon キーが揃っていれば Supabase モード。 */
export function isSupabaseConfigured(): boolean {
  return Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
}

/** サーバー側の読み取りクライアント（service_role があればそれ、無ければ anon）。 */
export function getServerReadClient(): SupabaseClient | null {
  if (!isSupabaseConfigured()) return null;
  const key = SERVICE_ROLE_KEY || SUPABASE_ANON_KEY;
  return createClient(SUPABASE_URL, key, { auth: { persistSession: false } });
}

/** サーバー側の書き込みクライアント（service_role 必須）。 */
export function getServiceClient(): SupabaseClient | null {
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) return null;
  return createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });
}
