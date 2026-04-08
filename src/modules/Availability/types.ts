export interface AvailabilitySlot {
    id?: string;
    day_of_week: number;
    start_time: string; // HH:MM
    end_time: string;
    is_recurring: boolean;
    specific_date?: string | null;
    is_blocked: boolean;
}

export const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;
export const WEEKDAYS = [1, 2, 3, 4, 5] as const; // Mon-Fri

export const TIME_SLOTS = [
    { label: '9:00 AM', value: '09:00', end: '10:00' },
    { label: '10:00 AM', value: '10:00', end: '11:00' },
    { label: '11:00 AM', value: '11:00', end: '12:00' },
    { label: '12:00 PM', value: '12:00', end: '13:00' },
    { label: '2:00 PM', value: '14:00', end: '15:00' },
    { label: '3:00 PM', value: '15:00', end: '16:00' },
    { label: '4:00 PM', value: '16:00', end: '17:00' },
    { label: '5:00 PM', value: '17:00', end: '18:00' },
] as const;
