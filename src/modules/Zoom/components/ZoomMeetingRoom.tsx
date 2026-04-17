import { useEffect, useImperativeHandle, forwardRef } from 'react';
import { useZoomMeeting } from '../hooks/useZoomMeeting';
import { AlertCircle, VideoOff } from 'lucide-react';

interface ZoomMeetingRoomProps {
    meetingNumber: string;
    password: string;
    userName: string;
    userEmail?: string;
    role?: number;
    onMeetingEnd?: () => void;
    onStatusChange?: (status: string) => void;
    onTranscriptChunk?: (chunk: { speaker: string; text: string; time: string }) => void;
}

export interface ZoomMeetingRoomHandle {
    leave: () => Promise<void>;
}

export const ZoomMeetingRoom = forwardRef<ZoomMeetingRoomHandle, ZoomMeetingRoomProps>(({
    meetingNumber,
    password,
    userName,
    userEmail,
    role = 0,
    onMeetingEnd,
    onStatusChange,
    onTranscriptChunk,
}, ref) => {
    const { status, error, join, leave } = useZoomMeeting(undefined, onTranscriptChunk);

    useImperativeHandle(ref, () => ({ leave }), [leave]);

    useEffect(() => {
        if (meetingNumber && password && userName) {
            join({ meetingNumber, password, userName, userEmail, role });
        }
        return () => {
            leave();
        };
    }, [meetingNumber, password, userName]);

    useEffect(() => {
        onStatusChange?.(status);
        if (status === 'left' && onMeetingEnd) {
            onMeetingEnd();
        }
    }, [status, onMeetingEnd, onStatusChange]);

    // Full-page Zoom SDK renders to #zmmtg-root on the body — no container div needed.
    // We only render overlays for error/left states. Pre-join is handled by Zoom's own UI.
    if (status === 'idle' || status === 'loading' || status === 'joined') return null;

    return (
        <div className="relative w-full h-full bg-gray-900">
            {/* Error overlay */}
            {status === 'error' && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-900/90 z-10">
                    <AlertCircle className="w-10 h-10 text-red-400 mb-3" />
                    <span className="text-white text-sm mb-2">Failed to join meeting</span>
                    <span className="text-gray-400 text-xs max-w-xs text-center">{error}</span>
                    <button
                        onClick={() => join({ meetingNumber, password, userName, userEmail, role })}
                        className="mt-4 px-4 py-2 bg-teal-600 text-white text-sm rounded-lg hover:bg-teal-700"
                    >
                        Retry
                    </button>
                </div>
            )}

            {/* Left/ended state */}
            {status === 'left' && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-900 z-10">
                    <VideoOff className="w-10 h-10 text-gray-500 mb-3" />
                    <span className="text-gray-300 text-sm">Meeting ended</span>
                </div>
            )}
        </div>
    );
});
