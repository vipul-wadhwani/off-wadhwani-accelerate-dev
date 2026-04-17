import { useState, useCallback, useRef } from 'react';
import type { ZoomSignatureResponse } from '../types';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

type ZoomStatus = 'idle' | 'loading' | 'joined' | 'error' | 'left';

interface UseZoomMeetingReturn {
    status: ZoomStatus;
    error: string | null;
    join: (params: {
        meetingNumber: string;
        password: string;
        userName: string;
        userEmail?: string;
        role?: number;
    }) => Promise<void>;
    leave: () => Promise<void>;
}

export function useZoomMeeting(
    _containerId?: string,
    onTranscriptChunk?: (chunk: { speaker: string; text: string; time: string }) => void,
): UseZoomMeetingReturn {
    const [status, setStatus] = useState<ZoomStatus>('idle');
    const [error, setError] = useState<string | null>(null);
    const zoomRef = useRef<any>(null);

    const getSignature = async (meetingNumber: string, role: number): Promise<ZoomSignatureResponse> => {
        const token = (await (await import('../../../lib/supabase')).supabase.auth.getSession()).data.session?.access_token;
        const res = await fetch(`${API_URL}/api/zoom/signature`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ meetingNumber, role }),
        });
        const data = await res.json();
        if (!data.success) throw new Error(data.message || 'Failed to get signature');
        return { signature: data.signature, sdkKey: data.sdkKey };
    };

    const join = useCallback(async (params: {
        meetingNumber: string;
        password: string;
        userName: string;
        userEmail?: string;
        role?: number;
    }) => {
        setStatus('loading');
        setError(null);

        try {
            // @ts-ignore — no type declarations
            const { ZoomMtg } = await import('@zoom/meetingsdk');
            zoomRef.current = ZoomMtg;

            ZoomMtg.preLoadWasm();
            ZoomMtg.prepareWebSDK();

            // Set up transcript listener before joining
            if (onTranscriptChunk) {
                try {
                    ZoomMtg.inMeetingServiceListener('onReceiveTranscriptionMsg', (data: any) => {
                        if (!data?.text?.trim()) return;
                        onTranscriptChunk({
                            speaker: data.displayName || 'Unknown',
                            text: data.text,
                            time: new Date().toISOString(),
                        });
                    });
                } catch (e) {
                    console.warn('[Zoom] Transcript listener setup error:', e);
                }
            }

            const { signature, sdkKey } = await getSignature(params.meetingNumber, params.role || 0);

            await new Promise<void>((resolve, reject) => {
                ZoomMtg.init({
                    leaveUrl: window.location.href,
                    patchJsMedia: true,
                    leaveOnPageUnload: true,
                    success: () => {
                        ZoomMtg.join({
                            signature,
                            sdkKey,
                            meetingNumber: params.meetingNumber,
                            userName: params.userName,
                            userEmail: params.userEmail || '',
                            passWord: params.password,
                            success: () => {
                                setStatus('joined');
                                resolve();
                            },
                            error: (err: any) => {
                                console.error('[Zoom] Join error:', err);
                                setError(err?.reason || err?.errorMessage || JSON.stringify(err));
                                setStatus('error');
                                reject(err);
                            },
                        });
                    },
                    error: (err: any) => {
                        console.error('[Zoom] Init error:', err);
                        setError(err?.reason || err?.errorMessage || JSON.stringify(err));
                        setStatus('error');
                        reject(err);
                    },
                });
            });

            // Fallback: if still loading after 10s, assume joined
            setTimeout(() => setStatus(prev => prev === 'loading' ? 'joined' : prev), 10000);

        } catch (err: any) {
            console.error('[Zoom] Join error:', err);
            setError(err.message || 'Failed to join meeting');
            setStatus('error');
        }
    }, [onTranscriptChunk]);

    const leave = useCallback(async () => {
        try {
            if (zoomRef.current) {
                zoomRef.current.leaveMeeting({});
                zoomRef.current = null;
            }
            setStatus('left');
        } catch (err: any) {
            console.error('[Zoom] Leave error:', err);
        }
    }, []);

    return { status, error, join, leave };
}
