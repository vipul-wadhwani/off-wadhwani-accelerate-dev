import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import * as ventureService from '../services/ventureService';
import { autoAssignScreeningManager } from '../services/ventureService';
import * as aiService from '../services/aiService';
import { extractDocumentText } from '../services/documentService';
import { authenticateUser, requireRole } from '../middleware/auth';
import { validateBody, validateQuery } from '../middleware/validate';
import { createAuthenticatedClient } from '../config/supabase';
import { isZoomConfigured, generateMeetingWithDetails } from '../services/zoomService';
import {
    createVentureSchema,
    updateVentureSchema,
    createStreamSchema,
    updateStreamSchema,
    ventureQuerySchema
} from '../types/schemas';
import { successResponse, createdResponse, noContentResponse } from '../utils/response';
import { sendPanelInvitationEmail, sendWelcomeEmail, sendSelectionWelcomeEmail, sendSelfserveEmail, sendMentorSessionEmail, sendPanelistAssignmentEmail, sendVPVMAssignmentEmail, sendVPVMMeetingScheduledEmail, sendBusinessMeetingScheduledEmail, logEmailTrigger } from '../services/emailService';
import { createServiceRoleClient } from '../config/supabase';

const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
    fileFilter: (_req, file, cb) => {
        const allowed = [
            'application/pdf',
            'application/vnd.ms-powerpoint',
            'application/vnd.openxmlformats-officedocument.presentationml.presentation',
            'application/msword',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        ];
        if (allowed.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Invalid file type. Please upload a PDF, PPT, PPTX, DOC, or DOCX file.'));
        }
    },
});

const router = Router();

// Helper to get authenticated client and user role
async function getContext(req: Request) {
    const token = req.headers.authorization?.split(' ')[1] || '';
    const supabase = createAuthenticatedClient(token);

    // Get user profile/role safely — try profiles table first, fall back to user_metadata
    const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', req.user.id)
        .single();

    const role = profile?.role || req.user.user_metadata?.role || 'entrepreneur';
    if (profileError) {
        console.warn(`[getContext] profiles lookup failed for ${req.user.id}: ${profileError.message}, using role: ${role}`);
    }

    return { supabase, role };
}

// ============ VENTURE ROUTES ============

/**
 * POST /api/ventures/public-apply
 * Public endpoint - no auth required
 * Creates a venture + application + streams and sends welcome email
 */
router.post(
    '/public-apply',
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const supabase = createServiceRoleClient();
            const body = req.body;

            // Validate required fields
            if (!body.name || !body.founder_name || !body.email) {
                return res.status(400).json({
                    success: false,
                    message: 'Business name, founder name, and email are required',
                });
            }

            const growthCurrent: any = body.growth_current || {};
            const growthTarget: any = body.growth_target || {};
            const commitment: any = body.commitment || {};

            console.log('[PublicApply] Commitment data received:', JSON.stringify(commitment));
            console.log('[PublicApply] targetJobs raw:', commitment.targetJobs, 'type:', typeof commitment.targetJobs, 'parsed:', commitment.targetJobs ? parseInt(commitment.targetJobs) : null);

            // 1. Create venture (no user_id for public submissions)
            const { data: venture, error: ventureError } = await supabase
                .from('ventures')
                .insert({
                    name: body.name,
                    founder_name: body.founder_name,
                    city: growthCurrent.city || null,
                    location: growthCurrent.city || null,
                    status: 'Submitted',
                    program_name: body.program || 'Accelerate',
                    workbench_locked: true,
                })
                .select()
                .single();

            if (ventureError) throw ventureError;

            // 2. Create application record
            const { error: appError } = await supabase
                .from('venture_applications')
                .insert({
                    venture_id: venture.id,
                    what_do_you_sell: growthCurrent.product || null,
                    who_do_you_sell_to: growthCurrent.segment || null,
                    which_regions: growthCurrent.geography || null,
                    company_type: growthCurrent.business_type || null,
                    referred_by: growthCurrent.referred_by || null,
                    founder_email: body.email,
                    founder_phone: growthCurrent.phone || null,
                    founder_designation: growthCurrent.role || null,
                    revenue_12m: commitment.lastYearRevenue ?? null,
                    revenue_potential_3y: commitment.revenuePotential ?? null,
                    full_time_employees: growthCurrent.employees || null,
                    financial_condition: commitment.financialCondition || null,
                    incremental_hiring: commitment.incrementalHiring != null && commitment.incrementalHiring !== '' ? Number(commitment.incrementalHiring) || null : null,
                    target_jobs: commitment.targetJobs != null && commitment.targetJobs !== '' ? Number(commitment.targetJobs) : null,
                    time_commitment: commitment.timeCommitment || null,
                    second_line_team: commitment.secondLineTeam || null,
                    growth_focus: body.growth_focus ? (Array.isArray(body.growth_focus) ? body.growth_focus : body.growth_focus.split(',').filter(Boolean)) : [],
                    focus_product: growthTarget.product || null,
                    focus_segment: growthTarget.segment || null,
                    focus_geography: growthTarget.geography || null,
                    blockers: body.blockers || null,
                    support_request: body.support_request || null,
                    state: growthCurrent.state || null,
                    additional_data: {},
                });

            if (appError) {
                console.error('Error creating application for public apply:', appError);
                await supabase.from('ventures').delete().eq('id', venture.id);
                throw appError;
            }

            // 3. Create streams
            const streams = body.workstream_statuses || [];
            for (const ws of streams) {
                await supabase.from('venture_streams').insert({
                    venture_id: venture.id,
                    stream_name: ws.stream_name,
                    status: ws.status || 'Not started',
                });
            }

            // 4. Send welcome email (await to report status)
            let emailStatus = 'skipped';
            if (body.email) {
                logEmailTrigger('welcome.public_apply', {
                    recipient: body.email,
                    metadata: { venture_id: venture.id, venture_name: body.name },
                });
                console.log(`[PublicApply] Triggering welcome email to ${body.email} for venture "${body.name}"`);
                try {
                    await sendWelcomeEmail(body.email, body.founder_name, body.name);
                    emailStatus = 'sent';
                    console.log(`[PublicApply] Welcome email sent successfully to ${body.email}`);
                } catch (err: any) {
                    emailStatus = 'failed';
                    console.error(`[PublicApply] Failed to send welcome email to ${body.email}:`, err.message || err);
                }
            } else {
                logEmailTrigger('welcome.public_apply', {
                    skipped: true,
                    skipReason: 'No email provided in application body',
                    metadata: { venture_id: venture.id, venture_name: body.name },
                });
                console.warn('[PublicApply] No email provided in application body, skipping welcome email');
            }

            // 5. Auto-assign screening manager based on revenue (fire-and-forget)
            autoAssignScreeningManager(venture.id)
                .then(result => {
                    if (result.assignedTo) {
                        console.log(`[PublicApply] Auto-assigned screening manager: ${result.assignedTo} for venture ${body.name}`);
                    }
                })
                .catch(err => console.error('[PublicApply] Auto-assign failed:', err));

            createdResponse(res, {
                message: 'Application submitted successfully',
                venture: { id: venture.id, name: venture.name },
                emailStatus,
            });
        } catch (error) {
            console.error('Error in public apply:', error);
            next(error);
        }
    }
);

/**
 * POST /api/ventures/:id/public-upload-document
 * Public endpoint - no auth required
 * Uploads a corporate presentation for a venture created via public-apply
 */
router.post(
    '/:id/public-upload-document',
    upload.single('file'),
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const ventureId = req.params.id;
            const file = req.file;

            if (!file) {
                return res.status(400).json({ success: false, message: 'No file provided' });
            }

            const supabase = createServiceRoleClient();

            // Verify the venture exists
            const { data: venture, error: ventureError } = await supabase
                .from('ventures')
                .select('id')
                .eq('id', ventureId)
                .single();

            if (ventureError || !venture) {
                return res.status(404).json({ success: false, message: 'Venture not found' });
            }

            // Upload to Supabase storage
            const timestamp = Date.now();
            const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
            const filePath = `${ventureId}/${timestamp}_${safeName}`;

            const { error: uploadError } = await supabase.storage
                .from('venture-documents')
                .upload(filePath, file.buffer, {
                    contentType: file.mimetype,
                    upsert: false,
                });

            if (uploadError) {
                console.error('Storage upload error:', uploadError);
                return res.status(500).json({ success: false, message: 'Failed to upload file' });
            }

            // Update the application record with the file path
            const { error: updateError } = await supabase
                .from('venture_applications')
                .update({ corporate_presentation_url: filePath })
                .eq('venture_id', ventureId);

            if (updateError) {
                console.error('Failed to save document URL:', updateError);
                return res.status(500).json({ success: false, message: 'Failed to save document reference' });
            }

            successResponse(res, { filePath });
        } catch (error) {
            console.error('Error in public document upload:', error);
            next(error);
        }
    }
);

/**
 * GET /api/ventures
 * Get all ventures (with filters)
 */
router.get(
    '/',
    authenticateUser,
    validateQuery(ventureQuerySchema),
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { supabase, role } = await getContext(req);

            const result = await ventureService.getVentures(
                supabase,
                req.user.id,
                role,
                req.query as any
            );

            successResponse(res, result);
        } catch (error) {
            next(error);
        }
    }
);

/**
 * POST /api/ventures
 * Create a new venture
 */
router.post(
    '/',
    authenticateUser,
    validateBody(createVentureSchema),
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const token = req.headers.authorization?.split(' ')[1] || '';
            const supabase = createAuthenticatedClient(token);

            const venture = await ventureService.createVenture(supabase, req.user.id, req.body);
            createdResponse(res, { venture });
        } catch (error) {
            console.error('Error creating venture:', error);
            next(error);
        }
    }
);

/**
 * GET /api/ventures/vpvm-candidates
 * List VP/VM candidates for assignment (ops_manager, admin only)
 */
