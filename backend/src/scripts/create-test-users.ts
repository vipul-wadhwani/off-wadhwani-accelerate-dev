/**
 * Create Test Users for Platform Testing
 * Usage: npx ts-node src/scripts/create-test-users.ts
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in backend/.env');
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false }
});

interface TestUser {
    email: string;
    password: string;
    full_name: string;
    role: string;
}

const TEST_USERS: TestUser[] = [
    { email: 'entrepreneur1@wadhwanifoundation.org', password: 'test1234', full_name: 'Entrepreneur 1', role: 'entrepreneur' },
    { email: 'entrepreneur2@wadhwanifoundation.org', password: 'test1234', full_name: 'Entrepreneur 2', role: 'entrepreneur' },
    { email: 'screening1@wadhwanifoundation.org', password: 'test1234', full_name: 'Screening Manager 1', role: 'success_mgr' },
    { email: 'screening2@wadhwanifoundation.org', password: 'test1234', full_name: 'Screening Manager 2', role: 'success_mgr' },
    { email: 'panelprime1@wadhwanifoundation.org', password: 'test1234', full_name: 'Panel Prime 1', role: 'venture_mgr' },
    { email: 'panelprime2@wadhwanifoundation.org', password: 'test1234', full_name: 'Panel Prime 2', role: 'venture_mgr' },
    { email: 'panelcore1@wadhwanifoundation.org', password: 'test1234', full_name: 'Panel Core 1', role: 'committee_member' },
    { email: 'panelcore2@wadhwanifoundation.org', password: 'test1234', full_name: 'Panel Core 2', role: 'committee_member' },
    { email: 'ops1@wadhwanifoundation.org', password: 'test1234', full_name: 'Ops Manager 1', role: 'ops_manager' },
    { email: 'ops2@wadhwanifoundation.org', password: 'test1234', full_name: 'Ops Manager 2', role: 'ops_manager' },
];

async function createUser(user: TestUser) {
    // Check if user already exists
    const { data: { users } } = await supabase.auth.admin.listUsers();
    const existing = users?.find(u => u.email === user.email);

    if (existing) {
        console.log(`  Skipping ${user.email} (already exists)`);
        return;
    }

    const { data, error } = await supabase.auth.admin.createUser({
        email: user.email,
        password: user.password,
        email_confirm: true,
        user_metadata: {
            full_name: user.full_name,
            role: user.role,
        },
    });

    if (error) {
        console.error(`  FAILED ${user.email}: ${error.message}`);
        return;
    }

    // Ensure profile exists with correct role
    const userId = data.user.id;
    const { error: profileError } = await supabase
        .from('profiles')
        .upsert({ id: userId, full_name: user.full_name, role: user.role });

    if (profileError) {
        console.error(`  Profile error for ${user.email}: ${profileError.message}`);
    }

    console.log(`  Created ${user.email} (${user.role})`);
}

async function main() {
    console.log('\nCreating 10 test users...\n');

    for (const user of TEST_USERS) {
        await createUser(user);
    }

    console.log('\n--- Test User Credentials ---\n');
    console.log('Role                  | Email                                      | Password');
    console.log('----------------------|--------------------------------------------|---------');
    for (const u of TEST_USERS) {
        console.log(`${u.role.padEnd(21)} | ${u.email.padEnd(42)} | ${u.password}`);
    }
    console.log('\nDone.\n');
}

main()
    .then(() => process.exit(0))
    .catch((err) => {
        console.error('Fatal error:', err);
        process.exit(1);
    });
