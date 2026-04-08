export interface ZoomSignatureResponse {
    signature: string;
    sdkKey: string;
}

export interface ZoomMeetingInfo {
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

export interface ZoomMeetingProps {
    meetingNumber: string;
    password: string;
    userName: string;
    userEmail?: string;
    role?: number; // 0 = participant, 1 = host
    onMeetingEnd?: () => void;
    onTranscriptChunk?: (chunk: { speaker: string; text: string; time: string }) => void;
}
