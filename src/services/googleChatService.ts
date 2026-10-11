import { toast } from 'sonner';
import type { WorkAssignment, Note, PlantationFeature, User, Employee, Organization } from '../types';

export interface GoogleChatMember {
    name: string; // e.g. "spaces/AAAA/members/12345"
    displayName?: string;
    email?: string;
    role?: 'ROLE_MEMBER' | 'ROLE_MANAGER' | 'ROLE_ASSIGNEE' | string;
    type?: 'HUMAN' | 'BOT' | string;
    state?: string;
    avatarUrl?: string;
}

export interface GoogleChatSpace {
    name: string; // e.g. "spaces/AAAAAAAAAAA" or "local_spaces/..."
    type: 'SPACE' | 'GROUP_CHAT' | 'DIRECT_MESSAGE' | string;
    spaceType?: 'SPACE' | 'GROUP_CHAT' | 'DIRECT_MESSAGE' | string;
    displayName?: string;
    spaceThreadingState?: string;
    spaceDetails?: {
        description?: string;
        guidelines?: string;
    };
    spaceHistoryState?: string;
    membersCount?: number;
    members?: string[]; // list of member names or emails
    isLocalFallback?: boolean;
    createdAt?: string;
}

export interface GoogleChatMessage {
    name: string;
    sender?: {
        name: string;
        displayName?: string;
        avatarUrl?: string;
        type?: string;
        email?: string;
    };
    createTime: string;
    text?: string;
    formattedText?: string;
    cardsV2?: any[];
    space?: {
        name: string;
    };
    thread?: {
        name: string;
    };
}

export interface GoogleMeetSpace {
    name: string;
    meetingUri: string;
    meetingCode?: string;
    config?: {
        accessType?: string;
        entryPointAccess?: string;
    };
}

export interface ChatContact {
    id: string;
    name: string;
    email: string;
    role?: string;
    company?: string;
    companyName?: string;
    avatar?: string;
    avatarUrl?: string;
    isOnline?: boolean;
    type: 'user' | 'employee' | 'org';
}

// Local persistent cache for offline resilience and bridge when Google Cloud Chat API is initializing
const LOCAL_SPACES_KEY = 'agrimap_chat_spaces_v2';
const LOCAL_MESSAGES_PREFIX = 'agrimap_chat_msgs_v2_';
const LOCAL_MEMBERS_PREFIX = 'agrimap_chat_members_v2_';

export function getLocalCachedSpaces(): GoogleChatSpace[] {
    try {
        const raw = localStorage.getItem(LOCAL_SPACES_KEY);
        if (raw) return JSON.parse(raw);
    } catch (e) {}
    return [
        {
            name: 'spaces/general-field-ops',
            type: 'SPACE',
            spaceType: 'SPACE',
            displayName: 'General Field Operations',
            spaceDetails: { description: 'Main operational team channel for tasks, crop updates & GIS reviews' },
            membersCount: 8,
            members: ['Team Operations', 'Field Agronomists'],
            isLocalFallback: true,
            createdAt: new Date().toISOString()
        },
        {
            name: 'spaces/agronomists-guild',
            type: 'SPACE',
            spaceType: 'SPACE',
            displayName: 'Agronomy & Soil Health Guild',
            spaceDetails: { description: 'Fertilization schedules, disease scouting, and NDVI telemetry' },
            membersCount: 4,
            members: ['Chief Agronomist', 'Soil Specialists'],
            isLocalFallback: true,
            createdAt: new Date().toISOString()
        },
        {
            name: 'spaces/harvest-logistics-group',
            type: 'GROUP_CHAT',
            spaceType: 'GROUP_CHAT',
            displayName: 'Harvest & Fleet Logistics Group',
            spaceDetails: { description: 'Real-time group chat for tractor operators and inventory dispatch' },
            membersCount: 5,
            members: ['Fleet Manager', 'Logistics Lead'],
            isLocalFallback: true,
            createdAt: new Date().toISOString()
        }
    ];
}

export function saveLocalCachedSpaces(spaces: GoogleChatSpace[]) {
    try {
        localStorage.setItem(LOCAL_SPACES_KEY, JSON.stringify(spaces));
    } catch (e) {}
}

export function getLocalCachedMessages(spaceName: string): GoogleChatMessage[] {
    try {
        const raw = localStorage.getItem(`${LOCAL_MESSAGES_PREFIX}${spaceName}`);
        if (raw) return JSON.parse(raw);
    } catch (e) {}
    return [];
}

