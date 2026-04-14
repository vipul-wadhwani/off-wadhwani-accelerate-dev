/**
 * API client for the Test Framework module.
 * All calls go to /api/test-framework/* endpoints served by the isolated backend module.
 */

import { supabase } from '../../lib/supabase';
import type { VentureSummary, ContextResponse, RunResponse, Feature } from './types';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

async function authHeaders(): Promise<HeadersInit> {
    const { data } = await supabase.auth.getSession();
    return {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${data.session?.access_token ?? ''}`,
    };
}

async function handleResponse<T>(res: Response): Promise<T> {
    const json = await res.json();
    if (!res.ok || !json.success) {
        throw new Error(json.message || `Request failed: ${res.status}`);
    }
    return json.data as T;
}

// ─── GET /api/test-framework/ventures ────────────────────────────────────────
export async function fetchVentures(): Promise<VentureSummary[]> {
    const res = await fetch(`${API_URL}/api/test-framework/ventures`, {
        headers: await authHeaders(),
    });
    return handleResponse<VentureSummary[]>(res);
}

// ─── GET /api/test-framework/context/:ventureId/:feature ─────────────────────
export async function fetchContext(ventureId: string, feature: Feature): Promise<ContextResponse> {
    const res = await fetch(`${API_URL}/api/test-framework/context/${ventureId}/${feature}`, {
        headers: await authHeaders(),
    });
    return handleResponse<ContextResponse>(res);
}

// ─── POST /api/test-framework/run ────────────────────────────────────────────
export async function runTest(feature: Feature, customPrompt: string): Promise<RunResponse> {
    const res = await fetch(`${API_URL}/api/test-framework/run`, {
        method: 'POST',
        headers: await authHeaders(),
        body: JSON.stringify({ feature, customPrompt }),
    });
    return handleResponse<RunResponse>(res);
}
