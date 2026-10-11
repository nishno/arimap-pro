import React, { useState, useEffect, useMemo } from 'react';
import { 
    getDetailedSyncQueue, 
    SyncLogEntry, 
    clearSyncQueue, 
    deleteSyncLogEntries, 
    db, 
    doc, 
    getDoc,
    setDoc, 
    updateDoc, 
    deleteDoc, 
    updateSyncLogEntry 
} from '../../firebase';
import { syncBroker, SyncTransaction } from '../../services/SyncBroker';
import { toast } from 'sonner';
import { 
    Database, 
    Wifi, 
    WifiOff, 
    CloudUpload, 
    HardDrive, 
    CheckCircle2, 
    Clock, 
    AlertCircle, 
    Trash2, 
    Filter,
    ChevronDown,
    Search,
    RefreshCcw,
    Layers,
    Activity,
    Server,
    CheckSquare,
    Square,
    MapPin,
    Smartphone,
    User,
    ChevronUp,
    Globe,
    FileText,
    Code,
    Sparkles,
    Scale,
    Boxes,
    GitCompare,
    ArrowRightLeft,
    Check,
    Eye
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { MapContainer, TileLayer, Marker } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';
import { useLanguage } from '../../contexts/LanguageContext';

// Fix traditional leaflet marker icon loading issues in react
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
    iconUrl: markerIcon,
    iconRetinaUrl: markerIcon2x,
    shadowUrl: markerShadow,
});

const MapModal: React.FC<{ lat: number; lng: number; onClose: () => void }> = ({ lat, lng, onClose }) => {
    const isCoordsValid = Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;
    
    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm" onClick={onClose}>
            <div className="bg-slate-800 rounded-3xl overflow-hidden w-full max-w-2xl shadow-xl flex flex-col border border-slate-700/50" onClick={e => e.stopPropagation()}>
                <div className="px-6 py-4 border-b border-white/10 flex justify-between items-center bg-slate-900/50">
                    <h3 className="text-md font-black uppercase tracking-widest text-white flex items-center gap-2">
                        <MapPin size={16} className="text-amber-500" /> Physical Action Vector
                    </h3>
                    <button onClick={onClose} className="text-slate-400 hover:text-white p-2 bg-slate-800 rounded-full">
                        ✕
                    </button>
                </div>
                <div className="h-96 w-full relative bg-slate-900 flex items-center justify-center">
                    {isCoordsValid ? (
                        <MapContainer center={[lat, lng]} zoom={17} style={{ height: '100%', width: '100%', zIndex: 0 }} preferCanvas={true}>
                            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                            <Marker position={[lat, lng]} />
                        </MapContainer>
                    ) : (
                        <div className="text-slate-400 text-xs text-center font-bold p-8">
                            ⚠️ Coordinates [{lat}, {lng}] are invalid or cannot be rendered.
                        </div>
                    )}
                </div>
                <div className="p-4 bg-slate-900/90 flex justify-between items-center text-xs font-mono text-slate-400">
                    <span>LAT: {Number.isFinite(lat) ? lat.toFixed(6) : 'N/A'}</span>
                    <span>LNG: {Number.isFinite(lng) ? lng.toFixed(6) : 'N/A'}</span>
                </div>
            </div>
        </div>
    );
};

export function formatSafeValue(val: any): string {
    if (val === null || val === undefined) return '';
    if (typeof val === 'string') return val;
    if (typeof val === 'number') return isNaN(val) ? '0' : String(val);
    if (typeof val === 'boolean') return val ? 'true' : 'false';
    if (typeof val === 'object') {
        if (val._methodName) {
            return `[${val._methodName}]`;
        }
        if (typeof val.toDate === 'function') {
            try { return val.toDate().toLocaleString(); } catch { return '[Date]'; }
        }
        if (val.seconds !== undefined && val.nanoseconds !== undefined) {
            try { return new Date(val.seconds * 1000).toLocaleString(); } catch { return '[Date]'; }
        }
        try {
            return JSON.stringify(val);
        } catch {
            return '[Object]';
        }
    }
    return String(val);
}

interface FlightRecordNarrative {
    headline: string;
    story: string;
    badge: string;
    badgeColor: string;
    metrics: { label: string; value: string | number }[];
}