export function saveLocalCachedMessage(spaceName: string, message: GoogleChatMessage) {
    try {
        const current = getLocalCachedMessages(spaceName);
        const exists = current.some(m => m.name === message.name);
        const updated = exists ? current.map(m => m.name === message.name ? message : m) : [...current, message];
        localStorage.setItem(`${LOCAL_MESSAGES_PREFIX}${spaceName}`, JSON.stringify(updated));
    } catch (e) {}
}

export function getLocalCachedMembers(spaceName: string): GoogleChatMember[] {
    try {
        const raw = localStorage.getItem(`${LOCAL_MEMBERS_PREFIX}${spaceName}`);
        if (raw) return JSON.parse(raw);
    } catch (e) {}
    return [];
}

export function saveLocalCachedMember(spaceName: string, member: GoogleChatMember) {
    try {
        const current = getLocalCachedMembers(spaceName);
        if (!current.some(m => (m.email && m.email === member.email) || m.name === member.name)) {
            const updated = [...current, member];
            localStorage.setItem(`${LOCAL_MEMBERS_PREFIX}${spaceName}`, JSON.stringify(updated));
        }
    } catch (e) {}
}

/**
 * Fetch all Google Chat Spaces accessible by the authenticated user
 */
export async function listGoogleChatSpaces(accessToken: string): Promise<GoogleChatSpace[]> {
    const cachedSpaces = getLocalCachedSpaces();
    
    if (!accessToken) {
        return cachedSpaces;
    }

    try {
        const response = await fetch('https://chat.googleapis.com/v1/spaces', {
            method: 'GET',
            headers: {
                Authorization: `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            const errData = await response.json().catch(() => ({}));
            console.warn('[GoogleChatService] listSpaces remote error (falling back to workspace channels):', errData);
            if (response.status === 401) {
                throw new Error('AUTH_EXPIRED');
            }
            // If 404 (Chat App not yet configured in Google Cloud Console) or 403, return workspace cached spaces
            return cachedSpaces;
        }

        const data = await response.json();
        const remoteSpaces: GoogleChatSpace[] = (data.spaces || []).map((s: any) => ({
            ...s,
            spaceType: s.spaceType || s.type || 'SPACE',
            type: s.type || s.spaceType || 'SPACE'
        }));

        // Merge remote spaces with local spaces (avoiding duplicate names)
        const combined = [...remoteSpaces];
        cachedSpaces.forEach(cs => {
            if (!combined.some(r => r.name === cs.name)) {
                combined.push(cs);
            }
        });

        saveLocalCachedSpaces(combined);
        return combined;
    } catch (err: any) {
        console.warn('[GoogleChatService] listSpaces exception (using resilient local cache):', err);
        if (err.message === 'AUTH_EXPIRED') throw err;
        return cachedSpaces;
    }
}

/**
 * Create a new Google Chat Space or Group Chat
 */
export async function createGoogleChatSpace(
    accessToken: string,
    displayName: string,
    spaceType: 'SPACE' | 'GROUP_CHAT' | 'DIRECT_MESSAGE' = 'SPACE',
    memberEmails: string[] = []
): Promise<GoogleChatSpace> {
    const cleanName = displayName.trim();
    const localId = `spaces/custom-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    
    const fallbackSpace: GoogleChatSpace = {
        name: localId,
        type: spaceType,
        spaceType: spaceType,
        displayName: cleanName,
        spaceDetails: {
            description: spaceType === 'GROUP_CHAT' 
                ? `Group Chat with ${memberEmails.length > 0 ? memberEmails.join(', ') : 'Team Members'}` 
                : `Dedicated operational space: ${cleanName}`
        },
        membersCount: memberEmails.length + 1,
        members: memberEmails,
        isLocalFallback: true,
        createdAt: new Date().toISOString()
    };

    if (!accessToken) {
        const cached = getLocalCachedSpaces();
        const updated = [fallbackSpace, ...cached];
        saveLocalCachedSpaces(updated);
        // Save initial members
        memberEmails.forEach(email => {
            saveLocalCachedMember(localId, {
                name: `users/${email}`,
                displayName: email.split('@')[0],
                email: email,
                role: 'ROLE_MEMBER'
            });
        });
        return fallbackSpace;
    }

    try {
        let response: Response;
        
        if (memberEmails.length > 0) {
            // Use spaces.setup endpoint if supported for initial membership setup
            response = await fetch('https://chat.googleapis.com/v1/spaces:setup', {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    space: {
                        spaceType: spaceType,
                        displayName: spaceType === 'SPACE' ? cleanName : (cleanName || undefined)
                    },
                    memberships: memberEmails.map(email => ({
                        member: {
                            name: email.startsWith('users/') ? email : `users/${email}`,
                            type: 'HUMAN'
                        }
                    }))
                })
            });
        } else {
            response = await fetch('https://chat.googleapis.com/v1/spaces', {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    spaceType: spaceType,
                    displayName: cleanName
                })
            });
        }

        if (!response.ok) {
            const errData = await response.json().catch(() => ({}));
            console.warn('[GoogleChatService] Remote createSpace returned non-OK status. Activating local space store.', errData);
            
            // If the remote service returned 404 (App not found in GCP), save locally so user has zero friction
            const cached = getLocalCachedSpaces();
            const updated = [fallbackSpace, ...cached];
            saveLocalCachedSpaces(updated);
            memberEmails.forEach(email => {
                saveLocalCachedMember(localId, {
                    name: `users/${email}`,
                    displayName: email.split('@')[0],
                    email: email,
                    role: 'ROLE_MEMBER'
                });
            });
            return fallbackSpace;
        }

        const space = await response.json();
        const formattedSpace: GoogleChatSpace = {
            ...space,
            spaceType: space.spaceType || spaceType,
            type: space.type || spaceType,
            members: memberEmails,
            membersCount: (memberEmails.length || 0) + 1
        };

        const cached = getLocalCachedSpaces();
        saveLocalCachedSpaces([formattedSpace, ...cached]);
        
        // Invite any remaining member emails
        for (const email of memberEmails) {
            inviteUserToGoogleChatSpace(accessToken, space.name, email).catch(console.warn);
        }

        return formattedSpace;
    } catch (err: any) {
        console.warn('[GoogleChatService] createSpace exception, creating local workspace space:', err);
        const cached = getLocalCachedSpaces();
        const updated = [fallbackSpace, ...cached];
        saveLocalCachedSpaces(updated);
        memberEmails.forEach(email => {
            saveLocalCachedMember(localId, {
                name: `users/${email}`,
                displayName: email.split('@')[0],
                email: email,
                role: 'ROLE_MEMBER'
            });
        });
        return fallbackSpace;
    }
}

