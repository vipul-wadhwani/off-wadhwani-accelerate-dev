import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import * as ventureService from '../services/ventureService';
import { autoAssignScreeningManager } from '../services/ventureService';
import * as aiService from '../services/aiService';
import { extractDocumentText } from '../services/documentService';
import { authenticateUser } from '../middleware/auth';
import { validateBody, validateQuery } from '../middleware/validate';
import { createAuthenticatedClient } from '../config/supabase';
import {
    createVentureSchema,
    updateVentureSchema,
    createStreamSchema,
    updateStreamSchema,
    ventureQuerySchema
} from '../types/schemas';
import { successResponse, createdResponse, noContentResponse } from '../utils/response';
import { sendPanelInvitationEmail, sendWelcomeEmail, sendSelectionWelcomeEmail } from '../services/emailService';
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
                    revenue_12m: commitment.lastYearRevenue || null,
                    revenue_potential_3y: commitment.revenuePotential || null,
                    full_time_employees: growthCurrent.employees || null,
                    financial_condition: commitment.financialCondition || null,
                    incremental_hiring: commitment.incrementalHiring ? parseInt(commitment.incrementalHiring) : null,
                    target_jobs: commitment.targetJobs ? parseInt(commitment.targetJobs) : null,
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
                            const founderName = profile.full_name || 'Founder';
                            const ventureName = venture.name || 'Your Venture';
                            await sendPanelInvitationEmail(profile.email, founderName, ventureName);
                            console.log(`Panel invitation email sent to ${profile.email} for venture ${venture.name}`);
                        } else {
                            console.warn(`No email found for user_id ${venture.user_id}, skipping panel invitation email`);
                        }
                    } catch (emailError) {
                        console.error('Failed to send panel invitation email:', emailError);
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
            const loginUrl = 'https://devaccelerate.wadhwaniliftoff.ai';

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

            const startTime = Date.now();

            // Generate roadmap via Claude
            const roadmapData = await aiService.generateVentureRoadmap(ventureData, {
                vsmNotes: assessment.notes || '',
                aiAnalysis: assessment.ai_analysis || null,
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
            const { supabase } = await getContext(req);

            const { data: roadmap, error } = await supabase
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

export default router;
