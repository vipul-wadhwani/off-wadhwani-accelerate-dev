import React, { useRef, useEffect } from 'react';
import { MessageSquare } from 'lucide-react';

interface TranscriptChunk {
    speaker: string;
    text: string;
    time: string;
}

interface TranscriptPanelProps {
    chunks: TranscriptChunk[];
}

export const TranscriptPanel: React.FC<TranscriptPanelProps> = ({ chunks }) => {
    const bottomRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [chunks.length]);

    if (chunks.length === 0) {
        return (
            <div className="text-center py-8">
                <MessageSquare className="w-8 h-8 text-gray-600 mx-auto mb-3" />
                <p className="text-sm text-gray-400">Live transcript will appear here</p>
                <p className="text-xs text-gray-500 mt-1">Enable captions in the Zoom meeting to see transcript</p>
            </div>
        );
    }

    return (
        <div className="space-y-2 text-sm">
            {chunks.map((chunk, i) => (
                <div key={i} className="flex gap-2">
                    <span className="text-teal-400 font-medium text-xs whitespace-nowrap">{chunk.speaker}:</span>
                    <span className="text-gray-300 text-xs">{chunk.text}</span>
                </div>
            ))}
            <div ref={bottomRef} />
        </div>
    );
};
