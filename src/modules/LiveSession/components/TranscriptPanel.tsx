import React, { useRef, useEffect, useState } from 'react';
import { MessageSquare, Mic } from 'lucide-react';

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
    const [captionsEnabled, setCaptionsEnabled] = useState(false);

    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [chunks.length]);

    // Auto-detect when captions start coming in
    useEffect(() => {
        if (chunks.length > 0) setCaptionsEnabled(true);
    }, [chunks.length]);

    const enableCaptions = async () => {
        // Step 1: Click "More" button in the Zoom toolbar to open the menu
        const moreBtn = document.querySelector('button[title="More"]') as HTMLElement
            || document.querySelector('[aria-label="more"]') as HTMLElement
            || document.querySelector('[aria-label="More"]') as HTMLElement;

        if (moreBtn) {
            moreBtn.click();

            // Step 2: Wait for menu to appear, then click "Show Captions"
            await new Promise(r => setTimeout(r, 600));

            const showCaptionsBtn = Array.from(document.querySelectorAll('li, div, span, button')).find(
                el => el.textContent?.trim() === 'Show Captions'
            ) as HTMLElement;

            if (showCaptionsBtn) {
                showCaptionsBtn.click();
                setCaptionsEnabled(true);
                return;
            }
        }

        // Fallback: try direct captions button
        const directBtn = document.querySelector('[aria-label="show captions"]') as HTMLElement
            || document.querySelector('[aria-label="Captions"]') as HTMLElement;
        if (directBtn) {
            directBtn.click();
            setCaptionsEnabled(true);
            return;
        }

        // Last resort — just mark enabled, user will need to click manually
        setCaptionsEnabled(true);
    };

    if (chunks.length === 0 && !captionsEnabled) {
        return (
            <div className="text-center py-6">
                <MessageSquare className="w-8 h-8 text-gray-300 mx-auto mb-3" />
                <p className="text-sm text-gray-500 mb-4">Live transcript will appear here</p>
                <button
                    onClick={enableCaptions}
                    className="w-full py-3 bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold rounded-lg flex items-center justify-center gap-2 transition-colors"
                >
                    <Mic className="w-4 h-4" />
                    Enable Live Transcript
                </button>
                <p className="text-[10px] text-gray-400 mt-2">Or click More &gt; Show Captions in the Zoom toolbar</p>
            </div>
        );
    }

    if (chunks.length === 0) {
        return (
            <div className="text-center py-8">
                <MessageSquare className="w-8 h-8 text-gray-300 mx-auto mb-3" />
                <p className="text-sm text-gray-500">Waiting for transcript...</p>
                <p className="text-xs text-gray-400 mt-1">Start speaking to see the live transcript</p>
            </div>
        );
    }

    return (
        <div className="space-y-2 text-sm">
            {chunks.map((chunk, i) => (
                <div key={i} className="flex gap-2">
                    <span className="text-indigo-600 font-medium text-xs whitespace-nowrap">{chunk.speaker}:</span>
                    <span className="text-gray-700 text-xs">{chunk.text}</span>
                </div>
            ))}
            <div ref={bottomRef} />
        </div>
    );
};
