import { Router, Request, Response } from 'express';
import { authenticateUser } from '../../middleware/auth';
import { appendTranscript, getTranscript } from './transcriptService';
import { generateInsightSnapshot, getInsights } from './insightService';
import { endSession, getSummary } from './summaryService';

const router = Router();

/**
 * POST /api/sessions/:id/transcript
 * Append transcript chunks.
 * Body: { chunks: [{ speaker, text, time }] }
 */
router.post('/:id/transcript', authenticateUser, async (req: Request, res: Response) => {
    try {
        const { chunks } = req.body;
        if (!chunks || !Array.isArray(chunks)) {
            return res.status(400).json({ success: false, message: 'chunks array required' });
        }
        await appendTranscript(req.params.id, chunks);
        return res.json({ success: true });
    } catch (err: any) {
        return res.status(500).json({ success: false, message: err.message });
    }
});

/**
 * GET /api/sessions/:id/transcript
 * Get transcript for a session.
 */
router.get('/:id/transcript', authenticateUser, async (req: Request, res: Response) => {
    try {
        const transcript = await getTranscript(req.params.id);
        return res.json({ success: true, data: transcript });
    } catch (err: any) {
        return res.status(500).json({ success: false, message: err.message });
    }
});

/**
 * POST /api/sessions/:id/insights
 * Generate an AI insight snapshot from recent transcript.
 * Body: { transcript: string, topic?: string }
 */
router.post('/:id/insights', authenticateUser, async (req: Request, res: Response) => {
    try {
        const { transcript, topic } = req.body;
        if (!transcript) {
            return res.status(400).json({ success: false, message: 'transcript is required' });
        }
        const insight = await generateInsightSnapshot(req.params.id, transcript, topic);
        return res.json({ success: true, data: insight });
    } catch (err: any) {
        return res.status(500).json({ success: false, message: err.message });
    }
});

/**
 * GET /api/sessions/:id/insights
 * Get all insight snapshots for a session.
 */
router.get('/:id/insights', authenticateUser, async (req: Request, res: Response) => {
    try {
        const insights = await getInsights(req.params.id);
        return res.json({ success: true, data: insights });
    } catch (err: any) {
        return res.status(500).json({ success: false, message: err.message });
    }
});

/**
 * POST /api/sessions/:id/end
 * End a session: finalize transcript, generate summary, update status.
 */
router.post('/:id/end', authenticateUser, async (req: Request, res: Response) => {
    try {
        const result = await endSession(req.params.id);
        return res.json({ success: true, data: result });
    } catch (err: any) {
        return res.status(500).json({ success: false, message: err.message });
    }
});

/**
 * GET /api/sessions/:id/summary
 * Get the post-meeting summary.
 */
router.get('/:id/summary', authenticateUser, async (req: Request, res: Response) => {
    try {
        const summary = await getSummary(req.params.id);
        return res.json({ success: true, data: summary });
    } catch (err: any) {
        return res.status(500).json({ success: false, message: err.message });
    }
});

export default router;
