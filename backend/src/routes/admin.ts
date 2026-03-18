import { Router, Request, Response, NextFunction } from 'express';
import { authenticateUser, requireRole } from '../middleware/auth';
import { createServiceRoleClient } from '../config/supabase';
import { successResponse, createdResponse } from '../utils/response';

const router = Router();

/**
 * GET /api/admin/users
 * List all staff users (non-entrepreneur) with emails from auth
 */
router.get(
    '/users',
    authenticateUser,
    requireRole('admin'),
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const serviceClient = createServiceRoleClient();

            // Get all profiles
            const { data: profiles, error: profileError } = await serviceClient
                .from('profiles')
                .select('id, full_name, role, created_at')
                .in('role', ['success_mgr', 'venture_mgr', 'committee_member', 'ops_manager', 'admin']);

            if (profileError) throw profileError;

            // Get emails from auth
            const { data: { users: authUsers }, error: authError } = await serviceClient.auth.admin.listUsers();
            if (authError) throw authError;

            const emailMap = new Map<string, string>();
            (authUsers || []).forEach(u => {
                if (u.id && u.email) emailMap.set(u.id, u.email);
            });

            const result = (profiles || []).map(p => ({
                id: p.id,
                full_name: p.full_name,
                email: emailMap.get(p.id) || '',
                role: p.role,
                created_at: p.created_at,
            }));

            successResponse(res, { users: result });
        } catch (error) {
            next(error);
        }
    }
);

/**
 * POST /api/admin/users
 * Create a new staff user
 * Body: { email, full_name, role, password }
 */
router.post(
    '/users',
    authenticateUser,
    requireRole('admin'),
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { email, full_name, role, password } = req.body;

            if (!email || !full_name || !role) {
                return res.status(400).json({ error: 'email, full_name, and role are required' });
            }

            const allowedRoles = ['success_mgr', 'venture_mgr', 'committee_member', 'ops_manager', 'admin'];
            if (!allowedRoles.includes(role)) {
                return res.status(400).json({ error: `Invalid role. Allowed: ${allowedRoles.join(', ')}` });
            }

            const serviceClient = createServiceRoleClient();

            const { data, error } = await serviceClient.auth.admin.createUser({
                email,
                password: password || 'Wadhwani123456',
                email_confirm: true,
                user_metadata: { full_name, role },
            });

            if (error) {
                return res.status(400).json({ error: error.message });
            }

            // Create profile
            const { error: profileError } = await serviceClient
                .from('profiles')
                .upsert({ id: data.user.id, full_name, role });

            if (profileError) {
                console.error('Profile creation error:', profileError);
            }

            // Auto-create panelist record for panel roles
            if (role === 'venture_mgr' || role === 'committee_member') {
                const program = role === 'venture_mgr' ? 'Prime'
                    : (req.body.program || 'Core');
                const { error: panelistError } = await serviceClient
                    .from('panelists')
                    .upsert({ name: full_name, email, program }, { onConflict: 'email' });

                if (panelistError) {
                    console.error('Panelist creation error:', panelistError);
                }
            }

            createdResponse(res, {
                message: 'User created successfully',
                user: { id: data.user.id, email, full_name, role },
            });
        } catch (error) {
            next(error);
        }
    }
);

export default router;