router.get(
    '/vpvm-candidates',
    authenticateUser,
    requireRole('ops_manager', 'admin'),
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const program = (req.query.program as string) || '';
            const supabase = createServiceRoleClient();

            // Determine which role to query based on program
            let targetRole = 'committee_member'; // Default for Core/Select
            if (program.toLowerCase().includes('prime')) {
                targetRole = 'venture_mgr';
            }

            // Get panelist names to exclude (they are panel reviewers, not VP/VM candidates)
            const { data: panelistRows } = await supabase
                .from('panelists')
                .select('name, email');
            const panelistNames = new Set((panelistRows || []).map((p: any) => (p.name || '').toLowerCase()));
            const panelistEmails = new Set((panelistRows || []).map((p: any) => (p.email || '').toLowerCase()));

            // Get profiles with the target role, then exclude panelists by name or email
            const { data: allProfiles, error } = await supabase
                .from('profiles')
                .select('id, full_name, role, email')
                .eq('role', targetRole)
                .order('full_name');

            if (error) throw error;

            const candidates = (allProfiles || []).filter(
                (p: any) => !panelistNames.has((p.full_name || '').toLowerCase()) &&
                             !panelistEmails.has((p.email || '').toLowerCase())
            );

            successResponse(res, { candidates });
        } catch (error) {
            next(error);
        }
    }
);

/**
 * GET /api/ventures/my-mentor-sessions
 * Get upcoming mentor sessions for ventures owned by the current user (entrepreneur)
 */
router.get(
    '/my-mentor-sessions',
    authenticateUser,
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            res.set('Cache-Control', 'no-store');
            const serviceClient = createServiceRoleClient();

            // Get ventures owned by this user
            const { data: ventures } = await serviceClient
                .from('ventures')
                .select('id, name')
                .eq('user_id', req.user.id);

            if (!ventures || ventures.length === 0) {
                return successResponse(res, { sessions: [] });
            }

            const ventureIds = ventures.map((v: any) => v.id);
            const ventureMap: Record<string, string> = {};
            for (const v of ventures) ventureMap[v.id] = v.name;

            // Get upcoming sessions for these ventures
            const { data: sessions } = await serviceClient
                .from('mentor_sessions')
                .select('id, topic, scheduled_date, scheduled_time, duration_minutes, join_url, status, venture_id, mentor_id')
                .in('venture_id', ventureIds)
                .eq('status', 'scheduled')
                .gte('scheduled_date', new Date().toISOString().split('T')[0])
                .order('scheduled_date', { ascending: true })
                .order('scheduled_time', { ascending: true })
                .limit(10);

            // Get mentor names
            const mentorIds = [...new Set((sessions || []).map((s: any) => s.mentor_id))];
            let mentorMap: Record<string, string> = {};
            if (mentorIds.length > 0) {
                const { data: mentors } = await serviceClient
                    .from('profiles')
                    .select('id, full_name')
                    .in('id', mentorIds);
                for (const m of (mentors || [])) mentorMap[m.id] = m.full_name;
            }

            const enriched = (sessions || []).map((s: any) => ({
                ...s,
                venture_name: ventureMap[s.venture_id] || '',
                mentor_name: mentorMap[s.mentor_id] || 'Mentor',
            }));

            successResponse(res, { sessions: enriched });
        } catch (error) {
            next(error);
        }
    }
);

/**
 * GET /api/ventures/vpvm-upcoming-sessions
 * Get upcoming expert sessions across all ventures assigned to the current VP/VM
 */
router.get(
    '/vpvm-upcoming-sessions',
    authenticateUser,
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            // Prevent caching — always return fresh data
            res.set('Cache-Control', 'no-store');
            const serviceClient = createServiceRoleClient();

            // Get ventures assigned to this VP/VM
            const { data: ventures } = await serviceClient
                .from('ventures')
                .select('id, name, founder_name')
                .eq('assigned_vm_id', req.user.id);

            if (!ventures || ventures.length === 0) {
                return successResponse(res, { sessions: [] });
            }

            const ventureIds = ventures.map((v: any) => v.id);
            const ventureMap: Record<string, { name: string; founder: string }> = {};
            for (const v of ventures) ventureMap[v.id] = { name: v.name, founder: v.founder_name || '' };

            // Get upcoming sessions
            const { data: sessions } = await serviceClient
                .from('mentor_sessions')
                .select('id, topic, scheduled_date, scheduled_time, duration_minutes, join_url, zoom_meeting_id, status, venture_id, mentor_id, source')
                .in('venture_id', ventureIds)
                .eq('status', 'scheduled')
                .gte('scheduled_date', new Date().toISOString().split('T')[0])
                .order('scheduled_date', { ascending: true })
                .order('scheduled_time', { ascending: true })
                .limit(10);

            // Get expert names
            const mentorIds = [...new Set((sessions || []).map((s: any) => s.mentor_id))];
            let mentorMap: Record<string, string> = {};
            if (mentorIds.length > 0) {
                const { data: mentors } = await serviceClient
                    .from('profiles')
                    .select('id, full_name')
                    .in('id', mentorIds);
                for (const m of (mentors || [])) mentorMap[m.id] = m.full_name;
            }

            const enriched = (sessions || []).map((s: any) => ({
                ...s,
                venture_name: ventureMap[s.venture_id]?.name || '',
                founder_name: ventureMap[s.venture_id]?.founder || '',
                expert_name: mentorMap[s.mentor_id] || 'Expert',
            }));

            successResponse(res, { sessions: enriched });
        } catch (error) {
            next(error);
        }
    }
);

/**
 * GET /api/ventures/vpvm-completed-sessions
 * Get completed (ended) sessions across all ventures assigned to the current VP/VM.
 */
router.get(
    '/vpvm-completed-sessions',
    authenticateUser,
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            res.set('Cache-Control', 'no-store');
            const serviceClient = createServiceRoleClient();

            const { data: ventures } = await serviceClient
                .from('ventures')
                .select('id, name, founder_name')
                .eq('assigned_vm_id', req.user.id);

            if (!ventures || ventures.length === 0) {
                return successResponse(res, { sessions: [] });
            }

            const ventureIds = ventures.map((v: any) => v.id);
            const ventureMap: Record<string, { name: string; founder: string }> = {};
            for (const v of ventures) ventureMap[v.id] = { name: v.name, founder: v.founder_name || '' };

            const { data: sessions } = await serviceClient
                .from('mentor_sessions')
                .select('id, topic, scheduled_date, scheduled_time, duration_minutes, status, venture_id, mentor_id, source, started_at, ended_at')
                .in('venture_id', ventureIds)
                .eq('status', 'ended')
                .order('scheduled_date', { ascending: false })
                .order('scheduled_time', { ascending: false })
                .limit(50);

            const mentorIds = [...new Set((sessions || []).map((s: any) => s.mentor_id))];
            let mentorMap: Record<string, string> = {};
            if (mentorIds.length > 0) {
                const { data: mentors } = await serviceClient
                    .from('profiles')
                    .select('id, full_name')
                    .in('id', mentorIds);
                for (const m of (mentors || [])) mentorMap[m.id] = m.full_name;
            }

            const enriched = (sessions || []).map((s: any) => ({
                ...s,
                venture_name: ventureMap[s.venture_id]?.name || '',
                founder_name: ventureMap[s.venture_id]?.founder || '',
                expert_name: mentorMap[s.mentor_id] || 'Expert',
            }));

            successResponse(res, { sessions: enriched });
        } catch (error) {
            next(error);
        }
    }
);

/**
 * GET /api/ventures/:id/assigned-vpvm
 * Get the assigned VP/VM for a venture
 */
router.get(
    '/:id/assigned-vpvm',
    authenticateUser,
    async (req, res, next) => {
        try {
            const serviceClient = createServiceRoleClient();
            const { data: venture } = await serviceClient
                .from('ventures')
                .select('assigned_vm_id')
                .eq('id', req.params.id)
                .single();

            if (!venture?.assigned_vm_id) {
                return res.json({ success: true, data: null });
            }

            const { data: profile } = await serviceClient
                .from('profiles')
                .select('id, full_name, email')
                .eq('id', venture.assigned_vm_id)
                .single();

            return res.json({ success: true, data: profile });
        } catch (error) {
            next(error);
        }
    }
);

/**
 * POST /api/ventures/:id/assign-vpvm
 * Assign a VP/VM to a venture (ops_manager, admin only)
 */
