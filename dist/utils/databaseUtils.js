"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DatabaseUtils = void 0;
const supabase_js_1 = require("@supabase/supabase-js");
class DatabaseUtils {
    constructor(config) {
        console.log('Supabase config', {
            SUPABASE_URL: config.SUPABASE_URL ? '[present]' : '[missing]',
            SUPABASE_ANON_KEY: config.SUPABASE_ANON_KEY ? '[present]' : '[missing]',
        });
        if (config.SUPABASE_URL && config.SUPABASE_ANON_KEY) {
            this.supabase = (0, supabase_js_1.createClient)(config.SUPABASE_URL, config.SUPABASE_ANON_KEY);
        }
    }
    async supabaseRead(key) {
        if (!this.supabase)
            throw new Error('Supabase client not initialized');
        try {
            const { data, error } = await this.supabase
                .from('kv')
                .select('value')
                .eq('key', key)
                .single();
            if (error) {
                // 116 = no rows, 117 = no data
                if (error.code === 'PGRST116' || error.code === 'PGRST117') {
                    return null;
                }
                throw error;
            }
            return data?.value ?? null;
        }
        catch (err) {
            // Supabase throws a generic Error if the table doesn't exist
            if (err.message && err.message.includes("Could not find the table")) {
                console.warn('Supabase table `kv` not found; returning null.\n' +
                    'Make sure you have created the table with `key text primary key, value jsonb`.');
                return null;
            }
            throw err;
        }
    }
    async supabaseWrite(key, value) {
        if (!this.supabase)
            throw new Error('Supabase client not initialized');
        const { error } = await this.supabase.from('kv').upsert({ key, value });
        if (error)
            throw error;
    }
    async readJson(key) {
        const result = await this.supabaseRead(key);
        return result;
    }
    async writeJson(key, data) {
        try {
            await this.supabaseWrite(key, data);
        }
        catch (err) {
            if (err.message &&
                err.message.includes('violates row-level security policy')) {
                console.warn("Supabase write failed due to row-level security. " +
                    "Ensure you have disabled RLS on the `kv` table or added a " +
                    "policy allowing the anon (or service role) key to INSERT/UPDATE. " +
                    "Example SQL:\n" +
                    "  alter table public.kv enable row level security;\n" +
                    "  create policy anon_rw on public.kv for all using (true);");
            }
            throw err;
        }
    }
}
exports.DatabaseUtils = DatabaseUtils;
