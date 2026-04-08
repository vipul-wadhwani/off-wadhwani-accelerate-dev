import { useState, useCallback } from 'react';
import type { MatchedExpert, Expert } from '../types';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

async function getToken() {
    const { supabase } = await import('../../../lib/supabase');
    return (await supabase.auth.getSession()).data.session?.access_token || '';
}

export function useExpertMatch() {
    const [matches, setMatches] = useState<MatchedExpert[]>([]);
    const [allExperts, setAllExperts] = useState<Expert[]>([]);
    const [loading, setLoading] = useState(false);
    const [searching, setSearching] = useState(false);

    const findMatches = useCallback(async (ventureId: string, count?: number) => {
        setLoading(true);
        try {
            const token = await getToken();
            const res = await fetch(`${API_URL}/api/matching/find`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify({ venture_id: ventureId, count: count || 5 }),
            });
            const data = await res.json();
            if (data.success) setMatches(data.data || []);
        } catch (err) {
            console.error('[ExpertMatch] Error:', err);
        } finally {
            setLoading(false);
        }
    }, []);

    const searchExperts = useCallback(async (filters?: { search?: string; sector?: string; expertise?: string }) => {
        setSearching(true);
        try {
            const token = await getToken();
            const params = new URLSearchParams();
            if (filters?.search) params.set('search', filters.search);
            if (filters?.sector) params.set('sector', filters.sector);
            if (filters?.expertise) params.set('expertise', filters.expertise);

            const res = await fetch(`${API_URL}/api/matching/experts?${params}`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            const data = await res.json();
            if (data.success) setAllExperts(data.data || []);
        } catch (err) {
            console.error('[ExpertMatch] Search error:', err);
        } finally {
            setSearching(false);
        }
    }, []);

    return { matches, allExperts, loading, searching, findMatches, searchExperts };
}
