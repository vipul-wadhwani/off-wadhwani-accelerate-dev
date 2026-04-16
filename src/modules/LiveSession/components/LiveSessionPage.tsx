import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ZoomMeetingRoom } from '../../Zoom';
import type { ZoomMeetingRoomHandle } from '../../Zoom';
import { RightPanel } from './RightPanel';
import { useAuth } from '../../../context/AuthContext';
import { Loader2, Video, AlertCircle } from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

interface SessionInfo {
    sessionId: string;
    meetingId: string;
    zoomMeetingId: number;
    zoomPassword: string;
    joinUrl: string;
    topic: string;
    status: string;
    mentorId: string;
    ventureId: string;
}

export const LiveSessionPage: React.FC = () => {
    const { sessionId } = useParams<{ sessionId: string }>();
    const navigate = useNavigate();
    const { user } = useAuth();

    const [session, setSession] = useState<SessionInfo | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [meetingEnded, setMeetingEnded] = useState(false);
    const [transcriptChunks, setTranscriptChunks] = useState<Array<{ speaker: string; text: string; time: string }>>([]);
    const [zoomStatus, setZoomStatus] = useState<string>('idle');
    const pendingChunksRef = useRef<Array<{ speaker: string; text: string; time: string }>>([]);
    const zoomRef = useRef<ZoomMeetingRoomHandle>(null);
    const hasJoined = zoomStatus === 'joined';

    // Toggle body class for CSS to resize #zmmtg-root when joined
    useEffect(() => {
        if (hasJoined) {
            document.body.classList.add('zoom-joined');
        } else {
            document.body.classList.remove('zoom-joined');
        }
        return () => { document.body.classList.remove('zoom-joined'); };
    }, [hasJoined]);

    // Determine user's role in the meeting
    const userRole = user?.user_metadata?.role;
    const isMentor = session?.mentorId === user?.id;
    const zoomRole = isMentor ? 1 : 0; // 1=host, 0=participant
    const showRightPanel = true; // All roles see the panel (entrepreneurs get Transcript + AI Insights only)

    // Auto-save transcript every 30 seconds
    useEffect(() => {
        if (!sessionId) return;
        const interval = setInterval(async () => {
            if (pendingChunksRef.current.length === 0) return;
            const chunksToSave = [...pendingChunksRef.current];
            pendingChunksRef.current = [];
            try {
                const { supabase } = await import('../../../lib/supabase');
                const token = (await supabase.auth.getSession()).data.session?.access_token;
                await fetch(`${API_URL}/api/sessions/${sessionId}/transcript`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                    body: JSON.stringify({ chunks: chunksToSave }),
                });
            } catch { /* ignore */ }
        }, 30000);
        return () => clearInterval(interval);
    }, [sessionId]);

    useEffect(() => {
        const fetchSession = async () => {
            if (!sessionId) return;
            try {
                const { supabase } = await import('../../../lib/supabase');
                const token = (await supabase.auth.getSession()).data.session?.access_token;
                const res = await fetch(`${API_URL}/api/zoom/meeting/${sessionId}`, {
                    headers: { Authorization: `Bearer ${token}` },
                });
                const data = await res.json();
                if (data.success) {
                    setSession(data.data);
                } else {
                    setError(data.message || 'Session not found');
                }
            } catch (err: any) {
                setError('Failed to load session details');
            } finally {
                setLoading(false);
            }
        };
        fetchSession();

        // Load previously saved transcript chunks
        const loadTranscript = async () => {
            if (!sessionId) return;
            try {
                const { supabase } = await import('../../../lib/supabase');
                const token = (await supabase.auth.getSession()).data.session?.access_token;
                const res = await fetch(`${API_URL}/api/sessions/${sessionId}/transcript`, {
                    headers: { Authorization: `Bearer ${token}` },
                });
                const data = await res.json();
                if (data.success && data.data?.chunks?.length > 0) {
                    setTranscriptChunks(data.data.chunks);
                }
            } catch { /* ignore */ }
        };
        loadTranscript();

        // For non-host (participants/entrepreneurs): poll for transcript updates every 15s
        // since they don't receive Zoom SDK caption events directly.
        // Host should NOT poll — they get live Zoom SDK caption events and save to DB.
        const pollInterval = setInterval(async () => {
            if (!sessionId) return;
            try {
                const { supabase } = await import('../../../lib/supabase');
                const token = (await supabase.auth.getSession()).data.session?.access_token;
                const res = await fetch(`${API_URL}/api/sessions/${sessionId}/transcript`, {
                    headers: { Authorization: `Bearer ${token}` },
                });
                const data = await res.json();
                if (data.success && data.data?.chunks?.length > 0) {
                    setTranscriptChunks(prev => {
                        const incoming: Array<{ speaker: string; text: string; time: string }> = data.data.chunks;
                        // Dedup: build set of existing speaker+text keys
                        const existingKeys = new Set(prev.map(c => `${c.speaker}|||${c.text}`));
                        const newChunks = incoming.filter(c => !existingKeys.has(`${c.speaker}|||${c.text}`));
                        if (newChunks.length === 0) return prev;
                        return [...prev, ...newChunks];
                    });
                }
            } catch { /* ignore */ }
        }, 15000);

        return () => clearInterval(pollInterval);
    }, [sessionId]);

    const handleMeetingEnd = useCallback(async () => {
        // Leave the Zoom meeting first
        try { await zoomRef.current?.leave(); } catch { /* ignore */ }

        // Save any remaining transcript chunks
        if (pendingChunksRef.current.length > 0 && sessionId) {
            try {
                const { supabase } = await import('../../../lib/supabase');
                const token = (await supabase.auth.getSession()).data.session?.access_token;
                await fetch(`${API_URL}/api/sessions/${sessionId}/transcript`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                    body: JSON.stringify({ chunks: pendingChunksRef.current }),
                });
                pendingChunksRef.current = [];
            } catch { /* ignore */ }
        }
        // End session — generate summary
        if (sessionId) {
            try {
                const { supabase } = await import('../../../lib/supabase');
                const token = (await supabase.auth.getSession()).data.session?.access_token;
                await fetch(`${API_URL}/api/sessions/${sessionId}/end`, {
                    method: 'POST',
                    headers: { Authorization: `Bearer ${token}` },
                });
            } catch { /* ignore */ }
        }
        setMeetingEnded(true);
    }, [sessionId]);

    const handleTranscriptChunk = useCallback((chunk: { speaker: string; text: string; time: string }) => {
        // Zoom SDK sends progressive updates per speaker — each event builds up the sentence.
        // Speakers alternate, so we need to find the LAST chunk from the SAME speaker, not just the last chunk overall.
        const isProgressive = (prev: string, next: string) => {
            if (!prev || !next) return false;
            if (next.startsWith(prev) || prev.startsWith(next)) return true;
            // Share common prefix (at least 5 chars)
            let common = 0;
            const minLen = Math.min(prev.length, next.length);
            while (common < minLen && prev[common] === next[common]) common++;
            return common >= 5;
        };

        setTranscriptChunks(prev => {
            // Find the last chunk from the same speaker
            for (let i = prev.length - 1; i >= Math.max(0, prev.length - 10); i--) {
                if (prev[i].speaker === chunk.speaker) {
                    if (isProgressive(prev[i].text, chunk.text)) {
                        // Replace that chunk with the updated version
                        const updated = [...prev];
                        updated[i] = chunk;
                        return updated;
                    }
                    break; // Found last same-speaker chunk but it's not progressive — new sentence
                }
            }
            return [...prev, chunk];
        });

        // For saving: find last from same speaker in pending
        const pending = pendingChunksRef.current;
        for (let i = pending.length - 1; i >= Math.max(0, pending.length - 10); i--) {
            if (pending[i].speaker === chunk.speaker) {
                if (isProgressive(pending[i].text, chunk.text)) {
                    pending[i] = chunk;
                    return;
                }
                break;
            }
        }
        pending.push(chunk);
    }, []);

    const goBack = async () => {
        // Leave Zoom and clean up SDK DOM elements
        try { await zoomRef.current?.leave(); } catch { /* ignore */ }
        const zmmtgRoot = document.getElementById('zmmtg-root');
        if (zmmtgRoot) zmmtgRoot.style.display = 'none';

        const role = user?.user_metadata?.role;
        if (role === 'mentor') navigate('/expert/dashboard');
        else if (role === 'entrepreneur') navigate('/dashboard');
        else navigate('/vpvm/requests');
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-900 flex items-center justify-center">
                <div className="text-center">
                    <Loader2 className="w-10 h-10 animate-spin text-teal-400 mx-auto mb-3" />
                    <span className="text-gray-300 text-sm">Loading meeting...</span>
                </div>
            </div>
        );
    }

    if (error || !session) {
        return (
            <div className="min-h-screen bg-gray-900 flex items-center justify-center">
                <div className="text-center">
                    <AlertCircle className="w-10 h-10 text-red-400 mx-auto mb-3" />
                    <span className="text-white text-sm mb-2 block">{error || 'Session not found'}</span>
                    <button onClick={goBack} className="mt-4 px-4 py-2 bg-teal-600 text-white text-sm rounded-lg hover:bg-teal-700">
                        Go Back
                    </button>
                </div>
            </div>
        );
    }

    if (!session.zoomMeetingId || !session.zoomPassword) {
        return (
            <div className="min-h-screen bg-gray-900 flex items-center justify-center">
                <div className="text-center max-w-md">
                    <Video className="w-10 h-10 text-yellow-400 mx-auto mb-3" />
                    <span className="text-white text-sm block mb-2">Embedded Zoom not available for this session</span>
                    <p className="text-gray-400 text-xs mb-4">This session was created before embedded Zoom was enabled. You can still join via the external link.</p>
                    {session.joinUrl && (
                        <a href={session.joinUrl} target="_blank" rel="noopener noreferrer"
                            className="inline-flex items-center gap-2 px-4 py-2 bg-teal-600 text-white text-sm rounded-lg hover:bg-teal-700">
                            <Video className="w-4 h-4" /> Join via Zoom
                        </a>
                    )}
                    <button onClick={goBack} className="block mx-auto mt-3 text-gray-400 text-sm hover:text-white">
                        Go Back
                    </button>
                </div>
            </div>
        );
    }

    if (meetingEnded) {
        return (
            <div className="min-h-screen bg-gray-900 flex items-center justify-center">
                <div className="text-center">
                    <Video className="w-10 h-10 text-teal-400 mx-auto mb-3" />
                    <span className="text-white text-lg font-semibold block mb-1">Meeting Ended</span>
                    <span className="text-gray-400 text-sm block mb-4">{session.topic}</span>
                    {/* Phase 3 will add: post-meeting summary view here */}
                    <button onClick={goBack} className="px-4 py-2 bg-teal-600 text-white text-sm rounded-lg hover:bg-teal-700">
                        Return to Dashboard
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="h-screen bg-gray-50 flex flex-col overflow-hidden">
            {/* Header — above Zoom SDK */}
            <div className="live-session-header flex items-center justify-between px-4 py-3 bg-white border-b border-gray-200 shadow-sm">
                <div className="flex items-center gap-3">
                    <div>
                        <h1 className="text-gray-900 text-sm font-semibold">{session.topic || 'Expert Session'}</h1>
                        <span className="text-gray-500 text-xs">
                            {isMentor ? 'You are the host' : 'You are a participant'}
                        </span>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    {hasJoined && (
                        <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 rounded text-xs font-medium">
                            <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" />
                            Live
                        </span>
                    )}
                    {hasJoined && (isMentor || userRole === 'venture_mgr') && (
                        <button
                            onClick={handleMeetingEnd}
                            className="px-3 py-1.5 text-xs font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors"
                        >
                            End Session
                        </button>
                    )}
                </div>
            </div>

            {/* Meeting area with right panel */}
            <div className="flex-1 flex min-h-0">
                {/* Zoom SDK renders to #zmmtg-root (fixed position on body) — this div is a spacer */}
                <div className={`flex-1 relative ${hasJoined ? '' : 'bg-white'}`}>
                    <ZoomMeetingRoom
                        ref={zoomRef}
                        meetingNumber={String(session.zoomMeetingId)}
                        password={session.zoomPassword}
                        userName={user?.user_metadata?.full_name || user?.email || 'Participant'}
                        userEmail={user?.email}
                        role={zoomRole}
                        onMeetingEnd={handleMeetingEnd}
                        onStatusChange={setZoomStatus}
                        onTranscriptChunk={handleTranscriptChunk}
                    />
                </div>
                {showRightPanel && hasJoined && (
                    <div className="relative z-[10001]">
                        <RightPanel
                            sessionId={session.sessionId}
                            ventureId={session.ventureId}
                            ventureName={session.topic?.replace('VP/VM Session: ', '').replace('Expert Session: ', '')}
                            transcriptChunks={transcriptChunks}
                            topic={session.topic}
                            userRole={userRole}
                        />
                    </div>
                )}
            </div>
        </div>
    );
};
