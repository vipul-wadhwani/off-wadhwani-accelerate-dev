import { Router, Request, Response } from 'express';
import { authenticateUser } from '../../middleware/auth';
import { getAvailability, saveAvailability, getAvailableSlots } from './availabilityService';

const router = Router();

/**
 * GET /api/availability/:expertId
 * Get all availability slots for an expert.
 */
router.get('/:expertId', authenticateUser, async (req: Request, res: Response) => {
    try {
        const slots = await getAvailability(req.params.expertId);
        return res.json({ success: true, data: slots });
    } catch (err: any) {
        return res.status(500).json({ success: false, message: err.message });
    }
});

/**
 * GET /api/availability/:expertId/slots?date=YYYY-MM-DD
 * Get available (unbooked) slots for an expert on a specific date.
 */
router.get('/:expertId/slots', authenticateUser, async (req: Request, res: Response) => {
    try {
        const { date } = req.query;
        if (!date || typeof date !== 'string') {
            return res.status(400).json({ success: false, message: 'date query parameter is required' });
        }
        const slots = await getAvailableSlots(req.params.expertId, date);
        return res.json({ success: true, data: slots });
    } catch (err: any) {
        return res.status(500).json({ success: false, message: err.message });
    }
});

/**
 * PUT /api/availability
 * Save/replace the current user's recurring availability.
 * Body: { slots: [{ day_of_week, start_time, end_time }] }
 */
router.put('/', authenticateUser, async (req: Request, res: Response) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ success: false, message: 'Not authenticated' });
        }

        const { slots } = req.body;
        if (!Array.isArray(slots)) {
            return res.status(400).json({ success: false, message: 'slots array is required' });
        }

        await saveAvailability(userId, slots);
        return res.json({ success: true, message: 'Availability saved' });
    } catch (err: any) {
        return res.status(500).json({ success: false, message: err.message });
    }
});

export default router;
