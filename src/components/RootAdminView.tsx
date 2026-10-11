
import React, { useState, useEffect } from 'react';
import { db, auth } from '../firebase';
import { collection, query, getDocs, doc, updateDoc, deleteDoc, setDoc, addDoc, orderBy, limit, where, writeBatch } from '../firebase';
import { User, Organization, Membership, SystemLog, Role, UserRole, PlantationFeature, Employee } from '../types';
import { safeStorage } from '../services/storageService';
import { 
  ShieldCheckIcon, 
  ShieldAlertIcon,
  UsersIcon, 
  TrashIcon, 
  LockClosedIcon, 
  SearchIcon,
  BuildingStorefrontIcon,
  ClipboardDocumentIcon,
  PlusIcon,
  PencilSquareIcon,
  CheckIcon,
  XIcon,
  MapIcon,
  CreditCardIcon,
  ArrowPathIcon
} from './Icons';
import { toast } from 'sonner';
import { sendPasswordResetEmail } from 'firebase/auth';
import { USE_FIREBASE } from '../config';

interface RootAdminViewProps {
    currentUser: User | null;
    organizations: Organization[];
    users: User[]; // Added users prop
    plantationFeatures: PlantationFeature[];
    onUpdateOrganization: (org: Organization) => void;
    onDeleteOrganization: (id: string) => void;
    onDeleteFeature?: (id: string | string[]) => void;
    onUpdateUser: (user: User) => void;
    memberships: Membership[];
}