router.post(
    '/:id/assign-vpvm',
    authenticateUser,
    requireRole('ops_manager', 'admin'),
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { assigned_vm_id } = req.body;
            if (!assigned_vm_id) {
                return res.status(400).json({ error: 'assigned_vm_id is required' });
            }

            const serviceClient = createServiceRoleClient();
            // Use authenticated client for the update so auth.uid() is set for triggers
            const token = req.headers.authorization?.split(' ')[1] || '';
            const authClient = createAuthenticatedClient(token);

            // Verify venture exists and is in correct status
            const { data: venture, error: fetchError } = await serviceClient
                .from('ventures')
                .select('id, status')
                .eq('id', req.params.id)
                .single();

            if (fetchError || !venture) {
                return res.status(404).json({ error: 'Venture not found' });
            }

            if (venture.status !== 'Assign VP/VM') {
                return res.status(400).json({ error: `Venture status must be 'Assign VP/VM', currently '${venture.status}'` });
            }

            // Fetch assignee's name
            const { data: assignee, error: profileError } = await serviceClient
                .from('profiles')
                .select('full_name')
                .eq('id', assigned_vm_id)
                .single();

            if (profileError || !assignee) {
                return res.status(404).json({ error: 'Assignee profile not found' });
            }

            // Update venture using authenticated client so auth.uid() is available for triggers
            const { data: updated, error: updateError } = await authClient
                .from('ventures')
                .update({
                    assigned_vm_id,
                    venture_partner: assignee.full_name,
                    status: 'With VP/VM',
                })
                .eq('id', req.params.id)
                .select()
                .single();

            if (updateError) throw updateError;

            // Fire-and-forget: auto-generate roadmap for the assigned VP/VM
            (async () => {
                try {
                    console.log(`[AutoRoadmap] Generating roadmap for venture ${req.params.id} after VP/VM assignment`);
                    const { data: ventureForRoadmap } = await serviceClient
                        .from('ventures')
                        .select('*, application:venture_applications(*), assessments:venture_assessments(*)')
                        .eq('id', req.params.id)
                        .single();

                    if (!ventureForRoadmap) return;

                    const app = ventureForRoadmap.application?.[0] || ventureForRoadmap.application || {};
                    const assessment = (ventureForRoadmap.assessments || []).find((a: any) => a.is_current) || ventureForRoadmap.assessments?.[0] || {};

                    let corporatePresentationText: string | undefined;
                    if (app.corporate_presentation_url) {
                        const text = await extractDocumentText(app.corporate_presentation_url);
                        if (text) corporatePresentationText = text;
                    }

                    // Fetch panel feedback
                    const { data: pfRows } = await serviceClient
                        .from('panel_feedback')
                        .select('*')
                        .eq('venture_id', req.params.id)
                        .order('created_at', { ascending: false })
                        .limit(1);

                    // Fetch interaction notes
                    const { data: interactions } = await serviceClient
                        .from('venture_interactions')
                        .select('interaction_type, title, transcript, interaction_date')
                        .eq('venture_id', req.params.id)
                        .order('interaction_date', { ascending: true });
                    const interactionNotes = (interactions || [])
                        .map((i: any) => `[${i.interaction_date || 'N/A'}] ${i.title || i.interaction_type}: ${i.transcript || ''}`)
                        .join('\n\n');

                    const ventureData = {
                        ...ventureForRoadmap,
                        revenue_12m: app.revenue_12m,
                        revenue_potential_3y: app.revenue_potential_3y,
                        full_time_employees: app.full_time_employees,
                        growth_focus: app.growth_focus,
                        what_do_you_sell: app.what_do_you_sell,
                        who_do_you_sell_to: app.who_do_you_sell_to,
                        which_regions: app.which_regions,
                        focus_product: app.focus_product,
                        focus_segment: app.focus_segment,
                        focus_geography: app.focus_geography,
                        blockers: app.blockers,
                        support_request: app.support_request,
                        incremental_hiring: app.incremental_hiring,
                        corporate_presentation_text: corporatePresentationText,
                    };

                    const roadmapData = await aiService.generateVentureRoadmap(ventureData, {
                        vsmNotes: assessment.notes || '',
                        aiAnalysis: assessment.ai_analysis || null,
                        interactionNotes: interactionNotes || '',
                        panelFeedback: pfRows?.[0] || null,
                        panelScorecard: assessment.panel_ai_analysis?.panel_scorecard || null,
                        gateQuestions: assessment.gate_questions || null,
                    });

                    // Mark old roadmaps as not current
                    await serviceClient
                        .from('venture_roadmaps')
                        .update({ is_current: false })
                        .eq('venture_id', req.params.id)
                        .eq('is_current', true);

                    const { count } = await serviceClient
                        .from('venture_roadmaps')
                        .select('*', { count: 'exact', head: true })
                        .eq('venture_id', req.params.id);

                    await serviceClient
                        .from('venture_roadmaps')
                        .insert({
                            venture_id: req.params.id,
                            generated_by: req.user.id,
                            generation_source: 'ai_generated',
                            based_on_assessment_id: assessment.id || null,
                            roadmap_data: roadmapData,
                            roadmap_version: (count || 0) + 1,
                            is_current: true,
                            generation_model: 'claude-sonnet-4-5-20250929',
                        });

                    console.log(`[AutoRoadmap] Roadmap generated and saved for venture ${req.params.id}`);
                } catch (err) {
                    console.error(`[AutoRoadmap] Failed to auto-generate roadmap for venture ${req.params.id}:`, err);
                }
            })();

            // Fire-and-forget: send email to assigned VP/VM
            (async () => {
                try {
                    const { data: vmProfile } = await serviceClient
                        .from('profiles')
                        .select('email, full_name')
                        .eq('id', assigned_vm_id)
                        .single();

                    const { data: ventureInfo } = await serviceClient
                        .from('ventures')
                        .select('name, founder_name, city, state')
                        .eq('id', req.params.id)
                        .single();

                    if (vmProfile?.email && ventureInfo) {
                        logEmailTrigger('assignment.vpvm', {
                            recipient: vmProfile.email,
                            metadata: { venture_id: req.params.id, vm_id: assigned_vm_id },
                        });
                        const location = [ventureInfo.city, ventureInfo.state].filter(Boolean).join(', ') || 'N/A';
                        const appUrl = `${process.env.FRONTEND_URL || 'https://devaccelerate.wadhwaniliftoff.ai'}/vpvm/requests`;
                        await sendVPVMAssignmentEmail(
                            vmProfile.email,
                            vmProfile.full_name || 'Venture Partner',
                            ventureInfo.name || 'Venture',
                            ventureInfo.founder_name || 'Applicant',
                            location,
                            appUrl
                        );
                        console.log(`VP/VM assignment email sent to ${vmProfile.email} for venture ${ventureInfo.name}`);
                    } else {
                        logEmailTrigger('assignment.vpvm', {
                            skipped: true,
                            skipReason: !vmProfile?.email ? 'VP/VM profile has no email' : 'Venture info not found',
                            metadata: { venture_id: req.params.id, vm_id: assigned_vm_id },
                        });
                    }
                } catch (emailError) {
                    logEmailTrigger('assignment.vpvm', {
                        error: emailError,
                        metadata: { venture_id: req.params.id, vm_id: assigned_vm_id },
                    });
                }
            })();

            successResponse(res, { venture: updated });
        } catch (error) {
            next(error);
        }
    }
);

/**
 * GET /api/ventures/:id
 * Get a single venture by ID
 */
router.get(
    '/:id',
    authenticateUser,
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { supabase, role } = await getContext(req);

            const result = await ventureService.getVentureById(
                supabase,
                req.params.id,
                req.user.id,
                role
            );

            successResponse(res, result);
        } catch (error) {
            next(error);
        }
    }
);

/**
 * PUT /api/ventures/:id
 * Update a venture
 */
router.put(
    '/:id',
    authenticateUser,
    validateBody(updateVentureSchema),
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { supabase, role } = await getContext(req);

            // If SelfServe, auto-set status to Completed and clear assignments
            if (req.body.program_recommendation === 'Selfserve') {
                req.body.status = 'Completed';
                req.body.assigned_vsm_id = null;
                req.body.assigned_vm_id = null;
            }

            const venture = await ventureService.updateVenture(
                supabase,
                req.params.id,
                req.user.id,
                role,
                req.body
            );

            // Fire-and-forget: send panel invitation email when venture moves to Panel Review
            const program = req.body.program_recommendation;
            const status = req.body.status;
            if (
                program &&
                program !== 'Not Recommended' &&
                program !== 'Selfserve' &&
                status === 'Panel Review'
            ) {
                (async () => {
                    try {
                        const { data: profile } = await supabase
                            .from('profiles')
                            .select('email, full_name')
                            .eq('id', venture.user_id)
                            .single();

                        if (profile?.email) {
                            logEmailTrigger('panel_invitation.status_change', {
                                recipient: profile.email,
                                metadata: { venture_id: req.params.id },
                            });
                            const founderName = profile.full_name || 'Founder';
                            const ventureName = venture.name || 'Your Venture';
                            await sendPanelInvitationEmail(profile.email, founderName, ventureName);
                            console.log(`Panel invitation email sent to ${profile.email} for venture ${venture.name}`);
                        } else {
                            logEmailTrigger('panel_invitation.status_change', {
                                skipped: true,
                                skipReason: 'No entrepreneur email found for venture.user_id',
                                metadata: { venture_id: req.params.id, user_id: venture.user_id },
                            });
                            console.warn(`No email found for user_id ${venture.user_id}, skipping panel invitation email`);
                        }
                    } catch (emailError) {
                        logEmailTrigger('panel_invitation.status_change', {
                            error: emailError,
                            metadata: { venture_id: req.params.id, user_id: venture.user_id },
                        });
                    }
                })();

                // Gap-C diagnostic: status moved to Panel Review but `assigned_panelist_id`
                // wasn't in the body → panelist email won't fire via the normal path.
                // Log a warning so Sentry captures this silent skip case.
                if (!req.body.assigned_panelist_id && venture.assigned_panelist_id) {
                    logEmailTrigger('assignment.panelist', {
                        skipped: true,
                        skipReason: 'Status moved to Panel Review but assigned_panelist_id not in PUT body; panelist email not triggered (DB already has panelist)',
                        metadata: {
                            venture_id: req.params.id,
                            db_panelist_id: venture.assigned_panelist_id,
                            status: req.body.status,
                        },
                    });
                }
            }

            // Fire-and-forget: send LiftOff AI email when venture is recommended for Selfserve
            if (program === 'Selfserve') {
                (async () => {
                    try {
                        // Get founder email from venture_applications
                        const serviceClient = createServiceRoleClient();
                        const { data: app } = await serviceClient
                            .from('venture_applications')
                            .select('founder_email')
                            .eq('venture_id', req.params.id)
                            .single();

                        const founderEmail = app?.founder_email;
                        if (founderEmail) {
                            logEmailTrigger('selfserve.recommendation', {
                                recipient: founderEmail,
                                metadata: { venture_id: req.params.id },
                            });
                            const founderName = venture.founder_name || 'Founder';
                            const ventureName = venture.name || 'Your Venture';
                            await sendSelfserveEmail(founderEmail, founderName, ventureName);
                            console.log(`Selfserve LiftOff AI email sent to ${founderEmail} for venture ${venture.name}`);
                        } else {
                            logEmailTrigger('selfserve.recommendation', {
                                skipped: true,
                                skipReason: 'No founder_email on venture_applications',
                                metadata: { venture_id: req.params.id },
                            });
                            console.warn(`No founder email found for venture ${req.params.id}, skipping selfserve email`);
                        }
                    } catch (emailError) {
                        logEmailTrigger('selfserve.recommendation', {
                            error: emailError,
                            metadata: { venture_id: req.params.id },
                        });
                    }
                })();
            }

            // Fire-and-forget: send email when panelist is assigned
            if (req.body.assigned_panelist_id) {
                (async () => {
                    try {
                        const serviceClient = createServiceRoleClient();
                        const { data: panelist } = await serviceClient
                            .from('panelists')
                            .select('email, name')
                            .eq('id', req.body.assigned_panelist_id)
                            .single();

                        if (panelist?.email) {
                            logEmailTrigger('assignment.panelist', {
                                recipient: panelist.email,
                                metadata: { venture_id: req.params.id, panelist_id: req.body.assigned_panelist_id },
                            });
                            const { data: ventureDetails } = await serviceClient
                                .from('ventures')
                                .select('name, founder_name, city, state')
                                .eq('id', req.params.id)
                                .single();
                            const location = [ventureDetails?.city, ventureDetails?.state].filter(Boolean).join(', ') || 'N/A';
                            const appUrl = `${process.env.FRONTEND_URL || 'https://devaccelerate.wadhwaniliftoff.ai'}/panel/dashboard`;
                            await sendPanelistAssignmentEmail(
                                panelist.email,
                                panelist.name || 'Panelist',
                                ventureDetails?.name || 'Venture',
                                ventureDetails?.founder_name || 'Applicant',
                                location,
                                appUrl
                            );
                            console.log(`Panelist assignment email sent to ${panelist.email} for venture ${venture.name}`);
                        } else {
                            logEmailTrigger('assignment.panelist', {
                                skipped: true,
                                skipReason: 'Panelist record not found or has no email',
                                metadata: { venture_id: req.params.id, panelist_id: req.body.assigned_panelist_id },
                            });
                        }
                    } catch (emailError) {
                        logEmailTrigger('assignment.panelist', {
                            error: emailError,
                            metadata: { venture_id: req.params.id, panelist_id: req.body.assigned_panelist_id },
                        });
                    }
                })();
            }

            successResponse(res, { venture });
        } catch (error) {
            next(error);
        }
    }
);