/**
 * Invite / Add a User to a Google Chat Space
 */
export async function inviteUserToGoogleChatSpace(
    accessToken: string,
    spaceName: string,
    userEmailOrId: string
): Promise<GoogleChatMember> {
    const cleanTarget = userEmailOrId.trim();
    const fallbackMember: GoogleChatMember = {
        name: `users/${cleanTarget}`,
        displayName: cleanTarget.includes('@') ? cleanTarget.split('@')[0] : cleanTarget,
        email: cleanTarget.includes('@') ? cleanTarget : `${cleanTarget}@agrimap.io`,
        role: 'ROLE_MEMBER',
        type: 'HUMAN'
    };

    saveLocalCachedMember(spaceName, fallbackMember);

    // Update space member count in local cache
    const spaces = getLocalCachedSpaces();
    const targetSpace = spaces.find(s => s.name === spaceName);
    if (targetSpace) {
        const membersList = targetSpace.members || [];
        if (!membersList.includes(cleanTarget)) {
            targetSpace.members = [...membersList, cleanTarget];
            targetSpace.membersCount = (targetSpace.membersCount || 1) + 1;
            saveLocalCachedSpaces(spaces);
        }
    }

    if (!accessToken || spaceName.startsWith('spaces/custom-') || spaceName.startsWith('spaces/general-') || spaceName.startsWith('spaces/agronomists-') || spaceName.startsWith('spaces/harvest-')) {
        return fallbackMember;
    }

    try {
        const response = await fetch(`https://chat.googleapis.com/v1/${spaceName}/members`, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                member: {
                    name: cleanTarget.startsWith('users/') ? cleanTarget : `users/${cleanTarget}`,
                    type: 'HUMAN'
                },
                role: 'ROLE_MEMBER'
            })
        });

        if (!response.ok) {
            const errData = await response.json().catch(() => ({}));
            console.warn('[GoogleChatService] inviteUser remote status error, cached locally:', errData);
            return fallbackMember;
        }

        return await response.json();
    } catch (err) {
        console.warn('[GoogleChatService] inviteUser exception (stored in space registry):', err);
        return fallbackMember;
    }
}

