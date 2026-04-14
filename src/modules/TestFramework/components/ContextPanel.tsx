import React, { useState } from 'react';
import { ChevronDown, ChevronRight, RotateCcw } from 'lucide-react';

// ─── JSON section viewer ──────────────────────────────────────────────────────

function JsonValue({ value }: { value: any }) {
    if (value === null || value === undefined) return <span className="text-gray-400">null</span>;
    if (typeof value === 'boolean') return <span className="text-purple-600">{String(value)}</span>;
    if (typeof value === 'number') return <span className="text-blue-600">{value}</span>;
    if (typeof value === 'string') {
        if (value.length > 200) return <span className="text-green-700">"{value.slice(0, 200)}…"</span>;
        return <span className="text-green-700">"{value}"</span>;
    }
    if (Array.isArray(value)) {
        if (value.length === 0) return <span className="text-gray-400">[]</span>;
        return (
            <span>
                [{value.map((v, i) => (
                    <span key={i}>
                        <JsonValue value={v} />{i < value.length - 1 ? ', ' : ''}
                    </span>
                ))}]
            </span>
        );
    }
    return <span className="text-gray-700">{JSON.stringify(value)}</span>;
}

function CollapsibleSection({ title, data }: { title: string; data: Record<string, any> }) {
    const [open, setOpen] = useState(true);

    const entries = Object.entries(data).filter(([, v]) => v !== null && v !== undefined && v !== '');

    return (
        <div className="border border-gray-200 rounded-lg overflow-hidden mb-2">
            <button
                type="button"
                onClick={() => setOpen((o) => !o)}
                className="w-full flex items-center justify-between px-3 py-2 bg-gray-50 hover:bg-gray-100 transition-colors text-left"
            >
                <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide">{title}</span>
                <div className="flex items-center gap-1">
                    <span className="text-xs text-gray-400">{entries.length} fields</span>
                    {open
                        ? <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
                        : <ChevronRight className="w-3.5 h-3.5 text-gray-400" />
                    }
                </div>
            </button>
            {open && (
                <div className="px-3 py-2 space-y-1 bg-white">
                    {entries.length === 0 ? (
                        <div className="text-xs text-gray-400 italic">No data available</div>
                    ) : (
                        entries.map(([key, val]) => (
                            <div key={key} className="flex gap-2 text-xs font-mono">
                                <span className="text-indigo-600 flex-shrink-0 w-40 truncate">{key}</span>
                                <span className="text-gray-400">:</span>
                                <span className="flex-1 overflow-hidden">
                                    {typeof val === 'object' && val !== null ? (
                                        <span className="text-gray-500 text-xs">{JSON.stringify(val).slice(0, 150)}{JSON.stringify(val).length > 150 ? '…' : ''}</span>
                                    ) : (
                                        <JsonValue value={val} />
                                    )}
                                </span>
                            </div>
                        ))
                    )}
                </div>
            )}
        </div>
    );
}

// ─── Main ContextPanel ────────────────────────────────────────────────────────

interface Props {
    inputContext: Record<string, any> | null;
    prompt: string;
    defaultPrompt: string;
    onPromptChange: (p: string) => void;
}

export const ContextPanel: React.FC<Props> = ({ inputContext, prompt, defaultPrompt, onPromptChange }) => {
    const [tab, setTab] = useState<'context' | 'prompt'>('context');

    const sections = inputContext
        ? Object.entries(inputContext).filter(([, v]) => v !== null && typeof v === 'object' && !Array.isArray(v))
        : [];
    const primitives = inputContext
        ? Object.entries(inputContext).filter(([, v]) => v === null || typeof v !== 'object' || Array.isArray(v))
        : [];

    return (
        <div className="flex flex-col h-full">
            {/* Tab bar */}
            <div className="flex border-b border-gray-200 bg-white flex-shrink-0">
                {(['context', 'prompt'] as const).map((t) => (
                    <button
                        key={t}
                        type="button"
                        onClick={() => setTab(t)}
                        className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                            tab === t
                                ? 'border-indigo-600 text-indigo-700'
                                : 'border-transparent text-gray-500 hover:text-gray-700'
                        }`}
                    >
                        {t === 'context' ? 'Input Context' : 'Prompt'}
                    </button>
                ))}
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto">
                {tab === 'context' && (
                    <div className="p-3">
                        {!inputContext ? (
                            <div className="text-sm text-gray-400 text-center py-12">
                                Select a venture and feature to see input context
                            </div>
                        ) : (
                            <>
                                {/* Top-level primitives (vsm_notes etc.) */}
                                {primitives.length > 0 && (
                                    <CollapsibleSection
                                        title="Top-Level Fields"
                                        data={Object.fromEntries(primitives)}
                                    />
                                )}
                                {/* Nested sections */}
                                {sections.map(([key, val]) => (
                                    <CollapsibleSection
                                        key={key}
                                        title={key.replace(/_/g, ' ')}
                                        data={val as Record<string, any>}
                                    />
                                ))}
                            </>
                        )}
                    </div>
                )}

                {tab === 'prompt' && (
                    <div className="p-3 flex flex-col gap-2 h-full">
                        <div className="flex items-center justify-between flex-shrink-0">
                            <span className="text-xs text-gray-500">
                                Edit the prompt below. Click <strong>Run Test</strong> to run with your changes.
                            </span>
                            <button
                                type="button"
                                onClick={() => onPromptChange(defaultPrompt)}
                                className="flex items-center gap-1.5 text-xs text-indigo-600 hover:text-indigo-800 font-medium"
                                title="Reset to default prompt"
                            >
                                <RotateCcw className="w-3.5 h-3.5" />
                                Reset
                            </button>
                        </div>
                        {!prompt ? (
                            <div className="text-sm text-gray-400 text-center py-12">
                                Select a venture and feature, then click <strong>Load Context</strong>
                            </div>
                        ) : (
                            <textarea
                                className="flex-1 w-full font-mono text-xs text-gray-800 bg-gray-50 border border-gray-200 rounded-lg p-3 resize-none focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400"
                                style={{ minHeight: '520px' }}
                                value={prompt}
                                onChange={(e) => onPromptChange(e.target.value)}
                                spellCheck={false}
                            />
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};
