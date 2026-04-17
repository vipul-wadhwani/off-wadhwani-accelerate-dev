import React, { useState, useEffect, useRef } from 'react';
import { RotateCcw, RefreshCw } from 'lucide-react';

// ─── Main ContextPanel ────────────────────────────────────────────────────────

interface Props {
    inputContext: Record<string, any> | null;
    prompt: string;
    defaultPrompt: string;
    onPromptChange: (p: string) => void;
    onRebuildPrompt?: (editedContext: Record<string, any>) => Promise<void>;
}

export const ContextPanel: React.FC<Props> = ({
    inputContext,
    prompt,
    defaultPrompt,
    onPromptChange,
    onRebuildPrompt,
}) => {
    const [tab, setTab] = useState<'context' | 'prompt'>('context');
    const [editedJson, setEditedJson] = useState('');
    const [jsonError, setJsonError] = useState<string | null>(null);
    const [rebuilding, setRebuilding] = useState(false);
    const originalJsonRef = useRef('');

    // Sync textarea whenever inputContext is (re)loaded
    useEffect(() => {
        if (inputContext) {
            const json = JSON.stringify(inputContext, null, 2);
            originalJsonRef.current = json;
            setEditedJson(json);
            setJsonError(null);
        }
    }, [inputContext]);

    const isDirty = editedJson !== originalJsonRef.current;

    function handleJsonChange(value: string) {
        setEditedJson(value);
        setJsonError(null);
        try {
            JSON.parse(value);
        } catch {
            setJsonError('Invalid JSON');
        }
    }

    function handleReset() {
        setEditedJson(originalJsonRef.current);
        setJsonError(null);
    }

    async function handleRebuild() {
        if (!onRebuildPrompt || jsonError) return;
        try {
            const parsed = JSON.parse(editedJson);
            setRebuilding(true);
            await onRebuildPrompt(parsed);
            setTab('prompt');
        } catch (e: any) {
            setJsonError(e.message || 'Invalid JSON');
        } finally {
            setRebuilding(false);
        }
    }

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
                    <div className="p-3 flex flex-col gap-2 h-full">
                        {!inputContext ? (
                            <div className="text-sm text-gray-400 text-center py-12">
                                Select a venture and feature to see input context
                            </div>
                        ) : (
                            <>
                                {/* Toolbar */}
                                <div className="flex items-center justify-between flex-shrink-0">
                                    <span className="text-xs text-gray-500">
                                        Edit context values below, then click <strong>Rebuild Prompt</strong>.
                                    </span>
                                    <div className="flex items-center gap-2">
                                        {isDirty && !jsonError && (
                                            <button
                                                type="button"
                                                onClick={handleRebuild}
                                                disabled={rebuilding}
                                                className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg bg-indigo-600 text-white font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                                            >
                                                <RefreshCw className={`w-3 h-3 ${rebuilding ? 'animate-spin' : ''}`} />
                                                {rebuilding ? 'Rebuilding…' : 'Rebuild Prompt'}
                                            </button>
                                        )}
                                        {isDirty && (
                                            <button
                                                type="button"
                                                onClick={handleReset}
                                                className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700 font-medium"
                                            >
                                                <RotateCcw className="w-3 h-3" />
                                                Reset
                                            </button>
                                        )}
                                    </div>
                                </div>

                                {jsonError && (
                                    <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-1.5 flex-shrink-0">
                                        {jsonError}
                                    </div>
                                )}

                                <textarea
                                    className="flex-1 w-full font-mono text-xs text-gray-800 bg-gray-50 border border-gray-200 rounded-lg p-3 resize-none focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400"
                                    style={{ minHeight: '520px' }}
                                    value={editedJson}
                                    onChange={(e) => handleJsonChange(e.target.value)}
                                    spellCheck={false}
                                />
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