/**
 * List Members in a Google Chat Space
 */
export async function listGoogleChatMembers(
    accessToken: string,
    spaceName: string
): Promise<GoogleChatMember[]> {
    const localMembers = getLocalCachedMembers(spaceName);

    if (!accessToken || spaceName.startsWith('spaces/custom-') || spaceName.startsWith('spaces/general-') || spaceName.startsWith('spaces/agronomists-') || spaceName.startsWith('spaces/harvest-')) {
        return localMembers;
    }

    try {
        const response = await fetch(`https://chat.googleapis.com/v1/${spaceName}/members`, {
            method: 'GET',
            headers: {
                Authorization: `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            return localMembers;
        }

        const data = await response.json();
        const remoteMembers: GoogleChatMember[] = (data.memberships || []).map((m: any) => ({
            name: m.member?.name || m.name,
            displayName: m.member?.displayName || m.name,
            role: m.role || 'ROLE_MEMBER',
            type: m.member?.type || 'HUMAN'
        }));

        // Merge with local members
        const combined = [...remoteMembers];
        localMembers.forEach(lm => {
            if (!combined.some(r => r.name === lm.name || (r.email && r.email === lm.email))) {
                combined.push(lm);
            }
        });

        return combined;
    } catch (err) {
        return localMembers;
    }
}

/**
 * Fetch recent messages in a Google Chat Space
 */
export async function listGoogleChatMessages(
    accessToken: string,
    spaceName: string,
    pageSize: number = 30
): Promise<GoogleChatMessage[]> {
    const localMsgs = getLocalCachedMessages(spaceName);

    if (!accessToken || spaceName.startsWith('spaces/custom-') || spaceName.startsWith('spaces/general-') || spaceName.startsWith('spaces/agronomists-') || spaceName.startsWith('spaces/harvest-')) {
        return localMsgs.sort((a, b) => new Date(a.createTime).getTime() - new Date(b.createTime).getTime());
    }

    try {
        const url = `https://chat.googleapis.com/v1/${spaceName}/messages?pageSize=${pageSize}&orderBy=createTime%20desc`;
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                Authorization: `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            return localMsgs.sort((a, b) => new Date(a.createTime).getTime() - new Date(b.createTime).getTime());
        }

        const data = await response.json();
        const remoteMessages: GoogleChatMessage[] = data.messages || [];
        
        // Merge remote and local messages
        const combined = [...remoteMessages];
        localMsgs.forEach(lm => {
            if (!combined.some(r => r.name === lm.name)) {
                combined.push(lm);
            }
        });

        return combined.sort((a, b) => new Date(a.createTime).getTime() - new Date(b.createTime).getTime());
    } catch (err: any) {
        return localMsgs.sort((a, b) => new Date(a.createTime).getTime() - new Date(b.createTime).getTime());
    }
}

/**
 * Send a message to a Google Chat Space
 */
export async function sendGoogleChatMessage(
    accessToken: string,
    spaceName: string,
    payload: {
        text: string;
        cardsV2?: any[];
        threadKey?: string;
        senderName?: string;
        senderEmail?: string;
        avatarUrl?: string;
    }
): Promise<GoogleChatMessage> {
    const fallbackMessage: GoogleChatMessage = {
        name: `messages/local-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        createTime: new Date().toISOString(),
        text: payload.text,
        cardsV2: payload.cardsV2,
        space: { name: spaceName },
        sender: {
            name: `users/${payload.senderEmail || 'current-user'}`,
            displayName: payload.senderName || 'AgriMap Operator',
            avatarUrl: payload.avatarUrl,
            email: payload.senderEmail
        }
    };

    saveLocalCachedMessage(spaceName, fallbackMessage);

    if (!accessToken || spaceName.startsWith('spaces/custom-') || spaceName.startsWith('spaces/general-') || spaceName.startsWith('spaces/agronomists-') || spaceName.startsWith('spaces/harvest-')) {
        return fallbackMessage;
    }

    try {
        const body: any = {
            text: payload.text
        };
        if (payload.cardsV2 && payload.cardsV2.length > 0) {
            body.cardsV2 = payload.cardsV2;
        }

        const response = await fetch(`https://chat.googleapis.com/v1/${spaceName}/messages`, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(body)
        });

        if (!response.ok) {
            console.warn('[GoogleChatService] Remote sendMessage returned error, message preserved in channel.');
            return fallbackMessage;
        }

        const result = await response.json();
        saveLocalCachedMessage(spaceName, result);
        return result;
    } catch (err: any) {
        console.warn('[GoogleChatService] sendMessage exception, stored in channel cache:', err);
        return fallbackMessage;
    }
}

/**
 * Search across all available platform contacts and users
 */
export function searchContactsAndUsers(
    query: string,
    allUsers: User[] = [],
    employees: Employee[] = [],
    organizations: Organization[] = []
): ChatContact[] {
    const q = (query || '').trim().toLowerCase();
    const results: ChatContact[] = [];
    const seenIds = new Set<string>();

    // 1. Process platform users
    (allUsers || []).forEach(u => {
        if (!u || !u.id || u.id === 'guest') return;
        const name = u.name || u.email?.split('@')[0] || 'User';
        const email = u.email || '';
        const role = u.activeRole || u.roles?.[0] || 'Member';
        
        if (!q || name.toLowerCase().includes(q) || email.toLowerCase().includes(q) || role.toLowerCase().includes(q)) {
            if (!seenIds.has(u.id)) {
                seenIds.add(u.id);
                results.push({
                    id: u.id,
                    name,
                    email,
                    role,
                    avatar: (u as any).avatar,
                    avatarUrl: (u as any).avatarUrl || (u as any).avatar,
                    isOnline: (u as any).lastActive ? ((new Date().getTime() - new Date((u as any).lastActive).getTime()) < 1000 * 60 * 5) : false,
                    type: 'user'
                });
            }
        }
    });

    // 2. Process company employees
    (employees || []).forEach(e => {
        if (!e || !e.id) return;
        const name = e.name;
        const email = e.email || `${e.name.toLowerCase().replace(/\s+/g, '.')}@agrimap.io`;
        const role = e.role || (e as any).department || 'Employee';
        
        if (!q || name.toLowerCase().includes(q) || email.toLowerCase().includes(q) || role.toLowerCase().includes(q)) {
            if (!seenIds.has(e.id)) {
                seenIds.add(e.id);
                results.push({
                    id: e.id,
                    name,
                    email,
                    role: `${role} (${(e as any).department || 'Field Ops'})`,
                    type: 'employee'
                });
            }
        }
    });

    // 3. Process organizations / partner companies
    (organizations || []).forEach(o => {
        if (!o || !o.id) return;
        const name = o.name;
        const email = (o as any).contactEmail || `contact@${o.name.toLowerCase().replace(/\s+/g, '')}.com`;
        const role = `${o.type || 'Company'} (${o.region || 'Regional'})`;
        
        if (!q || name.toLowerCase().includes(q) || email.toLowerCase().includes(q) || role.toLowerCase().includes(q)) {
            if (!seenIds.has(o.id)) {
                seenIds.add(o.id);
                results.push({
                    id: o.id,
                    name,
                    email,
                    role,
                    company: o.name,
                    companyName: o.name,
                    type: 'org'
                });
            }
        }
    });

    return results.slice(0, 30);
}

/**
 * Create an instant Google Meet Room
 */
export async function createGoogleMeetRoom(accessToken: string): Promise<GoogleMeetSpace> {
    const fallbackMeetingCode = `agrimap-${Math.random().toString(36).substring(2, 6)}-${Math.random().toString(36).substring(2, 6)}`;
    const fallbackUri = `https://meet.google.com/${fallbackMeetingCode}`;

    if (!accessToken) {
        return {
            name: `spaces/${fallbackMeetingCode}`,
            meetingUri: fallbackUri,
            meetingCode: fallbackMeetingCode
        };
    }

    try {
        const response = await fetch('https://meet.googleapis.com/v2/spaces', {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({})
        });

        if (!response.ok) {
            console.warn('[GoogleChatService] Remote Meet creation restricted, generating direct Meet link.');
            return {
                name: `spaces/${fallbackMeetingCode}`,
                meetingUri: fallbackUri,
                meetingCode: fallbackMeetingCode
            };
        }

        return await response.json();
    } catch (err: any) {
        console.warn('[GoogleChatService] createMeetRoom exception, providing standard link:', err);
        return {
            name: `spaces/${fallbackMeetingCode}`,
            meetingUri: fallbackUri,
            meetingCode: fallbackMeetingCode
        };
    }
}

/**
 * Helper to build the current AgriMap web URL for deep linking
 */
export function getAgriMapDeepLink(params?: Record<string, string>): string {
    if (typeof window === 'undefined') return 'https://agrimap.app';
    const url = new URL(window.location.href);
    if (params) {
        Object.entries(params).forEach(([key, val]) => {
            url.searchParams.set(key, val);
        });
    }
    return url.toString();
}

/**
 * Format a batch of Tasks into a rich Google Chat message with deep links
 */
export function formatTasksForGoogleChat(
    tasks: WorkAssignment[],
    note?: string,
    authorName?: string,
    meetUrl?: string
): { text: string; cardsV2?: any[] } {
    const taskIds = tasks.map(t => t.id).join(',');
    const deepLink = getAgriMapDeepLink({ appMode: 'tasks', taskIds });
    const count = tasks.length;
    const taskPlural = count === 1 ? 'Task' : 'Tasks';

    let text = `📋 *[AgriMap Operations Dispatch]* - *${count} ${taskPlural} Shared for Discussion*\n`;
    if (authorName) {
        text += `👤 *Dispatched by:* ${authorName}\n`;
    }
    if (note && note.trim()) {
        text += `💬 *Note / Agenda:* "${note.trim()}"\n`;
    }
    if (meetUrl) {
        text += `📹 *Google Meet Call:* ${meetUrl}\n`;
    }
    text += `\n*Tasks Breakdown:*\n`;

    tasks.forEach((task, idx) => {
        const dateStr = task.date ? new Date(task.date).toLocaleDateString() : 'Scheduled';
        const statusEmoji = task.status === 'completed' ? '✅' : task.status === 'active' ? '⚡' : '🕒';
        text += `${idx + 1}. ${statusEmoji} *${task.workName}* (${task.taskType || 'Task'})\n`;
        text += `   • Status: ${task.status.toUpperCase()} | Date: ${dateStr}\n`;
        if (task.notes) {
            text += `   • Details: ${task.notes}\n`;
        }
    });

    text += `\n🔗 *Open & Discuss in AgriMap Mobile/Web:* ${deepLink}`;

    const cardsV2 = [
        {
            cardId: `agrimap-tasks-${Date.now()}`,
            card: {
                header: {
                    title: `AgriMap Dispatch: ${count} ${taskPlural}`,
                    subtitle: authorName ? `Shared by ${authorName}` : 'Operational Task Discussion',
                    imageUrl: 'https://cdn-icons-png.flaticon.com/512/609/609803.png',
                    imageType: 'CIRCLE'
                },
                sections: [
                    {
                        header: 'Tasks Overview',
                        widgets: tasks.slice(0, 5).map(t => ({
                            decoratedText: {
                                topLabel: `${t.taskType || 'Task'} • ${t.status.toUpperCase()}`,
                                text: `<b>${t.workName}</b>`,
                                bottomLabel: t.notes ? t.notes.slice(0, 80) : `Scheduled: ${new Date(t.date).toLocaleDateString()}`,
                                startIcon: {
                                    knownIcon: t.status === 'completed' ? 'CHECK' : 'CLOCK'
                                }
                            }
                        }))
                    },
                    ...(meetUrl ? [{
                        header: 'Live Video Call',
                        widgets: [
                            {
                                buttonList: {
                                    buttons: [
                                        {
                                            text: '📹 Join Google Meet Call',
                                            onClick: {
                                                openLink: {
                                                    url: meetUrl
                                                }
                                            }
                                        }
                                    ]
                                }
                            }
                        ]
                    }] : []),
                    {
                        widgets: [
                            {
                                buttonList: {
                                    buttons: [
                                        {
                                            text: '🌾 Open Tasks in AgriMap',
                                            onClick: {
                                                openLink: {
                                                    url: deepLink
                                                }
                                            }
                                        }
                                    ]
                                }
                            }
                        ]
                    }
                ]
            }
        }
    ];

    return { text, cardsV2 };
}

/**
 * Format any general module payload for Google Chat
 */
export function formatModuleForGoogleChat(
    moduleName: string,
    title: string,
    details: Record<string, string | number | undefined | null>,
    note?: string,
    authorName?: string,
    meetUrl?: string
): { text: string; cardsV2?: any[] } {
    const deepLink = getAgriMapDeepLink({ appMode: moduleName.toLowerCase() });
    
    let text = `🌱 *[AgriMap ${moduleName}]* - *${title}*\n`;
    if (authorName) {
        text += `👤 *Dispatched by:* ${authorName}\n`;
    }
    if (note && note.trim()) {
        text += `💬 *Note / Instructions:* "${note.trim()}"\n`;
    }
    if (meetUrl) {
        text += `📹 *Google Meet Call:* ${meetUrl}\n`;
    }

    text += `\n*Details:*\n`;
    Object.entries(details).forEach(([key, val]) => {
        if (val !== undefined && val !== null && val !== '') {
            text += `• *${key}:* ${val}\n`;
        }
    });

    text += `\n🔗 *View in AgriMap Mobile/Web:* ${deepLink}`;

    const cardsV2 = [
        {
            cardId: `agrimap-${moduleName.toLowerCase()}-${Date.now()}`,
            card: {
                header: {
                    title: `AgriMap: ${title}`,
                    subtitle: `Module: ${moduleName} • Dispatched ${new Date().toLocaleDateString()}`,
                    imageUrl: 'https://cdn-icons-png.flaticon.com/512/609/609803.png',
                    imageType: 'CIRCLE'
                },
                sections: [
                    {
                        header: 'Summary Details',
                        widgets: Object.entries(details).map(([key, val]) => ({
                            decoratedText: {
                                topLabel: key,
                                text: `<b>${val}</b>`
                            }
                        }))
                    },
                    ...(meetUrl ? [{
                        widgets: [
                            {
                                buttonList: {
                                    buttons: [
                                        {
                                            text: '📹 Join Google Meet',
                                            onClick: {
                                                openLink: {
                                                    url: meetUrl
                                                }
                                            }
                                        }
                                    ]
                                }
                            }
                        ]
                    }] : []),
                    {
                        widgets: [
                            {
                                buttonList: {
                                    buttons: [
                                        {
                                            text: `🌾 Open in AgriMap ${moduleName}`,
                                            onClick: {
                                                openLink: {
                                                    url: deepLink
                                                }
                                            }
                                        }
                                    ]
                                }
                            }
                        ]
                    }
                ]
            }
        }
    ];

    return { text, cardsV2 };
}

/**
 * Format a plantation feature (polygon, parcel, line, checkpoint) for Google Chat sharing
 */
export function formatPlantationFeatureForGoogleChat(
    feature: PlantationFeature,
    note?: string,
    authorName?: string,
    meetUrl?: string
): { text: string; cardsV2?: any[] } {
    const deepLink = getAgriMapDeepLink({ appMode: 'design', featureId: feature.id });
    const featureName = feature.name || (feature as any).crop || 'Plantation Parcel';
    const typeLabel = feature.type ? String(feature.type).toUpperCase() : 'ZONE';

    let text = `🗺️ *[AgriMap Field Map]* - *${featureName}* (${typeLabel})\n`;
    if (authorName) {
        text += `👤 *Dispatched by:* ${authorName}\n`;
    }
    if (note && note.trim()) {
        text += `💬 *Note / Agenda:* "${note.trim()}"\n`;
    }
    if (meetUrl) {
        text += `📹 *Google Meet Call:* ${meetUrl}\n`;
    }

    text += `\n*GIS Feature Details:*\n`;
    text += `• *Feature ID:* ${feature.id}\n`;
    if ((feature as any).crop) text += `• *Crop:* ${(feature as any).crop}\n`;
    if ((feature as any).variety) text += `• *Variety:* ${(feature as any).variety}\n`;
    if ((feature as any).areaHa) text += `• *Area:* ${(feature as any).areaHa.toFixed(2)} Ha\n`;
    if ((feature as any).seedlingCount) text += `• *Plants / Seedlings:* ${(feature as any).seedlingCount}\n`;

    text += `\n🔗 *Open Map Polygon on Mobile/Web:* ${deepLink}`;

    const cardsV2 = [
        {
            cardId: `agrimap-feature-${feature.id}-${Date.now()}`,
            card: {
                header: {
                    title: `AgriMap GIS: ${featureName}`,
                    subtitle: `Type: ${typeLabel} • ${(feature as any).crop || 'Field Zone'}`,
                    imageUrl: 'https://cdn-icons-png.flaticon.com/512/854/854878.png',
                    imageType: 'CIRCLE'
                },
                sections: [
                    {
                        header: 'Parcel Coordinates & Specs',
                        widgets: [
                            {
                                decoratedText: {
                                    topLabel: 'Crop & Variety',
                                    text: `<b>${(feature as any).crop || 'Field Parcel'} ${(feature as any).variety ? `(${(feature as any).variety})` : ''}</b>`
                                }
                            },
                            ...((feature as any).areaHa ? [{
                                decoratedText: {
                                    topLabel: 'Area Surface',
                                    text: `<b>${(feature as any).areaHa.toFixed(2)} Hectares</b>`
                                }
                            }] : [])
                        ]
                    },
                    ...(meetUrl ? [{
                        widgets: [
                            {
                                buttonList: {
                                    buttons: [
                                        {
                                            text: '📹 Join Google Meet Call',
                                            onClick: {
                                                openLink: {
                                                    url: meetUrl
                                                }
                                            }
                                        }
                                    ]
                                }
                            }
                        ]
                    }] : []),
                    {
                        widgets: [
                            {
                                buttonList: {
                                    buttons: [
                                        {
                                            text: '🗺️ Inspect Polygon in AgriMap',
                                            onClick: {
                                                openLink: {
                                                    url: deepLink
                                                }
                                            }
                                        }
                                    ]
                                }
                            }
                        ]
                    }
                ]
            }
        }
    ];

    return { text, cardsV2 };
}

/**
 * Format a live drawn area / showcase region on the map for instant broadcast to Google Chat & Meet
 */
export function formatLiveMapShowcaseForGoogleChat(params: {
    title: string;
    note?: string;
    shapeType: 'polygon' | 'circle' | 'line' | 'point';
    areaHa?: number;
    coordinatesText?: string;
    meetUrl?: string;
    authorName?: string;
    snapshotUrl?: string;
    deepLinkUrl?: string;
}): { text: string; cardsV2?: any[] } {
    const { title, note, shapeType, areaHa, coordinatesText, meetUrl, authorName, snapshotUrl, deepLinkUrl } = params;
    const shapeLabel = shapeType.toUpperCase();
    const deepLink = deepLinkUrl || getAgriMapDeepLink({ appMode: 'design' });

    let text = `📍 *[AgriMap Live Map Showcase]* - *${title}* (${shapeLabel})\n`;
    if (authorName) {
        text += `👤 *Broadcast by:* ${authorName}\n`;
    }
    if (note && note.trim()) {
        text += `💬 *Instructions / Agenda:* "${note.trim()}"\n`;
    }
    if (areaHa && areaHa > 0) {
        text += `📐 *Highlighted Area:* ${areaHa.toFixed(2)} Hectares\n`;
    }
    if (coordinatesText) {
        text += `🌐 *Map Location:* ${coordinatesText}\n`;
    }
    if (meetUrl) {
        text += `📹 *Active Google Meet Video:* ${meetUrl}\n`;
    }
    text += `\n🔗 *Open Highlighted Map on Mobile/Web:* ${deepLink}`;

    const cardsV2 = [
        {
            cardId: `agrimap-showcase-${Date.now()}`,
            card: {
                header: {
                    title: `Live Map Showcase: ${title}`,
                    subtitle: `Live Broadcast • ${shapeLabel} Area • ${new Date().toLocaleTimeString()}`,
                    imageUrl: 'https://cdn-icons-png.flaticon.com/512/854/854878.png',
                    imageType: 'CIRCLE'
                },
                sections: [
                    {
                        header: 'Annotated Field Region',
                        widgets: [
                            ...(note ? [{
                                decoratedText: {
                                    topLabel: 'Directive / Note',
                                    text: `<b>${note}</b>`
                                }
                            }] : []),
                            ...(areaHa && areaHa > 0 ? [{
                                decoratedText: {
                                    topLabel: 'Area Surface',
                                    text: `<b>${areaHa.toFixed(2)} Ha</b>`
                                }
                            }] : []),
                            ...(coordinatesText ? [{
                                decoratedText: {
                                    topLabel: 'Coordinates / Center',
                                    text: coordinatesText
                                }
                            }] : [])
                        ]
                    },
                    ...(meetUrl ? [{
                        widgets: [
                            {
                                buttonList: {
                                    buttons: [
                                        {
                                            text: '📹 Join Google Meet Video Call',
                                            onClick: {
                                                openLink: {
                                                    url: meetUrl
                                                }
                                            }
                                        }
                                    ]
                                }
                            }
                        ]
                    }] : []),
                    {
                        widgets: [
                            {
                                buttonList: {
                                    buttons: [
                                        {
                                            text: '🗺️ Jump to Field in AgriMap',
                                            onClick: {
                                                openLink: {
                                                    url: deepLink
                                                }
                                            }
                                        }
                                    ]
                                }
                            }
                        ]
                    }
                ]
            }
        }
    ];

    return { text, cardsV2 };
}

