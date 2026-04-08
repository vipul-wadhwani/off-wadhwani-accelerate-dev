import { Router, Request, Response } from 'express';
import { authenticateUser } from '../../middleware/auth';
import { isZoomSdkConfigured, generateSdkSignature } from './zoomSdkService';
import { createServiceRoleClient } from '../../config/supabase';

const router = Router();

/**
 * POST /api/zoom/signature
 * Generate a Zoom Meeting SDK signature for embedded joining.
 * Body: { meetingNumber: string, role: number (0=participant, 1=host) }
 */
router.post('/signature', authenticateUser, async (req: Request, res: Response) => {
    try {
        if (!isZoomSdkConfigured()) {
            return res.status(503).json({
                success: false,
                message: 'Zoom Meeting SDK is not configured',
            });
        }

        const { meetingNumber, role } = req.body;
        if (!meetingNumber) {
            return res.status(400).json({ success: false, message: 'meetingNumber is required' });
        }

        const signature = generateSdkSignature(String(meetingNumber), Number(role) || 0);

        return res.json({
            success: true,
            signature,
            sdkKey: process.env.ZOOM_SDK_KEY,
        });
    } catch (err: any) {
        console.error('[Zoom SDK] Signature error:', err);
        return res.status(500).json({ success: false, message: 'Failed to generate signature' });
    }
});

/**
 * GET /api/zoom/meeting/:sessionId
 * Get Zoom meeting details for a session (meeting number + password for SDK join).
 */
router.get('/meeting/:sessionId', authenticateUser, async (req: Request, res: Response) => {
    try {
        const supabase = createServiceRoleClient();
        const { data: session, error } = await supabase
            .from('mentor_sessions')
            .select('id, meeting_id, zoom_meeting_id, zoom_meeting_password, join_url, topic, status, mentor_id, venture_id')
            .eq('id', req.params.sessionId)
            .single();

        if (error || !session) {
            return res.status(404).json({ success: false, message: 'Session not found' });
        }

        return res.json({
            success: true,
            data: {
                sessionId: session.id,
                meetingId: session.meeting_id,
                zoomMeetingId: session.zoom_meeting_id,
                zoomPassword: session.zoom_meeting_password,
                joinUrl: session.join_url,
                topic: session.topic,
                status: session.status,
                mentorId: session.mentor_id,
                ventureId: session.venture_id,
            },
        });
    } catch (err: any) {
        console.error('[Zoom SDK] Meeting fetch error:', err);
        return res.status(500).json({ success: false, message: 'Failed to fetch meeting details' });
    }
});

export default router;