/**
 * DELETE /api/ventures/:id
 * Delete a venture
 */
router.delete(
    '/:id',
    authenticateUser,
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { supabase, role } = await getContext(req);

            await ventureService.deleteVenture(
                supabase,
                req.params.id,
                req.user.id,
                role
            );

            noContentResponse(res);
        } catch (error) {
            next(error);
        }
    }
);

/**
 * POST /api/ventures/:id/submit
 * Submit a venture for review
 */
router.post(
    '/:id/submit',
    authenticateUser,
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const token = req.headers.authorization?.split(' ')[1] || '';
            const supabase = createAuthenticatedClient(token);

            const venture = await ventureService.submitVenture(supabase, req.params.id, req.user.id);

            // Auto-assign screening manager based on revenue (fire-and-forget)
            autoAssignScreeningManager(req.params.id)
                .then(result => {
                    if (result.assignedTo) {
                        console.log(`[Submit] Auto-assigned screening manager: ${result.assignedTo} for venture ${venture.name}`);
                    }
                })
                .catch(err => console.error('[Submit] Auto-assign failed:', err));

            successResponse(res, {
                message: 'Venture submitted for review',
                venture
            });
        } catch (error) {
            next(error);
        }
    }
);

/**
 * POST /api/ventures/:id/generate-insights
 * Generate AI insights for a venture using Claude API
 */
router.post(
    '/:id/generate-insights',
    authenticateUser,
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { supabase, role } = await getContext(req);

            // Only screening managers, venture managers, and committee members can generate insights
            if (!['success_mgr', 'venture_mgr', 'committee_member', 'admin'].includes(role)) {
                return res.status(403).json({
                    success: false,
                    message: 'Only screening managers and above can generate AI insights'
                });
            }

            // Get the venture data
            const { data: venture, error: fetchError } = await supabase
                .from('ventures')
                .select('*')
                .eq('id', req.params.id)
                .single();

            if (fetchError || !venture) {
                return res.status(404).json({
                    success: false,
                    message: 'Venture not found'
                });
            }

            // Get VSM notes from request body (optional)
            const vsmNotes = req.body.vsm_notes || venture.vsm_notes || '';
            const insightType = req.query.type as string;

            // Fetch application data including all form fields
            const { data: appData } = await supabase
                .from('venture_applications')
                .select('*')
                .eq('venture_id', req.params.id)
                .maybeSingle();

            let corporatePresentationText: string | undefined;
            if (appData?.corporate_presentation_url) {
                const text = await extractDocumentText(appData.corporate_presentation_url);
                if (text) corporatePresentationText = text;
            }

            const ventureWithDoc = {
                ...venture,
                corporate_presentation_text: corporatePresentationText,
                // Merge application fields so the AI prompt has access to them
                what_do_you_sell: appData?.what_do_you_sell,
                who_do_you_sell_to: appData?.who_do_you_sell_to,
                which_regions: appData?.which_regions,
                focus_product: appData?.focus_product,
                focus_segment: appData?.focus_segment,
                focus_geography: appData?.focus_geography,
                growth_type: appData?.growth_type,
                growth_focus: appData?.growth_focus,
                growth_dimensions_selected: appData?.growth_focus, // array of selected growth dimensions
                support_description: appData?.support_description,
                revenue_12m: appData?.revenue_12m,
                revenue_potential_3y: appData?.revenue_potential_3y,
                revenue_potential_12m: appData?.revenue_potential_12m,
                full_time_employees: appData?.full_time_employees,
                target_jobs: appData?.target_jobs,
                incremental_hiring: appData?.incremental_hiring,
                min_investment: appData?.min_investment,
                financial_condition: appData?.financial_condition,
                time_commitment: appData?.time_commitment,
                second_line_team: appData?.second_line_team,
                program_type: venture.program_name || null,
                business_type: appData?.business_type,
                designation: appData?.designation,
                city: appData?.city,
                state: appData?.state,
            };

            const now = new Date().toISOString();

            // Check for existing current assessment
            const { data: existingAssessment } = await supabase
                .from('venture_assessments')
                .select('id, ai_analysis, program_recommendation')
                .eq('venture_id', req.params.id)
                .eq('is_current', true)
                .maybeSingle();

            if (insightType === 'panel') {
                // ===== V2: Panel Interview Insights =====
                const panelNotes = req.body.panel_notes || '';

                // Fetch interaction transcripts for this venture
                const { data: interactions } = await supabase
                    .from('venture_interactions')
                    .select('interaction_type, title, transcript, interaction_date')
                    .eq('venture_id', req.params.id)
                    .is('deleted_at', null)
                    .order('interaction_date', { ascending: true });

                const interactionTranscripts = (interactions || []).map((i: any) => {
                    const date = i.interaction_date ? new Date(i.interaction_date).toLocaleDateString() : 'Unknown date';
                    const type = (i.interaction_type || 'note').charAt(0).toUpperCase() + (i.interaction_type || 'note').slice(1);
                    const title = i.title ? ` - ${i.title}` : '';
                    return `[${type}${title} on ${date}]\n${i.transcript}`;
                }).join('\n\n---\n\n');

                const panelVentureData = {
                    ...ventureWithDoc,
                    screening_recommendation: existingAssessment?.program_recommendation || venture.program_recommendation || '',
                    prior_ai_analysis: existingAssessment?.ai_analysis || null,
                };

                const panelInsights = await aiService.generatePanelInsights(panelVentureData, vsmNotes, panelNotes, interactionTranscripts);

                // Save panel insights
                if (existingAssessment) {
                    const { error: updateError } = await supabase
                        .from('venture_assessments')
                        .update({
                            panel_ai_analysis: panelInsights,
                            panel_ai_generated_at: now,
                            updated_at: now,
                        })
                        .eq('id', existingAssessment.id);

                    if (updateError) console.error('Error saving panel insights:', updateError);
                } else {
                    const { error: insertError } = await supabase
                        .from('venture_assessments')
                        .insert({
                            venture_id: req.params.id,
                            assessed_by: req.user.id,
                            assessor_role: role,
                            assessment_type: 'panel',
                            assessment_date: now,
                            panel_ai_analysis: panelInsights,
                            panel_ai_generated_at: now,
                            is_current: true,
                            assessment_version: 1,
                        });

                    if (insertError) console.error('Error creating panel assessment:', insertError);
                }

                return successResponse(res, {
                    message: 'Panel insights generated successfully',
                    insights: panelInsights
                });
            }

            // ===== V1: Screening Insights (default) =====
            const insights = await aiService.generateVentureInsights(ventureWithDoc, vsmNotes);

            if (existingAssessment) {
                const { error: updateError } = await supabase
                    .from('venture_assessments')
                    .update({
                        ai_analysis: insights,
                        ai_generated_at: now,
                        updated_at: now,
                    })
                    .eq('id', existingAssessment.id);

                if (updateError) {
                    console.error('Error saving insights to assessment:', updateError);
                }
            } else {
                const { error: insertError } = await supabase
                    .from('venture_assessments')
                    .insert({
                        venture_id: req.params.id,
                        assessed_by: req.user.id,
                        assessor_role: role,
                        assessment_type: 'screening',
                        assessment_date: now,
                        ai_analysis: insights,
                        ai_generated_at: now,
                        is_current: true,
                        assessment_version: 1,
                    });

                if (insertError) {
                    console.error('Error creating assessment with insights:', insertError);
                }
            }

            successResponse(res, {
                message: 'AI insights generated successfully',
                insights
            });
        } catch (error: any) {
            console.error('Error generating AI insights:', error);

            // Return user-friendly error message
            res.status(500).json({
                success: false,
                message: error.message || 'Failed to generate AI insights',
                error: process.env.NODE_ENV === 'development' ? error.stack : undefined
            });
        }
    }
);

/**
 * PUT /api/ventures/:id/gate-questions
 * Save panel gate questions (6 Yes/No + optional remarks)
 */
router.put(
    '/:id/gate-questions',
    authenticateUser,
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { supabase, role } = await getContext(req);

            if (!['venture_mgr', 'committee_member', 'admin', 'ops_manager'].includes(role)) {
                return res.status(403).json({ success: false, message: 'Only panel members can submit gate questions' });
            }

            const { gate_questions } = req.body;
            if (!gate_questions || !Array.isArray(gate_questions) || gate_questions.length !== 6) {
                return res.status(400).json({ success: false, message: 'Exactly 6 gate questions are required' });
            }

            const now = new Date().toISOString();
            const gateData = {
                gate_questions,
                submitted_by: req.user.id,
                submitted_at: now,
            };

            // Find existing current assessment
            const { data: existingAssessment } = await supabase
                .from('venture_assessments')
                .select('id')
                .eq('venture_id', req.params.id)
                .eq('is_current', true)
                .maybeSingle();

            if (existingAssessment) {
                const { error } = await supabase
                    .from('venture_assessments')
                    .update({ gate_questions: gateData, updated_at: now })
                    .eq('id', existingAssessment.id);

                if (error) {
                    console.error('Error saving gate questions:', error);
                    return res.status(500).json({ success: false, message: 'Failed to save gate questions' });
                }
            } else {
                const { error } = await supabase
                    .from('venture_assessments')
                    .insert({
                        venture_id: req.params.id,
                        assessed_by: req.user.id,
                        assessor_role: role,
                        assessment_type: 'panel',
                        assessment_date: now,
                        gate_questions: gateData,
                        is_current: true,
                        assessment_version: 1,
                    });

                if (error) {
                    console.error('Error creating assessment with gate questions:', error);
                    return res.status(500).json({ success: false, message: 'Failed to save gate questions' });
                }
            }

            successResponse(res, { message: 'Gate questions saved successfully', gate_questions: gateData });
        } catch (error) {
            next(error);
        }
    }
);

