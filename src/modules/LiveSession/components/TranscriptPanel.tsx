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
        // Boost z-index on Zoom toolbar elements so they're clickable above our panel
        const affected: { el: HTMLElement; prev: string }[] = [];
        document.querySelectorAll('[class*="more"], [class*="toolbar"], [class*="footer"]').forEach(el => {
            const htmlEl = el as HTMLElement;
            affected.push({ el: htmlEl, prev: htmlEl.style.zIndex });
            htmlEl.style.zIndex = '999999';
        });
        const restoreZIndex = () => affected.forEach(({ el, prev }) => { el.style.zIndex = prev; });

        // Step 1: Find and click "More" button by text content
        const moreBtn = Array.from(document.querySelectorAll('button')).find(
            b => b.textContent?.trim() === 'More'
        ) as HTMLElement;

        if (!moreBtn) {
            restoreZIndex();
            setCaptionsEnabled(true); // Mark enabled, user clicks manually
            return;
        }

        moreBtn.click();

        // Step 2: Wait for menu, click "Captions"
        await new Promise(r => setTimeout(r, 400));
        const captionsEl = Array.from(document.querySelectorAll('*')).find(
            e => e.children.length === 0 && e.textContent?.trim() === 'Captions'
        ) as HTMLElement;

        if (captionsEl) {
            captionsEl.click();

            // Step 3: Wait for submenu, click "Show Captions"
            await new Promise(r => setTimeout(r, 400));
            const showCaptionsEl = Array.from(document.querySelectorAll('*')).find(
                e => e.children.length === 0 && e.textContent?.trim() === 'Show Captions'
            ) as HTMLElement;

            if (showCaptionsEl) {
                showCaptionsEl.click();
                console.log('[Transcript] Captions enabled via More > Captions > Show Captions');
            }

            // Close any remaining menus
            await new Promise(r => setTimeout(r, 150));
            document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
        }

        restoreZIndex();
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
