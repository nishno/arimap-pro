import type { DashboardWidget } from '../types';

export const DEFAULT_DASHBOARD_LAYOUT: DashboardWidget[] = [
    { id: 'w_goal', type: 'choose_goal', title: 'Choose Your Goal', isVisible: true, order: 0, colSpan: 3 },
    { id: 'w_agronomy', type: 'agronomy_quick', title: 'Agronomy Quick Access', isVisible: true, order: 1, colSpan: 1 },
    { id: 'w_tasks', type: 'tasks', title: 'Work & Tasks Hub', isVisible: true, order: 2, colSpan: 1 },
    { id: 'w_planner', type: 'planner', title: 'Agro Planner & Schedule', isVisible: true, order: 3, colSpan: 2 },
    { id: 'w_hardware', type: 'hardware_labs', title: 'Hardware Labs & Telemetry', isVisible: true, order: 4, colSpan: 1 },
    { id: 'w_team', type: 'team_hubs', title: 'Team Hubs & Field Comms', isVisible: true, order: 5, colSpan: 2 },
    { id: 'w_field', type: 'field_summary', title: 'Field, Sectors & Trenches', isVisible: true, order: 6, colSpan: 3 },
    { id: 'w_seedling', type: 'seedling_summary', title: 'Seedling Census & Health', isVisible: true, order: 7, colSpan: 3 },
    { id: 'w_harvest', type: 'harvest_pulse', title: 'Harvest Pulse & Scale Station', isVisible: true, order: 8, colSpan: 1 },
    { id: 'w_att', type: 'attendance', title: 'Staff Attendance & HR', isVisible: true, order: 9, colSpan: 2 },
    { id: 'w_market', type: 'market_feed', title: 'Wholesale Marketplace Feed', isVisible: true, order: 10, colSpan: 1 },
    { id: 'w_news', type: 'daily_news', title: 'Daily Briefing', isVisible: true, order: 11, colSpan: 1 },
    { id: 'w_stats', type: 'guest_stats', title: 'Global Stats', isVisible: true, order: 12, colSpan: 2 },
    { id: 'w_crops', type: 'crops_summary', title: 'Crops & Varieties', isVisible: true, order: 13, colSpan: 1 }
];

export const getSavedDashboardLayout = (userId?: string | null): DashboardWidget[] => {
    try {
        const userKey = userId ? `agrimap_layout_${userId}` : 'agrimap_layout_guest';
        const raw = localStorage.getItem(userKey) || localStorage.getItem('agrimap_layout_shared');
        if (raw) {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed) && parsed.length > 0) {
                // Ensure all default widget types exist in layout even if user saved an older version
                const existingTypes = new Set(parsed.map(w => w.type));
                const merged: DashboardWidget[] = [...parsed];
                DEFAULT_DASHBOARD_LAYOUT.forEach(dw => {
                    if (!existingTypes.has(dw.type)) {
                        merged.push({ ...dw, order: merged.length });
                    }
                });
                return merged.sort((a, b) => a.order - b.order);
            }
        }
    } catch (e) {
        console.warn('Could not retrieve saved dashboard layout:', e);
    }
    return DEFAULT_DASHBOARD_LAYOUT;
};

export const saveDashboardLayout = (layout: DashboardWidget[], userId?: string | null): void => {
    try {
        const userKey = userId ? `agrimap_layout_${userId}` : 'agrimap_layout_guest';
        const serialized = JSON.stringify(layout);
        localStorage.setItem(userKey, serialized);
        localStorage.setItem('agrimap_layout_shared', serialized);
        
        // Also dispatch custom event for instant cross-component updates
        window.dispatchEvent(new CustomEvent('agrimap_layout_updated', { detail: { layout, userId } }));
    } catch (e) {
        console.warn('Could not save dashboard layout:', e);
    }
};
