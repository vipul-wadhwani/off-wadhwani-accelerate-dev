import React from 'react';
import { Calendar, User } from 'lucide-react';
import type { Deliverable } from './constants';
import { DELIVERABLE_STATUS_CONFIG, STREAM_BADGE_COLORS, STREAM_LABELS } from './constants';

interface DeliverableTableProps {
    deliverables: Deliverable[];
    onSelectDeliverable: (id: string) => void;
}

export const DeliverableTable: React.FC<DeliverableTableProps> = ({ deliverables, onSelectDeliverable }) => {
    if (deliverables.length === 0) {
        return (
            <div className="text-center py-8 text-gray-500 text-sm">
                No deliverables match the selected filter.
            </div>
        );
    }

    return (
        <div className="overflow-x-auto">
            <table className="w-full text-sm">
                <thead>
                    <tr className="border-b border-gray-200 bg-gray-50">
                        <th className="text-left px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">Stream</th>
                        <th className="text-left px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">Deliverable Name</th>
                        <th className="text-left px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">Owner</th>
                        <th className="text-left px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">End Date</th>
                        <th className="text-left px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">Status</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                    {deliverables.map((d) => {
                        const streamColors = STREAM_BADGE_COLORS[d.roadmap_key || ''] || { bg: 'bg-gray-100', text: 'text-gray-700' };
                        const streamLabel = STREAM_LABELS[d.roadmap_key || ''] || d.roadmap_key || '—';
                        const statusConfig = DELIVERABLE_STATUS_CONFIG[d.status] || DELIVERABLE_STATUS_CONFIG.pending;

                        return (
                            <tr key={d.id} className="hover:bg-gray-50/50">
                                <td className="px-4 py-3">
                                    <span className={`inline-block px-2.5 py-1 rounded-md text-xs font-semibold uppercase ${streamColors.bg} ${streamColors.text}`}>
                                        {streamLabel}
                                    </span>
                                </td>
                                <td className="px-4 py-3">
                                    <button
                                        onClick={() => onSelectDeliverable(d.id)}
                                        className="text-indigo-600 hover:text-indigo-800 font-medium text-left hover:underline"
                                    >
                                        {d.title}
                                    </button>
                                </td>
                                <td className="px-4 py-3 text-gray-600">
                                    <div className="flex items-center gap-1.5">
                                        <User className="w-3.5 h-3.5 text-gray-400" />
                                        {d.owner || '—'}
                                    </div>
                                </td>
                                <td className="px-4 py-3 text-gray-600">
                                    <div className="flex items-center gap-1.5">
                                        <Calendar className="w-3.5 h-3.5 text-gray-400" />
                                        {d.due_date ? new Date(d.due_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                                    </div>
                                </td>
                                <td className="px-4 py-3">
                                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${statusConfig.badge}`}>
                                        <span className={`w-1.5 h-1.5 rounded-full ${statusConfig.dot}`} />
                                        {statusConfig.label}
                                    </span>
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
};
