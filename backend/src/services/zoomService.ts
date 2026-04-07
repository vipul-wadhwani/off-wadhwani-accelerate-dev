/**
 * Zoom Server-to-Server OAuth integration.
 * Generates Zoom meeting links via the Zoom API.
 * Returns null on any failure so callers can fall back to Jitsi.
 */

const ZOOM_TOKEN_URL = 'https://zoom.us/oauth/token';
const ZOOM_API_BASE = 'https://api.zoom.us/v2';

let cachedToken: { token: string; expiresAt: number } | null = null;

export function isZoomConfigured(): boolean {
    const { ZOOM_ACCOUNT_ID, ZOOM_CLIENT_ID, ZOOM_CLIENT_SECRET } = process.env;
    return !!(ZOOM_ACCOUNT_ID && ZOOM_CLIENT_ID && ZOOM_CLIENT_SECRET);
}

async function getAccessToken(): Promise<string | null> {
    if (cachedToken && Date.now() < cachedToken.expiresAt) {
        return cachedToken.token;
    }

    const { ZOOM_ACCOUNT_ID, ZOOM_CLIENT_ID, ZOOM_CLIENT_SECRET } = process.env;
    const credentials = Buffer.from(`${ZOOM_CLIENT_ID}:${ZOOM_CLIENT_SECRET}`).toString('base64');

    try {
        const res = await fetch(ZOOM_TOKEN_URL, {
            method: 'POST',
            headers: {
                Authorization: `Basic ${credentials}`,
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: `grant_type=account_credentials&account_id=${ZOOM_ACCOUNT_ID}`,
        });

        if (!res.ok) {
            console.warn(`[Zoom] Token request failed: ${res.status} ${res.statusText}`);
            return null;
        }

        const data = await res.json() as { access_token: string; expires_in: number };
        cachedToken = {
            token: data.access_token,
            expiresAt: Date.now() + (data.expires_in - 60) * 1000, // refresh 60s early
        };
        return cachedToken.token;
    } catch (err) {
        console.warn('[Zoom] Token request error:', err);
        return null;
    }
}

export async function generateMeetingLink(
    topic: string,
    durationMinutes: number,
    startTime?: string,
): Promise<string | null> {
    const token = await getAccessToken();
    if (!token) return null;

    try {
        const body: Record<string, unknown> = {
            topic,
            type: 2, // scheduled meeting
            duration: durationMinutes,
            settings: {
                join_before_host: true,
                waiting_room: false,
            },
        };
        if (startTime) {
            // Zoom requires ISO 8601 format: 2026-04-08T10:00:00Z
            const dt = new Date(startTime);
            body.start_time = isNaN(dt.getTime()) ? undefined : dt.toISOString();
        }

        const res = await fetch(`${ZOOM_API_BASE}/users/me/meetings`, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(body),
        });

        if (!res.ok) {
            const errBody = await res.text();
            console.warn(`[Zoom] Create meeting failed: ${res.status} ${res.statusText}`, errBody);
            return null;
        }

        const data = await res.json() as { join_url: string };
        console.log(`[Zoom] Meeting created: ${data.join_url}`);
        return data.join_url;
    } catch (err) {
        console.warn('[Zoom] Create meeting error:', err);
        return null;
    }
}
