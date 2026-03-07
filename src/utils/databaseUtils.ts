import { createClient, SupabaseClient } from "@supabase/supabase-js";

export interface SupabaseConfig {
  SUPABASE_URL: string;
  SUPABASE_ANON_KEY: string;
}

export class DatabaseUtils {
  private supabase: SupabaseClient | undefined;

  constructor(config: SupabaseConfig) {
    if (config.SUPABASE_URL && config.SUPABASE_ANON_KEY) {
      this.supabase = createClient(
        config.SUPABASE_URL,
        config.SUPABASE_ANON_KEY,
      );
    }
  }

  private async supabaseRead(key: string): Promise<unknown> {
    if (!this.supabase) throw new Error("Supabase client not initialized");

    try {
      const { data, error } = await this.supabase
        .from("kv")
        .select("value")
        .eq("key", key)
        .single();
      if (error) {
        // 116 = no rows, 117 = no data
        if (error.code === "PGRST116" || error.code === "PGRST117") {
          return null;
        }
        throw error;
      }
      return data?.value ?? null;
    } catch (err: Error | unknown) {
      // Supabase throws a generic Error if the table doesn't exist
      if (
        err instanceof Error &&
        err.message.includes("Could not find the table")
      ) {
        console.warn(
          "Supabase table `kv` not found; returning null.\n" +
            "Make sure you have created the table with `key text primary key, value jsonb`.",
        );
        return null;
      }
      throw err;
    }
  }

  private async supabaseWrite(key: string, value: unknown): Promise<void> {
    if (!this.supabase) throw new Error("Supabase client not initialized");
    const { error } = await this.supabase.from("kv").upsert({ key, value });
    if (error) throw error;
  }

  async readJson<T = unknown>(key: string): Promise<T> {
    const result = await this.supabaseRead(key);
    return result as T;
  }

  async writeJson(key: string, data: unknown): Promise<void> {
    try {
      await this.supabaseWrite(key, data);
    } catch (err: Error | unknown) {
      if (
        err instanceof Error &&
        err.message.includes("violates row-level security policy")
      ) {
        console.warn(
          "Supabase write failed due to row-level security. " +
            "Ensure you have disabled RLS on the `kv` table or added a " +
            "policy allowing the anon (or service role) key to INSERT/UPDATE. " +
            "Example SQL:\n" +
            "  alter table public.kv enable row level security;\n" +
            "  create policy anon_rw on public.kv for all using (true);",
        );
      }
      throw err;
    }
  }
}
