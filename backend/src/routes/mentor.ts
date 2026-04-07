import { Router, Request, Response, NextFunction } from 'express';
import { authenticateUser } from '../middleware/auth';
import { createServiceRoleClient, createAuthenticatedClient } from '../config/supabase';
import { successResponse } from '../utils/response';

const router = Router();

async function getContext(req: Request) {
    const token = req.headers.authorization?.split(' ')[1] || '';
    const supabase = createAuthenticatedClient(token);
    const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', req.user.id)
        .single();
    return { supabase, role: profile?.role || 'entrepreneur' };
}

/**
 * GET /api/mentor/profile
 * Get current mentor's profile
 */
router.get(
    '/profile',
    authenticateUser,
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const serviceClient = createServiceRoleClient();

            const { data: profile } = await serviceClient
                .from('profiles')
                .select('id, full_name, email, role')
                .eq('id', req.user.id)
                .single();

            const { data: mentorProfile } = await serviceClient
                .from('mentor_profiles')
                .select('*')
                .eq('id', req.user.id)
                .single();

            successResponse(res, {
                profile: {
                    ...profile,
                    expertise_areas: mentorProfile?.expertise_areas || [],
                    bio: mentorProfile?.bio || '',
                    max_sessions_per_week: mentorProfile?.max_sessions_per_week || 5,
                },
            });
        } catch (error) {
            next(error);
        }
    }
);

/**
 * PUT /api/mentor/profile
 * Update mentor profile (bio, expertise, max sessions)
 */
router.put(
    '/profile',
    authenticateUser,
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const serviceClient = createServiceRoleClient();
            const { bio, expertise_areas, max_sessions_per_week, full_name } = req.body;

            // Update profiles table if full_name provided
            if (full_name) {
                await serviceClient
                    .from('profiles')
                    .update({ full_name })
                    .eq('id', req.user.id);
            }

            // Upsert mentor_profiles
            const { data, error } = await serviceClient
                .from('mentor_profiles')
                .upsert({
                    id: req.user.id,
                    bio: bio ?? undefined,
                    expertise_areas: expertise_areas ?? undefined,
                    max_sessions_per_week: max_sessions_per_week ?? undefined,
                    updated_at: new Date().toISOString(),
                }, { onConflict: 'id' })
                .select()
                .single();

            if (error) {
                console.error('Error updating mentor profile:', error);
                return res.status(500).json({ success: false, message: 'Failed to update profile' });
            }

            successResponse(res, { profile: data });
        } catch (error) {
            next(error);
        }
    }
);

/**
 * GET /api/mentor/ventures
 * List ventures assigned to the current mentor
 */
router.get(
    '/ventures',
    authenticateUser,
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const serviceClient = createServiceRoleClient();

            // Get assignments
            const { data: assignments, error } = await serviceClient
                .from('mentor_venture_assignments')
                .select('id, venture_id, status, assigned_at')
                .eq('mentor_id', req.user.id)
                .eq('status', 'active');

            if (error) {
                console.error('Error fetching mentor ventures:', error);
                return res.status(500).json({ success: false, message: 'Failed to fetch ventures' });
            }

            if (!assignments || assignments.length === 0) {
                return successResponse(res, { ventures: [] });
            }

            // Get venture details
            const ventureIds = assignments.map((a: any) => a.venture_id);
            const { data: ventures } = await serviceClient
                .from('ventures')
                .select('id, name, founder_name, city, status, program_name, created_at')
                .in('id', ventureIds);

            // Get upcoming session counts per venture
            const { data: sessionCounts } = await serviceClient
                .from('mentor_sessions')
                .select('venture_id, id')
                .eq('mentor_id', req.user.id)
                .eq('status', 'scheduled');

            const countMap: Record<string, number> = {};
            for (const s of (sessionCounts || [])) {
                countMap[s.venture_id] = (countMap[s.venture_id] || 0) + 1;
            }

            const ventureMap: Record<string, any> = {};
            for (const v of (ventures || [])) ventureMap[v.id] = v;

            const result = (assignments || []).map((a: any) => ({
                ...ventureMap[a.venture_id],
                assignment_id: a.id,
                assigned_at: a.assigned_at,
                upcoming_sessions: countMap[a.venture_id] || 0,
            })).filter((v: any) => v.id);

            successResponse(res, { ventures: result });
        } catch (error) {
            next(error);
        }
    }
);

/**
 * GET /api/mentor/sessions
 * List all sessions for the current mentor
 */
router.get(
    '/sessions',
    authenticateUser,
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const serviceClient = createServiceRoleClient();

            let query = serviceClient
                .from('mentor_sessions')
                .select('*')
                .eq('mentor_id', req.user.id)
                .order('scheduled_date', { ascending: true })
                .order('scheduled_time', { ascending: true });

            const { status } = req.query;
            if (status) {
                query = query.eq('status', status as string);
            }

            const { data, error } = await query;

            if (error) {
                console.error('Error fetching mentor sessions:', error);
                return res.status(500).json({ success: false, message: 'Failed to fetch sessions' });
            }

            // Enrich with venture names
            const ventureIds = [...new Set((data || []).map((s: any) => s.venture_id))];
            let ventureMap: Record<string, any> = {};
            if (ventureIds.length > 0) {
                const { data: ventures } = await serviceClient
                    .from('ventures')
                    .select('id, name, founder_name')
                    .in('id', ventureIds);
                for (const v of (ventures || [])) ventureMap[v.id] = v;
            }

            const sessions = (data || []).map((s: any) => ({
                ...s,
                venture_name: ventureMap[s.venture_id]?.name || '',
                founder_name: ventureMap[s.venture_id]?.founder_name || s.mentee_name || '',
            }));

            successResponse(res, { sessions });
        } catch (error) {
            next(error);
        }
    }
);

export default router;
