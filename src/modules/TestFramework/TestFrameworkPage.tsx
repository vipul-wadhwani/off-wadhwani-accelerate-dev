import React, { useEffect, useState, useCallback } from 'react';
import { FlaskConical, Play, Loader2, RefreshCw, Code2, CheckCircle, AlertCircle, Clock } from 'lucide-react';

import { fetchVentures, fetchContext, runTest } from './api';
import type { VentureSummary, Feature, ContextResponse, RunResponse } from './types';

import { VentureSelector } from './components/VentureSelector';
import { FeatureSelector } from './components/FeatureSelector';
import { ContextPanel } from './components/ContextPanel';
import { ScreeningScorecard, PanelScorecard } from './components/ScorecardOutput';
import { RoadmapOutput } from './components/RoadmapOutput';

// ─── Model config badge ───────────────────────────────────────────────────────

function ModelConfigBadge({ config }: { config: ContextResponse['modelConfig'] }) {
    return (
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 space-y-1.5">
            <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Model Config</div>
            <Row label="Model"  value={config.model.replace('claude-', '').replace('-20250929', '')} />
            <Row label="Tokens" value={config.max_tokens.toLocaleString()} />
            <Row label="Temp"   value={String(config.temperature)} />
            <Row label="Tools"  value={config.tools.length > 0 ? config.tools.join(', ') : 'none'} />
        </div>
    );
}

function Row({ label, value }: { label: string; value: string }) {
    return (
        <div className="flex justify-between text-xs">
            <span className="text-gray-500">{label}</span>
            <span className="font-mono text-gray-800">{value}</span>
        </div>
    );
}

// ─── Output renderer ──────────────────────────────────────────────────────────

