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
        let query = supabase
            .from('ventures')
            .select('*, streams:venture_streams(*), application:venture_applications(*), assessments:venture_assessments(*)', { count: 'exact' });

        if (params.status) {
            query = query.eq('status', params.status);
        }
        if (params.program) {
            query = query.eq('program', params.program);
        }
        if (params.limit) {
            query = query.limit(params.limit);
        }
        if (params.offset) {
            query = query.range(params.offset, params.offset + (params.limit || 10) - 1);
        }

        const { data, error, count } = await query;
        if (error) throw error;

        // Flatten application + assessment data onto each venture for backward compatibility
        const ventures = (data || []).map((v: any) => {
            const app = v.application?.[0] || v.application || {};
            const assessments = v.assessments || [];
            const assessment = assessments.find((a: any) => a.is_current) || assessments[0] || {};
            return {
                ...v,
                revenue_12m: app.revenue_12m,
                revenue_potential_3y: app.revenue_potential_3y,
                full_time_employees: app.full_time_employees,
                target_jobs: app.target_jobs,
                program_recommendation: assessment.program_recommendation,
                ai_analysis: assessment.ai_analysis,
            };
        });

        return { ventures, total: count };
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
            // From venture_assessments
            vsm_notes: currentAssessment.notes,
            internal_comments: currentAssessment.internal_comments,
            ai_analysis: currentAssessment.ai_analysis,
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
            'status', 'assigned_vsm_id', 'assigned_vm_id', 'venture_partner',
            'workbench_locked', 'locked_reason'
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

    async getInteractions(ventureId: string) {
        const { data, error } = await supabase
            .from('venture_interactions')
            .select('*')
            .eq('venture_id', ventureId)
            .is('deleted_at', null)
            .order('interaction_date', { ascending: false });

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
