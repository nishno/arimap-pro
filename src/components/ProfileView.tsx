import React, { useState, useMemo, useEffect } from 'react';
import { toast } from 'sonner';
import type { User, Organization, Membership, UserGoal, UserRole, AppMode, WorkExperience, Review, Employee, OrganizationType, AgricultureType, ForumPost } from '../types';
import { UserCircleIcon, PlusCircleIcon, BuildingStorefrontIcon, ShoppingBagIcon, HomeIcon, BriefcaseIcon, TrashIcon, UserGroupIcon, StarIcon, PlusIcon, XIcon, ChevronLeftIcon, ShieldCheckIcon, PencilIcon, BeakerIcon, BanknotesIcon, RectangleGroupIcon, ChevronRightIcon, CheckIcon, SearchIcon, UsersIcon, MapPinIcon, MapIcon, SaveIcon } from './Icons';
import MapComponent from './MapComponent';
import { auth, bulkUpdateSyncStatus, db, doc, setDoc } from '../firebase';
import { USE_FIREBASE } from '../config';
import { updatePassword } from 'firebase/auth';
import { KeyIcon } from './Icons';
import { useLanguage } from '../contexts/LanguageContext';
import { Database, RefreshCw, HardDrive, ChevronDown, ChevronUp, BookOpen, Home, HelpCircle, FileText, Download } from 'lucide-react';
import { safeStorage } from '../services/storageService';

interface ProfileViewProps {
    currentUser: User;
    onUpdateUser: (user: User) => void;
    onSwitchRole?: (role: 'individual' | 'company' | 'worker') => void;
    users?: User[];
    organizations: Organization[];
    discoverableOrganizations?: Organization[];
    memberships?: Membership[];
    onAddOrg?: (org: Organization, mem: Membership) => void;
    onSetAppMode?: (mode: AppMode) => void;
    onOpenHomepage?: () => void;
    allEmployees?: Employee[];
    reviews?: Review[];
    onOpenOrganizationModal?: () => void;
    currentOrganizationContext?: string | 'personal';
    onSetOrganizationContext?: (context: string | 'personal') => void;
    onExportBackup?: () => void;
    onAddPost?: (post: Partial<ForumPost>) => void;
    onStartMapRegistration?: (regData: any) => void;
    onSetMapCenter?: (center: [number, number]) => void;
    onSetMapZoom?: (zoom: number) => void;
    onSelectFeature?: (id: string | null, options?: { event?: MouseEvent; fromPanel?: boolean }) => void;
    plantationFeatures?: any[];
    layers?: any[];
    onUpdateOrg?: (org: Organization) => void;
    onDeleteAccount?: () => void;
    isSystemAdmin?: boolean;
    isManualOffline?: boolean;
    onToggleOffline?: () => void;
    onPushToFirestore?: () => void;
    autoOpenIdentity?: boolean;
    onClearAutoOpenIdentity?: () => void;
}

import SubscriptionModal from './SubscriptionModal';

const transliterateGeoToEng = (str: string): string => {
  const geoToEngMap: { [key: string]: string } = {
    'ა': 'a', 'ბ': 'b', 'გ': 'g', 'დ': 'd', 'ე': 'e', 'ვ': 'v', 'ზ': 'z', 'თ': 't',
    'ი': 'i', 'კ': 'k', 'ლ': 'l', 'მ': 'm', 'ნ': 'n', 'ო': 'o', 'პ': 'p', 'ჟ': 'zh',
    'რ': 'r', 'ს': 's', 'ტ': 't', 'უ': 'u', 'ფ': 'p', 'ქ': 'k', 'ღ': 'gh', 'ყ': 'q',
    'შ': 'sh', 'ჩ': 'ch', 'ც': 'ts', 'ძ': 'dz', 'წ': 'ts', 'ჭ': 'ch', 'ხ': 'kh', 'ჯ': 'j', 'ჰ': 'h'
  };
  return str.split('').map(char => geoToEngMap[char] || char).join('');
};

const transliterateEngToGeo = (str: string): string => {
  const engToGeoMap: { [key: string]: string } = {
    'a': 'ა', 'b': 'ბ', 'g': 'გ', 'd': 'დ', 'e': 'ე', 'v': 'ვ', 'z': 'ზ', 't': 'თ',
    'i': 'ი', 'k': 'კ', 'l': 'ლ', 'm': 'მ', 'n': 'ნ', 'o': 'ო', 'p': 'პ', 'r': 'რ',
    's': 'ს', 'u': 'უ', 'q': 'ყ', 'j': 'ჯ', 'h': 'ჰ'
  };
  return str.split('').map(char => engToGeoMap[char.toLowerCase()] || char).join('');
};

