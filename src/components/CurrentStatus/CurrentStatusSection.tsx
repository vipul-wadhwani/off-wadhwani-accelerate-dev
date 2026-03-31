import React, { useState, useRef, useEffect } from 'react';
import { Filter } from 'lucide-react';
import type { Deliverable } from './constants';
import { STATUS_FILTER_OPTIONS, DELIVERABLE_STATUS_CONFIG } from './constants';
import { DeliverableTable } from './DeliverableTable';
import { DeliverableDetail } from './DeliverableDetail';

interface CurrentStatusSectionProps {
    ventureId: string;
    ventureName: string;
    deliverables: Deliverable[];
    onDeliverablesChange: (deliverables: Deliverable[]) => void;
}

export const CurrentStatusSection: React.FC<CurrentStatusSectionProps> = ({
    ventureId,
    ventureName,
    deliverables,
    onDeliverablesChange,
}) => {
    const [statusFilter, setStatusFilter] = useState('all');
    const [filterOpen, setFilterOpen] = useState(false);
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const filterRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (filterRef.current && !filterRef.current.contains(event.target as Node)) {
                setFilterOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const filteredDeliverables = statusFilter === 'all'
        ? deliverables
        : deliverables.filter((d) => d.status === statusFilter);

    const selectedDeliverable = selectedId
        ? deliverables.find((d) => d.id === selectedId) || null
        : null;

    const handleUpdate = (updated: Deliverable) => {
        onDeliverablesChange(deliverables.map((d) => (d.id === updated.id ? updated : d)));
    };

    const currentFilterLabel = STATUS_FILTER_OPTIONS.find((o) => o.value === statusFilter)?.label || 'All Statuses';
    const _currentFilterConfig = statusFilter !== 'all' ? DELIVERABLE_STATUS_CONFIG[statusFilter] : null;
    void _currentFilterConfig; // reserved for future use

    // Detail view
    if (selectedDeliverable) {
        return (
            <div className="bg-white border border-gray-200 rounded-xl p-5">
                <DeliverableDetail
                    ventureId={ventureId}
                    ventureName={ventureName}
                    deliverable={selectedDeliverable}
                    onBack={() => setSelectedId(null)}
                    onUpdate={handleUpdate}
                />
            </div>
        );
    }

    // Table view
    return (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            {/* Filter bar */}
            <div className="flex items-center justify-end px-5 py-3 border-b border-gray-100">
                <div className="relative" ref={filterRef}>
                    <button
                        onClick={() => setFilterOpen(!filterOpen)}
                        className="flex items-center gap-2 px-3 py-1.5 border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50"
                    >
                        <Filter className="w-3.5 h-3.5 text-gray-400" />
                        {currentFilterLabel}
                        <svg className="w-3.5 h-3.5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                    </button>
                    {filterOpen && (
                        <div className="absolute right-0 mt-1 w-48 bg-white border border-gray-200 rounded-xl shadow-lg z-10 py-1">
                            {STATUS_FILTER_OPTIONS.map((option) => (
                                <button
                                    key={option.value}
                                    onClick={() => {
                                        setStatusFilter(option.value);
                                        setFilterOpen(false);
                                    }}
                                    className={`w-full text-left px-4 py-2.5 text-sm hover:bg-gray-50 flex items-center gap-2 ${
                                        statusFilter === option.value ? 'bg-indigo-50 text-indigo-700 font-medium' : 'text-gray-700'
                                    }`}
                                >
                                    {statusFilter === option.value && (
                                        <svg className="w-4 h-4 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                        </svg>
                                    )}
                                    {option.label}
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            <DeliverableTable
                deliverables={filteredDeliverables}
                onSelectDeliverable={setSelectedId}
            />
        </div>
    );
};