export function describeFlightRecord(item: SyncLogEntry, isKa: boolean): FlightRecordNarrative {
    const data = item.data && typeof item.data === 'object' ? item.data : {};
    const author = typeof item.metadata?.userName === 'string' ? item.metadata.userName : (isKa ? 'მომხმარებელი' : 'User');
    const path = typeof item.path === 'string' ? item.path : '';

    // 1. Harvest Entry (Scale / Box intake)
    if (path.startsWith('harvestEntries/') || path.startsWith('harvestLogs/')) {
        const boxes = typeof data.boxCount === 'number' ? data.boxCount : formatSafeValue(data.boxCount || 1);
        const netKgVal = typeof data.netWeightKg === 'number' ? data.netWeightKg : parseFloat(formatSafeValue(data.netWeightKg || 0));
        const netKg = !isNaN(netKgVal) ? netKgVal.toFixed(2) : formatSafeValue(data.netWeightKg || 0);
        const grossKgVal = typeof data.grossWeightKg === 'number' ? data.grossWeightKg : parseFloat(formatSafeValue(data.grossWeightKg || 0));
        const grossKg = !isNaN(grossKgVal) ? grossKgVal.toFixed(2) : formatSafeValue(data.grossWeightKg || 0);
        const picker = typeof data.pickerName === 'string' ? data.pickerName : (typeof data.workerName === 'string' ? data.workerName : formatSafeValue(data.pickerName || data.workerName || (isKa ? 'უცნობი მუშა' : 'Unknown Worker')));
        const variety = typeof data.variety === 'string' ? data.variety : (typeof data.crop === 'string' ? data.crop : formatSafeValue(data.variety || data.crop || (isKa ? 'სტანდარტული' : 'Standard')));
        const eventName = typeof data.harvestEventName === 'string' ? data.harvestEventName : (typeof data.harvestEventId === 'string' ? data.harvestEventId : formatSafeValue(data.harvestEventName || data.harvestEventId || (isKa ? 'კრეფის სესია' : 'Harvest Session')));

        return {
            headline: isKa 
                ? `⚖️ ${boxes} ყუთი (${netKg} კგ) ჩაბარება - ${picker}`
                : `⚖️ ${boxes} Box (${netKg} kg) Intake - ${picker}`,
            story: isKa
                ? `ოპერატორმა ${author}-მა დააფიქსირა სასწორის აწონვა მკრეფავ ${picker}-ზე. ჯიში: "${variety}", ღონისძიება: "${eventName}".`
                : `Operator ${author} recorded scale intake for picker ${picker}. Variety: "${variety}", Session: "${eventName}".`,
            badge: isKa ? 'კრეფის ჩაბარება' : 'Harvest Intake',
            badgeColor: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
            metrics: [
                { label: isKa ? 'წმინდა წონა' : 'Net Weight', value: `${netKg} KG` },
                { label: isKa ? 'ბრუტო წონა' : 'Gross Weight', value: `${grossKg} KG` },
                { label: isKa ? 'ყუთების რ-ბა' : 'Box Count', value: formatSafeValue(boxes) },
                { label: isKa ? 'მკრეფავი' : 'Picker', value: formatSafeValue(picker) }
            ]
        };
    }

    // 2. Harvest Event (Session definition)
    if (path.startsWith('harvestEvents/')) {
        const name = typeof data.name === 'string' ? data.name : formatSafeValue(data.name || (isKa ? 'კრეფის ღონისძიება' : 'Harvest Event'));
        const totalKgVal = typeof data.totalNetWeightKg === 'number' ? data.totalNetWeightKg : parseFloat(formatSafeValue(data.totalNetWeightKg || 0));
        const totalKg = !isNaN(totalKgVal) ? totalKgVal.toFixed(2) : formatSafeValue(data.totalNetWeightKg || 0);
        const totalBoxes = typeof data.totalBoxes === 'number' ? data.totalBoxes : formatSafeValue(data.totalBoxes || 0);
        const status = typeof data.status === 'string' ? data.status : formatSafeValue(data.status || 'ACTIVE');

        return {
            headline: isKa 
                ? `🍓 კრეფის ღონისძიება: "${name}" (${totalKg} კგ)`
                : `🍓 Harvest Event: "${name}" (${totalKg} kg)`,
            story: isKa
                ? `${author}-მა განაახლა კრეფის ღონისძიების პარამეტრები: სულ ${totalKg} კგ, ${totalBoxes} ყუთი. სტატუსი: ${status}.`
                : `${author} updated harvest session metrics: Total ${totalKg} kg across ${totalBoxes} crates. Status: ${status}.`,
            badge: isKa ? 'კრეფის სესია' : 'Harvest Session',
            badgeColor: 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30',
            metrics: [
                { label: isKa ? 'ჯამური წონა' : 'Total Weight', value: `${totalKg} KG` },
                { label: isKa ? 'სულ ყუთები' : 'Total Boxes', value: formatSafeValue(totalBoxes) },
                { label: isKa ? 'სტატუსი' : 'Status', value: formatSafeValue(status) }
            ]
        };
    }

    // 3. Inventory Items (Warehouse Stock Adjustment)
    if (path.startsWith('inventoryItems/')) {
        const name = typeof data.name === 'string' ? data.name : formatSafeValue(data.name || (isKa ? 'სასაწყობო საქონელი' : 'Inventory Item'));
        const stock = data.currentStock !== undefined ? formatSafeValue(data.currentStock) : 'N/A';
        const unit = typeof data.unitOfMeasure === 'string' ? data.unitOfMeasure : formatSafeValue(data.unitOfMeasure || '');
        const cat = typeof data.category === 'string' ? data.category : formatSafeValue(data.category || (isKa ? 'აგრო-ინპუტი' : 'Agro-Input'));

        return {
            headline: isKa
                ? `📦 სასაწყობო მარაგი: ${name} [${stock} ${unit}]`
                : `📦 Stock Level: ${name} [${stock} ${unit}]`,
            story: isKa
                ? `${author}-მა დააკორექტირა ან შეცვალა მარაგის ნაშთი (${cat}): მიმდინარე ნაშთია ${stock} ${unit}.`
                : `${author} modified live warehouse balance (${cat}): Live quantity is ${stock} ${unit}.`,
            badge: isKa ? 'საწყობის მარაგი' : 'Warehouse Stock',
            badgeColor: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
            metrics: [
                { label: isKa ? 'საქონელი' : 'Item', value: formatSafeValue(name) },
                { label: isKa ? 'ნაშთი' : 'Balance', value: `${stock} ${unit}` },
                { label: isKa ? 'კატეგორია' : 'Category', value: formatSafeValue(cat) }
            ]
        };
    }

    // 4. Stock Transactions (Direct charges / feeding / damage / audit)
    if (path.startsWith('stockTransactions/')) {
        const reason = typeof data.reason === 'string' ? data.reason : (typeof data.chargeCategory === 'string' ? data.chargeCategory : formatSafeValue(data.reason || data.chargeCategory || (isKa ? 'ჩამოწერა' : 'Charge')));
        const qty = typeof data.quantity === 'number' ? data.quantity : formatSafeValue(data.quantity || 0);
        const unit = typeof data.unitOfMeasure === 'string' ? data.unitOfMeasure : formatSafeValue(data.unitOfMeasure || '');
        const chargedBy = typeof data.chargedByUserName === 'string' ? data.chargedByUserName : formatSafeValue(data.chargedByUserName || author);

        return {
            headline: isKa
                ? `🌾 აგრო-ხარჯი/ჩამოწერა: -${qty} ${unit} (${reason})`
                : `🌾 Stock Charge: -${qty} ${unit} (${reason})`,
            story: isKa
                ? `ავტორმა ${chargedBy}-მა ჩამოწერა ${qty} ${unit} საწყობიდან. მიზეზი/კატეგორია: "${reason}".`
                : `User ${chargedBy} logged material deduction of ${qty} ${unit}. Reason: "${reason}".`,
            badge: isKa ? 'აგრო-ხარჯი' : 'Stock Deduction',
            badgeColor: 'bg-rose-500/20 text-rose-400 border-rose-500/30',
            metrics: [
                { label: isKa ? 'რაოდენობა' : 'Quantity', value: `${qty} ${unit}` },
                { label: isKa ? 'მიზეზი' : 'Category', value: formatSafeValue(reason) },
                { label: isKa ? 'ავტორი' : 'Charged By', value: formatSafeValue(chargedBy) }
            ]
        };
    }

    // 5. Staff & Roles / Daily Attendance & Presets
    if (path.startsWith('dailyLogs/')) {
        const empName = typeof data.employeeName === 'string' ? data.employeeName : (typeof data.name === 'string' ? data.name : (typeof data.employeeId === 'string' ? data.employeeId : (isKa ? 'თანამშრომელი' : 'Employee')));
        const logDate = typeof data.date === 'string' ? data.date : (isKa ? 'დღეს' : 'Today');
        const rawStatus = typeof data.logType === 'string' ? data.logType : 'Present';
        const statusKa = rawStatus === 'Present' ? 'სამუშაოზეა (Present)' : (rawStatus === 'Absent' ? 'გაცდენა (Absent)' : (rawStatus === 'Late' ? 'დააგვიანა (Late)' : rawStatus));
        const statusDisplay = isKa ? statusKa : rawStatus;

        return {
            headline: isKa
                ? `👥 პერსონალის დასწრება: ${empName} [${statusKa}] - ${logDate}`
                : `👥 Staff Attendance: ${empName} [${statusDisplay}] - ${logDate}`,
            story: isKa
                ? `დაფიქსირდა თანამშრომლის დასწრების სტატუსი: "${empName}" მონიშნულია როგორც "${statusKa}" თარიღით ${logDate}.`
                : `Recorded daily attendance for team member: "${empName}" marked as "${statusDisplay}" on ${logDate}.`,
            badge: isKa ? 'დასწრების ლოგი' : 'Daily Attendance',
            badgeColor: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
            metrics: [
                { label: isKa ? 'თანამშრომელი' : 'Employee', value: formatSafeValue(empName) },
                { label: isKa ? 'თარიღი' : 'Date', value: formatSafeValue(logDate) },
                { label: isKa ? 'სტატუსი' : 'Status', value: formatSafeValue(statusDisplay) }
            ]
        };
    }

    if (path.startsWith('workAssignments/')) {
        const taskTitle = typeof data.title === 'string' ? data.title : (typeof data.taskType === 'string' ? data.taskType : (isKa ? 'საველე სამუშაო' : 'Field Task'));
        const worker = typeof data.assigneeName === 'string' ? data.assigneeName : (typeof data.employeeName === 'string' ? data.employeeName : (isKa ? 'დანიშნული მუშა' : 'Assignee'));
        const plot = typeof data.sectorName === 'string' ? data.sectorName : (typeof data.plotName === 'string' ? data.plotName : (isKa ? 'სექტორი' : 'Sector'));

        return {
            headline: isKa
                ? `📋 სამუშაო დავალება: ${taskTitle} (${worker})`
                : `📋 Work Assignment: ${taskTitle} (${worker})`,
            story: isKa
                ? `${author}-მა გასცა საველე დავალება: "${taskTitle}" მკრეფავ/მუშაკ ${worker}-ზე (${plot}).`
                : `${author} dispatched work task "${taskTitle}" to ${worker} (${plot}).`,
            badge: isKa ? 'სამუშაო დავალება' : 'Work Assignment',
            badgeColor: 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30',
            metrics: [
                { label: isKa ? 'დავალება' : 'Task', value: formatSafeValue(taskTitle) },
                { label: isKa ? 'მუშაკი' : 'Worker', value: formatSafeValue(worker) }
            ]
        };
    }

    if (path.startsWith('employees/') || path.startsWith('roles/')) {
        const name = typeof data.name === 'string' ? data.name : (typeof data.fullName === 'string' ? data.fullName : formatSafeValue(data.name || data.fullName || (isKa ? 'თანამშრომელი' : 'Employee')));
        const role = typeof data.role === 'string' ? data.role : (typeof data.workerType === 'string' ? data.workerType : formatSafeValue(data.role || data.workerType || (isKa ? 'მუშაკი' : 'Worker')));
        const dept = typeof data.department === 'string' ? data.department : formatSafeValue(data.department || (isKa ? 'საველე' : 'Field'));

        return {
            headline: isKa
                ? `👥 პერსონალის დირექტორია: ${name} [${role}]`
                : `👥 Staff Directory: ${name} [${role}]`,
            story: isKa
                ? `${author}-მა განაახლა თანამშრომლის პროფილი: როლი "${role}", განყოფილება "${dept}".`
                : `${author} updated employee record: Role "${role}", Dept "${dept}".`,
            badge: isKa ? 'პერსონალი' : 'Staff Directory',
            badgeColor: 'bg-sky-500/20 text-sky-400 border-sky-500/30',
            metrics: [
                { label: isKa ? 'თანამშრომელი' : 'Name', value: formatSafeValue(name) },
                { label: isKa ? 'როლი' : 'Role', value: formatSafeValue(role) },
                { label: isKa ? 'განყოფილება' : 'Dept', value: formatSafeValue(dept) }
            ]
        };
    }

    if (path.startsWith('machinery/')) {
        const machName = typeof data.name === 'string' ? data.name : (typeof data.model === 'string' ? data.model : (isKa ? 'ტექნიკა' : 'Machinery'));
        const machType = typeof data.type === 'string' ? data.type : (isKa ? 'ტრაქტორი/აგრეგატი' : 'Equipment');

        return {
            headline: isKa
                ? `🚜 ტექნიკა & აგრეგატი: ${machName} [${machType}]`
                : `🚜 Machinery & Equipment: ${machName} [${machType}]`,
            story: isKa
                ? `${author}-მა განაახლა ტექნიკური რეგისტრი: ${machName} (${machType}).`
                : `${author} updated equipment register: ${machName} (${machType}).`,
            badge: isKa ? 'ტექნიკა' : 'Equipment',
            badgeColor: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
            metrics: [
                { label: isKa ? 'დასახელება' : 'Name', value: formatSafeValue(machName) },
                { label: isKa ? 'ტიპი' : 'Type', value: formatSafeValue(machType) }
            ]
        };
    }

    // 6. Map Features
    if (path.startsWith('plantationFeatures/') || path.startsWith('layers/')) {
        const featureName = typeof data.name === 'string' ? data.name : (typeof data.featureType === 'string' ? data.featureType : formatSafeValue(data.name || data.featureType || (isKa ? 'რუკის ობიექტი' : 'Map Feature')));
        const points = Array.isArray(data.geometry?.coordinates) ? data.geometry.coordinates.length : (Array.isArray(data.coordinates) ? data.coordinates.length : 0);

        return {
            headline: isKa
                ? `🗺️ საველე რუკის ნახაზი: ${featureName}`
                : `🗺️ Field Map Geometry: ${featureName}`,
            story: isKa
                ? `${author}-მა დაიტანა ან განაახლა გეომეტრიული ობიექტი რუკაზე (${points} საკოორდინატო წერტილი).`
                : `${author} plotted/modified map layer (${points} coordinate vertices).`,
            badge: isKa ? 'რუკის ნახაზი' : 'Map Planner',
            badgeColor: 'bg-teal-500/20 text-teal-400 border-teal-500/30',
            metrics: [
                { label: isKa ? 'ობიექტი' : 'Feature', value: formatSafeValue(featureName) },
                { label: isKa ? 'წერტილები' : 'Points', value: points }
            ]
        };
    }

    // 7. Finances
    if (path.startsWith('transactions/') || path.startsWith('accounts/')) {
        const title = typeof data.description === 'string' ? data.description : (typeof data.title === 'string' ? data.title : formatSafeValue(data.description || data.title || (isKa ? 'ფინანსური ხარჯი' : 'Financial Ledger')));
        const amount = typeof data.amount === 'number' ? data.amount : (typeof data.totalCost === 'number' ? data.totalCost : formatSafeValue(data.amount || data.totalCost || 0));

        return {
            headline: isKa
                ? `💳 ფინანსური ტრანზაქცია: ${title} [${amount} GEL]`
                : `💳 Financial Ledger: ${title} [${amount} GEL]`,
            story: isKa
                ? `${author}-მა გაატარა ფინანსური ოპერაცია თანხით ${amount} GEL.`
                : `${author} recorded financial transaction for amount ${amount} GEL.`,
            badge: isKa ? 'ფინანსები' : 'Finance Ledger',
            badgeColor: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
            metrics: [
                { label: isKa ? 'დანიშნულება' : 'Title', value: formatSafeValue(title) },
                { label: isKa ? 'თანხა' : 'Amount', value: `${amount} GEL` }
            ]
        };
    }

    // 8. Other known collections (Notes, Alerts, Agronomy)
    if (path.startsWith('notes/')) {
        const noteText = typeof data.text === 'string' ? data.text : (typeof data.content === 'string' ? data.content : (isKa ? 'საველე შენიშვნა' : 'Field Note'));
        return {
            headline: isKa ? `📝 საველე ჩანაწერი: ${noteText.slice(0, 35)}...` : `📝 Field Note: ${noteText.slice(0, 35)}...`,
            story: isKa ? `${author}-მა ჩაწერა საველე შენიშვნა.` : `${author} recorded a field note.`,
            badge: isKa ? 'შენიშვნა' : 'Field Note',
            badgeColor: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
            metrics: [
                { label: isKa ? 'შინაარსი' : 'Content', value: formatSafeValue(noteText.slice(0, 25)) },
                { label: isKa ? 'ავტორი' : 'Author', value: formatSafeValue(author) }
            ]
        };
    }

    if (path.startsWith('alerts/')) {
        const msg = typeof data.message === 'string' ? data.message : (typeof data.title === 'string' ? data.title : (isKa ? 'შეტყობინება' : 'Notification'));
        return {
            headline: isKa ? `🔔 სისტემური შეტყობინება: ${msg.slice(0, 35)}...` : `🔔 System Alert: ${msg.slice(0, 35)}...`,
            story: isKa ? `${author}-მა გააგზავნა ან განაახლა სისტემური შეტყობინება.` : `${author} posted or updated system alert.`,
            badge: isKa ? 'შეტყობინება' : 'System Alert',
            badgeColor: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
            metrics: [
                { label: isKa ? 'ტექსტი' : 'Alert', value: formatSafeValue(msg.slice(0, 25)) }
            ]
        };
    }

    // Friendly Generic fallback for ordinary users
    const collection = path.split('/')[0] || 'record';
    const friendlyCollectionKa: Record<string, string> = {
        dailyLogs: 'პერსონალის დასწრება',
        employees: 'თანამშრომლის პროფილი',
        workAssignments: 'სამუშაო დავალება',
        harvestEntries: 'მოსავლის აწონვა',
        harvestEvents: 'კრეფის სესია',
        inventoryItems: 'სასაწყობო საქონელი',
        stockTransactions: 'მარაგის ხარჯი',
        plantationFeatures: 'რუკის ობიექტი',
        transactions: 'ფინანსური ხარჯი',
        accounts: 'ანგარიში',
        machinery: 'ტექნიკა & აგრეგატი',
        notes: 'საველე შენიშვნა',
        alerts: 'შეტყობინება'
    };
    const friendlyCollectionEn: Record<string, string> = {
        dailyLogs: 'Staff Attendance',
        employees: 'Employee Profile',
        workAssignments: 'Work Assignment',
        harvestEntries: 'Harvest Weighing',
        harvestEvents: 'Harvest Session',
        inventoryItems: 'Inventory Stock',
        stockTransactions: 'Stock Usage',
        plantationFeatures: 'Map Object',
        transactions: 'Financial Entry',
        accounts: 'Account Record',
        machinery: 'Machinery Record',
        notes: 'Field Note',
        alerts: 'System Alert'
    };

    const friendlyName = isKa 
        ? (friendlyCollectionKa[collection] || (data.name || data.title || collection))
        : (friendlyCollectionEn[collection] || (data.name || data.title || collection));

    const itemTitle = typeof data.name === 'string' ? data.name : (typeof data.title === 'string' ? data.title : (typeof data.workerName === 'string' ? data.workerName : ''));
    const headline = itemTitle 
        ? `${friendlyName}: ${itemTitle}` 
        : `${friendlyName} (${item.type === 'set' ? (isKa ? 'შენახვა' : 'Save') : (item.type === 'delete' ? (isKa ? 'წაშლა' : 'Delete') : item.type)})`;

    return {
        headline,
        story: isKa 
            ? `${author}-მა განახორციელა ცვლილება (${friendlyName}).`
            : `${author} modified ${friendlyName}.`,
        badge: friendlyName,
        badgeColor: 'bg-slate-500/20 text-slate-400 border-slate-500/30',
        metrics: [
            { label: isKa ? 'მოდული' : 'Module', value: friendlyName },
            { label: isKa ? 'მოქმედება' : 'Action', value: formatSafeValue(item.type) }
        ]
    };
}

