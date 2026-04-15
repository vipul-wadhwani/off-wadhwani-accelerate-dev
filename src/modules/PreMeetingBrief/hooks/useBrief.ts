import { useState, useCallback } from 'react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

async function getToken() {
    const { supabase } = await import('../../../lib/supabase');
    return (await supabase.auth.getSession()).data.session?.access_token || '';
}

export function useBrief() {
    const [brief, setBrief] = useState<any>(null);
    const [loading, setLoading] = useState(false);
    const [generating, setGenerating] = useState(false);

    const fetchBrief = useCallback(async (sessionId: string, autoGenerate = false) => {
        setLoading(true);
        try {
            const token = await getToken();
            const url = autoGenerate
                ? `${API_URL}/api/briefs/${sessionId}?autoGenerate=true`
                : `${API_URL}/api/briefs/${sessionId}`;
            const res = await fetch(url, {
                headers: { Authorization: `Bearer ${token}` },
            });
            const data = await res.json();
            if (data.success && data.data) setBrief(data.data);
        } catch (err) {
            console.error('[Brief] Fetch error:', err);
        } finally {
            setLoading(false);
        }
    }, []);

    const generateBrief = useCallback(async (sessionId: string) => {
        setGenerating(true);
        try {
            const token = await getToken();
            const res = await fetch(`${API_URL}/api/briefs/generate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify({ session_id: sessionId }),
            });
            const data = await res.json();
            if (data.success && data.data) setBrief(data.data);
            return data.success;
        } catch (err) {
            console.error('[Brief] Generate error:', err);
            return false;
        } finally {
            setGenerating(false);
        }
    }, []);

    return { brief, loading, generating, fetchBrief, generateBrief };
}
