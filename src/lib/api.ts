import { supabase } from './supabase';

interface SignupData {
    email: string;
    password: string;
    full_name: string;
    role?: 'entrepreneur' | 'vsm' | 'committee' | 'admin';
}

interface VentureQueryParams {
    status?: string;
    program?: string;
    limit?: number;
    offset?: number;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
}

class ApiClient {
    // ============ AUTH ENDPOINTS ============

    async signup(data: SignupData) {
        const { data: authData, error } = await supabase.auth.signUp({
            email: data.email,
            password: data.password,
            options: {
                data: {
                    full_name: data.full_name,
                    role: data.role || 'entrepreneur',
                },
            },
        });

        if (error) throw error;
        return { user: authData.user, session: authData.session };
    }

    async login(email: string, password: string) {
        const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password,
        });

        if (error) throw error;
        return { user: data.user, session: data.session };
    }

    async logout() {
        const { error } = await supabase.auth.signOut();
        if (error) throw error;
    }

    async getMe() {
        const { data: { user }, error } = await supabase.auth.getUser();
        if (error) throw error;
        // Return structured as profile for backward compatibility
        return {
            profile: {
                id: user?.id,
                email: user?.email,
                full_name: user?.user_metadata?.full_name,
                role: user?.user_metadata?.role
            }
        };
    }

    // ============ VENTURE ENDPOINTS ============

    async getVentures(params: VentureQueryParams = {}) {
        const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';
        const session = await supabase.auth.getSession();

        const queryParams = new URLSearchParams();
        if (params.status) queryParams.set('status', params.status);
        if (params.program) queryParams.set('program', params.program);
        if (params.limit) queryParams.set('limit', String(params.limit));
        if (params.offset) queryParams.set('offset', String(params.offset));
        if (params.sortBy) queryParams.set('sortBy', params.sortBy);
        if (params.sortOrder) queryParams.set('sortOrder', params.sortOrder);

        const url = `${API_URL}/api/ventures${queryParams.toString() ? `?${queryParams}` : ''}`;
        const response = await fetch(url, {
            headers: {
                'Authorization': `Bearer ${session.data.session?.access_token}`
            }
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || 'Failed to fetch ventures');
        }

        const result = await response.json();
        const venturesData = result.data?.ventures || result.ventures || [];

        // Flatten application + assessment data onto each venture for backward compatibility
        const ventures = venturesData.map((v: any) => {
            const app = v.application?.[0] || v.application || {};
            const assessments = v.assessments || [];
            const assessment = assessments.find((a: any) => a.is_current) || assessments[0] || {};
            return {
                ...v,
                revenue_12m: app.revenue_12m,
                revenue_potential_3y: app.revenue_potential_3y,
                full_time_employees: app.full_time_employees,
                target_jobs: app.target_jobs,
                financial_condition: app.financial_condition,
                time_commitment: app.time_commitment,
                second_line_team: app.second_line_team,
                program_recommendation: assessment.program_recommendation,
                ai_analysis: assessment.ai_analysis,
            };
        });

        return { ventures, total: result.data?.total || ventures.length };
    }

    async createVenture(data: any) {
        // Call backend API instead of Supabase directly
        // Backend will split data between ventures and venture_applications tables
        const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';
        const session = await supabase.auth.getSession();

        const response = await fetch(`${API_URL}/api/ventures`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${session.data.session?.access_token}`
            },
            body: JSON.stringify(data)
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || 'Failed to create venture');
        }

        const result = await response.json();
        // Backend returns { venture: ... } directly, not wrapped in data
        return { venture: result.venture };
    }

    async getVenture(id: string) {
        const { data, error } = await supabase
            .from('ventures')
            .select(`
                *,
                streams:venture_streams(*),
                application:venture_applications(*),
                assessments:venture_assessments(*)
            `)
            .eq('id', id)
            .single();

        if (error) throw error;

        // Flatten application data onto venture for backward compatibility
        const application = data.application?.[0] || data.application || {};

        // Get the current assessment (most recent with is_current=true)
        const assessments = data.assessments || [];
        const currentAssessment = assessments.find((a: any) => a.is_current) || assessments[0] || {};

        const venture = {
            ...data,
            // From venture_applications
            revenue_12m: application.revenue_12m,
            revenue_potential_3y: application.revenue_potential_3y,
            revenue_potential_12m: application.revenue_potential_12m,
            full_time_employees: application.full_time_employees,
            target_jobs: application.target_jobs,
            financial_condition: application.financial_condition,
            time_commitment: application.time_commitment,
            second_line_team: application.second_line_team,
            min_investment: application.min_investment,
            incremental_hiring: application.incremental_hiring,
            growth_focus: application.growth_focus,
            support_request: application.support_request,
            corporate_presentation_url: application.corporate_presentation_url,
            founder_email: application.founder_email,
            founder_phone: application.founder_phone,
            founder_designation: application.founder_designation,
            referred_by: application.referred_by,
            what_do_you_sell: application.what_do_you_sell,
            who_do_you_sell_to: application.who_do_you_sell_to,
            which_regions: application.which_regions,
            company_type: application.company_type,
            state: application.state,
            focus_product: application.focus_product,
            focus_segment: application.focus_segment,
            focus_geography: application.focus_geography,
            blockers: application.blockers,
            kpi_status: application.kpi_status,
            // From venture_assessments
            vsm_notes: currentAssessment.notes,
            internal_comments: currentAssessment.internal_comments,
            ai_analysis: currentAssessment.ai_analysis,
            panel_ai_analysis: currentAssessment.panel_ai_analysis,
            gate_questions: currentAssessment.gate_questions,
            program_recommendation: currentAssessment.program_recommendation,
            vsm_reviewed_at: currentAssessment.assessment_date,
        };

        return {
            venture,
            streams: data.streams || [],
            milestones: [],
            support_hours: {}
        };
    }

    async updateVenture(id: string, data: any) {
        // Split fields between ventures table and venture_assessments table
        const ventureFields: Record<string, string> = {};
        const assessmentFields: Record<string, any> = {};

        // Fields that belong to the ventures table
        const ventureColumns = new Set([
            'name', 'founder_name', 'city', 'location', 'program_id', 'program_name',
            'status', 'assigned_vsm_id', 'assigned_vm_id', 'assigned_panelist_id',
            'venture_partner', 'workbench_locked', 'locked_reason',
            'agreement_status', 'agreement_accepted_at'
        ]);

        // Fields that belong to the venture_assessments table
        const assessmentColumns = new Set([
            'vsm_notes', 'internal_comments', 'ai_analysis', 'program_recommendation',
            'vsm_reviewed_at', 'decision', 'decision_rationale'
        ]);

        for (const [key, value] of Object.entries(data)) {
            if (ventureColumns.has(key)) {
                ventureFields[key] = value as string;
            } else if (assessmentColumns.has(key)) {
                assessmentFields[key] = value;
            }
        }

        // Intercept: if status is being set to 'Approved' and venture has a
        // Prime/Core/Select program recommendation, route to 'Assign VP/VM' instead
        if (ventureFields.status === 'Approved') {
            // Check incoming data first, then look up from assessments
            let rec = (data.program_recommendation || '').toLowerCase();
            if (!rec) {
                const { data: assessment } = await supabase
                    .from('venture_assessments')
                    .select('program_recommendation')
                    .eq('venture_id', id)
                    .eq('is_current', true)
                    .single();
                rec = (assessment?.program_recommendation || '').toLowerCase();
            }
            if (rec.includes('prime') || rec.includes('core') || rec.includes('select')) {
                ventureFields.status = 'Assign VP/VM';
            }
        }

        // Update ventures table if there are venture fields
        let venture = null;
        if (Object.keys(ventureFields).length > 0) {
            const { data: v, error } = await supabase
                .from('ventures')
                .update(ventureFields)
                .eq('id', id)
                .select()
                .single();

            if (error) {
                console.error('Supabase ventures update error:', error);
                throw error;
            }
            venture = v;
        }

        // Upsert venture_assessments if there are assessment fields
        if (Object.keys(assessmentFields).length > 0) {
            const { data: { user } } = await supabase.auth.getUser();

            // Map field names: vsm_notes -> notes
            const assessmentPayload: any = {
                venture_id: id,
                assessed_by: user?.id,
                assessor_role: 'success_mgr',
                assessment_type: 'screening',
                is_current: true,
                notes: assessmentFields.vsm_notes,
                internal_comments: assessmentFields.internal_comments,
                ai_analysis: assessmentFields.ai_analysis,
                program_recommendation: assessmentFields.program_recommendation,
                decision: assessmentFields.decision,
                decision_rationale: assessmentFields.decision_rationale,
            };

            // Remove undefined values
            Object.keys(assessmentPayload).forEach(key => {
                if (assessmentPayload[key] === undefined) delete assessmentPayload[key];
            });

            // Check if an assessment already exists for this venture
            const { data: existing } = await supabase
                .from('venture_assessments')
                .select('id')
                .eq('venture_id', id)
                .eq('is_current', true)
                .maybeSingle();

            if (existing) {
                // Update existing assessment
                const { error } = await supabase
                    .from('venture_assessments')
                    .update(assessmentPayload)
                    .eq('id', existing.id);

                if (error) {
                    console.error('Supabase assessment update error:', error);
                    throw error;
                }
            } else {
                // Insert new assessment
                const { error } = await supabase
                    .from('venture_assessments')
                    .insert(assessmentPayload);

                if (error) {
                    console.error('Supabase assessment insert error:', error);
                    throw error;
                }
            }
        }

        // Fire-and-forget: send panel invitation email when venture moves to Panel Review
        const program = data.program_recommendation;
        const status = data.status;
        if (
            program &&
            program !== 'Not Recommended' &&
            program !== 'Selfserve' &&
            status === 'Panel Review'
        ) {
            (async () => {
                try {
                    const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';
                    const session = await supabase.auth.getSession();
                    fetch(`${API_URL}/api/ventures/${id}/send-panel-email`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${session.data.session?.access_token}`
                        }
                    }).catch(err => console.error('Failed to trigger panel invitation email:', err));
                } catch (err) {
                    console.error('Failed to trigger panel invitation email:', err);
                }
            })();
        }

        return { venture };
    }

    // ============ STREAM ENDPOINTS ============

    async getVentureStreams(ventureId: string) {
        const { data, error } = await supabase
            .from('venture_streams')
            .select('*')
            .eq('venture_id', ventureId);

        if (error) throw error;
        return { streams: data };
    }

    async createStream(ventureId: string, data: { stream_name: string; status: string }) {
        const { data: stream, error } = await supabase
            .from('venture_streams')
            .insert({ ...data, venture_id: ventureId })
            .select()
            .single();

        if (error) throw error;
        return { stream };
    }

    async updateStream(id: string, data: { stream_name?: string; status?: string }) {
        const { data: stream, error } = await supabase
            .from('venture_streams')
            .update(data)
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;
        return { stream };
    }

    async deleteStream(id: string) {
        const { error } = await supabase
            .from('venture_streams')
            .delete()
            .eq('id', id);

        if (error) throw error;
    }

    async submitVenture(id: string) {
        // Call backend API to submit venture
        const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';
        const session = await supabase.auth.getSession();

        const response = await fetch(`${API_URL}/api/ventures/${id}/submit`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${session.data.session?.access_token}`
            }
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || 'Failed to submit venture');
        }

        const result = await response.json();
        // Backend returns { message: '...', venture: ... } directly
        return { venture: result.venture };
    }

    // ============ INTERACTION ENDPOINTS ============

    async getInteractions(ventureId: string, createdBy?: string) {
        let query = supabase
            .from('venture_interactions')
            .select('*')
            .eq('venture_id', ventureId)
            .is('deleted_at', null);

        if (createdBy) {
            query = query.eq('created_by', createdBy);
        }

        const { data, error } = await query.order('interaction_date', { ascending: false });

        if (error) throw error;
        return { interactions: data || [] };
    }

    async createInteraction(ventureId: string, data: any) {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('Not authenticated');

        const { data: interaction, error } = await supabase
            .from('venture_interactions')
            .insert({
                venture_id: ventureId,
                created_by: user.id,
                ...data
            })
            .select()
            .single();

        if (error) throw error;
        return { interaction };
    }

    async updateInteraction(id: string, data: any) {
        const { data: interaction, error } = await supabase
            .from('venture_interactions')
            .update(data)
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;
        return { interaction };
    }

    async deleteInteraction(id: string) {
        const { error } = await supabase
            .from('venture_interactions')
            .update({ deleted_at: new Date().toISOString() })
            .eq('id', id);

        if (error) throw error;
    }

    // ============ ROADMAP ENDPOINTS ============

    async generateRoadmap(ventureId: string) {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) throw new Error('Not authenticated');

        const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5 * 60 * 1000); // 5 min timeout

        const response = await fetch(`${API_URL}/api/ventures/${ventureId}/generate-roadmap`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${session.access_token}`
            },
            signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.message || 'Failed to generate roadmap');
        }

        const data = await response.json();
        return data; // Returns { roadmap }
    }

    async getRoadmap(ventureId: string) {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) throw new Error('Not authenticated');

        const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

        const response = await fetch(`${API_URL}/api/ventures/${ventureId}/roadmap`, {
            headers: {
                'Authorization': `Bearer ${session.access_token}`
            }
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.message || 'Failed to fetch roadmap');
        }

        const data = await response.json();
        return data; // Returns { roadmap }
    }

    // ============ AI INSIGHTS ENDPOINTS ============

    async generateInsights(ventureId: string, vsmNotes?: string) {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) throw new Error('Not authenticated');

        const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

        const response = await fetch(`${API_URL}/api/ventures/${ventureId}/generate-insights`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${session.access_token}`
            },
            body: JSON.stringify({ vsm_notes: vsmNotes })
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.message || 'Failed to generate AI insights');
        }

        const data = await response.json();
        return data; // Returns { message, insights }
    }

    async generatePanelInsights(ventureId: string, panelNotes?: string) {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) throw new Error('Not authenticated');

        const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

        const response = await fetch(`${API_URL}/api/ventures/${ventureId}/generate-insights?type=panel`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${session.access_token}`
            },
            body: JSON.stringify({ panel_notes: panelNotes })
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.message || 'Failed to generate panel insights');
        }

        const data = await response.json();
        return data;
    }

    async savePanelAssessment(ventureId: string, panelScorecard: any[]) {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) throw new Error('Not authenticated');

        const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

        const response = await fetch(`${API_URL}/api/ventures/${ventureId}/panel-assessment`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${session.access_token}`
            },
            body: JSON.stringify({ panel_scorecard: panelScorecard })
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.message || 'Failed to save panel assessment');
        }

        const data = await response.json();
        return data;
    }

    async saveGateQuestions(ventureId: string, gateQuestions: any[]) {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) throw new Error('Not authenticated');

        const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

        const response = await fetch(`${API_URL}/api/ventures/${ventureId}/gate-questions`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${session.access_token}`
            },
            body: JSON.stringify({ gate_questions: gateQuestions })
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.message || 'Failed to save gate questions');
        }

        const data = await response.json();
        return data;
    }

    // ============ PANEL FEEDBACK ENDPOINTS ============

    async getPanelFeedback(ventureId: string) {
        const { data, error } = await supabase
            .from('panel_feedback')
            .select('*')
            .eq('venture_id', ventureId)
            .order('created_at', { ascending: false });

        if (error) throw error;
        return { feedback: data || [] };
    }

    async createPanelFeedback(ventureId: string, data: any) {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('Not authenticated');

        // Prevent duplicate submissions — check if any feedback already exists for this venture
        const { data: existing } = await supabase
            .from('panel_feedback')
            .select('id')
            .eq('venture_id', ventureId)
            .limit(1);

        if (existing && existing.length > 0) {
            throw new Error('Panel feedback has already been submitted for this venture.');
        }

        const { data: feedback, error } = await supabase
            .from('panel_feedback')
            .insert({
                venture_id: ventureId,
                submitted_by: user.id,
                ...data
            })
            .select()
            .single();

        if (error) throw error;
        return { feedback };
    }

    async sendSelectionEmail(ventureId: string, programCategory: string) {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) throw new Error('Not authenticated');

        const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';
        const response = await fetch(`${API_URL}/api/ventures/${ventureId}/send-selection-email`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${session.access_token}`,
            },
            body: JSON.stringify({ program_category: programCategory }),
        });

        if (!response.ok) {
            const err = await response.json().catch(() => ({}));
            throw new Error(err.message || 'Failed to send selection email');
        }

        return response.json();
    }

    // ============ SCHEDULED CALLS ENDPOINTS ============

    async getScheduledCalls(filters?: { status?: string; date?: string; venture_id?: string }) {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) throw new Error('Not authenticated');

        const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';
        const params = new URLSearchParams();
        if (filters?.status) params.set('status', filters.status);
        if (filters?.date) params.set('date', filters.date);
        if (filters?.venture_id) params.set('venture_id', filters.venture_id);

        const queryString = params.toString();
        const url = `${API_URL}/api/scheduled-calls${queryString ? `?${queryString}` : ''}`;

        const response = await fetch(url, {
            headers: {
                'Authorization': `Bearer ${session.access_token}`
            }
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.message || 'Failed to fetch scheduled calls');
        }

        const data = await response.json();
        return data; // Returns { scheduled_calls: [...] }
    }

    async createScheduledCall(callData: {
        venture_id: string;
        panelist_id: string;
        call_date: string;
        start_time: string;
        end_time: string;
        meet_link?: string;
        notes?: string;
    }) {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) throw new Error('Not authenticated');

        const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

        const response = await fetch(`${API_URL}/api/scheduled-calls`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${session.access_token}`
            },
            body: JSON.stringify(callData)
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.message || 'Failed to create scheduled call');
        }

        const data = await response.json();
        return data; // Returns { scheduled_call: {...} }
    }

    async cancelScheduledCall(id: string, reason?: string) {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) throw new Error('Not authenticated');

        const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

        const response = await fetch(`${API_URL}/api/scheduled-calls/${id}/cancel`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${session.access_token}`
            },
            body: JSON.stringify({ reason })
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.message || 'Failed to cancel scheduled call');
        }

        const data = await response.json();
        return data; // Returns { scheduled_call: {...} }
    }

    async getPanelistAvailability(panelistId: string, date: string) {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) throw new Error('Not authenticated');

        const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';
        const params = new URLSearchParams({ panelist_id: panelistId, date });

        const response = await fetch(`${API_URL}/api/scheduled-calls/availability?${params}`, {
            headers: {
                'Authorization': `Bearer ${session.access_token}`
            }
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.message || 'Failed to fetch availability');
        }

        const data = await response.json();
        return data; // Returns { calls: [...] }
    }

    // ============ PANELIST AVAILABILITY ENDPOINTS ============

    async getMyPanelistProfile() {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user?.email) throw new Error('Not authenticated');

        const { data, error } = await supabase
            .from('panelists')
            .select('*')
            .eq('email', user.email)
            .maybeSingle();

        if (error) throw error;
        return data; // null if no matching panelist
    }

    async getPanelistWeeklyAvailability(panelistId: string) {
        const { data, error } = await supabase
            .from('panelist_availability')
            .select('*')
            .eq('panelist_id', panelistId)
            .order('day_of_week')
            .order('start_time');

        if (error) throw error;
        return data || [];
    }

    async savePanelistWeeklyAvailability(panelistId: string, slots: { day_of_week: number; start_time: string; end_time: string }[]) {
        // Delete all existing slots for this panelist
        const { error: deleteError } = await supabase
            .from('panelist_availability')
            .delete()
            .eq('panelist_id', panelistId);

        if (deleteError) throw deleteError;

        // Insert new slots if any
        if (slots.length > 0) {
            const { error: insertError } = await supabase
                .from('panelist_availability')
                .insert(slots.map(s => ({ panelist_id: panelistId, ...s })));

            if (insertError) throw insertError;
        }
    }

    async getPanelistBlockedDates(panelistId: string) {
        const { data, error } = await supabase
            .from('panelist_blocked_dates')
            .select('*')
            .eq('panelist_id', panelistId)
            .order('blocked_date');

        if (error) throw error;
        return data || [];
    }

    async addPanelistBlockedDate(panelistId: string, date: string) {
        const { data, error } = await supabase
            .from('panelist_blocked_dates')
            .insert({ panelist_id: panelistId, blocked_date: date })
            .select()
            .single();

        if (error) throw error;
        return data;
    }

    async removePanelistBlockedDate(id: string) {
        const { error } = await supabase
            .from('panelist_blocked_dates')
            .delete()
            .eq('id', id);

        if (error) throw error;
    }

    async getPanelistAvailableSlots(panelistId: string, date: string) {
        // Get weekly slots for this day of week
        const dayOfWeek = new Date(date + 'T00:00:00').getDay();

        const { data: weeklySlots, error: weeklyError } = await supabase
            .from('panelist_availability')
            .select('*')
            .eq('panelist_id', panelistId)
            .eq('day_of_week', dayOfWeek)
            .order('start_time');

        if (weeklyError) throw weeklyError;

        // Check if panelist has ANY availability preferences set
        const { count, error: countError } = await supabase
            .from('panelist_availability')
            .select('*', { count: 'exact', head: true })
            .eq('panelist_id', panelistId);

        if (countError) throw countError;

        // No preferences set at all → return null for fallback
        if (count === 0) return null;

        // Check if this date is blocked
        const { data: blocked, error: blockedError } = await supabase
            .from('panelist_blocked_dates')
            .select('id')
            .eq('panelist_id', panelistId)
            .eq('blocked_date', date)
            .maybeSingle();

        if (blockedError) throw blockedError;
        if (blocked) return []; // Date is blocked

        // Filter out slots that conflict with existing scheduled calls
        const existingCalls = await this.getPanelistAvailability(panelistId, date);
        const bookedSlots = (existingCalls.calls || []).map((c: any) => ({
            start: c.start_time.slice(0, 5),
            end: c.end_time.slice(0, 5),
        }));

        const available = (weeklySlots || []).filter(slot => {
            const slotStart = slot.start_time.slice(0, 5);
            const slotEnd = slot.end_time.slice(0, 5);
            return !bookedSlots.some((b: any) => slotStart < b.end && slotEnd > b.start);
        });

        return available;
    }

    // ============ DOCUMENT UPLOAD ENDPOINTS ============

    async uploadVentureDocument(ventureId: string, file: File) {
        const ALLOWED_TYPES = [
            'application/pdf',
            'application/vnd.ms-powerpoint',
            'application/vnd.openxmlformats-officedocument.presentationml.presentation',
            'application/msword',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        ];
        const MAX_SIZE = 5 * 1024 * 1024; // 5MB

        if (!ALLOWED_TYPES.includes(file.type)) {
            throw new Error('Invalid file type. Please upload a PDF, PPT, PPTX, DOC, or DOCX file.');
        }
        if (file.size > MAX_SIZE) {
            throw new Error('File size exceeds 5MB limit.');
        }

        const timestamp = Date.now();
        const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
        const filePath = `${ventureId}/${timestamp}_${safeName}`;

        const { error: uploadError } = await supabase.storage
            .from('venture-documents')
            .upload(filePath, file, { upsert: false });

        if (uploadError) throw uploadError;

        // Save the storage path via a SECURITY DEFINER function (bypasses workbench_locked RLS)
        const { error: rpcError } = await supabase.rpc('save_venture_document_url', {
            p_venture_id: ventureId,
            p_file_path: filePath,
        });

        if (rpcError) {
            console.error('Failed to save document URL:', rpcError);
            throw new Error('Document uploaded but failed to save reference. Please try again.');
        }

        return { filePath };
    }

    async getVentureDocumentUrl(filePath: string): Promise<string> {
        const { data, error } = await supabase.storage
            .from('venture-documents')
            .createSignedUrl(filePath, 3600); // 1-hour expiry

        if (error) throw error;
        return data.signedUrl;
    }

    async getVPVMCandidates(program: string) {
        const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';
        const session = await supabase.auth.getSession();

        const response = await fetch(`${API_URL}/api/ventures/vpvm-candidates?program=${encodeURIComponent(program)}`, {
            headers: {
                'Authorization': `Bearer ${session.data.session?.access_token}`
            }
        });

        if (!response.ok) {
            const error = await response.json().catch(() => ({ error: 'Failed to fetch VP/VM candidates' }));
            throw new Error(error.error || 'Failed to fetch VP/VM candidates');
        }

        const result = await response.json();
        return result.candidates || [];
    }

    async assignVPVM(ventureId: string, assignedVmId: string) {
        const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';
        const session = await supabase.auth.getSession();

        const response = await fetch(`${API_URL}/api/ventures/${ventureId}/assign-vpvm`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${session.data.session?.access_token}`
            },
            body: JSON.stringify({ assigned_vm_id: assignedVmId })
        });

        if (!response.ok) {
            const error = await response.json().catch(() => ({ error: 'Failed to assign VP/VM' }));
            throw new Error(error.error || 'Failed to assign VP/VM');
        }

        const result = await response.json();
        return result.venture;
    }

    async getPanelistsByProgram(program: string) {
        const { data, error } = await supabase
            .from('panelists')
            .select('*')
            .eq('program', program)
            .order('name');

        if (error) throw error;
        return data || [];
    }
}

export const api = new ApiClient();
