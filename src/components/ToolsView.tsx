
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { toast } from 'sonner';
import type { Role, Permission, Employee, EmployeeGroup, Machinery, PaymentType, ThemeSettings, User, UserRole, UploadedDocument, PlantDiseaseAnalysis, ForumPost, PlantationFeature, Membership, Organization, SubscriptionRequest, WorkAssignment, HarvestEvent, HarvestEntry, DailyLogEntry } from '../types';
import { ALL_PERMISSIONS, PAYMENT_TYPES } from '../types';
import * as d3 from 'd3';
import { db, updateDoc, doc, deleteDoc, auth } from '../firebase';
import type { SyncLogEntry } from '../firebase';
import { syncManager } from '../services/SyncManager';
import { USE_FIREBASE } from '../config';
import EmployeeModal from './EmployeeModal';
import ForemanManagerModal from './ForemanManagerModal';
import EmployeeIdCard from './EmployeeIdCard';
import QrScannerModal from './QrScannerModal';
import { initGlobalHardwareScannerListener, getActiveAdoptedScanner } from '../utils/hardwareScannerBus';
import { 
    PlusCircleIcon, PencilSquareIcon, TrashIcon, XCircleIcon, BriefcaseIcon, AlertTriangleIcon, 
    UserGroupIcon, SearchIcon, QrCodeIcon, UsersIcon, CheckIcon, ChevronRightIcon, XIcon, 
    SaveIcon, RefreshCwIcon, InfoIcon, PlantIcon, ArrowUpTrayIcon, ArrowDownTrayIcon, SparklesIcon, 
    ClipboardDocumentIcon, MicrophoneIcon, PaperClipIcon, PaperAirplaneIcon, MapPinIcon,
    ClockIcon, CurrencyDollarIcon, TagIcon, CalendarDaysIcon, BuildingStorefrontIcon, ShieldCheckIcon, PencilIcon
} from './Icons';
import { useLanguage } from '../contexts/LanguageContext';
import ScannedIdCardModal from './ScannedIdCardModal';
import { findMatchingEmployee } from '../utils/employeeMatching';
import type { MapComponentProps } from './MapComponent';
import { GoogleSheetsModal, GoogleSheetsModuleType } from './GoogleSheetsModal';
import { FileSpreadsheet } from 'lucide-react';
import { initializeApp, deleteApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword } from 'firebase/auth';
import { finalFirebaseConfig as firebaseConfig } from '../firebase'; 
import DailyLogManager from './SystemManagement/DailyLogManager'; 
import { TeamHubManager } from './TeamHubManager';

interface ToolsViewProps {
    roles: Role[];
    onSetRoles: (roles: Role[]) => void;
    employees: Employee[];
    onSetEmployees: (employees: Employee[]) => void;
    employeeGroups?: EmployeeGroup[];
    onSetEmployeeGroups?: (groups: EmployeeGroup[]) => void;
    currentUserPermissions: Set<Permission>;
    themeSettings?: ThemeSettings;
    onSetThemeSettings?: (settings: ThemeSettings) => void;
    users: User[];
    machinery?: Machinery[];
    onSetUsers: (users: User[]) => void;
    onDeleteOrganization?: (id: string, name: string) => void;
    onExportBackup: () => void;
    onImportBackup: (data: any) => void;
    onClearMap?: () => void;
    onResetSystem?: () => void;
    // AI Tools Props
    uploadedDocuments: UploadedDocument[];
    onSetUploadedDocuments: (updater: (docs: UploadedDocument[]) => UploadedDocument[]) => void;
    onDocumentAnalysis: (documents: UploadedDocument[]) => void;
    isDocAnalysisLoading: boolean;
    docAnalysisError: string | null;
    documentAnalysisResult: string | null;
    uploadedPlantImage: { dataUrl: string; file: File } | null;
    onSetUploadedPlantImage: (image: { dataUrl: string; file: File } | null) => void;
    onPlantDiseaseAnalysis: (file: File) => void;
    isDiseaseAnalysisLoading: boolean;
    diseaseAnalysisError: string | null;
    plantDiseaseAnalysis: PlantDiseaseAnalysis | null;
    uploadedAgriImage?: { dataUrl: string; file: File } | null;
    onSetUploadedAgriImage?: (image: { dataUrl: string; file: File } | null) => void;
    onAgriImageAnalysis?: (file: File) => void;
    isAgriImageAnalysisLoading?: boolean;
    agriImageAnalysisError?: string | null;
    agriImageAnalysis?: { subject: string; condition: string; metrics: string; recommendations: string[] } | null;
    // Team Hub Props
    currentUser: User | null;
    forumPosts: ForumPost[];
    onAddPost: (post: Partial<ForumPost>) => void;
    onAddReply: (postId: string, content: string) => void;
    onUpdatePost: (postId: string, updates: Partial<ForumPost>) => void;
    plantationFeatures: PlantationFeature[];
    mapProps: MapComponentProps;
    allUsers?: User[];
    activeOrgId: string | null;
    memberships: Membership[];
    onSetMemberships: (memberships: Membership[]) => void;
    isRoot?: boolean;
    organizations: Organization[];
    onSetOrganizations: (orgs: Organization[]) => void;
    subscriptionRequests?: SubscriptionRequest[];
    autoOpenHRModal?: boolean;
    workAssignments?: WorkAssignment[];
    harvestEvents?: HarvestEvent[];
    harvestEntries?: HarvestEntry[];
    dailyLogs?: DailyLogEntry[];
    onSetDailyLogs?: (logs: DailyLogEntry[]) => void;
}

const ToolsView: React.FC<ToolsViewProps> = (props) => {
    const { currentUserPermissions, onExportBackup, onImportBackup, onDeleteOrganization, onSetUsers, onSetOrganizations, users, organizations, employees, machinery, onSetEmployees } = props;
    const [activeTab, setActiveTab] = useState<'roles' | 'hr' | 'daily' | 'groups' | 'system' | 'ai_tools' | 'team_hub' | 'root'>('hr');
    const [isGoogleSheetsOpen, setIsGoogleSheetsOpen] = useState(false);
    const [googleSheetsModule, setGoogleSheetsModule] = useState<GoogleSheetsModuleType>('workers');
    const { t: translate } = useLanguage();
    
    const unreadCount = useMemo(() => {
        if (!props.currentUser) return 0;
        return props.forumPosts.filter(p => p.isDirectMessage && p.recipientId === props.currentUser?.id && !p.isRead).length;
    }, [props.forumPosts, props.currentUser]);

    if (!currentUserPermissions.has('edit_roles') && !currentUserPermissions.has('edit_employees')) {
        return (
            <main className="flex-1 bg-slate-50 p-8 flex items-center justify-center">
                <div className="text-center p-12 bg-white rounded-[3rem] shadow-sm border border-red-100 text-red-600">
                    <AlertTriangleIcon className="h-16 w-16 mx-auto opacity-50" />
                    <h2 className="mt-6 text-2xl font-black uppercase tracking-tighter">Security Alert</h2>
                    <p className="mt-2 text-slate-500 font-bold">Unauthorized entry attempt detected.</p>
                </div>
            </main>
        );
    }

    return (
        <main className="flex-1 bg-slate-50 overflow-y-auto p-4 md:p-8 safe-area-bottom">
            <div className="max-w-6xl mx-auto space-y-8 pb-20">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div>
                        <h1 className="text-4xl font-black text-slate-900 tracking-tighter uppercase">Application <span className="text-blue-600">Tools</span></h1>
                        <p className="text-sm font-bold text-slate-400">Global system configuration, HR registry, and specialized AI tools.</p>
                    </div>
                </div>

                <div className="flex gap-2 border-b border-slate-700/80 overflow-x-auto scrollbar-hide py-2 px-1">
                    {currentUserPermissions.has('edit_employees') && (
                        <>
                            <button 
                                onClick={() => setActiveTab('hr')} 
                                data-active={activeTab === 'hr' ? "true" : "false"}
                                className={`px-6 py-3 text-[10px] font-black uppercase tracking-widest rounded-2xl transition-all standing-light standing-beam ${activeTab === 'hr' ? 'bg-blue-600 text-white shadow-md underglow-box-active active' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'}`}
                            >
                                Human Resources
                            </button>
                            <button 
                                onClick={() => setActiveTab('daily')} 
                                data-active={activeTab === 'daily' ? "true" : "false"}
                                className={`px-6 py-3 text-[10px] font-black uppercase tracking-widest rounded-2xl transition-all standing-light standing-beam ${activeTab === 'daily' ? 'bg-blue-600 text-white shadow-md underglow-box-active active' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'}`}
                            >
                                Daily Attendance
                            </button>
                            <button 
                                onClick={() => setActiveTab('groups')} 
                                data-active={activeTab === 'groups' ? "true" : "false"}
                                className={`px-6 py-3 text-[10px] font-black uppercase tracking-widest rounded-2xl transition-all standing-light standing-beam ${activeTab === 'groups' ? 'bg-blue-600 text-white shadow-md underglow-box-active active' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'}`}
                            >
                                Teams & Units
                            </button>
                        </>
                    )}
                    {currentUserPermissions.has('edit_roles') && (
                        <button 
                            onClick={() => setActiveTab('roles')} 
                            data-active={activeTab === 'roles' ? "true" : "false"}
                            className={`px-6 py-3 text-[10px] font-black uppercase tracking-widest rounded-2xl transition-all standing-light standing-beam ${activeTab === 'roles' ? 'bg-blue-600 text-white shadow-md underglow-box-active active' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'}`}
                        >
                            Privileges
                        </button>
                    )}
                    <button 
                        onClick={() => setActiveTab('ai_tools')} 
                        data-active={activeTab === 'ai_tools' ? "true" : "false"}
                        className={`px-6 py-3 text-[10px] font-black uppercase tracking-widest rounded-2xl transition-all standing-light standing-beam ${activeTab === 'ai_tools' ? 'bg-blue-600 text-white shadow-md underglow-box-active active' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'}`}
                    >
                        AI Analysis Tools
                    </button>
                    <button 
                        onClick={() => setActiveTab('team_hub')} 
                        data-active={activeTab === 'team_hub' ? "true" : "false"}
                        className={`px-6 py-3 text-[10px] font-black uppercase tracking-widest rounded-2xl transition-all relative standing-light standing-beam ${activeTab === 'team_hub' ? 'bg-blue-600 text-white shadow-md underglow-box-active active' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'}`}
                    >
                        Team Hub
                        {unreadCount > 0 && (
                            <span className="absolute top-1 right-2 bg-red-500 text-white text-[8px] font-black h-4 w-4 rounded-full flex items-center justify-center animate-pulse border-2 border-slate-50">
                                {unreadCount}
                            </span>
                        )}
                    </button>
                    <button 
                        onClick={() => setActiveTab('system')} 
                        data-active={activeTab === 'system' ? "true" : "false"}
                        className={`px-6 py-3 text-[10px] font-black uppercase tracking-widest rounded-2xl transition-all standing-light standing-beam ${activeTab === 'system' ? 'bg-blue-600 text-white shadow-md underglow-box-active active' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'}`}
                    >
                        System & Backup
                    </button>
                    {props.isRoot && (
                        <button 
                            onClick={() => setActiveTab('root')} 
                            data-active={activeTab === 'root' ? "true" : "false"}
                            className={`px-6 py-3 text-[10px] font-black uppercase tracking-widest rounded-2xl transition-all standing-light standing-beam ${activeTab === 'root' ? 'bg-amber-600 text-white shadow-md underglow-box-active active' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'}`}
                        >
                            Root Authority
                        </button>
                    )}
                </div>

                <div className="animate-fade-in">
                    {activeTab === 'hr' && currentUserPermissions.has('edit_employees') && <HrManager {...props} />}
                    {activeTab === 'daily' && currentUserPermissions.has('edit_employees') && (
                        <div className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-slate-100">
                            <DailyLogManager
                                employees={employees}
                                dailyLogs={props.dailyLogs || []}
                                onSetDailyLogs={props.onSetDailyLogs || (() => {})}
                                currentUserPermissions={currentUserPermissions}
                            />
                        </div>
                    )}
                    {activeTab === 'groups' && currentUserPermissions.has('edit_employees') && props.onSetEmployeeGroups && <GroupManager employeeGroups={props.employeeGroups || []} onSetEmployeeGroups={props.onSetEmployeeGroups} employees={employees} activeOrgId={props.activeOrgId} />}
                    {activeTab === 'roles' && currentUserPermissions.has('edit_roles') && <RoleManager {...props} />}
                    {activeTab === 'ai_tools' && <AiToolsManager {...props} />}
                    {activeTab === 'team_hub' && <ToolsTeamHubWrapper {...props} />}
                    {activeTab === 'system' && <SystemBackupManager onExport={onExportBackup} onImport={onImportBackup} onClearMap={props.onClearMap} onResetSystem={props.onResetSystem} isRoot={props.isRoot} />}
                    {activeTab === 'root' && props.isRoot && <RootAuthorityManager users={props.users} onSetUsers={props.onSetUsers} organizations={props.organizations} onSetOrganizations={props.onSetOrganizations} onDeleteOrganization={props.onDeleteOrganization} subscriptionRequests={props.subscriptionRequests} memberships={props.memberships} />}
                </div>
            </div>
             <style>{`
                .input-field { width: 100%; padding: 0.75rem; border: 1px solid #e2e8f0; border-radius: 1rem; background-color: white; outline: none; }
                .button-primary { padding: 0.75rem 1.5rem; background-color: #0f172a; color: white; border-radius: 1rem; font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em; font-size: 0.75rem; }
                .animate-fade-in { animation: fade-in 0.3s ease-out; }
                @keyframes fade-in { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
                .scrollbar-hide::-webkit-scrollbar { display: none; }
            `}</style>
        </main>
    );
};

