import type {AppMode} from '../types';
const modules = new Set<AppMode>(['dashboard', 'ai', 'design', 'community', 'marketplace', 'system', 'agronomy', 'harvesting', 'stock', 'accounting', 'founders', 'tools', 'tasks', 'personalization', 'admin', 'invitations', 'logs', 'profile', 'onboarding', 'labs', 'guide', 'my-work']);
export function readWorkspaceRoute(path: string): {module: AppMode; organizationId?: string} | null {
    const parts = path.split('/').filter(Boolean);
    if (path === '/admin') return {module: 'admin'};
    if (!['modern', 'classic'].includes(parts[0])) return null;
    if (parts.length === 3 && ['worker', 'personal', 'admin'].includes(parts[1]) && modules.has(parts[2] as AppMode)) return {module: parts[2] as AppMode};
    if (parts.length === 4 && parts[1] === 'farms' && modules.has(parts[3] as AppMode)) {
        try { return {module: parts[3] as AppMode, organizationId: decodeURIComponent(parts[2])}; } catch { return null; }
    }
    return null;
}
export function workspacePath(base: 'modern' | 'classic', module: AppMode, organizationId?: string, worker = false): string {
    if (module === 'admin') return `/${base}/admin/admin`;
    if (worker) return `/${base}/worker/${module}`;
    return organizationId ? `/${base}/farms/${encodeURIComponent(organizationId)}/${module}` : `/${base}/personal/${module}`;
}