function OutputPanel({
    runResult,
    running,
    showRaw,
    onToggleRaw,
}: {
    runResult: RunResponse | null;
    running: boolean;
    showRaw: boolean;
    onToggleRaw: () => void;
}) {
    if (running) {
        return (
            <div className="flex flex-col items-center justify-center h-64 gap-3 text-gray-400">
                <Loader2 className="w-8 h-8 animate-spin text-indigo-400" />
                <span className="text-sm">Running test against Claude…</span>
            </div>
        );
    }

    if (!runResult) {
        return (
            <div className="flex flex-col items-center justify-center h-64 gap-2 text-gray-400">
                <FlaskConical className="w-10 h-10 text-gray-300" />
                <span className="text-sm">Output will appear here after running the test</span>
            </div>
        );
    }

    const { parsed, feature, durationMs } = runResult;
    const hasError = parsed?.error;

    return (
        <div>
            {/* Metadata bar */}
            <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                <div className="flex items-center gap-2">
                    {hasError
                        ? <AlertCircle className="w-4 h-4 text-red-500" />
                        : <CheckCircle className="w-4 h-4 text-green-500" />
                    }
                    <span className="text-sm font-medium text-gray-700">
                        {hasError ? 'Parse error' : 'Success'}
                    </span>
                    <span className="flex items-center gap-1 text-xs text-gray-400">
                        <Clock className="w-3.5 h-3.5" />
                        {(durationMs / 1000).toFixed(1)}s
                    </span>
                </div>
                <button
                    type="button"
                    onClick={onToggleRaw}
                    className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg border font-medium transition-colors ${
                        showRaw
                            ? 'bg-gray-800 text-white border-gray-800'
                            : 'bg-white text-gray-600 border-gray-300 hover:border-gray-400'
                    }`}
                >
                    <Code2 className="w-3.5 h-3.5" />
                    Raw JSON
                </button>
            </div>

            {showRaw ? (
                <pre className="text-xs font-mono bg-gray-900 text-green-300 rounded-xl p-4 overflow-auto max-h-[70vh] whitespace-pre-wrap">
                    {runResult.rawText || JSON.stringify(parsed, null, 2)}
                </pre>
            ) : hasError ? (
                <div className="rounded-xl border border-red-200 bg-red-50 p-4">
                    <p className="text-sm font-medium text-red-700 mb-2">Could not parse AI response</p>
                    <pre className="text-xs text-red-600 font-mono whitespace-pre-wrap">{parsed.raw ?? runResult.rawText}</pre>
                </div>
            ) : feature === 'screening' && parsed?.scorecard ? (
                <ScreeningScorecard scorecard={parsed.scorecard} />
            ) : feature === 'panel' && parsed?.panel_scorecard ? (
                <PanelScorecard scorecard={parsed.panel_scorecard} />
            ) : feature === 'roadmap' ? (
                <RoadmapOutput roadmap={parsed} />
            ) : (
                <pre className="text-xs font-mono bg-gray-50 rounded-xl p-4 overflow-auto max-h-[70vh] whitespace-pre-wrap">
                    {JSON.stringify(parsed, null, 2)}
                </pre>
            )}
        </div>
    );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export const TestFrameworkPage: React.FC = () => {
    // ── State ────────────────────────────────────────────────────────────────
    const [ventures, setVentures] = useState<VentureSummary[]>([]);
    const [venturesLoading, setVenturesLoading] = useState(true);
    const [venturesError, setVenturesError] = useState<string | null>(null);

    const [selectedVenture, setSelectedVenture] = useState<VentureSummary | null>(null);
    const [selectedFeature, setSelectedFeature] = useState<Feature | null>(null);

    const [contextLoading, setContextLoading] = useState(false);
    const [contextError, setContextError] = useState<string | null>(null);
    const [contextData, setContextData] = useState<ContextResponse | null>(null);
    const [prompt, setPrompt] = useState('');

    const [running, setRunning] = useState(false);
    const [runError, setRunError] = useState<string | null>(null);
    const [runResult, setRunResult] = useState<RunResponse | null>(null);
    const [showRaw, setShowRaw] = useState(false);

    // ── Load venture list on mount ────────────────────────────────────────────
    useEffect(() => {
        fetchVentures()
            .then(setVentures)
            .catch((e) => setVenturesError(e.message))
            .finally(() => setVenturesLoading(false));
    }, []);

    // ── Reset output when venture/feature changes ─────────────────────────────
    useEffect(() => {
        setContextData(null);
        setPrompt('');
        setRunResult(null);
        setContextError(null);
        setRunError(null);
        setShowRaw(false);
    }, [selectedVenture?.id, selectedFeature]);

    // ── Load context ──────────────────────────────────────────────────────────
    const handleLoadContext = useCallback(async () => {
        if (!selectedVenture || !selectedFeature) return;
        setContextLoading(true);
        setContextError(null);
        setRunResult(null);
        try {
            const data = await fetchContext(selectedVenture.id, selectedFeature);
            setContextData(data);
            setPrompt(data.prompt);
        } catch (e: any) {
            setContextError(e.message);
        } finally {
            setContextLoading(false);
        }
    }, [selectedVenture, selectedFeature]);

    // ── Run test ──────────────────────────────────────────────────────────────
    const handleRun = useCallback(async () => {
        if (!selectedFeature || !prompt.trim()) return;
        setRunning(true);
        setRunError(null);
        setShowRaw(false);
        try {
            const result = await runTest(selectedFeature, prompt);
            setRunResult(result);
        } catch (e: any) {
            setRunError(e.message);
        } finally {
            setRunning(false);
        }
    }, [selectedFeature, prompt]);

    const canLoadContext = !!selectedVenture && !!selectedFeature && !contextLoading;
    const canRun = !!selectedFeature && !!prompt.trim() && !running;

    // ── Render ────────────────────────────────────────────────────────────────
    return (
        <div className="min-h-screen bg-gray-50">
            {/* Header */}
            <div className="bg-white border-b border-gray-200 px-6 py-4">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-indigo-100 flex items-center justify-center">
                        <FlaskConical className="w-5 h-5 text-indigo-600" />
                    </div>
                    <div>
                        <h1 className="text-lg font-bold text-gray-900">AI Feature Test Framework</h1>
                        <p className="text-xs text-gray-500">
                            Dev environment — read-only, no DB writes. Select a venture, load context, tweak the prompt, run.
                        </p>
                    </div>
                </div>
            </div>

            {/* 3-column body */}
            <div className="flex h-[calc(100vh-73px)]">
                {/* ── Left: Controls ─────────────────────────────────────── */}
                <aside className="w-72 flex-shrink-0 border-r border-gray-200 bg-white overflow-y-auto flex flex-col">
                    <div className="p-4 space-y-5 flex-1">
                        {/* Step 1 */}
                        <section>
                            <label className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                                <span className="w-4 h-4 rounded-full bg-indigo-600 text-white text-[10px] flex items-center justify-center font-bold">1</span>
                                Select Venture
                            </label>
                            <VentureSelector
                                ventures={ventures}
                                selected={selectedVenture}
                                onSelect={setSelectedVenture}
                                loading={venturesLoading}
                            />
                            {venturesError && (
                                <p className="text-xs text-red-500 mt-1">{venturesError}</p>
                            )}
                        </section>

                        {/* Step 2 */}
                        <section>
                            <label className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                                <span className="w-4 h-4 rounded-full bg-indigo-600 text-white text-[10px] flex items-center justify-center font-bold">2</span>
                                Select Feature
                            </label>
                            <FeatureSelector
                                selected={selectedFeature}
                                onChange={setSelectedFeature}
                            />
                        </section>

                        {/* Model config — shown after context is loaded */}
                        {contextData && (
                            <section>
                                <ModelConfigBadge config={contextData.modelConfig} />
                            </section>
                        )}

                        {contextError && (
                            <div className="rounded-lg border border-red-200 bg-red-50 p-3">
                                <p className="text-xs text-red-600">{contextError}</p>
                            </div>
                        )}
                        {runError && (
                            <div className="rounded-lg border border-red-200 bg-red-50 p-3">
                                <p className="text-xs text-red-600">{runError}</p>
                            </div>
                        )}
                    </div>

                    {/* CTA buttons pinned to bottom */}
                    <div className="p-4 border-t border-gray-200 space-y-2 bg-white">
                        <button
                            type="button"
                            onClick={handleLoadContext}
                            disabled={!canLoadContext}
                            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border border-indigo-300 bg-indigo-50 text-indigo-700 text-sm font-medium hover:bg-indigo-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                        >
                            {contextLoading
                                ? <><Loader2 className="w-4 h-4 animate-spin" /> Loading…</>
                                : <><RefreshCw className="w-4 h-4" /> Load Context</>
                            }
                        </button>

                        <button
                            type="button"
                            onClick={handleRun}
                            disabled={!canRun}
                            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shadow-sm"
                        >
                            {running
                                ? <><Loader2 className="w-4 h-4 animate-spin" /> Running…</>
                                : <><Play className="w-4 h-4" /> Run Test</>
                            }
                        </button>
                    </div>
                </aside>

                {/* ── Centre: Context + Prompt ────────────────────────── */}
                <section className="flex-1 border-r border-gray-200 bg-white flex flex-col overflow-hidden" style={{ minWidth: 0 }}>
                    <ContextPanel
                        inputContext={contextData?.inputContext ?? null}
                        prompt={prompt}
                        defaultPrompt={contextData?.prompt ?? ''}
                        onPromptChange={setPrompt}
                    />
                </section>

                {/* ── Right: Output ───────────────────────────────────── */}
                <section className="w-[420px] flex-shrink-0 bg-white overflow-y-auto">
                    <div className="p-4">
                        <div className="flex items-center gap-2 mb-4">
                            <h2 className="text-sm font-semibold text-gray-700">Output</h2>
                            {runResult && (
                                <span className="text-xs text-gray-400 capitalize">{runResult.feature}</span>
                            )}
                        </div>
                        <OutputPanel
                            runResult={runResult}
                            running={running}
                            showRaw={showRaw}
                            onToggleRaw={() => setShowRaw((r) => !r)}
                        />
                    </div>
                </section>
            </div>
        </div>
    );
};
