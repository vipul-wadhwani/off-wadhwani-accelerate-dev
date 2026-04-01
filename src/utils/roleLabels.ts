export function getRoleDisplayLabel(role: string, isPanelist?: boolean): string {
    switch (role) {
        case 'success_mgr':
            return 'Screening Manager';
        case 'venture_mgr':
            return isPanelist ? 'Panelist (Prime)' : 'VM (Prime)';
        case 'committee_member':
            return isPanelist ? 'Panelist (Core/Select)' : 'VP (Core/Select)';
        case 'ops_manager':
            return 'Ops Manager';
        case 'admin':
            return 'Admin';
        default:
            return role;
    }
}
