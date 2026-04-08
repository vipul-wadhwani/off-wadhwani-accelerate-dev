export interface Expert {
    id: string;
    full_name: string;
    email: string;
    expertise_areas: string[];
    bio: string;
    industry_sectors: string[];
    years_experience: number | null;
    company: string | null;
    designation: string | null;
    tier: string;
}

export interface MatchedExpert extends Expert {
    expert_id: string;
    score: number;
    rationale: string;
}