const HrManager: React.FC<ToolsViewProps> = (props) => {
    const { 
        employees, onSetEmployees, roles, users, onSetUsers, activeOrgId, 
        memberships, onSetMemberships, autoOpenHRModal, organizations, machinery,
        workAssignments = [], harvestEvents = [], harvestEntries = [], plantationFeatures = []
    } = props;
    const { t: translate } = useLanguage();
    const [searchQuery, setSearchQuery] = useState('');
    const [sortBy, setSortBy] = useState<'alphabet' | 'number' | 'data'>('alphabet');
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
    const [modalOpen, setModalOpen] = useState(autoOpenHRModal || false);
    const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
    const [managingForeman, setManagingForeman] = useState<Employee | null>(null);
    const [scannedCardEmployee, setScannedCardEmployee] = useState<Employee | null>(null);
    const [globalUserSearch, setGlobalUserSearch] = useState('');
    const [showGlobalSearch, setShowGlobalSearch] = useState(false);
    const [isScannerOpen, setIsScannerOpen] = useState(false);
    const [selectedEmployeeIds, setSelectedEmployeeIds] = useState<Set<string>>(new Set());
    const [activeScanner, setActiveScanner] = useState<any>(() => getActiveAdoptedScanner());
    const [isGoogleSheetsOpen, setIsGoogleSheetsOpen] = useState(false);
    const [googleSheetsModule, setGoogleSheetsModule] = useState<GoogleSheetsModuleType>('workers');

    useEffect(() => {
        initGlobalHardwareScannerListener();
        const updateScanner = () => setActiveScanner(getActiveAdoptedScanner());
        updateScanner();

        const handleHardwareScan = (evt: any) => {
            const scanData = evt.detail;
            if (!scanData || !scanData.code) return;

            const code = String(scanData.code).trim();
            const raw = String(scanData.raw || '').trim();

            const found = findMatchingEmployee(employees, code) || (raw ? findMatchingEmployee(employees, raw) : undefined);

            if (found) {
                toast.success(`Worker Identified via ${scanData.source || 'Hardware Scanner'}: ${found.name}`, {
                    description: `ID: ${found.idNumber || found.id} • Role: ${roles.find(r => r.id === found.roleId)?.name || 'Employee'}`
                });
                setIsScannerOpen(false);
                setScannedCardEmployee(found);
            } else {
                toast.warning(`Scanned code: "${code}"`, {
                    description: "No registered worker found matching this barcode/ID."
                });
            }
        };

        window.addEventListener('agrimap:hardware_scan', handleHardwareScan);
        window.addEventListener('focus', updateScanner);
        return () => {
            window.removeEventListener('agrimap:hardware_scan', handleHardwareScan);
            window.removeEventListener('focus', updateScanner);
        };
    }, [employees, roles]);

    const handleDownloadTemplate = () => {
        const headers = [
            "ID Number",
            "Full Name",
            "Email",
            "Phone",
            "Role Name",
            "Payment Type",
            "Payment Rate",
            "Barcode/Unique Number",
            "Age",
            "Sex",
            "Georgian Citizen (Yes/No)"
        ];
        const sampleRow = [
            "12345678901",
            "Giorgi Nishnianidze",
            "giorgi@example.com",
            "+995599123456",
            "Field Worker",
            "hourly",
            "10",
            "1001",
            "30",
            "Male",
            "Yes"
        ];
        
        const csvContent = "\uFEFF" + [headers.join(","), sampleRow.join(",")].join("\n");
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", "employee_import_template.csv");
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        toast.success("Excel CSV Template downloaded successfully! Open it in Excel to start listing staff.");
    };

    const handleExportExcel = () => {
        const headers = [
            "ID Number",
            "Full Name",
            "Email",
            "Phone",
            "Role Name",
            "Payment Type",
            "Payment Rate",
            "Barcode/Unique Number",
            "Age",
            "Sex",
            "Georgian Citizen (Yes/No)"
        ];

        const rows = (employees || []).map(emp => {
            const role = roles.find(r => r.id === emp.roleId)?.name || "Field Worker";
            return [
                `"${(emp.idNumber || '').replace(/"/g, '""')}"`,
                `"${(emp.name || '').replace(/"/g, '""')}"`,
                `"${(emp.email || '').replace(/"/g, '""')}"`,
                `"${(emp.phone || '').replace(/"/g, '""')}"`,
                `"${role.replace(/"/g, '""')}"`,
                `"${(emp.paymentType || 'hourly').replace(/"/g, '""')}"`,
                emp.paymentRate || 0,
                `"${(emp.barcode || '').replace(/"/g, '""')}"`,
                emp.age || "",
                `"${(emp.sex || '').replace(/"/g, '""')}"`,
                emp.isGeorgianCitizen ? "Yes" : "No"
            ];
        });

        const csvContent = "\uFEFF" + [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", `employee_registry_export_${new Date().toISOString().slice(0, 10)}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        toast.success("Employee registry exported successfully!");
    };

    const parseCSV = (text: string): string[][] => {
        const lines: string[][] = [];
        let row: string[] = [];
        let inQuotes = false;
        let currentValue = '';

        for (let i = 0; i < text.length; i++) {
            const char = text[i];
            const nextChar = text[i + 1];

            if (char === '"') {
                if (inQuotes && nextChar === '"') {
                    currentValue += '"';
                    i++;
                } else {
                    inQuotes = !inQuotes;
                }
            } else if (char === ',' && !inQuotes) {
                row.push(currentValue.trim());
                currentValue = '';
            } else if ((char === '\r' || char === '\n') && !inQuotes) {
                if (char === '\r' && nextChar === '\n') {
                    i++;
                }
                row.push(currentValue.trim());
                if (row.length > 0 && (row.length > 1 || row[0] !== '')) {
                    lines.push(row);
                }
                row = [];
                currentValue = '';
            } else {
                currentValue += char;
            }
        }
        if (currentValue || row.length > 0) {
            row.push(currentValue.trim());
            if (row.length > 0 && (row.length > 1 || row[0] !== '')) {
                lines.push(row);
            }
        }
        return lines;
    };

    const handleImportExcel = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const text = e.target?.result as string;
                const cleanText = text.startsWith('\uFEFF') ? text.slice(1) : text;
                const parsedLines = parseCSV(cleanText);
                if (parsedLines.length < 2) {
                    toast.error("The selected file is empty or has no data rows.");
                    return;
                }

                const headerRow = parsedLines[0].map(h => h.toLowerCase().trim().replace(/[^a-z0-9]/g, ''));
                
                const getColIndex = (aliases: string[]): number => {
                    for (const alias of aliases) {
                        const idx = headerRow.findIndex(h => h.includes(alias) || alias.includes(h));
                        if (idx !== -1) return idx;
                    }
                    return -1;
                };

                const idxIdNumber = getColIndex(['idnumber', 'personalid', 'personalnumber']);
                const idxName = getColIndex(['fullname', 'name', 'employee']);
                const idxEmail = getColIndex(['email']);
                const idxPhone = getColIndex(['phone', 'mobile']);
                const idxRoleName = getColIndex(['rolename', 'role']);
                const idxPaymentType = getColIndex(['paymenttype', 'paytype']);
                const idxPaymentRate = getColIndex(['paymentrate', 'rate']);
                const idxBarcode = getColIndex(['barcode', 'uniquenumber', 'cardnumber', 'qr']);
                const idxAge = getColIndex(['age']);
                const idxSex = getColIndex(['sex', 'gender']);
                const idxGeorgian = getColIndex(['georgiancitizen', 'georgian', 'citizen']);

                if (idxName === -1 || idxIdNumber === -1) {
                    toast.error("Import failed: Missing 'Full Name' or 'ID Number' in header row.");
                    return;
                }

                const newEmployees: Employee[] = [];
                const existingIds = new Set((employees || []).map(emp => emp.idNumber));
                const existingBarcodes = new Set((employees || []).map(emp => emp.barcode).filter(Boolean));

                let duplicateCount = 0;
                let importCount = 0;

                for (let i = 1; i < parsedLines.length; i++) {
                    const row = parsedLines[i];
                    if (row.length < 2) continue;

                    const idNumber = row[idxIdNumber]?.trim() || '';
                    const name = row[idxName]?.trim() || '';

                    if (!name || !idNumber) continue;

                    if (existingIds.has(idNumber)) {
                        duplicateCount++;
                        continue;
                    }

                    const roleName = idxRoleName !== -1 ? row[idxRoleName]?.trim() : 'Field Worker';
                    let matchedRole = roles.find(r => r.name.toLowerCase() === roleName.toLowerCase());
                    if (!matchedRole) {
                        matchedRole = roles.find(r => r.name.toLowerCase().includes('worker')) || roles[0];
                    }

                    let barcode = idxBarcode !== -1 ? row[idxBarcode]?.trim() : '';
                    if (barcode && existingBarcodes.has(barcode)) {
                        barcode = ''; 
                    }

                    const rawPayType = idxPaymentType !== -1 ? row[idxPaymentType]?.trim().toLowerCase() : 'hourly';
                    let paymentType: PaymentType = 'hourly';
                    if (rawPayType.includes('daily')) paymentType = 'daily';
                    else if (rawPayType.includes('weight') || rawPayType.includes('kg')) paymentType = 'per_weight';
                    else if (rawPayType.includes('salary') || rawPayType.includes('month')) paymentType = 'salary';

                    const paymentRate = idxPaymentRate !== -1 ? parseFloat(row[idxPaymentRate]?.replace(/[^0-9.]/g, '')) || 0 : 0;
                    const email = idxEmail !== -1 ? row[idxEmail]?.trim() : '';
                    const phone = idxPhone !== -1 ? row[idxPhone]?.trim() : '';
                    const age = idxAge !== -1 ? parseInt(row[idxAge]?.replace(/[^0-9]/g, '')) || undefined : undefined;
                    const sex = idxSex !== -1 ? row[idxSex]?.trim() : '';
                    
                    const rawGeorgian = idxGeorgian !== -1 ? row[idxGeorgian]?.trim().toLowerCase() : '';
                    const isGeorgianCitizen = rawGeorgian === 'yes' || rawGeorgian === 'true' || rawGeorgian === 'კი' || rawGeorgian === '1';

                    const newEmp: Employee = {
                        id: `emp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                        name,
                        idNumber,
                        employeeType: 'Temporary',
                        email,
                        phone,
                        roleId: matchedRole?.id || '',
                        paymentType,
                        paymentRate,
                        accountType: 'Cash',
                        barcode: barcode || undefined,
                        status: 'active',
                        joinedAt: new Date().toISOString(),
                        organizationId: activeOrgId || '',
                        age,
                        sex,
                        isGeorgianCitizen
                    };

                    newEmployees.push(newEmp);
                    existingIds.add(idNumber);
                    if (barcode) existingBarcodes.add(barcode);
                    importCount++;
                }

                if (newEmployees.length === 0) {
                    if (duplicateCount > 0) {
                        toast.warning(`No new employees imported. ${duplicateCount} rows skipped as they are already in the registry.`);
                    } else {
                        toast.error("No valid employee rows found in the CSV.");
                    }
                    return;
                }

                await onSetEmployees([...employees, ...newEmployees]);
                toast.success(`Successfully imported ${importCount} employees into HR!${duplicateCount > 0 ? ` (${duplicateCount} duplicate ID Numbers skipped)` : ''}`);
            } catch (error: any) {
                toast.error(`Import failed: ${error?.message || error}`);
            }
        };
        reader.readAsText(file);
        event.target.value = '';
    };

    const getRoleOfEmp = (roleId?: string): string => {
        if (!roleId) return 'Employee';
        const matched = roles.find(r => r.id === roleId || (r.name && roleId && r.name.toLowerCase() === roleId.toLowerCase()));
        if (matched) return matched.name;
        return roleId;
    };

    const handleSaveEmployee = async (emp: Employee) => {
        if (editingEmployee) {
            onSetEmployees(employees.map(e => e.id === emp.id ? emp : e));
            
            // Sync Membership & User Role when editing an existing employee
            const targetOrgId = emp.organizationId || activeOrgId;
            const targetUser = users.find(u => (u.email && emp.email && u.email.toLowerCase() === emp.email.toLowerCase()) || (u.personalNumber && u.personalNumber === emp.idNumber));
            if (targetUser && targetOrgId) {
                const updatedRole = getRoleOfEmp(emp.roleId) as UserRole;
                const updatedPermission = (updatedRole === 'Admin' ? 'admin' : updatedRole === 'Field Manager' ? 'write' : 'read') as 'read' | 'write' | 'admin';

                // 1. Update Membership
                const updatedMemberships = memberships.map(m => {
                    if (m.userId === targetUser.id && m.organizationId === targetOrgId) {
                        return {
                            ...m,
                            role: updatedRole,
                            permissionLevel: updatedPermission,
                            status: 'active' as const
                        };
                    }
                    return m;
                });

                const hasMem = memberships.some(m => m.userId === targetUser.id && m.organizationId === targetOrgId);
                if (!hasMem) {
                    const newMem: Membership = {
                        id: `mem-${Date.now()}`,
                        userId: targetUser.id,
                        organizationId: targetOrgId,
                        role: updatedRole,
                        permissionLevel: updatedPermission,
                        status: 'active',
                        joinedAt: new Date().toISOString()
                    };
                    onSetMemberships([...memberships, newMem]);
                } else {
                    onSetMemberships(updatedMemberships);
                }

                // 2. Update User Global Roles list
                const currentRoles = targetUser.roles || [];
                if (!currentRoles.includes(updatedRole)) {
                    const updatedUser = {
                        ...targetUser,
                        roles: [updatedRole, ...currentRoles.filter(r => r !== updatedRole && r !== 'Guest')]
                    };
                    onSetUsers(users.map(u => u.id === targetUser.id ? updatedUser : u));
                }
            }
            toast.success(`${emp.name} updated successfully.`);
        } else {
            const newEmpId = `emp-${Date.now()}`;
            const newEmp: Employee = { 
                ...emp, 
                id: newEmpId, 
                barcode: emp.barcode || `BC-${Date.now()}`,
                organizationId: emp.organizationId || activeOrgId // Favor modal-selected org
            };
            
            // Optimistic update for UI visibility
            onSetEmployees([...employees, newEmp]);
            toast.success(`${emp.name} added to registry.`);

            // Only create Global User if requested
            if (emp.isGlobalUser && emp.email && emp.password) {
                toast.info("Provisioning global identity...", { duration: 2000 });
                const uniqueNum = Math.floor(100000 + Math.random() * 900000).toString();
                const targetOrgId = emp.organizationId || activeOrgId || 'personal';

                // HR Handshake logic: Search global users by email or personal number
                let targetUser = users.find(u => u.email === emp.email || u.personalNumber === emp.idNumber);
                
                if (!targetUser) {
                    try {
                        // EXTREME HR HANDSHAKE: Provision real Auth account using secondary instance
                        // This allows creating the account without logging out the current admin
                        const secondaryApp = initializeApp(firebaseConfig, `Secondary-${Date.now()}`);
                        const secondaryAuth = getAuth(secondaryApp);
                        
                        const userCredential = await createUserWithEmailAndPassword(secondaryAuth, emp.email, emp.password);
                        const newUid = userCredential.user.uid;
                        await deleteApp(secondaryApp);

                        targetUser = {
                            id: newUid,
                            globalUniqueId: `G-${uniqueNum}`,
                            individualUniqueId: `I-${uniqueNum}`,
                            workerUniqueId: `W-${uniqueNum}`,
                            activeRole: 'worker',
                            name: emp.name,
                            email: emp.email,
                            isGlobalAccount: true,
                            isGlobalProfile: true,
                            currentOrgId: targetOrgId, // Use correct property name from types.ts
                            phone: emp.phone,
                            personalNumber: emp.idNumber,
                            verificationStatus: 'unverified',
                            kycStatus: 'none',
                            isProfileDiscoverable: true,
                            isPubliclyVisible: true,
                            status: 'active',
                            roles: [getRoleOfEmp(emp.roleId) as UserRole],
                            createdAt: new Date().toISOString(),
                            aiQueryCount: 0,
                            payrollConfig: emp.paymentType && emp.paymentRate ? { rate: emp.paymentRate, frequency: emp.paymentType === 'salary' ? 'monthly' : 'daily' } : undefined,
                            cv: {
                                education: [],
                                experience: [{
                                    id: `exp-${Date.now()}`,
                                    title: getRoleOfEmp(emp.roleId),
                                    company: organizations.find(o => o.id === targetOrgId)?.name || 'Current Organization',
                                    startDate: new Date().toISOString(),
                                    endDate: 'Present',
                                    organizationId: targetOrgId,
                                    isCompanyRole: true
                                }],
                                skills: emp.notes ? [emp.notes] : [],
                                certifications: []
                            }
                        };
                        onSetUsers([...users, targetUser]);
                        toast.success(`Active global profile provisioned for ${emp.name}. They can now login directly.`);
                    } catch (provisionError: any) {
                        const provCode = provisionError?.code || "";
                        const provMessage = provisionError?.message || "";
                        if (provCode === 'auth/email-already-in-use' || provMessage.includes('auth/email-already-in-use')) {
                            console.warn("Provisioning fallback (user already exists):", provisionError);
                            toast.warning(`${emp.name} already has a global account. Linking existing profile.`);
                            // Fallback to searching and linking (logic already below)
                        } else {
                            console.error("Provisioning failed:", provisionError);
                            toast.error(`Auth provisioning failed: ${provisionError.message}`);
                        }
                    }
                }

                if (targetUser && targetOrgId && targetOrgId !== 'ALL') {
                    // Update existing user with new experience record if joining a new company
                    const hasExperience = targetUser.cv?.experience?.some(e => e.organizationId === targetOrgId);
                    if (!hasExperience) {
                        const updatedUser = {
                            ...targetUser,
                            cv: {
                                ...targetUser.cv,
                                experience: [
                                    ...(targetUser.cv?.experience || []),
                                    {
                                        id: `exp-${Date.now()}`,
                                        title: getRoleOfEmp(emp.roleId),
                                        company: organizations.find(o => o.id === targetOrgId)?.name || 'Updated Organization',
                                        startDate: new Date().toISOString(),
                                        endDate: 'Present',
                                        organizationId: targetOrgId,
                                        isCompanyRole: true
                                    }
                                ]
                            }
                        };
                        onSetUsers(users.map(u => u.id === targetUser?.id ? updatedUser : u));
                    }

                    // Link ID to Membership
                    const newMembership: Membership = {
                        id: `mem-${Date.now()}`,
                        userId: targetUser.id,
                        organizationId: targetOrgId,
                        role: getRoleOfEmp(emp.roleId) as UserRole,
                        permissionLevel: (getRoleOfEmp(emp.roleId) === 'Admin' ? 'admin' : 'write'),
                        status: 'active',
                        joinedAt: new Date().toISOString()
                    };
                    if (!memberships.some(m => m.userId === targetUser?.id && m.organizationId === targetOrgId)) {
                        onSetMemberships([...memberships, newMembership]);
                    }
                }
            }
        }
        setModalOpen(false);
    };

    const handleAddGlobalUser = (user: User) => {
        // Create employee record from existing user
        const newEmp: Employee = {
            id: `emp-${Date.now()}`,
            name: user?.name || 'Unknown',
            email: user?.email || '',
            phone: user?.phone || '',
            idNumber: user?.personalNumber || '',
            roleId: roles.find(r => r.name === (user.roles?.[0] || 'Employee'))?.id || roles[0]?.id || '',
            paymentType: 'hourly',
            paymentRate: 0,
            barcode: `BC-${Date.now()}`,
            employeeType: 'Permanent',
            accountType: 'Bank Account',
            status: 'active',
            joinedAt: new Date().toISOString(),
            organizationId: activeOrgId || undefined,
            isGlobalUser: true
        };
        
        onSetEmployees([...employees, newEmp]);
        
        if (activeOrgId) {
            const newMem: Membership = {
                id: `mem-${Date.now()}`,
                userId: user.id,
                organizationId: activeOrgId,
                role: (user.roles[0] || 'Employee') as UserRole,
                permissionLevel: user.roles[0] === 'Admin' ? 'admin' : 'write',
                status: 'active',
                joinedAt: new Date().toISOString()
            };
            onSetMemberships([...memberships, newMem]);
        }
        toast.success(`User ${user.name} added to organization`);
        setShowGlobalSearch(false);
    };

    const [employeeToDelete, setEmployeeToDelete] = useState<{id: string, isGlobal: boolean, emp: Employee} | null>(null);

    const handleDeleteEmployee = async (id: string, isGlobal: boolean) => {
        const emp = employees.find(e => e.id === id);
        if (!emp) return;
        setEmployeeToDelete({ id, isGlobal, emp });
    };

    const confirmDeleteEmployee = async () => {
        if (!employeeToDelete) return;
        const { id, isGlobal, emp } = employeeToDelete;
        setEmployeeToDelete(null);

        if (isGlobal) {
            try {
                await onSetEmployees(employees.filter(e => e.id !== id));
                toast.success(`Global user ${emp.name} has been unlinked from the company.`);
            } catch (err) {
                toast.error("Failed to unlink employee.");
            }
            return;
        }
        
        try {
            // Delete from HR Registry
            await onSetEmployees(employees.filter(e => e.id !== id));
            
            // If they had a local user account (not global but admin-created)
            const linkedUser = (users || []).find(u => u.email === emp.email || u.personalNumber === emp.idNumber);
            if (linkedUser && !linkedUser.isGlobalProfile) {
                if (onSetUsers) await onSetUsers((users || []).filter(u => u.id !== linkedUser.id));
                if (USE_FIREBASE && auth.currentUser) {
                    import('firebase/firestore').then(({ deleteDoc, doc }) => {
                         deleteDoc(doc(db, 'users', linkedUser.id)).catch(console.error);
                    });
                }
            }

            toast.success("Employee removed successfully.");
        } catch (error) {
            toast.error("Failed to delete employee record.");
        }
    };

    const filteredEmployees = useMemo(() => {
        const filtered = (employees || []).filter(e => {
            const nameStr = e?.name || '';
            const emailStr = e?.email || '';
            const idNumStr = e?.idNumber || '';
            const q = searchQuery?.toLowerCase() || '';
            return nameStr.toLowerCase().includes(q) ||
                   emailStr.toLowerCase().includes(q) ||
                   idNumStr.toLowerCase().includes(q);
        });

        return [...filtered].sort((a, b) => {
            if (sortBy === 'alphabet') {
                const valA = (a?.name || '').toLowerCase();
                const valB = (b?.name || '').toLowerCase();
                return sortOrder === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
            } else if (sortBy === 'number') {
                const numA = parseInt(a?.barcode || '') || 0;
                const numB = parseInt(b?.barcode || '') || 0;
                if (numA === numB) return (a?.name || '').localeCompare(b?.name || '');
                return sortOrder === 'asc' ? numA - numB : numB - numA;
            } else if (sortBy === 'data') {
                const valA = a?.joinedAt || '';
                const valB = b?.joinedAt || '';
                return sortOrder === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
            }
            return 0;
        });
    }, [employees, searchQuery, sortBy, sortOrder]);

    const searchedGlobalUsers = useMemo(() => {
        if (!globalUserSearch) return [];
        const q = globalUserSearch.toLowerCase();
        return (users || []).filter(u => {
            const nameStr = (u?.name || '').toLowerCase();
            const emailStr = (u?.email || '').toLowerCase();
            const personalNumStr = (u?.personalNumber || '').toLowerCase();
            return (nameStr.includes(q) || emailStr.includes(q) || personalNumStr.includes(q)) &&
                   !(employees || []).some(e => e?.email && u?.email && e.email === u.email);
        });
    }, [users, globalUserSearch, employees]);

    return (
        <div className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-slate-100">
            <div className="flex flex-col gap-6 mb-8 border-b border-slate-100 pb-6">
                {/* Search & Sort Row */}
                <div className="flex flex-col xl:flex-row justify-between gap-4 items-stretch xl:items-center">
                    <div className="flex-grow flex flex-col md:flex-row gap-4 items-stretch md:items-center">
                        <div className="relative flex-grow">
                            <SearchIcon className="h-5 w-5 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2"/>
                            <input 
                                type="text" 
                                value={searchQuery} 
                                onChange={e => setSearchQuery(e.target.value)} 
                                placeholder="Find local staff..." 
                                className="input-field pl-12 w-full text-xs py-3" 
                            />
                        </div>
                        <div className="flex items-center gap-2 bg-slate-50 px-3 py-2 rounded-xl border border-slate-200 shrink-0 self-start md:self-auto">
                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider">{translate('sort.label') || 'Sort By'}:</span>
                            <select 
                                value={`${sortBy}-${sortOrder}`}
                                onChange={(e) => {
                                    const [field, order] = e.target.value.split('-');
                                    setSortBy(field as 'alphabet' | 'number' | 'data');
                                    setSortOrder(order as 'asc' | 'desc');
                                }}
                                className="bg-transparent border-none outline-none text-[9px] font-black uppercase text-slate-700 cursor-pointer pr-1"
                            >
                                <option value="alphabet-asc">Alphabet A-Z</option>
                                <option value="alphabet-desc">Alphabet Z-A</option>
                                <option value="number-asc">Unique Number Low-High</option>
                                <option value="number-desc">Unique Number High-Low</option>
                                <option value="data-asc">Date Oldest</option>
                                <option value="data-desc">Date Newest</option>
                            </select>
                        </div>
                    </div>
                    
                    <div className="flex flex-wrap gap-2 shrink-0 items-center">
                        <div className="flex items-center gap-1.5 px-3 py-2 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-[9px] font-black uppercase tracking-wider" title="Adopted Hardware Scanner Active">
                            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0"></span>
                            <span className="truncate max-w-[130px] sm:max-w-[200px]">
                                {activeScanner?.name ? `${activeScanner.name}` : 'USB / BT Scanner Ready'}
                            </span>
                        </div>
                        <button 
                            onClick={() => setIsScannerOpen(true)} 
                            className="px-4 py-2.5 bg-slate-900 text-white rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-slate-800 transition-all shadow-md flex items-center gap-1.5"
                            title="Scan Worker QR or Barcode"
                        >
                            <ShieldCheckIcon className="h-3.5 w-3.5" /> Scan ID
                        </button>
                        <button 
                            onClick={() => setShowGlobalSearch(true)} 
                            className="px-4 py-2.5 bg-blue-50 text-blue-600 rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-blue-100 transition-all flex items-center gap-1.5"
                        >
                            <SearchIcon className="h-3.5 w-3.5" /> Global Search
                        </button>
                    </div>
                </div>

                {/* Excel & Actions Toolbar Row */}
                <div className="flex flex-col lg:flex-row justify-between items-stretch lg:items-center gap-4 bg-slate-50/55 p-4 rounded-2xl border border-slate-100">
                    <div className="flex items-center gap-2">
                        <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest bg-slate-200/70 px-2.5 py-1 rounded-md flex items-center gap-1.5">
                            <FileSpreadsheet size={12} className="text-emerald-600" /> Excel & Google Sheets
                        </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                        <button 
                            onClick={() => {
                                setGoogleSheetsModule('workers');
                                setIsGoogleSheetsOpen(true);
                            }}
                            className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-[9px] font-black uppercase tracking-widest transition-all flex items-center gap-1.5 shadow-sm"
                            title="Import and Export Workers with Google Sheets"
                        >
                            <FileSpreadsheet size={12} /> Google Sheets Workers
                        </button>

                        <button 
                            onClick={() => {
                                setGoogleSheetsModule('payroll');
                                setIsGoogleSheetsOpen(true);
                            }}
                            className="px-4 py-2.5 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-[9px] font-black uppercase tracking-widest transition-all flex items-center gap-1.5 shadow-sm"
                            title="Export Payroll of chosen workers, teams & units to Google Sheets"
                        >
                            <FileSpreadsheet size={12} /> Export Payroll to Sheets
                        </button>

                        <button 
                            onClick={handleDownloadTemplate}
                            className="px-4 py-2.5 bg-white border border-slate-200 text-slate-700 hover:text-indigo-600 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all flex items-center gap-1.5"
                            title="Download CSV Template to fill out in Excel"
                        >
                            <ArrowDownTrayIcon size={12} /> Download Template
                        </button>

                        <label className="px-4 py-2.5 bg-white border border-slate-200 text-slate-700 hover:text-emerald-600 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all flex items-center gap-1.5 cursor-pointer">
                            <ArrowUpTrayIcon size={12} /> Import List
                            <input 
                                type="file" 
                                accept=".csv" 
                                onChange={handleImportExcel} 
                                className="hidden" 
                            />
                        </label>

                        <button 
                            onClick={handleExportExcel}
                            className="px-4 py-2.5 bg-white border border-slate-200 text-slate-700 hover:text-blue-600 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all flex items-center gap-1.5"
                            title="Export current employee registry to Excel-compatible CSV"
                        >
                            <ArrowDownTrayIcon size={12} /> Export HR
                        </button>

                        <button 
                            onClick={() => { 
                                setEditingEmployee(null); 
                                setModalOpen(true);
                            }} 
                            className="px-5 py-2.5 bg-amber-600 text-white rounded-xl text-[9px] font-black uppercase tracking-widest shadow-md hover:bg-amber-700 transition-all flex items-center gap-1.5"
                        >
                            <PlusCircleIcon size={12} /> Add Daily Worker Account
                        </button>
                    </div>
                </div>
            </div>

            {showGlobalSearch && (
                <div className="mb-10 p-8 bg-blue-50/50 rounded-[2.5rem] border border-blue-100 animate-in slide-in-from-top duration-300">
                    <div className="flex justify-between items-center mb-6">
                        <div>
                            <h3 className="text-sm font-black text-blue-900 uppercase tracking-widest flex items-center gap-2">
                                <UsersIcon size={18} /> Global Talent Search
                            </h3>
                            <p className="text-[10px] font-bold text-blue-400 uppercase tracking-widest mt-1">Onboard existing registered profiles</p>
                        </div>
                        <button onClick={() => setShowGlobalSearch(false)} className="p-2 hover:bg-blue-100 rounded-full transition-all text-blue-400">
                            <XIcon className="h-5 w-5" />
                        </button>
                    </div>
                    
                    <div className="relative mb-6">
                        <SearchIcon className="h-5 w-5 text-blue-400 absolute left-4 top-1/2 -translate-y-1/2"/>
                        <input 
                            type="text" 
                            value={globalUserSearch} 
                            onChange={e => setGlobalUserSearch(e.target.value)} 
                            placeholder="Search by name or email..." 
                            className="w-full p-4 bg-white border border-blue-100 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500 pl-12 text-sm font-bold"
                        />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {Array.isArray(searchedGlobalUsers) && searchedGlobalUsers.slice(0, 6).map(user => (
                            <div key={user.id} className="p-4 bg-white rounded-2xl border border-blue-100 flex items-center justify-between group hover:shadow-md transition-all">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center font-black text-sm">
                                        {(user?.name && typeof user.name === 'string') ? user.name.charAt(0) : 'U'}
                                    </div>
                                    <div>
                                        <p className="text-xs font-black text-slate-800">{user?.name || 'Unknown'}</p>
                                        <p className="text-[9px] font-bold text-slate-400 truncate max-w-[120px]">{user?.email || 'No email'}</p>
                                    </div>
                                </div>
                                <button 
                                    onClick={() => handleAddGlobalUser(user)}
                                    className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                                    title="Add to Team"
                                >
                                    <PlusCircleIcon className="h-5 w-5" />
                                </button>
                            </div>
                        ))}
                        {globalUserSearch && searchedGlobalUsers.length === 0 && (
                            <div className="col-span-full py-4 text-center text-[10px] font-black text-blue-300 uppercase tracking-widest">No matching registered users found.</div>
                        )}
                        {!globalUserSearch && (
                            <div className="col-span-full py-4 text-center text-[10px] font-black text-blue-300 uppercase tracking-widest">Start typing to search global database...</div>
                        )}
                    </div>
                </div>
            )}

            {/* Bulk Payment & Rate Actions Panel */}
            <div className="mb-8 p-6 bg-slate-50 rounded-3xl border border-slate-200 shadow-sm animate-fadeIn">
                <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 mb-4">
                    <div>
                        <h4 className="font-black text-slate-900 uppercase tracking-widest text-xs flex items-center gap-2">
                            <span>👥</span> Bulk Wage & Payment Method Updates
                        </h4>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">
                            Update payment type and rate in bulk for selected or all workers
                        </p>
                    </div>
                    <div className="flex items-center gap-4 text-xs font-bold text-indigo-900">
                        <span>👥 {selectedEmployeeIds.size} Selected</span>
                        <button 
                            type="button" 
                            onClick={() => {
                                if (selectedEmployeeIds.size === filteredEmployees.length) {
                                    setSelectedEmployeeIds(new Set());
                                } else {
                                    setSelectedEmployeeIds(new Set(filteredEmployees.map(e => e.id)));
                                }
                            }}
                            className="text-indigo-600 hover:text-indigo-800 text-[10px] font-black uppercase"
                        >
                            {selectedEmployeeIds.size === filteredEmployees.length ? 'Deselect All' : 'Select All Filtered'}
                        </button>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-4 text-xs">
                    <div className="flex flex-col gap-1 min-w-[150px]">
                        <span className="text-[9px] font-black text-slate-400 uppercase">Payment Method</span>
                        <select 
                            id="hr-bulk-payment-type"
                            className="text-xs font-black p-2 border border-slate-200 rounded-xl bg-white"
                            defaultValue="per_weight"
                        >
                            <option value="hourly">Hourly</option>
                            <option value="daily">Daily</option>
                            <option value="per_weight">Per Weight</option>
                            <option value="salary">Salary</option>
                        </select>
                    </div>

                    <div className="flex flex-col gap-1 min-w-[100px]">
                        <span className="text-[9px] font-black text-slate-400 uppercase">Payment Rate</span>
                        <input 
                            id="hr-bulk-payment-rate"
                            type="number"
                            step="0.01"
                            placeholder="Rate"
                            className="text-xs font-black p-2 border border-slate-200 rounded-xl bg-white"
                        />
                    </div>

                    <div className="flex items-end gap-2 mt-4 lg:mt-0 lg:self-end">
                        <button 
                            type="button"
                            onClick={async () => {
                                const typeEl = document.getElementById('hr-bulk-payment-type') as HTMLSelectElement;
                                const rateEl = document.getElementById('hr-bulk-payment-rate') as HTMLInputElement;
                                if (!typeEl) return;
                                
                                const newType = typeEl.value as any;
                                const newRate = rateEl?.value ? parseFloat(rateEl.value) : undefined;

                                if (selectedEmployeeIds.size === 0) {
                                    toast.error('No employees selected. Check the box on employee cards or click "Select All Filtered".');
                                    return;
                                }

                                const updated = employees.map(emp => {
                                    if (selectedEmployeeIds.has(emp.id)) {
                                        return {
                                            ...emp,
                                            paymentType: newType,
                                            paymentRate: newRate !== undefined && !isNaN(newRate) ? newRate : emp.paymentRate
                                        };
                                    }
                                    return emp;
                                });

                                await onSetEmployees(updated);
                                setSelectedEmployeeIds(new Set());
                                if (rateEl) rateEl.value = '';
                                toast.success(`Bulk updated ${selectedEmployeeIds.size} selected employees!`);
                            }}
                            className="px-4 py-2.5 bg-indigo-600 text-white rounded-xl text-[10px] font-black uppercase tracking-wider hover:bg-indigo-700 transition-all shadow-sm cursor-pointer disabled:opacity-50"
                            disabled={selectedEmployeeIds.size === 0}
                        >
                            Apply to Selected ({selectedEmployeeIds.size})
                        </button>

                        <button 
                            type="button"
                            onClick={async () => {
                                const typeEl = document.getElementById('hr-bulk-payment-type') as HTMLSelectElement;
                                const rateEl = document.getElementById('hr-bulk-payment-rate') as HTMLInputElement;
                                if (!typeEl) return;
                                
                                const newType = typeEl.value as any;
                                const newRate = rateEl?.value ? parseFloat(rateEl.value) : undefined;

                                const confirmMsg = `Are you sure you want to update ALL ${employees.length} employees in the system to ${newType}${newRate !== undefined ? ` at rate ${newRate}` : ''}?`;
                                if (!window.confirm(confirmMsg)) return;

                                const updated = employees.map(emp => {
                                    return {
                                        ...emp,
                                        paymentType: newType,
                                        paymentRate: newRate !== undefined && !isNaN(newRate) ? newRate : emp.paymentRate
                                    };
                                });

                                await onSetEmployees(updated);
                                setSelectedEmployeeIds(new Set());
                                if (rateEl) rateEl.value = '';
                                toast.success(`Bulk updated all ${employees.length} employees!`);
                            }}
                            className="px-4 py-2.5 bg-amber-600 text-white rounded-xl text-[10px] font-black uppercase tracking-wider hover:bg-amber-700 transition-all shadow-sm cursor-pointer"
                        >
                            Apply to All ({employees.length})
                        </button>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {(filteredEmployees || []).map(emp => (
                    <div key={emp.id} className="p-6 bg-slate-50 rounded-[2rem] border border-slate-100 group relative hover:shadow-xl transition-all">
                        <div className="absolute top-4 right-4 z-10">
                            <input 
                                type="checkbox"
                                checked={selectedEmployeeIds.has(emp.id)}
                                onChange={(e) => {
                                    const next = new Set(selectedEmployeeIds);
                                    if (e.target.checked) {
                                        next.add(emp.id);
                                    } else {
                                        next.delete(emp.id);
                                    }
                                    setSelectedEmployeeIds(next);
                                }}
                                className="rounded text-indigo-600 focus:ring-indigo-500 h-4 w-4 cursor-pointer"
                            />
                        </div>
                        <div className="flex items-center gap-4 mb-6">
                            <div className="w-14 h-14 rounded-2xl bg-white border-2 border-slate-200 flex items-center justify-center text-slate-800 font-black text-xl shadow-sm">{(emp?.name && typeof emp.name === 'string') ? emp.name.charAt(0) : 'E'}</div>
                            <div>
                                <h4 className="font-black text-slate-900 leading-tight text-lg">{emp?.name || 'Unnamed Employee'}</h4>
                                <div className="flex items-center gap-2 mt-1">
                                    <p className="text-[9px] font-black text-blue-600 uppercase tracking-widest bg-blue-50 px-2 py-0.5 rounded-full inline-block">
                                        {getRoleOfEmp(emp.roleId)}
                                    </p>
                                    {emp.isGlobalUser && (
                                        <div className="flex items-center gap-1">
                                            <span className="text-[8px] font-black text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full uppercase tracking-widest flex items-center gap-1">
                                                <SparklesIcon size={8} /> Global Profile
                                            </span>
                                            {(() => {
                                                const lu = users.find(u => u.email === emp.email || u.personalNumber === emp.idNumber);
                                                if (lu) {
                                                    return lu.verificationStatus === 'verified' || lu.verificationStatus === 'full_verified' ? (
                                                        <span className="text-[8px] font-black text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full uppercase tracking-widest flex items-center gap-1">
                                                            <CheckIcon size={8} /> Verified
                                                        </span>
                                                    ) : (
                                                        <span className="text-[8px] font-black text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full uppercase tracking-widest">
                                                            Pending Verification
                                                        </span>
                                                    );
                                                }
                                                return null;
                                            })()}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                        <div className="space-y-2 text-[10px] font-black text-slate-400 uppercase tracking-widest mb-6">
                            <p className="flex justify-between"><span>ID Number</span> <span className="text-slate-700">{emp.idNumber}</span></p>
                            <p className="flex justify-between"><span>Payroll Type</span> <span className="text-slate-700">{emp.paymentType}</span></p>
                            <p className="flex justify-between"><span>Profile Type</span> <span className="text-slate-700">{emp.employeeType || (emp.isGlobalUser ? 'Global' : 'Local')}</span></p>
                            <p className="flex justify-between"><span>QR Number</span> <span className="text-slate-700 truncate max-w-[120px] text-right">{emp.barcode}</span></p>
                            {emp.age !== undefined && emp.age !== null && (
                                <p className="flex justify-between"><span>Age</span> <span className="text-slate-700">{emp.age}</span></p>
                            )}
                            {emp.sex && (
                                <p className="flex justify-between"><span>Sex</span> <span className="text-slate-700">{emp.sex}</span></p>
                            )}
                            {emp.isGeorgianCitizen !== undefined && (
                                <p className="flex justify-between"><span>Georgian Citizen</span> <span className="text-slate-700">{emp.isGeorgianCitizen ? 'Yes 🇬🇪' : 'No'}</span></p>
                            )}
                        </div>
                        <div className="flex gap-2 border-t border-slate-200 pt-4">
                            {getRoleOfEmp(emp.roleId) === 'Foreman' && (
                                <button onClick={() => setManagingForeman(emp)} className="flex-1 py-3 bg-indigo-50 border border-indigo-200 text-indigo-700 rounded-xl text-[10px] font-black uppercase hover:bg-indigo-600 hover:text-white transition-all flex items-center justify-center gap-2 shadow-sm">
                                    <UsersIcon className="h-4 w-4"/> Manage Crew
                                </button>
                            )}

                            <button onClick={() => setScannedCardEmployee(emp)} className="flex-1 py-3 bg-white border border-slate-200 text-slate-600 rounded-xl text-[10px] font-black uppercase hover:bg-indigo-50 hover:text-indigo-600 transition-all flex items-center justify-center gap-2">
                                <QrCodeIcon className="h-4 w-4"/> ID Card
                            </button>
                            <button onClick={() => { setEditingEmployee(emp); setModalOpen(true); }} className="p-3 bg-white border border-slate-200 text-slate-400 rounded-xl hover:text-blue-600 transition-all shadow-sm"><PencilSquareIcon className="h-5 w-5"/></button>
                            <button 
                                onClick={() => handleDeleteEmployee(emp.id, !!emp.isGlobalUser)} 
                                className="p-3 bg-white border border-slate-200 text-slate-400 rounded-xl hover:text-red-600 transition-all shadow-sm"
                                title="Delete Employee"
                            >
                                <TrashIcon className="h-5 w-5"/>
                            </button>
                        </div>
                    </div>
                ))}
                {employees.length === 0 && <div className="col-span-full py-20 text-center text-slate-300 font-black uppercase tracking-widest text-xs">No employees found in registry.</div>}
            </div>

             {modalOpen && <EmployeeModal employee={editingEmployee} onSave={handleSaveEmployee} onClose={() => setModalOpen(false)} roles={roles} allEmployees={employees} organizations={organizations} activeOrgId={activeOrgId} />}
             {managingForeman && <ForemanManagerModal foreman={managingForeman} allEmployees={employees} allMachinery={machinery || []} onSave={async (upd) => { await onSetEmployees(employees.map(e => e.id === upd.id ? upd : e)); setManagingForeman(null); }} onClose={() => setManagingForeman(null)} />}

             
             {scannedCardEmployee && (
                <ScannedIdCardModal 
                    employee={scannedCardEmployee} 
                    roles={roles} 
                    workAssignments={workAssignments} 
                    harvestEvents={harvestEvents} 
                    harvestEntries={harvestEntries} 
                    plantationFeatures={plantationFeatures} 
                    onClose={() => setScannedCardEmployee(null)} 
                />
             )}
             
            <QrScannerModal 
                isOpen={isScannerOpen} 
                onClose={() => setIsScannerOpen(false)} 
                mockEmployees={employees}
                initialCategory="worker"
                title={translate('harvest.scan_id') || "Scan Worker ID Card"}
                description="დაასკანერეთ თანამშრომლის ID ბარათი, QR ან შტრიხკოდი"
                onScan={(result, category, parsed) => {
                    const code = String(result).trim();
                    const found = parsed?.employee || findMatchingEmployee(employees, code) || employees.find(e => 
                        e.id === code || e.barcode === code || e.idNumber === code || (e.name && code.toLowerCase().includes(e.name.toLowerCase()))
                    );
                    setIsScannerOpen(false);
                    if (found) {
                        toast.success(`Worker Identified: ${found.name}`);
                        setScannedCardEmployee(found);
                    } else {
                        toast.warning(`Employee not found for scan data: ${code.substring(0, 25)}...`);
                    }
                }}
            />
            {employeeToDelete && (
                <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
                    <div className="bg-white max-w-sm w-full rounded-[2rem] shadow-2xl p-6 border border-slate-100 flex flex-col items-center text-center">
                        <div className="w-16 h-16 bg-red-100 text-red-500 rounded-full flex items-center justify-center mb-4">
                            <TrashIcon className="h-8 w-8" />
                        </div>
                        <h3 className="text-lg font-black text-slate-800 uppercase tracking-tight mb-2">
                            {employeeToDelete.isGlobal ? 'Unlink Worker' : 'Delete Worker'}
                        </h3>
                        <p className="text-xs font-bold text-slate-500 mb-6">
                            {employeeToDelete.isGlobal 
                                ? `Are you sure you want to unlink ${employeeToDelete.emp.name} from your company? They will keep their global profile.`
                                : `Are you sure you want to permanently delete ${employeeToDelete.emp.name} from the local registry? All their local logs will be unlinked.`}
                        </p>
                        <div className="flex gap-3 w-full">
                            <button 
                                onClick={() => setEmployeeToDelete(null)}
                                className="flex-1 py-3 bg-slate-100 text-slate-600 rounded-xl font-black uppercase text-[10px] tracking-widest hover:bg-slate-200"
                            >
                                Cancel
                            </button>
                            <button 
                                onClick={confirmDeleteEmployee}
                                className="flex-1 py-3 bg-red-500 text-white rounded-xl font-black uppercase text-[10px] tracking-widest shadow-lg shadow-red-200 hover:bg-red-600"
                            >
                                Confirm
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {isGoogleSheetsOpen && (
                <GoogleSheetsModal
                    isOpen={isGoogleSheetsOpen}
                    onClose={() => setIsGoogleSheetsOpen(false)}
                    initialModule={googleSheetsModule}
                    employees={employees}
                    onSetEmployees={onSetEmployees}
                    harvestEvents={props.harvestEvents || []}
                    workAssignments={props.workAssignments || []}
                    dailyLogs={props.dailyLogs || []}
                    currentUser={props.currentUser}
                    activeOrgId={props.activeOrgId}
                />
            )}
        </div>
    );
};

const GroupManager: React.FC<{ employeeGroups: EmployeeGroup[], onSetEmployeeGroups: (groups: EmployeeGroup[]) => void, employees: Employee[], activeOrgId: string | null }> = ({ employeeGroups, onSetEmployeeGroups, employees, activeOrgId }) => {
    const [isGroupModalOpen, setIsGroupModalOpen] = useState(false);
    const [editingGroup, setEditingGroup] = useState<EmployeeGroup | null>(null);

    const handleSaveGroup = (groupData: EmployeeGroup) => {
        if (editingGroup) {
            onSetEmployeeGroups(employeeGroups.map(g => g.id === groupData.id ? groupData : g));
        } else {
            onSetEmployeeGroups([...employeeGroups, { ...groupData, id: `group-${Date.now()}`, organizationId: activeOrgId || '' }]);
        }
        setIsGroupModalOpen(false);
    };
    
    return (
        <>
            <div className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-slate-100">
                <div className="flex justify-between items-center mb-10">
                    <h2 className="text-2xl font-black text-slate-800 tracking-tight">Team Units</h2>
                    <button onClick={() => { setEditingGroup(null); setIsGroupModalOpen(true); }} className="button-primary flex items-center gap-2">
                        <UsersIcon className="h-5 w-5" /> Form Unit
                    </button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                    {(employeeGroups || []).map(group => (
                        <div key={group.id} className="p-6 bg-slate-50 rounded-[2rem] border border-slate-100 relative group">
                            <div className="flex items-center gap-4 mb-4">
                                <div className="w-12 h-12 rounded-2xl bg-indigo-600 text-white flex items-center justify-center font-black text-xl shadow-xl">{(group?.name && typeof group.name === 'string') ? group.name.charAt(0) : 'G'}</div>
                                <h3 className="font-black text-slate-800 text-lg leading-tight truncate pr-6">{group?.name || 'Unnamed Unit'}</h3>
                            </div>
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">{group.employeeIds.length} Registered Members</p>
                            <div className="flex gap-2">
                                <button onClick={() => { setEditingGroup(group); setIsGroupModalOpen(true); }} className="flex-1 py-2.5 bg-white border border-slate-200 text-slate-600 rounded-xl text-[10px] font-black uppercase hover:bg-slate-100 transition-all">Configure</button>
                                <button onClick={() => {
                                    const copyName = `${group.name} (Copy)`;
                                    const newGroup: EmployeeGroup = {
                                        ...group,
                                        id: `group-${Date.now()}`,
                                        name: copyName,
                                        employeeIds: [...group.employeeIds],
                                        organizationId: activeOrgId || ''
                                    };
                                    onSetEmployeeGroups([...employeeGroups, newGroup]);
                                    toast.success(`Duplicated "${group.name}" with all ${group.employeeIds.length} members as "${copyName}"!`);
                                }} className="p-2.5 bg-white border border-slate-200 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-colors" title="Duplicate Team Unit">
                                    <ClipboardDocumentIcon className="h-5 w-5"/>
                                </button>
                                <button onClick={() => {
                                    if(confirm(`Delete group "${group.name}"?`)) {
                                        onSetEmployeeGroups(employeeGroups.filter(g => g.id !== group.id));
                                    }
                                }} className="p-2.5 bg-white border border-slate-200 text-red-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-colors"><TrashIcon className="h-5 w-5"/></button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
            {isGroupModalOpen && (
                <GroupModal
                    isOpen={isGroupModalOpen}
                    onClose={() => setIsGroupModalOpen(false)}
                    onSave={handleSaveGroup}
                    group={editingGroup}
                    employees={employees}
                    organizationId={activeOrgId || ''}
                />
            )}
        </>
    );
};

const RoleManager: React.FC<ToolsViewProps> = ({ roles, onSetRoles }) => {
    const [isRoleModalOpen, setIsRoleModalOpen] = useState(false);
    const [editingRole, setEditingRole] = useState<Role | null>(null);

    const handleSaveRole = (roleData: Role) => {
        if (editingRole) {
            onSetRoles(roles.map(r => r.id === roleData.id ? roleData : r));
        } else {
            onSetRoles([...roles, { ...roleData, id: `role-${Date.now()}` }]);
        }
        setIsRoleModalOpen(false);
    };
    
    return (
        <>
            <div className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-slate-100">
                <div className="flex justify-between items-center mb-10">
                    <h2 className="text-2xl font-black text-slate-800 tracking-tight">Privilege Registry</h2>
                    <button onClick={() => { setEditingRole(null); setIsRoleModalOpen(true); }} className="button-primary">Define Privilege</button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                    {roles.map(role => (
                        <div key={role.id} className="p-6 bg-slate-50 rounded-[2rem] border border-slate-100 group relative">
                            <div className="absolute top-4 right-4 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button onClick={() => { setEditingRole(role); setIsRoleModalOpen(true); }} className="p-1.5 bg-white/50 hover:bg-white rounded-full text-blue-600"><PencilSquareIcon className="h-4 w-4"/></button>
                                <button onClick={() => {
                                    if (confirm(`Delete role "${role.name}"?`)) {
                                        onSetRoles(roles.filter(r => r.id !== role.id));
                                    }
                                }} className="p-1.5 bg-white/50 hover:bg-white rounded-full text-red-600"><TrashIcon className="h-4 w-4"/></button>
                            </div>
                            <h3 className="font-black text-slate-900 text-lg mb-2">{role.name}</h3>
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">{role.permissions.length} Active Permissions</p>
                            <button className="flex-1 py-2.5 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase hover:bg-slate-800 transition-all">Audit Permissions</button>
                        </div>
                    ))}
                </div>
            </div>
            {isRoleModalOpen && (
                <RoleModal 
                    isOpen={isRoleModalOpen}
                    onClose={() => setIsRoleModalOpen(false)}
                    onSave={handleSaveRole}
                    role={editingRole}
                />
            )}
        </>
    );
};

const RoleModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    onSave: (role: Role) => void;
    role: Role | null;
}> = ({ isOpen, onClose, onSave, role }) => {
    const [name, setName] = useState(role?.name || '');
    const [permissions, setPermissions] = useState<Set<Permission>>(new Set(role?.permissions || []));

    const togglePermission = (p: Permission) => {
        const newPermissions = new Set(permissions);
        if (newPermissions.has(p)) {
            newPermissions.delete(p);
        } else {
            newPermissions.add(p);
        }
        setPermissions(newPermissions);
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (name.trim()) {
            onSave({
                id: role?.id || '',
                name: name.trim(),
                permissions: Array.from(permissions)
            });
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 z-[2001] flex items-center justify-center p-4">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-lg" onClick={e => e.stopPropagation()}>
                <form onSubmit={handleSubmit}>
                    <div className="p-4 border-b flex justify-between items-center">
                        <h3 className="font-bold">{role ? 'Edit Role' : 'New Role'}</h3>
                        <button type="button" onClick={onClose}><XIcon size={20}/></button>
                    </div>
                    <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto">
                        <div>
                            <label className="block text-sm font-medium">Role Name</label>
                            <input 
                                value={name} 
                                onChange={e => setName(e.target.value)} 
                                className="w-full p-2 border rounded mt-1"
                                required 
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-2">Permissions</label>
                            <div className="grid grid-cols-2 gap-2 text-sm">
                                {ALL_PERMISSIONS.map(p => (
                                    <label key={p} className="flex items-center gap-2 p-2 rounded hover:bg-gray-50 cursor-pointer">
                                        <input 
                                            type="checkbox"
                                            checked={permissions.has(p)}
                                            onChange={() => togglePermission(p)}
                                            className="rounded text-blue-600 focus:ring-blue-500"
                                        />
                                        {p.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                                    </label>
                                ))}
                            </div>
                        </div>
                    </div>
                    <div className="p-4 bg-gray-50 flex justify-end gap-2">
                        <button type="button" onClick={onClose} className="px-4 py-2 bg-gray-200 rounded">Cancel</button>
                        <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded">Save Role</button>
                    </div>
                </form>
            </div>
        </div>
    );
};

const GroupModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    onSave: (group: EmployeeGroup) => void;
    group: EmployeeGroup | null;
    employees: Employee[];
    organizationId: string;
}> = ({ isOpen, onClose, onSave, group, employees, organizationId }) => {
    const [name, setName] = useState(group?.name || '');
    const [selectedEmployeeIds, setSelectedEmployeeIds] = useState<Set<string>>(new Set(group?.employeeIds || []));
    const [searchQuery, setSearchQuery] = useState('');
    const [sortBy, setSortBy] = useState<'name-asc' | 'name-desc'>('name-asc');

    const filteredAndSortedEmployees = useMemo(() => {
        let list = [...(employees || [])];
        if (searchQuery.trim()) {
            const query = searchQuery.toLowerCase();
            list = list.filter(emp => {
                const nameStr = (emp?.name || '').toLowerCase();
                const emailStr = (emp?.email || '').toLowerCase();
                const typeStr = (emp?.employeeType || '').toLowerCase();
                return nameStr.includes(query) || emailStr.includes(query) || typeStr.includes(query);
            });
        }
        list.sort((a, b) => {
            const nameA = a?.name || '';
            const nameB = b?.name || '';
            if (sortBy === 'name-asc') return nameA.localeCompare(nameB);
            return nameB.localeCompare(nameA);
        });
        return list;
    }, [employees, searchQuery, sortBy]);

    const toggleEmployee = (id: string) => {
        const newIds = new Set(selectedEmployeeIds);
        if (newIds.has(id)) {
            newIds.delete(id);
        } else {
            newIds.add(id);
        }
        setSelectedEmployeeIds(newIds);
    };

    const handleSelectAllFiltered = () => {
        const newIds = new Set(selectedEmployeeIds);
        const allFilteredSelected = filteredAndSortedEmployees.every(emp => newIds.has(emp.id));
        
        filteredAndSortedEmployees.forEach(emp => {
            if (allFilteredSelected) {
                newIds.delete(emp.id);
            } else {
                newIds.add(emp.id);
            }
        });
        setSelectedEmployeeIds(newIds);
    };

    const handleSelectEveryone = () => {
        const newIds = new Set(selectedEmployeeIds);
        const allSelected = employees.every(emp => newIds.has(emp.id));
        if (allSelected) {
            setSelectedEmployeeIds(new Set());
        } else {
            setSelectedEmployeeIds(new Set(employees.map(emp => emp.id)));
        }
    };

    const handleClearAll = () => {
        setSelectedEmployeeIds(new Set());
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (name.trim()) {
            onSave({
                id: group?.id || '',
                organizationId: group?.organizationId || organizationId,
                name: name.trim(),
                employeeIds: Array.from(selectedEmployeeIds)
            });
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 z-[2001] flex items-center justify-center p-4">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-lg" onClick={e => e.stopPropagation()}>
                <form onSubmit={handleSubmit}>
                    <div className="p-4 border-b flex justify-between items-center">
                        <h3 className="font-bold">{group ? 'Edit Group' : 'New Group'}</h3>
                        <button type="button" onClick={onClose}><XIcon size={20}/></button>
                    </div>
                    <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto">
                        <div>
                            <label className="block text-sm font-medium">Group Name</label>
                            <input value={name} onChange={e => setName(e.target.value)} className="w-full p-2 border rounded mt-1" required />
                        </div>
                        
                        <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 text-[11px] text-blue-700 font-medium">
                            ℹ️ Workers can belong to multiple groups simultaneously. Selected members will stay in their other groups as well.
                        </div>

                        {/* Search & Sort Controls */}
                        <div className="grid grid-cols-2 gap-2">
                            <div>
                                <label className="block text-xs font-semibold text-slate-500 mb-1">Search Worker</label>
                                <input 
                                    type="text" 
                                    placeholder="Type to search..." 
                                    value={searchQuery}
                                    onChange={e => setSearchQuery(e.target.value)}
                                    className="w-full p-1.5 text-xs border rounded bg-slate-50 outline-none focus:ring-1 focus:ring-blue-500"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-slate-500 mb-1">Sort By</label>
                                <select 
                                    value={sortBy} 
                                    onChange={e => setSortBy(e.target.value as any)}
                                    className="w-full p-1.5 text-xs border rounded bg-slate-50 outline-none focus:ring-1 focus:ring-blue-500"
                                >
                                    <option value="name-asc">Alphabetical (A-Z)</option>
                                    <option value="name-desc">Alphabetical (Z-A)</option>
                                </select>
                            </div>
                        </div>

                        {/* Selection Helpers */}
                        <div className="flex flex-wrap gap-1.5">
                            <button 
                                type="button" 
                                onClick={handleSelectAllFiltered}
                                className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10px] font-bold rounded uppercase tracking-wider"
                            >
                                Toggle All Filtered ({filteredAndSortedEmployees.length})
                            </button>
                            <button 
                                type="button" 
                                onClick={handleSelectEveryone}
                                className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10px] font-bold rounded uppercase tracking-wider"
                            >
                                Toggle Everyone ({employees.length})
                            </button>
                            <button 
                                type="button" 
                                onClick={handleClearAll}
                                className="px-2 py-1 bg-red-50 hover:bg-red-100 text-red-700 text-[10px] font-bold rounded uppercase tracking-wider"
                            >
                                Clear All
                            </button>
                        </div>

                        <div>
                            <div className="flex justify-between items-center mb-2">
                                <label className="block text-sm font-medium">Members ({selectedEmployeeIds.size} Selected)</label>
                            </div>
                            <div className="space-y-1 border rounded p-2 h-48 overflow-y-auto">
                                {filteredAndSortedEmployees.map(emp => (
                                    <label key={emp.id} className="flex items-center gap-2 p-1 hover:bg-gray-50 cursor-pointer rounded">
                                        <input 
                                            type="checkbox"
                                            checked={selectedEmployeeIds.has(emp.id)}
                                            onChange={() => toggleEmployee(emp.id)}
                                            className="rounded text-blue-600 focus:ring-blue-500"
                                        />
                                        {emp.name}
                                    </label>
                                ))}
                                {filteredAndSortedEmployees.length === 0 && (
                                    <div className="text-center text-slate-400 font-bold text-xs py-10">
                                        No workers match search filter.
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                    <div className="p-4 bg-gray-50 flex justify-end gap-2">
                        <button type="button" onClick={onClose} className="px-4 py-2 bg-gray-200 rounded">Cancel</button>
                        <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded">Save Group</button>
                    </div>
                </form>
            </div>
        </div>
    );
};

const fileToText = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = error => reject(error);
        reader.readAsDataURL(file);
    });
};

const fileToDataUrl = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = error => reject(error);
        reader.readAsDataURL(file);
    });
};

const AiToolsManager: React.FC<ToolsViewProps> = (props) => {
    const { t } = useLanguage();
    const { 
        uploadedDocuments, onSetUploadedDocuments, isDocAnalysisLoading, docAnalysisError, documentAnalysisResult,
        uploadedPlantImage, onSetUploadedPlantImage, onPlantDiseaseAnalysis, isDiseaseAnalysisLoading, diseaseAnalysisError, plantDiseaseAnalysis,
        uploadedAgriImage, onSetUploadedAgriImage, onAgriImageAnalysis, isAgriImageAnalysisLoading, agriImageAnalysisError, agriImageAnalysis
    } = props;

    const fileInputRef = useRef<HTMLInputElement>(null);
    const imageInputRef = useRef<HTMLInputElement>(null);
    const agriImageInputRef = useRef<HTMLInputElement>(null);

    const handleDocumentUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        
        const textContent = await fileToText(file);
        const newDoc: UploadedDocument = { id: Math.random().toString(36).substr(2, 9), fileName: file.name, content: textContent, file };
        
        const updatedDocs = [...uploadedDocuments, newDoc];
        onSetUploadedDocuments(() => updatedDocs);

        if (updatedDocs.length > 0) {
            props.onDocumentAnalysis(updatedDocs);
        }
    };

    const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => {
            if(ev.target?.result) {
                onSetUploadedPlantImage({ dataUrl: ev.target.result as string, file });
            }
        };
        reader.readAsDataURL(file);
    };

    const handleAgriImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => {
            if(ev.target?.result && onSetUploadedAgriImage) {
                onSetUploadedAgriImage({ dataUrl: ev.target.result as string, file });
            }
        };
        reader.readAsDataURL(file);
    };

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {/* Doc Analysis */}
            <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100 space-y-6">
                <div className="flex items-center gap-4 mb-2">
                    <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-2xl flex items-center justify-center shadow-sm">
                        <ClipboardDocumentIcon className="h-6 w-6" />
                    </div>
                    <div>
                        <h2 className="text-xl font-black text-slate-800 uppercase tracking-tight">{t('ai.doc_analysis')}</h2>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Compare reports & analyze trends</p>
                    </div>
                </div>
                
                <div className="border-2 border-dashed border-slate-200 rounded-[2rem] p-8 text-center hover:border-blue-500 hover:bg-blue-50 transition-all cursor-pointer group" onClick={() => fileInputRef.current?.click()}>
                    <input type="file" ref={fileInputRef} onChange={handleDocumentUpload} className="hidden" multiple />
                    <ArrowUpTrayIcon className="h-10 w-10 mx-auto text-slate-300 mb-4 group-hover:text-blue-500 transition-colors" />
                    <p className="text-xs font-black text-slate-500 uppercase tracking-widest">Upload PDF or Text Documents</p>
                </div>

                {isDocAnalysisLoading && (
                    <div className="p-4 bg-blue-50 text-blue-700 rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center gap-3 animate-pulse">
                        <SparklesIcon className="h-4 w-4 animate-spin"/> Analyzing trends...
                    </div>
                )}

                {uploadedDocuments.length > 0 && (
                    <div className="space-y-2">
                        <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">Files to Compare</h4>
                        {uploadedDocuments.map((doc, idx) => (
                            <div key={idx} className="flex justify-between items-center p-3 bg-slate-50 border border-slate-100 rounded-xl">
                                <span className="text-xs font-bold text-slate-700 truncate max-w-[200px]">{doc.fileName}</span>
                                <button className="text-red-400 hover:text-red-600" onClick={() => onSetUploadedDocuments(prev => prev.filter((_, i) => i !== idx))}><XCircleIcon className="h-5 w-5"/></button>
                            </div>
                        ))}
                    </div>
                )}
                
                {documentAnalysisResult && (
                    <div className="p-6 bg-slate-50 rounded-[2rem] border border-slate-100 space-y-4">
                        <h4 className="text-xs font-black text-slate-800 uppercase tracking-widest border-b border-slate-200 pb-3">Analysis Report</h4>
                        <div className="prose prose-sm text-slate-600 text-xs whitespace-pre-wrap max-w-none font-medium leading-relaxed">
                            {documentAnalysisResult}
                        </div>
                    </div>
                )}
            </div>

            {/* Disease Detection */}
            <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100 space-y-6">
                <div className="flex items-center gap-4 mb-2">
                    <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-2xl flex items-center justify-center shadow-sm">
                        <PlantIcon className="h-6 w-6" />
                    </div>
                    <div>
                        <h2 className="text-xl font-black text-slate-800 uppercase tracking-tight">{t('ai.disease_detection')}</h2>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">AI-Powered plant diagnostics</p>
                    </div>
                </div>

                <div className="border-2 border-dashed border-slate-200 rounded-[2rem] p-8 text-center hover:border-emerald-500 hover:bg-emerald-50 transition-all cursor-pointer group" onClick={() => imageInputRef.current?.click()}>
                    <input type="file" ref={imageInputRef} onChange={handleImageUpload} accept="image/*" className="hidden" />
                    <PlantIcon className="h-10 w-10 mx-auto text-slate-300 mb-4 group-hover:text-emerald-500 transition-colors" />
                    <p className="text-xs font-black text-slate-500 uppercase tracking-widest">Upload photo of leaf/plant</p>
                </div>

                {uploadedPlantImage && (
                    <div className="space-y-4">
                        <div className="relative rounded-[2rem] overflow-hidden border-4 border-white shadow-lg">
                            <img src={uploadedPlantImage.dataUrl} alt="Plant" className="w-full h-56 object-cover" />
                        </div>
                        <button onClick={() => onPlantDiseaseAnalysis(uploadedPlantImage.file)} disabled={isDiseaseAnalysisLoading} className="w-full py-4 bg-emerald-600 text-white rounded-2xl font-black uppercase tracking-[0.2em] text-[10px] hover:bg-emerald-500 transition-all shadow-lg shadow-emerald-100 disabled:opacity-50">
                            {isDiseaseAnalysisLoading ? 'Analyzing...' : 'Run Diagnostic'}
                        </button>
                    </div>
                )}

                {plantDiseaseAnalysis && (
                    <div className="p-6 bg-red-50 rounded-[2rem] border border-red-100 space-y-4">
                        <div className="flex justify-between items-center">
                            <h3 className="font-black text-red-800 uppercase tracking-tight">{plantDiseaseAnalysis.diseaseName}</h3>
                            <span className="text-[10px] font-black text-red-500 bg-red-100 px-3 py-1 rounded-full uppercase tracking-widest">{(plantDiseaseAnalysis.confidence * 100).toFixed(1)}% Match</span>
                        </div>
                        <p className="text-xs font-bold text-slate-600 leading-relaxed">{plantDiseaseAnalysis.description}</p>
                        <div className="space-y-2">
                            <h4 className="text-[10px] font-black text-red-800 uppercase tracking-widest">Treatment Protocol:</h4>
                            <ul className="space-y-1">
                                {plantDiseaseAnalysis.treatmentSuggestions?.map((s, i) => (
                                    <li key={i} className="flex items-start gap-2 text-xs font-bold text-slate-700">
                                        <div className="w-1.5 h-1.5 rounded-full bg-red-400 mt-1.5 shrink-0" />
                                        {s}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </div>
                )}
            </div>

            {/* General Image Analysis */}
            <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100 space-y-6">
                <div className="flex items-center gap-4 mb-2">
                    <div className="w-12 h-12 bg-purple-100 text-purple-600 rounded-2xl flex items-center justify-center shadow-sm">
                        <SparklesIcon className="h-6 w-6" />
                    </div>
                    <div>
                        <h2 className="text-xl font-black text-slate-800 uppercase tracking-tight">{t('ai.image_analysis')}</h2>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Identify crops, count yields, check soils</p>
                    </div>
                </div>

                <div className="border-2 border-dashed border-slate-200 rounded-[2rem] p-8 text-center hover:border-purple-500 hover:bg-purple-50 transition-all cursor-pointer group" onClick={() => agriImageInputRef.current?.click()}>
                    <input type="file" ref={agriImageInputRef} onChange={handleAgriImageUpload} accept="image/*" className="hidden" />
                    <SparklesIcon className="h-10 w-10 mx-auto text-slate-300 mb-4 group-hover:text-purple-500 transition-colors" />
                    <p className="text-xs font-black text-slate-500 uppercase tracking-widest">{t('ai.upload_image')}</p>
                </div>

                {uploadedAgriImage && (
                    <div className="space-y-4">
                        <div className="relative rounded-[2rem] overflow-hidden border-4 border-white shadow-lg">
                            <img src={uploadedAgriImage.dataUrl} alt="Agri" className="w-full h-56 object-cover" />
                        </div>
                        <button onClick={() => onAgriImageAnalysis && onAgriImageAnalysis(uploadedAgriImage.file)} disabled={isAgriImageAnalysisLoading} className="w-full py-4 bg-purple-600 text-white rounded-2xl font-black uppercase tracking-[0.2em] text-[10px] hover:bg-purple-500 transition-all shadow-lg shadow-purple-100 disabled:opacity-50">
                            {isAgriImageAnalysisLoading ? 'Analyzing...' : 'Analyze Image'}
                        </button>
                    </div>
                )}

                {agriImageAnalysisError && (
                    <div className="p-4 bg-red-50 text-red-700 rounded-2xl text-xs font-bold">
                        {agriImageAnalysisError}
                    </div>
                )}

                {agriImageAnalysis && (
                    <div className="p-6 bg-purple-50 rounded-[2rem] border border-purple-100 space-y-4 text-left">
                        <div>
                            <h4 className="text-[10px] font-black text-purple-800 uppercase tracking-widest">Identified Subject:</h4>
                            <p className="text-xs font-bold text-slate-800 mt-1">{agriImageAnalysis.subject}</p>
                        </div>
                        
                        <div>
                            <h4 className="text-[10px] font-black text-purple-800 uppercase tracking-widest">Condition Assessment:</h4>
                            <p className="text-xs font-bold text-slate-700 leading-relaxed mt-1">{agriImageAnalysis.condition}</p>
                        </div>

                        {agriImageAnalysis.metrics && (
                            <div>
                                <h4 className="text-[10px] font-black text-purple-800 uppercase tracking-widest">Estimated Metrics:</h4>
                                <p className="text-xs font-bold text-slate-700 leading-relaxed mt-1">{agriImageAnalysis.metrics}</p>
                            </div>
                        )}

                        <div className="space-y-2 border-t border-purple-100 pt-3">
                            <h4 className="text-[10px] font-black text-purple-800 uppercase tracking-widest">AI Recommendations:</h4>
                            <ul className="space-y-1">
                                {agriImageAnalysis.recommendations?.map((s, i) => (
                                    <li key={i} className="flex items-start gap-2 text-xs font-bold text-slate-700">
                                        <div className="w-1.5 h-1.5 rounded-full bg-purple-400 mt-1.5 shrink-0" />
                                        {s}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

const ToolsTeamHubWrapper: React.FC<ToolsViewProps> = (props) => {
    return (
        <TeamHubManager
            currentUser={props.currentUser || null}
            forumPosts={props.forumPosts || []}
            onAddPost={props.onAddPost || (() => {})}
            onAddReply={props.onAddReply}
            onUpdatePost={props.onUpdatePost}
            allUsers={props.allUsers || props.users || []}
            memberships={props.memberships || []}
            onSetMemberships={props.onSetMemberships}
            activeOrgId={props.activeOrgId}
            employees={props.employees}
            onSetEmployees={props.onSetEmployees}
            users={props.users || []}
            onSetUsers={props.onSetUsers}
            roles={props.roles || []}
            plantationFeatures={props.plantationFeatures}
            mapProps={props.mapProps}
            onOpenPopUp={() => window.dispatchEvent(new CustomEvent("agrimap_open_intercom"))}
        />
    );
};

const DataMap: React.FC<{ users: User[], organizations: Organization[], memberships: Membership[] }> = ({ users, organizations, memberships }) => {
    const svgRef = useRef<SVGSVGElement>(null);

    useEffect(() => {
        if (!svgRef.current || users.length === 0) return;

        const width = 800;
        const height = 600;

        const nodes: any[] = [
            ...users.map(u => ({ id: u.id, name: u.name, type: 'user' })),
            ...organizations.map(o => ({ id: o.id, name: o.name, type: 'org' }))
        ];

        const links: any[] = memberships.map(m => ({
            source: m.userId,
            target: m.organizationId,
            role: m.role
        })).filter(l => nodes.some(n => n.id === l.source) && nodes.some(n => n.id === l.target));

        const svg = d3.select(svgRef.current);
        svg.selectAll("*").remove();

        const simulation = d3.forceSimulation(nodes)
            .force("link", d3.forceLink(links).id((d: any) => d.id).distance(100))
            .force("charge", d3.forceManyBody().strength(-300))
            .force("center", d3.forceCenter(width / 2, height / 2));

        const link = svg.append("g")
            .attr("stroke", "#94a3b8")
            .attr("stroke-opacity", 0.6)
            .selectAll("line")
            .data(links)
            .join("line")
            .attr("stroke-width", 2);

        const node = svg.append("g")
            .selectAll("g")
            .data(nodes)
            .join("g")
            .call(d3.drag<any, any>()
                .on("start", (event, d) => {
                    if (!event.active) simulation.alphaTarget(0.3).restart();
                    d.fx = d.x;
                    d.fy = d.y;
                })
                .on("drag", (event, d) => {
                    d.fx = event.x;
                    d.fy = event.y;
                })
                .on("end", (event, d) => {
                    if (!event.active) simulation.alphaTarget(0);
                    d.fx = null;
                    d.fy = null;
                }));

        node.append("circle")
            .attr("r", (d: any) => d.type === 'user' ? 8 : 12)
            .attr("fill", (d: any) => d.type === 'user' ? "#3b82f6" : "#fbbf24");

        node.append("text")
            .text((d: any) => d.name)
            .attr("x", 12)
            .attr("y", 4)
            .attr("font-size", "10px")
            .attr("font-weight", "bold")
            .attr("fill", "#1e293b");

        simulation.on("tick", () => {
            link
                .attr("x1", d => d.source.x)
                .attr("y1", d => d.source.y)
                .attr("x2", d => d.target.x)
                .attr("y2", d => d.target.y);

            node.attr("transform", (d: any) => `translate(${d.x},${d.y})`);
        });

        return () => { simulation.stop(); };
    }, [users, organizations, memberships]);

    return (
        <div className="w-full h-[600px] bg-slate-50 rounded-[2.5rem] overflow-hidden border border-slate-100 flex items-center justify-center relative">
            <div className="absolute top-6 left-6 flex gap-4">
                <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-blue-500"></div>
                    <span className="text-[10px] font-black uppercase text-slate-400">Users</span>
                </div>
                <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-amber-400"></div>
                    <span className="text-[10px] font-black uppercase text-slate-400">Companies</span>
                </div>
            </div>
            <svg ref={svgRef} width="100%" height="100%" viewBox="0 0 800 600" preserveAspectRatio="xMidYMid meet"></svg>
        </div>
    );
};

const RootAuthorityManager: React.FC<{ 
    users: User[], 
    onSetUsers: (users: User[]) => void, 
    organizations: Organization[], 
    onSetOrganizations: (orgs: Organization[]) => void,
    onDeleteOrganization?: (id: string, name: string) => void,
    subscriptionRequests?: SubscriptionRequest[],
    memberships: Membership[]
}> = ({ users, onSetUsers, organizations, onSetOrganizations, onDeleteOrganization, subscriptionRequests = [], memberships }) => {
    const [activeRootTab, setActiveRootTab] = useState<'verification' | 'subscriptions' | 'requests' | 'datamap'>('verification');
    const [editData, setEditData] = useState<{
        type: 'org' | 'user';
        id: string;
        expiry: string;
        discount: number;
        price: number;
    } | null>(null);

    const handleApproveSubscription = async (request: SubscriptionRequest) => {
        try {
            const org = organizations.find(o => o.id === request.organizationId);
            if (!org) return;

            const updatedOrg = {
                ...org,
                tier: 'Pro', // Default to Pro for paid, can be more complex
                subscriptionStatus: 'Paid',
                isPaid: true,
                subscriptionExpiry: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
            };

            await updateDoc(doc(db, 'organizations', org.id), updatedOrg);
            await updateDoc(doc(db, 'subscriptionRequests', request.id), { status: 'approved', approvedAt: new Date().toISOString() });
            
            toast.success(`Subscription approved for ${org.name}`);
        } catch (error) {
            console.error(error);
            toast.error("Failed to approve subscription");
        }
    };

    const handleRejectSubscription = async (request: SubscriptionRequest) => {
        try {
            await updateDoc(doc(db, 'subscriptionRequests', request.id), { status: 'rejected' });
            toast.error("Subscription request rejected");
        } catch (error) {
            console.error(error);
        }
    };

    const handleDeleteOrg = async (id: string, name: string) => {
        if (onDeleteOrganization) {
            await onDeleteOrganization(id, name);
        } else {
            if (!window.confirm(`Are you sure you want to PERMANENTLY DELETE organization "${name}"? This will remove all associated data and memberships.`)) return;
            onSetOrganizations(organizations.filter(o => o.id !== id));
            toast.error(`Organization ${name} deleted locally.`);
        }
    };

    const handleDeleteUser = async (id: string, name: string) => {
        if (!window.confirm(`Are you sure you want to PERMANENTLY DELETE user "${name}"? This action is irreversible.`)) return;
        onSetUsers(users.filter(u => u.id !== id));
        toast.error(`User ${name} deleted.`);
    };

    const handleToggleVerification = (userId: string) => {
        const userToVerify = users.find(u => u.id === userId);
        if (!userToVerify) return;

        // Prevent verification if duplicate personal ID exists among already verified users
        if (userToVerify.verificationStatus !== 'verified' && userToVerify.personalNumber) {
            const duplicate = users.find(u => 
                u.id !== userId && 
                u.verificationStatus === 'verified' && 
                u.personalNumber === userToVerify.personalNumber
            );
            if (duplicate) {
                toast.error(`Verification Failed: Another verified user already exists with ID ${userToVerify.personalNumber}`);
                return;
            }
        }

        onSetUsers(users.map(u => u.id === userId ? { ...u, verificationStatus: u.verificationStatus === 'verified' ? 'unverified' : 'verified' } : u));
    };

    const handleUpdateExpiry = (type: 'org' | 'user', id: string, days: number) => {
        if (type === 'org') {
            onSetOrganizations(organizations.map(o => {
                if (o.id === id) {
                    const current = o.subscriptionExpiry ? new Date(o.subscriptionExpiry) : new Date();
                    current.setDate(current.getDate() + days);
                    return { ...o, subscriptionExpiry: current.toISOString() };
                }
                return o;
            }));
        } else {
            onSetUsers(users.map(u => {
                if (u.id === id) {
                    const current = u.subscriptionExpiry ? new Date(u.subscriptionExpiry) : new Date();
                    current.setDate(current.getDate() + days);
                    return { ...u, subscriptionExpiry: current.toISOString() };
                }
                return u;
            }));
        }
        toast.success(`Subscription extended for ${days} days.`);
    };

    const handleSaveCustom = () => {
        if (!editData) return;
        if (editData.type === 'org') {
            onSetOrganizations(organizations.map(o => o.id === editData.id ? { 
                ...o, 
                subscriptionExpiry: editData.expiry, 
                discount: editData.discount,
                price: editData.price
            } : o));
        } else {
            onSetUsers(users.map(u => u.id === editData.id ? { 
                ...u, 
                subscriptionExpiry: editData.expiry, 
                discount: editData.discount,
                price: editData.price
            } : u));
        }
        setEditData(null);
        toast.success('Subscription details updated successfully.');
    };

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            {/* Header Section */}
            <div className="bg-white p-10 rounded-[3rem] shadow-sm border border-slate-100">
                <div className="flex items-center gap-4 mb-2">
                    <div className="w-12 h-12 bg-amber-100 text-amber-600 rounded-2xl flex items-center justify-center shadow-inner">
                        <ShieldCheckIcon size={24} />
                    </div>
                    <h1 className="text-4xl font-[1000] text-slate-900 tracking-tighter uppercase">Root <span className="text-amber-600">Administration</span></h1>
                </div>
                <p className="text-sm font-bold text-slate-400 max-w-2xl leading-relaxed uppercase tracking-wide px-1">
                    Global controls for user authentication, organization health, and system requests.
                </p>

                <div className="flex gap-2 mt-8 overflow-x-auto scrollbar-hide">
                    {[
                        { id: 'verification', label: 'Verification', icon: ShieldCheckIcon },
                        { id: 'subscriptions', label: 'Subscriptions', icon: CurrencyDollarIcon },
                        { id: 'requests', label: 'Requests', icon: ClockIcon, count: subscriptionRequests.filter(r => r.status === 'pending').length },
                        { id: 'datamap', label: 'Data Map', icon: MapPinIcon }
                    ].map(tab => (
                        <button 
                            key={tab.id}
                            onClick={() => setActiveRootTab(tab.id as any)}
                            className={`flex items-center gap-2 px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${activeRootTab === tab.id ? 'bg-amber-600 text-white shadow-xl shadow-amber-100' : 'bg-slate-100 text-slate-400 hover:bg-slate-200'}`}
                        >
                            <tab.icon size={14} /> 
                            {tab.label}
                            {tab.count !== undefined && tab.count > 0 && (
                                <span className="ml-1 bg-white text-amber-600 w-4 h-4 rounded-full flex items-center justify-center text-[8px]">{tab.count}</span>
                            )}
                        </button>
                    ))}
                </div>
            </div>

            {activeRootTab === 'verification' && (
                <div className="bg-white p-10 rounded-[3rem] shadow-sm border border-slate-100 animate-in slide-in-from-bottom-4 duration-500">
                    <div className="flex justify-between items-center mb-6">
                        <h2 className="text-3xl font-[900] text-slate-900 tracking-tighter uppercase">User <span className="text-amber-600">Verification</span></h2>
                    </div>
                    {/* ... rest of table ... */}
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="border-b border-slate-100">
                                <th className="py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">User</th>
                                <th className="py-4 text-[10px] font-black uppercase tracking-widest text-slate-400 text-center">Status</th>
                                <th className="py-4 text-[10px] font-black uppercase tracking-widest text-slate-400 text-right">Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            {users.map(u => (
                                <tr key={u.id} className="border-b border-slate-50 group hover:bg-slate-50/50 transition-all">
                                    <td className="py-4">
                                        <div className="flex items-center gap-3">
                                            <div>
                                                <div className="font-black text-slate-900 uppercase tracking-tight">{u.name}</div>
                                                <div className="text-[10px] font-bold text-slate-400">{u.email}</div>
                                            </div>
                                            <button className="opacity-0 group-hover:opacity-100 p-1.5 bg-white border border-slate-100 rounded-lg text-slate-400 hover:text-blue-600 transition-all shadow-sm" title="Edit User">
                                                <PencilIcon size={12} />
                                            </button>
                                        </div>
                                    </td>
                                    <td className="py-4 text-center">
                                        <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${u.verificationStatus === 'verified' ? 'bg-emerald-100 text-emerald-600' : 'bg-amber-100 text-amber-600'}`}>
                                            {u.verificationStatus}
                                        </span>
                                    </td>
                                    <td className="py-4 text-right">
                                        <div className="flex items-center justify-end gap-2">
                                            <button onClick={() => handleToggleVerification(u.id)} className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-[10px] font-black uppercase tracking-widest text-blue-600 hover:bg-blue-50 transition-all">Verify</button>
                                            <button onClick={() => handleDeleteUser(u.id, u.name)} className="p-2 text-slate-300 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all" title="Delete User">
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
            )}

            {activeRootTab === 'subscriptions' && (
            <>
            <div className="bg-white p-10 rounded-[3rem] shadow-sm border border-slate-100">
                <h2 className="text-3xl font-[900] text-slate-900 tracking-tighter uppercase mb-2">Organization <span className="text-amber-600">Subscriptions</span></h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
                    {organizations.map(o => (
                        <div key={o.id} className="p-8 bg-slate-50 rounded-[3rem] border border-slate-100 flex flex-col group relative">
                            <button className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 p-2 bg-white border border-slate-100 rounded-xl text-slate-400 hover:text-blue-600 transition-all shadow-sm z-10" title="Edit Org Settings">
                                <PencilIcon size={14} />
                            </button>
                            <div className="flex justify-between items-start mb-4">
                                <div className="flex items-start gap-4">
                                    <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center border border-slate-200 shadow-sm font-black text-blue-600 text-xl uppercase">
                                        {o.name?.[0]}
                                    </div>
                                    <div>
                                        <div className="font-black text-slate-900 uppercase tracking-tight text-lg leading-tight">{o.name}</div>
                                        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1 flex items-center gap-1">
                                            <ClockIcon size={10} /> EXPIRES: {o.subscriptionExpiry ? new Date(o.subscriptionExpiry).toLocaleDateString() : 'NEVER'}
                                        </div>
                                    </div>
                                </div>
                                {(o.discount || 0) > 0 && (
                                    <div className="bg-amber-100 text-amber-700 px-2 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest">
                                        -{o.discount}% Off
                                    </div>
                                )}
                            </div>
                            
                            <div className="grid grid-cols-2 gap-3 mb-6">
                                <div className="p-4 bg-white rounded-2xl border border-slate-100 flex items-center gap-3 shadow-sm">
                                    <div className="w-8 h-8 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center">
                                        <CurrencyDollarIcon size={16} />
                                    </div>
                                    <div>
                                        <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Price</p>
                                        <p className="text-xs font-black text-slate-800">${o.price || 0}</p>
                                    </div>
                                </div>
                                <div className="p-4 bg-white rounded-2xl border border-slate-100 flex items-center gap-3 shadow-sm">
                                    <div className="w-8 h-8 bg-amber-50 text-amber-600 rounded-xl flex items-center justify-center">
                                        <TagIcon size={16} />
                                    </div>
                                    <div>
                                        <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Discount</p>
                                        <p className="text-xs font-black text-slate-800">{o.discount || 0}%</p>
                                    </div>
                                </div>
                            </div>
                                                      <div className="flex items-center gap-2 mt-auto pt-4 border-t border-slate-100">
                                <button onClick={() => handleUpdateExpiry('org', o.id, 30)} className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all">+30d</button>
                                <button onClick={() => handleUpdateExpiry('org', o.id, 365)} className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all font-mono">+1y</button>
                                <button 
                                    onClick={() => setEditData({ type: 'org', id: o.id, expiry: o.subscriptionExpiry || new Date().toISOString(), discount: o.discount || 0, price: o.price || 0 })} 
                                    className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-lg shadow-blue-100/50"
                                >
                                    Modify
                                </button>
                                <button onClick={() => handleDeleteOrg(o.id, o.name)} className="p-2 ml-auto text-slate-300 hover:text-red-500 transition-colors" title="Delete Organization">
                                    <TrashIcon size={16} />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            <div className="bg-white p-10 rounded-[3rem] shadow-sm border border-slate-100">
                <h2 className="text-3xl font-[900] text-slate-900 tracking-tighter uppercase mb-2">User <span className="text-amber-600">Subscriptions</span></h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
                    {users.map(u => (
                        <div key={u.id} className="p-8 bg-slate-50 rounded-[3rem] border border-slate-100 flex flex-col group relative">
                            <button className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 p-2 bg-white border border-slate-100 rounded-xl text-slate-400 hover:text-blue-600 transition-all shadow-sm z-10" title="Edit User Profile">
                                <PencilIcon size={14} />
                            </button>
                            <div className="flex justify-between items-start mb-4">
                                <div className="flex items-start gap-4">
                                    <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center border border-slate-200 shadow-sm font-black text-blue-600 text-xl uppercase">
                                        {u.name?.[0]}
                                    </div>
                                    <div>
                                        <div className="font-black text-slate-900 uppercase tracking-tight text-lg leading-tight">{u.name}</div>
                                        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1 flex items-center gap-1">
                                            <ClockIcon size={10} /> EXPIRES: {u.subscriptionExpiry ? new Date(u.subscriptionExpiry).toLocaleDateString() : 'NEVER'}
                                        </div>
                                    </div>
                                </div>
                                {(u.discount || 0) > 0 && (
                                    <div className="bg-amber-100 text-amber-700 px-2 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest">
                                        -{u.discount}% OFF
                                    </div>
                                )}
                            </div>

                            <div className="grid grid-cols-2 gap-3 mb-6">
                                <div className="p-4 bg-white rounded-2xl border border-slate-100 flex items-center gap-3 shadow-sm">
                                    <div className="w-8 h-8 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center">
                                        <CurrencyDollarIcon size={16} />
                                    </div>
                                    <div>
                                        <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Price</p>
                                        <p className="text-xs font-black text-slate-800">${u.price || 0}</p>
                                    </div>
                                </div>
                                <div className="p-4 bg-white rounded-2xl border border-slate-100 flex items-center gap-3 shadow-sm">
                                    <div className="w-8 h-8 bg-amber-50 text-amber-600 rounded-xl flex items-center justify-center">
                                        <TagIcon size={16} />
                                    </div>
                                    <div>
                                        <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Discount</p>
                                        <p className="text-xs font-black text-slate-800">{u.discount || 0}%</p>
                                    </div>
                                </div>
                            </div>
                                                       <div className="flex items-center gap-2 mt-auto pt-4 border-t border-slate-100">
                                <button onClick={() => handleUpdateExpiry('user', u.id, 30)} className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all">+30d</button>
                                <button onClick={() => handleUpdateExpiry('user', u.id, 365)} className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all font-mono">+1y</button>
                                <button 
                                    onClick={() => setEditData({ type: 'user', id: u.id, expiry: u.subscriptionExpiry || new Date().toISOString(), discount: u.discount || 0, price: u.price || 0 })} 
                                    className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-lg shadow-blue-100/50"
                                >
                                    Modify
                                </button>
                                <button onClick={() => handleDeleteUser(u.id, u.name)} className="p-2 ml-auto text-slate-300 hover:text-red-500 transition-colors" title="Delete User">
                                    <TrashIcon size={16} />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
            </>
            )}

            {activeRootTab === 'requests' && (
                <div className="bg-white p-10 rounded-[3rem] shadow-sm border border-slate-100">
                    <h2 className="text-3xl font-[900] text-slate-900 tracking-tighter uppercase mb-2">Subscription <span className="text-amber-600">Requests</span></h2>
                    <div className="mt-8 space-y-4">
                        {subscriptionRequests.length === 0 ? (
                            <div className="p-12 text-center text-slate-400 font-bold uppercase tracking-widest bg-slate-50 rounded-3xl border border-dashed border-slate-200 italic">No pending requests</div>
                        ) : (
                            subscriptionRequests.map(req => {
                                const org = organizations.find(o => o.id === req.organizationId);
                                const user = users.find(u => u.id === req.userId);
                                return (
                                    <div key={req.id} className="p-6 bg-slate-50 rounded-3xl border border-slate-100 flex items-center justify-between group">
                                        <div className="flex items-center gap-4">
                                            <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center border border-slate-200 shadow-sm text-blue-600">
                                                <BuildingStorefrontIcon size={20} />
                                            </div>
                                            <div>
                                                <div className="font-black text-slate-900 uppercase tracking-tight">{org?.name || 'Unknown Org'}</div>
                                                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                                    <span>User: {user?.name}</span>
                                                    <span className="w-1 h-1 bg-slate-300 rounded-full"></span>
                                                    <span className="text-blue-600 underline">Plan: {req.planId}</span>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            {req.status === 'pending' ? (
                                                <>
                                                    <button onClick={() => handleApproveSubscription(req)} className="px-4 py-2 bg-emerald-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-emerald-100 transition-all hover:bg-emerald-700">Approve</button>
                                                    <button onClick={() => handleRejectSubscription(req)} className="px-4 py-2 bg-white border border-slate-200 text-slate-400 rounded-xl text-[10px] font-black uppercase tracking-widest hover:text-red-500 hover:bg-red-50 transition-all">Reject</button>
                                                </>
                                            ) : (
                                                <span className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest ${req.status === 'approved' ? 'bg-emerald-100 text-emerald-600' : 'bg-red-100 text-red-600'}`}>
                                                    {req.status}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>
            )}

            {activeRootTab === 'datamap' && (
                <div className="bg-white p-10 rounded-[3rem] shadow-sm border border-slate-100">
                    <h2 className="text-3xl font-[900] text-slate-900 tracking-tighter uppercase mb-6">Network <span className="text-amber-600">Relationships</span></h2>
                    <DataMap users={users} organizations={organizations} memberships={memberships} />
                </div>
            )}

            {/* Custom Subscription Modal */}
            {editData && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[3000] flex items-center justify-center p-4 animate-in fade-in duration-300">
                    <div className="bg-white rounded-[3rem] shadow-2xl w-full max-w-md overflow-hidden border border-slate-100 animate-in zoom-in-95 duration-300">
                        <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                            <div>
                                <h3 className="text-2xl font-black text-slate-900 uppercase tracking-tighter">Edit <span className="text-blue-600">Subscription</span></h3>
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Manual override for {editData.type === 'org' ? 'Organization' : 'User'}</p>
                            </div>
                            <button onClick={() => setEditData(null)} className="p-3 bg-white rounded-2xl text-slate-400 hover:text-red-500 hover:bg-red-50 transition-all shadow-sm"><XIcon size={20}/></button>
                        </div>
                        <div className="p-8 space-y-6">
                            <div>
                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 px-1">Expiry Date</label>
                                <div className="relative">
                                    <input 
                                        type="date" 
                                        value={editData.expiry.split('T')[0]} 
                                        onChange={e => setEditData({ ...editData, expiry: new Date(e.target.value).toISOString() })}
                                        className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl text-xs font-bold text-slate-700 focus:border-blue-500 transition-all outline-none"
                                    />
                                    <CalendarDaysIcon size={18} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-300 pointer-events-none" />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 px-1">Discount %</label>
                                    <div className="relative">
                                        <input 
                                            type="number" 
                                            value={editData.discount} 
                                            onChange={e => setEditData({ ...editData, discount: parseInt(e.target.value) || 0 })}
                                            className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl text-xs font-bold text-slate-700 focus:border-blue-500 transition-all outline-none"
                                        />
                                        <TagIcon size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-300 pointer-events-none" />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 px-1">Price ($)</label>
                                    <div className="relative">
                                        <input 
                                            type="number" 
                                            value={editData.price} 
                                            onChange={e => setEditData({ ...editData, price: parseInt(e.target.value) || 0 })}
                                            className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl text-xs font-bold text-slate-700 focus:border-blue-500 transition-all outline-none"
                                        />
                                        <CurrencyDollarIcon size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-300 pointer-events-none" />
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div className="p-8 bg-slate-50 border-t border-slate-100 flex gap-4">
                            <button onClick={() => setEditData(null)} className="flex-1 py-4 bg-white border-2 border-slate-200 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 hover:bg-slate-100 transition-all">Cancel</button>
                            <button onClick={handleSaveCustom} className="flex-1 py-4 bg-slate-900 text-white rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] hover:bg-slate-800 transition-all shadow-xl shadow-slate-200">Commit Changes</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ToolsView;

const SystemBackupManager: React.FC<{ onExport: () => void, onImport: (data: any) => void, onClearMap?: () => void, onResetSystem?: () => void, isRoot?: boolean }> = ({ onExport, onImport, onClearMap, onResetSystem, isRoot }) => {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [queue, setQueue] = useState<SyncLogEntry[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'cloud_synced' | 'error'>('all');
    const [categoryFilter, setCategoryFilter] = useState<'all' | 'harvest' | 'inventory' | 'map' | 'accounting' | 'other'>('all');
    const [selectedEntry, setSelectedEntry] = useState<SyncLogEntry | null>(null);
    const [isSyncing, setIsSyncing] = useState(false);

    const loadQueue = () => {
        try {
            const items = JSON.parse(localStorage.getItem('agrimap-pending-sync') || '[]');
            setQueue(items);
        } catch (e) {
            setQueue([]);
        }
    };

    useEffect(() => {
        loadQueue();
        window.addEventListener('agrimap-sync-queue-updated', loadQueue);
        return () => window.removeEventListener('agrimap-sync-queue-updated', loadQueue);
    }, []);

    const handlePushToCloud = async () => {
        const pending = queue.filter(i => i.status === 'pending');
        if (pending.length === 0) {
            toast.info("No pending changes to sync.");
            return;
        }

        setIsSyncing(true);
        try {
            await syncManager.pushAllToCloud();
            loadQueue();
        } catch (err: any) {
            toast.error(`Sync failed: ${err?.message || err}`);
        } finally {
            setIsSyncing(false);
        }
    };

    const handleRetryErrors = () => {
        const errored = queue.filter(i => i.status === 'error');
        if (errored.length === 0) {
            toast.info("No errored syncs to retry.");
            return;
        }

        try {
            const updated = queue.map(i => i.status === 'error' ? { ...i, status: 'pending' as const, errorMessage: undefined } : i);
            localStorage.setItem('agrimap-pending-sync', JSON.stringify(updated));
            window.dispatchEvent(new CustomEvent('agrimap-sync-queue-updated'));
            toast.success(`Reset ${errored.length} errored operations back to pending state.`);
        } catch (e) {
            toast.error("Failed to retry errors.");
        }
    };

    const handleClearQueue = () => {
        if (confirm("Are you sure you want to completely clear the sync queue? Any unsynced local changes will remain local only and won't be pushed to the cloud.")) {
            syncManager.clearLocalCache();
            window.dispatchEvent(new CustomEvent('agrimap-sync-queue-updated'));
            toast.success("Sync queue cache cleared.");
        }
    };

    const handleRemoveItem = (id: string) => {
        if (confirm("Remove this specific operation from the sync queue?")) {
            try {
                const updated = queue.filter(i => i.id !== id);
                localStorage.setItem('agrimap-pending-sync', JSON.stringify(updated));
                window.dispatchEvent(new CustomEvent('agrimap-sync-queue-updated'));
                toast.success("Operation removed from queue.");
            } catch (e) {
                toast.error("Failed to remove item.");
            }
        }
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const json = JSON.parse(event.target?.result as string);
                onImport(json);
            } catch (err) {
                alert("Invalid backup file.");
            }
        };
        reader.readAsText(file);
    };

    // Filter queue
    const filteredQueue = useMemo(() => {
        return queue.filter(item => {
            const matchesStatus = statusFilter === 'all' || item.status === statusFilter;
            const matchesCategory = categoryFilter === 'all' || item.category === categoryFilter;
            
            const searchLower = searchQuery.toLowerCase();
            const matchesSearch = 
                item.path.toLowerCase().includes(searchLower) ||
                item.type.toLowerCase().includes(searchLower) ||
                (item.idempotencyToken && item.idempotencyToken.toLowerCase().includes(searchLower)) ||
                (item.errorMessage && item.errorMessage.toLowerCase().includes(searchLower)) ||
                JSON.stringify(item.data || {}).toLowerCase().includes(searchLower);

            return matchesStatus && matchesCategory && matchesSearch;
        }).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    }, [queue, searchQuery, statusFilter, categoryFilter]);

    // Compute stats
    const stats = useMemo(() => {
        const pending = queue.filter(i => i.status === 'pending').length;
        const synced = queue.filter(i => i.status === 'cloud_synced').length;
        const errors = queue.filter(i => i.status === 'error').length;
        return { pending, synced, errors, total: queue.length };
    }, [queue]);

    return (
        <div className="bg-white p-10 rounded-[3rem] shadow-sm border border-slate-100 space-y-12">
            <div>
                <h2 className="text-3xl font-[900] text-slate-900 tracking-tighter uppercase mb-2">Sync Manager & Queue Auditor</h2>
                <p className="text-slate-400 font-bold text-sm uppercase tracking-widest">Monitor, inspect, and retry offline transaction queues safely.</p>
            </div>

            {/* Sync Queue Metrics Dashboard */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="p-6 bg-amber-50/50 border border-amber-100 rounded-[2rem] flex flex-col justify-between">
                    <div>
                        <span className="text-[10px] font-black uppercase text-amber-600 tracking-wider">Pending Push</span>
                        <div className="text-4xl font-black text-amber-900 mt-2">{stats.pending}</div>
                    </div>
                    <p className="text-[10px] font-bold text-amber-700/60 mt-4 uppercase">Waiting to be uploaded to cloud</p>
                </div>
                <div className="p-6 bg-emerald-50/50 border border-emerald-100 rounded-[2rem] flex flex-col justify-between">
                    <div>
                        <span className="text-[10px] font-black uppercase text-emerald-600 tracking-wider">Cloud Synced</span>
                        <div className="text-4xl font-black text-emerald-900 mt-2">{stats.synced}</div>
                    </div>
                    <p className="text-[10px] font-bold text-emerald-700/60 mt-4 uppercase">Successfully saved to registry</p>
                </div>
                <div className="p-6 bg-rose-50/50 border border-rose-100 rounded-[2rem] flex flex-col justify-between">
                    <div>
                        <span className="text-[10px] font-black uppercase text-rose-600 tracking-wider">Conflict Errors</span>
                        <div className="text-4xl font-black text-rose-900 mt-2">{stats.errors}</div>
                    </div>
                    <p className="text-[10px] font-bold text-rose-700/60 mt-4 uppercase">Failed retry or collision flagged</p>
                </div>
                <div className="p-6 bg-slate-50/50 border border-slate-100 rounded-[2rem] flex flex-col justify-between">
                    <div>
                        <span className="text-[10px] font-black uppercase text-slate-500 tracking-wider">Total Operations</span>
                        <div className="text-4xl font-black text-slate-900 mt-2">{stats.total}</div>
                    </div>
                    <p className="text-[10px] font-bold text-slate-600/60 mt-4 uppercase">Full transaction log buffer</p>
                </div>
            </div>

            {/* Sync Control Console */}
            <div className="flex flex-col md:flex-row gap-4 items-stretch justify-between p-6 bg-slate-50 rounded-[2.5rem] border border-slate-100">
                <div className="flex flex-wrap gap-3 items-center">
                    <button 
                        onClick={handlePushToCloud} 
                        disabled={stats.pending === 0 || isSyncing}
                        className={`px-6 py-3.5 rounded-xl font-black uppercase tracking-[0.2em] text-[10px] transition-all flex items-center gap-2 ${stats.pending > 0 && !isSyncing ? 'bg-blue-600 text-white hover:bg-blue-700 shadow-lg shadow-blue-100' : 'bg-slate-200 text-slate-400 cursor-not-allowed'}`}
                    >
                        <RefreshCwIcon className={`h-3.5 w-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                        {isSyncing ? 'Syncing...' : 'Push Pending Queue'}
                    </button>
                    <button 
                        onClick={handleRetryErrors} 
                        disabled={stats.errors === 0}
                        className={`px-6 py-3.5 rounded-xl font-black uppercase tracking-[0.2em] text-[10px] transition-all flex items-center gap-2 ${stats.errors > 0 ? 'bg-amber-600 text-white hover:bg-amber-700 shadow-lg shadow-amber-100' : 'bg-slate-200 text-slate-400 cursor-not-allowed'}`}
                    >
                        <RefreshCwIcon className="h-3.5 w-3.5" />
                        Retry Errored Syncs
                    </button>
                    <button 
                        onClick={handleClearQueue} 
                        disabled={stats.total === 0}
                        className={`px-6 py-3.5 rounded-xl font-black uppercase tracking-[0.2em] text-[10px] transition-all flex items-center gap-2 ${stats.total > 0 ? 'bg-red-50 hover:bg-red-100 text-red-600 border border-red-200' : 'bg-slate-100 text-slate-300 border border-transparent'}`}
                    >
                        <TrashIcon className="h-3.5 w-3.5" />
                        Clear Sync Queue Cache
                    </button>
                </div>

                <div className="flex items-center gap-2 bg-white px-4 py-2 border border-slate-100 rounded-xl max-w-md w-full">
                    <SearchIcon className="h-4 w-4 text-slate-400" />
                    <input 
                        type="text" 
                        placeholder="Search payload, tokens, paths..." 
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        className="bg-transparent border-none outline-none text-xs w-full font-bold text-slate-700"
                    />
                </div>
            </div>

            {/* Sync Queue Filter Rail & Data Table */}
            <div className="space-y-6">
                <div className="flex flex-wrap gap-4 items-center justify-between border-b border-slate-100 pb-4">
                    <div className="flex flex-wrap gap-2">
                        {/* Status Filters */}
                        <button onClick={() => setStatusFilter('all')} className={`px-4 py-2 rounded-xl font-black uppercase tracking-wider text-[9px] border transition-all ${statusFilter === 'all' ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'}`}>All Statuses</button>
                        <button onClick={() => setStatusFilter('pending')} className={`px-4 py-2 rounded-xl font-black uppercase tracking-wider text-[9px] border transition-all ${statusFilter === 'pending' ? 'bg-amber-600 text-white border-amber-600' : 'bg-white text-amber-600 border-amber-200 hover:bg-amber-50'}`}>Pending ({stats.pending})</button>
                        <button onClick={() => setStatusFilter('cloud_synced')} className={`px-4 py-2 rounded-xl font-black uppercase tracking-wider text-[9px] border transition-all ${statusFilter === 'cloud_synced' ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white text-emerald-600 border-emerald-200 hover:bg-emerald-50'}`}>Synced ({stats.synced})</button>
                        <button onClick={() => setStatusFilter('error')} className={`px-4 py-2 rounded-xl font-black uppercase tracking-wider text-[9px] border transition-all ${statusFilter === 'error' ? 'bg-rose-600 text-white border-rose-600' : 'bg-white text-rose-600 border-rose-200 hover:bg-rose-50'}`}>Errors ({stats.errors})</button>
                    </div>

                    <div className="flex items-center gap-2">
                        <span className="text-[9px] font-black uppercase text-slate-400 tracking-wider">Module:</span>
                        <select 
                            value={categoryFilter}
                            onChange={e => setCategoryFilter(e.target.value as any)}
                            className="text-[10px] font-black uppercase tracking-wider text-slate-600 border border-slate-200 rounded-xl px-3 py-2 outline-none focus:border-slate-400"
                        >
                            <option value="all">All Modules</option>
                            <option value="harvest">Harvesting</option>
                            <option value="inventory">Inventory & Stock</option>
                            <option value="map">Geospatial / Map</option>
                            <option value="accounting">Accounting</option>
                            <option value="other">Other System</option>
                        </select>
                    </div>
                </div>

                {filteredQueue.length === 0 ? (
                    <div className="py-16 text-center border-2 border-dashed border-slate-100 rounded-3xl">
                        <RefreshCwIcon className="h-10 w-10 text-slate-300 mx-auto mb-4" />
                        <h3 className="font-black text-slate-600 uppercase tracking-wider text-xs">No transactions match filters</h3>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Try modifying your query or filter parameters</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto rounded-3xl border border-slate-100">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-slate-50 border-b border-slate-100">
                                    <th className="p-4 text-[9px] font-black uppercase tracking-widest text-slate-400">Timestamp</th>
                                    <th className="p-4 text-[9px] font-black uppercase tracking-widest text-slate-400">Module</th>
                                    <th className="p-4 text-[9px] font-black uppercase tracking-widest text-slate-400">Operation</th>
                                    <th className="p-4 text-[9px] font-black uppercase tracking-widest text-slate-400">Target Path</th>
                                    <th className="p-4 text-[9px] font-black uppercase tracking-widest text-slate-400">Status</th>
                                    <th className="p-4 text-[9px] font-black uppercase tracking-widest text-slate-400 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredQueue.map(item => {
                                    let statusColor = 'bg-amber-100 text-amber-800 border-amber-200';
                                    if (item.status === 'cloud_synced') statusColor = 'bg-emerald-100 text-emerald-800 border-emerald-200';
                                    if (item.status === 'error') statusColor = 'bg-rose-100 text-rose-800 border-rose-200';

                                    return (
                                        <tr key={item.id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                                            <td className="p-4 font-mono text-[10px] text-slate-500">
                                                {new Date(item.timestamp).toLocaleDateString()} {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                                            </td>
                                            <td className="p-4">
                                                <span className="px-2.5 py-1 text-[8px] font-black uppercase tracking-widest rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                                                    {item.category}
                                                </span>
                                            </td>
                                            <td className="p-4">
                                                <span className={`px-2.5 py-1 text-[8px] font-black uppercase tracking-widest rounded-full border ${
                                                    item.type === 'delete' ? 'bg-red-50 text-red-700 border-red-100' :
                                                    item.type === 'update' ? 'bg-blue-50 text-blue-700 border-blue-100' :
                                                    'bg-purple-50 text-purple-700 border-purple-100'
                                                }`}>
                                                    {item.type}
                                                </span>
                                            </td>
                                            <td className="p-4 font-mono text-[10px] text-slate-600 font-bold max-w-xs truncate" title={item.path}>
                                                {item.path}
                                            </td>
                                            <td className="p-4">
                                                <span className={`px-2.5 py-1 text-[8px] font-black uppercase tracking-widest rounded-full border ${statusColor}`}>
                                                    {item.status === 'cloud_synced' ? 'synced' : item.status}
                                                </span>
                                            </td>
                                            <td className="p-4 text-right flex items-center justify-end gap-2">
                                                <button 
                                                    onClick={() => setSelectedEntry(item)} 
                                                    className="px-3 py-1.5 bg-slate-900 text-white rounded-lg text-[9px] font-black uppercase tracking-wider hover:bg-slate-800 transition-colors"
                                                >
                                                    Inspect Payload
                                                </button>
                                                {item.status !== 'cloud_synced' && (
                                                    <button 
                                                        onClick={() => handleRemoveItem(item.id)} 
                                                        className="p-1.5 hover:bg-red-50 text-red-500 rounded-lg transition-colors border border-transparent hover:border-red-100"
                                                        title="Delete from Queue"
                                                    >
                                                        <TrashIcon className="h-3.5 w-3.5" />
                                                    </button>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Standard Backup & nuclear reset row */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-8 border-t border-slate-100">
                <div className="p-8 bg-slate-50 rounded-[2.5rem] border border-slate-100 flex flex-col items-center text-center">
                    <div className="w-16 h-16 bg-blue-600 text-white rounded-2xl flex items-center justify-center mb-6 shadow-xl shadow-blue-100">
                        <SaveIcon className="h-8 w-8" />
                    </div>
                    <h3 className="font-black text-slate-900 uppercase tracking-tight mb-2">Export Local Database</h3>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-8 leading-relaxed">Download a complete snapshot of your maps, employees, and inventory to your local device.</p>
                    <button onClick={onExport} className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black uppercase tracking-[0.2em] text-[10px] hover:bg-slate-800 transition-all">Download JSON</button>
                </div>

                <div className="p-8 bg-slate-50 rounded-[2.5rem] border border-slate-100 flex flex-col items-center text-center">
                    <div className="w-16 h-16 bg-emerald-500 text-white rounded-2xl flex items-center justify-center mb-6 shadow-xl shadow-emerald-100">
                        <RefreshCwIcon className="h-8 w-8" />
                    </div>
                    <h3 className="font-black text-slate-900 uppercase tracking-tight mb-2">Restore Database</h3>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-8 leading-relaxed">Upload a previously saved backup file to restore your entire project state.</p>
                    <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept=".json" />
                    <button onClick={() => fileInputRef.current?.click()} className="w-full py-4 bg-emerald-600 text-white rounded-2xl font-black uppercase tracking-[0.2em] text-[10px] hover:bg-emerald-500 transition-all">Upload File</button>
                </div>

                <div className="p-8 bg-slate-50 rounded-[2.5rem] border border-slate-100 flex flex-col items-center text-center md:col-span-2">
                    <div className="w-16 h-16 bg-red-600 text-white rounded-2xl flex items-center justify-center mb-6 shadow-xl shadow-red-100">
                        <TrashIcon className="h-8 w-8" />
                    </div>
                    <h3 className="font-black text-slate-900 uppercase tracking-tight mb-2">Reset Map Data</h3>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-8 leading-relaxed">Permanently delete all drawn areas, lines, and notes for the current organization. This action is irreversible.</p>
                    <button onClick={onClearMap} className="w-full max-w-xs py-4 bg-red-600 text-white rounded-2xl font-black uppercase tracking-[0.2em] text-[10px] hover:bg-red-700 transition-all shadow-lg shadow-red-100">Clear All Map Features</button>
                </div>

                {isRoot && (
                    <div className="p-8 bg-rose-50 border-4 border-rose-100 rounded-[2.5rem] flex flex-col items-center text-center md:col-span-2 shadow-2xl shadow-rose-100">
                        <div className="w-16 h-16 bg-rose-600 text-white rounded-2xl flex items-center justify-center mb-6 shadow-xl shadow-rose-200 animate-pulse">
                            <AlertTriangleIcon className="h-8 w-8" />
                        </div>
                        <h3 className="font-black text-rose-900 uppercase tracking-tight text-xl mb-2">Total System Reset</h3>
                        <p className="text-[10px] font-black text-rose-400 uppercase tracking-widest mb-8 leading-relaxed max-w-sm">
                            Wipe all company data, worker registries, task histories, and system logs. This is a nuclear option for clearing the testing environment.
                        </p>
                        <button 
                            onClick={() => {
                                if (confirm("NUCLEAR OPTION: This will delete ALL data including companies, employees, tasks, and users. THIS CANNOT BE UNDONE. Type 'RESET' to confirm.")) {
                                    const confirmText = prompt("Type RESET to confirm system wipe:");
                                    if (confirmText === 'RESET') {
                                        onResetSystem?.();
                                    }
                                }
                            }} 
                            className="w-full max-w-md py-5 bg-rose-600 text-white rounded-2xl font-[900] uppercase tracking-[0.3em] text-xs hover:bg-rose-700 transition-all shadow-2xl shadow-rose-300"
                        >
                            Execute Global Wipe
                        </button>
                    </div>
                )}
            </div>

            {/* Inspect Payload Modal */}
            {selectedEntry && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-6 z-50">
                    <div className="bg-white rounded-[2.5rem] border border-slate-100 max-w-3xl w-full max-h-[85vh] flex flex-col shadow-2xl">
                        <div className="p-8 border-b border-slate-100 flex items-center justify-between">
                            <div>
                                <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">Inspect Transaction Payload</h3>
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Transaction ID: {selectedEntry.id}</p>
                            </div>
                            <button onClick={() => setSelectedEntry(null)} className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-400 hover:text-slate-600">
                                <XIcon className="h-6 w-6" />
                            </button>
                        </div>
                        <div className="p-8 overflow-y-auto space-y-6">
                            <div className="grid grid-cols-2 gap-6 text-xs border-b border-slate-50 pb-6">
                                <div>
                                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">Resource Path</span>
                                    <span className="font-mono text-slate-700 font-bold block mt-1">{selectedEntry.path}</span>
                                </div>
                                <div>
                                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">Action Type</span>
                                    <span className="font-bold text-slate-700 uppercase block mt-1">{selectedEntry.type}</span>
                                </div>
                                <div>
                                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">Idempotency Token</span>
                                    <span className="font-mono text-[10px] text-slate-500 break-all block mt-1">{selectedEntry.idempotencyToken || 'None Generated'}</span>
                                </div>
                                <div>
                                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">Sync Status</span>
                                    <span className="font-black text-slate-700 uppercase block mt-1">{selectedEntry.status}</span>
                                </div>
                            </div>

                            {selectedEntry.errorMessage && (
                                <div className="p-4 bg-rose-50 border border-rose-100 rounded-2xl">
                                    <h4 className="text-[10px] font-black text-rose-800 uppercase tracking-wider mb-1">Error Message / Conflict Log</h4>
                                    <p className="text-xs font-mono text-rose-600">{selectedEntry.errorMessage}</p>
                                </div>
                            )}

                            <div>
                                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-2">Data Body</h4>
                                <pre className="bg-slate-950 text-emerald-400 p-6 rounded-2xl font-mono text-xs overflow-x-auto max-h-[300px]">
                                    {JSON.stringify(selectedEntry.data, null, 2)}
                                </pre>
                            </div>

                            {selectedEntry.metadata && (
                                <div>
                                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-2">Device & Origin Metadata</h4>
                                    <pre className="bg-slate-50 border border-slate-100 p-4 rounded-2xl font-mono text-[10px] text-slate-600 overflow-x-auto">
                                        {JSON.stringify(selectedEntry.metadata, null, 2)}
                                    </pre>
                                </div>
                            )}
                        </div>
                        <div className="p-8 border-t border-slate-100 bg-slate-50 rounded-b-[2.5rem] flex justify-end gap-3">
                            <button onClick={() => setSelectedEntry(null)} className="px-6 py-3 bg-slate-200 text-slate-700 rounded-xl font-black uppercase tracking-wider text-[10px] hover:bg-slate-300 transition-colors">
                                Close
                            </button>
                            {selectedEntry.status === 'error' && (
                                <button 
                                    onClick={() => {
                                        try {
                                            const updated = queue.map(i => i.id === selectedEntry.id ? { ...i, status: 'pending' as const, errorMessage: undefined } : i);
                                            localStorage.setItem('agrimap-pending-sync', JSON.stringify(updated));
                                            window.dispatchEvent(new CustomEvent('agrimap-sync-queue-updated'));
                                            setSelectedEntry(null);
                                            toast.success("Transaction reset to pending status.");
                                        } catch (e) {
                                            toast.error("Failed to reset transaction.");
                                        }
                                    }}
                                    className="px-6 py-3 bg-amber-600 text-white rounded-xl font-black uppercase tracking-wider text-[10px] hover:bg-amber-700 transition-colors"
                                >
                                    Reset to Pending
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
