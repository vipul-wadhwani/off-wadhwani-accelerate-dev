import dotenv from 'dotenv';
import { loadSecretsFromKeyVault } from './keyVault';

// Load .env first (local dev fallback), then Key Vault overwrites
dotenv.config();

// Initialize config after Key Vault loads
let _config: ReturnType<typeof buildConfig>;

function buildConfig() {
    return {
        port: parseInt(process.env.PORT || '3001', 10),
        nodeEnv: process.env.NODE_ENV || 'development',
        frontendUrl: process.env.FRONTEND_URL || 'http://localhost:5173',
        supabase: {
            url: process.env.SUPABASE_URL!,
            anonKey: process.env.SUPABASE_ANON_KEY!,
            serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
        },
    };
}

// Load secrets from Azure Key Vault, then build config
export async function initConfig(): Promise<void> {
    try {
        await loadSecretsFromKeyVault();
    } catch (err: any) {
        console.warn(`[Config] Key Vault unavailable, using .env fallback: ${err.message}`);
    }
    _config = buildConfig();

    // Validate required environment variables
    const requiredEnvVars = ['SUPABASE_URL', 'SUPABASE_ANON_KEY'];
    for (const envVar of requiredEnvVars) {
        if (!process.env[envVar]) {
            throw new Error(`Missing required environment variable: ${envVar}`);
        }
    }
}

// For backwards compatibility — works immediately with .env, updated after initConfig()
export const config = new Proxy({} as ReturnType<typeof buildConfig>, {
    get(_, prop) {
        if (!_config) _config = buildConfig();
        return (_config as any)[prop];
    },
});
