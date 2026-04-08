import crypto from 'crypto';

/**
 * Generates a Zoom Meeting SDK signature (JWT) for joining meetings embedded in the browser.
 * Uses ZOOM_SDK_KEY / ZOOM_SDK_SECRET — separate from S2S OAuth (which creates meetings).
 */

export function isZoomSdkConfigured(): boolean {
    return !!(process.env.ZOOM_SDK_KEY && process.env.ZOOM_SDK_SECRET);
}

export function generateSdkSignature(meetingNumber: string, role: number): string {
    const sdkKey = process.env.ZOOM_SDK_KEY!;
    const sdkSecret = process.env.ZOOM_SDK_SECRET!;
    const iat = Math.round(Date.now() / 1000) - 30;
    const exp = iat + 60 * 60 * 2; // 2 hours

    const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
    const payload = Buffer.from(JSON.stringify({
        sdkKey,
        mn: meetingNumber,
        role,
        iat,
        exp,
        tokenExp: exp,
    })).toString('base64url');

    const message = `${header}.${payload}`;
    const signature = crypto
        .createHmac('sha256', sdkSecret)
        .update(message)
        .digest('base64url');

    return `${message}.${signature}`;
}
