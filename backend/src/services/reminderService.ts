import cron from 'node-cron';
import { createServiceRoleClient } from '../config/supabase';
import { sendVPVMMeetingReminderEmail, sendVPVM30MinReminderEmail, sendBusinessMeetingReminderEmail, logEmailTrigger } from './emailService';

/**
 * Starts all meeting reminder schedulers.
 */
export function startMeetingReminderScheduler(): void {
    // 1-day reminder: daily at 9:00 AM IST (3:30 AM UTC)
    cron.schedule('30 3 * * *', async () => {
        console.log('[Reminder] Running daily meeting reminder check...');
        await sendTomorrowMeetingReminders();
    });

    // 30-min reminder: every 5 minutes, check for sessions starting in 25-35 min window
    cron.schedule('*/5 * * * *', async () => {
        await send30MinReminders();
    });

    console.log('[Reminder] Meeting reminder schedulers started (1-day at 9AM IST + 30-min every 5min)');
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
                .select('name, founder_name, user_id')
                .eq('id', session.venture_id)
                .single();

            if (!mentor?.email || !venture) {
                logEmailTrigger('reminder_1day.vpvm', {
                    skipped: true,
                    skipReason: !mentor?.email ? 'Mentor has no email' : 'Venture not found',
                    metadata: { session_id: session.id, venture_id: session.venture_id, mentor_id: session.mentor_id },
                });
                console.warn(`[Reminder] Skipping session ${session.id}: missing mentor email or venture data`);
                continue;
            }

            const formattedDate = new Date(session.scheduled_date).toLocaleDateString('en-IN', {
                weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
            });
            const formattedTime = session.scheduled_time?.slice(0, 5) || 'TBD';
            const frontendUrl = process.env.FRONTEND_URL || 'https://devaccelerate.wadhwaniliftoff.ai';
            const platformMeetingLink = `${frontendUrl}/meeting/${session.id}`;
            const workbenchUrl = `${frontendUrl}/vpvm/requests`;

            // 1-day reminder to VP/VM — use platform meeting link
            logEmailTrigger('reminder_1day.vpvm', {
                recipient: mentor.email,
                metadata: { session_id: session.id, venture_id: session.venture_id },
            });
            await sendVPVMMeetingReminderEmail(
                mentor.email,
                mentor.full_name || 'Venture Partner',
                venture.name,
                venture.founder_name || 'Entrepreneur',
                formattedDate,
                formattedTime,
                platformMeetingLink,
                workbenchUrl
            );
            console.log(`[Reminder] 1-day reminder sent to VP/VM ${mentor.email} for session ${session.id}`);

            // 1-day reminder to entrepreneur
            if (venture.user_id) {
                const { data: entrepreneur } = await supabase
                    .from('profiles')
                    .select('email, full_name')
                    .eq('id', venture.user_id)
                    .single();

                if (entrepreneur?.email) {
                    logEmailTrigger('reminder_1day.entrepreneur', {
                        recipient: entrepreneur.email,
                        metadata: { session_id: session.id, venture_id: session.venture_id },
                    });
                    await sendBusinessMeetingReminderEmail(
                        entrepreneur.email,
                        entrepreneur.full_name || venture.founder_name || 'Founder',
                        mentor.full_name || 'Venture Partner',
                        'Venture Partner',
                        formattedDate,
                        formattedTime,
                        session.join_url || '',
                        true // isTomorrow
                    );
                    console.log(`[Reminder] 1-day reminder sent to entrepreneur ${entrepreneur.email} for session ${session.id}`);
                } else {
                    logEmailTrigger('reminder_1day.entrepreneur', {
                        skipped: true,
                        skipReason: 'Entrepreneur profile has no email',
                        metadata: { session_id: session.id, venture_id: session.venture_id, user_id: venture.user_id },
                    });
                }
            }
        } catch (err: any) {
            console.error(`[Reminder] Failed to send reminder for session ${session.id}:`, err.message);
        }
    }

    console.log('[Reminder] Done sending reminders.');
}

/**
 * Sends 30-minute reminders for sessions starting soon.
 * Runs every 5 minutes. Checks for sessions in a 25-35 min window to avoid duplicates.
 */
const sent30MinReminders = new Set<string>();

