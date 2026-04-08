import { Router, Request, Response } from 'express';
import { authenticateUser } from '../../middleware/auth';
import { createRequest, acceptRequest, declineRequest, getRequests } from './requestService';

const router = Router();

/**
 * POST /api/meeting-requests
 * Create a meeting request (venture or VP on behalf of venture).
 */
router.post('/', authenticateUser, async (req: Request, res: Response) => {
    try {
        const userId = req.user?.id;
        const role = req.user?.user_metadata?.role;
        if (!userId) return res.status(401).json({ success: false, message: 'Not authenticated' });

        const { venture_id, expert_id, meeting_goal, problem_statement, preferred_date, preferred_time, preferred_duration } = req.body;

        if (!venture_id || !expert_id) {
            return res.status(400).json({ success: false, message: 'venture_id and expert_id are required' });
        }

        const data = await createRequest({
            venture_id,
            expert_id,
            requested_by: userId,
            requested_by_role: role || 'entrepreneur',
            meeting_goal,
            problem_statement,
            preferred_date,
            preferred_time,
            preferred_duration,
        });

        return res.status(201).json({ success: true, data });
    } catch (err: any) {
        return res.status(500).json({ success: false, message: err.message });
    }
});

/**
 * GET /api/meeting-requests
 * List requests. Query: ?role=expert|venture&status=pending|accepted|declined|completed&venture_id=
 */
router.get('/', authenticateUser, async (req: Request, res: Response) => {
    try {
        const userId = req.user?.id;
        const userRole = req.user?.user_metadata?.role;
        const { role, status, venture_id } = req.query;

        const opts: any = {};
        if (status) opts.status = status as string;
        if (venture_id) opts.ventureId = venture_id as string;

        if (role === 'expert' || userRole === 'mentor') {
            opts.expertId = userId;
        } else if (role === 'venture' || userRole === 'entrepreneur') {
            // Entrepreneurs see all requests for their ventures (including VP-booked)
            const { createServiceRoleClient } = await import('../../config/supabase');
            const serviceClient = createServiceRoleClient();
            const { data: ventures } = await serviceClient
                .from('ventures')
                .select('id')
                .eq('user_id', userId);
            if (ventures && ventures.length > 0) {
                opts.ventureIds = ventures.map((v: any) => v.id);
            } else {
                opts.requestedBy = userId;
            }
        }
        // Staff (VP/VM/admin) see all if no filter

        const data = await getRequests(opts);
        return res.json({ success: true, data });
    } catch (err: any) {
        return res.status(500).json({ success: false, message: err.message });
    }
});

/**
 * PUT /api/meeting-requests/:id/accept
 * Expert accepts a request.
 */
router.put('/:id/accept', authenticateUser, async (req: Request, res: Response) => {
    try {
        const userId = req.user?.id;
        if (!userId) return res.status(401).json({ success: false, message: 'Not authenticated' });

        const result = await acceptRequest(req.params.id, userId);
        return res.json({ success: true, data: result });
    } catch (err: any) {
        return res.status(500).json({ success: false, message: err.message });
    }
});

/**
 * PUT /api/meeting-requests/:id/decline
 * Expert declines a request.
 * Body: { note?: string }
 */
router.put('/:id/decline', authenticateUser, async (req: Request, res: Response) => {
    try {
        const userId = req.user?.id;
        if (!userId) return res.status(401).json({ success: false, message: 'Not authenticated' });

        const data = await declineRequest(req.params.id, userId, req.body.note);
        return res.json({ success: true, data });
    } catch (err: any) {
        return res.status(500).json({ success: false, message: err.message });
    }
});

export default router;
