import { useState, useCallback } from 'react';
import type { MeetingRequest } from '../types';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

async function getToken() {
    const { supabase } = await import('../../../lib/supabase');
    return (await supabase.auth.getSession()).data.session?.access_token || '';
}

export function useRequests() {
    const [requests, setRequests] = useState<MeetingRequest[]>([]);
    const [loading, setLoading] = useState(false);
    const [submitting, setSubmitting] = useState(false);

    const fetchRequests = useCallback(async (opts?: { role?: string; status?: string; venture_id?: string }) => {
        setLoading(true);
        try {
            const token = await getToken();
            const params = new URLSearchParams();
            if (opts?.role) params.set('role', opts.role);
            if (opts?.status) params.set('status', opts.status);
            if (opts?.venture_id) params.set('venture_id', opts.venture_id);

            const res = await fetch(`${API_URL}/api/meeting-requests?${params}`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            const data = await res.json();
            if (data.success) setRequests(data.data || []);
        } catch (err) {
            console.error('[Requests] Fetch error:', err);
        } finally {
            setLoading(false);
        }
    }, []);

    const createRequest = useCallback(async (input: {
        venture_id: string;
        expert_id: string;
        meeting_goal?: string;
        problem_statement?: string;
        preferred_date?: string;
        preferred_time?: string;
        preferred_duration?: number;
    }): Promise<boolean> => {
        setSubmitting(true);
        try {
            const token = await getToken();
            const res = await fetch(`${API_URL}/api/meeting-requests`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify(input),
            });
            const data = await res.json();
            return data.success;
        } catch {
            return false;
        } finally {
            setSubmitting(false);
        }
    }, []);

    const acceptRequest = useCallback(async (requestId: string): Promise<boolean> => {
        setSubmitting(true);
        try {
            const token = await getToken();
            const res = await fetch(`${API_URL}/api/meeting-requests/${requestId}/accept`, {
                method: 'PUT',
                headers: { Authorization: `Bearer ${token}` },
            });
            const data = await res.json();
            if (data.success) {
                setRequests(prev => prev.map(r => r.id === requestId ? { ...r, status: 'accepted' } : r));
            }
            return data.success;
        } catch {
            return false;
        } finally {
            setSubmitting(false);
        }
    }, []);

    const declineRequest = useCallback(async (requestId: string, note?: string): Promise<boolean> => {
        setSubmitting(true);
        try {
            const token = await getToken();
            const res = await fetch(`${API_URL}/api/meeting-requests/${requestId}/decline`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify({ note }),
            });
            const data = await res.json();
            if (data.success) {
                setRequests(prev => prev.map(r => r.id === requestId ? { ...r, status: 'declined' } : r));
            }
            return data.success;
        } catch {
            return false;
        } finally {
            setSubmitting(false);
        }
    }, []);

    return { requests, loading, submitting, fetchRequests, createRequest, acceptRequest, declineRequest };
}
