import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export function createServiceRoleClient() {
    if (!supabaseServiceRoleKey) {
        console.warn('SUPABASE_SERVICE_ROLE_KEY not set — falling back to anon client');
        return supabase;
    }
    return createClient(supabaseUrl!, supabaseServiceRoleKey, {
        auth: { autoRefreshToken: false, persistSession: false },
    });
}

export function createAuthenticatedClient(token: string) {
    if (!token) return supabase;

    return createClient(supabaseUrl!, supabaseAnonKey!, {
        global: {
            headers: {
                Authorization: `Bearer ${token}`,
            },
        },
    });
}
