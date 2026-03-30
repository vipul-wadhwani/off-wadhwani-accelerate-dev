// User types
export interface User {
    id: string;
    email?: string; // Optional to match Supabase User type
    user_metadata?: {
        full_name?: string;
        role?: string;
    };
}

// Profile types
export interface Profile {
    id: string;
    email: string;
    full_name: string;
    role: 'entrepreneur' | 'vsm' | 'committee' | 'admin';
    created_at: string;
    updated_at: string;
}

// Venture types
export interface Venture {
    id: string;
    user_id: string;
    name: string;
    founder_name?: string;
    program: string;
    status: string;
    growth_current?: GrowthData;
    growth_target?: GrowthData;
    growth_focus?: string;
    commitment?: CommitmentData;
    blockers?: string;
    support_request?: string;
    created_at: string;
    updated_at: string;
}

export interface GrowthData {
    product?: string;
    geography?: string;
    segment?: string;
    revenue?: string;
}

export interface CommitmentData {
    investment?: string;
    teamSize?: number;
    progress?: string;
}

// Venture Stream types
export interface VentureStream {
    id: string;
    venture_id: string;
    stream_name: string;
    status: 'Done' | 'Work in Progress' | 'Need some advice';
    created_at: string;
    updated_at: string;
}

// API Request types
export interface SignupRequest {
    email: string;
    password: string;
    full_name: string;
    role?: 'entrepreneur' | 'vsm' | 'committee' | 'admin';
}

export interface LoginRequest {
    email: string;
    password: string;
}

export interface CreateVentureRequest {
    name: string;
    founder_name?: string;
    program: string;
    growth_current?: GrowthData;
    growth_target?: GrowthData;
    growth_focus?: string;
    commitment?: CommitmentData;
    blockers?: string;
    support_request?: string;
}

export interface UpdateVentureRequest extends Partial<CreateVentureRequest> {
    status?: Venture['status'];
}

export interface CreateStreamRequest {
    stream_name: string;
    status: VentureStream['status'];
}

// API Response types
export interface AuthResponse {
    user: User;
    session: {
        access_token: string;
        refresh_token: string;
        expires_in: number;
    };
}

export interface VentureListResponse {
    ventures: Venture[];
    total: number;
}

export interface VentureDetailResponse {
    venture: Venture;
    streams?: VentureStream[];
}

// Query parameters
export interface VentureQueryParams {
    status?: Venture['status'];
    program?: string;
    limit?: number;
    offset?: number;
    assigned_to_me?: boolean;
}
