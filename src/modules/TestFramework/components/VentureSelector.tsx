import React, { useState, useRef, useEffect } from 'react';
import { Search, ChevronDown, X } from 'lucide-react';
import type { VentureSummary } from '../types';

interface Props {
    ventures: VentureSummary[];
    selected: VentureSummary | null;
    onSelect: (v: VentureSummary) => void;
    loading: boolean;
}

const STATUS_COLORS: Record<string, string> = {
    Submitted: 'bg-blue-100 text-blue-700',
    'Under Review': 'bg-yellow-100 text-yellow-700',
    'Panel Review': 'bg-purple-100 text-purple-700',
    Approved: 'bg-green-100 text-green-700',
    'Joined Program': 'bg-emerald-100 text-emerald-700',
    Rejected: 'bg-red-100 text-red-700',
};

function statusColor(status: string) {
    return STATUS_COLORS[status] ?? 'bg-gray-100 text-gray-600';
}

export const VentureSelector: React.FC<Props> = ({ ventures, selected, onSelect, loading }) => {
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState('');
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    const filtered = ventures.filter(
        (v) =>
            v.name.toLowerCase().includes(query.toLowerCase()) ||
            (v.founder_name ?? '').toLowerCase().includes(query.toLowerCase())
    );

    return (
        <div ref={ref} className="relative">
            <button
                type="button"
                onClick={() => setOpen((o) => !o)}
                className="w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-lg border border-gray-300 bg-white text-sm hover:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-300 transition-colors"
            >
                <span className="truncate text-left text-gray-700">
                    {loading ? 'Loading ventures…' : selected ? selected.name : 'Select a venture…'}
                </span>
                <div className="flex items-center gap-1 flex-shrink-0">
                    {selected && (
                        <X
                            className="w-3.5 h-3.5 text-gray-400 hover:text-gray-600"
                            onClick={(e) => { e.stopPropagation(); onSelect(null as any); }}
                        />
                    )}
                    <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} />
                </div>
            </button>

            {selected && (
                <div className="mt-1.5 px-1">
                    <span className={`inline-block text-xs font-medium px-2 py-0.5 rounded-full ${statusColor(selected.status)}`}>
                        {selected.status}
                    </span>
                    {selected.founder_name && (
                        <span className="ml-2 text-xs text-gray-500">{selected.founder_name}</span>
                    )}
                </div>
            )}

            {open && (
                <div className="absolute z-50 mt-1 w-full bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden">
                    <div className="p-2 border-b border-gray-100">
                        <div className="flex items-center gap-2 px-2 py-1.5 bg-gray-50 rounded-lg">
                            <Search className="w-4 h-4 text-gray-400 flex-shrink-0" />
                            <input
                                autoFocus
                                className="flex-1 bg-transparent text-sm outline-none text-gray-700 placeholder-gray-400"
                                placeholder="Search ventures…"
                                value={query}
                                onChange={(e) => setQuery(e.target.value)}
                            />
                        </div>
                    </div>
                    <div className="max-h-64 overflow-y-auto">
                        {filtered.length === 0 ? (
                            <div className="px-4 py-3 text-sm text-gray-400 text-center">No ventures found</div>
                        ) : (
                            filtered.map((v) => (
                                <button
                                    key={v.id}
                                    type="button"
                                    onClick={() => { onSelect(v); setOpen(false); setQuery(''); }}
                                    className={`w-full text-left px-4 py-2.5 hover:bg-indigo-50 transition-colors ${selected?.id === v.id ? 'bg-indigo-50' : ''}`}
                                >
                                    <div className="text-sm font-medium text-gray-800 truncate">{v.name}</div>
                                    <div className="flex items-center gap-2 mt-0.5">
                                        {v.founder_name && (
                                            <span className="text-xs text-gray-500 truncate">{v.founder_name}</span>
                                        )}
                                        <span className={`text-xs font-medium px-1.5 py-0.5 rounded-full ${statusColor(v.status)}`}>
                                            {v.status}
                                        </span>
                                    </div>
                                </button>
                            ))
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};