const RootAdminView: React.FC<RootAdminViewProps> = ({ 
    currentUser, 
    organizations = [], 
    users: initialUsers = [], 
    plantationFeatures = [],
    onUpdateOrganization, 
    onDeleteOrganization,
    onDeleteFeature,
    onUpdateUser,
    memberships = []
}) => {
    const [users, setUsers] = useState<User[]>(initialUsers || []);
    
    useEffect(() => {
        setUsers(initialUsers || []);
    }, [initialUsers]);

    const [systemLogs, setSystemLogs] = useState<SystemLog[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [activeTab, setActiveTab] = useState<'users' | 'orgs' | 'handshakes' | 'plantations' | 'subscriptions' | 'logs' | 'roles' | 'stats' | 'registry'>('users');
    const [editingUserId, setEditingUserId] = useState<string | null>(null);
    const [editingRoles, setEditingRoles] = useState<UserRole[]>([]);

    const [localMemberships, setLocalMemberships] = useState<Membership[]>(memberships || []);
    useEffect(() => {
        setLocalMemberships(memberships || []);
    }, [memberships]);

    const [selectedAssignUser, setSelectedAssignUser] = useState<string>('');
    const [selectedAssignOrg, setSelectedAssignOrg] = useState<string>('');
    const [selectedAssignRole, setSelectedAssignRole] = useState<UserRole>('Employee');

    const handleApproveHandshake = async (memId: string) => {
        try {
            if (USE_FIREBASE) {
                await updateDoc(doc(db, 'memberships', memId), { status: 'active' });
                const targetMem = localMemberships.find(m => m.id === memId);
                if (targetMem) {
                    const empId = `emp-${targetMem.userId}-${targetMem.organizationId}`;
                    await updateDoc(doc(db, 'employees', empId), { status: 'active' }).catch(() => {});
                }
            } else {
                const savedMemberships = safeStorage.safeParse(localStorage.getItem('mock_memberships'), []);
                const updated = savedMemberships.map((m: any) => m.id === memId ? { ...m, status: 'active' } : m);
                localStorage.setItem('mock_memberships', JSON.stringify(updated));

                const targetMem = localMemberships.find(m => m.id === memId);
                if (targetMem) {
                    const empId = `emp-${targetMem.userId}-${targetMem.organizationId}`;
                    const savedEmployees = safeStorage.safeParse(localStorage.getItem('mock_employees'), []);
                    const updatedEmp = savedEmployees.map((e: any) => e.id === empId ? { ...e, status: 'active' } : e);
                    localStorage.setItem('mock_employees', JSON.stringify(updatedEmp));
                }
            }
            setLocalMemberships(prev => prev.map(m => m.id === memId ? { ...m, status: 'active' } : m));
            toast.success("Handshake approved successfully!");
        } catch (err: any) {
            console.error(err);
            toast.error("Failed to approve handshake.");
        }
    };

    const handleDeclineHandshake = async (memId: string) => {
        if (!window.confirm("Are you sure you want to decline and remove this handshake request?")) return;
        try {
            if (USE_FIREBASE) {
                await deleteDoc(doc(db, 'memberships', memId));
                const targetMem = localMemberships.find(m => m.id === memId);
                if (targetMem) {
                    const empId = `emp-${targetMem.userId}-${targetMem.organizationId}`;
                    await deleteDoc(doc(db, 'employees', empId)).catch(() => {});
                }
            } else {
                const savedMemberships = safeStorage.safeParse(localStorage.getItem('mock_memberships'), []);
                const filtered = savedMemberships.filter((m: any) => m.id !== memId);
                localStorage.setItem('mock_memberships', JSON.stringify(filtered));

                const targetMem = localMemberships.find(m => m.id === memId);
                if (targetMem) {
                    const empId = `emp-${targetMem.userId}-${targetMem.organizationId}`;
                    const savedEmployees = safeStorage.safeParse(localStorage.getItem('mock_employees'), []);
                    const filteredEmp = savedEmployees.filter((e: any) => e.id !== empId);
                    localStorage.setItem('mock_employees', JSON.stringify(filteredEmp));
                }
            }
            setLocalMemberships(prev => prev.filter(m => m.id !== memId));
            toast.success("Handshake request deleted.");
        } catch (err: any) {
            console.error(err);
            toast.error("Failed to decline handshake.");
        }
    };

    const handleDirectAssignment = async () => {
        if (!selectedAssignUser || !selectedAssignOrg) {
            toast.error("Please select both a User and an Organization.");
            return;
        }

        const chosenUser = users.find(u => u.id === selectedAssignUser);
        const chosenOrg = organizations.find(o => o.id === selectedAssignOrg);
        if (!chosenUser || !chosenOrg) return;

        try {
            const memId = `${selectedAssignUser}_${selectedAssignOrg}`;
            const newMem: Membership = {
                id: memId,
                userId: selectedAssignUser,
                organizationId: selectedAssignOrg,
                role: selectedAssignRole,
                permissionLevel: (selectedAssignRole === 'Founder' || selectedAssignRole === 'Admin') ? 'admin' : 'write',
                status: 'active',
                joinedAt: new Date().toISOString()
            };

            const empId = `emp-${selectedAssignUser}-${selectedAssignOrg}`;
            const newEmp: Employee = {
                id: empId,
                name: chosenUser.name,
                email: chosenUser.email || '',
                phone: chosenUser.phone || '',
                idNumber: chosenUser.personalNumber || '',
                roleId: selectedAssignRole,
                paymentType: 'hourly',
                paymentRate: 0,
                barcode: `BC-${Date.now()}`,
                employeeType: 'Temporary',
                accountType: 'Bank Account',
                status: 'active',
                joinedAt: new Date().toISOString(),
                organizationId: selectedAssignOrg
            };

            if (USE_FIREBASE) {
                await setDoc(doc(db, 'memberships', memId), newMem);
                await setDoc(doc(db, 'employees', empId), newEmp);
            } else {
                const savedMemberships = safeStorage.safeParse(localStorage.getItem('mock_memberships'), []);
                const filteredMems = savedMemberships.filter((m: any) => m.id !== memId);
                localStorage.setItem('mock_memberships', JSON.stringify([...filteredMems, newMem]));

                const savedEmployees = safeStorage.safeParse(localStorage.getItem('mock_employees'), []);
                const filteredEmps = savedEmployees.filter((e: any) => e.id !== empId);
                localStorage.setItem('mock_employees', JSON.stringify([...filteredEmps, newEmp]));
            }

            setLocalMemberships(prev => {
                const filtered = prev.filter(m => m.id !== memId);
                return [...filtered, newMem];
            });

            toast.success(`Successfully assigned ${chosenUser.name} to ${chosenOrg.name} as ${selectedAssignRole}!`);
        } catch (err: any) {
            console.error(err);
            toast.error("Failed to complete assignment.");
        }
    };

    const renderHandshakesTab = () => {
        const pendingHandshakes = localMemberships.filter(m => m.status === 'pending');

        return (
            <div className="space-y-8 animate-slide-up">
                {/* Pending Handshakes Section */}
                <div className="bg-white rounded-[2.5rem] shadow-xl overflow-hidden border border-slate-100 p-8">
                    <div className="mb-6">
                        <h2 className="text-xl font-black text-slate-800 uppercase tracking-tighter flex items-center gap-2">
                            <ShieldCheckIcon className="text-indigo-600" size={24} />
                            Active Handshake Requests
                        </h2>
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">
                            Pending partner & employee attachments awaiting root confirmation
                        </p>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="border-b border-slate-100 bg-slate-50/50">
                                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">User Requestee</th>
                                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Target Company</th>
                                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest animate-pulse">Status / Handshake ID</th>
                                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                                {pendingHandshakes.map(m => {
                                    const user = users.find(u => u.id === m.userId);
                                    const org = organizations.find(o => o.id === m.organizationId);

                                    return (
                                        <tr key={m.id} className="hover:bg-slate-50/50 transition-colors">
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="h-10 w-10 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center font-black text-xs uppercase shadow-sm">
                                                        {user?.name?.charAt(0) || 'U'}
                                                    </div>
                                                    <div>
                                                        <div className="text-sm font-bold text-slate-800">{user?.name || 'Unknown User'}</div>
                                                        <div className="text-[10px] font-bold text-slate-400">{user?.email || 'No Email'}</div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="text-sm font-bold text-slate-850 uppercase tracking-tight">{org?.name || 'Unknown Organization'}</div>
                                                <div className="text-[9px] font-bold text-slate-400 uppercase">{org?.agricultureType || 'Mixed agriculture'} • {org?.type}</div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex flex-col gap-0.5">
                                                    <span className="px-2 py-0.5 bg-amber-100 text-amber-600 rounded-lg text-[9px] font-black uppercase tracking-widest w-fit">
                                                        Pending Confirm
                                                    </span>
                                                    <span className="text-[8px] font-mono text-slate-400 uppercase mt-0.5">ID: {m.id}</span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <div className="flex gap-2 justify-end">
                                                    <button 
                                                        onClick={() => handleApproveHandshake(m.id)}
                                                        className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-[9px] font-black uppercase tracking-widest shadow-lg shadow-indigo-100 transition-all active:scale-95"
                                                    >
                                                        Approve
                                                    </button>
                                                    <button 
                                                        onClick={() => handleDeclineHandshake(m.id)}
                                                        className="px-4 py-2 bg-red-50 hover:bg-red-100 text-red-600 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all active:scale-95"
                                                    >
                                                        Decline
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                                {pendingHandshakes.length === 0 && (
                                    <tr>
                                        <td colSpan={4} className="px-6 py-12 text-center text-slate-400 font-bold text-xs uppercase italic tracking-widest">
                                            No pending handshake link approvals in the queue
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Direct Assignments Section */}
                <div className="bg-white rounded-[2.5rem] shadow-xl overflow-hidden border border-slate-100 p-8">
                    <div className="mb-6">
                        <h2 className="text-xl font-black text-slate-800 uppercase tracking-tighter flex items-center gap-2">
                            <ClipboardDocumentIcon className="text-indigo-600" size={24} />
                            Direct Workspace & Role Assignment Authority
                        </h2>
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">
                            Bypass requests to directly attach any system user to any agricultural organization
                        </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 bg-slate-50 p-6 rounded-2xl border border-slate-100">
                        {/* Select User */}
                        <div className="space-y-1">
                            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">Select Target User</label>
                            <select 
                                className="w-full px-4 py-3 bg-white border-2 border-slate-200 rounded-xl text-xs font-bold font-mono uppercase focus:border-indigo-500 outline-none"
                                value={selectedAssignUser}
                                onChange={e => setSelectedAssignUser(e.target.value)}
                            >
                                <option value="">-- CHOOSE USER --</option>
                                {users.map(u => (
                                    <option key={u.id} value={u.id}>
                                        {u.name} (G-ID: {u.globalUniqueId || 'N/A'})
                                    </option>
                                ))}
                            </select>
                        </div>

                        {/* Select Organization */}
                        <div className="space-y-1">
                            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block block">Select Workspace Company</label>
                            <select 
                                className="w-full px-4 py-3 bg-white border-2 border-slate-200 rounded-xl text-xs font-bold font-mono uppercase focus:border-indigo-500 outline-none"
                                value={selectedAssignOrg}
                                onChange={e => setSelectedAssignOrg(e.target.value)}
                            >
                                <option value="">-- CHOOSE COMPANY --</option>
                                {organizations.map(o => (
                                    <option key={o.id} value={o.id}>
                                        {o.name}
                                    </option>
                                ))}
                            </select>
                        </div>

                        {/* Select Role */}
                        <div className="space-y-1">
                            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block font-medium">Assign Workspace Role</label>
                            <select 
                                className="w-full px-4 py-3 bg-white border-2 border-slate-200 rounded-xl text-xs font-bold font-mono uppercase focus:border-indigo-500 outline-none"
                                value={selectedAssignRole}
                                onChange={e => setSelectedAssignRole(e.target.value as any)}
                            >
                                <option value="Founder">Founder (Full Creator Control)</option>
                                <option value="Admin">Admin (Manager Access)</option>
                                <option value="Agronomist">Agronomist (Plantation Specialist)</option>
                                <option value="Accountant">Accountant (Accounting & Commerce)</option>
                                <option value="Employee">Employee (Field Worker)</option>
                            </select>
                        </div>
                    </div>

                    <div className="mt-6 flex justify-end">
                        <button 
                            onClick={handleDirectAssignment}
                            className="px-8 py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-indigo-100 flex items-center gap-2 active:scale-95 transition-all"
                        >
                            Authorize & Activate Workspace Link <CheckIcon size={16} />
                        </button>
                    </div>
                </div>
            </div>
        );
    };

    const renderRegistryTab = () => (
        <div className="space-y-8 animate-slide-up">
            <div className="bg-white rounded-[2.5rem] shadow-xl overflow-hidden border border-slate-100">
                <div className="p-8 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
                    <div>
                        <h2 className="text-xl font-black text-slate-800 uppercase tracking-tighter">Global User Registry</h2>
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">Unique IDs and Profile Meta</p>
                    </div>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-50/20">
                                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Unique ID</th>
                                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">User Profile</th>
                                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Region / Country</th>
                                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">System Role</th>
                                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Subscription Type</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {users.map(user => (
                                <tr key={user.id} className="hover:bg-slate-50/80 transition-colors">
                                    <td className="px-8 py-5">
                                        <div className="flex flex-col gap-1">
                                            <span className="font-mono text-[9px] font-black text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-100">
                                                G: {user.globalUniqueId || 'N/A'}
                                            </span>
                                            {user.individualUniqueId && (
                                                <span className="font-mono text-[8px] font-bold text-slate-500 bg-slate-50 px-2 py-0.5 rounded-md border border-slate-100">
                                                    I: {user.individualUniqueId}
                                                </span>
                                            )}
                                            {user.companyUniqueId && (
                                                <span className="font-mono text-[8px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-100">
                                                    C: {user.companyUniqueId}
                                                </span>
                                            )}
                                            {user.workerUniqueId && (
                                                <span className="font-mono text-[8px] font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-100">
                                                    W: {user.workerUniqueId}
                                                </span>
                                            )}
                                        </div>
                                    </td>
                                    <td className="px-8 py-5">
                                        <div className="flex items-center gap-3">
                                            <div className="h-8 w-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-400 font-bold text-xs uppercase">
                                                {(user?.name && typeof user.name === 'string') ? user.name.charAt(0) : 'U'}
                                            </div>
                                            <div>
                                                <div className="text-sm font-bold text-slate-800">{user.name || 'Anonymous'}</div>
                                                <div className="text-[10px] text-slate-400">{user.email || 'No email'}</div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-8 py-5">
                                        <div className="text-[10px] font-black text-slate-600 uppercase tracking-tight">
                                            {user.region || 'None'} / {user.country || 'Georgia'}
                                        </div>
                                    </td>
                                    <td className="px-8 py-5">
                                        <div className="flex gap-1 flex-wrap">
                                            {Array.isArray(user.roles) && user.roles.map((r, idx) => (
                                                <span key={`${r}-${idx}`} className={`px-2 py-0.5 bg-slate-100 text-slate-500 rounded text-[8px] font-black uppercase`}>
                                                    {r}
                                                </span>
                                            ))}
                                        </div>
                                    </td>
                                    <td className="px-8 py-5">
                                        <span className="px-2 py-1 bg-amber-50 text-amber-600 rounded-lg text-[9px] font-black uppercase tracking-widest border border-amber-100">
                                            {user.subscriptionType || 'Free'}
                                        </span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            <div className="bg-white rounded-[2.5rem] shadow-xl overflow-hidden border border-slate-100">
                <div className="p-8 border-b border-slate-100 bg-slate-50/50">
                    <h2 className="text-xl font-black text-slate-800 uppercase tracking-tighter">Institutional Registry</h2>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">Company IDs and Legal Metadata</p>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-50/20">
                                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Comp ID</th>
                                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Organization Name</th>
                                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Legal Stats</th>
                                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Region</th>
                                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Area (HA)</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {organizations.map(org => (
                                <tr key={org.id} className="hover:bg-slate-50/80 transition-colors">
                                    <td className="px-8 py-5">
                                        <span className="font-mono text-xs font-black text-emerald-600 bg-emerald-50 px-2 py-1 rounded-lg border border-emerald-100">
                                            {org.uniqueId || 'N/A'}
                                        </span>
                                    </td>
                                    <td className="px-8 py-5">
                                        <div className="flex items-center gap-3">
                                            <div className="h-8 w-8 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600 font-bold text-xs uppercase">
                                                {org?.name && typeof org.name === 'string' ? org.name.charAt(0) : 'O'}
                                            </div>
                                            <span className="text-sm font-bold text-slate-800 uppercase">{org.name || 'Unnamed Org'}</span>
                                        </div>
                                    </td>
                                    <td className="px-8 py-5">
                                        <div className="space-y-0.5">
                                            <div className="text-[10px] font-black text-slate-800 uppercase leading-none">TAX: {org.taxNumber || 'Missing'}</div>
                                            <div className="text-[9px] font-bold text-slate-400 uppercase">{org.legalStructure || org.type}</div>
                                        </div>
                                    </td>
                                    <td className="px-8 py-5">
                                        <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                                            {org.region || 'Georgia'}
                                        </span>
                                    </td>
                                    <td className="px-8 py-5">
                                        <span className="text-xs font-black text-slate-800">
                                            {org.areaHa || 0} HA
                                        </span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
    const [selectedOrg, setSelectedOrg] = useState<Organization | null>(null);
    const [isOrgModalOpen, setIsOrgModalOpen] = useState(false);
    const [selectedUser, setSelectedUser] = useState<User | null>(null);
    const [isUserModalOpen, setIsUserModalOpen] = useState(false);
    const [stats, setStats] = useState<{ [key: string]: number }>({});
    const [newOrgName, setNewOrgName] = useState('');
    const [newOrgType, setNewOrgType] = useState('LTD');
    const [newOrgTax, setNewOrgTax] = useState('');
    const [newOrgPhone, setNewOrgPhone] = useState('');

    const [isOrgDetailModalOpen, setIsOrgDetailModalOpen] = useState(false);
    const [editingOrg, setEditingOrg] = useState<Organization | null>(null);

    const fetchLogs = async () => {
        if (!USE_FIREBASE) return;
        try {
            const q = query(collection(db, 'systemLogs'), orderBy('timestamp', 'desc'), limit(100));
            const snapshot = await getDocs(q);
            const logs = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as SystemLog));
            setSystemLogs(logs);
        } catch (error: any) {
            const msg = String(error?.message || error).toLowerCase();
            if (msg.includes('permission-denied') || msg.includes('insufficient permissions')) {
                console.warn("Insufficient permissions to fetch system logs.");
            } else {
                console.error("Failed to fetch logs", error);
            }
        }
    };

    const fetchStats = async () => {
        if (!USE_FIREBASE) return;
        const collections = [
            'users', 'organizations', 'plantationFeatures', 'memberships', 
            'inventoryItems', 'workAssignments', 'employees', 'harvestEvents',
            'accounts', 'transactions', 'projects'
        ];
        
        const newStats: { [key: string]: number } = {};
        for (const collName of collections) {
            try {
                const snap = await getDocs(collection(db, collName));
                newStats[collName] = snap.size;
            } catch (err) {
                console.warn(`Could not fetch stats for ${collName}:`, err);
                newStats[collName] = 0;
            }
        }
        setStats(newStats);
    };

    useEffect(() => {
        fetchLogs();
        fetchStats();
    }, []);

    const handleResetPassword = async (email: string) => {
        if (!email) return;
        try {
            await sendPasswordResetEmail(auth, email);
            toast.success(`Password reset link sent to ${email}`);
        } catch (error: any) {
            toast.error(error.message || "Failed to send reset link");
        }
    };

    const handleToggleStatus = async (user: User) => {
        const newStatus = user.status === 'active' ? 'blocked' : 'active';
        if (USE_FIREBASE && auth.currentUser && currentUser?.id !== 'root-system') {
            try {
                await updateDoc(doc(db, 'users', user.id), { status: newStatus });
                setUsers(prev => prev.map(u => u.id === user.id ? { ...u, status: newStatus } : u));
                toast.success(`User ${user.name} ${newStatus}`);
            } catch (error) {
                toast.error("Failed to update user status");
            }
        } else {
            setUsers(prev => prev.map(u => u.id === user.id ? { ...u, status: newStatus } : u));
            toast.success(`User ${user.name} ${newStatus} (Local)`);
        }
    };

    const handleDeleteUserDoc = async (userId: string) => {
        if (!window.confirm("Are you sure you want to delete this user's profile?")) return;
        if (USE_FIREBASE && auth.currentUser && currentUser?.id !== 'root-system') {
            try {
                await deleteDoc(doc(db, 'users', userId));
                setUsers(prev => prev.filter(u => u.id !== userId));
                toast.success("User profile deleted");
            } catch (error) {
                toast.error("Failed to delete user profile");
            }
        } else {
            setUsers(prev => prev.filter(u => u.id !== userId));
            toast.success("User profile deleted (Local)");
        }
    };

    const handleStartEditRoles = (user: User) => {
        setEditingUserId(user.id);
        setEditingRoles([...user.roles]);
    };

    const handleSaveRoles = async (userId: string) => {
        if (USE_FIREBASE && auth.currentUser && currentUser?.id !== 'root-system') {
            try {
                await updateDoc(doc(db, 'users', userId), { roles: editingRoles });
                setUsers(prev => prev.map(u => u.id === userId ? { ...u, roles: editingRoles } : u));
                setEditingUserId(null);
                toast.success("Roles updated");
            } catch (error) {
                toast.error("Failed to update roles");
            }
        } else {
            setUsers(prev => prev.map(u => u.id === userId ? { ...u, roles: editingRoles } : u));
            setEditingUserId(null);
            toast.success("Roles updated (Local)");
        }
    };

    const handleHealUser = async (user: User) => {
        const isKa = localStorage.getItem('agri-app-lang') === 'ka';
        toast.info(isKa ? `დაიწყო ${user.email}-ის მონაცემების აღდგენა...` : `Heal started for ${user.email}...`);
        
        let healsCommited = 0;
        try {
            if (!USE_FIREBASE || !db) {
                toast.error("Firebase is not active. Unable to execute heal.");
                return;
            }

            // 1. Fetch matching employees by email
            const employeesRef = collection(db, 'employees');
            const empQuery = query(employeesRef, where('email', '==', user.email));
            const empSnap = await getDocs(empQuery);
            
            const targetOrgIds = empSnap.docs.map(doc => (doc.data() as any).organizationId);
            
            // 2. Fetch all memberships
            const membershipsRef = collection(db, 'memberships');
            const memsSnap = await getDocs(membershipsRef);
            
            const batch = writeBatch(db);
            const orphanedMems: any[] = [];
            const processedOrgIds = new Set<string>();

            // Find memberships where organization is a target, but the userId is not the user's current ID
            for (const docSnap of memsSnap.docs) {
                const mem = { id: docSnap.id, ...docSnap.data() as any };
                if (targetOrgIds.includes(mem.organizationId)) {
                    if (mem.userId !== user.id) {
                        orphanedMems.push(mem);
                    } else {
                        processedOrgIds.add(mem.organizationId);
                    }
                }
            }

            // Migrate each orphaned membership to the user's current ID
            for (const mem of orphanedMems) {
                const newMemId = `${user.id}_${mem.organizationId}`;
                const newMem = {
                    ...mem,
                    id: newMemId,
                    userId: user.id,
                    status: 'active'
                };
                batch.set(doc(db, 'memberships', newMemId), newMem);
                batch.delete(doc(db, 'memberships', mem.id));
                healsCommited++;
                processedOrgIds.add(mem.organizationId);
            }

            // If we found employee records but NO memberships existed whatsoever, create a fresh one!
            for (const orgId of targetOrgIds) {
                if (!processedOrgIds.has(orgId)) {
                    const newMemId = `${user.id}_${orgId}`;
                    const customMem: Membership = {
                        id: newMemId,
                        userId: user.id,
                        organizationId: orgId,
                        role: 'Founder', // Default to Founder/Owner
                        permissionLevel: 'admin',
                        status: 'active',
                        joinedAt: new Date().toISOString()
                    };
                    batch.set(doc(db, 'memberships', newMemId), customMem);
                    healsCommited++;
                }
            }

            // 3. Migrate matching employees to the correct ID 'emp-[userId]-[orgId]'
            for (const docSnap of empSnap.docs) {
                const emp = { id: docSnap.id, ...docSnap.data() as any };
                const correctEmpId = `emp-${user.id}-${emp.organizationId}`;
                if (emp.id !== correctEmpId) {
                    const newEmp = {
                        ...emp,
                        id: correctEmpId,
                        idNumber: user.personalNumber || emp.idNumber || ''
                    };
                    batch.set(doc(db, 'employees', correctEmpId), newEmp);
                    batch.delete(doc(db, 'employees', emp.id));
                    healsCommited++;
                }
            }

            // 4. Update the user's roles and currentOrgId if needed
            if (targetOrgIds.length > 0) {
                const preferredOrgId = targetOrgIds[0];
                const currentRoles = Array.isArray(user.roles) ? user.roles : [];
                const foundRoles = orphanedMems.map(m => m.role);
                const updatedRoles = Array.from(new Set([...currentRoles.filter(r => r !== 'Guest'), ...foundRoles, 'company']));
                
                batch.update(doc(db, 'users', user.id), {
                    currentOrgId: preferredOrgId,
                    roles: updatedRoles,
                    isGuest: false,
                    verificationStatus: 'verified' as any
                });
                
                // Update local list
                setUsers(prev => prev.map(u => u.id === user.id ? { 
                    ...u, 
                    currentOrgId: preferredOrgId, 
                    roles: updatedRoles, 
                    isGuest: false, 
                    verificationStatus: 'verified' 
                } : u));
                
                healsCommited++;
            }

            if (healsCommited > 0) {
                await batch.commit();
                toast.success(isKa ? `აღდგენა დასრულდა! სინქრონიზირდა ${healsCommited} ჩანაწერი.` : `Heal completed successfully! ${healsCommited} elements synchronized.`);
            } else {
                await updateDoc(doc(db, 'users', user.id), { verificationStatus: 'verified', isGuest: false });
                setUsers(prev => prev.map(u => u.id === user.id ? { ...u, verificationStatus: 'verified', isGuest: false } : u));
                toast.success(isKa ? `მომხმარებელი წარმატებით ვერიფიცირდა.` : `User set to active verified state.`);
            }
        } catch (err: any) {
            console.error("Heal failed:", err);
            toast.error(`Heal failed: ${err.message || err}`);
        }
    };

    const handleUpdateUserDetail = async (userId: string, updates: Partial<User>) => {
        // Duplicate ID check if personalNumber is being updated
        if (updates.personalNumber) {
            const isDuplicate = users.some(u => u.id !== userId && u.personalNumber === updates.personalNumber);
            if (isDuplicate) {
                toast.error(`Duplicate ID Number detected: ${updates.personalNumber}. This ID is already registered to another user.`);
                return;
            }
        }

        if (USE_FIREBASE && auth.currentUser && currentUser?.id !== 'root-system') {
            try {
                await updateDoc(doc(db, 'users', userId), updates);
                setUsers(prev => prev.map(u => u.id === userId ? { ...u, ...updates } : u));
                toast.success("User updated");
            } catch (error) {
                toast.error("Failed to update user");
            }
        } else {
            setUsers(prev => prev.map(u => u.id === userId ? { ...u, ...updates } : u));
            toast.success("User updated (Local)");
        }
    };

    const handleCreateOrg = async () => {
        if (!newOrgName) return toast.error("Organization name is required");
        const newOrg: Organization = {
            id: `org-${Date.now()}`,
            uniqueId: `Comp-${Math.floor(1000 + Math.random() * 9000)}`,
            name: newOrgName,
            type: newOrgType as any,
            legalName: newOrgName,
            registrationNumber: '',
            taxNumber: newOrgTax,
            phoneNumber: newOrgPhone,
            agricultureType: 'General',
            country: 'Georgia',
            isDiscoverable: true,
            createdBy: currentUser?.id || 'root',
            createdAt: new Date().toISOString(),
            status: 'active',
            trial_start_date: new Date().toISOString(),
            trialExpiry: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
            isPaid: false,
            tier: 'Free',
            subscriptionStatus: 'Trial'
        };

        if (USE_FIREBASE && auth.currentUser && currentUser?.id !== 'root-system') {
            try {
                await setDoc(doc(db, 'organizations', newOrg.id), newOrg);
                onUpdateOrganization(newOrg);
                setNewOrgName('');
                setNewOrgTax('');
                setNewOrgPhone('');
                toast.success("Organization created");
            } catch (error) {
                toast.error("Failed to create organization");
            }
        } else {
            onUpdateOrganization(newOrg);
            setNewOrgName('');
            setNewOrgTax('');
            setNewOrgPhone('');
            toast.success("Organization created (Local)");
        }
    };

    const [userFilter, setUserFilter] = useState<'all' | 'individual' | 'company'>('all');

    const filteredUsers = users.filter(u => {
        if (!u) return false;
        const nameStr = (u.name || '').toLowerCase();
        const emailStr = (u.email || '').toLowerCase();
        const personalNumberStr = ((u as any).personalNumber || '').toLowerCase();
        const searchLower = (searchTerm || '').toLowerCase();
        
        const matchesSearch = nameStr.includes(searchLower) || 
            emailStr.includes(searchLower) ||
            personalNumberStr.includes(searchLower) ||
            (Array.isArray(u.roles) && u.roles.some(r => r && r.toLowerCase().includes(searchLower)));
        
        if (!matchesSearch) return false;

        const hasOrg = memberships.some(m => m.userId === u.id);
        if (userFilter === 'individual') return !hasOrg;
        if (userFilter === 'company') return hasOrg;
        return true;
    });

    const renderUsersTab = () => (
        <div className="space-y-8">
            <div className="flex justify-between items-center bg-white p-6 rounded-[2rem] shadow-sm border border-slate-100">
                <div className="flex gap-2">
                    {[
                        { id: 'all', label: 'All Users' },
                        { id: 'individual', label: 'Individuals' },
                        { id: 'company', label: 'Company Members' }
                    ].map(f => (
                        <button
                            key={f.id}
                            onClick={() => setUserFilter(f.id as any)}
                            className={`px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${userFilter === f.id ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100' : 'bg-slate-50 text-slate-400 hover:bg-slate-100'}`}
                        >
                            {f.label}
                        </button>
                    ))}
                </div>
            </div>
            <div className="bg-white rounded-[2rem] shadow-xl overflow-hidden border border-slate-100 p-8">
                <h2 className="text-xl font-black text-slate-800 uppercase tracking-tighter mb-6 flex items-center gap-2">
                    <ShieldCheckIcon className="text-indigo-600" size={24} />
                    User Verification
                </h2>
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="border-b border-slate-100">
                                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">User</th>
                                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Status</th>
                                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {filteredUsers.filter(u => u.verificationStatus !== 'verified').map(user => (
                                <tr key={user.id} className="hover:bg-slate-50/50 transition-colors">
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-3">
                                            <div className="h-10 w-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 font-black text-xs uppercase">
                                                {user?.name && typeof user.name === 'string' ? user.name.charAt(0) : 'U'}
                                            </div>
                                            <div>
                                                <div className="text-sm font-bold text-slate-800">{user.name || 'Anonymous'}</div>
                                                <div className="text-[10px] font-bold text-slate-400 tracking-widest">{user.personalNumber || 'No ID'}</div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-center">
                                        <span className="px-2 py-1 bg-amber-100 text-amber-600 rounded-lg text-[9px] font-black uppercase tracking-widest">
                                            Pending
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <button 
                                            onClick={() => handleUpdateUserDetail(user.id, { verificationStatus: 'verified' })}
                                            className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-indigo-100"
                                        >
                                            Verify
                                        </button>
                                    </td>
                                </tr>
                            ))}
                            {filteredUsers.filter(u => u.verificationStatus === 'verified').length === 0 && filteredUsers.filter(u => u.verificationStatus !== 'verified').length === 0 && (
                                <tr>
                                    <td colSpan={3} className="px-6 py-12 text-center text-slate-400 font-bold text-sm uppercase">No pending verifications</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            <div className="bg-white rounded-[2rem] shadow-xl overflow-hidden border border-slate-100">
                <div className="p-8 border-b border-slate-100">
                    <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest">Global Register</h3>
                </div>
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="bg-slate-50 border-b border-slate-100">
                            <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">User</th>
                            <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Roles</th>
                            <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Status</th>
                            <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Joined</th>
                            <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                        {filteredUsers.map(user => (
                            <tr key={user.id} className="hover:bg-slate-50/50 transition-colors">
                                <td className="px-6 py-4">
                                    <div className="flex items-center gap-3">
                                        <div className={`h-10 w-10 rounded-full flex items-center justify-center font-black text-xs uppercase ${user.verificationStatus === 'verified' ? 'bg-indigo-600 text-white shadow-lg' : 'bg-slate-100 text-slate-400'}`}>
                                            {user?.name && typeof user.name === 'string' ? user.name.charAt(0) : 'U'}
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-1">
                                                <div className="text-sm font-bold text-slate-800">{user.name || 'Anonymous'}</div>
                                                {user.verificationStatus === 'verified' && <CheckIcon size={12} className="text-indigo-600" />}
                                            </div>
                                            <div className="text-[10px] font-bold text-slate-400">{user.email || 'No email'}</div>
                                            <div className="text-[9px] font-black text-indigo-500 uppercase tracking-tighter mt-0.5">ID: {user.personalNumber || 'Missing'}</div>
                                        </div>
                                    </div>
                                </td>
                                <td className="px-6 py-4">
                                    {editingUserId === user.id ? (
                                        <div className="flex flex-wrap gap-1 max-w-xs">
                                            {['Admin', 'Founder', 'Employee', 'Accountant', 'Agronomist', 'ROOT_SUPER_ADMIN'].map(r => (
                                                <button
                                                    key={r}
                                                    onClick={() => setEditingRoles(prev => prev.includes(r as UserRole) ? prev.filter(x => x !== r) : [...prev, r as UserRole])}
                                                    className={`px-2 py-0.5 rounded-md text-[9px] font-black uppercase transition-all ${editingRoles.includes(r as UserRole) ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-400'}`}
                                                >
                                                    {r}
                                                </button>
                                            ))}
                                            <div className="flex gap-1 ml-2">
                                                <button onClick={() => handleSaveRoles(user.id)} className="p-1 bg-green-100 text-green-600 rounded-md"><CheckIcon size={12} /></button>
                                                <button onClick={() => setEditingUserId(null)} className="p-1 bg-red-100 text-red-600 rounded-md"><XIcon size={12} /></button>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="flex flex-wrap gap-1 group relative">
                                            {Array.isArray(user.roles) && user.roles.map((role, idx) => (
                                                <span key={`${role}-${idx}`} className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded-md text-[9px] font-black uppercase tracking-tighter">
                                                    {role}
                                                </span>
                                            ))}
                                            <button onClick={() => handleStartEditRoles(user)} className="opacity-0 group-hover:opacity-100 p-1 text-indigo-600 transition-opacity"><PencilSquareIcon size={12} /></button>
                                        </div>
                                    )}
                                </td>
                                <td className="px-6 py-4">
                                    <span className={`px-2 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest ${user.status === 'active' ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>
                                        {user.status}
                                    </span>
                                </td>
                                <td className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase">
                                    {new Date(user.createdAt).toLocaleDateString()}
                                </td>
                                <td className="px-6 py-4 text-right">
                                    <div className="flex justify-end gap-2">
                                        <button 
                                            onClick={() => handleHealUser(user)}
                                            className="p-2 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 rounded-lg transition-colors cursor-pointer"
                                            title="Heal User & Sync Memberships"
                                        >
                                            <ArrowPathIcon size={16} />
                                        </button>
                                        <button 
                                            onClick={() => { setSelectedUser(user); setIsUserModalOpen(true); }}
                                            className="p-2 hover:bg-slate-50 text-slate-600 rounded-lg transition-colors"
                                            title="Edit User Details"
                                        >
                                            <PencilSquareIcon size={16} />
                                        </button>
                                        <button 
                                            onClick={() => handleUpdateUserDetail(user.id, { status: user.status === 'blocked' ? 'active' : 'blocked' })}
                                            className={`p-2 rounded-lg transition-all ${user.status === 'blocked' ? 'text-green-600 bg-green-50' : 'text-amber-600 hover:bg-amber-50'}`}
                                            title={user.status === 'blocked' ? 'Activate User' : 'Block User'}
                                        >
                                            <ShieldAlertIcon size={16} />
                                        </button>
                                        <button 
                                            onClick={() => handleResetPassword(user.email)}
                                            className="p-2 hover:bg-indigo-50 text-indigo-600 rounded-lg transition-colors"
                                            title="Reset Password"
                                        >
                                            <LockClosedIcon size={16} />
                                        </button>
                                        <button 
                                            onClick={async () => {
                                                if (!window.confirm("Nuclear Warning: Delete profile permanently?")) return;
                                                if (USE_FIREBASE && auth.currentUser) {
                                                    await deleteDoc(doc(db, 'users', user.id));
                                                }
                                                setUsers(prev => prev.filter(u => u.id !== user.id));
                                            }}
                                            className="p-2 hover:bg-red-50 text-red-600 rounded-lg transition-colors"
                                            title="Delete Profile"
                                        >
                                            <TrashIcon size={16} />
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );

    const renderOrgsTab = () => (
        <div className="space-y-8">
            <div className="bg-white p-8 rounded-[2rem] shadow-lg border border-slate-100">
                <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest mb-6">Create New Organization</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    <input 
                        type="text" 
                        placeholder="Organization Name" 
                        className="px-4 py-3 bg-slate-50 border-2 border-slate-100 rounded-2xl text-sm font-bold outline-none focus:border-indigo-500 transition-all"
                        value={newOrgName}
                        onChange={e => setNewOrgName(e.target.value)}
                    />
                    <select 
                        className="px-4 py-3 bg-slate-50 border-2 border-slate-100 rounded-2xl text-sm font-bold outline-none focus:border-indigo-500 transition-all"
                        value={newOrgType}
                        onChange={e => setNewOrgType(e.target.value)}
                    >
                        <option value="LTD">LTD</option>
                        <option value="Cooperative">Cooperative</option>
                        <option value="Individual Entrepreneur">Individual Entrepreneur</option>
                    </select>
                    <input 
                        type="text" 
                        placeholder="Tax ID / Registration Code" 
                        className="px-4 py-3 bg-slate-50 border-2 border-slate-100 rounded-2xl text-sm font-bold outline-none focus:border-indigo-500 transition-all"
                        value={newOrgTax}
                        onChange={e => setNewOrgTax(e.target.value)}
                    />
                    <input 
                        type="tel" 
                        placeholder="Contact Phone Number" 
                        className="px-4 py-3 bg-slate-50 border-2 border-slate-100 rounded-2xl text-sm font-bold outline-none focus:border-indigo-500 transition-all"
                        value={newOrgPhone}
                        onChange={e => setNewOrgPhone(e.target.value)}
                    />
                </div>
                <button 
                    onClick={handleCreateOrg}
                    className="w-full md:w-auto px-12 py-3 bg-indigo-600 text-white rounded-2xl text-xs font-black uppercase tracking-widest shadow-xl shadow-indigo-100 active:scale-95 transition-all"
                >
                    Register Organization
                </button>
            </div>

            <h2 className="text-xl font-black text-slate-800 uppercase tracking-tighter mb-4">Organization Subscriptions</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {(organizations || []).map(org => (
                    <div key={org.id} className="bg-white p-6 rounded-[2.5rem] shadow-xl border border-slate-100 relative group flex flex-col justify-between overflow-hidden">
                        <div>
                            <div className="flex justify-between items-start mb-6">
                                <div className="h-14 w-14 rounded-2xl bg-indigo-50 flex items-center justify-center text-indigo-600 font-black text-xl">
                                    {org?.name && typeof org.name === 'string' ? org.name.charAt(0) : 'O'}
                                </div>
                                <div className="text-right">
                                    <h3 className="text-lg font-black text-slate-800 uppercase tracking-tighter leading-none mb-1">{org.name || 'Unnamed Org'}</h3>
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center justify-end gap-1">
                                        {org.subscriptionStatus === 'Trial' ? '⏳ Expires:' : '📅 Renewal:'} 
                                        <span className="text-slate-600">{org.trialExpiry ? new Date(org.trialExpiry).toLocaleDateString() : 'Never'}</span>
                                    </p>
                                </div>
                            </div>
                            
                            <div className="grid grid-cols-2 gap-4 mb-6">
                                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Price</p>
                                    <p className="text-xl font-black text-blue-600 tracking-tighter">${org.price || 0}</p>
                                </div>
                                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Discount</p>
                                    <p className="text-xl font-black text-amber-500 tracking-tighter">{org.discount || 0}%</p>
                                </div>
                            </div>

                            <div className="space-y-2 mb-6">
                                <div className="flex justify-between text-[9px] font-black text-slate-400 uppercase">
                                    <span>Scale</span>
                                    <span className="text-slate-800">{memberships.filter(m => m.organizationId === org.id).length} Members</span>
                                </div>
                                <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                                    <div className="h-full bg-indigo-500 shadow-[0_0_10px_rgba(99,102,241,0.5)] transition-all duration-500" style={{ width: `${Math.min(100, memberships.filter(m => m.organizationId === org.id).length * 10)}%` }}></div>
                                </div>
                            </div>

                            <div className="flex gap-2">
                                <button className="flex-1 py-1.5 bg-slate-50 text-slate-600 rounded-lg text-[9px] font-black uppercase tracking-widest border border-slate-100 hover:bg-white transition-all">+30D</button>
                                <button className="flex-1 py-1.5 bg-slate-50 text-slate-600 rounded-lg text-[9px] font-black uppercase tracking-widest border border-slate-100 hover:bg-white transition-all">+1Y</button>
                            </div>
                        </div>

                        <div className="mt-6 pt-6 border-t border-slate-50 flex gap-3">
                            <button 
                                onClick={() => { setEditingOrg(org); setIsOrgDetailModalOpen(true); }}
                                className="flex-1 py-3 bg-indigo-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-indigo-100 active:scale-95 transition-all"
                            >
                                Modify
                            </button>
                            <button 
                                onClick={() => onDeleteOrganization(org.id)}
                                className="px-4 py-3 bg-slate-50 text-slate-400 rounded-xl border border-slate-100 hover:text-red-600 hover:bg-red-50 hover:border-red-100 transition-all active:scale-95"
                            >
                                <TrashIcon size={18} />
                            </button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );

    const renderDataMapTab = () => (
        <div className="bg-white rounded-[2rem] shadow-xl overflow-hidden border border-slate-100">
            <div className="p-8 border-b border-slate-100 bg-slate-50/30 flex justify-between items-center">
                <h2 className="text-xl font-black text-slate-800 uppercase tracking-tighter">System-Wide Data Map</h2>
                <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest bg-white px-3 py-1 rounded-lg border border-slate-100 shadow-sm">
                    {users.length} Registered Nodes
                </div>
            </div>
            <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="border-b border-slate-100 bg-slate-50/20">
                            <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">User Name</th>
                            <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Individual Role</th>
                            <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Company Role</th>
                            <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Subscription / Status</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                        {(users || []).map(user => {
                            const userMemberships = (memberships || []).filter(m => m.userId === user.id);
                            const mainMembership = userMemberships[0];
                            const org = (organizations || []).find(o => o.id === mainMembership?.organizationId);
                            
                            return (
                                <tr key={user.id} className="hover:bg-slate-50/80 transition-colors group">
                                    <td className="px-8 py-5">
                                        <div className="flex items-center gap-3">
                                            <div className="h-8 w-8 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600 font-bold text-xs">
                                                {user?.name && typeof user.name === 'string' ? user.name.charAt(0) : 'U'}
                                            </div>
                                            <span className="text-sm font-bold text-slate-800">{user?.name || 'Anonymous'}</span>
                                        </div>
                                    </td>
                                    <td className="px-8 py-5">
                                        <div className="flex flex-wrap gap-1">
                                            {Array.isArray(user.roles) && user.roles.map((role, idx) => (
                                                <span key={`${role}-${idx}`} className="px-2 py-0.5 bg-white border border-slate-200 text-slate-600 rounded-md text-[9px] font-black uppercase tracking-tighter">
                                                    {role}
                                                </span>
                                            ))}
                                        </div>
                                    </td>
                                    <td className="px-8 py-5">
                                        {userMemberships.length > 0 ? (
                                            <div className="space-y-1">
                                                {userMemberships.map(m => {
                                                    const mOrg = organizations.find(o => o.id === m.organizationId);
                                                    return (
                                                        <div key={m.organizationId} className="flex flex-col">
                                                            <span className="text-[10px] font-black text-indigo-600 uppercase tracking-widest">
                                                                {m.role || 'Member'} at {mOrg?.name || 'Unknown Company'}
                                                            </span>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        ) : (
                                            <span className="text-[10px] font-bold text-slate-300 uppercase tracking-widest italic">No Institutional Role</span>
                                        )}
                                    </td>
                                    <td className="px-8 py-5">
                                        <div className="flex flex-col gap-1">
                                            <span className={`inline-flex items-center px-2 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest w-fit ${
                                                user.subscriptionStatus === 'Paid' || org?.subscriptionStatus === 'Paid' || org?.subscriptionStatus === 'Trial' || user.tier === 'Pro' || user.tier === 'Enterprise'
                                                    ? 'bg-emerald-50 text-emerald-600 border border-emerald-100'
                                                    : 'bg-amber-50 text-amber-600 border border-amber-100'
                                            }`}>
                                                {org?.subscriptionStatus || user.tier || 'Standard'}
                                            </span>
                                            {org?.trialExpiry && (
                                                <span className="text-[8px] font-bold text-slate-400 ml-1">
                                                    EXP: {new Date(org.trialExpiry).toLocaleDateString()}
                                                </span>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );

    const renderPlantationsTab = () => (
        <div className="bg-white rounded-[2rem] shadow-xl overflow-hidden border border-slate-100">
            <table className="w-full text-left border-collapse">
                <thead>
                    <tr className="bg-slate-50 border-b border-slate-100">
                        <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Plantation / Feature</th>
                        <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Organization</th>
                        <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Type</th>
                        <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Area</th>
                        <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Actions</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                    {plantationFeatures
                        .filter(f => f.type === 'area') // Only areas, no trenches
                        .filter(f => f && (f.name || '').toLowerCase().includes((searchTerm || '').toLowerCase()))
                        .map(feature => {
                        const org = organizations.find(o => o.id === feature.organizationId);
                        return (
                            <tr key={feature.id} className="hover:bg-slate-50/50 transition-colors">
                                <td className="px-6 py-4">
                                    <div className="flex items-center gap-3">
                                        <div className="h-10 w-10 rounded-xl bg-green-50 flex items-center justify-center text-green-600">
                                            <MapIcon size={20} />
                                        </div>
                                        <div>
                                            <div className="text-sm font-bold text-slate-800">{feature.name || 'Unnamed Feature'}</div>
                                            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{feature.id}</div>
                                        </div>
                                    </div>
                                </td>
                                <td className="px-6 py-4">
                                    <div className="text-sm font-bold text-slate-800">{org?.name || 'Personal / Unknown'}</div>
                                </td>
                                <td className="px-6 py-4">
                                    <span className="px-2 py-1 bg-slate-100 text-slate-600 rounded-lg text-[9px] font-black uppercase tracking-widest">
                                        {feature.type}
                                    </span>
                                </td>
                                <td className="px-6 py-4 text-[10px] font-bold text-slate-800 uppercase">
                                    {feature.type === 'area' ? `${((feature as any).areaHa || 0).toFixed(2)} ha` : 'N/A'}
                                </td>
                                <td className="px-6 py-4 text-right">
                                    <div className="flex justify-end gap-2">
                                        <button className="p-2 hover:bg-slate-50 text-slate-600 rounded-lg transition-colors">
                                            <PencilSquareIcon size={16} />
                                        </button>
                                        <button 
                                            onClick={() => onDeleteFeature && onDeleteFeature(feature.id)}
                                            className="p-2 hover:bg-red-50 text-red-600 rounded-lg transition-colors"
                                            title="Delete Feature"
                                        >
                                            <TrashIcon size={16} />
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );

    const renderSubscriptionsTab = () => {
        // Subscription needs only individual user, buyer, and agro agent
        // Attached company users don't need a subscription
        const usersInNeed = users.filter(user => {
            const hasOrg = memberships.some(m => m.userId === user.id);
            const isIndividual = user.roles?.includes('Guest') || user.roles?.includes('Agronomist') || user.roles?.includes('Founder'); // Individual roles
            return !hasOrg || isIndividual;
        });

        return (
            <div className="space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="bg-white p-6 rounded-[2rem] shadow-lg border border-slate-100">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Total Users</p>
                        <p className="text-3xl font-black text-slate-800 tracking-tighter">{users.length}</p>
                        <p className="text-[10px] font-bold text-slate-400 uppercase mt-2">Global System Register</p>
                    </div>
                    <div className="bg-white p-6 rounded-[2rem] shadow-lg border border-slate-100">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Individuals / Agents</p>
                        <p className="text-3xl font-black text-indigo-600 tracking-tighter">{usersInNeed.length}</p>
                        <p className="text-[10px] font-bold text-green-500 uppercase mt-2">Require Individual Subs</p>
                    </div>
                    <div className="bg-white p-6 rounded-[2rem] shadow-lg border border-slate-100">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Active Orgs</p>
                        <p className="text-3xl font-black text-slate-800 tracking-tighter">{organizations.length}</p>
                        <p className="text-[10px] font-bold text-slate-400 uppercase mt-2">Covered by Company Plans</p>
                    </div>
                </div>

                <div className="bg-white rounded-[2rem] shadow-xl overflow-hidden border border-slate-100 p-8">
                    <h2 className="text-xl font-black text-slate-800 uppercase tracking-tighter mb-6 flex items-center justify-between">
                        User Individual Subscriptions
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest bg-slate-50 px-3 py-1 rounded-lg">
                            {usersInNeed.length} Items
                        </span>
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {(usersInNeed || []).map(user => (
                            <div key={user.id} className="bg-slate-50 p-6 rounded-[2.5rem] border border-slate-100 flex flex-col justify-between group hover:border-indigo-200 transition-all">
                                <div>
                                    <div className="flex items-center gap-3 mb-4">
                                        <div className="h-12 w-12 rounded-2xl bg-white shadow-sm flex items-center justify-center text-slate-800 font-bold border border-slate-100">
                                            {user?.name && typeof user.name === 'string' ? user.name.charAt(0) : 'U'}
                                        </div>
                                        <div>
                                            <div className="text-sm font-black text-slate-800 uppercase leading-none mb-1">{user?.name || 'Anonymous'}</div>
                                            <div className="text-[10px] font-bold text-slate-400">{user?.email || 'No email'}</div>
                                        </div>
                                    </div>
                                    <div className="space-y-3 mb-6 bg-white p-4 rounded-2xl border border-slate-100">
                                        <div className="flex justify-between text-[10px] font-black uppercase">
                                            <span className="text-slate-400">Current Tier</span>
                                            <span className="text-indigo-600 font-black">{user.tier || 'Free'}</span>
                                        </div>
                                        <div className="flex justify-between text-[10px] font-black uppercase">
                                            <span className="text-slate-400">Valid Until</span>
                                            <span className="text-slate-800">{user.subscriptionExpiry ? new Date(user.subscriptionExpiry).toLocaleDateString() : 'Expired / None'}</span>
                                        </div>
                                    </div>
                                </div>
                                <div className="flex gap-2">
                                    <button 
                                        onClick={() => handleUpdateUserDetail(user.id, { tier: 'Pro', subscriptionExpiry: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() })} 
                                        className="flex-1 py-3 bg-white text-slate-900 border border-slate-200 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-900 hover:text-white transition-all shadow-sm active:scale-95"
                                    >
                                        +30 Days
                                    </button>
                                    <button 
                                        onClick={() => handleUpdateUserDetail(user.id, { tier: 'Enterprise', subscriptionExpiry: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString() })} 
                                        className="flex-1 py-3 bg-indigo-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-indigo-100 hover:scale-105 transition-all active:scale-95"
                                    >
                                        +1 Year
                                    </button>
                                </div>
                            </div>
                        ))}
                        {usersInNeed.length === 0 && (
                            <div className="col-span-full py-12 text-center text-slate-400 font-black uppercase tracking-widest">
                                No individual subscribers found.
                            </div>
                        )}
                    </div>
                </div>

                <div className="bg-white rounded-[2rem] shadow-xl overflow-hidden border border-slate-100">
                    <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                        <h2 className="text-lg font-black text-slate-800 uppercase tracking-tighter">Organization Plans</h2>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 p-8">
                        {(organizations || []).map(org => (
                            <div key={org.id} className="bg-white p-6 rounded-[2.5rem] shadow-lg border border-slate-100 relative group flex flex-col justify-between overflow-hidden hover:border-indigo-200 transition-all">
                                <div>
                                    <div className="flex justify-between items-start mb-6">
                                        <div className="h-12 w-12 rounded-2xl bg-indigo-50 flex items-center justify-center text-indigo-600 font-black text-xl border border-indigo-100 shadow-sm">
                                            {org?.name && typeof org.name === 'string' ? org.name.charAt(0) : 'O'}
                                        </div>
                                        <div className="text-right">
                                            <h3 className="text-sm font-black text-slate-800 uppercase tracking-tight leading-none mb-1">{org.name || 'Unnamed Org'}</h3>
                                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest flex items-center justify-end gap-1">
                                                {org.subscriptionStatus === 'Trial' ? '⏳' : '📅'} 
                                                <span className="text-slate-600 font-bold">{org.trialExpiry ? new Date(org.trialExpiry).toLocaleDateString() : 'Never'}</span>
                                            </p>
                                        </div>
                                    </div>
                                    
                                    <div className="grid grid-cols-2 gap-3 mb-6">
                                        <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100">
                                            <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Base Price</p>
                                            <p className="text-lg font-black text-indigo-600 tracking-tighter">${org.price || 0}</p>
                                        </div>
                                        <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100">
                                            <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Users</p>
                                            <p className="text-lg font-black text-slate-800 tracking-tighter">{memberships.filter(m => m.organizationId === org.id).length}</p>
                                        </div>
                                    </div>
                                </div>

                                <button onClick={() => onUpdateOrganization({ ...org, tier: 'Pro', isPaid: true, trialExpiry: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() })} className="w-full py-3 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-600 transition-all shadow-xl active:scale-95">
                                    Modify Organization Sub
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        );
    };

    const renderRolesTab = () => (
        <div className="space-y-6">
            <div className="bg-white p-8 rounded-[2rem] shadow-xl border border-slate-100">
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-lg font-black text-slate-800 uppercase tracking-tight">Role Permissions Matrix</h3>
                    <button className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-indigo-100 flex items-center gap-2">
                        <PlusIcon size={14} /> Add Custom Role
                    </button>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="border-b border-slate-100">
                                <th className="py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Role</th>
                                <th className="py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Map Access</th>
                                <th className="py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Inventory</th>
                                <th className="py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Finance</th>
                                <th className="py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Admin</th>
                                <th className="py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {[
                                { name: 'Founder', map: 'Full', inv: 'Full', fin: 'Full', adm: 'Full' },
                                { name: 'Admin', map: 'Full', inv: 'Full', fin: 'Full', adm: 'Partial' },
                                { name: 'Agronomist', map: 'Full', inv: 'Read', fin: 'None', adm: 'None' },
                                { name: 'Accountant', map: 'Read', inv: 'Full', fin: 'Full', adm: 'None' },
                                { name: 'Employee', map: 'Read', inv: 'Read', fin: 'None', adm: 'None' },
                                { name: 'Guest', map: 'Read', inv: 'None', fin: 'None', adm: 'None' }
                            ].map(role => (
                                <tr key={role.name} className="hover:bg-slate-50/50 transition-colors">
                                    <td className="py-4 font-bold text-slate-800 text-sm">{role.name}</td>
                                    <td className="py-4 text-xs font-bold text-slate-500">{role.map}</td>
                                    <td className="py-4 text-xs font-bold text-slate-500">{role.inv}</td>
                                    <td className="py-4 text-xs font-bold text-slate-500">{role.fin}</td>
                                    <td className="py-4 text-xs font-bold text-slate-500">{role.adm}</td>
                                    <td className="py-4 text-right">
                                        <button className="p-2 hover:bg-slate-50 text-slate-400 rounded-lg"><PencilSquareIcon size={14} /></button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
            <div className="bg-white p-12 rounded-[3rem] border-2 border-dashed border-slate-200 flex flex-col items-center text-center">
                <LockClosedIcon size={48} className="text-slate-300 mb-4" />
                <h3 className="text-xl font-black text-slate-800 uppercase tracking-tight">Advanced Permissions</h3>
                <p className="text-sm text-slate-400 font-bold uppercase mt-2 max-w-md">Fine-grained permission control is being implemented. You will soon be able to customize every action for every role.</p>
            </div>
        </div>
    );

    const renderLogsTab = () => (
        <div className="bg-white rounded-[2rem] shadow-xl overflow-hidden border border-slate-100">
            <div className="p-4 bg-slate-50 border-b border-slate-100 flex justify-between items-center">
                <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">Recent System Activity</h3>
                <button onClick={fetchLogs} className="text-[10px] font-black text-indigo-600 uppercase">Refresh</button>
            </div>
            <div className="divide-y divide-slate-50 max-h-[600px] overflow-y-auto">
                {systemLogs.map(log => (
                    <div key={log.id} className="p-4 hover:bg-slate-50/50 transition-colors flex items-start gap-4">
                        <div className={`mt-1 h-2 w-2 rounded-full shrink-0 ${log.status === 'success' ? 'bg-green-500' : log.status === 'alert' ? 'bg-red-500' : 'bg-indigo-500'}`}></div>
                        <div className="flex-1">
                            <div className="flex justify-between items-start">
                                <span className="text-xs font-black text-slate-800 uppercase tracking-tight">{log.action}</span>
                                <span className="text-[9px] font-bold text-slate-400 uppercase">{new Date(log.timestamp).toLocaleString()}</span>
                            </div>
                            <p className="text-[11px] text-slate-500 font-medium mt-0.5">{log.report || 'No details available'}</p>
                            <div className="flex gap-2 mt-2">
                                <span className="text-[9px] font-black px-1.5 py-0.5 bg-slate-100 text-slate-500 rounded uppercase">{log.module}</span>
                                <span className="text-[9px] font-bold text-slate-400 uppercase">BY: {log.userId}</span>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );

    const renderStatsTab = () => {
        const idMap = new Map<string, string[]>();
        users.forEach(u => {
            if (u.personalNumber) {
                const list = idMap.get(u.personalNumber) || [];
                list.push(u.name);
                idMap.set(u.personalNumber, list);
            }
        });
        const duplicates = Array.from(idMap.entries()).filter(([_, users]) => users.length > 1);

        return (
            <div className="space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    {Object.entries(stats).map(([coll, count]) => (
                        <div key={coll} className="bg-white p-8 rounded-[2.5rem] shadow-xl border border-slate-50 group hover:scale-[1.02] transition-all">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">{coll.replace(/([A-Z])/g, ' $1')}</p>
                            <div className="flex items-baseline gap-2">
                                <span className="text-4xl font-black text-slate-800 tracking-tighter">{count}</span>
                                <span className="text-[10px] font-bold text-slate-400 uppercase">Documents</span>
                            </div>
                        </div>
                    ))}
                </div>

                {duplicates.length > 0 && (
                    <div className="bg-red-50 p-8 rounded-[2.5rem] border-2 border-red-100">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="p-3 bg-red-100 rounded-2xl text-red-600">
                                <TrashIcon size={24} />
                            </div>
                            <div>
                                <h3 className="text-lg font-black text-red-900 uppercase tracking-tight">Duplicate ID Alert</h3>
                                <p className="text-[10px] font-black text-red-400 uppercase tracking-widest">Immediate Attention Required</p>
                            </div>
                        </div>
                        <div className="space-y-3">
                            {duplicates.map(([id, userList]) => (
                                <div key={id} className="bg-white p-4 rounded-2xl border border-red-100 flex justify-between items-center shadow-sm">
                                    <div>
                                        <div className="text-xs font-black text-slate-800 uppercase leading-none mb-1">ID: {id}</div>
                                        <div className="text-[10px] font-bold text-slate-400 lowercase italic">Assigned to: {userList.join(', ')}</div>
                                    </div>
                                    <button className="px-4 py-2 bg-red-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-red-100">Merge Docs</button>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                <div className="bg-slate-900 p-12 rounded-[3.5rem] text-center text-white relative overflow-hidden">
                    <div className="relative z-10">
                        <ShieldCheckIcon size={48} className="mx-auto mb-6 text-indigo-400" />
                        <h2 className="text-3xl font-black uppercase tracking-tighter mb-4">Database Integrity Center</h2>
                        <p className="text-indigo-300 font-bold max-w-md mx-auto mb-8">This overview represents all live data currently stored in the system. Use the organizations tab to manage and delete company data clusters.</p>
                        <button onClick={fetchStats} className="px-12 py-4 bg-white text-slate-900 rounded-2xl text-xs font-black uppercase tracking-widest shadow-2xl hover:scale-105 active:scale-95 transition-all">
                            Refresh Statistics
                        </button>
                    </div>
                    <div className="absolute inset-0 bg-gradient-to-br from-indigo-600/20 to-transparent opacity-50"></div>
                </div>
            </div>
        );
    };

    return (
        <div className="p-8 max-w-7xl mx-auto">
            <div className="flex justify-between items-center mb-8">
                <div>
                    <h1 className="text-3xl font-black text-slate-800 uppercase tracking-tight flex items-center gap-3">
                        <ShieldCheckIcon className="text-indigo-600" size={32} />
                        Root Administration
                    </h1>
                    <p className="text-xs font-bold text-slate-400 uppercase mt-1">Manage system users, organizations, and security</p>
                </div>
                <div className="flex items-center gap-4">
                    <div className="relative">
                        <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                        <input 
                            type="text" 
                            placeholder="Search..." 
                            className="pl-10 pr-4 py-2 bg-slate-100 border-none rounded-xl text-sm font-bold focus:ring-2 ring-indigo-500 transition-all w-64"
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                        />
                    </div>
                </div>
            </div>

            <div className="flex flex-wrap gap-2 mb-8 bg-slate-100 p-1.5 rounded-2xl w-fit">
                {[
                    { id: 'users', label: 'Users', icon: UsersIcon },
                    { id: 'orgs', label: 'Organizations', icon: BuildingStorefrontIcon },
                    { id: 'handshakes', label: 'Handshake Links', icon: ShieldCheckIcon },
                    { id: 'plantations', label: 'Plantations', icon: MapIcon },
                    { id: 'subscriptions', label: 'Subscriptions', icon: CreditCardIcon },
                    { id: 'registry', label: 'Data Registry', icon: ClipboardDocumentIcon },
                    { id: 'stats', label: 'System Health', icon: ShieldCheckIcon },
                    { id: 'logs', label: 'System Logs', icon: ClipboardDocumentIcon },
                    { id: 'roles', label: 'Global Roles', icon: LockClosedIcon }
                ].map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id as any)}
                        className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${activeTab === tab.id ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                    >
                        <tab.icon size={14} />
                        {tab.label}
                    </button>
                ))}
            </div>

            {isLoading ? (
                <div className="flex justify-center py-20">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
                </div>
            ) : (
                <>
                    {activeTab === 'users' && renderUsersTab()}
                    {activeTab === 'orgs' && renderOrgsTab()}
                    {activeTab === 'handshakes' && renderHandshakesTab()}
                    {activeTab === 'plantations' && renderPlantationsTab()}
                    {activeTab === 'registry' && renderRegistryTab()}
                    {activeTab === 'subscriptions' && renderSubscriptionsTab()}
                    {activeTab === 'logs' && renderLogsTab()}
                    {activeTab === 'roles' && renderRolesTab()}
                    {activeTab === 'stats' && renderStatsTab()}
                </>
            )}

            {isUserModalOpen && selectedUser && (
                <div className="fixed inset-0 bg-black/60 z-[6000] flex items-center justify-center p-4 backdrop-blur-sm" onClick={() => setIsUserModalOpen(false)}>
                    <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-lg overflow-hidden animate-slide-up" onClick={e => e.stopPropagation()}>
                        <div className="p-8 border-b bg-slate-50/50 flex justify-between items-center">
                            <div>
                                <h2 className="text-2xl font-black text-slate-800 uppercase tracking-tight">Edit User</h2>
                                <p className="text-[10px] font-black text-slate-400 uppercase mt-1">{selectedUser.email}</p>
                            </div>
                            <button onClick={() => setIsUserModalOpen(false)} className="p-2 hover:bg-gray-200 rounded-full transition-colors"><XIcon className="h-6 w-6 text-slate-400" /></button>
                        </div>
                        <div className="p-10 space-y-6">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">First Name</label>
                                    <input 
                                        type="text" 
                                        className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-100 rounded-2xl font-bold text-sm focus:border-indigo-500 outline-none transition-all" 
                                        defaultValue={selectedUser.firstName || (selectedUser.name || '').split(' ')[0]} 
                                        onBlur={e => handleUpdateUserDetail(selectedUser.id, { firstName: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Last Name</label>
                                    <input 
                                        type="text" 
                                        className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-100 rounded-2xl font-bold text-sm focus:border-indigo-500 outline-none transition-all" 
                                        defaultValue={selectedUser.lastName || (selectedUser.name || '').split(' ')[1] || ''} 
                                        onBlur={e => handleUpdateUserDetail(selectedUser.id, { lastName: e.target.value })}
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Personal Number</label>
                                <input 
                                    type="text" 
                                    className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-100 rounded-2xl font-bold text-sm focus:border-indigo-500 outline-none transition-all" 
                                    defaultValue={selectedUser.personalNumber} 
                                    onBlur={e => handleUpdateUserDetail(selectedUser.id, { personalNumber: e.target.value })}
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Subscription Tier</label>
                                    <select 
                                        className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-100 rounded-2xl font-bold text-sm focus:border-indigo-500 outline-none transition-all"
                                        defaultValue={selectedUser.tier || 'Free'}
                                        onChange={e => handleUpdateUserDetail(selectedUser.id, { tier: e.target.value as any })}
                                    >
                                        <option value="Free">Free</option>
                                        <option value="Pro">Pro</option>
                                        <option value="Enterprise">Enterprise</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Valid Until</label>
                                    <input 
                                        type="date"
                                        className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-100 rounded-2xl font-bold text-sm focus:border-indigo-500 outline-none transition-all"
                                        defaultValue={selectedUser.subscriptionExpiry ? new Date(selectedUser.subscriptionExpiry).toISOString().split('T')[0] : ''}
                                        onBlur={e => handleUpdateUserDetail(selectedUser.id, { subscriptionExpiry: e.target.value ? new Date(e.target.value).toISOString() : undefined })}
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Organization Memberships</label>
                                <div className="space-y-2 max-h-40 overflow-y-auto p-2 border-2 border-slate-100 rounded-2xl">
                                    {organizations.map(org => {
                                        const membership = memberships.find(m => m.userId === selectedUser.id && m.organizationId === org.id);
                                        return (
                                            <div key={org.id} className="flex justify-between items-center p-2 hover:bg-slate-50 rounded-xl transition-colors">
                                                <span className="text-[10px] font-black text-slate-600 uppercase tracking-tight">{org.name}</span>
                                                {membership ? (
                                                    <span className="px-2 py-0.5 bg-green-100 text-green-600 rounded-md text-[8px] font-black uppercase">{membership.role}</span>
                                                ) : (
                                                    <button className="text-[8px] font-black text-indigo-600 uppercase hover:underline">Add Member</button>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                        <div className="p-8 bg-slate-50 border-t flex justify-end">
                            <button onClick={() => setIsUserModalOpen(false)} className="px-10 py-4 bg-slate-900 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl active:scale-95 transition-all">
                                Close Details
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default RootAdminView;
