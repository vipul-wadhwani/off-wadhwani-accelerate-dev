import { Router, Request, Response } from 'express';
import { authenticateUser } from '../../middleware/auth';
import { matchExperts, listExperts } from './matchingService';

const router = Router();

/**
 * POST /api/matching/find
 * AI-powered expert matching for a venture.
 * Body: { venture_id: string, count?: number }
 */
router.post('/find', authenticateUser, async (req: Request, res: Response) => {
    try {
        const { venture_id, count } = req.body;
        if (!venture_id) {
            return res.status(400).json({ success: false, message: 'venture_id is required' });
        }

        const matches = await matchExperts(venture_id, count || 5);
        return res.json({ success: true, data: matches });
    } catch (err: any) {
        console.error('[Matching] Error:', err);
        return res.status(500).json({ success: false, message: err.message });
    }
});

/**
 * GET /api/matching/experts
 * Browse/search all available experts.
 * Query: ?search=&sector=&expertise=
 */
router.get('/experts', authenticateUser, async (req: Request, res: Response) => {
    try {
        const { search, sector, expertise } = req.query;
        const experts = await listExperts({
            search: search as string,
            sector: sector as string,
            expertise: expertise as string,
        });
        return res.json({ success: true, data: experts });
    } catch (err: any) {
        console.error('[Matching] List error:', err);
        return res.status(500).json({ success: false, message: err.message });
    }
});

export default router;
