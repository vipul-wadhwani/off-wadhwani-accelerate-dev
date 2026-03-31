import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Lazy-initialized default client — created on first access so that
// Azure Key Vault secrets (loaded async in initConfig) are available.
let _supabase: SupabaseClient | null = null;

function getSupabaseUrl(): string {
    const url = process.env.SUPABASE_URL;
    if (!url) throw new Error('Missing SUPABASE_URL environment variable');
    return url;
}

function getSupabaseAnonKey(): string {
    const key = process.env.SUPABASE_ANON_KEY;
    if (!key) throw new Error('Missing SUPABASE_ANON_KEY environment variable');
    return key;
}

export function getSupabase(): SupabaseClient {
    if (!_supabase) {
        _supabase = createClient(getSupabaseUrl(), getSupabaseAnonKey());
    }
    return _supabase;
}

// Backwards-compatible export — proxies to the lazy getter
export const supabase = new Proxy({} as SupabaseClient, {
    get(_, prop) {
        return (getSupabase() as any)[prop];
    },
});

export function createServiceRoleClient() {
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!serviceRoleKey) {
        console.warn('SUPABASE_SERVICE_ROLE_KEY not set — falling back to anon client');
        return getSupabase();
    }
    return createClient(getSupabaseUrl(), serviceRoleKey, {
        auth: { autoRefreshToken: false, persistSession: false },
    });
}

export function createAuthenticatedClient(token: string) {
    if (!token) return getSupabase();

    return createClient(getSupabaseUrl(), getSupabaseAnonKey(), {
        global: {
            headers: {
                Authorization: `Bearer ${token}`,
            },
        },
    });
}
