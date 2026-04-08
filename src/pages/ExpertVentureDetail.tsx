import React from 'react';
import { useParams } from 'react-router-dom';
import { VPVMVentureDetail } from './VPVMVentureDetail';

export const ExpertVentureDetail: React.FC = () => {
    const { id } = useParams<{ id: string }>();

    return (
        <VPVMVentureDetail
            ventureId={id}
            readOnly
            backPath="/expert/dashboard"
            backLabel="Back to my ventures"
        />
    );
};