interface DataStateAuditorProps {
    isOpen: boolean;
    onClose: () => void;
    inventoryItems?: any[];
    onSetInventoryItems?: (items: any[]) => void;
}

const DataStateAuditor: React.FC<DataStateAuditorProps> = ({ 
    isOpen, 
    onClose,
    inventoryItems = [],
    onSetInventoryItems = () => {}
}) => {
    const { language } = useLanguage();
    const isKa = language === 'ka';

    const [syncQueue, setSyncQueue] = useState<SyncLogEntry[]>([]);
    const [activeTab, setActiveTab] = useState<'queue' | 'broker'>('queue');
    const [brokerTxs, setBrokerTxs] = useState<SyncTransaction[]>(syncBroker.getTransactions());
    const [filterCategory, setFilterCategory] = useState<string>('all');
    const [filterStatus, setFilterStatus] = useState<string>('all');
    const [searchTerm, setSearchTerm] = useState('');
    const [isOnline, setIsOnline] = useState(navigator.onLine);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [rawJsonViewIds, setRawJsonViewIds] = useState<Set<string>>(new Set());

    // Diff inspection state
    const [diffModalItem, setDiffModalItem] = useState<SyncLogEntry | null>(null);
    const [cloudDocData, setCloudDocData] = useState<any>(null);
    const [isLoadingDiff, setIsLoadingDiff] = useState(false);

    useEffect(() => {
        const updateQueue = () => {
            const queue = getDetailedSyncQueue();
            setSyncQueue(queue);
            const queueIds = new Set(queue.map(i => i.id));
            setSelectedIds(prev => {
                const next = new Set<string>();
                prev.forEach(id => { if (queueIds.has(id)) next.add(id); });
                return next;
            });
        };
        const updateBroker = () => {
            setBrokerTxs(syncBroker.getTransactions());
        };
        const handleStatus = () => setIsOnline(navigator.onLine);

        window.addEventListener('agrimap-sync-queue-updated', updateQueue);
        window.addEventListener('agrimap-broker-transactions-updated', updateBroker);
        window.addEventListener('online', handleStatus);
        window.addEventListener('offline', handleStatus);
        
        updateQueue();
        updateBroker();

        return () => {
            window.removeEventListener('agrimap-sync-queue-updated', updateQueue);
            window.removeEventListener('agrimap-broker-transactions-updated', updateBroker);
            window.removeEventListener('online', handleStatus);
            window.removeEventListener('offline', handleStatus);
        };
    }, []);

    const stats = useMemo(() => {
        return {
            total: syncQueue.length,
            cloud: syncQueue.filter(s => s.status === 'cloud_synced').length,
            local: syncQueue.filter(s => s.status === 'local_synced').length,
            pending: syncQueue.filter(s => s.status === 'pending').length,
            errors: syncQueue.filter(s => s.status === 'error').length
        };
    }, [syncQueue]);

    const filteredQueue = useMemo(() => {
        let currentUser: any = null;
        try {
            currentUser = JSON.parse(localStorage.getItem('agri-planter-session') || localStorage.getItem('agri-planter-mock-user') || 'null');
        } catch(e) {}
        
        const isSystemAdmin = currentUser?.role === 'system_admin';
        const activeOrgId = localStorage.getItem('agri-planter-active-org');

        return syncQueue.filter(item => {
            if (!isSystemAdmin && item.organizationId && item.organizationId !== activeOrgId) {
                return false;
            }
            const matchesCategory = filterCategory === 'all' || item.category === filterCategory;
            const matchesStatus = filterStatus === 'all' || item.status === filterStatus;
            const matchesSearch = item.path.toLowerCase().includes(searchTerm.toLowerCase()) || 
                                (item.type && item.type.toLowerCase().includes(searchTerm.toLowerCase())) ||
                                (item.metadata?.userName && item.metadata.userName.toLowerCase().includes(searchTerm.toLowerCase()));
            return matchesCategory && matchesStatus && matchesSearch;
        }).reverse();
    }, [syncQueue, filterCategory, filterStatus, searchTerm]);

    const handleSelectAllToggle = () => {
        if (selectedIds.size === filteredQueue.length && filteredQueue.length > 0) {
            setSelectedIds(new Set());
        } else {
            setSelectedIds(new Set(filteredQueue.map(i => i.id)));
        }
    };

    const toggleSelection = (id: string) => {
        setSelectedIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const toggleRawJson = (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        setRawJsonViewIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const handleDeleteSelected = () => {
        if (selectedIds.size === 0) return;
        if (confirm(`Delete ${selectedIds.size} selected entries?`)) {
            deleteSyncLogEntries(Array.from(selectedIds));
            setSelectedIds(new Set());
            toast.success("Entries deleted");
        }
    };

    const handleClearAll = () => {
        if(confirm('Wipe entire sync history? This clears all entries.')) {
            clearSyncQueue();
            setSelectedIds(new Set());
            toast.success("History cleared");
        }
    };

    const handlePushToCloud = async (id: string, e?: React.MouseEvent) => {
        if (e) e.stopPropagation();
        
        try {
            const queue = JSON.parse(localStorage.getItem('agrimap-pending-sync') || '[]');
            const item = queue.find((i: any) => i.id === id);
            
            if (item) {
                const pathParts = item.path.split('/');
                if (pathParts.length >= 2) {
                    const colPath = pathParts[0];
                    const docId = pathParts[1];
                    const docRef = doc(db, colPath, docId);
                    
                    if (item.type === 'set') await setDoc(docRef, item.data);
                    else if (item.type === 'update') await updateDoc(docRef, item.data);
                    else if (item.type === 'delete') await deleteDoc(docRef);
                }
            }
        } catch (error: any) {
            console.error("Local explicit push failed:", error);
            toast.error("Cloud push failed, review payload logic");
        }

        updateSyncLogEntry(id, { status: 'cloud_synced' });
        toast.success("Synchronized specific payload to cloud instance");
        if (diffModalItem?.id === id) setDiffModalItem(null);
    };

    const handleKeepInLocal = (id: string, e?: React.MouseEvent) => {
        if (e) e.stopPropagation();
        updateSyncLogEntry(id, { status: 'local_synced' });
        toast.info("Ledger row preserved strictly in local node");
        if (diffModalItem?.id === id) setDiffModalItem(null);
    };

    const handleDeleteEntry = (id: string, e?: React.MouseEvent) => {
        if (e) e.stopPropagation();
        if (confirm("Delete this physical record permanently?")) {
            deleteSyncLogEntries([id]);
            toast.success("Record purged");
            if (diffModalItem?.id === id) setDiffModalItem(null);
        }
    };

    const handleOpenDiff = async (item: SyncLogEntry, e: React.MouseEvent) => {
        e.stopPropagation();
        setDiffModalItem(item);
        setIsLoadingDiff(true);
        setCloudDocData(null);

        try {
            const pathParts = item.path.split('/');
            if (pathParts.length >= 2) {
                const docRef = doc(db, pathParts[0], pathParts[1]);
                const snap = await getDoc(docRef);
                if (snap.exists()) {
                    setCloudDocData(snap.data());
                } else {
                    setCloudDocData({ _status: isKa ? 'დოკუმენტი არ არსებობს Cloud-ზე (ახალი ჩანაწერი)' : 'Document does not exist in Cloud (New Entry)' });
                }
            }
        } catch (err: any) {
            console.error("Failed to fetch cloud doc for diff:", err);
            setCloudDocData({ _error: err.message || 'Error querying Firestore' });
        } finally {
            setIsLoadingDiff(false);
        }
    };
    
    const [mapLocation, setMapLocation] = useState<{lat: number, lng: number} | null>(null);

    const handleMapClick = (lat: number, lng: number, e: React.MouseEvent) => {
        e.stopPropagation();
        if (Number.isFinite(lat) && Number.isFinite(lng)) {
            setMapLocation({ lat, lng });
        } else {
            toast.error("Point possesses invalid NaN coordinate vectors and cannot be mapped.");
        }
    };

    const [isBackingUp, setIsBackingUp] = useState(false);

    const handleBackup = () => {
        setIsBackingUp(true);
        const data = {
            syncQueue,
            localConfig: localStorage.getItem('agrimap-local-config'),
            timestamp: new Date().toISOString()
        };
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `agrimap_backup_${new Date().toISOString().split('T')[0]}.json`;
        link.click();
        setTimeout(() => setIsBackingUp(false), 2000);
        toast.success("System Backup Generated");
    };

    if (!isOpen) return null;

    return (
        <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md"
        >
            <motion.div 
                initial={{ scale: 0.9, y: 20 }}
                animate={{ scale: 1, y: 0 }}
                className="bg-slate-900 w-full max-w-6xl h-[92vh] rounded-[40px] shadow-2xl border border-slate-800 flex flex-col overflow-hidden"
            >
                {/* Header */}
                <div className="p-8 border-b border-slate-800 flex justify-between items-center bg-slate-900/50">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-indigo-600/20 rounded-2xl text-indigo-400">
                            <Activity size={24} />
                        </div>
                        <div>
                            <h2 className="text-2xl font-black text-white tracking-tight uppercase">
                                {isKa ? "სისტემური აუდიტის ჟურნალი (Flight Recorder)" : "System Flight Recorder"}
                            </h2>
                            <p className="text-slate-500 font-bold text-[10px] uppercase tracking-[0.2em] flex items-center gap-2">
                                <Server size={10} /> Data State Auditor • Distributed Multi-Device Engine
                            </p>
                        </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                        <button 
                            onClick={handleBackup}
                            disabled={isBackingUp}
                            className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all"
                        >
                            <CloudUpload size={14} />
                            {isBackingUp ? 'BACKING UP...' : 'SYSTEM BACKUP'}
                        </button>
                        <button 
                            onClick={onClose}
                            className="p-3 bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700 rounded-2xl transition-all"
                        >
                            <ChevronDown size={20} />
                        </button>
                    </div>
                </div>

                {/* Control Panel */}
                <div className="px-8 py-4 bg-slate-950/30 border-b border-slate-800 flex flex-wrap items-center justify-between gap-4">
                    <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-2xl border border-slate-800">
                        <button 
                            onClick={() => window.dispatchEvent(new CustomEvent('agrimap-toggle-offline', { detail: true }))}
                            className={`px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${navigator.onLine ? 'text-slate-600 hover:text-slate-400' : 'bg-red-600 text-white shadow-lg'}`}
                        >
                            GO OFFLINE
                        </button>
                        <button 
                            onClick={() => window.dispatchEvent(new CustomEvent('agrimap-toggle-offline', { detail: false }))}
                            className={`px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${navigator.onLine ? 'bg-emerald-600 text-white shadow-lg' : 'text-slate-600 hover:text-slate-400'}`}
                        >
                            CLOUD MODE
                        </button>
                    </div>

                    <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-2xl border border-slate-800">
                        <button 
                            onClick={() => setActiveTab('queue')}
                            className={`px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${activeTab === 'queue' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}
                        >
                            {isKa ? 'სინქრონიზაციის ჟურნალი' : 'Sync Queue Log'}
                        </button>
                        <button 
                            onClick={() => setActiveTab('broker')}
                            className={`px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${activeTab === 'broker' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}
                        >
                            {isKa ? 'ბროკერის ოპერაციები' : 'Middle Broker Operations'}
                        </button>
                    </div>

                    <button 
                        onClick={() => window.dispatchEvent(new CustomEvent('agrimap-push-cloud'))}
                        className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-indigo-600/30 transition-all flex items-center gap-2"
                    >
                        <CloudUpload size={14} />
                        {isKa ? 'ყველას სინქრონიზაცია' : 'PUSH TO FIREBASE'}
                    </button>
                </div>

                {/* Dashboard Stats */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 p-8 pt-6 pb-6 bg-slate-900/30">
                    <div className="bg-slate-800/40 p-4 rounded-3xl border border-slate-800/50">
                        <div className="flex items-center gap-2 mb-1">
                            <CloudUpload size={16} className="text-emerald-400" />
                            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{isKa ? 'დამოწმებული Cloud' : 'Verified Cloud'}</span>
                        </div>
                        <p className="text-2xl font-black text-white">{stats.cloud}</p>
                    </div>
                    <div className="bg-slate-800/40 p-4 rounded-3xl border border-slate-800/50">
                        <div className="flex items-center gap-2 mb-1">
                            <HardDrive size={16} className="text-indigo-400" />
                            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{isKa ? 'ლოკალური მეხსიერება' : 'Local Vault'}</span>
                        </div>
                        <p className="text-2xl font-black text-white">{stats.local}</p>
                    </div>
                    <div className="bg-slate-800/40 p-4 rounded-3xl border border-slate-800/50">
                        <div className="flex items-center gap-2 mb-1">
                            <Clock size={16} className="text-amber-400" />
                            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{isKa ? 'მომლოდინე რიგი' : 'Pending Queue'}</span>
                        </div>
                        <p className="text-2xl font-black text-white">{stats.pending}</p>
                    </div>
                    <div className="bg-slate-800/40 p-4 rounded-3xl border border-slate-800/50">
                        <div className="flex items-center gap-2 mb-1 text-red-400">
                            <AlertCircle size={16} />
                            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{isKa ? 'შეცდომა / ბლოკი' : 'Blocked Ops'}</span>
                        </div>
                        <p className="text-2xl font-black text-white">{stats.errors}</p>
                    </div>
                </div>

                {/* Filters */}
                <div className="px-8 pb-4 flex flex-wrap items-center gap-3 bg-slate-900/30">
                    <div className="relative flex-1 min-w-[200px]">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
                        <input 
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            placeholder={isKa ? "ძიება მისამართით, ავტორით..." : "SEARCH BY PATH, ACTOR, DATA..."}
                            className="w-full bg-slate-800/50 border border-slate-700/50 rounded-2xl py-3 pl-12 pr-4 text-[10px] font-black text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500 transition-all uppercase tracking-widest"
                        />
                    </div>
                    <select 
                        value={filterCategory}
                        onChange={e => setFilterCategory(e.target.value)}
                        className="bg-slate-800/50 border border-slate-700/50 rounded-2xl py-3 px-4 text-[10px] font-black text-white focus:outline-none focus:border-indigo-500 transition-all uppercase tracking-widest"
                    >
                        <option value="all">{isKa ? 'ყველა კატეგორია' : 'ALL CATEGORIES'}</option>
                        <option value="harvest">{isKa ? 'კრეფა' : 'HARVEST'}</option>
                        <option value="inventory">{isKa ? 'მარაგები & ხარჯი' : 'INVENTORY'}</option>
                        <option value="employee">{isKa ? 'პერსონალი' : 'EMPLOYEE'}</option>
                        <option value="map">{isKa ? 'რუკა' : 'MAP PLANNER'}</option>
                        <option value="agronomy">{isKa ? 'აგრონომია' : 'AGRONOMY'}</option>
                        <option value="task">{isKa ? 'დავალებები' : 'TASKS/PLANS'}</option>
                        <option value="accounting">{isKa ? 'ფინანსები' : 'ACCOUNTING'}</option>
                    </select>
                    <select 
                        value={filterStatus}
                        onChange={e => setFilterStatus(e.target.value)}
                        className="bg-slate-800/50 border border-slate-700/50 rounded-2xl py-3 px-4 text-[10px] font-black text-white focus:outline-none focus:border-indigo-500 transition-all uppercase tracking-widest"
                    >
                        <option value="all">{isKa ? 'ყველა სტატუსი' : 'ALL STATUS'}</option>
                        <option value="cloud_synced">{isKa ? 'დამოწმებული Cloud' : 'VERIFIED CLOUD'}</option>
                        <option value="local_synced">{isKa ? 'ლოკალური LAN' : 'LOCAL LAN'}</option>
                        <option value="pending">{isKa ? 'მომლოდინე' : 'PENDING'}</option>
                        <option value="error">{isKa ? 'შეცდომა' : 'ERROR'}</option>
                    </select>
                    
                    {selectedIds.size > 0 && (
                        <button 
                            onClick={handleDeleteSelected}
                            className="px-4 border border-red-500/50 py-3 bg-red-500/10 text-[10px] font-black uppercase tracking-widest text-red-400 hover:bg-red-500 hover:text-white rounded-2xl transition-all flex items-center gap-2"
                        >
                            <Trash2 size={16} /> Delete Selected ({selectedIds.size})
                        </button>
                    )}
                    
                    <button 
                        onClick={handleClearAll}
                        className="p-3 bg-red-900/30 text-red-500 hover:bg-red-600 hover:text-white rounded-2xl transition-all"
                        title="Clear All History"
                    >
                        <Trash2 size={18} />
                    </button>
                </div>

                {/* Ledger Body */}
                <div className="flex-1 overflow-y-auto p-8 pt-0 scrollbar-hide">
                    {activeTab === 'queue' ? (
                        <>
                            {filteredQueue.length > 0 && (
                                <div className="flex items-center gap-2 mb-4 px-2">
                                    <button onClick={handleSelectAllToggle} className="text-slate-400 hover:text-white flex items-center gap-2 text-[10px] uppercase font-black tracking-widest">
                                        {selectedIds.size === filteredQueue.length ? <CheckSquare size={16} /> : <Square size={16} />}
                                        Select All Filtered ({filteredQueue.length})
                                    </button>
                                </div>
                            )}
                            <div className="space-y-3">
                                {filteredQueue.map((item) => {
                                    const narrative = describeFlightRecord(item, isKa);
                                    const showRaw = rawJsonViewIds.has(item.id);

                                    return (
                                        <div key={item.id} className={`group border p-5 rounded-3xl flex flex-col transition-all cursor-pointer ${
                                                selectedIds.has(item.id) 
                                                    ? 'bg-indigo-900/40 border-indigo-500/50' 
                                                    : 'bg-slate-800/30 hover:bg-slate-800/60 border-slate-800/70'
                                            }`}
                                        >
                                            {/* Top Row: Select, Badge, Headline, Sync Status */}
                                            <div className="flex items-start justify-between gap-4" onClick={() => {
                                                    toggleSelection(item.id);
                                                    setExpandedId(expandedId === item.id ? null : item.id);
                                                }}>
                                                
                                                <div className="flex items-start gap-3 flex-1">
                                                    <div className="text-slate-500 mt-1" onClick={(e) => { e.stopPropagation(); toggleSelection(item.id); }}>
                                                        {selectedIds.has(item.id) ? <CheckSquare className="text-indigo-400" size={18} /> : <Square size={18} />}
                                                    </div>

                                                    <div className="flex-1">
                                                        <div className="flex items-center gap-2 flex-wrap mb-1.5">
                                                            <span className={`px-2 py-0.5 rounded-lg text-[9px] font-black uppercase border ${narrative.badgeColor}`}>
                                                                {formatSafeValue(narrative.badge)}
                                                            </span>
                                                            <span className="text-[9px] font-black px-2 py-0.5 bg-slate-700/60 rounded-md text-slate-300 uppercase font-mono">
                                                                {formatSafeValue(item.type)} • {formatSafeValue(item.path)}
                                                            </span>
                                                            <span className="text-[9px] text-slate-500 font-mono">
                                                                {new Date(item.timestamp).toLocaleDateString()} {new Date(item.timestamp).toLocaleTimeString()}
                                                            </span>
                                                        </div>

                                                        {/* Primary Human Narrative Headline */}
                                                        <h4 className="text-sm font-extrabold text-white leading-snug">
                                                            {formatSafeValue(narrative.headline)}
                                                        </h4>
                                                        
                                                        <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                                                            {formatSafeValue(narrative.story)}
                                                        </p>

                                                        {/* Key Metrics Pills */}
                                                        {narrative.metrics.length > 0 && (
                                                            <div className="flex items-center gap-2 flex-wrap mt-2.5">
                                                                {narrative.metrics.map((m, idx) => (
                                                                    <div key={idx} className="bg-slate-900/80 px-2.5 py-1 rounded-xl border border-slate-700/40 text-[10px]">
                                                                        <span className="text-slate-500 font-bold uppercase tracking-wider mr-1.5">{formatSafeValue(m.label)}:</span>
                                                                        <span className="text-slate-200 font-black">{formatSafeValue(m.value)}</span>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                                
                                                <div className="flex items-center gap-3">
                                                    <div className="text-right hidden sm:block">
                                                        <div className={`text-[10px] font-black uppercase tracking-widest ${
                                                            item.status === 'cloud_synced' ? 'text-emerald-400' :
                                                            item.status === 'local_synced' ? 'text-indigo-400' :
                                                            item.status === 'pending' ? 'text-amber-400 animate-pulse' :
                                                            'text-red-400'
                                                        }`}>
                                                            {item.status === 'cloud_synced' ? 'Verified Cloud' :
                                                             item.status === 'local_synced' ? 'Office Vault' :
                                                             item.status === 'pending' ? 'Tablet Memory' :
                                                             'Blocked'}
                                                        </div>
                                                        <p className="text-[8px] font-bold text-slate-500 font-mono mt-0.5">
                                                            ID: {item.id.slice(-6)}
                                                        </p>
                                                    </div>

                                                    <button 
                                                        onClick={(e) => handleOpenDiff(item, e)}
                                                        className="px-3 py-1.5 bg-indigo-600/20 hover:bg-indigo-600 hover:text-white text-indigo-400 border border-indigo-500/30 rounded-xl text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 transition-all"
                                                        title="View Side-by-Side Diff against Cloud"
                                                    >
                                                        <GitCompare size={13} />
                                                        {isKa ? 'Cloud Diff' : 'Diff'}
                                                    </button>

                                                    <div className={`p-2 rounded-xl transition-all ${expandedId === item.id ? 'bg-slate-700 text-white' : 'text-slate-500 hover:text-white'}`}>
                                                        <ChevronUp size={16} className={expandedId === item.id ? '' : 'rotate-180'} />
                                                    </div>
                                                </div>
                                            </div>
                                            
                                            {/* Expanded Detailed View */}
                                            {expandedId === item.id && (
                                                <div className="mt-4 pt-4 border-t border-slate-700/60 pl-8 pr-2 pb-1 animate-in slide-in-from-top-2 duration-200">
                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
                                                        <div className="space-y-3">
                                                            <div className="flex items-center gap-3 text-slate-300">
                                                                <User size={14} className="text-slate-500" />
                                                                <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 w-20">Operator</span>
                                                                <span className="font-bold text-xs text-white">
                                                                    {item.metadata?.userName || item.metadata?.userId || 'System Action'} {item.metadata?.userRole ? `(${item.metadata.userRole})` : ''}
                                                                </span>
                                                            </div>
                                                            <div className="flex items-center gap-3 text-slate-300">
                                                                <Smartphone size={14} className="text-slate-500" />
                                                                <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 w-20">Device</span>
                                                                <span className="font-medium text-xs text-slate-300 truncate" title={item.metadata?.deviceFingerprint}>
                                                                    {item.metadata?.deviceFingerprint || 'Unknown Mobile / Tablet'}
                                                                </span>
                                                            </div>
                                                            <div className="flex items-center gap-3 text-slate-300">
                                                                <MapPin size={14} className="text-slate-500" />
                                                                <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 w-20">GPS Vector</span>
                                                                {item.metadata?.gpsMetadata ? (
                                                                    <div className="flex items-center gap-2">
                                                                        <span className="font-mono text-xs text-amber-400">
                                                                            {item.metadata.gpsMetadata.lat.toFixed(5)}, {item.metadata.gpsMetadata.lng.toFixed(5)}
                                                                        </span>
                                                                        <button onClick={(e) => handleMapClick(item.metadata!.gpsMetadata!.lat, item.metadata!.gpsMetadata!.lng, e)} className="px-2 py-0.5 bg-amber-500/10 text-amber-500 hover:bg-amber-500 hover:text-white rounded text-[9px] font-black uppercase tracking-widest transition-all">
                                                                            View on Map 📍
                                                                        </button>
                                                                    </div>
                                                                ) : (
                                                                    <span className="font-medium text-xs text-slate-600 italic">No GPS coordinates attached</span>
                                                                )}
                                                            </div>

                                                            {/* Technical Toggle */}
                                                            <div className="pt-2">
                                                                <button 
                                                                    onClick={(e) => toggleRawJson(item.id, e)}
                                                                    className="text-[10px] font-bold text-slate-500 hover:text-slate-300 flex items-center gap-1 uppercase tracking-wider"
                                                                >
                                                                    <Code size={12} />
                                                                    {showRaw ? 'Hide Raw JSON Schema' : 'Inspect Raw JSON Schema'}
                                                                </button>

                                                                {showRaw && (
                                                                    <div className="bg-slate-950 p-3 rounded-xl font-mono text-[10px] max-h-36 overflow-y-auto text-indigo-300 border border-slate-800 mt-2">
                                                                        <pre>{JSON.stringify(item.data, null, 2)}</pre>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                        
                                                        <div className="flex flex-col justify-between gap-4">
                                                            <div className="p-3 bg-slate-950/60 rounded-2xl border border-slate-800/80">
                                                                <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest block mb-1">
                                                                    {isKa ? 'სინქრონიზაციის სტრატეგია' : 'Resolution Strategy'}
                                                                </span>
                                                                <p className="text-xs text-slate-300 font-bold">
                                                                    {item.path.startsWith('harvestEntries/') ? '🔋 Atomic Append & Unique Scale Token' :
                                                                     item.path.startsWith('inventoryItems/') ? '🛡️ Delta Increment / Server Stream' :
                                                                     item.path.startsWith('plantationFeatures/') ? '🌐 Array Union & Geometry Concat' :
                                                                     '⚡ Standard LWW Merge'}
                                                                </p>
                                                            </div>

                                                            <div className="flex justify-end gap-2 flex-wrap">
                                                                <button onClick={(e) => handleKeepInLocal(item.id, e)} className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-indigo-400 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5 transition-colors">
                                                                    <HardDrive size={13} /> {isKa ? 'ლოკალში დატოვება' : 'Keep Local'}
                                                                </button>
                                                                <button onClick={(e) => handlePushToCloud(item.id, e)} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5 transition-colors shadow-lg shadow-indigo-900/30">
                                                                    <Globe size={13} /> {isKa ? 'Cloud-ზე გაგზავნა' : 'Push to Cloud'}
                                                                </button>
                                                                <button onClick={(e) => handleDeleteEntry(item.id, e)} className="px-3 py-2 bg-red-500/10 hover:bg-red-500 text-red-400 hover:text-white rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5 transition-colors">
                                                                    <Trash2 size={13} /> {isKa ? 'წაშლა' : 'Wipe'}
                                                                </button>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}

                                {filteredQueue.length === 0 && (
                                    <div className="py-20 text-center space-y-4">
                                        <div className="p-6 bg-slate-800/30 rounded-full w-20 h-20 mx-auto flex items-center justify-center text-slate-700">
                                            <Database size={40} />
                                        </div>
                                        <p className="text-slate-600 font-black uppercase text-[10px] tracking-[0.3em]">Ledger is empty for current filters</p>
                                    </div>
                                )}
                            </div>
                        </>
                    ) : (
                        <div className="space-y-3">
                            <div className="flex justify-between items-center mb-4">
                                <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">Active Middle Broker Ledger</h3>
                                <button onClick={() => setBrokerTxs(syncBroker.getTransactions())} className="text-xs text-indigo-400 flex items-center gap-1 font-bold">
                                    <RefreshCcw size={12} /> Refresh Broker
                                </button>
                            </div>
                            {brokerTxs.map(tx => (
                                <div key={tx.id} className="p-4 bg-slate-800/40 border border-slate-800 rounded-2xl flex justify-between items-center text-xs">
                                    <div>
                                        <span className="font-black text-white">{formatSafeValue(tx.action)} • {formatSafeValue(tx.sourceModule)} → {formatSafeValue(tx.targetModule)}</span>
                                        <p className="text-[10px] text-slate-500 font-mono mt-0.5">TX ID: {formatSafeValue(tx.id)} • {new Date(tx.timestamp).toLocaleString()}</p>
                                    </div>
                                    <span className="px-2.5 py-1 bg-indigo-600/20 text-indigo-400 rounded-lg text-[9px] font-black uppercase">{formatSafeValue(tx.status)}</span>
                                </div>
                            ))}
                            {brokerTxs.length === 0 && (
                                <p className="text-center py-12 text-slate-500 font-bold text-xs">No active broker operations currently queued.</p>
                            )}
                        </div>
                    )}
                </div>

                {/* Map location inspector modal */}
                {mapLocation && (
                    <MapModal lat={mapLocation.lat} lng={mapLocation.lng} onClose={() => setMapLocation(null)} />
                )}

                {/* Side-by-Side Diff Modal against Cloud Firestore */}
                {diffModalItem && (
                    <div className="fixed inset-0 bg-slate-950/90 z-[10000] flex items-center justify-center p-4 backdrop-blur-md" onClick={() => setDiffModalItem(null)}>
                        <div className="bg-slate-900 border border-slate-700 rounded-[32px] p-6 max-w-4xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
                            
                            <div className="flex justify-between items-center pb-4 border-b border-slate-800">
                                <div className="flex items-center gap-3">
                                    <div className="p-2.5 bg-indigo-600/20 text-indigo-400 rounded-xl">
                                        <GitCompare size={20} />
                                    </div>
                                    <div>
                                        <h3 className="text-lg font-black text-white">
                                            {isKa ? "ვერსიების შედარება (Local vs Cloud Diff)" : "Version Diff: Local Tablet vs Cloud Firestore"}
                                        </h3>
                                        <p className="text-xs text-slate-400 font-mono">
                                            Path: {diffModalItem.path} • ID: {diffModalItem.id}
                                        </p>
                                    </div>
                                </div>
                                <button onClick={() => setDiffModalItem(null)} className="p-2 text-slate-400 hover:text-white rounded-full bg-slate-800">
                                    ✕
                                </button>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 flex-1 overflow-y-auto p-4 my-2">
                                {/* Local Tablet State */}
                                <div className="bg-slate-950/80 rounded-2xl p-4 border border-indigo-500/40 flex flex-col">
                                    <div className="flex justify-between items-center pb-2 border-b border-slate-800 mb-3">
                                        <span className="text-xs font-black uppercase text-indigo-400 flex items-center gap-1.5">
                                            <HardDrive size={14} /> {isKa ? "ლოკალური ვერსია (ტაბლეტი)" : "Local Snapshot (Tablet)"}
                                        </span>
                                        <span className="text-[10px] text-slate-500 font-mono">{new Date(diffModalItem.timestamp).toLocaleTimeString()}</span>
                                    </div>
                                    <pre className="text-[11px] font-mono text-indigo-200 overflow-x-auto flex-1 whitespace-pre-wrap">
                                        {JSON.stringify(diffModalItem.data, null, 2)}
                                    </pre>
                                </div>

                                {/* Cloud Remote State */}
                                <div className="bg-slate-950/80 rounded-2xl p-4 border border-emerald-500/40 flex flex-col">
                                    <div className="flex justify-between items-center pb-2 border-b border-slate-800 mb-3">
                                        <span className="text-xs font-black uppercase text-emerald-400 flex items-center gap-1.5">
                                            <Globe size={14} /> {isKa ? "Cloud ვერსია (თბილისი / Firestore)" : "Cloud Snapshot (Firestore)"}
                                        </span>
                                        {isLoadingDiff && <RefreshCcw size={14} className="animate-spin text-emerald-400" />}
                                    </div>
                                    <pre className="text-[11px] font-mono text-emerald-200 overflow-x-auto flex-1 whitespace-pre-wrap">
                                        {isLoadingDiff ? (isKa ? "მიმდინარეობს Cloud მონაცემების ჩატვირთვა..." : "Querying Firestore document...") : JSON.stringify(cloudDocData, null, 2)}
                                    </pre>
                                </div>
                            </div>

                            <div className="pt-4 border-t border-slate-800 flex justify-between items-center">
                                <button
                                    onClick={() => handleDeleteEntry(diffModalItem.id)}
                                    className="px-4 py-2 bg-red-500/10 hover:bg-red-500 text-red-400 hover:text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all"
                                >
                                    {isKa ? "ლოკალურის წაშლა" : "Discard Local"}
                                </button>
                                
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => handleKeepInLocal(diffModalItem.id)}
                                        className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-black uppercase tracking-wider transition-all"
                                    >
                                        {isKa ? "ლოკალში შენარჩუნება" : "Keep Local"}
                                    </button>
                                    <button
                                        onClick={() => handlePushToCloud(diffModalItem.id)}
                                        className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-lg shadow-indigo-600/30 flex items-center gap-1.5 transition-all"
                                    >
                                        <CloudUpload size={14} />
                                        {isKa ? "Cloud-ზე გადაწერა / Push" : "Push to Cloud"}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </motion.div>
        </motion.div>
    );
};

export default DataStateAuditor;
