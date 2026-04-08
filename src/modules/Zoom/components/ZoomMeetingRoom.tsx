import React, { useEffect } from 'react';
import { useZoomMeeting } from '../hooks/useZoomMeeting';
import { Loader2, AlertCircle, VideoOff } from 'lucide-react';

interface ZoomMeetingRoomProps {
    meetingNumber: string;
    password: string;
    userName: string;
    userEmail?: string;
    role?: number;
    onMeetingEnd?: () => void;
    onTranscriptChunk?: (chunk: { speaker: string; text: string; time: string }) => void;
}

const CONTAINER_ID = 'zoomMeetingContainer';

export const ZoomMeetingRoom: React.FC<ZoomMeetingRoomProps> = ({
    meetingNumber,
    password,
    userName,
    userEmail,
    role = 0,
    onMeetingEnd,
    onTranscriptChunk,
}) => {
    const { status, error, join, leave } = useZoomMeeting(CONTAINER_ID, onTranscriptChunk);

    useEffect(() => {
        if (meetingNumber && password && userName) {
            join({ meetingNumber, password, userName, userEmail, role });
        }
        return () => {
            leave();
        };
    }, [meetingNumber, password, userName]);

    useEffect(() => {
        if (status === 'left' && onMeetingEnd) {
            onMeetingEnd();
        }
    }, [status, onMeetingEnd]);

    return (
        <div className="relative w-full h-full bg-gray-900 overflow-auto">
            {/* Zoom SDK renders here */}
            <div id={CONTAINER_ID} className="w-full h-full" />

            {/* Loading overlay */}
            {status === 'loading' && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-900/90 z-10">
                    <Loader2 className="w-10 h-10 animate-spin text-teal-400 mb-3" />
                    <span className="text-white text-sm">Connecting to meeting...</span>
                </div>
            )}

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

            {/* Idle state */}
            {status === 'idle' && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-900 z-10">
                    <VideoOff className="w-10 h-10 text-gray-500 mb-3" />
                    <span className="text-gray-400 text-sm">Preparing meeting...</span>
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
};
