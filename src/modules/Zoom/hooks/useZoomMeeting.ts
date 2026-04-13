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
    containerId: string = 'zoomMeetingContainer',
    onTranscriptChunk?: (chunk: { speaker: string; text: string; time: string }) => void,
): UseZoomMeetingReturn {
    const [status, setStatus] = useState<ZoomStatus>('idle');
    const [error, setError] = useState<string | null>(null);
    const clientRef = useRef<any>(null);

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
            // @ts-ignore
            const ZoomMtgEmbedded = (await import(/* @vite-ignore */ '@zoom/meetingsdk/embedded')).default;

            const { signature, sdkKey } = await getSignature(params.meetingNumber, params.role || 0);

            const client = ZoomMtgEmbedded.createClient();
            clientRef.current = client;

            const container = document.getElementById(containerId);
            if (!container) throw new Error(`Container element #${containerId} not found`);

            // Conservative initial size — will be adjusted after render
            const parentEl = container.parentElement;
            const parentRect = parentEl?.getBoundingClientRect();
            const initWidth = Math.floor(parentRect?.width || window.innerWidth * 0.7);
            const initHeight = Math.floor((parentRect?.height || window.innerHeight) * 0.6);

            await client.init({
                zoomAppRoot: container,
                language: 'en-US',
                patchJsMedia: true,
                leaveOnPageUnload: true,
                customize: {
                    video: {
                        isResizable: true,
                        viewSizes: {
                            default: {
                                width: initWidth,
                                height: initHeight,
                            },
                        },
                        popper: {
                            disableDraggable: true,
                        },
                    },
                },
            });

            await client.join({
                sdkKey,
                signature,
                meetingNumber: params.meetingNumber,
                password: params.password,
                userName: params.userName,
                userEmail: params.userEmail || '',
            });

            // Listen for transcript events
            if (onTranscriptChunk) {
                client.on('caption-message', (payload: any) => {
                    onTranscriptChunk({
                        speaker: payload.displayName || 'Unknown',
                        text: payload.text || '',
                        time: new Date().toISOString(),
                    });
                });
            }

            setStatus('joined');

            // After SDK renders, dynamically resize to fit container exactly
            setTimeout(() => {
                if (!parentEl || !clientRef.current) return;
                const rect = parentEl.getBoundingClientRect();
                // Find Zoom toolbar actual height from rendered DOM
                const zoomFooter = container.querySelector('[class*="footer"]')
                    || container.querySelector('[class*="toolbar"]')
                    || container.querySelector('[class*="meeting-info-icon"]')?.closest('div');
                const toolbarH = zoomFooter?.getBoundingClientRect().height || 48;

                try {
                    clientRef.current.updateVideoOptions({
                        viewSizes: {
                            default: {
                                width: Math.floor(rect.width),
                                height: Math.floor(rect.height - toolbarH),
                            }
                        }
                    });
                    console.log(`[Zoom] Resized video to ${Math.floor(rect.width)}x${Math.floor(rect.height - toolbarH)} (toolbar: ${toolbarH}px)`);
                } catch (e) {
                    console.warn('[Zoom] updateVideoOptions failed:', e);
                }
            }, 2000);

            // Also observe container for future resizes
            const resizeObserver = new ResizeObserver((entries) => {
                const entry = entries[0];
                if (!entry || !clientRef.current) return;
                const { width, height } = entry.contentRect;
                const zf = container.querySelector('[class*="footer"]')
                    || container.querySelector('[class*="toolbar"]');
                const th = zf?.getBoundingClientRect().height || 48;
                try {
                    clientRef.current.updateVideoOptions({
                        viewSizes: {
                            default: {
                                width: Math.floor(width),
                                height: Math.floor(height - th),
                            }
                        }
                    });
                } catch { /* ignore */ }
            });
            if (parentEl) resizeObserver.observe(parentEl);

            // Auto-enable captions after a short delay for the Zoom UI to render
            setTimeout(async () => {
                try {
                    const moreBtn = document.querySelector('button[title="More"]') as HTMLElement;
                    if (moreBtn) {
                        moreBtn.click();
                        await new Promise(r => setTimeout(r, 600));
                        const captionsItem = Array.from(document.querySelectorAll('li, div, span, button')).find(
                            el => el.textContent?.trim() === 'Show Captions'
                        ) as HTMLElement;
                        if (captionsItem) {
                            captionsItem.click();
                            console.log('[Zoom] Auto-enabled captions');
                        } else {
                            // Close the menu if captions not found
                            moreBtn.click();
                        }
                    }
                } catch (e) {
                    console.warn('[Zoom] Auto-enable captions failed:', e);
                }
            }, 3000);

        } catch (err: any) {
            console.error('[Zoom] Join error:', err);
            setError(err.message || 'Failed to join meeting');
            setStatus('error');
        }
    }, [containerId, onTranscriptChunk]);

    const leave = useCallback(async () => {
        try {
            if (clientRef.current) {
                await clientRef.current.leaveMeeting();
                clientRef.current = null;
            }
            setStatus('left');
        } catch (err: any) {
            console.error('[Zoom] Leave error:', err);
        }
    }, []);

    return { status, error, join, leave };
}
