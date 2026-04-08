import { useState, useEffect, useCallback } from 'react';
import type { AvailabilitySlot } from '../types';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

async function getToken() {
    const { supabase } = await import('../../../lib/supabase');
    return (await supabase.auth.getSession()).data.session?.access_token || '';
}

export function useAvailability(expertId?: string) {
    const [slots, setSlots] = useState<AvailabilitySlot[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    const fetchSlots = useCallback(async () => {
        if (!expertId) return;
        setLoading(true);
        try {
            const token = await getToken();
            const res = await fetch(`${API_URL}/api/availability/${expertId}`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            const data = await res.json();
            if (data.success) setSlots(data.data || []);
        } catch (err) {
            console.error('[Availability] Fetch error:', err);
        } finally {
            setLoading(false);
        }
    }, [expertId]);

    useEffect(() => { fetchSlots(); }, [fetchSlots]);

    const saveSlots = useCallback(async (newSlots: AvailabilitySlot[]) => {
        setSaving(true);
        try {
            const token = await getToken();
            const res = await fetch(`${API_URL}/api/availability`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify({ slots: newSlots }),
            });
            const data = await res.json();
            if (data.success) {
                setSlots(newSlots);
                return true;
            }
            return false;
        } catch (err) {
            console.error('[Availability] Save error:', err);
            return false;
        } finally {
            setSaving(false);
        }
    }, []);

    const fetchAvailableSlots = useCallback(async (eId: string, date: string) => {
        try {
            const token = await getToken();
            const res = await fetch(`${API_URL}/api/availability/${eId}/slots?date=${date}`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            const data = await res.json();
            return data.success ? (data.data as AvailabilitySlot[]) : [];
        } catch {
            return [];
        }
    }, []);

    return { slots, loading, saving, saveSlots, fetchSlots, fetchAvailableSlots };
}
