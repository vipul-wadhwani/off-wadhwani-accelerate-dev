import cron from 'node-cron';
import { createServiceRoleClient } from '../config/supabase';
import { sendVPVMMeetingReminderEmail } from './emailService';

/**
 * Sends meeting reminders to VP/VMs for sessions scheduled tomorrow.
 * Runs daily at 9:00 AM IST (3:30 AM UTC).
 */
export function startMeetingReminderScheduler(): void {
    // Run daily at 9:00 AM IST (3:30 AM UTC)
    cron.schedule('30 3 * * *', async () => {
        console.log('[Reminder] Running daily meeting reminder check...');
        await sendTomorrowMeetingReminders();
    });

    console.log('[Reminder] Meeting reminder scheduler started (daily at 9:00 AM IST)');
}

export async function sendTomorrowMeetingReminders(): Promise<void> {
    const supabase = createServiceRoleClient();

    // Calculate tomorrow's date in IST
    const now = new Date();
    const istOffset = 5.5 * 60 * 60 * 1000;
    const istNow = new Date(now.getTime() + istOffset);
    const tomorrow = new Date(istNow);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split('T')[0];

    console.log(`[Reminder] Checking for sessions scheduled on ${tomorrowStr}...`);

    // Get all scheduled sessions for tomorrow
    const { data: sessions, error } = await supabase
        .from('mentor_sessions')
        .select('id, topic, scheduled_date, scheduled_time, join_url, venture_id, mentor_id')
        .eq('status', 'scheduled')
        .eq('scheduled_date', tomorrowStr);

    if (error) {
        console.error('[Reminder] Error fetching sessions:', error.message);
        return;
    }

    if (!sessions || sessions.length === 0) {
        console.log('[Reminder] No sessions scheduled for tomorrow.');
        return;
    }

    console.log(`[Reminder] Found ${sessions.length} session(s) for tomorrow.`);

    for (const session of sessions) {
        try {
            // Get VP/VM (mentor) details
            const { data: mentor } = await supabase
                .from('profiles')
                .select('email, full_name')
                .eq('id', session.mentor_id)
                .single();

            // Get venture details
            const { data: venture } = await supabase
                .from('ventures')
                .select('name, founder_name')
                .eq('id', session.venture_id)
                .single();

            if (!mentor?.email || !venture) {
                console.warn(`[Reminder] Skipping session ${session.id}: missing mentor email or venture data`);
                continue;
            }

            const formattedDate = new Date(session.scheduled_date).toLocaleDateString('en-IN', {
                weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
            });
            const formattedTime = session.scheduled_time?.slice(0, 5) || 'TBD';
            const workbenchUrl = `${process.env.FRONTEND_URL || 'https://devaccelerate.wadhwaniliftoff.ai'}/vpvm/requests`;

            await sendVPVMMeetingReminderEmail(
                mentor.email,
                mentor.full_name || 'Venture Partner',
                venture.name,
                venture.founder_name || 'Entrepreneur',
                formattedDate,
                formattedTime,
                session.join_url || workbenchUrl,
                workbenchUrl
            );

            console.log(`[Reminder] Reminder sent to ${mentor.email} for session ${session.id}`);
        } catch (err: any) {
            console.error(`[Reminder] Failed to send reminder for session ${session.id}:`, err.message);
        }
    }

    console.log('[Reminder] Done sending reminders.');
}
