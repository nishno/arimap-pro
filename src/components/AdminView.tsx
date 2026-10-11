
import React, { useState } from 'react';
import type { User, UserRole, Organization, Membership, AppMode } from '../types';
import { ShieldCheckIcon, TrashIcon, SearchIcon, AlertTriangleIcon, NoSymbolIcon, CheckIcon, LockClosedIcon } from './Icons';

interface AdminViewProps {
    users: User[];
    onUpdateUser: (user: User) => void;
    onDeleteUser: (userId: string) => void;
    organizations: Organization[];
    onUpdateOrganization: (org: Organization) => void;
    onDeleteOrganization: (orgId: string) => void;
    memberships: Membership[];
    onResetPassword: (email: string) => Promise<void>;
}

const AdminView: React.FC<AdminViewProps> = ({ users, onUpdateUser, onDeleteUser, organizations, onUpdateOrganization, onDeleteOrganization, memberships, onResetPassword }) => {
    const [searchQuery, setSearchQuery] = useState('');
    const [viewMode, setViewMode] = useState<'ecosystem' | 'users' | 'organizations'>('ecosystem');

    const ecosystemItems = [
        ...users.map(u => ({ type: 'user' as const, data: u })),
        ...organizations.map(o => ({ type: 'org' as const, data: o }))
    ].filter(item => {
        // Filter by viewMode first
        if (viewMode === 'users' && item.type !== 'user') return false;
        if (viewMode === 'organizations' && item.type !== 'org') return false;

        const query = searchQuery.toLowerCase();
        if (item.type === 'user') {
            const u = item.data as User;
            return u.name.toLowerCase().includes(query) || 
                   u.email.toLowerCase().includes(query) ||
                   (u.roles || []).some(r => r.toLowerCase().includes(query));
        } else {
            const o = item.data as Organization;
            return o.name.toLowerCase().includes(query) || 
                   o.legalName?.toLowerCase().includes(query) ||
                   o.registrationNumber?.toLowerCase().includes(query);
        }
    });

    const handleUserStatusChange = (userId: string, newStatus: User['status']) => {
        const user = users.find(u => u.id === userId);
        if (user) {
            onUpdateUser({ ...user, status: newStatus });
        }
    };

    const handleOrgStatusChange = (orgId: string, newStatus: Organization['status']) => {
        const org = organizations.find(o => o.id === orgId);
        if (org) {
            onUpdateOrganization({ ...org, status: newStatus });
        }
    };

    const handleUserRoleToggle = (userId: string, role: UserRole) => {
        const user = users.find(u => u.id === userId);
        if (!user || role === 'ROOT_SUPER_ADMIN') return;
        const currentRoles = user.roles || [];
        const newRoles = currentRoles.includes(role) 
            ? currentRoles.filter(r => r !== role)
            : [...currentRoles, role];
        onUpdateUser({ ...user, roles: newRoles });
    };

    const handleUserModuleToggle = (userId: string, module: AppMode) => {
        const user = users.find(u => u.id === userId);
        if (!user) return;
        const currentModules = user.visibleModules || [];
        const newModules = currentModules.includes(module)
            ? currentModules.filter(m => m !== module)
            : [...currentModules, module];
        onUpdateUser({ ...user, visibleModules: newModules });
    };

    const handleUpdateUserSubscription = (userId: string, updates: Partial<User>) => {
        const user = users.find(u => u.id === userId);
        if (user) {
            onUpdateUser({ ...user, ...updates });
        }
    };

    const handleUpdateOrgSubscription = (orgId: string, updates: Partial<Organization>) => {
        const org = organizations.find(o => o.id === orgId);
        if (org) {
            onUpdateOrganization({ ...org, ...updates });
        }
    };

    const getAffiliation = (userId: string) => {
        const membership = memberships.find(m => m.userId === userId);
        if (membership) {
            const org = organizations.find(o => o.id === membership.organizationId);
            return org ? { name: org.name, role: membership.role } : null;
        }
        return null;
    };

    return (
        <main className="flex-1 bg-[#F8FAFC] overflow-y-auto p-4 md:p-8">
            <div className="max-w-[1600px] mx-auto space-y-8 pb-24">
                {/* Header Section */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
                    <div>
                        <div className="flex items-center gap-3 mb-2">
                            <div className="bg-indigo-600 p-2 rounded-xl shadow-lg shadow-indigo-200">
                                <ShieldCheckIcon className="w-6 h-6 text-white" />
                            </div>
                            <h1 className="text-3xl font-black text-slate-900 tracking-tight uppercase">
                                Agrimap <span className="text-indigo-600">Pro</span>
                            </h1>
                        </div>
                        <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">Global Root Management Dashboard</p>
                    </div>
                    
                    <div className="flex gap-4">
                        <div className="bg-white px-6 py-4 rounded-3xl shadow-sm border border-slate-200 flex flex-col">
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Total Identities</span>
                            <span className="text-2xl font-black text-slate-900">{users.length + organizations.length}</span>
                        </div>
                        <div className="bg-white px-6 py-4 rounded-3xl shadow-sm border border-slate-200 flex flex-col">
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Active Orgs</span>
                            <span className="text-2xl font-black text-indigo-600">{organizations.filter(o => o.status === 'active').length}</span>
                        </div>
                    </div>
                </div>

                {/* Search & View Controls */}
                <div className="flex flex-col md:flex-row gap-4 items-center justify-between bg-white p-4 rounded-[2rem] shadow-sm border border-slate-100">
                    <div className="flex bg-slate-100 p-1.5 rounded-2xl w-full md:w-auto">
                        <button 
                            onClick={() => setViewMode('ecosystem')} 
                            className={`flex-1 md:flex-none px-8 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${viewMode === 'ecosystem' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                        >
                            Master Ecosystem
                        </button>
                        <button 
                            onClick={() => setViewMode('users')} 
                            className={`flex-1 md:flex-none px-8 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${viewMode === 'users' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                        >
                            Users
                        </button>
                        <button 
                            onClick={() => setViewMode('organizations')} 
                            className={`flex-1 md:flex-none px-8 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${viewMode === 'organizations' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                        >
                            Organizations
                        </button>
                    </div>

                    <div className="relative w-full md:w-96">
                        <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                        <input 
                            type="text" 
                            placeholder="Search by name, email, or ID..." 
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            className="pl-12 pr-6 py-3.5 w-full border-none rounded-2xl font-bold text-sm bg-slate-50 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                        />
                    </div>
                </div>

                {/* Main Table */}
                <div className="bg-white rounded-[2.5rem] shadow-xl shadow-slate-200/50 border border-slate-200 overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-slate-100">
                            <thead className="bg-slate-50/50 text-slate-400 text-[10px] font-black uppercase tracking-widest text-left">
                                <tr>
                                    <th className="px-8 py-6">Entity (Name/Email)</th>
                                    <th className="px-8 py-6">Subscription & Financials</th>
                                    <th className="px-8 py-6">Role Assignment</th>
                                    <th className="px-8 py-6">Module Access</th>
                                    <th className="px-8 py-6">Ownership/Link</th>
                                    <th className="px-8 py-6 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-slate-50">
                                {ecosystemItems.map((item, idx) => {
                                    const isUser = item.type === 'user';
                                    const data = item.data;
                                    const id = isUser ? (data as User).id : (data as Organization).id;
                                    const name = isUser ? (data as User).name : (data as Organization).name;
                                    const email = isUser ? (data as User).email : (data as Organization).registrationNumber;
                                    const status = data.status;
                                    const isRoot = isUser && (data as User).roles?.includes('ROOT_SUPER_ADMIN');

                                    return (
                                        <tr key={`${item.type}-${id}`} className={`group hover:bg-slate-50/80 transition-all ${isRoot ? 'bg-indigo-50/20' : ''}`}>
                                            {/* Entity Info */}
                                            <td className="px-8 py-6">
                                                <div className="flex items-center gap-4">
                                                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-black text-xl shadow-sm transition-transform group-hover:scale-110 ${isRoot ? 'bg-indigo-600 text-white' : isUser ? 'bg-slate-100 text-slate-400' : 'bg-emerald-100 text-emerald-600'}`}>
                                                        {(name && typeof name === 'string') ? name.charAt(0).toUpperCase() : '?'}
                                                    </div>
                                                    <div>
                                                        <div className="font-black text-slate-900 uppercase tracking-tight flex items-center gap-2">
                                                            {name}
                                                            {isRoot && <ShieldCheckIcon className="w-4 h-4 text-indigo-600" />}
                                                        </div>
                                                        <div className="text-[10px] font-bold text-slate-400 tracking-wider uppercase">
                                                            {isUser ? (data as User).email : (data as Organization).legalName || (data as Organization).registrationNumber}
                                                        </div>
                                                        {!isUser && (data as Organization).registrationNumber && (
                                                            <div className="text-[9px] font-bold text-slate-300 uppercase tracking-widest mt-0.5">
                                                                Reg: {(data as Organization).registrationNumber}
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </td>

                                            {/* Subscription & Financials */}
                                            <td className="px-8 py-6">
                                                <div className="space-y-3">
                                                    {isUser ? (
                                                        <>
                                                            <div className="flex items-center gap-2">
                                                                <span className={`px-2 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-widest ${status === 'active' ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-slate-400'}`}>
                                                                    Status: {status}
                                                                </span>
                                                                <button 
                                                                    onClick={() => handleUpdateUserSubscription(id, { isFree: !(data as User).isFree })}
                                                                    className={`px-2 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-widest ${(data as User).isFree ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-100 text-slate-400'}`}
                                                                >
                                                                    {(data as User).isFree ? '100% DISCOUNT (FREE)' : 'PAID USER'}
                                                                </button>
                                                            </div>
                                                            <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                                                                <div className="flex flex-col gap-0.5">
                                                                    <span className="text-[8px] font-black text-slate-400 uppercase tracking-tighter">Discount %</span>
                                                                    <div className="flex items-center gap-1">
                                                                        <input 
                                                                            type="number" 
                                                                            value={(data as User).discount || 0}
                                                                            onChange={(e) => handleUpdateUserSubscription(id, { discount: parseInt(e.target.value) })}
                                                                            className="w-12 bg-slate-100 border-none rounded-md text-[10px] font-black p-1.5 focus:ring-1 focus:ring-indigo-500"
                                                                        />
                                                                        <span className="text-[10px] font-black text-slate-400">%</span>
                                                                    </div>
                                                                </div>
                                                                <div className="flex flex-col gap-0.5">
                                                                    <span className="text-[8px] font-black text-slate-400 uppercase tracking-tighter">Expiry Date</span>
                                                                    <input 
                                                                        type="date" 
                                                                        value={(data as User).subscriptionExpiry?.split('T')[0] || ''}
                                                                        onChange={(e) => handleUpdateUserSubscription(id, { subscriptionExpiry: new Date(e.target.value).toISOString() })}
                                                                        className="bg-slate-100 border-none rounded-md text-[10px] font-black p-1.5 focus:ring-1 focus:ring-indigo-500"
                                                                    />
                                                                </div>
                                                            </div>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <div className="flex items-center gap-2">
                                                                <span className="px-2 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-widest bg-emerald-100 text-emerald-600">
                                                                    Plan: {(data as Organization).tier}
                                                                </span>
                                                                <button 
                                                                    onClick={() => handleUpdateOrgSubscription(id, { isPaid: !(data as Organization).isPaid })}
                                                                    className={`px-2 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-widest ${(data as Organization).isPaid ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-100 text-slate-400'}`}
                                                                >
                                                                    {(data as Organization).isPaid ? 'PAID SUBSCRIPTION' : 'FREE TRIAL'}
                                                                </button>
                                                            </div>
                                                            <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                                                                <div className="flex flex-col gap-0.5">
                                                                    <span className="text-[8px] font-black text-slate-400 uppercase tracking-tighter">Discount %</span>
                                                                    <div className="flex items-center gap-1">
                                                                        <input 
                                                                            type="number" 
                                                                            value={(data as Organization).discount || 0}
                                                                            onChange={(e) => handleUpdateOrgSubscription(id, { discount: parseInt(e.target.value) })}
                                                                            className="w-12 bg-slate-100 border-none rounded-md text-[10px] font-black p-1.5 focus:ring-1 focus:ring-indigo-500"
                                                                        />
                                                                        <span className="text-[10px] font-black text-slate-400">%</span>
                                                                    </div>
                                                                </div>
                                                                <div className="flex flex-col gap-0.5">
                                                                    <span className="text-[8px] font-black text-slate-400 uppercase tracking-tighter">Trial Expiry</span>
                                                                    <input 
                                                                        type="date" 
                                                                        value={(data as Organization).trialExpiry?.split('T')[0] || ''}
                                                                        onChange={(e) => handleUpdateOrgSubscription(id, { trialExpiry: new Date(e.target.value).toISOString() })}
                                                                        className="bg-slate-100 border-none rounded-md text-[10px] font-black p-1.5 focus:ring-1 focus:ring-indigo-500"
                                                                    />
                                                                </div>
                                                                <div className="flex flex-col gap-0.5 col-span-2">
                                                                    <span className="text-[8px] font-black text-slate-400 uppercase tracking-tighter">Payroll Config</span>
                                                                    <select 
                                                                        value={(data as Organization).payrollConfig?.frequency || 'Global'}
                                                                        onChange={(e) => handleUpdateOrgSubscription(id, { payrollConfig: { ...(data as Organization).payrollConfig || { rate: 0, frequency: 'monthly' }, frequency: e.target.value } })}
                                                                        className="bg-slate-100 border-none rounded-md text-[10px] font-black p-1.5 focus:ring-1 focus:ring-indigo-500 w-full"
                                                                    >
                                                                        <option value="Global">Global Frequency</option>
                                                                        <option value="monthly">Monthly Cycle</option>
                                                                        <option value="weekly">Weekly Cycle</option>
                                                                    </select>
                                                                </div>
                                                            </div>
                                                        </>
                                                    )}
                                                </div>
                                            </td>

                                            {/* Role Assignment */}
                                            <td className="px-8 py-6">
                                                <div className="flex flex-wrap gap-1.5 max-w-[200px]">
                                                    {isUser ? (
                                                        (data as User).roles?.map(role => (
                                                            <span key={role} className={`px-2.5 py-1 rounded-lg text-[8px] font-black uppercase tracking-widest flex items-center gap-1.5 shadow-sm ${role === 'ROOT_SUPER_ADMIN' ? 'bg-red-600 text-white' : 'bg-white border border-slate-200 text-slate-600'}`}>
                                                                {role}
                                                                {!isRoot && (
                                                                    <button onClick={() => handleUserRoleToggle(id, role)} className="hover:text-red-500 transition-colors">
                                                                        <TrashIcon className="w-2.5 h-2.5" />
                                                                    </button>
                                                                )}
                                                            </span>
                                                        ))
                                                    ) : (
                                                        <span className="px-2.5 py-1 rounded-lg text-[8px] font-black uppercase tracking-widest bg-slate-900 text-white shadow-sm">
                                                            Company
                                                        </span>
                                                    )}
                                                    {isUser && !isRoot && (
                                                        <select 
                                                            className="text-[8px] font-black uppercase tracking-widest bg-indigo-50 text-indigo-600 rounded-lg px-2.5 py-1 outline-none border-none cursor-pointer hover:bg-indigo-100 transition-colors"
                                                            onChange={(e) => { if(e.target.value) handleUserRoleToggle(id, e.target.value as any); e.target.value = ''; }}
                                                        >
                                                            <option value="">+ Assign Role</option>
                                                            <option value="Admin">Admin</option>
                                                            <option value="Founder">Founder</option>
                                                            <option value="Co-Founder">Co-Founder</option>
                                                            <option value="Employee">Employee</option>
                                                            <option value="Agronomist">Agronomist</option>
                                                            <option value="Field Manager">Field Manager</option>
                                                            <option value="Accountant">Accountant</option>
                                                            <option value="worker">Worker</option>
                                                            <option value="Independent">Independent</option>
                                                        </select>
                                                    )}
                                                </div>
                                            </td>

                                            {/* Module Access */}
                                            <td className="px-8 py-6">
                                                <div className="flex flex-wrap gap-1.5 max-w-[200px]">
                                                    {isUser ? (
                                                        (data as User).visibleModules?.map(mod => (
                                                            <span key={mod} className="px-2.5 py-1 rounded-lg text-[8px] font-black uppercase tracking-widest bg-blue-50 text-blue-600 border border-blue-100 flex items-center gap-1.5 shadow-sm">
                                                                {mod}
                                                                <button onClick={() => handleUserModuleToggle(id, mod)} className="hover:text-red-500 transition-colors">
                                                                    <TrashIcon className="w-2.5 h-2.5" />
                                                                </button>
                                                            </span>
                                                        ))
                                                    ) : (
                                                        <div className="flex flex-col gap-1">
                                                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Inventory, CRM, Maps</span>
                                                            <span className="text-[8px] font-bold text-indigo-600 uppercase">Global Access</span>
                                                        </div>
                                                    )}
                                                    {isUser && (
                                                        <select 
                                                            className="text-[8px] font-black uppercase tracking-widest bg-blue-50 text-blue-600 rounded-lg px-2.5 py-1 outline-none border-none cursor-pointer hover:bg-blue-100 transition-colors"
                                                            onChange={(e) => { if(e.target.value) handleUserModuleToggle(id, e.target.value as any); e.target.value = ''; }}
                                                        >
                                                            <option value="">+ Module</option>
                                                            <option value="dashboard">Dashboard</option>
                                                            <option value="ai">AI Analyst</option>
                                                            <option value="marketplace">Marketplace</option>
                                                            <option value="tasks">Tasks</option>
                                                            <option value="agronomy">Agronomy</option>
                                                            <option value="harvesting">Harvesting</option>
                                                            <option value="stock">Stock</option>
                                                            <option value="accounting">Accounting</option>
                                                            <option value="settings">Settings</option>
                                                            <option value="logs">Logs</option>
                                                        </select>
                                                    )}
                                                </div>
                                            </td>

                                            {/* Ownership/Link */}
                                            <td className="px-8 py-6">
                                                {isUser ? (
                                                    <div className="flex flex-col gap-1">
                                                        {getAffiliation(id) ? (
                                                            <>
                                                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Belongs to:</span>
                                                                <div className="flex items-center gap-2">
                                                                    <div className="w-6 h-6 rounded-lg bg-emerald-100 text-emerald-600 flex items-center justify-center text-[10px] font-black">
                                                                        {(() => {
                                                                            const affName = getAffiliation(id)?.name;
                                                                            return (affName && typeof affName === 'string') ? affName.charAt(0).toUpperCase() : '?';
                                                                        })()}
                                                                    </div>
                                                                    <span className="text-[11px] font-black text-slate-700 uppercase">{getAffiliation(id)?.name}</span>
                                                                </div>
                                                                <span className="text-[9px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full inline-block self-start mt-1 uppercase tracking-widest">
                                                                    {getAffiliation(id)?.role}
                                                                </span>
                                                            </>
                                                        ) : (
                                                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest italic">Direct User</span>
                                                        )}
                                                    </div>
                                                ) : (
                                                    <div className="flex flex-col gap-1">
                                                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Parent Entity</span>
                                                        <div className="flex items-center gap-2">
                                                            <div className="w-6 h-6 rounded-lg bg-slate-900 text-white flex items-center justify-center text-[10px] font-black">
                                                                {(name && typeof name === 'string') ? name.charAt(0).toUpperCase() : '?'}
                                                            </div>
                                                            <span className="text-[11px] font-black text-slate-900 uppercase">Corporate Root</span>
                                                        </div>
                                                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1">
                                                            {(data as Organization).type}
                                                        </span>
                                                    </div>
                                                )}
                                            </td>

                                            {/* Actions */}
                                            <td className="px-8 py-6 text-right">
                                                {!isRoot && (
                                                    <div className="flex justify-end gap-3">
                                                        {isUser && (
                                                            <button 
                                                                onClick={() => {
                                                                    console.log(`Resetting password for user: ${email}`);
                                                                    onResetPassword(email);
                                                                }}
                                                                className="flex items-center gap-2 px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest bg-indigo-50 text-indigo-600 border border-indigo-100 hover:bg-indigo-100 transition-all shadow-sm"
                                                                title="Reset Password"
                                                            >
                                                                <LockClosedIcon className="w-4 h-4" />
                                                                Reset Pass
                                                            </button>
                                                        )}
                                                        <button 
                                                            onClick={() => isUser ? handleUserStatusChange(id, status === 'blocked' ? 'active' : 'blocked') : handleOrgStatusChange(id, status === 'blocked' ? 'active' : 'blocked')}
                                                            className={`flex items-center gap-2 px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-sm border ${status === 'blocked' ? 'bg-emerald-50 text-emerald-600 border-emerald-100 hover:bg-emerald-100' : 'bg-slate-50 text-slate-400 border-slate-100 hover:bg-red-50 hover:text-red-600 hover:border-red-100'}`}
                                                            title={status === 'blocked' ? 'Activate' : 'Block'}
                                                        >
                                                            {status === 'blocked' ? <CheckIcon className="w-4 h-4" /> : <NoSymbolIcon className="w-4 h-4" />}
                                                            {status === 'blocked' ? 'Activate' : 'Block'}
                                                        </button>
                                                        
                                                        <button 
                                                            onClick={() => { if(window.confirm(`PERMANENT PURGE: ${name}? This action cannot be undone.`)) isUser ? onDeleteUser(id) : onDeleteOrganization(id); }}
                                                            className="flex items-center gap-2 px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest bg-slate-50 text-slate-400 border border-slate-100 hover:bg-red-600 hover:text-white hover:border-red-600 transition-all shadow-sm"
                                                            title="Delete"
                                                        >
                                                            <TrashIcon className="w-4 h-4" />
                                                            Delete
                                                        </button>
                                                    </div>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </main>
    );
};

export default AdminView;