export async function send30MinReminders(): Promise<void> {
    const supabase = createServiceRoleClient();

    // Calculate IST now
    const now = new Date();
    const istOffset = 5.5 * 60 * 60 * 1000;
    const istNow = new Date(now.getTime() + istOffset);
    const todayStr = istNow.toISOString().split('T')[0];

    // Get today's scheduled sessions
    const { data: sessions, error } = await supabase
        .from('mentor_sessions')
        .select('id, topic, scheduled_date, scheduled_time, join_url, venture_id, mentor_id')
        .eq('status', 'scheduled')
        .eq('scheduled_date', todayStr);

    if (error || !sessions || sessions.length === 0) return;

    for (const session of sessions) {
        // Skip if already sent
        if (sent30MinReminders.has(session.id)) continue;

        // Parse session time and check if it's 25-35 min from now
        const [hours, minutes] = (session.scheduled_time || '').split(':').map(Number);
        if (isNaN(hours) || isNaN(minutes)) continue;

        const sessionTime = new Date(istNow);
        sessionTime.setHours(hours, minutes, 0, 0);

        const diffMs = sessionTime.getTime() - istNow.getTime();
        const diffMin = diffMs / (1000 * 60);

        if (diffMin < 25 || diffMin > 35) continue;

        // Within 30-min window — send reminder
        try {
            const { data: mentor } = await supabase
                .from('profiles')
                .select('email, full_name')
                .eq('id', session.mentor_id)
                .single();

            const { data: venture } = await supabase
                .from('ventures')
                .select('name, founder_name, user_id')
                .eq('id', session.venture_id)
                .single();

            if (!mentor?.email || !venture) {
                logEmailTrigger('reminder_30min.vpvm', {
                    skipped: true,
                    skipReason: !mentor?.email ? 'Mentor has no email' : 'Venture not found',
                    metadata: { session_id: session.id, venture_id: session.venture_id, mentor_id: session.mentor_id },
                });
                continue;
            }

            const formattedDate = new Date(session.scheduled_date).toLocaleDateString('en-IN', {
                weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
            });
            const formattedTime = session.scheduled_time?.slice(0, 5) || 'TBD';
            const frontendUrl = process.env.FRONTEND_URL || 'https://devaccelerate.wadhwaniliftoff.ai';
            const platformMeetingLink = `${frontendUrl}/meeting/${session.id}`;
            const workbenchUrl = `${frontendUrl}/vpvm/requests`;

            // 30-min reminder to VP/VM — use platform meeting link
            logEmailTrigger('reminder_30min.vpvm', {
                recipient: mentor.email,
                metadata: { session_id: session.id, venture_id: session.venture_id },
            });
            await sendVPVM30MinReminderEmail(
                mentor.email,
                mentor.full_name || 'Venture Partner',
                venture.name,
                venture.founder_name || 'Entrepreneur',
                formattedDate,
                formattedTime,
                platformMeetingLink,
                workbenchUrl
            );
            console.log(`[Reminder] 30-min reminder sent to VP/VM ${mentor.email} for session ${session.id}`);

            // 30-min reminder to entrepreneur
            if (venture.user_id) {
                const { data: entrepreneur } = await supabase
                    .from('profiles')
                    .select('email, full_name')
                    .eq('id', venture.user_id)
                    .single();

                if (entrepreneur?.email) {
                    logEmailTrigger('reminder_30min.entrepreneur', {
                        recipient: entrepreneur.email,
                        metadata: { session_id: session.id, venture_id: session.venture_id },
                    });
                    await sendBusinessMeetingReminderEmail(
                        entrepreneur.email,
                        entrepreneur.full_name || venture.founder_name || 'Founder',
                        mentor.full_name || 'Venture Partner',
                        'Venture Partner',
                        formattedDate,
                        formattedTime,
                        session.join_url || '',
                        false // is30Min
                    );
                    console.log(`[Reminder] 30-min reminder sent to entrepreneur ${entrepreneur.email} for session ${session.id}`);
                } else {
                    logEmailTrigger('reminder_30min.entrepreneur', {
                        skipped: true,
                        skipReason: 'Entrepreneur profile has no email',
                        metadata: { session_id: session.id, venture_id: session.venture_id, user_id: venture.user_id },
                    });
                }
            }

            sent30MinReminders.add(session.id);
        } catch (err: any) {
            console.error(`[Reminder] Failed to send 30-min reminder for session ${session.id}:`, err.message);
        }
    }
}
