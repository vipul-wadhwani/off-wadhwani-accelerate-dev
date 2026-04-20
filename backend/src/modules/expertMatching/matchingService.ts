import Anthropic from '@anthropic-ai/sdk';
import { createServiceRoleClient } from '../../config/supabase';

let _anthropic: Anthropic | null = null;
function getAnthropic(): Anthropic {
    if (!_anthropic) {
        _anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY || '' });
    }
    return _anthropic;
}

export interface MatchedExpert {
    expert_id: string;
    full_name: string;
    email: string;
    expertise_areas: string[];
    bio: string;
    industry_sectors: string[];
    years_experience: number | null;
    company: string | null;
    score: number;
    rationale: string;
}

/**
 * List all available experts, optionally filtered by search/sector/expertise.
 */
export async function listExperts(filters?: {
    search?: string;
    sector?: string;
    expertise?: string;
}): Promise<any[]> {
    const supabase = createServiceRoleClient();

    // Get mentor profiles joined with profiles
    const { data: mentorProfiles } = await supabase
        .from('mentor_profiles')
        .select('id, expertise_areas, bio, industry_sectors, years_experience, company, designation, tier, is_available');

    const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name, email, role')
        .eq('role', 'mentor');

    if (!mentorProfiles || !profiles) return [];

    const profileMap = new Map(profiles.map(p => [p.id, p]));

    let experts = mentorProfiles
        .filter(mp => mp.is_available !== false)
        .map(mp => {
            const profile = profileMap.get(mp.id);
            if (!profile) return null;
            return {
                id: mp.id,
                full_name: profile.full_name,
                email: profile.email,
                expertise_areas: mp.expertise_areas || [],
                bio: mp.bio || '',
                industry_sectors: mp.industry_sectors || [],
                years_experience: mp.years_experience,
                company: mp.company,
                designation: mp.designation,
                tier: mp.tier || 'free',
            };
        })
        .filter(Boolean) as any[];

    // Apply filters
    if (filters?.search) {
        const q = filters.search.toLowerCase();
        experts = experts.filter(e =>
            e.full_name.toLowerCase().includes(q) ||
            e.expertise_areas.some((a: string) => a.toLowerCase().includes(q)) ||
            (e.bio || '').toLowerCase().includes(q)
        );
    }
    if (filters?.sector) {
        const s = filters.sector.toLowerCase();
        experts = experts.filter(e =>
            e.industry_sectors.some((sec: string) => sec.toLowerCase().includes(s))
        );
    }
    if (filters?.expertise) {
        const ex = filters.expertise.toLowerCase();
        experts = experts.filter(e =>
            e.expertise_areas.some((a: string) => a.toLowerCase().includes(ex))
        );
    }

    return experts;
}

/**
 * AI-powered expert matching: Claude ranks experts for a venture.
 */
export async function matchExperts(ventureId: string, matchCount: number = 5): Promise<MatchedExpert[]> {
    const supabase = createServiceRoleClient();

    // Fetch venture data
    const { data: venture } = await supabase
        .from('ventures')
        .select('id, name, founder_name, city, location, program_recommendation, revenue_12m, full_time_employees, growth_focus')
        .eq('id', ventureId)
        .single();

    if (!venture) throw new Error('Venture not found');

    // Fetch venture application for more context
    const { data: application } = await supabase
        .from('venture_applications')
        .select('product_description, problem_statement, support_request, blockers')
        .eq('venture_id', ventureId)
        .maybeSingle();

    // Fetch all available experts
    const experts = await listExperts();
    if (experts.length === 0) return [];

    // Build expert list for Claude
    const expertList = experts.map((e, i) =>
        `${i + 1}. ${e.full_name} | Expertise: ${e.expertise_areas.join(', ') || 'N/A'} | Industries: ${e.industry_sectors.join(', ') || 'N/A'} | Experience: ${e.years_experience || 'N/A'} yrs | Company: ${e.company || 'N/A'}`
    ).join('\n');

    const ventureContext = [
        `Company: ${venture.name}`,
        `Founder: ${venture.founder_name || 'N/A'}`,
        `Location: ${[venture.city, venture.location].filter(Boolean).join(', ') || 'N/A'}`,
        `Program: ${venture.program_recommendation || 'N/A'}`,
        `Revenue: ${venture.revenue_12m || 'N/A'}`,
        `Employees: ${venture.full_time_employees || 'N/A'}`,
        `Growth Focus: ${Array.isArray(venture.growth_focus) ? venture.growth_focus.join(', ') : venture.growth_focus || 'N/A'}`,
        application?.product_description ? `Product: ${application.product_description}` : '',
        application?.problem_statement ? `Problem: ${application.problem_statement}` : '',
        application?.support_request ? `Support Needed: ${application.support_request}` : '',
        application?.blockers ? `Blockers: ${application.blockers}` : '',
    ].filter(Boolean).join('\n');

    const prompt = `You are an expert matching engine for a venture mentorship platform.

Given this venture's profile:
${ventureContext}

And these available experts:
${expertList}

Select the top ${matchCount} best-matched experts for this venture. Consider:
- Expertise alignment with the venture's product, problem, and growth focus
- Industry relevance
- Experience level appropriate for the venture's stage

Return a JSON array (no markdown, no explanation) with exactly ${matchCount} objects:
[{"index": 1, "score": 95, "rationale": "One sentence explaining the match"}]

Where "index" is the expert's number from the list above, "score" is 0-100 match percentage.`;

    try {
        const anthropic = getAnthropic();
        const response = await anthropic.messages.create({
            model: 'claude-sonnet-4-5-20250929',
            max_tokens: 1024,
            messages: [{ role: 'user', content: prompt }],
        });

        const text = response.content[0].type === 'text' ? response.content[0].text : '';
        const matches = JSON.parse(text) as Array<{ index: number; score: number; rationale: string }>;

        return matches.map(m => {
            const expert = experts[m.index - 1];
            if (!expert) return null;
            return {
                expert_id: expert.id,
                full_name: expert.full_name,
                email: expert.email,
                expertise_areas: expert.expertise_areas,
                bio: expert.bio,
                industry_sectors: expert.industry_sectors,
                years_experience: expert.years_experience,
                company: expert.company,
                score: m.score,
                rationale: m.rationale,
            };
        }).filter(Boolean) as MatchedExpert[];
    } catch (err) {
        console.error('[ExpertMatching] AI matching error:', err);
        // Fallback: return first N experts without AI scoring
        return experts.slice(0, matchCount).map(e => ({
            ...e,
            expert_id: e.id,
            score: 0,
            rationale: 'AI matching unavailable — showing all experts',
        }));
    }
}
