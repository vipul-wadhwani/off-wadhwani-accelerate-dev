import { Router, Request, Response } from 'express';
import { authenticateUser } from '../../middleware/auth';
import { generateBrief, getLatestBrief, getBriefHistory } from './briefService';

const router = Router();

/**
 * GET /api/briefs/:sessionId
 * Get the latest brief for a session.
 */
router.get('/:sessionId', authenticateUser, async (req: Request, res: Response) => {
    try {
        const brief = await getLatestBrief(req.params.sessionId);
        return res.json({ success: true, data: brief });
    } catch (err: any) {
        return res.status(500).json({ success: false, message: err.message });
    }
});

/**
 * GET /api/briefs/:sessionId/history
 * Get all brief versions for a session.
 */
router.get('/:sessionId/history', authenticateUser, async (req: Request, res: Response) => {
    try {
        const history = await getBriefHistory(req.params.sessionId);
        return res.json({ success: true, data: history });
    } catch (err: any) {
        return res.status(500).json({ success: false, message: err.message });
    }
});

/**
 * POST /api/briefs/generate
 * Generate a new AI brief for a session.
 * Body: { session_id: string }
 */
router.post('/generate', authenticateUser, async (req: Request, res: Response) => {
    try {
        const { session_id } = req.body;
        if (!session_id) {
            return res.status(400).json({ success: false, message: 'session_id is required' });
        }

        const brief = await generateBrief(session_id, req.user.id);
        return res.json({ success: true, data: brief });
    } catch (err: any) {
        return res.status(500).json({ success: false, message: err.message });
    }
});

export default router;
