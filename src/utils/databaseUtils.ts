import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Determine whether we have a Supabase client available; this will be the
// case in Cloudflare Worker when wrapped by wrangler with secrets or vars.
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
let supabase: SupabaseClient | undefined;
if (SUPABASE_URL && SUPABASE_ANON_KEY) {
  supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}

// Helper functions for Supabase KV table named "kv" with columns {key, value}
async function supabaseRead(key: string): Promise<any> {
  if (!supabase) throw new Error('Supabase client not initialized');
  const { data, error } = await supabase
    .from('kv')
    .select('value')
    .eq('key', key)
    .single();
  if (error) {
    // if no row exists, just return null
    if (error.code === 'PGRST116' || error.code === 'PGRST117') {
      return null;
    }
    throw error;
  }
  return data?.value ?? null;
}

async function supabaseWrite(key: string, value: any): Promise<void> {
  if (!supabase) throw new Error('Supabase client not initialized');
  const { error } = await supabase
    .from('kv')
    .upsert({ key, value });
  if (error) throw error;
}

/**
 * Read JSON from Supabase (using key).
 */
export async function readJson<T = any>(key: string): Promise<T> {
  const result = await supabaseRead(key);
  return result as T;
}

/**
 * Write JSON to Supabase (using key).
 */
export async function writeJson(key: string, data: any): Promise<void> {
  await supabaseWrite(key, data);
}