/**
 * PUT /api/ventures/:id/panel-assessment
 * Save panelist's edited panel scorecard (rating overrides + remarks)
 */
router.put(
    '/:id/panel-assessment',
    authenticateUser,
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { supabase, role } = await getContext(req);

            if (!['venture_mgr', 'success_mgr', 'committee_member', 'admin', 'ops_manager'].includes(role)) {
                return res.status(403).json({ success: false, message: 'Only panel members can edit panel assessments' });
            }

            const { panel_scorecard } = req.body;
            if (!panel_scorecard || !Array.isArray(panel_scorecard) || panel_scorecard.length !== 7) {
                return res.status(400).json({ success: false, message: 'panel_scorecard must be an array of exactly 7 dimensions' });
            }

            // Validate each dimension
            for (const item of panel_scorecard) {
                if (!['Green', 'Yellow', 'Red'].includes(item.panel_rating)) {
                    return res.status(400).json({ success: false, message: `Invalid panel_rating "${item.panel_rating}" — must be Green, Yellow, or Red` });
                }
            }

            const now = new Date().toISOString();
            const panelData = {
                panel_scorecard,
                generated_at: now,
            };

            // Find existing current assessment
            const { data: existingAssessment } = await supabase
                .from('venture_assessments')
                .select('id')
                .eq('venture_id', req.params.id)
                .eq('is_current', true)
                .maybeSingle();

            if (existingAssessment) {
                const { error } = await supabase
                    .from('venture_assessments')
                    .update({ panel_ai_analysis: panelData, updated_at: now })
                    .eq('id', existingAssessment.id);

                if (error) {
                    console.error('Error saving panel assessment:', error);
                    return res.status(500).json({ success: false, message: 'Failed to save panel assessment' });
                }
            } else {
                const { error } = await supabase
                    .from('venture_assessments')
                    .insert({
                        venture_id: req.params.id,
                        assessed_by: req.user.id,
                        assessor_role: role,
                        assessment_type: 'panel',
                        assessment_date: now,
                        panel_ai_analysis: panelData,
                        is_current: true,
                        assessment_version: 1,
                    });

                if (error) {
                    console.error('Error creating assessment with panel scorecard:', error);
                    return res.status(500).json({ success: false, message: 'Failed to save panel assessment' });
                }
            }

            successResponse(res, { message: 'Panel assessment saved successfully', panel_ai_analysis: panelData });
        } catch (error) {
            next(error);
        }
    }
);

/**
 * POST /api/ventures/:id/send-panel-email
 * Send panel invitation email to the entrepreneur
 */
router.post(
    '/:id/send-panel-email',
    authenticateUser,
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { supabase } = await getContext(req);

            // Fetch venture
            const { data: venture, error: ventureError } = await supabase
                .from('ventures')
                .select('name, founder_name, user_id')
                .eq('id', req.params.id)
                .single();

            if (ventureError || !venture) {
                return res.status(404).json({ success: false, message: 'Venture not found' });
            }

            // Fetch entrepreneur email from venture_applications (founder_email)
            const { data: application } = await supabase
                .from('venture_applications')
                .select('founder_email')
                .eq('venture_id', req.params.id)
                .maybeSingle();

            const founderEmail = application?.founder_email;
            if (!founderEmail) {
                return res.status(400).json({ success: false, message: 'Entrepreneur email not found in application' });
            }

            const founderName = venture.founder_name || 'Founder';
            const ventureName = venture.name || 'Your Venture';

            logEmailTrigger('panel_invitation.manual', {
                recipient: founderEmail,
                metadata: { venture_id: req.params.id },
            });
            // Fire-and-forget
            sendPanelInvitationEmail(founderEmail, founderName, ventureName)
                .then(() => console.log(`Panel invitation email sent to ${founderEmail} for venture ${ventureName}`))
                .catch((err) => console.error('Failed to send panel invitation email:', err));

            successResponse(res, { message: 'Panel invitation email queued' });
        } catch (error) {
            next(error);
        }
    }
);

/**
 * POST /api/ventures/:id/send-selection-email
 * Create venture founder account (if needed) and send selection welcome email
 * when panel approves a venture for Prime/Core/Select
 */
router.post(
    '/:id/send-selection-email',
    authenticateUser,
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { supabase } = await getContext(req);
            const { program_category } = req.body;
            const DEFAULT_PASSWORD = 'WadhwaniAccelerate123456';

            if (!program_category || !['prime', 'core', 'select'].includes(program_category)) {
                return res.status(400).json({ success: false, message: 'Valid program_category (prime, core, select) is required' });
            }

            // Fetch venture
            const { data: venture, error: ventureError } = await supabase
                .from('ventures')
                .select('id, name, founder_name, user_id')
                .eq('id', req.params.id)
                .single();

            if (ventureError || !venture) {
                return res.status(404).json({ success: false, message: 'Venture not found' });
            }

            // Fetch entrepreneur email
            const { data: application } = await supabase
                .from('venture_applications')
                .select('founder_email')
                .eq('venture_id', req.params.id)
                .maybeSingle();

            const founderEmail = application?.founder_email;
            if (!founderEmail) {
                return res.status(400).json({ success: false, message: 'Entrepreneur email not found in application' });
            }

            const founderName = venture.founder_name || 'Founder';
            const ventureName = venture.name || 'Your Venture';
            const loginUrl = process.env.FRONTEND_URL || 'https://devaccelerate.wadhwaniliftoff.ai';

            // Create Supabase auth account for the founder if not already linked
            const adminClient = createServiceRoleClient();
            if (!venture.user_id) {
                // Check if a user with this email already exists
                const { data: { users } } = await adminClient.auth.admin.listUsers();
                const existingUser = users?.find((u: any) => u.email === founderEmail);

                if (existingUser) {
                    // Link existing user to the venture
                    await adminClient
                        .from('ventures')
                        .update({ user_id: existingUser.id })
                        .eq('id', venture.id);
                    console.log(`Linked existing user ${founderEmail} to venture ${ventureName}`);
                } else {
                    // Create new user account
                    const { data: newUser, error: createError } = await adminClient.auth.admin.createUser({
                        email: founderEmail,
                        password: DEFAULT_PASSWORD,
                        email_confirm: true,
                        user_metadata: {
                            full_name: founderName,
                            role: 'entrepreneur',
                        },
                    });

                    if (createError) {
                        console.error(`Failed to create user account for ${founderEmail}:`, createError.message);
                    } else if (newUser?.user) {
                        // Link new user to the venture
                        await adminClient
                            .from('ventures')
                            .update({ user_id: newUser.user.id })
                            .eq('id', venture.id);

                        // Create profile entry
                        await adminClient
                            .from('profiles')
                            .upsert({
                                id: newUser.user.id,
                                email: founderEmail,
                                full_name: founderName,
                                role: 'entrepreneur',
                            });

                        console.log(`Created user account for ${founderEmail} and linked to venture ${ventureName}`);
                    }
                }
            }

            logEmailTrigger('selection.welcome', {
                recipient: founderEmail,
                metadata: { venture_id: venture.id, program_category },
            });
            // Send selection welcome email
            sendSelectionWelcomeEmail(founderEmail, founderName, ventureName, program_category, loginUrl)
                .then(() => console.log(`Selection welcome email sent to ${founderEmail} for venture ${ventureName} (${program_category})`))
                .catch((err) => console.error('Failed to send selection welcome email:', err));

            successResponse(res, { message: 'Account created and selection welcome email queued' });
        } catch (error) {
            next(error);
        }
    }
);

// ============ ROADMAP ROUTES ============

/**
 * POST /api/ventures/:id/generate-roadmap
 * Generate AI-powered journey roadmap for a venture
 */
