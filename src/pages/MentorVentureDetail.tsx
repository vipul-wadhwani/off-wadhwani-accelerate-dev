import React from 'react';
import { useParams } from 'react-router-dom';
import { VPVMVentureDetail } from './VPVMVentureDetail';

export const MentorVentureDetail: React.FC = () => {
    const { id } = useParams<{ id: string }>();

    return (
        <VPVMVentureDetail
            ventureId={id}
            readOnly
            backPath="/mentor/dashboard"
            backLabel="Back to my ventures"
        />
    );
};
