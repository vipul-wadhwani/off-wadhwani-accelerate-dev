import { createServiceRoleClient } from '../../config/supabase';

export interface AvailabilitySlot {
    id?: string;
    day_of_week: number;
    start_time: string;
    end_time: string;
    is_recurring: boolean;
    specific_date?: string | null;
    is_blocked: boolean;
}

/**
 * Get all availability slots for an expert.
 */
export async function getAvailability(expertId: string): Promise<AvailabilitySlot[]> {
    const supabase = createServiceRoleClient();
    const { data, error } = await supabase
        .from('expert_availability')
        .select('*')
        .eq('expert_id', expertId)
        .order('day_of_week')
        .order('start_time');

    if (error) {
        console.error('[Availability] Fetch error:', error);
        throw new Error('Failed to fetch availability');
    }
    return data || [];
}

/**
 * Replace all recurring slots for an expert (bulk save from the grid).
 */
export async function saveAvailability(expertId: string, slots: AvailabilitySlot[]): Promise<void> {
    const supabase = createServiceRoleClient();

    // Delete existing recurring slots
    const { error: deleteError } = await supabase
        .from('expert_availability')
        .delete()
        .eq('expert_id', expertId)
        .eq('is_recurring', true)
        .is('specific_date', null);

    if (deleteError) {
        console.error('[Availability] Delete error:', deleteError);
        throw new Error('Failed to clear existing availability');
    }

    if (slots.length === 0) return;

    // Insert new slots
    const rows = slots.map(s => ({
        expert_id: expertId,
        day_of_week: s.day_of_week,
        start_time: s.start_time,
        end_time: s.end_time,
        is_recurring: true,
        specific_date: null,
        is_blocked: false,
    }));

    const { error: insertError } = await supabase
        .from('expert_availability')
        .insert(rows);

    if (insertError) {
        console.error('[Availability] Insert error:', insertError);
        throw new Error('Failed to save availability');
    }
}

/**
 * Get available (unbooked) slots for an expert on a specific date.
 */
export async function getAvailableSlots(expertId: string, date: string): Promise<AvailabilitySlot[]> {
    const supabase = createServiceRoleClient();
    const dayOfWeek = new Date(date).getDay();

    // Get recurring slots for this day of week
    const { data: recurringSlots } = await supabase
        .from('expert_availability')
        .select('*')
        .eq('expert_id', expertId)
        .eq('day_of_week', dayOfWeek)
        .eq('is_recurring', true)
        .is('specific_date', null);

    // Get blocked slots for this specific date
    const { data: blockedSlots } = await supabase
        .from('expert_availability')
        .select('start_time')
        .eq('expert_id', expertId)
        .eq('specific_date', date)
        .eq('is_blocked', true);

    const blockedTimes = new Set((blockedSlots || []).map(s => s.start_time));

    // Get booked sessions for this date
    const { data: bookedSessions } = await supabase
        .from('mentor_sessions')
        .select('scheduled_time')
        .eq('mentor_id', expertId)
        .eq('scheduled_date', date)
        .in('status', ['scheduled', 'active']);

    const bookedTimes = new Set((bookedSessions || []).map(s => s.scheduled_time));

    // Filter out blocked and booked slots
    return (recurringSlots || []).filter(slot =>
        !blockedTimes.has(slot.start_time) && !bookedTimes.has(slot.start_time)
    );
}
