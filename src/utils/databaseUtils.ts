import { createClient, SupabaseClient } from '@supabase/supabase-js';

export interface SupabaseConfig {
  SUPABASE_URL: string;
  SUPABASE_ANON_KEY: string;
}

export class DatabaseUtils {
  private supabase: SupabaseClient | undefined;

  constructor(config: SupabaseConfig) {
    console.log('Supabase config', {
      SUPABASE_URL: config.SUPABASE_URL ? '[present]' : '[missing]',
      SUPABASE_ANON_KEY: config.SUPABASE_ANON_KEY ? '[present]' : '[missing]',
    });

    if (config.SUPABASE_URL && config.SUPABASE_ANON_KEY) {
      this.supabase = createClient(config.SUPABASE_URL, config.SUPABASE_ANON_KEY);
    }
  }

  private async supabaseRead(key: string): Promise<any> {
    if (!this.supabase) throw new Error('Supabase client not initialized');
    const { data, error } = await this.supabase
      .from('kv')
      .select('value')
      .eq('key', key)
      .single();
    if (error) {
      if (error.code === 'PGRST116' || error.code === 'PGRST117') {
        return null;
      }
      throw error;
    }
    return data?.value ?? null;
  }

  private async supabaseWrite(key: string, value: any): Promise<void> {
    if (!this.supabase) throw new Error('Supabase client not initialized');
    const { error } = await this.supabase.from('kv').upsert({ key, value });
    if (error) throw error;
  }

  async readJson<T = any>(key: string): Promise<T> {
    const result = await this.supabaseRead(key);
    return result as T;
  }

  async writeJson(key: string, data: any): Promise<void> {
    await this.supabaseWrite(key, data);
  }
}
