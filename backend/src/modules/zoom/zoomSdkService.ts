// @ts-ignore — no type declarations for jsonwebtoken
import jwt from 'jsonwebtoken';

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

    const payload = {
        appKey: sdkKey,
        sdkKey,
        mn: meetingNumber,
        role: Number(role),
        iat,
        exp,
        tokenExp: exp,
    };

    const signature = jwt.sign(payload, sdkSecret, {
        algorithm: 'HS256',
        header: { alg: 'HS256', typ: 'JWT' },
    });

    return signature;
}