const ProfileView: React.FC<ProfileViewProps> = (props) => {
    const { 
        currentUser: user, onUpdateUser, users = [], organizations, discoverableOrganizations = [], memberships = [], 
        onAddOrg, onSetAppMode, onOpenHomepage, allEmployees = [], reviews = [], 
        onOpenOrganizationModal, currentOrganizationContext, onSetOrganizationContext,
        onExportBackup, onSetMapCenter, onSetMapZoom, onSelectFeature,
        plantationFeatures = [], layers = [], onUpdateOrg, onDeleteAccount, isSystemAdmin,
        isManualOffline, onToggleOffline, onPushToFirestore,
        autoOpenIdentity, onClearAutoOpenIdentity
    } = props;
    
    const [activeModal, setActiveModal] = useState<UserGoal | null>(null);
    const [isRegistrationOpen, setIsRegistrationOpen] = useState(false);
    
    useEffect(() => {
        if (autoOpenIdentity) {
            setIsRegistrationOpen(true);
            if (onClearAutoOpenIdentity) {
                onClearAutoOpenIdentity();
            }
        }
    }, [autoOpenIdentity, onClearAutoOpenIdentity]);
    const [isVerificationOpen, setIsVerificationOpen] = useState(false);
    const [isSubscriptionOpen, setIsSubscriptionOpen] = useState(false);
    const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
    const [newPassword, setNewPassword] = useState('');
    const [isChangingPassword, setIsChangingPassword] = useState(false);
    const [showOrgResults, setShowOrgResults] = useState(false);
    const [orgSearchQuery, setOrgSearchQuery] = useState('');
    const [myOrgSearchQuery, setMyOrgSearchQuery] = useState('');
    const [showAllOrgs, setShowAllOrgs] = useState(false);
    const [discoveryOrg, setDiscoveryOrg] = useState<Organization | null>(null);
    const [debouncedOrgQuery, setDebouncedOrgQuery] = useState('');
    const [editingOrg, setEditingOrg] = useState<Organization | null>(null);
    const [isEditOrgModalOpen, setIsEditOrgModalOpen] = useState(false);
    const [editOrgData, setEditOrgData] = useState<Partial<Organization>>({});
    const [isIdentityExpanded, setIsIdentityExpanded] = useState(false);
    const [isItemListModalOpen, setIsItemListModalOpen] = useState(false);
    const { t, language } = useLanguage();
    
    const [isSyncingLocal, setIsSyncingLocal] = useState(false);

    const handleDownloadItemList = async () => {
        try {
            const res = await fetch('/item list.txt');
            if (res.ok) {
                const text = await res.text();
                const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = 'item list.txt';
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
                toast.success("Downloaded item list.txt successfully!");
            } else {
                toast.error("Failed to load item list file.");
            }
        } catch (e) {
            toast.error("Error downloading item list.");
        }
    };

    const handleSyncToLAN = async () => {
        const savedConfig = localStorage.getItem('agrimap-local-config');
        if (!savedConfig) {
            toast.error("Private LAN node is not configured. Please initialize/verify connection in the local server modal.");
            return;
        }

        let config;
        try {
            config = JSON.parse(savedConfig);
        } catch {
            toast.error("Failed to read local server configurations.");
            return;
        }

        if (!config || !config.serverIp) {
            toast.error("Private LAN IP address is missing. Set it up inside the local server configuration.");
            return;
        }

        setIsSyncingLocal(true);
        try {
            const syncQueueString = localStorage.getItem('agrimap-pending-sync') || '[]';
            const syncQueue = JSON.parse(syncQueueString);
            const pendingItems = syncQueue.filter((i: any) => i.status === 'pending' || i.status === 'error');
            
            if (pendingItems.length === 0) {
                toast.success("All local records are currently synchronized with the LAN backup directory!");
                setIsSyncingLocal(false);
                return;
            }

            let host = config.serverIp.trim();
            let checkPort = config.serverPort || 3000;
            if (host.includes(':')) {
                const parts = host.split(':');
                host = parts[0];
                const parsedPort = parseInt(parts[1], 10);
                if (!isNaN(parsedPort)) {
                    checkPort = parsedPort;
                }
            }

            const url = `http://${host}:${checkPort}/api/sync`;
            const devId = localStorage.getItem('agrimap-device-id') || 'dev-unknown';
            
            let successCount = 0;
            
            for (const item of pendingItems) {
                try {
                    const response = await fetch(url, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            path: item.path,
                            type: item.type,
                            data: item.data,
                            deviceId: devId,
                            dataFolder: config.dataFolder || '',
                            timestamp: item.timestamp || new Date().toISOString()
                        })
                    });
                    
                    if (response.ok) {
                        successCount++;
                    }
                } catch (err) {
                    console.error("Local sync single item error:", err);
                }
            }
            
            if (successCount > 0) {
                const chunkIds = pendingItems.slice(0, successCount).map((i: any) => i.id);
                bulkUpdateSyncStatus(chunkIds, 'local_synced');
                toast.success(`Success! Saved ${successCount}/${pendingItems.length} records to local backup directory.`);
            } else {
                toast.error("Mirrored local backup node failed. Check server connection & data write folder.");
            }
        } catch (e) {
            console.error("Local Server sync failed", e);
            toast.error("An error occurred during manual local sync.");
        } finally {
            setIsSyncingLocal(false);
        }
    };
    
    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedOrgQuery(orgSearchQuery);
        }, 500);
        return () => clearTimeout(timer);
    }, [orgSearchQuery]);

    const [regData, setRegData] = useState({
        name: '',
        taxNumber: '',
        type: 'LTD' as OrganizationType,
        agricultureType: 'General' as AgricultureType,
        role: 'Founder' as UserRole,
        isDiscoverable: true,
        establishmentDate: new Date().toISOString().split('T')[0],
        selectedCrops: [] as {name: string, varieties: string[]}[],
        region: '',
        areaHa: 0
    });

    const COMMON_CROPS = ["Blueberry", "Raspberry", "Blackberry", "Strawberry", "Wine Grapes", "Table Grapes", "Walnut", "Hazelnut", "Almond"];

    const [verificationData, setVerificationData] = useState({
        mobileNumber: user?.phone || '',
        region: user?.region || '',
        personalNumber: user?.personalNumber || '',
    });

    if (!user) {
        return (
            <div className="flex-1 flex items-center justify-center p-8 bg-slate-50">
                <div className="text-center space-y-4">
                    <div className="w-16 h-16 bg-slate-200 rounded-full flex items-center justify-center mx-auto animate-pulse">
                        <UserCircleIcon size={32} className="text-slate-400" />
                    </div>
                    <p className="text-sm font-bold text-slate-500 uppercase tracking-widest">Profile session initializing...</p>
                    <button onClick={() => window.location.reload()} className="px-6 py-2 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest">Reboot Application</button>
                </div>
            </div>
        );
    }

    const handleVerifyProfile = () => {
        if (!verificationData.mobileNumber || !verificationData.region || !verificationData.personalNumber) {
            return toast.error("Please fill in all verification fields.");
        }

        const isDuplicatePhone = (users || []).some(u => u.id !== user.id && u.phone === verificationData.mobileNumber);
        if (isDuplicatePhone) return toast.error("This phone number is already registered with another account.");

        const isDuplicateId = (users || []).some(u => u.id !== user.id && u.personalNumber === verificationData.personalNumber);
        if (isDuplicateId) return toast.error("This Personal ID Number is already registered with another account.");

        onUpdateUser({
            ...user,
            phone: verificationData.mobileNumber,
            region: verificationData.region,
            personalNumber: verificationData.personalNumber,
            verificationStatus: 'verified',
            isGuest: false
        });

        // Automatically propagate ID number and phone number to matching employee records for HR systems integration
        const matchingEmps = (allEmployees || []).filter(emp => emp.email && emp.email.toLowerCase() === user.email?.toLowerCase());
        
        if (matchingEmps.length > 0) {
            matchingEmps.forEach((emp) => {
                const updatedEmp = {
                    ...emp,
                    idNumber: verificationData.personalNumber,
                    phone: verificationData.mobileNumber || emp.phone
                };
                
                if (USE_FIREBASE) {
                    setDoc(doc(db, 'employees', emp.id), updatedEmp).catch(console.error);
                }
            });
            toast.success(`Personal ID Number automatically propagated to ${matchingEmps.length} HR employee profiles.`);
        }

        setIsVerificationOpen(false);
        toast.success("Profile verified successfully!");
    };

    const handleUpdateOrgInternal = () => {
        if (!editingOrg || !onUpdateOrg) return;
        onUpdateOrg({ ...editingOrg, ...editOrgData as Organization });
        setIsEditOrgModalOpen(false);
        toast.success(t('common.save_success') || "Organization updated successfully!");
    };

    const handleNextStep = () => {
        if (!regData.name) return alert("Please enter a company name.");
        
        // Duplicate Tax Number Check
        if (regData.taxNumber && organizations.some(o => o.taxNumber === regData.taxNumber)) {
            return toast.error("A company with this tax number is already registered.");
        }

        const newOrg: Organization = {
            id: `org-${Date.now()}`,
            uniqueId: `Comp-${Math.floor(1000 + Math.random() * 9000)}`,
            name: regData.name,
            legalName: regData.name,
            registrationNumber: '',
            taxNumber: regData.taxNumber,
            type: regData.type,
            agricultureType: regData.agricultureType,
            isDiscoverable: regData.isDiscoverable,
            status: 'active',
            createdAt: new Date().toISOString(),
            createdBy: user.id,
            subscriptionStatus: 'Trial',
            trial_start_date: new Date().toISOString(),
            trialExpiry: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
            isPaid: false,
            tier: 'Free',
            country: 'Georgia', // Default
            establishmentDate: regData.establishmentDate,
        };

        const newMem: Membership = {
            id: `${user.id}_${newOrg.id}`,
            userId: user.id,
            organizationId: newOrg.id,
            role: regData.role,
            status: 'active',
            joinedAt: new Date().toISOString(),
            permissionLevel: 'admin'
        };

        const newExperience: WorkExperience = {
            id: `exp-${Date.now()}`,
            title: regData.role,
            company: regData.name,
            startDate: new Date().toISOString(),
            endDate: '',
            isCompanyRole: true,
            organizationId: newOrg.id,
            isDiscoverable: regData.isDiscoverable,
            isPublic: true
        };

        const updatedCV = {
            ...user.cv,
            experience: [newExperience, ...(user.cv?.experience || [])]
        };

        const updatedUser: User = { 
            ...user, 
            cv: updatedCV,
            phone: verificationData.mobileNumber,
            region: verificationData.region,
            establishmentDate: regData.establishmentDate,
            verificationStatus: 'verified',
            isGuest: false
        };

        if (onUpdateUser) onUpdateUser(updatedUser);
        if (onAddOrg) onAddOrg(newOrg, newMem);
        if (onSetAppMode) onSetAppMode('onboarding' as any);
        setIsRegistrationOpen(false);
    };

    const companyCreatorRoles: { role: UserRole; icon: React.ReactNode; desc: string }[] = [
        { role: 'Founder', icon: <ShieldCheckIcon size={24} />, desc: 'Full ownership & billing' },
        { role: 'Admin', icon: <PencilIcon size={24} />, desc: 'Operation management' },
        { role: 'Agronomist', icon: <BeakerIcon size={24} />, desc: 'Crop science & nutrition' },
        { role: 'Accountant', icon: <BanknotesIcon size={24} />, desc: 'Financial auditing' },
        { role: 'Field Manager', icon: <RectangleGroupIcon size={24} />, desc: 'Ground coordination' },
        { role: 'Agro-Agent', icon: <UserGroupIcon size={24} />, desc: 'Labor contracting' },
        { role: 'Employee', icon: <UserCircleIcon size={24} />, desc: 'Task execution' }
    ];

    const handleGoalSelect = (goal: UserGoal) => {
        if (goal === 'EXPLORE_GUEST') {
            if (onSetAppMode) {
                onUpdateUser({ ...user, primaryGoal: goal, isGuest: true, roles: ['Guest'] });
                onSetAppMode('dashboard');
            }
            return;
        }

        // Require Personal ID Number verification for all active professional/corporate roles
        if (user.verificationStatus !== 'verified' || !user.personalNumber) {
            setIsVerificationOpen(true);
            toast.error("Please complete your profile verification with your Personal ID Number before adding a role or organization.");
            return;
        }

        if (goal === 'MANAGE_COMPANY') {
            onUpdateUser({ ...user, primaryGoal: goal });
        } else {
            setActiveModal(goal);
        }
    };
    
    const goals: { id: UserGoal; label: string; icon: React.ReactNode; description: string }[] = [
        { id: 'MANAGE_COMPANY', label: 'Create/Join Organization', icon: <BuildingStorefrontIcon size={24}/>, description: "Set up a new company or join an existing one." },
        { id: 'OFFER_SERVICE', label: 'Offer Service / Find Job', icon: <BriefcaseIcon size={24}/>, description: "Register as a professional (e.g. Agronomist, Laborer)." },
        { id: 'BUY_PRODUCTS', label: 'Buy Products', icon: <ShoppingBagIcon size={24}/>, description: "Define your needs as an individual or corporate buyer." },
        { id: 'BECOME_AGENT', label: 'Become an Agro-Agent', icon: <UserGroupIcon size={24}/>, description: "Manage labor teams as a contractor (Brigadier)." },
        { id: 'EXPLORE_GUEST', label: 'Explore as Guest', icon: <HomeIcon size={24}/>, description: "Browse public marketplace and community features." },
    ];
    
    const [isWorkingAreaOpen, setIsWorkingAreaOpen] = useState(false);
    const [editingExperienceId, setEditingExperienceId] = useState<string | null>(null);

    const companyRoles = useMemo(() => (user.cv?.experience || []).filter(e => e.isCompanyRole), [user.cv?.experience]);
    const individualRoles = useMemo(() => (user.cv?.experience || []).filter(e => !e.isCompanyRole), [user.cv?.experience]);

    const renderExperienceItem = (e: WorkExperience) => {
        const isActive = currentOrganizationContext === e.organizationId;
        const startDate = e.startDate ? new Date(e.startDate).getFullYear() : 'N/A';
        const endDate = e.endDate ? new Date(e.endDate).getFullYear() : 'Present';
        
        return (
            <div key={e.id} className={`p-5 rounded-[2rem] border transition-all group relative ${isActive ? 'bg-indigo-50 border-indigo-200 shadow-lg shadow-indigo-100' : 'bg-white border-slate-100 hover:border-indigo-100 shadow-sm'}`}>
                {isActive && (
                    <div className="absolute -top-2 -right-2 bg-indigo-600 text-white p-1.5 rounded-full shadow-lg z-10">
                        <CheckIcon size={12} />
                    </div>
                )}
                
                <div className="flex justify-between items-start gap-4">
                    <div className="flex-1">
                        <div className="flex items-center gap-2">
                            <p className={`font-black uppercase tracking-tight text-sm ${isActive ? 'text-indigo-900' : 'text-slate-800'}`}>
                                {e.title} of {e.company} ({startDate} – {endDate})
                            </p>
                            {e.isDiscoverable && (
                                <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" title="Discoverable" />
                            )}
                        </div>
                        {e.location && (
                            <div className="flex items-center gap-1.5 text-slate-400 mt-1">
                                <span className="text-[10px] font-bold uppercase tracking-widest">| {e.location}</span>
                                <button 
                                    onClick={() => {
                                        if (e.locationCoords) {
                                            onSetMapCenter?.(e.locationCoords);
                                            onSetMapZoom?.(14);
                                        }
                                    }}
                                    className="text-indigo-600 hover:text-indigo-700 transition-colors"
                                    title="View on Map"
                                >
                                    <MapIcon size={12} />
                                </button>
                            </div>
                        )}
                        {e.description && (
                            <p className="text-[10px] text-slate-500 mt-2 leading-relaxed">{e.description}</p>
                        )}
                    </div>
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-4">
                    {e.rating !== undefined && (
                        <button className="flex items-center gap-1 text-amber-500 hover:text-amber-600 transition-colors">
                            <StarIcon size={12} />
                            <span className="text-[10px] font-black uppercase tracking-widest">See Review</span>
                        </button>
                    )}
                </div>

                <div className="mt-6 pt-4 border-t border-slate-100 flex flex-wrap items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                        <button 
                            onClick={() => {
                                setEditingExperienceId(e.id);
                                setIsWorkingAreaOpen(true);
                            }}
                            className="flex items-center gap-1 text-indigo-600 hover:text-indigo-700 transition-colors"
                        >
                            <MapPinIcon size={12} />
                            <span className="text-[8px] font-black uppercase tracking-widest">Set Work Zone</span>
                        </button>

                        <label className="flex items-center gap-2 cursor-pointer group/toggle">
                            <div 
                                onClick={() => {
                                    const updatedExp = (user.cv?.experience || []).map(item => 
                                        item.id === e.id ? { ...item, isDiscoverable: !item.isDiscoverable } : item
                                    );
                                    onUpdateUser({ ...user, cv: { ...user.cv, experience: updatedExp } });
                                }}
                                className={`w-8 h-4 rounded-full p-0.5 transition-all ${e.isDiscoverable ? 'bg-slate-800' : 'bg-slate-200'}`}
                            >
                                <div className={`bg-white w-3 h-3 rounded-full shadow-sm transition-transform ${e.isDiscoverable ? 'translate-x-4' : 'translate-x-0'}`} />
                            </div>
                            <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest group-hover/toggle:text-slate-600 transition-colors">Discoverable</span>
                        </label>

                        {e.isCompanyRole && (
                            <label className="flex items-center gap-2 cursor-pointer group/toggle">
                                <div 
                                    onClick={() => {
                                        const updatedExp = (user.cv?.experience || []).map(item => 
                                            item.id === e.id ? { ...item, isPublic: !item.isPublic } : item
                                        );
                                        onUpdateUser({ ...user, cv: { ...user.cv, experience: updatedExp } });
                                    }}
                                    className={`w-8 h-4 rounded-full p-0.5 transition-all ${e.isPublic ? 'bg-slate-800' : 'bg-slate-200'}`}
                                >
                                    <div className={`bg-white w-3 h-3 rounded-full shadow-sm transition-transform ${e.isPublic ? 'translate-x-4' : 'translate-x-0'}`} />
                                </div>
                                <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest group-hover/toggle:text-slate-600 transition-colors">Public</span>
                            </label>
                        )}
                    </div>

                    {e.organizationId && (
                        <button 
                            onClick={() => onSetOrganizationContext?.(isActive ? 'personal' : e.organizationId!)}
                            className={`px-4 py-2 rounded-xl font-black text-[9px] uppercase tracking-widest transition-all ${isActive ? 'bg-white text-indigo-600 border border-indigo-100 shadow-sm' : 'bg-indigo-600 text-white shadow-lg shadow-indigo-100 hover:bg-indigo-700 active:scale-95'}`}
                        >
                            {isActive ? 'Currently Managing' : `Switch to ${e.company}`}
                        </button>
                    )}
                </div>
            </div>
        );
    };

    const renderIdentityHierarchy = () => (
        <div className="bg-white rounded-[2.5rem] shadow-xl overflow-hidden border border-slate-100 mb-8 animate-slide-up">
            <div 
                onClick={() => setIsIdentityExpanded(!isIdentityExpanded)}
                className="p-8 border-b border-slate-100 bg-slate-50/50 flex flex-col md:flex-row justify-between items-center gap-4 cursor-pointer hover:bg-slate-100/60 transition-all select-none"
            >
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
                        {isIdentityExpanded ? <ChevronUp size={20} className="animate-pulse" /> : <ChevronDown size={20} className="animate-pulse" />}
                    </div>
                    <div>
                        <h2 className="text-xl font-black text-slate-800 uppercase tracking-tighter flex items-center gap-2">
                            {t('profile.master_identity_registry')}
                        </h2>
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">{t('profile.hierarchical_ids')}</p>
                    </div>
                </div>
                <button 
                    onClick={(e) => {
                        e.stopPropagation();
                        setIsIdentityExpanded(!isIdentityExpanded);
                    }}
                    className={`flex items-center gap-2 px-4 py-2 rounded-2xl border transition-all ${isIdentityExpanded ? 'bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-100' : 'bg-indigo-50 text-indigo-600 border-indigo-100'}`}
                >
                    <span className="text-[10px] font-black uppercase tracking-widest">{t('profile.global_id_passport')}</span>
                    <span className="font-mono text-sm font-black">{user.globalUniqueId}</span>
                </button>
            </div>

            {isIdentityExpanded && (
                <>
                    <div className="p-8 grid grid-cols-1 md:grid-cols-3 gap-6 animate-in fade-in duration-300">
                        {/* Individual Role */}
                        <div className={`p-6 rounded-3xl border-2 transition-all ${user.activeRole === 'individual' ? 'border-indigo-600 bg-indigo-50/30' : 'border-slate-100 bg-white hover:border-slate-200'}`}>
                            <div className="flex justify-between items-start mb-4">
                                <div className={`w-10 h-10 rounded-2xl flex items-center justify-center ${user.activeRole === 'individual' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-400'}`}>
                                    <BriefcaseIcon size={20} />
                                </div>
                                {user.activeRole === 'individual' && <span className="bg-indigo-600 text-white px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest">{t('profile.active_hat')}</span>}
                            </div>
                            <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest">{t('profile.individual_worker')}</h3>
                            <p className="text-[9px] text-slate-400 font-bold uppercase mt-1">{t('profile.freelance_tools')}</p>
                            <div className="mt-4 flex items-center justify-between">
                                <span className="font-mono text-[10px] font-black text-slate-600">{user.individualUniqueId || t('profile.unassigned')}</span>
                                {user.activeRole !== 'individual' && (
                                    <button onClick={() => props.onSwitchRole?.('individual')} className="text-[9px] font-black text-indigo-600 uppercase hover:underline">{t('profile.switch_role')}</button>
                                )}
                            </div>
                        </div>

                        {/* Company Role */}
                        <div className={`p-6 rounded-3xl border-2 transition-all ${user.activeRole === 'company' ? 'border-emerald-600 bg-emerald-50/30' : 'border-slate-100 bg-white hover:border-slate-200'}`}>
                            <div className="flex justify-between items-start mb-4">
                                <div className={`w-10 h-10 rounded-2xl flex items-center justify-center ${user.activeRole === 'company' ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-400'}`}>
                                    <BuildingStorefrontIcon size={20} />
                                </div>
                                {user.activeRole === 'company' && <span className="bg-emerald-600 text-white px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest">{t('profile.active_hat')}</span>}
                            </div>
                            <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest">{t('profile.company_founder')}</h3>
                            <p className="text-[9px] text-slate-400 font-bold uppercase mt-1">{t('profile.plantation_enterprise')}</p>
                            <div className="mt-4 flex items-center justify-between">
                                <span className="font-mono text-[10px] font-black text-slate-600">{user.companyUniqueId || t('profile.unassigned')}</span>
                                {user.activeRole !== 'company' && (
                                    <button onClick={() => props.onSwitchRole?.('company')} className="text-[9px] font-black text-emerald-600 uppercase hover:underline">{t('profile.switch_role')}</button>
                                )}
                            </div>
                        </div>

                        {/* Daily Worker Role */}
                        <div className={`p-6 rounded-3xl border-2 transition-all ${user.activeRole === 'worker' ? 'border-amber-600 bg-amber-50/30' : 'border-slate-100 bg-white hover:border-slate-200'}`}>
                            <div className="flex justify-between items-start mb-4">
                                <div className={`w-10 h-10 rounded-2xl flex items-center justify-center ${user.activeRole === 'worker' ? 'bg-amber-600 text-white' : 'bg-slate-100 text-slate-400'}`}>
                                    <UsersIcon size={20} />
                                </div>
                                {user.activeRole === 'worker' && <span className="bg-amber-600 text-white px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest">{t('profile.active_hat')}</span>}
                            </div>
                            <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest">{t('profile.global_daily_worker')}</h3>
                            <p className="text-[9px] text-slate-400 font-bold uppercase mt-1">{t('profile.external_hiring')}</p>
                            <div className="mt-4 flex items-center justify-between">
                                <span className="font-mono text-[10px] font-black text-slate-600">{user.workerUniqueId || t('profile.unassigned')}</span>
                                {user.activeRole !== 'worker' && (
                                    <button onClick={() => props.onSwitchRole?.('worker')} className="text-[9px] font-black text-amber-600 uppercase hover:underline">{t('profile.switch_role')}</button>
                                )}
                            </div>
                        </div>
                    </div>
                    
                    <div className="px-8 py-4 bg-slate-50 border-t border-slate-100 flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-indigo-600 animate-pulse"></div>
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{t('profile.logic_passport')}</p>
                    </div>
                </>
            )}
        </div>
    );

    const renderContent = () => {
        if (!user.primaryGoal) {
            return (
                <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100">
                    <h3 className="text-lg font-black uppercase tracking-tight text-slate-800 mb-2">Choose Your Primary Goal</h3>
                    <p className="text-sm text-slate-400 mb-8">Select your main objective to personalize your AgriMap experience.</p>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {goals.map(g => (
                            <button key={g.id} onClick={() => handleGoalSelect(g.id)} className="p-6 bg-slate-50/70 rounded-3xl border border-slate-100 text-left hover:bg-white hover:border-indigo-200 hover:shadow-2xl hover:shadow-indigo-50 hover:scale-105 transition-all group">
                                <div className="p-3 bg-white rounded-2xl inline-block shadow-sm mb-4 text-indigo-600 group-hover:text-indigo-700 transition-colors">
                                    {g.icon}
                                </div>
                                <h4 className="text-sm font-black text-slate-800">{g.label}</h4>
                                <p className="text-xs text-slate-500 mt-1">{g.description}</p>
                            </button>
                        ))}
                    </div>
                </div>
            );
        }

        if (user.primaryGoal === 'MANAGE_COMPANY') {
            return (
                 <div className="space-y-8 animate-slide-up">
                    <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100 space-y-4">
                        <h3 className="text-sm font-black uppercase tracking-tight text-slate-800 flex items-center gap-2"><BuildingStorefrontIcon className="text-slate-500" /> {t('profile.organizations_header')}</h3>
                        <p className="text-xs text-slate-400">{t('profile.organizations_desc')}</p>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-6 border-t border-slate-100">
                            <div className="space-y-4">
                                <div className="flex items-center justify-between">
                                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{t('profile.your_orgs')}</h4>
                                    <div className="relative w-48">
                                        <input 
                                            placeholder="Search your orgs..." 
                                            className="w-full bg-slate-50 border border-slate-100 rounded-xl px-8 py-1.5 text-[10px] font-bold text-slate-600 focus:ring-1 focus:ring-indigo-500 outline-none transition-all" 
                                            value={myOrgSearchQuery}
                                            onChange={(e) => setMyOrgSearchQuery(e.target.value)}
                                        />
                                        <SearchIcon size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    {(() => {
                                        const filteredMems = memberships.filter(m => {
                                            const org = organizations.find(o => o.id === m.organizationId);
                                            return org?.name?.toLowerCase().includes(myOrgSearchQuery.toLowerCase());
                                        });

                                        const displayedMems = showAllOrgs ? filteredMems : filteredMems.slice(0, 3);

                                        if (filteredMems.length === 0) {
                                            return (
                                                <div className="py-8 text-center border-2 border-dashed border-slate-100 rounded-2xl text-[10px] font-black text-slate-300 uppercase tracking-widest">
                                                    {myOrgSearchQuery ? 'No matching organizations' : 'No organizations joined yet'}
                                                </div>
                                            );
                                        }

                                        return (
                                            <>
                                                {displayedMems.map(m => {
                                                    const org = organizations.find(o => o.id === m.organizationId);
                                                    if (!org) return null;
                                                    return (
                                                        <div key={m.id} className="p-4 bg-white border border-slate-100 rounded-2xl flex justify-between items-center shadow-sm hover:border-indigo-100 transition-all">
                                                            <div className="flex-1">
                                                                <p className="text-xs font-black text-slate-800 uppercase">{org.name}</p>
                                                                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{org.type} • {org.agricultureType}</p>
                                                            </div>
                                                            <div className="flex items-center gap-3">
                                                                {m.role === 'Founder' && (
                                                                    <button 
                                                                        onClick={() => {
                                                                            setEditingOrg(org);
                                                                            setEditOrgData(org);
                                                                            setIsEditOrgModalOpen(true);
                                                                        }}
                                                                        className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                                                                    >
                                                                        <PencilIcon size={14} />
                                                                    </button>
                                                                )}
                                                                <div className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${m.role === 'Founder' ? 'bg-orange-100 text-orange-600' : 'bg-indigo-100 text-indigo-600'}`}>
                                                                    {m.role === 'Founder' ? '👑 Founder' : m.role}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                                {filteredMems.length > 3 && (
                                                    <button 
                                                        onClick={() => setShowAllOrgs(!showAllOrgs)}
                                                        className="w-full py-2 text-[9px] font-black text-indigo-600 uppercase tracking-widest hover:bg-indigo-50 rounded-xl transition-all"
                                                    >
                                                        {showAllOrgs ? 'Show Less' : `Show All (${filteredMems.length})`}
                                                    </button>
                                                 )}
                                            </>
                                        );
                                    })()}
                                </div>
                            </div>

                            <div className="space-y-6">
                                <div className="p-6 bg-slate-50/50 rounded-3xl border border-slate-100 text-center space-y-4">
                                    <h4 className="text-sm font-black text-slate-800">{t('profile.create_new_org')}</h4>
                                    <p className="text-xs text-slate-500">{t('profile.org_desc')}</p>
                                    <button 
                                        onClick={() => {
                                            if (user.verificationStatus !== 'verified' || !user.personalNumber) {
                                                setIsVerificationOpen(true);
                                                toast.error("Please verify your profile by providing your Personal ID Number before creating a company.");
                                            } else {
                                                setIsRegistrationOpen(true);
                                            }
                                        }} 
                                        className="w-full py-3 bg-indigo-600 text-white rounded-xl font-black text-[10px] uppercase tracking-widest shadow-lg shadow-indigo-100"
                                    >
                                        {t('profile.get_started')}
                                    </button>
                                </div>
                                <div className="p-6 bg-slate-50/50 rounded-3xl border border-slate-100 text-center space-y-4">
                                    <h4 className="text-sm font-black text-slate-800">{t('profile.join_org')}</h4>
                                    <div 
                                        className="relative"
                                        onFocus={() => setShowOrgResults(true)}
                                        onBlur={() => {
                                            setTimeout(() => {
                                                setShowOrgResults(false);
                                            }, 250);
                                        }}
                                    >
                                        <input 
                                            placeholder={t('profile.search_placeholder')} 
                                            className="input-field pl-10" 
                                            value={orgSearchQuery}
                                            onChange={(e) => setOrgSearchQuery(e.target.value)}
                                        />
                                        <SearchIcon size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                                    </div>
                                    
                                    {(orgSearchQuery.length > 0 || showOrgResults) && discoverableOrganizations.length > 0 && (
                                        <div className="max-h-60 overflow-y-auto bg-white border border-slate-100 rounded-xl shadow-lg text-left mt-2 animate-in fade-in slide-in-from-top-2 duration-200">
                                            {discoverableOrganizations
                                                .filter(o => {
                                                    const queryClean = (debouncedOrgQuery || orgSearchQuery || '').toLowerCase().trim();
                                                    if (!queryClean) return true;
                                                    const queryTranslit = transliterateGeoToEng(queryClean);
                                                    const queryReverse = transliterateEngToGeo(queryClean);
                                                    
                                                    const nameLower = (o.name || '').toLowerCase();
                                                    const idLower = (o.id || '').toLowerCase();
                                                    const legalLower = (o.legalName || '').toLowerCase();
                                                    const agTypeLower = (o.agricultureType || '').toLowerCase();
                                                    
                                                    const matchQuery = nameLower.includes(queryClean) || 
                                                                       idLower.includes(queryClean) || 
                                                                       legalLower.includes(queryClean) ||
                                                                       agTypeLower.includes(queryClean) ||
                                                                       nameLower.includes(queryTranslit) ||
                                                                       idLower.includes(queryTranslit) ||
                                                                       legalLower.includes(queryTranslit) ||
                                                                       nameLower.includes(queryReverse) ||
                                                                       idLower.includes(queryReverse);

                                                    const alreadyMember = memberships.some(m => m.organizationId === o.id);
                                                    return matchQuery && !alreadyMember;
                                                })
                                                .slice(0, 15)
                                                .map(o => (
                                                    <button 
                                                        key={o.id} 
                                                        onClick={() => setDiscoveryOrg(o)}
                                                        className="w-full p-4 hover:bg-indigo-50 text-xs font-bold text-slate-700 border-b border-slate-50 last:border-0 flex justify-between items-center transition-colors group"
                                                    >
                                                        <div className="flex flex-col">
                                                            <span className="group-hover:text-indigo-600 transition-colors uppercase tracking-tight font-black">{o.name}</span>
                                                            <span className="text-[8px] text-slate-400 font-mono uppercase mt-0.5">ID: {o.id}</span>
                                                        </div>
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-[8px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full uppercase font-black tracking-widest">{o.agricultureType || 'Mixed'}</span>
                                                            <ChevronRightIcon size={12} className="text-slate-300 group-hover:text-indigo-400 group-hover:translate-x-0.5 transition-all" />
                                                        </div>
                                                    </button>
                                                ))
                                            }
                                            {discoverableOrganizations.filter(o => {
                                                const queryClean = (debouncedOrgQuery || orgSearchQuery || '').toLowerCase().trim();
                                                if (!queryClean) return true;
                                                const queryTranslit = transliterateGeoToEng(queryClean);
                                                const queryReverse = transliterateEngToGeo(queryClean);
                                                
                                                const nameLower = (o.name || '').toLowerCase();
                                                const idLower = (o.id || '').toLowerCase();
                                                const legalLower = (o.legalName || '').toLowerCase();
                                                const agTypeLower = (o.agricultureType || '').toLowerCase();
                                                
                                                const matchQuery = nameLower.includes(queryClean) || 
                                                                   idLower.includes(queryClean) || 
                                                                   legalLower.includes(queryClean) ||
                                                                   agTypeLower.includes(queryClean) ||
                                                                   nameLower.includes(queryTranslit) ||
                                                                   idLower.includes(queryTranslit) ||
                                                                   legalLower.includes(queryTranslit) ||
                                                                   nameLower.includes(queryReverse) ||
                                                                   idLower.includes(queryReverse);

                                                const alreadyMember = memberships.some(m => m.organizationId === o.id);
                                                return matchQuery && !alreadyMember;
                                            }).length === 0 && (
                                                <div className="p-8 text-center text-[10px] font-black text-slate-300 uppercase tracking-widest italic animate-pulse">
                                                    Searching global registry...
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    <button 
                                        onClick={() => {
                                            const filtered = discoverableOrganizations.filter(o => {
                                                const queryClean = (debouncedOrgQuery || orgSearchQuery || '').toLowerCase().trim();
                                                if (!queryClean) return true;
                                                const queryTranslit = transliterateGeoToEng(queryClean);
                                                const queryReverse = transliterateEngToGeo(queryClean);
                                                
                                                const nameLower = (o.name || '').toLowerCase();
                                                const idLower = (o.id || '').toLowerCase();
                                                const legalLower = (o.legalName || '').toLowerCase();
                                                const agTypeLower = (o.agricultureType || '').toLowerCase();
                                                
                                                const matchQuery = nameLower.includes(queryClean) || 
                                                                   idLower.includes(queryClean) || 
                                                                   legalLower.includes(queryClean) ||
                                                                   agTypeLower.includes(queryClean) ||
                                                                   nameLower.includes(queryTranslit) ||
                                                                   idLower.includes(queryTranslit) ||
                                                                   legalLower.includes(queryTranslit) ||
                                                                   nameLower.includes(queryReverse) ||
                                                                   idLower.includes(queryReverse);

                                                const alreadyMember = memberships.some(m => m.organizationId === o.id);
                                                return matchQuery && !alreadyMember;
                                            });
                                            if (filtered.length > 0) {
                                                setDiscoveryOrg(filtered[0]);
                                            } else {
                                                toast.error("No organization matches your search query yet.");
                                            }
                                        }}
                                        disabled={!orgSearchQuery}
                                        className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-black text-[10px] uppercase tracking-widest disabled:opacity-50 disabled:bg-white disabled:border-2 disabled:border-slate-200 disabled:text-slate-600 transition-all font-bold shadow-md"
                                    >
                                        Send Join Request
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div className="flex justify-between">
                        <button onClick={() => onUpdateUser({...user, primaryGoal: undefined})} className="px-8 py-4 text-slate-500 font-black text-xs uppercase tracking-widest flex items-center gap-2"><ChevronLeftIcon size={16}/> Back</button>
                    </div>
                </div>
            );
        }

        return (
            <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100 space-y-8">
                {/* Guest Mode Active Banner */}
                {user?.isGuest && (
                    <div className="p-6 bg-gradient-to-r from-amber-50 to-orange-50 rounded-[2rem] border-2 border-amber-100 shadow-sm flex flex-col md:flex-row items-center justify-between gap-6">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 bg-amber-100 rounded-2xl flex items-center justify-center">
                                <ShieldCheckIcon className="h-6 w-6 text-amber-600" />
                            </div>
                            <div>
                                <h3 className="text-lg font-black text-amber-900 uppercase tracking-tight">Guest Mode Active</h3>
                                <p className="text-xs font-bold text-amber-700/70 uppercase tracking-widest">Verify your profile to unlock full features</p>
                            </div>
                        </div>
                        <button 
                            onClick={() => setIsVerificationOpen(true)}
                            className="px-8 py-4 bg-amber-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-amber-200 hover:bg-amber-700 active:scale-95 transition-all flex items-center gap-2"
                        >
                            Verify My Profile <ChevronRightIcon size={16} />
                        </button>
                    </div>
                )}
                <div className="flex justify-between items-start">
                    <div>
                        <h3 className="text-lg font-black uppercase tracking-tight text-slate-800">Your Public Profile</h3>
                        <p className="text-sm text-slate-400">This is how other users see you. Keep it updated!</p>
                    </div>
                     <div className="flex gap-2">
                        {onExportBackup && (
                            <button onClick={onExportBackup} className="btn-secondary text-xs flex items-center gap-2">
                                <SaveIcon size={14} /> Backup Data
                            </button>
                        )}
                        <button onClick={() => setActiveModal(user.primaryGoal || null)} className="btn-secondary text-xs">Edit Profile</button>
                        <button onClick={() => onUpdateUser({...user, primaryGoal: undefined})} className="btn-secondary text-xs">Change Goal</button>
                    </div>
                </div>

                 <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                     <label className="flex items-center gap-3 cursor-pointer">
                        <div onClick={() => onUpdateUser({...user, isProfileDiscoverable: !user.isProfileDiscoverable})} className={`w-10 h-5 rounded-full p-0.5 transition-all ${user.isProfileDiscoverable ? 'bg-slate-800' : 'bg-slate-200'}`}>
                            <div className={`bg-white w-4 h-4 rounded-full shadow-md transition-transform ${user.isProfileDiscoverable ? 'translate-x-5' : 'translate-x-0'}`} />
                        </div>
                        <div className="flex flex-col">
                            <span className="label">Discoverable</span>
                            <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">Allow AI Analyst to suggest you</p>
                        </div>
                     </label>
                     <label className="flex items-center gap-3 cursor-pointer">
                        <div onClick={() => onUpdateUser({...user, availability: user.availability === 'Available' ? 'Unavailable' : 'Available'})} className={`w-10 h-5 rounded-full p-0.5 transition-all ${user.availability === 'Available' ? 'bg-green-500' : 'bg-slate-200'}`}>
                            <div className={`bg-white w-4 h-4 rounded-full shadow-md transition-transform ${user.availability === 'Available' ? 'translate-x-5' : 'translate-x-0'}`} />
                        </div>
                        <div className="flex flex-col">
                            <span className="label">Availability: {user.availability || 'Available'}</span>
                            <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">Set your current work status</p>
                        </div>
                     </label>
                </div>

                <div className="p-6 bg-slate-50 rounded-3xl border border-dashed border-slate-200 flex flex-col md:flex-row items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                        <div className={`p-3 rounded-2xl shadow-sm text-white ${isManualOffline ? 'bg-orange-500' : 'bg-emerald-500'}`}>
                            {isManualOffline ? <ShieldCheckIcon size={24} /> : <CheckIcon size={24} />}
                        </div>
                        <div>
                            <h4 className="text-sm font-black text-slate-800 uppercase tracking-tight">Sync Status: {isManualOffline ? 'Work Offline' : 'Online'}</h4>
                            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">Manual data synchronization control</p>
                        </div>
                    </div>
                    <button 
                        onClick={onToggleOffline}
                        className={`px-8 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all shadow-xl ${isManualOffline ? 'bg-emerald-600 text-white shadow-emerald-100 hover:bg-emerald-700' : 'bg-orange-600 text-white shadow-orange-100 hover:bg-orange-700'}`}
                    >
                        {isManualOffline ? 'Go Online' : 'Work Offline'}
                    </button>
                    <div className="flex-1" />
                </div>

                <div className="p-6 bg-slate-50 rounded-3xl border border-dashed border-slate-200 flex flex-col md:flex-row items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-white rounded-2xl shadow-sm text-slate-400">
                            <KeyIcon size={24} />
                        </div>
                        <div>
                            <h4 className="text-sm font-black text-slate-800 uppercase tracking-tight">Security & Privacy</h4>
                            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">Manage your account access and passwords</p>
                        </div>
                    </div>
                    <button 
                        onClick={() => setIsPasswordModalOpen(true)}
                        className="px-6 py-3 bg-white border border-slate-200 text-slate-600 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-800 hover:text-white transition-all shadow-sm"
                    >
                        Change Password
                    </button>
                    <button 
                        onClick={onDeleteAccount}
                        className="px-6 py-3 bg-red-50 text-red-600 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-red-600 hover:text-white transition-all shadow-sm"
                    >
                        Delete Profile
                    </button>
                    <div className="flex-1" />
                </div>

                <div className="p-6 bg-slate-50 rounded-3xl border border-dashed border-slate-200 flex flex-col md:flex-row items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-white rounded-2xl shadow-sm text-slate-400">
                            <Database size={24} />
                        </div>
                        <div>
                            <h4 className="text-sm font-black text-slate-800 uppercase tracking-tight">System Maintenance</h4>
                            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">Manage local browser cache and performance</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="flex flex-col items-end mr-4">
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1 text-right">Local Storage Used</span>
                            <div className="h-1.5 w-24 bg-slate-200 rounded-full overflow-hidden">
                                <div 
                                    className={`h-full transition-all duration-1000 ${safeStorage.getUsage() > 90 ? 'bg-red-500' : 'bg-indigo-500'}`}
                                    style={{ width: `${safeStorage.getUsage()}%` }}
                                />
                            </div>
                        </div>
                        <button 
                            onClick={() => {
                                if (window.confirm("CRITICAL: This will clear all locally saved mock data and cached features. Any unsynced data will be lost. Continue?")) {
                                    if (safeStorage.clearMockData()) {
                                        toast.success("Local cache cleared successfully.");
                                        setTimeout(() => window.location.reload(), 1000);
                                    }
                                }
                            }}
                            className="px-6 py-3 bg-white border border-slate-200 text-slate-600 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-orange-50 hover:text-orange-600 hover:border-orange-200 transition-all shadow-sm flex items-center gap-2"
                        >
                            <RefreshCw size={14} /> Clear Cache
                        </button>
                    </div>
                    <div className="flex-1" />
                </div>

                <div className="space-y-6">
                    <div className="flex justify-between items-center border-b border-slate-100 pb-2">
                        <h4 className="text-sm font-black uppercase tracking-tight text-slate-800">Professional CV</h4>
                        <button onClick={() => setActiveModal('OFFER_SERVICE')} className="text-[10px] font-black text-indigo-600 uppercase tracking-widest hover:text-indigo-700 flex items-center gap-1">
                            <PlusIcon size={12} /> Manage CV
                        </button>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                        <div className="space-y-4">
                            <h5 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                <BuildingStorefrontIcon size={14} /> Company Roles
                            </h5>
                            <div className="space-y-3">
                                {companyRoles.length > 0 ? (
                                    companyRoles.map(renderExperienceItem)
                                ) : (
                                    <div className="p-8 text-center border-2 border-dashed border-slate-100 rounded-3xl text-[10px] font-black text-slate-300 uppercase tracking-widest">
                                        No company roles listed
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="space-y-4">
                            <h5 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                <UserCircleIcon size={14} /> Individual Roles
                            </h5>
                            <div className="space-y-3">
                                {individualRoles.length > 0 ? (
                                    individualRoles.map(renderExperienceItem)
                                ) : (
                                    <div className="p-8 text-center border-2 border-dashed border-slate-100 rounded-3xl text-[10px] font-black text-slate-300 uppercase tracking-widest">
                                        No individual roles listed
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                <div className="space-y-4">
                    <div className="flex justify-between items-center border-b border-slate-100 pb-2">
                        <h4 className="text-sm font-black uppercase tracking-tight text-slate-800">Working Area</h4>
                        <button onClick={() => setIsWorkingAreaOpen(true)} className="text-[10px] font-black text-indigo-600 uppercase tracking-widest hover:text-indigo-700 flex items-center gap-1">
                            <MapIcon size={12} /> Set Area on Map
                        </button>
                    </div>
                    <div className="h-48 bg-slate-50 rounded-3xl border border-slate-100 flex flex-col items-center justify-center text-center p-6 relative overflow-hidden">
                        {user.workingArea ? (
                            <div className="absolute inset-0 opacity-20 grayscale">
                                <MapComponent 
                                    center={(user.workingArea && Array.isArray(user.workingArea.center) && user.workingArea.center.length === 2 && Number.isFinite(user.workingArea.center[0] ?? NaN) && Number.isFinite(user.workingArea.center[1] ?? NaN)) ? user.workingArea.center as [number, number] : [41.8719, 44.0128]} 
                                    zoom={12} 
                                    plantationFeatures={[]} 
                                    layers={[]} 
                                    onSelectFeature={() => {}} 
                                    flyToBounds={null}
                                />
                            </div>
                        ) : null}
                        <div className="relative z-10">
                            <MapPinIcon size={32} className="text-slate-300 mx-auto mb-2" />
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                {user.workingArea ? `Area set in ${user.region || 'defined region'}` : 'No working area defined yet'}
                            </p>
                            {!user.workingArea && (
                                <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest mt-1 italic">
                                    Setting an area helps AI suggest you for local jobs
                                </p>
                            )}
                        </div>
                    </div>
                </div>
                {user.primaryGoal === 'BUY_PRODUCTS' && user.buyerPreferences && (
                     <div className="space-y-2">
                        <h4 className="label">Buyer Preferences</h4>
                         <p className="text-sm"><strong>Company:</strong> {user.buyerPreferences.companyName || 'N/A'}</p>
                        <p className="text-sm"><strong>Sourcing Regions:</strong> {user.region || 'Any'}</p>
                        <p className="text-sm"><strong>Crops:</strong> {user.buyerPreferences.preferredCrops.join(', ')}</p>
                        <p className="text-sm"><strong>Volume:</strong> {user.buyerPreferences.volume}</p>
                    </div>
                )}
                 {user.primaryGoal === 'BECOME_AGENT' && user.agentData && (
                     <div className="space-y-2">
                        <h4 className="label">Agro-Agent Details</h4>
                        <p className="text-sm"><strong>Region of Operation:</strong> {user.region || 'Any'}</p>
                        <p className="text-sm"><strong>Worker Capacity:</strong> {user.agentData.capacity}</p>
                        <h5 className="label pt-2">Team Roster</h5>
                        <div className="space-y-1">{user.agentData.team?.map(m => m && <div key={m.id} className="p-2 bg-slate-50 rounded-lg text-sm">{m.name} ({m.phone})</div>)}</div>
                    </div>
                 )}
                 <div className="space-y-4">
                    <h4 className="label flex items-center gap-2">Reviews <div className="flex items-center gap-1"><StarIcon size={12} className="text-yellow-400"/> (0)</div></h4>
                    <div className="text-center py-8 bg-slate-50 rounded-2xl border text-xs font-bold text-slate-400 uppercase">No reviews yet.</div>
                 </div>

                <div className="pt-6 border-t flex flex-col gap-4">
                    <div className="flex flex-wrap items-center gap-3">
                        {onOpenHomepage && (
                            <button 
                                onClick={onOpenHomepage} 
                                className="px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl text-xs font-black uppercase tracking-wider flex items-center gap-2 shadow-lg shadow-emerald-200 transition-all active:scale-95"
                            >
                                <Home size={16} /> Go to Homepage
                            </button>
                        )}
                        {onSetAppMode && (
                            <button 
                                onClick={() => onSetAppMode('dashboard')} 
                                className="btn-primary flex items-center gap-2"
                            >
                                <Home size={16} /> Go to Dashboard
                            </button>
                        )}
                    </div>

                    {/* Navigation & Documentation under "Go to Homepage" */}
                    <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/80 flex flex-wrap items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-indigo-100 text-indigo-600 flex items-center justify-center flex-shrink-0">
                                <BookOpen size={20} />
                            </div>
                            <div>
                                <p className="text-xs font-black text-slate-800 uppercase tracking-tight">Help & Architecture Guide</p>
                                <p className="text-[10px] font-bold text-slate-500">17 Core Modules • Manual Architecture • System Registry</p>
                            </div>
                        </div>

                        <div className="flex items-center gap-2">
                            {onSetAppMode && (
                                <button 
                                    onClick={() => onSetAppMode('guide')} 
                                    className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-2 shadow-md shadow-indigo-100 transition-all active:scale-95"
                                >
                                    <BookOpen size={14} /> Open Help Guide
                                </button>
                            )}
                            <button 
                                onClick={() => setIsItemListModalOpen(true)}
                                className="px-4 py-2.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center gap-2 transition-all active:scale-95"
                                title="View & Download item list.txt"
                            >
                                <FileText size={14} className="text-indigo-600" /> Item List
                            </button>
                            <button 
                                onClick={handleDownloadItemList}
                                className="p-2.5 bg-white hover:bg-slate-100 text-slate-600 border border-slate-200 rounded-xl transition-all active:scale-95"
                                title="Download item list.txt"
                            >
                                <Download size={14} />
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    const handleChangePassword = async () => {
        if (!newPassword || newPassword.length < 6) {
            return toast.error("Password must be at least 6 characters long.");
        }
        setIsChangingPassword(true);
        try {
            if (auth.currentUser) {
                await updatePassword(auth.currentUser, newPassword);
                // Password is managed by Firebase Auth, never written to a profile.
                setIsPasswordModalOpen(false);
                setNewPassword('');
                toast.success("Password updated successfully!");
            } else {
                throw new Error("No authenticated user found.");
            }
        } catch (error: any) {
            console.error("Password update error:", error);
            toast.error(`Failed to update password: ${error.message}`);
        } finally {
            setIsChangingPassword(false);
        }
    };

    return (
        <main className="flex-1 bg-slate-50 overflow-y-auto p-4 md:p-10 safe-area-bottom">
            <div className="max-w-7xl mx-auto space-y-8">
                {renderIdentityHierarchy()}
                
                {/* Password Change Modal */}
                {isPasswordModalOpen && (
                    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[5000] flex items-center justify-center p-4">
                        <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-md p-8 animate-in zoom-in duration-300">
                            <div className="flex justify-between items-start mb-6">
                                <div className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl">
                                    <KeyIcon size={24} />
                                </div>
                                <button onClick={() => setIsPasswordModalOpen(false)} className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-400">
                                    <XIcon size={20} />
                                </button>
                            </div>
                            <h3 className="text-xl font-black text-slate-800 uppercase tracking-tighter mb-2">Secure Password Update</h3>
                            <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mb-8">Enter your new global access credentials</p>
                            
                            <div className="space-y-4">
                                <div>
                                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 block">New Password</label>
                                    <input 
                                        type="password" 
                                        value={newPassword}
                                        onChange={(e) => setNewPassword(e.target.value)}
                                        placeholder="Minimum 6 characters"
                                        className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-4 py-3 text-sm font-black text-slate-800 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                                    />
                                </div>
                                <button 
                                    onClick={handleChangePassword}
                                    disabled={isChangingPassword}
                                    className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl shadow-indigo-100 hover:bg-indigo-700 active:scale-95 transition-all disabled:opacity-50"
                                >
                                    {isChangingPassword ? 'Securing Account...' : 'Confirm Update'}
                                </button>
                            </div>
                        </div>
                    </div>
                )}
                <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100 flex flex-col md:flex-row items-center gap-6">
                     <div className="w-24 h-24 bg-slate-100 rounded-3xl flex items-center justify-center text-slate-300 flex-shrink-0"><UserCircleIcon size={60} /></div>
                    <div className="flex-1 w-full">
                        <div className="flex items-center gap-3 justify-center md:justify-start">
                            <h1 className="text-2xl font-black tracking-tighter text-slate-900 uppercase">{user.name}</h1>
                            <button 
                                onClick={() => setIsPasswordModalOpen(true)}
                                className="flex items-center gap-1.5 text-[10px] font-black text-indigo-600 uppercase tracking-widest hover:text-indigo-700 transition-colors ml-2"
                            >
                                <KeyIcon className="w-3 h-3" /> {t('profile.reset_password')}
                            </button>
                            {user.verificationStatus === 'verified' || user.verificationStatus === 'full_verified' ? (
                                <div className="flex items-center gap-1 bg-emerald-100 text-emerald-600 px-2 py-0.5 rounded-lg text-[10px] font-black uppercase tracking-widest">
                                    <ShieldCheckIcon size={12} /> {t('profile.verified')}
                                </div>
                            ) : (
                                <button 
                                    onClick={() => setIsVerificationOpen(true)}
                                    className="flex items-center gap-1 bg-red-100 text-red-600 px-2 py-0.5 rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-red-200 transition-colors"
                                >
                                    <ShieldCheckIcon size={12} /> {t('profile.verify_required')}
                                </button>
                            )}
                        </div>
                        <p className="text-slate-400 font-bold text-xs tracking-widest mt-1 text-center md:text-left">{user.email}</p>
                        
                        <div className="flex flex-col md:flex-row md:items-center gap-4 mt-4">
                            <button 
                                onClick={onToggleOffline}
                                className={`px-6 py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all shadow-lg flex items-center gap-2 ${isManualOffline ? 'bg-orange-600 text-white shadow-orange-100 hover:bg-orange-700' : 'bg-slate-800 text-white shadow-slate-100 hover:bg-slate-900 border border-slate-700'}`}
                            >
                                <ShieldCheckIcon size={14} /> {isManualOffline ? t('profile.offline_on') : t('profile.go_offline')}
                            </button>
                            
                            <button 
                                onClick={onPushToFirestore}
                                className="px-6 py-2.5 bg-emerald-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-emerald-100 hover:bg-emerald-700 transition-all flex items-center gap-2 active:scale-95"
                            >
                                <SaveIcon size={14} /> {t('profile.push_to_firestore')}
                            </button>

                            <button 
                                onClick={handleSyncToLAN}
                                disabled={isSyncingLocal}
                                className="px-6 py-2.5 bg-blue-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-blue-100 hover:bg-blue-700 transition-all flex items-center gap-2 active:scale-95 disabled:opacity-50"
                            >
                                {isSyncingLocal ? (
                                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                ) : (
                                    <HardDrive size={14} />
                                )}
                                {t('profile.push_to_lan')}
                            </button>

                            <button onClick={() => setIsVerificationOpen(true)} className={`px-6 py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 ${user.verificationStatus === 'verified' || user.verificationStatus === 'full_verified' ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-red-600 text-white shadow-lg shadow-red-100 hover:bg-red-700'}`}>
                                <ShieldCheckIcon size={14} /> {user.verificationStatus === 'verified' || user.verificationStatus === 'full_verified' ? t('profile.verified_profile') : t('profile.verification_required')}
                            </button>
                            <button 
                                onClick={() => {
                                    if (user.isGuest) {
                                        if (user.verificationStatus !== 'verified' || !user.personalNumber) {
                                            setIsVerificationOpen(true);
                                            toast.error("Please verify your profile by providing your Personal ID Number before completing registration.");
                                        } else {
                                            setIsRegistrationOpen(true);
                                        }
                                    } else {
                                        onUpdateUser({...user, primaryGoal: undefined});
                                    }
                                }} 
                                className="px-6 py-2.5 bg-slate-100 text-slate-600 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-200 transition-all flex items-center gap-2"
                            >
                                <UsersIcon size={14} /> {user.isGuest ? t('profile.complete_registration') : t('profile.change_account_type')}
                            </button>

                            {/* Subscription Button */}
                            {!user.isGuest && (
                                <button 
                                    onClick={() => setIsSubscriptionOpen(true)}
                                    className="px-6 py-2.5 bg-indigo-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all flex items-center gap-2 animate-pulse"
                                >
                                    <StarIcon size={14} /> {t('profile.subscription_plans')}
                                </button>
                            )}

                            {onOpenHomepage && (
                                <button 
                                    onClick={onOpenHomepage}
                                    className="px-5 py-2.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-emerald-100 transition-all flex items-center gap-2"
                                    title="Go to Homepage"
                                >
                                    <Home size={14} /> Go to Homepage
                                </button>
                            )}

                            {onSetAppMode && (
                                <button 
                                    onClick={() => onSetAppMode('guide')}
                                    className="px-5 py-2.5 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-100 transition-all flex items-center gap-2"
                                    title="Help & Architecture Guide"
                                >
                                    <BookOpen size={14} /> Help Guide
                                </button>
                            )}
                        </div>
                        {user.roles?.includes('ROOT_SUPER_ADMIN') && (
                            <div className="mt-4 flex flex-wrap gap-3 justify-center md:justify-start">
                                <div className="flex items-center gap-2 bg-red-50 px-4 py-2 rounded-xl border border-red-100">
                                    <ShieldCheckIcon size={14} className="text-red-600" />
                                    <span className="text-[10px] font-black text-red-900 uppercase tracking-widest">SYSTEM ROOT</span>
                                </div>
                            </div>
                        )}
                    </div>
                    {onSetOrganizationContext && (
                        <div className="flex flex-col gap-2 w-full md:w-auto">
                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">{t('profile.ticket_manager')}</label>
                            <select 
                                value={currentOrganizationContext} 
                                onChange={(e) => onSetOrganizationContext(e.target.value as any)}
                                className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-sm font-bold text-slate-700 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                            >
                                <option value="personal">{t('profile.personal_account')}</option>
                                    {memberships.reduce((acc, current) => {
                                        const x = acc.find(item => item.id === current.id);
                                        if (!x) {
                                            return acc.concat([current]);
                                        } else {
                                            return acc;
                                        }
                                    }, [] as Membership[]).map(m => {
                                        const org = organizations.find(o => o.id === m.organizationId);
                                        return org ? <option key={m.id} value={org.id}>{org.name} ({m.role})</option> : null;
                                    })}
                            </select>
                        </div>
                    )}
                </div>

                {renderContent()}

                {/* Edit Organization Modal */}
                {isEditOrgModalOpen && editingOrg && (
                    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center z-[100] p-4 animate-in fade-in">
                        <div className="bg-white w-full max-w-xl rounded-[2.5rem] overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
                            <div className="p-8 bg-slate-50 border-b border-slate-100 flex justify-between items-center">
                                <div>
                                    <h2 className="text-lg font-black text-slate-800 uppercase tracking-tighter">{t('profile.edit_org')}</h2>
                                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">Update organization details</p>
                                </div>
                                <button onClick={() => setIsEditOrgModalOpen(false)} className="p-2 hover:bg-white rounded-full text-slate-400 transition-colors">
                                    <XIcon size={20} />
                                </button>
                            </div>
                            <div className="p-8 space-y-6">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Organization Name</label>
                                        <input 
                                            type="text" 
                                            value={editOrgData.name || ''}
                                            onChange={(e) => setEditOrgData({...editOrgData, name: e.target.value})}
                                            className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-4 py-3 text-sm font-bold text-slate-800 focus:ring-2 focus:ring-indigo-500 outline-none"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Tax Number</label>
                                        <input 
                                            type="text" 
                                            value={editOrgData.taxNumber || ''}
                                            onChange={(e) => setEditOrgData({...editOrgData, taxNumber: e.target.value})}
                                            className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-4 py-3 text-sm font-bold text-slate-800 focus:ring-2 focus:ring-indigo-500 outline-none"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Agriculture Type</label>
                                        <select 
                                            value={editOrgData.agricultureType || ''}
                                            onChange={(e) => setEditOrgData({...editOrgData, agricultureType: e.target.value as AgricultureType})}
                                            className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-4 py-3 text-sm font-bold text-slate-800 focus:ring-2 focus:ring-indigo-500 outline-none"
                                        >
                                            <option value="General">General Agriculture</option>
                                            <option value="Fruit">Fruit Production</option>
                                            <option value="Vegetable">Vegetable Production</option>
                                            <option value="Grain">Grain Production</option>
                                            <option value="Livestock">Livestock</option>
                                        </select>
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Visibility</label>
                                        <div className="flex items-center gap-4 py-3">
                                            <label className="flex items-center gap-2 cursor-pointer">
                                                <input 
                                                    type="checkbox" 
                                                    checked={editOrgData.isDiscoverable}
                                                    onChange={(e) => setEditOrgData({...editOrgData, isDiscoverable: e.target.checked})}
                                                    className="w-4 h-4 rounded text-indigo-600"
                                                />
                                                <span className="text-xs font-bold text-slate-700">Public Registry</span>
                                            </label>
                                        </div>
                                    </div>
                                </div>
                                <button 
                                    onClick={handleUpdateOrgInternal}
                                    className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl shadow-indigo-100 hover:bg-indigo-700 active:scale-95 transition-all"
                                >
                                    {t('profile.save_changes')}
                                </button>
                            </div>
                        </div>
                    </div>
                )}
                {isPasswordModalOpen && (
                    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center z-[100] p-4 animate-in fade-in">
                        <div className="bg-white w-full max-w-md rounded-[2.5rem] overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
                            <div className="p-8 bg-slate-50 border-b border-slate-100 flex justify-between items-center">
                                <div>
                                    <h2 className="text-lg font-black text-slate-800 uppercase tracking-tighter">Security Update</h2>
                                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">Change your account password</p>
                                </div>
                                <button onClick={() => setIsPasswordModalOpen(false)} className="p-2 hover:bg-slate-100 rounded-full text-slate-400 transition-colors">
                                    <XIcon size={20} />
                                </button>
                            </div>
                            
                            <div className="p-8 space-y-6">
                                <div className="space-y-4">
                                    <label className="block">
                                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">New Password</span>
                                        <input 
                                            type="password"
                                            value={newPassword}
                                            onChange={(e) => setNewPassword(e.target.value)}
                                            placeholder="••••••••"
                                            className="w-full mt-2 bg-slate-50 border border-slate-200 rounded-2xl px-5 py-4 text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all font-mono"
                                        />
                                    </label>
                                    <p className="text-[9px] text-slate-400 italic">
                                        Note: If you were just provisioned by your manager, please set a strong password to secure your account.
                                    </p>
                                </div>
                                
                                <div className="flex flex-col gap-3">
                                    <button 
                                        disabled={isChangingPassword || newPassword.length < 6}
                                        onClick={async () => {
                                            if (!auth.currentUser) return toast.error("Not authenticated");
                                            setIsChangingPassword(true);
                                            try {
                                                await updatePassword(auth.currentUser, newPassword);
                                                toast.success("Password updated successfully!");
                                                setIsPasswordModalOpen(false);
                                                setNewPassword('');
                                            } catch (err: any) {
                                                toast.error(`Update failed: ${err.message}`);
                                            } finally {
                                                setIsChangingPassword(false);
                                            }
                                        }}
                                        className="w-full p-4 bg-slate-900 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-slate-200 hover:bg-slate-800 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
                                    >
                                        {isChangingPassword ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <ShieldCheckIcon size={16} />}
                                        Update Password
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
                <OfferServiceModal isOpen={activeModal === 'OFFER_SERVICE'} onClose={() => setActiveModal(null)} user={user} onUpdateUser={onUpdateUser} organizations={discoverableOrganizations} onUpdateOrg={onUpdateOrg} />
                <BuyProductsModal isOpen={activeModal === 'BUY_PRODUCTS'} onClose={() => setActiveModal(null)} user={user} onUpdateUser={onUpdateUser} organizations={organizations} />
                <BecomeAgentModal isOpen={activeModal === 'BECOME_AGENT'} onClose={() => setActiveModal(null)} user={user} onUpdateUser={onUpdateUser} allEmployees={allEmployees} organizations={organizations} />
                
                {/* Subscription Modal */}
                <SubscriptionModal 
                    isOpen={isSubscriptionOpen} 
                    onClose={() => setIsSubscriptionOpen(false)} 
                    currentUser={user} 
                    activeOrg={organizations.find(o => o.id === currentOrganizationContext)}
                    onUpdateOrg={onUpdateOrg}
                    isSystemAdmin={isSystemAdmin}
                />

                {/* Discovery Handshake Modal */}
                {discoveryOrg && (
                    <div className="fixed inset-0 bg-black/60 z-[7000] flex items-center justify-center p-4 backdrop-blur-md">
                        <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-md overflow-hidden animate-slide-up">
                            <div className="p-8 border-b bg-slate-50/50 flex justify-between items-center">
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center shadow-sm text-indigo-600">
                                        <BuildingStorefrontIcon size={24} />
                                    </div>
                                    <div>
                                        <h2 className="text-xl font-black text-slate-800 uppercase tracking-tight">{discoveryOrg.name}</h2>
                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">{discoveryOrg.agricultureType} • {discoveryOrg.type}</p>
                                    </div>
                                </div>
                                <button onClick={() => setDiscoveryOrg(null)} className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-400">
                                    <XIcon size={24} />
                                </button>
                            </div>
                            
                            <div className="p-8 space-y-4">
                                <div className="p-6 bg-indigo-50/50 rounded-3xl border border-indigo-100 mb-4">
                                    <p className="text-[10px] font-bold text-indigo-600 leading-relaxed uppercase tracking-tight text-center">
                                        Initiate a secure connection with this organization's administrative hub.
                                    </p>
                                </div>
                                
                                <button 
                                    onClick={() => {
                                        if (props.onAddPost && user) {
                                            props.onAddPost({
                                                content: `Inquiry from ${user.name}: Hello, I am interested in connecting with ${discoveryOrg.name}.`,
                                                channelId: 'internal',
                                                hubType: 'internal',
                                                isDirectMessage: true,
                                                recipientId: discoveryOrg.createdBy || 'founder', // Route to founder
                                                authorId: user.id,
                                                authorName: user.name,
                                                timestamp: new Date().toISOString(),
                                                replies: []
                                            });
                                            setDiscoveryOrg(null);
                                            if (onSetAppMode) onSetAppMode('tools' as any);
                                            toast.success("Message sent! Redirecting to Team Hub.");
                                        }
                                    }}
                                    className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-lg shadow-slate-200 hover:bg-slate-800 active:scale-95 transition-all flex items-center justify-center gap-3"
                                >
                                    <UsersIcon size={18} /> Send Message
                                </button>
                                
                                <button 
                                    onClick={async () => {
                                        if (!discoveryOrg || !user) return;
                                        const membershipId = `${user.id}_${discoveryOrg.id}`;
                                        const newMembership: Membership = {
                                            id: membershipId,
                                            userId: user.id,
                                            organizationId: discoveryOrg.id,
                                            role: 'Employee',
                                            permissionLevel: 'write',
                                            status: 'pending',
                                            joinedAt: new Date().toISOString()
                                        };

                                        try {
                                            if (USE_FIREBASE) {
                                                // 1. Create membership
                                                await setDoc(doc(db, 'memberships', membershipId), newMembership);

                                                // 2. Create employee matching
                                                const newEmployee: Employee = {
                                                    id: `emp-${user.id}-${discoveryOrg.id}`,
                                                    name: user.name || "Unknown",
                                                    email: user.email || "",
                                                    phone: user.phone || '',
                                                    idNumber: user.personalNumber || '',
                                                    roleId: 'Employee',
                                                    paymentType: 'hourly',
                                                    paymentRate: 0,
                                                    barcode: `BC-${Date.now()}`,
                                                    employeeType: 'Temporary',
                                                    accountType: 'Bank Account',
                                                    status: 'active',
                                                    joinedAt: new Date().toISOString(),
                                                    organizationId: discoveryOrg.id
                                                };
                                                await setDoc(doc(db, 'employees', newEmployee.id), newEmployee);

                                                // 3. Create Alert for the owner
                                                const alertId = `alert-join-${Date.now()}`;
                                                await setDoc(doc(db, 'alerts', alertId), {
                                                    id: alertId,
                                                    organizationId: discoveryOrg.id,
                                                    title: 'New Join Request',
                                                    content: `${user.name} has requested to join ${discoveryOrg.name}.`,
                                                    type: 'info',
                                                    timestamp: new Date().toISOString(),
                                                    isRead: false,
                                                    createdBy: user.id,
                                                    metadata: { 
                                                        membershipId, 
                                                        userId: user.id
                                                    },
                                                    actions: [
                                                        { label: 'Approve', actionType: 'approve_join', actionData: { membershipId, userId: user.id } }
                                                    ]
                                                });
                                            } else {
                                                // Offline / Mock fallback
                                                const savedMemberships = safeStorage.safeParse(localStorage.getItem('mock_memberships'), []);
                                                const filteredMems = savedMemberships.filter((m: any) => m.id !== membershipId);
                                                localStorage.setItem('mock_memberships', JSON.stringify([...filteredMems, newMembership]));

                                                const newEmployee: Employee = {
                                                    id: `emp-${user.id}-${discoveryOrg.id}`,
                                                    name: user.name || "Unknown",
                                                    email: user.email || "",
                                                    phone: user.phone || '',
                                                    idNumber: user.personalNumber || '',
                                                    roleId: 'Employee',
                                                    paymentType: 'hourly',
                                                    paymentRate: 0,
                                                    barcode: `BC-${Date.now()}`,
                                                    employeeType: 'Temporary',
                                                    accountType: 'Bank Account',
                                                    status: 'active',
                                                    joinedAt: new Date().toISOString(),
                                                    organizationId: discoveryOrg.id
                                                };
                                                const savedEmployees = safeStorage.safeParse(localStorage.getItem('mock_employees'), []);
                                                localStorage.setItem('mock_employees', JSON.stringify([...savedEmployees, newEmployee]));
                                            }

                                            // Write direct message post for community hub
                                            if (props.onAddPost) {
                                                props.onAddPost({
                                                    content: `Formal Join Request: ${user.name} has requested to join ${discoveryOrg.name} as a professional partner.`,
                                                    channelId: 'internal',
                                                    hubType: 'internal',
                                                    isDirectMessage: true,
                                                    recipientId: discoveryOrg.createdBy || 'founder',
                                                    authorId: user.id,
                                                    authorName: user.name,
                                                    timestamp: new Date().toISOString(),
                                                    replies: []
                                                });
                                            }

                                            toast.success("Handshake request successfully submitted!");
                                            setDiscoveryOrg(null);
                                        } catch (error) {
                                            console.error("Error sending handshake request:", error);
                                            toast.error("Failed to submit join request. Please try again.");
                                        }
                                    }}
                                    className="w-full py-4 bg-white border-2 border-indigo-600 text-indigo-600 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-indigo-50 active:scale-95 transition-all flex items-center justify-center gap-3"
                                >
                                    <ShieldCheckIcon size={18} /> Send Join Request
                                </button>
                            </div>
                            
                            <div className="p-6 bg-slate-50 border-t border-slate-100 text-center">
                                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest italic">This interaction is verified and recorded for security.</p>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {isVerificationOpen && (
                <div className="fixed inset-0 bg-black/80 z-[6000] flex items-center justify-center p-4 backdrop-blur-md">
                    <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-lg overflow-hidden animate-slide-up flex flex-col">
                        <div className="p-8 border-b border-slate-100 flex justify-between items-center">
                            <div>
                                <h2 className="text-xl font-black text-slate-800 uppercase tracking-tight">Verify Your Profile</h2>
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Unlock full management features</p>
                            </div>
                            <button onClick={() => setIsVerificationOpen(false)} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
                                <XIcon className="h-6 w-6 text-slate-400" />
                            </button>
                        </div>
                        
                        <div className="p-10 space-y-6">
                            <div className="space-y-4">
                                <div>
                                    <label className="label block mb-2">Mobile Number</label>
                                    <input 
                                        placeholder="e.g. +995 5xx xxx xxx" 
                                        className="reg-input" 
                                        value={verificationData.mobileNumber} 
                                        onChange={e => setVerificationData({...verificationData, mobileNumber: e.target.value})} 
                                    />
                                </div>
                                <div>
                                    <label className="label block mb-2">Region</label>
                                    <input 
                                        placeholder="e.g. Kakheti, Georgia" 
                                        className="reg-input" 
                                        value={verificationData.region} 
                                        onChange={e => setVerificationData({...verificationData, region: e.target.value})} 
                                    />
                                </div>
                                <div>
                                    <label className="label block mb-2">Personal ID Number</label>
                                    <input 
                                        placeholder="11-digit ID number" 
                                        className="reg-input" 
                                        value={verificationData.personalNumber} 
                                        onChange={e => setVerificationData({...verificationData, personalNumber: e.target.value})} 
                                    />
                                </div>
                            </div>

                            <div className="p-6 bg-indigo-50 rounded-3xl border border-indigo-100">
                                <p className="text-[10px] font-bold text-indigo-600 leading-relaxed italic">
                                    Verification allows you to create organizations, manage labor teams, and participate in the full AgriMap ecosystem.
                                </p>
                            </div>
                        </div>
                        
                        <div className="p-8 bg-white border-t border-slate-100 flex justify-end">
                            <button 
                                onClick={handleVerifyProfile} 
                                className="px-12 py-4 bg-indigo-600 text-white rounded-xl font-black text-xs uppercase tracking-widest shadow-xl shadow-indigo-200 hover:bg-indigo-700 transition-all flex items-center gap-3"
                            >
                                Complete Verification <ChevronRightIcon size={16} strokeWidth={3} />
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {isRegistrationOpen && (
                <div className="fixed inset-0 bg-black/80 z-[6000] flex items-center justify-center p-4 backdrop-blur-md">
                    <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-2xl overflow-hidden animate-slide-up flex flex-col max-h-[90vh]">
                        <div className="p-8 border-b border-slate-100 flex justify-between items-center">
                            <h2 className="text-xl font-black text-slate-800 uppercase tracking-tight">{t('profile.step1_identity_role')}</h2>
                            <button onClick={() => setIsRegistrationOpen(false)} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
                                <XIcon className="h-6 w-6 text-slate-400" />
                            </button>
                        </div>
                        
                        <div className="p-8 space-y-8 overflow-y-auto">
                            <div className="space-y-6">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div>
                                        <label className="label block mb-2">{t('profile.legal_company_name')}</label>
                                        <input 
                                            placeholder={t('profile.legal_name_placeholder')} 
                                            className="reg-input" 
                                            value={regData.name} 
                                            onChange={e => setRegData({...regData, name: e.target.value})} 
                                            autoFocus
                                        />
                                    </div>
                                    <div>
                                        <label className="label block mb-2">{t('profile.tax_id_number')}</label>
                                        <input 
                                            placeholder={t('profile.tax_id_placeholder')} 
                                            className="reg-input" 
                                            value={regData.taxNumber} 
                                            onChange={e => setRegData({...regData, taxNumber: e.target.value})} 
                                        />
                                    </div>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div>
                                        <label className="label block mb-2">{t('profile.legal_structure')}</label>
                                        <select 
                                            className="reg-input bg-white" 
                                            value={regData.type} 
                                            onChange={e => setRegData({...regData, type: e.target.value as OrganizationType})}
                                        >
                                            <option value="LTD">{t('structure.LTD')}</option>
                                            <option value="Cooperative">{t('structure.Cooperative')}</option>
                                            <option value="Individual Entrepreneur">{t('structure.Individual_Entrepreneur')}</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="label block mb-2">{t('profile.primary_culture')}</label>
                                        <select 
                                            className="reg-input bg-white" 
                                            value={regData.agricultureType} 
                                            onChange={e => setRegData({...regData, agricultureType: e.target.value as AgricultureType})}
                                        >
                                            <option value="General">{t('culture.General')}</option>
                                            <option value="Vineyard">{t('culture.Vineyard')}</option>
                                            <option value="Orchard">{t('culture.Orchard')}</option>
                                            <option value="Greenhouse">{t('culture.Greenhouse')}</option>
                                            <option value="Livestock">{t('culture.Livestock')}</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="label block mb-2">{t('profile.region')}</label>
                                        <input 
                                            type="text"
                                            className="reg-input" 
                                            placeholder={t('profile.region_placeholder')}
                                            value={regData.region} 
                                            onChange={e => setRegData({...regData, region: e.target.value})} 
                                        />
                                    </div>
                                    <div>
                                        <label className="label block mb-2">{t('profile.area_ha')}</label>
                                        <input 
                                            type="number"
                                            className="reg-input" 
                                            placeholder={t('profile.area_placeholder')}
                                            value={regData.areaHa} 
                                            onChange={e => setRegData({...regData, areaHa: parseFloat(e.target.value) || 0})} 
                                        />
                                    </div>
                                </div>
                                
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div>
                                        <label className="label block mb-2">{t('profile.establishment_date')}</label>
                                        <input 
                                            type="date"
                                            className="reg-input" 
                                            value={regData.establishmentDate} 
                                            onChange={e => setRegData({...regData, establishmentDate: e.target.value})} 
                                        />
                                    </div>
                                </div>

                                <div className="space-y-3">
                                    <label className="label block mb-2">{t('profile.select_crops_varieties')}</label>
                                    <div className="flex flex-wrap gap-2">
                                        {COMMON_CROPS.map(cropName => {
                                            const isSelected = regData.selectedCrops.some(c => c.name === cropName);
                                            return (
                                                <button
                                                    key={cropName}
                                                    type="button"
                                                    onClick={() => {
                                                        const newCrops = isSelected 
                                                            ? regData.selectedCrops.filter(c => c.name !== cropName)
                                                            : [...regData.selectedCrops, {name: cropName, varieties: []}];
                                                        setRegData({...regData, selectedCrops: newCrops});
                                                    }}
                                                    className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-tight transition-all border ${isSelected ? 'bg-indigo-600 border-indigo-600 text-white shadow-lg' : 'bg-white border-slate-200 text-slate-400 hover:border-slate-300'}`}
                                                >
                                                    {t(`crop.${cropName}` as any)}
                                                </button>
                                            );
                                        })}
                                    </div>

                                    {regData.selectedCrops.length > 0 && (
                                        <div className="mt-4 space-y-4">
                                            {regData.selectedCrops.map(crop => (
                                                <div key={crop.name} className="p-4 bg-indigo-50/50 rounded-2xl border border-indigo-100">
                                                    <div className="flex items-center justify-between mb-2">
                                                        <h4 className="text-xs font-black text-indigo-900 uppercase tracking-tight">{t(`crop.${crop.name}` as any)} {t('profile.varieties_suffix')}</h4>
                                                    </div>
                                                    <div className="flex flex-wrap gap-2 mb-3">
                                                        {crop.varieties.map((v, i) => (
                                                            <div key={i} className="px-3 py-1 bg-white border border-indigo-200 text-indigo-700 rounded-lg text-xs font-bold flex items-center gap-1">
                                                                {v}
                                                                <button type="button" onClick={() => {
                                                                    setRegData({
                                                                        ...regData, 
                                                                        selectedCrops: regData.selectedCrops.map(c => c.name === crop.name ? {...c, varieties: c.varieties.filter((_, idx) => idx !== i)} : c)
                                                                    });
                                                                }} className="hover:text-red-500 ml-1">&times;</button>
                                                            </div>
                                                        ))}
                                                        {crop.varieties.length === 0 && <span className="text-xs text-indigo-400">{t('profile.no_varieties_added')}</span>}
                                                    </div>
                                                    <div className="flex gap-2">
                                                        <input 
                                                            type="text" 
                                                            placeholder={t('profile.add_variety_placeholder')} 
                                                            className="flex-1 px-3 py-1.5 text-xs border border-indigo-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500"
                                                            onKeyDown={(e) => {
                                                                if (e.key === 'Enter') {
                                                                    e.preventDefault();
                                                                    const val = e.currentTarget.value.trim();
                                                                    if (val && !crop.varieties.includes(val)) {
                                                                        setRegData({
                                                                            ...regData, 
                                                                            selectedCrops: regData.selectedCrops.map(c => c.name === crop.name ? {...c, varieties: [...c.varieties, val]} : c)
                                                                        });
                                                                        e.currentTarget.value = '';
                                                                    }
                                                                }
                                                            }}
                                                        />
                                                        <button 
                                                            type="button"
                                                            className="px-3 py-1.5 bg-indigo-600 text-white text-xs font-bold rounded-lg hover:bg-indigo-700"
                                                            onClick={(e) => {
                                                                e.preventDefault();
                                                                const input = e.currentTarget.previousElementSibling as HTMLInputElement;
                                                                const val = input.value.trim();
                                                                if (val && !crop.varieties.includes(val)) {
                                                                    setRegData({
                                                                        ...regData, 
                                                                        selectedCrops: regData.selectedCrops.map(c => c.name === crop.name ? {...c, varieties: [...c.varieties, val]} : c)
                                                                    });
                                                                    input.value = '';
                                                                }
                                                            }}
                                                        >
                                                            {t('profile.add_btn')}
                                                        </button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                            
                            <div className="space-y-4">
                                <span className="label block border-b border-slate-100 pb-2">{t('profile.your_role_in_company')}</span>
                                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                                    {companyCreatorRoles.map(item => (
                                        <button 
                                            key={item.role}
                                            onClick={() => setRegData({...regData, role: item.role})}
                                            className={`p-4 rounded-2xl border-2 text-left transition-all relative group ${regData.role === item.role ? 'bg-indigo-50 border-indigo-600 shadow-lg ring-4 ring-indigo-50/50' : 'bg-white border-slate-100 text-slate-400 hover:border-indigo-200'}`}
                                        >
                                            {regData.role === item.role && (
                                                <div className="absolute top-2 right-2 text-indigo-600">
                                                    <div className="bg-indigo-600 text-white rounded-full p-0.5"><CheckIcon size={10} strokeWidth={4} /></div>
                                                </div>
                                            )}
                                            <div className={`mb-3 ${regData.role === item.role ? 'text-indigo-600' : 'text-slate-300 group-hover:text-indigo-400'}`}>{item.icon}</div>
                                            <p className={`text-[10px] font-black uppercase tracking-tight leading-none ${regData.role === item.role ? 'text-indigo-900' : 'text-slate-500'}`}>{t(`role.${item.role}` as any)}</p>
                                            <p className="text-[8px] font-bold text-slate-400 mt-1 leading-tight">{t(`role.desc.${item.role}` as any)}</p>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="pt-6 border-t border-slate-100 flex items-center justify-between">
                                <label className="flex items-center gap-4 cursor-pointer group">
                                    <div onClick={() => setRegData({...regData, isDiscoverable: !regData.isDiscoverable})} className={`w-12 h-7 rounded-full p-1 transition-all duration-300 ${regData.isDiscoverable ? 'bg-slate-800' : 'bg-slate-200'}`}>
                                        <div className={`bg-white w-5 h-5 rounded-full shadow-md transition-transform duration-300 ${regData.isDiscoverable ? 'translate-x-5' : 'translate-x-0'}`} />
                                    </div>
                                    <div>
                                        <span className="label block text-slate-500 group-hover:text-slate-700 transition-colors">{t('profile.public_discoverability')}</span>
                                        <p className="text-[9px] font-bold text-slate-400 italic max-w-[250px] mt-0.5">{t('profile.public_discoverability_desc')}</p>
                                    </div>
                                </label>
                            </div>
                        </div>
                        
                        <div className="p-8 bg-white border-t border-slate-100 flex flex-col md:flex-row gap-4 justify-end">
                            <button 
                                onClick={() => props.onStartMapRegistration?.(regData)}
                                className="px-8 py-4 bg-white border-2 border-indigo-600 text-indigo-600 rounded-xl font-black text-xs uppercase tracking-widest hover:bg-indigo-50 transition-all flex items-center justify-center gap-3"
                            >
                                <MapIcon size={16} strokeWidth={3} /> {t('profile.draw_on_map')}
                            </button>
                            <button 
                                onClick={handleNextStep} 
                                className="px-12 py-4 bg-indigo-600 text-white rounded-xl font-black text-xs uppercase tracking-widest shadow-xl shadow-indigo-200 hover:bg-indigo-700 hover:shadow-2xl hover:-translate-y-0.5 transition-all flex items-center justify-center gap-3"
                            >
                                {t('profile.next_step')} <ChevronRightIcon size={16} strokeWidth={3} />
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <style>{`
                .reg-input { width: 100%; padding: 1rem 1.25rem; border: 2px solid #f1f5f9; border-radius: 1rem; font-weight: 700; font-size: 0.875rem; outline: none; background: #f8fafc; transition: all 0.2s; }
                .reg-input:focus { border-color: #6366f1; background: white; box-shadow: 0 0 0 4px rgba(99, 102, 241, 0.05); }
                .input-field { width: 100%; padding: 0.75rem 1rem; border: 2px solid #f1f5f9; border-radius: 1rem; font-weight: 700; font-size: 0.875rem; outline: none; background: #f8fafc; }
                .label { text-transform: uppercase; letter-spacing: 0.1em; font-size: 10px; font-weight: 900; color: #94a3b8; }
                .btn-primary { padding: 0.75rem 1.5rem; background-color: #4f46e5; color: white; border-radius: 0.75rem; font-weight: 800; font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.05em; }
                .btn-secondary { padding: 0.75rem 1.5rem; background-color: #e5e7eb; color: #374151; border-radius: 0.75rem; font-weight: 800; font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.05em; }
            `}</style>
            <WorkingAreaModal 
                isOpen={isWorkingAreaOpen} 
                onClose={() => {
                    setIsWorkingAreaOpen(false);
                    setEditingExperienceId(null);
                }} 
                user={user} 
                onUpdateUser={onUpdateUser} 
                experienceId={editingExperienceId}
                plantationFeatures={plantationFeatures}
                layers={layers}
                onSelectFeature={onSelectFeature}
            />

            {/* Item List Modal */}
            {isItemListModalOpen && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center z-[7000] p-4 animate-in fade-in">
                    <div className="bg-white w-full max-w-3xl rounded-[2.5rem] overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200 flex flex-col max-h-[88vh]">
                        <div className="p-6 md:p-8 bg-slate-50 border-b border-slate-100 flex justify-between items-center">
                            <div className="flex items-center gap-3">
                                <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center shadow-sm">
                                    <FileText size={24} />
                                </div>
                                <div>
                                    <h2 className="text-xl font-black text-slate-900 uppercase tracking-tight">Application Item List (item list.txt)</h2>
                                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-0.5">Master classification • 17 Modules • Sub-Components & Tools</p>
                                </div>
                            </div>
                            <button onClick={() => setIsItemListModalOpen(false)} className="p-2.5 hover:bg-slate-200 text-slate-400 hover:text-slate-600 rounded-full transition-colors">
                                <XIcon size={20} />
                            </button>
                        </div>

                        <div className="p-6 md:p-8 space-y-6 flex-grow overflow-y-auto">
                            <div className="flex flex-wrap items-center justify-between gap-3 p-4 bg-indigo-50/70 border border-indigo-100 rounded-2xl">
                                <div>
                                    <h4 className="text-xs font-black text-indigo-950 uppercase tracking-wide">Permanent Item Registry</h4>
                                    <p className="text-[11px] font-medium text-indigo-700 mt-0.5">Saved in root directory as <code className="bg-white/80 px-1.5 py-0.5 rounded font-mono font-bold text-indigo-900">/item list.txt</code></p>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button 
                                        onClick={handleDownloadItemList}
                                        className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-2 shadow-sm transition-all active:scale-95"
                                    >
                                        <Download size={14} /> Download item list.txt
                                    </button>
                                    {onSetAppMode && (
                                        <button 
                                            onClick={() => {
                                                setIsItemListModalOpen(false);
                                                onSetAppMode('guide');
                                            }}
                                            className="px-4 py-2 bg-white hover:bg-slate-100 text-indigo-700 border border-indigo-200 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-2 transition-all active:scale-95"
                                        >
                                            <BookOpen size={14} /> Manual Architecture
                                        </button>
                                    )}
                                </div>
                            </div>

                            <div className="space-y-4">
                                <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">17 Core Modules Catalog</h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 font-mono text-xs text-slate-700">
                                    {[
                                        { num: '01', name: 'Dashboard', comps: 'KPIs, Satellite HUD, Task Tracker, Inventory Snapshot, News' },
                                        { num: '02', name: 'Planner & Reminders', comps: 'Calendar, Field Tasks, Machine Work, Reminders, Push Alerts' },
                                        { num: '03', name: 'Map Planner & Design', comps: 'Layers, Drawing Tools (Boundary, Trees, Pipes), GPS Track, Sandbox' },
                                        { num: '04', name: 'Agronomy & Crop Care', comps: 'Nutrition Plans, Spray Logs, Soil Analysis, Disease Diagnostics' },
                                        { num: '05', name: 'Harvesting & Pallets', comps: 'Live Harvest Events, Yield Ledger, Pallet QR/Barcode, Quality Control' },
                                        { num: '06', name: 'Stock & Inventory', comps: 'Harvest Produce, Sales, Cold Storage, Live Ledger, Agro-Inputs, Assets, Supplies, Purchase Orders, Direct Charges' },
                                        { num: '07', name: 'Accounts & Finance', comps: 'General Ledger, Cashflow, Revenue, OPEX/CAPEX, Bank Reconciliation' },
                                        { num: '08', name: 'Tasks & Operations', comps: 'Worker Rosters, Machine Assignments, Field Logs, Geofence Tracking' },
                                        { num: '09', name: 'Marketplace & Trading', comps: 'Produce Listings, Bids, Logistics Routes, Supplier Directory' },
                                        { num: '10', name: 'AI Agronomic Analyst', comps: 'Gemini Chat, Satellite Multispectral, Soil Prescription, Market Predictions' },
                                        { num: '11', name: 'Communication & Community', comps: 'Direct Messaging, Forum Feed, Work Handshakes, Team Channels' },
                                        { num: '12', name: 'Tools & Utilities', comps: 'HR & Teams, Org Profiles, Document OCR, Plant Disease AI, Cloud Backups' },
                                        { num: '13', name: 'Help & Architecture Guide', comps: 'Manual Architecture, AI Analyzer, Guide Generator, Presentation Builder' },
                                        { num: '14', name: 'Experimental Labs', comps: 'IoT Sensors, BLE Gateway, Telemetry Streams, Next-Gen Engine' },
                                        { num: '15', name: 'System Logs & Audit', comps: 'Security Logs, Sync Queue, Offline Cache, Diagnostics' },
                                        { num: '16', name: 'Founders Hub & Portal', comps: 'Investor Deck, Multi-Farm Switcher, Org Onboarding, Legal Hub' },
                                        { num: '17', name: 'Root System Admin', comps: 'User Management, Global Organization Cleanup, Security Roles, DB Purge' },
                                    ].map(m => (
                                        <div key={m.num} className="p-3 bg-slate-50 border border-slate-200/70 rounded-xl space-y-1">
                                            <div className="flex items-center gap-2">
                                                <span className="px-1.5 py-0.5 bg-indigo-100 text-indigo-700 rounded text-[10px] font-black">{m.num}</span>
                                                <span className="font-sans font-bold text-slate-800 text-xs">{m.name}</span>
                                            </div>
                                            <p className="text-[10px] text-slate-500 font-sans leading-relaxed">{m.comps}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        <div className="p-6 bg-slate-50 border-t border-slate-100 flex justify-end">
                            <button onClick={() => setIsItemListModalOpen(false)} className="px-6 py-2.5 bg-slate-900 text-white rounded-xl text-xs font-black uppercase tracking-wider hover:bg-slate-800 transition-all">
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </main>
    );
};

const OfferServiceModal: React.FC<{ 
    isOpen: boolean; 
    onClose: () => void; 
    user: User; 
    onUpdateUser: (u: User) => void; 
    organizations: Organization[];
    onUpdateOrg?: (org: Organization) => void;
}> = ({ isOpen, onClose, user, onUpdateUser, organizations, onUpdateOrg }) => {
    const [services, setServices] = useState<string[]>(user.servicesOffered || []);
    const [customService, setCustomService] = useState('');
    const [experience, setExperience] = useState<WorkExperience[]>(user.cv?.experience || []);
    const [newExp, setNewExp] = useState({ title: '', company: '', startDate: '', endDate: '', location: '', isCompanyRole: false, description: '' });
    const [region, setRegion] = useState(user.region || '');
    const [availability, setAvailability] = useState(user.availability || 'Available');
    const [showOrgResults, setShowOrgResults] = useState(false);

    const defaultServices = ['Field Worker', 'Tractor Operator', 'Agronomist', 'Pruning Specialist', 'General Labor'];

    if (!isOpen) return null;

    const filteredOrgs = organizations.filter(o => 
        newExp.company && o.name.toLowerCase().includes(newExp.company.toLowerCase())
    ).slice(0, 5);
    
    const toggleService = (service: string) => {
        const sStr = String(service);
        if (services.includes(sStr)) setServices(services.filter(s => s !== sStr));
        else setServices([...services, sStr]);
    };

    const addCustomService = () => {
        const trimmed = customService.trim();
        if (trimmed && !services.includes(trimmed)) {
            setServices([...services, trimmed]);
            setCustomService('');
        }
    };

    const addExperience = () => {
        const companyName = newExp.company;
        if (!newExp.title || !companyName) return;
        setExperience([...experience, { 
            id: `exp-${Date.now()}`,
            title: String(newExp.title),
            company: String(companyName),
            startDate: String(newExp.startDate),
            endDate: String(newExp.endDate),
            location: String(newExp.location),
            isCompanyRole: newExp.isCompanyRole,
            description: String(newExp.description)
        }]);
        setNewExp({ title: '', company: '', startDate: '', endDate: '', location: '', isCompanyRole: false, description: '' });
        setShowOrgResults(false);
    };

    const handleSave = () => {
        onUpdateUser({ 
            ...user, 
            primaryGoal: 'OFFER_SERVICE', 
            servicesOffered: services,
            roles: (user.roles || []).includes('Independent') ? (user.roles || []) : [...(user.roles || []), 'Independent'],
            cv: { ...(user.cv || {}), experience },
            region: String(region),
            availability: availability as any
        });
        onClose();
    };

    return (
         <div className="fixed inset-0 bg-black/60 z-[6000] flex items-center justify-center p-4 backdrop-blur-sm" onClick={onClose}>
            <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]" onClick={e => e.stopPropagation()}>
                <div className="p-8 border-b bg-gray-50 flex justify-between items-center"><h2 className="text-xl font-black text-slate-800 uppercase tracking-tight">Professional CV & Services</h2><button onClick={onClose} className="p-2 hover:bg-gray-200 rounded-full"><XIcon className="h-6 w-6 text-slate-400"/></button></div>
                <div className="p-8 space-y-6 flex-grow overflow-y-auto">
                    <div>
                        <h4 className="label mb-4">My Services</h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {[...new Set([...defaultServices, ...services])].map(s => {
                                const sStr = String(s);
                                return (
                                    <label key={sStr} className={`flex items-center gap-3 p-3 rounded-2xl border transition-all cursor-pointer ${services.includes(sStr) ? 'bg-indigo-50 border-indigo-200' : 'bg-slate-50 border-slate-100 hover:border-indigo-100'}`}>
                                        <input type="checkbox" className="w-5 h-5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" checked={services.includes(sStr)} onChange={() => toggleService(sStr)} />
                                        <span className={`text-xs font-bold ${services.includes(sStr) ? 'text-indigo-900' : 'text-slate-600'}`}>{sStr}</span>
                                    </label>
                                );
                            })}
                        </div>
                        <div className="mt-4 flex gap-2">
                            <input 
                                value={customService} 
                                onChange={e => setCustomService(String(e.target.value))} 
                                placeholder="Missed a service? Type it here..." 
                                className="flex-1 input-field text-xs font-bold"
                                onKeyDown={e => e.key === 'Enter' && addCustomService()}
                            />
                            <button onClick={addCustomService} className="px-5 py-2.5 bg-indigo-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2 shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all">
                                <PlusIcon size={14}/> Add Custom Service
                            </button>
                        </div>
                    </div>
                     <div>
                        <h4 className="label mb-2">Chronological CV History</h4>
                        <div className="space-y-2 mb-4">{experience.map(exp => (<div key={exp.id} className="p-3 bg-slate-50 rounded-2xl border flex justify-between items-center shadow-sm"><div><p className="font-bold text-slate-800 text-sm">{String(exp.title)}</p><p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{String(exp.company)} • {exp.location || 'No Location'}</p><p className="text-[10px] text-slate-400">{String(exp.startDate)} - {exp.endDate ? String(exp.endDate) : 'Present'}</p><p className="text-[8px] font-bold text-indigo-600 uppercase tracking-widest mt-1">{exp.isCompanyRole ? 'Company Role' : 'Individual Role'}</p></div><button onClick={() => setExperience(experience.filter(e => e.id !== exp.id))} className="text-red-400 hover:text-red-600 p-2"><TrashIcon size={16}/></button></div>))}</div>
                         <div className="p-6 bg-slate-50 rounded-[2rem] border border-slate-200 space-y-4">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-2 text-center">Add New CV Entry</p>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                <input value={newExp.title} onChange={e => setNewExp({...newExp, title: String(e.target.value)})} placeholder="Title (e.g. Founder, Worker)" className="input-field" />
                                <div className="relative">
                                    <input 
                                        value={newExp.company} 
                                        onChange={e => {
                                            const val = e.target.value;
                                            setNewExp({...newExp, company: val});
                                            setShowOrgResults(val.length > 0);
                                        }} 
                                        placeholder="Company / Farm" 
                                        className="input-field" 
                                    />
                                    {showOrgResults && (
                                        <div className="absolute z-[7000] w-full mt-1 bg-white border border-slate-100 shadow-2xl rounded-2xl max-h-48 overflow-y-auto">
                                            {filteredOrgs.map(o => (
                                                <button 
                                                    key={o.id} 
                                                    onClick={() => {
                                                        setNewExp({...newExp, company: o.name});
                                                        setShowOrgResults(false);
                                                    }}
                                                    className="w-full text-left p-3 hover:bg-slate-50 text-xs font-bold text-slate-700 transition-all border-b border-slate-50 last:border-0"
                                                >
                                                    {o.name}
                                                </button>
                                            ))}
                                            {filteredOrgs.length === 0 && (
                                                <div className="p-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest italic">Not found. Saving manual input...</div>
                                            )}
                                        </div>
                                    )}
                                </div>
                                <input value={newExp.location} onChange={e => setNewExp({...newExp, location: String(e.target.value)})} placeholder="Location (e.g. Guria, Georgia)" className="input-field" />
                                <div className="flex bg-white p-1 rounded-xl border-2 border-slate-100">
                                    <button onClick={() => setNewExp({...newExp, isCompanyRole: true})} className={`flex-1 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${newExp.isCompanyRole ? 'bg-indigo-600 text-white' : 'text-slate-400'}`}>Company Role</button>
                                    <button onClick={() => setNewExp({...newExp, isCompanyRole: false})} className={`flex-1 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${!newExp.isCompanyRole ? 'bg-indigo-600 text-white' : 'text-slate-400'}`}>Individual Role</button>
                                </div>
                            </div>
                            <textarea 
                                value={newExp.description} 
                                onChange={e => setNewExp({...newExp, description: String(e.target.value)})} 
                                placeholder="Role description & achievements..." 
                                className="input-field min-h-[80px]"
                            />
                            <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-1"><label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest ml-1">Start Date</label><input type="date" value={newExp.startDate} onChange={e => setNewExp({...newExp, startDate: String(e.target.value)})} className="input-field font-bold" /></div>
                                <div className="space-y-1"><label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest ml-1">End Date</label><input type="date" value={newExp.endDate} onChange={e => setNewExp({...newExp, endDate: String(e.target.value)})} className="input-field font-bold" /></div>
                            </div>
                            <button onClick={addExperience} className="w-full py-3.5 bg-slate-800 text-white font-black text-[10px] uppercase tracking-widest rounded-xl shadow-lg hover:bg-slate-700 transition-all flex items-center justify-center gap-2">
                                <PlusCircleIcon size={14}/> Add to CV History
                            </button>
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div><label className="label">Primary Region</label><input value={region} onChange={e => setRegion(String(e.target.value))} placeholder="e.g., Georgia, Kakheti" className="input-field mt-1" /></div>
                        <div><label className="label">Current Availability</label><select value={availability} onChange={e => setAvailability(e.target.value as any)} className="input-field mt-1 font-bold"><option>Available</option><option>Unavailable</option></select></div>
                    </div>
                </div>
                <div className="p-6 bg-gray-50 border-t flex justify-end gap-3"><button onClick={onClose} className="btn-secondary">Cancel</button><button onClick={handleSave} className="btn-primary shadow-xl shadow-indigo-100">Save Profile</button></div>
            </div>
         </div>
    );
};

const BuyProductsModal: React.FC<{ isOpen: boolean; onClose: () => void; user: User; onUpdateUser: (u: User) => void; organizations: Organization[]; }> = ({ isOpen, onClose, user, onUpdateUser, organizations }) => {
    const [isCorporate, setIsCorporate] = useState(user.buyerPreferences?.isCorporate || false);
    const [companyName, setCompanyName] = useState(user.buyerPreferences?.companyName || '');
    const [preferredCrops, setPreferredCrops] = useState((user.buyerPreferences?.preferredCrops || []).join(', '));
    const [volume, setVolume] = useState(user.buyerPreferences?.volume || '');
    const [region, setRegion] = useState(user.region || '');
    const [availability, setAvailability] = useState(user.availability || 'Available');
    const [experience, setExperience] = useState<WorkExperience[]>(user.cv?.experience || []);
    const [newExp, setNewExp] = useState({ title: '', company: '', startDate: '', endDate: '', location: '', isCompanyRole: false });

    if (!isOpen) return null;

    const addExperience = () => {
        if (!newExp.title || !newExp.company) return;
        setExperience([...experience, { 
            id: `exp-${Date.now()}`,
            title: String(newExp.title),
            company: String(newExp.company),
            startDate: String(newExp.startDate),
            endDate: String(newExp.endDate),
            location: String(newExp.location),
            isCompanyRole: newExp.isCompanyRole
        }]);
        setNewExp({ title: '', company: '', startDate: '', endDate: '', location: '', isCompanyRole: false });
    };

    const handleSave = () => {
        onUpdateUser({ 
            ...user, 
            primaryGoal: 'BUY_PRODUCTS', 
            region: String(region),
            roles: (user.roles || []).includes('Buyer') ? (user.roles || []) : [...(user.roles || []), 'Buyer'],
            availability: availability as any,
            cv: { ...(user.cv || {}), experience },
            buyerPreferences: {
                isCorporate,
                companyName: String(companyName),
                preferredCrops: String(preferredCrops).split(',').map(s => s.trim()).filter(Boolean),
                volume: String(volume)
            } 
        });
        onClose();
    };

    return (
         <div className="fixed inset-0 bg-black/60 z-[6000] flex items-center justify-center p-4 backdrop-blur-sm" onClick={onClose}>
            <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]" onClick={e => e.stopPropagation()}>
                <div className="p-8 border-b bg-gray-50 flex justify-between items-center"><h2 className="text-xl font-black text-slate-800 uppercase tracking-tight">Buyer Profile</h2><button onClick={onClose} className="p-2 hover:bg-gray-200 rounded-full"><XIcon className="h-6 w-6 text-slate-400"/></button></div>
                <div className="p-8 space-y-4 flex-grow overflow-y-auto">
                    <label className="flex items-center gap-3 p-4 bg-slate-50 rounded-2xl border border-slate-100 cursor-pointer hover:border-indigo-200"><input type="checkbox" className="w-5 h-5 rounded" checked={isCorporate} onChange={() => setIsCorporate(!isCorporate)} /><span className="font-bold text-slate-700">I am a corporate buyer</span></label>
                    {isCorporate && <div><label className="label">Company Name</label><input value={companyName} onChange={e => setCompanyName(String(e.target.value))} placeholder="e.g., AgriCorp Inc." className="input-field mt-1" /></div>}
                    <div><label className="label">Preferred Crops (comma-separated)</label><input value={preferredCrops} onChange={e => setPreferredCrops(String(e.target.value))} placeholder="e.g., Blueberry, Hazelnut" className="input-field mt-1" /></div>
                    <div><label className="label">Expected Volume</label><input value={volume} onChange={e => setVolume(String(e.target.value))} placeholder="e.g., 1-5 tons/month" className="input-field mt-1" /></div>
                    <div><label className="label">Sourcing Countries/Regions</label><input value={region} onChange={e => setRegion(String(e.target.value))} placeholder="e.g., Georgia, Kakheti" className="input-field mt-1" /></div>
                    <div><label className="label">Availability</label><select value={availability} onChange={e => setAvailability(e.target.value as any)} className="input-field mt-1 font-bold"><option>Available</option><option>Unavailable</option></select></div>
                    <div>
                        <h4 className="label mb-2 mt-4">Procurement History / CV</h4>
                        <div className="space-y-2">{experience.map(exp => (<div key={exp.id} className="p-3 bg-slate-50 rounded-xl border flex justify-between items-center shadow-sm"><div><p className="font-bold text-sm text-slate-800">{String(exp.title)}</p><p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">{String(exp.company)} • {exp.location || 'No Location'}</p></div><button onClick={() => setExperience(experience.filter(e => e.id !== exp.id))} className="text-red-400 p-1.5 hover:bg-red-50 rounded-lg"><TrashIcon size={16}/></button></div>))}</div>
                         <div className="p-5 bg-slate-50 border-2 border-dashed border-slate-200 rounded-[2rem] space-y-3 mt-2">
                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1 ml-1 text-center">Add Past Deal Record</p>
                            <div className="grid grid-cols-2 gap-2">
                                <input value={newExp.title} onChange={e => setNewExp({...newExp, title: String(e.target.value)})} placeholder="Title" className="input-field text-xs font-bold" />
                                <input list="org-list" value={newExp.company} onChange={e => setNewExp({...newExp, company: String(e.target.value)})} placeholder="Supplier" className="input-field text-xs font-bold" />
                                <input value={newExp.location} onChange={e => setNewExp({...newExp, location: String(e.target.value)})} placeholder="Location" className="input-field text-xs font-bold col-span-2" />
                            </div>
                            <div className="grid grid-cols-2 gap-2"><input type="date" value={newExp.startDate} onChange={e => setNewExp({...newExp, startDate: String(e.target.value)})} className="input-field text-xs font-bold" /><input type="date" value={newExp.endDate} onChange={e => setNewExp({...newExp, endDate: String(e.target.value)})} className="input-field text-xs font-bold" /></div>
                            <button onClick={addExperience} className="w-full py-3 text-[10px] font-black uppercase tracking-widest text-indigo-600 bg-white border border-slate-200 rounded-xl hover:bg-indigo-50 hover:border-indigo-100 transition-all shadow-sm">Save Deal Record</button>
                        </div>
                    </div>
                </div>
                <div className="p-6 bg-gray-50 border-t flex justify-end gap-3"><button onClick={onClose} className="btn-secondary">Cancel</button><button onClick={handleSave} className="btn-primary">Save Profile</button></div>
            </div>
         </div>
    );
};

const BecomeAgentModal: React.FC<{ isOpen: boolean; onClose: () => void; user: User; onUpdateUser: (u: User) => void; allEmployees: Employee[]; organizations: Organization[]; }> = ({ isOpen, onClose, user, onUpdateUser, allEmployees = [], organizations = [] }) => {
    const [capacity, setCapacity] = useState(user.agentData?.capacity || 0);
    const [team, setTeam] = useState<{id: string, name: string, phone: string}[]>(user.agentData?.team || []);
    const [workerSearch, setWorkerSearch] = useState('');
    const [showManualRecruit, setShowManualRecruit] = useState(false);
    const [newWorker, setNewWorker] = useState({ name: '', phone: '' });
    const [region, setRegion] = useState(user.region || '');
    const [experience, setExperience] = useState<WorkExperience[]>(user.cv?.experience || []);
    const [newExp, setNewExp] = useState({ title: '', company: '', startDate: '', endDate: '', location: '', isCompanyRole: false });

    const filteredWorkers = useMemo(() => {
        if (!workerSearch.trim()) return [];
        const query = workerSearch.toLowerCase();
        return allEmployees.filter(e => {
            const fullName = e.name.toLowerCase();
            return fullName.includes(query) && !team.some(t => t.id === e.id);
        }).slice(0, 10);
    }, [workerSearch, allEmployees, team]);

    if (!isOpen) return null;
    
    const addMember = (member: {id: string, name: string, phone: string}) => {
        if (team.some(t => t.id === member.id)) return;
        setTeam([...team, member]);
        setWorkerSearch('');
    };

    const addManualMember = () => {
        if (!newWorker.name || !newWorker.phone) return;
        const member = {
            id: `manual-${Date.now()}`,
            name: newWorker.name,
            phone: newWorker.phone
        };
        addMember(member);
        setNewWorker({ name: '', phone: '' });
        setShowManualRecruit(false);
    };
    
    const addExperience = () => {
        if (!newExp.title || !newExp.company) return;
        setExperience([...experience, { 
            id: `exp-${Date.now()}`,
            title: String(newExp.title),
            company: String(newExp.company),
            startDate: String(newExp.startDate),
            endDate: String(newExp.endDate),
            location: String(newExp.location),
            isCompanyRole: newExp.isCompanyRole
        }]);
        setNewExp({ title: '', company: '', startDate: '', endDate: '', location: '', isCompanyRole: false });
    };

    const handleSave = () => {
        onUpdateUser({ 
            ...user, 
            primaryGoal: 'BECOME_AGENT', 
            region: String(region),
            roles: (user.roles || []).includes('Agro-Agent') ? (user.roles || []) : [...(user.roles || []), 'Agro-Agent'],
            cv: { ...(user.cv || {}), experience },
            agentData: { capacity: Number(capacity), team }
        });
        onClose();
    };

    return (
         <div className="fixed inset-0 bg-black/70 z-[6000] flex items-center justify-center p-4 backdrop-blur-md" onClick={onClose}>
            <div className="bg-white rounded-[3rem] shadow-2xl w-full max-w-6xl overflow-hidden flex flex-col h-[90vh]" onClick={e => e.stopPropagation()}>
                
                {/* Header Section */}
                <div className="p-8 border-b bg-gray-50 flex justify-between items-center">
                    <div>
                        <h2 className="text-3xl font-black text-slate-900 italic tracking-tighter uppercase leading-none">
                            AGRO-AGENT <span className="text-indigo-600 not-italic">PORTAL</span>
                        </h2>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mt-2">Team Management & Institutional Contracts</p>
                    </div>
                    <button onClick={onClose} className="p-3 hover:bg-gray-200 rounded-full transition-all transform hover:rotate-90">
                        <XIcon className="h-6 w-6 text-slate-400"/>
                    </button>
                </div>

                <div className="flex-1 flex overflow-hidden">
                    
                    {/* Left Pane: Registry & Team */}
                    <div className="w-[450px] border-r border-slate-100 flex flex-col bg-slate-50/30">
                        <div className="p-8 space-y-8 flex-grow overflow-y-auto custom-scrollbar">
                            
                            {/* Capacity & Region */}
                            <div className="grid grid-cols-1 gap-6">
                                <div className="space-y-1.5">
                                    <label className="label">Operation Region</label>
                                    <input value={region} onChange={e => setRegion(e.target.value)} placeholder="e.g. Kakheti, Georgia" className="reg-input-small" />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="label">Worker Capacity</label>
                                    <div className="relative">
                                        <input type="number" value={capacity} onChange={e => setCapacity(Number(e.target.value))} className="reg-input-small pr-12 font-black text-xl" />
                                        <UsersIcon className="absolute right-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-300" />
                                    </div>
                                </div>
                            </div>

                            {/* Roster Builder */}
                            <div className="space-y-4">
                                <h4 className="text-[11px] font-black text-slate-800 uppercase tracking-widest flex items-center gap-2">
                                    <PlusCircleIcon size={16} className="text-indigo-600" /> Roster Builder
                                </h4>
                                <div className="relative">
                                    <input 
                                        className="reg-input-small pl-10" 
                                        placeholder="Search worker registry..." 
                                        value={workerSearch} 
                                        onChange={e => setWorkerSearch(e.target.value)} 
                                    />
                                    <SearchIcon size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                                </div>

                                <div className="flex justify-end pt-2">
                                    <button 
                                        onClick={() => setShowManualRecruit(!showManualRecruit)}
                                        className="text-[10px] font-bold text-indigo-600 uppercase tracking-widest hover:text-indigo-800 transition-colors flex items-center gap-1"
                                    >
                                        {showManualRecruit ? <XIcon size={12} /> : <PlusIcon size={12} />}
                                        {showManualRecruit ? 'Cancel Manual Entry' : 'Manually Recruit New Worker'}
                                    </button>
                                </div>

                                {showManualRecruit && (
                                    <div className="p-4 bg-indigo-50 rounded-2xl border border-indigo-100 space-y-3 animate-slide-up mt-2">
                                        <h5 className="text-[10px] font-black text-indigo-900 uppercase tracking-widest">New Worker Details</h5>
                                        <input 
                                            placeholder="Full Name" 
                                            className="reg-input-small text-xs"
                                            value={newWorker.name}
                                            onChange={e => setNewWorker({...newWorker, name: e.target.value})}
                                        />
                                        <input 
                                            placeholder="Phone Number" 
                                            className="reg-input-small text-xs"
                                            value={newWorker.phone}
                                            onChange={e => setNewWorker({...newWorker, phone: e.target.value})}
                                        />
                                        <button 
                                            onClick={addManualMember}
                                            className="w-full py-3 bg-indigo-600 text-white rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200"
                                        >
                                            Add to Roster
                                        </button>
                                    </div>
                                )}

                                {workerSearch && (
                                    <div className="bg-white border border-slate-200 rounded-2xl shadow-xl p-2 animate-slide-up">
                                        {filteredWorkers.length > 0 ? filteredWorkers.map(w => (
                                            <button key={w.id} onClick={() => addMember({id: w.id, name: w.name, phone: w.phone})} className="w-full p-3 flex justify-between items-center hover:bg-indigo-50 rounded-xl group transition-all text-left">
                                                <div>
                                                    <p className="text-xs font-black text-slate-800">{w.name}</p>
                                                    <p className="text-[10px] font-bold text-slate-400">{w.phone}</p>
                                                </div>
                                                <PlusIcon size={14} className="text-indigo-400 opacity-0 group-hover:opacity-100" />
                                            </button>
                                        )) : (
                                            <p className="p-4 text-center text-[10px] font-bold text-slate-400 uppercase">No unregistered workers found.</p>
                                        )}
                                    </div>
                                )}
                                <div className="space-y-2 mt-6">
                                    <label className="label">Active Team ({team.length})</label>
                                    <div className="grid grid-cols-1 gap-2">
                                        {team.map(m => m && (
                                            <div key={m.id} className="p-4 bg-white rounded-2xl border border-slate-100 flex justify-between items-center shadow-sm group">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-[10px] font-black text-slate-500 uppercase">{(m?.name && typeof m.name === 'string') ? m.name.charAt(0) : '?'}</div>
                                                    <div>
                                                        <p className="text-xs font-black text-slate-800 leading-tight">{m.name}</p>
                                                        <p className="text-[9px] font-bold text-slate-400 tracking-widest">{m.phone}</p>
                                                    </div>
                                                </div>
                                                <button onClick={() => setTeam(team.filter(t => t && t.id !== m.id))} className="p-2 text-slate-300 hover:text-red-500 transition-colors">
                                                    <TrashIcon size={14} />
                                                </button>
                                            </div>
                                        ))}
                                        {team.length === 0 && <div className="py-10 text-center border-2 border-dashed border-slate-200 rounded-3xl text-slate-300 font-black uppercase text-[10px] tracking-widest">Team is empty</div>}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Right Pane: Ledger & Contracts */}
                    <div className="flex-1 bg-white flex flex-col">
                        <div className="p-10 space-y-10 overflow-y-auto custom-scrollbar">
                            
                            <div>
                                <h3 className="text-xl font-black text-slate-900 tracking-tight uppercase mb-2">Agency Track Record</h3>
                                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Verify your credibility with institutional contract records.</p>
                            </div>

                            <div className="space-y-4">
                                {experience.map(exp => (
                                    <div key={exp.id} className="p-6 bg-slate-50 rounded-[2rem] border border-slate-100 flex justify-between items-center group hover:bg-white hover:border-indigo-200 transition-all">
                                        <div className="flex items-center gap-6">
                                            <div className="w-12 h-12 rounded-2xl bg-white border border-slate-200 flex items-center justify-center text-slate-400 shadow-sm group-hover:text-indigo-600 transition-colors">
                                                <ShieldCheckIcon size={24} />
                                            </div>
                                            <div>
                                                <p className="text-sm font-black text-slate-800 uppercase tracking-tight">{exp.title}</p>
                                                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em]">{exp.company}</p>
                                                <p className="text-[10px] text-slate-400 mt-1">{exp.startDate} — {exp.endDate || 'Active'}</p>
                                            </div>
                                        </div>
                                        <button onClick={() => setExperience(experience.filter(e => e.id !== exp.id))} className="p-3 text-red-300 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all">
                                            <TrashIcon size={18} />
                                        </button>
                                    </div>
                                ))}
                                {experience.length === 0 && (
                                    <div className="py-20 text-center text-slate-300 border-2 border-dashed border-slate-100 rounded-[3rem]">
                                        <p className="font-black uppercase text-xs tracking-widest">No verified contracts registered</p>
                                    </div>
                                )}
                            </div>

                            <div className="p-10 bg-indigo-900 rounded-[3rem] text-white space-y-8 shadow-2xl relative overflow-hidden group">
                                <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -mr-32 -mt-32 transition-transform duration-1000 group-hover:scale-110"></div>
                                <h4 className="text-[11px] font-black text-indigo-400 uppercase tracking-[0.3em] flex items-center gap-3">
                                    <PlusCircleIcon size={16} /> Register Institutional Contract
                                </h4>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="space-y-1.5">
                                        <label className="text-[9px] font-black uppercase text-indigo-300 tracking-widest ml-1">Contract Nature</label>
                                        <input value={newExp.title} onChange={e => setNewExp({...newExp, title: e.target.value})} placeholder="e.g. Seasonal Labor Supply" className="bg-white/10 border-white/10 text-white rounded-2xl w-full p-4 font-bold outline-none focus:bg-white/20 transition-all" />
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-[9px] font-black uppercase text-indigo-300 tracking-widest ml-1">Customer / Organization</label>
                                        <input list="org-list" value={newExp.company} onChange={e => setNewExp({...newExp, company: e.target.value})} placeholder="Find registered farm..." className="bg-white/10 border-white/10 text-white rounded-2xl w-full p-4 font-bold outline-none focus:bg-white/20 transition-all" />
                                        <datalist id="org-list">{organizations.map(o => <option key={o.id} value={o.name} />)}</datalist>
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-6">
                                    <div className="space-y-1.5">
                                        <label className="text-[9px] font-black uppercase text-indigo-300 tracking-widest ml-1">Commencement Date</label>
                                        <input type="date" value={newExp.startDate} onChange={e => setNewExp({...newExp, startDate: e.target.value})} className="bg-white/10 border-white/10 text-white rounded-2xl w-full p-4 font-bold outline-none" />
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-[9px] font-black uppercase text-indigo-300 tracking-widest ml-1">Completion Date</label>
                                        <input type="date" value={newExp.endDate} onChange={e => setNewExp({...newExp, endDate: e.target.value})} className="bg-white/10 border-white/10 text-white rounded-2xl w-full p-4 font-bold outline-none" />
                                    </div>
                                </div>
                                <button onClick={addExperience} className="w-full py-5 bg-[#00ffc2] text-indigo-900 rounded-3xl font-[900] text-xs uppercase tracking-[0.3em] shadow-[0_0_30px_rgba(0,255,194,0.3)] hover:scale-[1.02] active:scale-95 transition-all">
                                    Commit Contract to Ledger
                                </button>
                            </div>
                            <div className="pt-8 border-t border-white/10">
                                <button 
                                    onClick={handleSave}
                                    className="w-full py-6 bg-white text-indigo-900 rounded-[2rem] font-black text-sm uppercase tracking-[0.2em] shadow-2xl hover:bg-indigo-50 active:scale-95 transition-all"
                                >
                                    Save Agent Profile
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            <style>{`
                .reg-input-small { width: 100%; padding: 0.875rem 1.25rem; border: 1px solid #e2e8f0; border-radius: 1.25rem; font-weight: 700; font-size: 0.875rem; outline: none; background: white; transition: all 0.2s; }
                .reg-input-small:focus { border-color: #6366f1; box-shadow: 0 0 0 4px rgba(99, 102, 241, 0.05); }
                .custom-scrollbar::-webkit-scrollbar { width: 4px; }
                .custom-scrollbar::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 10px; }
                @keyframes slide-up { from { transform: translateY(20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
                .animate-slide-up { animation: slide-up 0.5s ease-out forwards; }
            `}</style>
         </div>
    );
};


const WorkingAreaModal: React.FC<{ 
    isOpen: boolean; 
    onClose: () => void; 
    user: User; 
    onUpdateUser: (u: User) => void; 
    experienceId?: string | null;
    plantationFeatures?: any[];
    layers?: any[];
    onSelectFeature?: (id: string | null, options?: { event?: MouseEvent; fromPanel?: boolean }) => void;
}> = ({ isOpen, onClose, user, onUpdateUser, experienceId, plantationFeatures = [], layers = [], onSelectFeature }) => {
    const [center, setCenter] = useState<[number, number]>([41.8719, 44.0128]);
    const [radius, setRadius] = useState(10);

    const [isDiscoverable, setIsDiscoverable] = useState(user.workingArea?.isDiscoverable || false);
    const [areaName, setAreaName] = useState(user.workingArea?.name || '');

    useEffect(() => {
        if (isOpen) {
            if (experienceId) {
                const exp = (user.cv?.experience || []).find(e => e.id === experienceId);
                if (exp?.locationCoords) setCenter(exp.locationCoords);
                if (exp?.workZone?.radius) setRadius(exp.workZone.radius);
            } else {
                if (user.workingArea?.center) setCenter(user.workingArea.center);
                if (user.workingArea?.radius) setRadius(user.workingArea.radius);
                if (user.workingArea?.isDiscoverable) setIsDiscoverable(user.workingArea.isDiscoverable);
                if (user.workingArea?.name) setAreaName(user.workingArea.name);
            }
        }
    }, [isOpen, experienceId, user]);

    if (!isOpen) return null;

    const handleSave = () => {
        if (experienceId) {
            const updatedExp = (user.cv?.experience || []).map(item => 
                item.id === experienceId ? { ...item, locationCoords: center, workZone: { center, radius } } : item
            );
            onUpdateUser({ ...user, cv: { ...user.cv, experience: updatedExp } });
        } else {
            onUpdateUser({
                ...user,
                workingArea: { center, radius, isDiscoverable, name: areaName }
            });
        }
        onClose();
    };

    return (
        <div className="fixed inset-0 bg-black/60 z-[6000] flex items-center justify-center p-4 backdrop-blur-sm" onClick={onClose}>
            <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col h-[80vh]" onClick={e => e.stopPropagation()}>
                <div className="p-8 border-b bg-gray-50 flex justify-between items-center">
                    <div className="flex-1">
                        <h2 className="text-xl font-black text-slate-800 uppercase tracking-tight">Define Working Area</h2>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Pick a center point and radius for your operations</p>
                    </div>
                    <div className="flex items-center gap-4">
                        <div className="hidden sm:flex items-center bg-white rounded-xl px-4 py-2 border border-slate-200 focus-within:border-indigo-400 transition-all shadow-sm">
                            <SearchIcon className="h-4 w-4 text-slate-400 mr-2" />
                            <input 
                                type="text" 
                                placeholder="SEARCH LOCATION..." 
                                className="bg-transparent border-none outline-none text-[10px] font-black uppercase tracking-widest w-48 py-1"
                                onKeyDown={async (e) => {
                                    if (e.key === 'Enter') {
                                        const query = (e.target as HTMLInputElement).value;
                                        try {
                                            const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}`);
                                            const data = await res.json();
                                            if (data && data.length > 0) {
                                                const { lat, lon } = data[0];
                                                setCenter([parseFloat(lat), parseFloat(lon)]);
                                            }
                                        } catch (err) {
                                            console.error("Search failed", err);
                                        }
                                    }
                                }}
                            />
                        </div>
                        <button onClick={onClose} className="p-2 hover:bg-gray-200 rounded-full transition-colors"><XIcon className="h-6 w-6 text-slate-400"/></button>
                    </div>
                </div>
                <div className="flex-grow relative">
                    <MapComponent 
                        center={center} 
                        zoom={10} 
                        plantationFeatures={plantationFeatures} 
                        layers={layers} 
                        onSelectFeature={onSelectFeature || (() => {})} 
                        onMapClick={(e) => setCenter([e.lat, e.lng])}
                        flyToBounds={null}
                    />
                    <div className="absolute bottom-8 left-8 right-8 bg-white/90 backdrop-blur p-6 rounded-[2rem] shadow-2xl border border-slate-100 z-[1000] flex flex-col gap-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <label className="label">Area Name</label>
                                <input 
                                    value={areaName} 
                                    onChange={e => setAreaName(e.target.value)} 
                                    placeholder="e.g. Guria Operations" 
                                    className="input-field"
                                />
                            </div>
                            <div className="flex items-center gap-4 pt-6">
                                <label className="flex items-center gap-3 cursor-pointer">
                                    <div onClick={() => setIsDiscoverable(!isDiscoverable)} className={`w-10 h-5 rounded-full p-0.5 transition-all ${isDiscoverable ? 'bg-indigo-600' : 'bg-slate-200'}`}>
                                        <div className={`bg-white w-4 h-4 rounded-full shadow-md transition-transform ${isDiscoverable ? 'translate-x-5' : 'translate-x-0'}`} />
                                    </div>
                                    <span className="label">Make Discoverable</span>
                                </label>
                            </div>
                        </div>
                        <div className="flex flex-col md:flex-row items-center gap-6">
                            <div className="flex-grow w-full">
                                <label className="label mb-2">Service Radius: {radius} km</label>
                                <input 
                                    type="range" 
                                    min="1" 
                                    max="100" 
                                    value={radius} 
                                    onChange={e => setRadius(Number(e.target.value))} 
                                    className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                                />
                            </div>
                            <div className="flex gap-3 shrink-0">
                                <button onClick={onClose} className="btn-secondary">Cancel</button>
                                <button onClick={handleSave} className="btn-primary">Save Working Area</button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ProfileView;