router.post(
    '/:id/generate-roadmap',
    authenticateUser,
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { supabase, role } = await getContext(req);

            if (!['venture_mgr', 'committee_member', 'admin'].includes(role)) {
                return res.status(403).json({
                    success: false,
                    message: 'Only venture managers, committee members, and admins can generate roadmaps'
                });
            }

            // Get venture with application and assessment data
            const { data: venture, error: ventureError } = await supabase
                .from('ventures')
                .select(`
                    *,
                    application:venture_applications(*),
                    assessments:venture_assessments(*)
                `)
                .eq('id', req.params.id)
                .single();

            if (ventureError || !venture) {
                return res.status(404).json({ success: false, message: 'Venture not found' });
            }

            const app = venture.application?.[0] || venture.application || {};
            const assessment = (venture.assessments || []).find((a: any) => a.is_current) || venture.assessments?.[0] || {};

            console.log('[Roadmap] Application data found:', {
                hasApp: !!venture.application,
                appLength: Array.isArray(venture.application) ? venture.application.length : 'not array',
                what_do_you_sell: app.what_do_you_sell,
                focus_product: app.focus_product,
                focus_segment: app.focus_segment,
            });

            // Extract document text if available
            let corporatePresentationText: string | undefined;
            if (app.corporate_presentation_url) {
                const text = await extractDocumentText(app.corporate_presentation_url);
                if (text) corporatePresentationText = text;
            }

            // Build venture data with application fields
            const ventureData = {
                ...venture,
                revenue_12m: app.revenue_12m,
                revenue_potential_3y: app.revenue_potential_3y,
                full_time_employees: app.full_time_employees,
                growth_focus: app.growth_focus,
                what_do_you_sell: app.what_do_you_sell,
                who_do_you_sell_to: app.who_do_you_sell_to,
                which_regions: app.which_regions,
                focus_product: app.focus_product,
                focus_segment: app.focus_segment,
                focus_geography: app.focus_geography,
                blockers: app.blockers,
                support_request: app.support_request,
                incremental_hiring: app.incremental_hiring,
                corporate_presentation_text: corporatePresentationText,
            };

            // Fetch panel feedback
            const serviceClient = createServiceRoleClient();
            const { data: panelFeedbackRows } = await serviceClient
                .from('panel_feedback')
                .select('*')
                .eq('venture_id', req.params.id)
                .order('created_at', { ascending: false })
                .limit(1);
            const panelFeedback = panelFeedbackRows?.[0] || null;

            // Fetch interaction notes
            const { data: interactions } = await serviceClient
                .from('venture_interactions')
                .select('interaction_type, title, transcript, interaction_date')
                .eq('venture_id', req.params.id)
                .order('interaction_date', { ascending: true });
            const interactionNotes = (interactions || [])
                .map((i: any) => `[${i.interaction_date || 'N/A'}] ${i.title || i.interaction_type}: ${i.transcript || ''}`)
                .join('\n\n');

            const startTime = Date.now();

            // Generate roadmap via Claude
            const roadmapData = await aiService.generateVentureRoadmap(ventureData, {
                vsmNotes: assessment.notes || '',
                aiAnalysis: assessment.ai_analysis || null,
                interactionNotes: interactionNotes || '',
                panelFeedback: panelFeedback,
                panelScorecard: assessment.panel_ai_analysis?.panel_scorecard || null,
                gateQuestions: assessment.gate_questions || null,
            });

            const durationSeconds = Math.round((Date.now() - startTime) / 1000);

            // Mark old roadmaps as not current
            await supabase
                .from('venture_roadmaps')
                .update({ is_current: false })
                .eq('venture_id', req.params.id)
                .eq('is_current', true);

            // Get version number
            const { count } = await supabase
                .from('venture_roadmaps')
                .select('*', { count: 'exact', head: true })
                .eq('venture_id', req.params.id);

            // Insert new roadmap
            const { data: savedRoadmap, error: insertError } = await supabase
                .from('venture_roadmaps')
                .insert({
                    venture_id: req.params.id,
                    generated_by: req.user.id,
                    generation_source: 'ai_generated',
                    based_on_assessment_id: assessment.id || null,
                    roadmap_data: roadmapData,
                    roadmap_version: (count || 0) + 1,
                    is_current: true,
                    generation_duration_seconds: durationSeconds,
                    generation_model: 'claude-sonnet-4-5-20250929',
                })
                .select()
                .single();

            if (insertError) {
                console.error('Error saving roadmap:', insertError);
                // Return data even if save fails
                return successResponse(res, { roadmap: { roadmap_data: roadmapData }, saved: false });
            }

            successResponse(res, { roadmap: savedRoadmap });
        } catch (error: any) {
            console.error('Error generating roadmap:', error);
            res.status(500).json({
                success: false,
                message: error.message || 'Failed to generate roadmap',
            });
        }
    }
);

/**
 * GET /api/ventures/:id/roadmap
 * Get the current roadmap for a venture
 */
router.get(
    '/:id/roadmap',
    authenticateUser,
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            // Use service client to bypass RLS — auth already verified by middleware
            const serviceClient = createServiceRoleClient();

            const { data: roadmap, error } = await serviceClient
                .from('venture_roadmaps')
                .select('*')
                .eq('venture_id', req.params.id)
                .eq('is_current', true)
                .maybeSingle();

            if (error) {
                console.error('Error fetching roadmap:', error);
                return res.status(500).json({ success: false, message: 'Failed to fetch roadmap' });
            }

            successResponse(res, { roadmap: roadmap || null });
        } catch (error) {
            next(error);
        }
    }
);

/**
 * PATCH /api/ventures/:id/roadmap
 * Update the current roadmap for a venture
 */
router.patch(
    '/:id/roadmap',
    authenticateUser,
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { roadmap_data } = req.body;
            if (!roadmap_data || typeof roadmap_data !== 'object') {
                return res.status(400).json({ success: false, message: 'roadmap_data is required and must be an object' });
            }

            const serviceClient = createServiceRoleClient();
            const { data, error } = await serviceClient
                .from('venture_roadmaps')
                .update({ roadmap_data })
                .eq('venture_id', req.params.id)
                .eq('is_current', true)
                .select()
                .single();

            if (error) {
                console.error('Error updating roadmap:', error);
                return res.status(500).json({ success: false, message: 'Failed to update roadmap' });
            }

            successResponse(res, { roadmap: data });
        } catch (error) {
            next(error);
        }
    }
);

/**
 * PATCH /api/ventures/:id/kpis
 * Update KPI fields on venture_applications
 */
router.patch(
    '/:id/kpis',
    authenticateUser,
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { revenue_12m, revenue_potential_3y, full_time_employees, incremental_hiring, kpi_status } = req.body;

            const updates: any = { updated_at: new Date().toISOString() };
            if (revenue_12m !== undefined) updates.revenue_12m = revenue_12m;
            if (revenue_potential_3y !== undefined) updates.revenue_potential_3y = revenue_potential_3y;
            if (full_time_employees !== undefined) updates.full_time_employees = full_time_employees;
            if (incremental_hiring !== undefined) updates.incremental_hiring = incremental_hiring;
            if (kpi_status !== undefined) updates.kpi_status = kpi_status;

            if (Object.keys(updates).length <= 1) {
                return res.status(400).json({ success: false, message: 'At least one KPI field is required' });
            }

            const serviceClient = createServiceRoleClient();
            const { data, error } = await serviceClient
                .from('venture_applications')
                .update(updates)
                .eq('venture_id', req.params.id)
                .select()
                .single();

            if (error) {
                console.error('Error updating KPIs:', error);
                return res.status(500).json({ success: false, message: 'Failed to update KPIs' });
            }

            successResponse(res, { application: data });
        } catch (error) {
            next(error);
        }
    }
);

// ============ DELIVERABLE ROUTES ============

/**
 * POST /api/ventures/:id/generate-deliverables
 * Generate AI-powered deliverables from the venture's roadmap
 */
router.post(
    '/:id/generate-deliverables',
    authenticateUser,
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { role } = await getContext(req);
            if (!['venture_mgr', 'committee_member', 'admin'].includes(role)) {
                return res.status(403).json({ success: false, message: 'Access denied' });
            }

            const serviceClient = createServiceRoleClient();
            const ventureId = req.params.id;
            const forceRegenerate = req.body?.regenerate === true;

            // If not forcing regeneration, return existing deliverables
            if (!forceRegenerate) {
                const { data: existing } = await serviceClient
                    .from('venture_deliverables')
                    .select('*')
                    .eq('venture_id', ventureId)
                    .order('display_order');

                if (existing && existing.length > 0) {
                    return successResponse(res, { deliverables: existing, cached: true });
                }
            }

            // Fetch current roadmap
            const { data: roadmap } = await serviceClient
                .from('venture_roadmaps')
                .select('roadmap_data')
                .eq('venture_id', ventureId)
                .eq('is_current', true)
                .maybeSingle();

            if (!roadmap?.roadmap_data) {
                return res.status(400).json({ success: false, message: 'No roadmap found. Generate a roadmap first.' });
            }

            // Fetch venture context
            const { data: venture } = await serviceClient
                .from('ventures')
                .select('name, founder_name, application:venture_applications(what_do_you_sell, growth_focus)')
                .eq('id', ventureId)
                .single();

            const app: any = venture?.application?.[0] || venture?.application || {};

            // Generate deliverables via AI
            const deliverablesByStream = await aiService.generateDeliverables(roadmap.roadmap_data, {
                name: venture?.name || '',
                founder_name: venture?.founder_name,
                what_do_you_sell: app.what_do_you_sell,
                growth_focus: app.growth_focus,
            });

            // Delete existing deliverables for this venture
            await serviceClient
                .from('venture_deliverables')
                .delete()
                .eq('venture_id', ventureId);

            // Insert new deliverables
            const rows = Object.entries(deliverablesByStream).flatMap(([streamKey, items]) =>
                items.map((item) => ({
                    venture_id: ventureId,
                    title: item.title,
                    description: item.description,
                    status: 'pending',
                    priority: 'medium',
                    display_order: item.display_order,
                    roadmap_key: streamKey,
                }))
            );

            const { data: saved, error: insertError } = await serviceClient
                .from('venture_deliverables')
                .insert(rows)
                .select();

            if (insertError) {
                console.error('Error saving deliverables:', insertError);
                return res.status(500).json({ success: false, message: 'Failed to save deliverables' });
            }

            successResponse(res, { deliverables: saved });
        } catch (error) {
            next(error);
        }
    }
);

/**
 * GET /api/ventures/:id/deliverables
 * Fetch all deliverables for a venture
 */
router.get(
    '/:id/deliverables',
    authenticateUser,
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const serviceClient = createServiceRoleClient();

            const { data, error } = await serviceClient
                .from('venture_deliverables')
                .select('*')
                .eq('venture_id', req.params.id)
                .order('display_order', { ascending: true });

            if (error) {
                console.error('Error fetching deliverables:', error);
                return res.status(500).json({ success: false, message: 'Failed to fetch deliverables' });
            }

            successResponse(res, { deliverables: data || [] });
        } catch (error) {
            next(error);
        }
    }
);

/**
 * PATCH /api/ventures/:ventureId/deliverables/:deliverableId
 * Update a deliverable (status, notes, etc.)
 */
router.patch(
    '/:ventureId/deliverables/:deliverableId',
    authenticateUser,
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const serviceClient = createServiceRoleClient();
            const { status, notes, title, description, owner, start_date, due_date, health } = req.body;

            const updates: any = { updated_at: new Date().toISOString() };
            if (status) {
                updates.status = status;
                if (status === 'completed') updates.completed_at = new Date().toISOString();
                // Auto-set health when status changes
                if (status === 'in_progress' && !health) updates.health = 'on_track';
                if (status === 'pending' || status === 'completed') updates.health = 'on_track';
            }
            if (health !== undefined) updates.health = health;
            if (notes !== undefined) updates.notes = notes;
            if (title !== undefined) updates.title = title;
            if (description !== undefined) updates.description = description;
            if (owner !== undefined) updates.owner = owner;
            if (start_date !== undefined) updates.start_date = start_date;
            if (due_date !== undefined) updates.due_date = due_date;

            const { data, error } = await serviceClient
                .from('venture_deliverables')
                .update(updates)
                .eq('id', req.body.deliverableId || req.params.deliverableId)
                .eq('venture_id', req.params.ventureId)
                .select()
                .single();

            if (error) {
                console.error('Error updating deliverable:', error);
                return res.status(500).json({ success: false, message: 'Failed to update deliverable' });
            }

            successResponse(res, { deliverable: data });
        } catch (error) {
            next(error);
        }
    }
);

