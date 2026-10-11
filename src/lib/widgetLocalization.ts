export const getWidgetTitle = (type: string, fallbackTitle: string, t: (key: string) => string): string => {
    switch (type) {
        case 'choose_goal': return t('dash.widget.choose_goal');
        case 'agronomy_quick': return t('dash.widget.agronomy_quick');
        case 'tasks': return t('dash.widget.tasks');
        case 'planner': return t('dash.widget.planner');
        case 'hardware_labs': return t('dash.widget.hardware_labs');
        case 'team_hubs': return t('dash.widget.team_hubs');
        case 'field_summary': return t('dash.widget.field_summary');
        case 'seedling_summary':
        case 'seedling_health':
        case 'seedling_stats': return t('dash.widget.seedling_summary');
        case 'harvest_pulse': return t('dash.widget.harvest_pulse');
        case 'attendance': return t('dash.widget.attendance');
        case 'market_feed': return t('dash.widget.market_feed');
        case 'daily_news': return t('dash.widget.daily_news');
        case 'guest_stats': return t('dash.widget.guest_stats');
        case 'crops_summary': return t('dash.widget.crops_summary');
        default: return fallbackTitle;
    }
};
