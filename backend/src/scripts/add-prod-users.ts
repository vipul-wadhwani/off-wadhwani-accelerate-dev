/**
 * Add Production Users
 * Usage: npx ts-node src/scripts/add-prod-users.ts
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

interface ProdUser {
    email: string;
    password: string;
    full_name: string;
    role: string;
    description: string;
}

const PROD_USERS: ProdUser[] = [
    {
        email: 'shruthi.ts@wadhwanifoundation.org',
        password: 'WadhwaniAccelerate123456',
        full_name: 'Shruti TS',
        role: 'success_mgr',
        description: 'Screening Manager',
    },
    {
        email: 'kedar.vishvajeet@wadhwanifoundation.org',
        password: 'WadhwaniAccelerate123456',
        full_name: 'Kedar Kulkarni',
        role: 'venture_mgr',
        description: 'Panel (Prime)',
    },
    {
        email: 'sanjay.kulkarni@thefintelligence.com',
        password: 'WadhwaniAccelerate123456',
        full_name: 'Sanjay Kulkarni',
        role: 'committee_member',
        description: 'Panel (Core/Select)',
    },
    {
        email: 'ceo@griffonconsultants.com',
        password: 'WadhwaniAccelerate123456',
        full_name: 'Venkat PS',
        role: 'committee_member',
        description: 'Panel (Core/Select)',
    },
];

async function createUser(user: ProdUser) {
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

    const userId = data.user.id;
    const { error: profileError } = await supabase
        .from('profiles')
        .upsert({ id: userId, full_name: user.full_name, role: user.role });

    if (profileError) {
        console.error(`  Profile error for ${user.email}: ${profileError.message}`);
    }

    console.log(`  Created ${user.email} (${user.description} — ${user.role})`);
}

async function main() {
    console.log('\nAdding production users...\n');

    for (const user of PROD_USERS) {
        await createUser(user);
    }

    console.log('\n--- User Credentials ---\n');
    console.log('Description            | Name              | Email                                          | Password');
    console.log('-----------------------|-------------------|------------------------------------------------|---------------------------');
    for (const u of PROD_USERS) {
        console.log(`${u.description.padEnd(22)} | ${u.full_name.padEnd(17)} | ${u.email.padEnd(46)} | ${u.password}`);
    }
    console.log('\nDone.\n');
}

main()
    .then(() => process.exit(0))
    .catch((err) => {
        console.error('Fatal error:', err);
        process.exit(1);
    });