// ============ CHECKLIST ROUTES ============

/**
 * GET /api/ventures/:ventureId/deliverables/:deliverableId/checklist
 * Get all checklist items for a deliverable
 */
router.get(
    '/:ventureId/deliverables/:deliverableId/checklist',
    authenticateUser,
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const serviceClient = createServiceRoleClient();
            const { data, error } = await serviceClient
                .from('deliverable_checklist_items')
                .select('*')
                .eq('deliverable_id', req.params.deliverableId)
                .order('display_order');

            if (error) {
                console.error('Error fetching checklist:', error);
                return res.status(500).json({ success: false, message: 'Failed to fetch checklist' });
            }

            successResponse(res, { items: data || [] });
        } catch (error) {
            next(error);
        }
    }
);

/**
 * POST /api/ventures/:ventureId/deliverables/:deliverableId/checklist
 * Add a checklist item
 */
router.post(
    '/:ventureId/deliverables/:deliverableId/checklist',
    authenticateUser,
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const serviceClient = createServiceRoleClient();
            const { text } = req.body;

            if (!text?.trim()) {
                return res.status(400).json({ success: false, message: 'Text is required' });
            }

            // Get max display_order
            const { data: existing } = await serviceClient
                .from('deliverable_checklist_items')
                .select('display_order')
                .eq('deliverable_id', req.params.deliverableId)
                .order('display_order', { ascending: false })
                .limit(1);

            const nextOrder = (existing?.[0]?.display_order ?? -1) + 1;

            const { data, error } = await serviceClient
                .from('deliverable_checklist_items')
                .insert({
                    deliverable_id: req.params.deliverableId,
                    text: text.trim(),
                    display_order: nextOrder,
                })
                .select()
                .single();

            if (error) {
                console.error('Error adding checklist item:', error);
                return res.status(500).json({ success: false, message: 'Failed to add checklist item' });
            }

            successResponse(res, { item: data });
        } catch (error) {
            next(error);
        }
    }
);

/**
 * PATCH /api/ventures/:ventureId/deliverables/:deliverableId/checklist/:itemId
 * Update a checklist item (toggle completed, edit text)
 */
router.patch(
    '/:ventureId/deliverables/:deliverableId/checklist/:itemId',
    authenticateUser,
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const serviceClient = createServiceRoleClient();
            const updates: any = {};

            if (req.body.is_completed !== undefined) updates.is_completed = req.body.is_completed;
            if (req.body.text !== undefined) updates.text = req.body.text;

            const { data, error } = await serviceClient
                .from('deliverable_checklist_items')
                .update(updates)
                .eq('id', req.params.itemId)
                .eq('deliverable_id', req.params.deliverableId)
                .select()
                .single();

            if (error) {
                console.error('Error updating checklist item:', error);
                return res.status(500).json({ success: false, message: 'Failed to update checklist item' });
            }

            successResponse(res, { item: data });
        } catch (error) {
            next(error);
        }
    }
);

/**
 * DELETE /api/ventures/:ventureId/deliverables/:deliverableId/checklist/:itemId
 * Delete a checklist item
 */
router.delete(
    '/:ventureId/deliverables/:deliverableId/checklist/:itemId',
    authenticateUser,
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const serviceClient = createServiceRoleClient();
            const { error } = await serviceClient
                .from('deliverable_checklist_items')
                .delete()
                .eq('id', req.params.itemId)
                .eq('deliverable_id', req.params.deliverableId);

            if (error) {
                console.error('Error deleting checklist item:', error);
                return res.status(500).json({ success: false, message: 'Failed to delete checklist item' });
            }

            successResponse(res, { deleted: true });
        } catch (error) {
            next(error);
        }
    }
);

// ============ NOTES ROUTES ============

/**
 * GET /api/ventures/:ventureId/deliverables/:deliverableId/notes
 * Get all notes for a deliverable
 */
router.get(
    '/:ventureId/deliverables/:deliverableId/notes',
    authenticateUser,
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const serviceClient = createServiceRoleClient();
            const { data, error } = await serviceClient
                .from('deliverable_notes')
                .select('*')
                .eq('deliverable_id', req.params.deliverableId)
                .order('created_at', { ascending: false });

            if (error) {
                console.error('Error fetching notes:', error);
                return res.status(500).json({ success: false, message: 'Failed to fetch notes' });
            }

            successResponse(res, { notes: data || [] });
        } catch (error) {
            next(error);
        }
    }
);

/**
 * POST /api/ventures/:ventureId/deliverables/:deliverableId/notes
 * Add a note with action items
 */
router.post(
    '/:ventureId/deliverables/:deliverableId/notes',
    authenticateUser,
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const serviceClient = createServiceRoleClient();
            const { note_text, action_items } = req.body;

            if (!note_text?.trim()) {
                return res.status(400).json({ success: false, message: 'Note text is required' });
            }

            // Get user id from token
            const token = req.headers.authorization?.split(' ')[1] || '';
            const authClient = createAuthenticatedClient(token);
            const { data: { user } } = await authClient.auth.getUser();

            const { data, error } = await serviceClient
                .from('deliverable_notes')
                .insert({
                    deliverable_id: req.params.deliverableId,
                    note_text: note_text.trim(),
                    action_items: action_items || [],
                    created_by: user?.id || null,
                })
                .select()
                .single();

            if (error) {
                console.error('Error adding note:', error);
                return res.status(500).json({ success: false, message: 'Failed to add note' });
            }

            successResponse(res, { note: data });
        } catch (error) {
            next(error);
        }
    }
);

// ============ RECOMMENDATION ROUTES ============

/**
 * POST /api/ventures/:ventureId/deliverables/:deliverableId/recommendations
 * Generate AI recommendations for a deliverable (returns cached if exists)
 */
router.post(
    '/:ventureId/deliverables/:deliverableId/recommendations',
    authenticateUser,
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const serviceClient = createServiceRoleClient();
            const { ventureId, deliverableId } = req.params;
            const { type } = req.body;

            if (!['expert_connect', 'service_provider', 'masterclass', 'research'].includes(type)) {
                return res.status(400).json({ success: false, message: 'Invalid recommendation type' });
            }

            // Check for cached recommendations
            const { data: existing } = await serviceClient
                .from('deliverable_recommendations')
                .select('*')
                .eq('deliverable_id', deliverableId)
                .eq('recommendation_type', type)
                .maybeSingle();

            if (existing) {
                return successResponse(res, { recommendation: existing, cached: true });
            }

            // Fetch deliverable and venture context
            const { data: deliverable } = await serviceClient
                .from('venture_deliverables')
                .select('title, description')
                .eq('id', deliverableId)
                .single();

            const { data: venture } = await serviceClient
                .from('ventures')
                .select('name, application:venture_applications(what_do_you_sell, growth_focus)')
                .eq('id', ventureId)
                .single();

            const app: any = venture?.application?.[0] || venture?.application || {};

            // Generate via AI
            const recommendations = await aiService.generateRecommendations(type, {
                title: deliverable?.title || '',
                description: deliverable?.description,
            }, {
                name: venture?.name || '',
                what_do_you_sell: app.what_do_you_sell,
                growth_focus: app.growth_focus,
            });

            // Save to DB
            const { data: saved, error } = await serviceClient
                .from('deliverable_recommendations')
                .insert({
                    deliverable_id: deliverableId,
                    recommendation_type: type,
                    data: recommendations,
                })
                .select()
                .single();

            if (error) {
                console.error('Error saving recommendations:', error);
                return res.status(500).json({ success: false, message: 'Failed to save recommendations' });
            }

            successResponse(res, { recommendation: saved });
        } catch (error) {
            next(error);
        }
    }
);

/**
 * GET /api/ventures/:ventureId/deliverables/:deliverableId/recommendations
 * Get recommendations for a deliverable (optionally filtered by type)
 */
router.get(
    '/:ventureId/deliverables/:deliverableId/recommendations',
    authenticateUser,
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const serviceClient = createServiceRoleClient();
            let query = serviceClient
                .from('deliverable_recommendations')
                .select('*')
                .eq('deliverable_id', req.params.deliverableId);

            if (req.query.type) {
                query = query.eq('recommendation_type', req.query.type as string);
            }

            const { data, error } = await query;

            if (error) {
                console.error('Error fetching recommendations:', error);
                return res.status(500).json({ success: false, message: 'Failed to fetch recommendations' });
            }

            successResponse(res, { recommendations: data || [] });
        } catch (error) {
            next(error);
        }
    }
);

// ============ STREAM ROUTES ============

/**
 * GET /api/ventures/:id/streams
 * Get all streams for a venture
 */
router.get(
    '/:id/streams',
    authenticateUser,
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const token = req.headers.authorization?.split(' ')[1] || '';
            const supabase = createAuthenticatedClient(token);

            const streams = await ventureService.getVentureStreams(supabase, req.params.id);
            successResponse(res, { streams });
        } catch (error) {
            next(error);
        }
    }
);

/**
 * POST /api/ventures/:id/streams
 * Create a new stream for a venture
 */
router.post(
    '/:id/streams',
    authenticateUser,
    validateBody(createStreamSchema),
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const token = req.headers.authorization?.split(' ')[1] || '';
            const supabase = createAuthenticatedClient(token);

            const stream = await ventureService.createStream(supabase, req.params.id, req.body);
            createdResponse(res, { stream });
        } catch (error) {
            next(error);
        }
    }
);

/**
 * PUT /api/streams/:id
 * Update a stream
 */
router.put(
    '/streams/:id',
    authenticateUser,
    validateBody(updateStreamSchema),
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const token = req.headers.authorization?.split(' ')[1] || '';
            const supabase = createAuthenticatedClient(token);

            const stream = await ventureService.updateStream(supabase, req.params.id, req.body);
            successResponse(res, { stream });
        } catch (error) {
            next(error);
        }
    }
);

/**
 * DELETE /api/streams/:id
 * Delete a stream
 */
router.delete(
    '/streams/:id',
    authenticateUser,
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const token = req.headers.authorization?.split(' ')[1] || '';
            const supabase = createAuthenticatedClient(token);

            await ventureService.deleteStream(supabase, req.params.id);
            noContentResponse(res);
        } catch (error) {
            next(error);
        }
    }
);

