import { SecretClient } from '@azure/keyvault-secrets';
import { DefaultAzureCredential } from '@azure/identity';

// Map of Key Vault secret names → environment variable names
const SECRET_MAP: Record<string, string> = {
    'supabase-service-role-key': 'SUPABASE_SERVICE_ROLE_KEY',
    'supabase-anon-key': 'SUPABASE_ANON_KEY',
    'supabase-url': 'SUPABASE_URL',
    'anthropic-api-key': 'ANTHROPIC_API_KEY',
    'azure-communication-connection-string': 'AZURE_COMMUNICATION_CONNECTION_STRING',
    'sentry-dsn': 'SENTRY_DSN',
    'zoom-client-secret': 'ZOOM_CLIENT_SECRET',
    'zoom-client-id': 'ZOOM_CLIENT_ID',
    'zoom-account-id': 'ZOOM_ACCOUNT_ID',
};

export async function loadSecretsFromKeyVault(): Promise<void> {
    const keyVaultName = process.env.AZURE_KEY_VAULT_NAME;

    if (!keyVaultName) {
        console.log('[KeyVault] AZURE_KEY_VAULT_NAME not set — using .env file');
        return;
    }

    const url = `https://${keyVaultName}.vault.azure.net`;

    console.log(`[KeyVault] Loading secrets from ${keyVaultName}...`);
    const credential = new DefaultAzureCredential();
    const client = new SecretClient(url, credential);

    const failed: string[] = [];

    const results = await Promise.allSettled(
        Object.entries(SECRET_MAP).map(async ([secretName, envVar]) => {
            const secret = await client.getSecret(secretName);
            if (secret.value) {
                process.env[envVar] = secret.value;
                console.log(`[KeyVault] Loaded: ${envVar}`);
            } else {
                failed.push(secretName);
            }
        })
    );

    const rejected = results.filter(r => r.status === 'rejected');
    rejected.forEach(r => {
        if (r.status === 'rejected') {
            failed.push(r.reason?.message || 'unknown');
        }
    });

    if (failed.length > 0) {
        console.warn(`[KeyVault] Failed to load ${failed.length} secret(s) — falling back to .env values: ${failed.join(', ')}`);
        return;
    }

    console.log('[KeyVault] All secrets loaded successfully');
}