// ============ MENTOR SESSION ROUTES ============

/**
 * GET /api/ventures/:id/mentors
 * List mentors assigned to a venture
 */
router.get(
    '/:id/mentors',
    authenticateUser,
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { role } = await getContext(req);

            if (!['venture_mgr', 'committee_member', 'admin', 'ops_manager', 'success_mgr'].includes(role)) {
                return res.status(403).json({ success: false, message: 'Access denied' });
            }

            // Use service role client to bypass RLS for mentor data lookups
            const serviceClient = createServiceRoleClient();

            // Step 1: Get assignments for this venture
            const { data: assignments, error } = await serviceClient
                .from('mentor_venture_assignments')
                .select('id, mentor_id, status, assigned_at')
                .eq('venture_id', req.params.id)
                .eq('status', 'active');

            if (error) {
                console.error('Error fetching venture mentors:', error);
                return res.status(500).json({ success: false, message: 'Failed to fetch mentors' });
            }

            const mentorIds = (assignments || []).map((a: any) => a.mentor_id).filter(Boolean);
            if (mentorIds.length === 0) {
                return successResponse(res, { mentors: [] });
            }

            // Step 2: Get profiles for these mentor IDs
            const { data: profilesData } = await serviceClient
                .from('profiles')
                .select('id, full_name, email')
                .in('id', mentorIds);

            // Step 3: Get mentor_profiles for expertise/bio
            const { data: mentorProfilesData } = await serviceClient
                .from('mentor_profiles')
                .select('id, expertise_areas, bio')
                .in('id', mentorIds);

            const profilesMap: Record<string, any> = {};
            for (const p of (profilesData || [])) profilesMap[p.id] = p;
            const mentorProfilesMap: Record<string, any> = {};
            for (const mp of (mentorProfilesData || [])) mentorProfilesMap[mp.id] = mp;

            const mentors = (assignments || []).map((a: any) => ({
                id: a.mentor_id,
                full_name: profilesMap[a.mentor_id]?.full_name || '',
                email: profilesMap[a.mentor_id]?.email || '',
                expertise_areas: mentorProfilesMap[a.mentor_id]?.expertise_areas || [],
                bio: mentorProfilesMap[a.mentor_id]?.bio || '',
                assignment_id: a.id,
                assigned_at: a.assigned_at,
            }));

            successResponse(res, { mentors });
        } catch (error) {
            next(error);
        }
    }
);

/**
 * GET /api/ventures/:id/mentor-sessions
 * List mentor sessions for a venture
 */
router.get(
    '/:id/mentor-sessions',
    authenticateUser,
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { role } = await getContext(req);

            if (!['venture_mgr', 'committee_member', 'admin', 'ops_manager', 'success_mgr', 'mentor', 'entrepreneur'].includes(role)) {
                return res.status(403).json({ success: false, message: 'Access denied' });
            }

            const serviceClient = createServiceRoleClient();

            let query = serviceClient
                .from('mentor_sessions')
                .select(`
                    *,
                    mentor:profiles!mentor_sessions_mentor_id_fkey(id, full_name, email),
                    venture:ventures!mentor_sessions_venture_id_fkey(id, name, founder_name)
                `)
                .eq('venture_id', req.params.id)
                .order('scheduled_date', { ascending: true })
                .order('scheduled_time', { ascending: true });

            const { status } = req.query;
            if (status) {
                query = query.eq('status', status as string);
            }

            const { data, error } = await query;

            if (error) {
                console.error('Error fetching mentor sessions:', error);
                return res.status(500).json({ success: false, message: 'Failed to fetch mentor sessions' });
            }

            successResponse(res, { sessions: data || [] });
        } catch (error) {
            next(error);
        }
    }
);

/**
 * POST /api/ventures/:id/mentor-sessions
 * Schedule a new mentor session for a venture
 */
router.post(
    '/:id/mentor-sessions',
    authenticateUser,
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { role } = await getContext(req);

            if (!['venture_mgr', 'committee_member', 'admin'].includes(role)) {
                return res.status(403).json({ success: false, message: 'Access denied' });
            }

            const { mentor_id, topic, scheduled_date, scheduled_time, duration_minutes } = req.body;

            if (!mentor_id || !scheduled_date || !scheduled_time) {
                return res.status(400).json({
                    success: false,
                    message: 'mentor_id, scheduled_date, and scheduled_time are required',
                });
            }

            const ventureId = req.params.id;
            const serviceClient = createServiceRoleClient();

            // Fetch venture details for email
            const { data: venture } = await serviceClient
                .from('ventures')
                .select('id, name, founder_name, user_id')
                .eq('id', ventureId)
                .single();

            if (!venture) {
                return res.status(404).json({ success: false, message: 'Venture not found' });
            }

            // Fetch mentor details for email
            const { data: mentor } = await serviceClient
                .from('profiles')
                .select('id, full_name, email')
                .eq('id', mentor_id)
                .single();

            if (!mentor) {
                return res.status(404).json({ success: false, message: 'Mentor not found' });
            }

            // Generate meeting ID and meeting link (Zoom with Jitsi fallback)
            const timestamp = Date.now();
            const meetingId = `mentor-${ventureId.slice(0, 8)}-${timestamp}`;
            const jitsiFallback = `https://meet.jit.si/wadhwani-mentor-${ventureId.slice(0, 8)}-${timestamp}`;

            let join_url = jitsiFallback;
            let zoom_meeting_id: number | null = null;
            let zoom_meeting_password: string | null = null;

            if (isZoomConfigured()) {
                const zoomResult = await generateMeetingWithDetails(
                    `Expert Session: ${venture.name}`,
                    duration_minutes || 60,
                    `${scheduled_date}T${scheduled_time}`,
                );
                if (zoomResult) {
                    join_url = zoomResult.joinUrl;
                    zoom_meeting_id = zoomResult.meetingId;
                    zoom_meeting_password = zoomResult.password;
                }
            }

            const { data: session, error } = await serviceClient
                .from('mentor_sessions')
                .insert({
                    meeting_id: meetingId,
                    mentor_id,
                    venture_id: ventureId,
                    scheduled_by: req.user.id,
                    topic: topic || null,
                    mentee_name: venture.founder_name || null,
                    duration_minutes: duration_minutes || 60,
                    join_url,
                    zoom_meeting_id,
                    zoom_meeting_password,
                    source: 'vp_scheduled',
                    status: 'scheduled',
                    scheduled_date,
                    scheduled_time,
                })
                .select()
                .single();

            if (error) {
                console.error('Error creating mentor session:', error);
                return res.status(500).json({ success: false, message: 'Failed to create mentor session' });
            }

            // Send email notifications (fire and forget)
            const formattedDate = new Date(scheduled_date).toLocaleDateString('en-IN', {
                weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
            });
            const formattedTime = scheduled_time.slice(0, 5); // HH:MM

            // Email to VP/VM (mentor) — use platform meeting link, not Zoom link
            if (mentor.email) {
                logEmailTrigger('mentor_session.vpvm', {
                    recipient: mentor.email,
                    metadata: { venture_id: ventureId, session_id: session.id },
                });
                const frontendUrl = process.env.FRONTEND_URL || 'https://devaccelerate.wadhwaniliftoff.ai';
                const platformMeetingLink = `${frontendUrl}/meeting/${session.id}`;
                const workbenchUrl = `${frontendUrl}/vpvm/requests`;
                sendVPVMMeetingScheduledEmail(
                    mentor.email,
                    mentor.full_name || 'Venture Partner',
                    venture.name,
                    venture.founder_name || 'Entrepreneur',
                    formattedDate,
                    formattedTime,
                    platformMeetingLink,
                    workbenchUrl
                ).catch(err => console.error('[MentorSession] Failed to email VP/VM:', err.message));
            } else {
                logEmailTrigger('mentor_session.vpvm', {
                    skipped: true,
                    skipReason: 'Mentor profile has no email',
                    metadata: { venture_id: ventureId, session_id: session.id },
                });
            }

            // Email to entrepreneur (business)
            if (venture.user_id) {
                const { data: entrepreneur } = await serviceClient
                    .from('profiles')
                    .select('email, full_name')
                    .eq('id', venture.user_id)
                    .single();

                if (entrepreneur?.email) {
                    logEmailTrigger('mentor_session.entrepreneur', {
                        recipient: entrepreneur.email,
                        metadata: { venture_id: ventureId, session_id: session.id },
                    });
                    sendBusinessMeetingScheduledEmail(
                        entrepreneur.email,
                        entrepreneur.full_name || venture.founder_name || 'Founder',
                        mentor.full_name || 'Venture Partner',
                        'Venture Partner',
                        formattedDate,
                        formattedTime,
                        join_url
                    ).catch(err => console.error('[MentorSession] Failed to email entrepreneur:', err.message));
                } else {
                    logEmailTrigger('mentor_session.entrepreneur', {
                        skipped: true,
                        skipReason: 'Entrepreneur profile has no email',
                        metadata: { venture_id: ventureId, session_id: session.id, user_id: venture.user_id },
                    });
                }
            }

            createdResponse(res, { session });
        } catch (error) {
            next(error);
        }
    }
);

/**
 * POST /api/ventures/:id/assign-mentor
 * Assign a mentor to a venture
 */
router.post(
    '/:id/assign-mentor',
    authenticateUser,
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { role } = await getContext(req);

            if (!['admin', 'venture_mgr', 'committee_member'].includes(role)) {
                return res.status(403).json({ success: false, message: 'Access denied' });
            }

            const { mentor_id } = req.body;
            if (!mentor_id) {
                return res.status(400).json({ success: false, message: 'mentor_id is required' });
            }

            const { data, error } = await createServiceRoleClient()
                .from('mentor_venture_assignments')
                .insert({
                    mentor_id,
                    venture_id: req.params.id,
                    assigned_by: req.user.id,
                    status: 'active',
                })
                .select()
                .single();

            if (error) {
                if (error.code === '23505') {
                    return res.status(409).json({ success: false, message: 'Mentor already assigned to this venture' });
                }
                console.error('Error assigning mentor:', error);
                return res.status(500).json({ success: false, message: 'Failed to assign mentor' });
            }

            createdResponse(res, { assignment: data });
        } catch (error) {
            next(error);
        }
    }
);

export default router;
