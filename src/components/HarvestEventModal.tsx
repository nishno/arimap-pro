
import React, { useState, useMemo, useRef, useEffect } from 'react';
import type { HarvestEvent, AreaPlantationFeature, PlantationFeature, Employee, InventoryItem, Role, PaymentModel, AssignedPicker, AssignedVehicle, EmployeeGroup, LinePlantationFeature, HarvestSaleDetails, MaterialUsed } from '../types';
import { XCircleIcon, PlusIcon, TrashIcon, TractorIcon, UsersIcon, CameraIcon, CheckIcon, CheckboxEmptyIcon, CheckboxCheckedIcon } from './Icons';
import { Search, MoreVertical, ArrowUpDown, Check, ScanLine, QrCode } from 'lucide-react';
import { PAYMENT_MODELS } from '../types';
import jsQR from 'jsqr';
import { useLanguage } from '../contexts/LanguageContext';
import { toast } from 'sonner';
import QrScannerModal from './QrScannerModal';
import { parseUniversalScan } from '../utils/universalScannerParser';
import { findMatchingEmployee } from '../utils/employeeMatching';

interface HarvestEventModalProps {
    event: HarvestEvent | null;
    onSave: (event: HarvestEvent) => void;
    onClose: () => void;
    sectors: AreaPlantationFeature[];
    plantationFeatures: PlantationFeature[];
    employees: Employee[];
    onSetEmployees: (employees: Employee[]) => void;
    roles: Role[];
    inventoryItems: InventoryItem[];
    employeeGroups?: EmployeeGroup[]; 
    onSetEmployeeGroups?: (groups: EmployeeGroup[]) => void;
    defaultStatus?: 'planned' | 'active' | 'paused' | 'completed' | 'deleted' | 'partially_sold';
}

const formatDateForInput = (val: any): string => {
    if (!val) return '';
    const str = String(val).trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;
    const d = new Date(str);
    if (isNaN(d.getTime())) return '';
    return d.toISOString().split('T')[0];
};

const HarvestEventModal: React.FC<HarvestEventModalProps> = ({ event, onSave, onClose, sectors, plantationFeatures, employees, roles, inventoryItems, employeeGroups = [], onSetEmployeeGroups, defaultStatus }) => {
    const { t, formatCurrency } = useLanguage();
    const [formState, setFormState] = useState<Omit<HarvestEvent, 'id'>>({
        name: event?.name || '',
        sectorId: event?.sectorId || '', 
        sectorIds: event?.sectorIds || (event?.sectorId ? [event.sectorId] : []),
        plannedStartDate: event?.plannedStartDate || new Date().toISOString().split('T')[0],
        status: event?.status || defaultStatus || 'planned',
        assignedPickers: event?.assignedPickers || [],
        assignedVehicles: event?.assignedVehicles || [],
        materialsUsed: event?.materialsUsed || [],
        type: event?.type || 'standard',
        defaultBoxWeightKg: event?.defaultBoxWeightKg || 5.8,
        totalBoxes: event?.totalBoxes || 0,
        totalPickerCost: event?.totalPickerCost || 0,
        totalNetWeightKg: event?.totalNetWeightKg || 0,
        totalPackagingCost: event?.totalPackagingCost || 0,
        totalPallets: event?.totalPallets || 0,
        totalVehicleCost: event?.totalVehicleCost || 0,
        boxUnitCost: event?.boxUnitCost ?? 0.8,
        punetUnitCost: event?.punetUnitCost ?? 0.135,
        hasPunets: event?.hasPunets ?? true,
        punetsPerBox: event?.punetsPerBox ?? 12,
        totalPunets: event?.totalPunets || ((event?.totalBoxes || 0) * (event?.punetsPerBox || 12)),
        trenchIds: event?.trenchIds || [],
        varieties: event?.varieties || [],
        breaks: event?.breaks || [],
        postHarvestAction: event?.postHarvestAction || (defaultStatus === 'completed' ? 'DIRECT_SALE' : undefined),
        saleDetails: event?.saleDetails || ((defaultStatus === 'completed' || event?.status === 'completed') ? { buyerName: '', pricePerUnit: 0, totalValue: 0, soldQuantity: 0, saleDate: new Date().toISOString().split('T')[0], saleMethod: 'personal', paymentMethod: 'cash' } : undefined),
        finalNetYieldKg: event?.finalNetYieldKg
    });
    
    // Bulk Add Team State
    const [selectedGroup, setSelectedGroup] = useState<string>('');
    const [bulkPaymentModel, setBulkPaymentModel] = useState<PaymentModel>('per_weight');
    const [bulkRate, setBulkRate] = useState<number>(0);
    const [selectedPickers, setSelectedPickers] = useState<Set<string>>(new Set());
    const [newTeamName, setNewTeamName] = useState<string>('');
    const [isUniversalScannerOpen, setIsUniversalScannerOpen] = useState(false);

    // Scanner State
    const [isScanning, setIsScanning] = useState(false);
    const videoRef = useRef<HTMLVideoElement>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const animationFrameRef = useRef<number | null>(null);
    const qrCanvasRef = useRef<HTMLCanvasElement | null>(null);
    const lastQrScanAttemptRef = useRef<number>(0);

    // Search queries for assigned and unassigned pickers
    const [assignedSearchQuery, setAssignedSearchQuery] = useState<string>('');
    const [singlePickerSearchQuery, setSinglePickerSearchQuery] = useState<string>('');

    // Sorting state for assigned pickers
    const [pickerSortBy, setPickerSortBy] = useState<'name' | 'reg_date' | 'role' | 'payment_model' | 'rate'>('name');
    const [pickerSortOrder, setPickerSortOrder] = useState<'asc' | 'desc'>('asc');
    const [isSortMenuOpen, setIsSortMenuOpen] = useState(false);

    // Sync assignedPickers if event updates
    useEffect(() => {
        if (event?.assignedPickers) {
            setFormState(prev => ({
                ...prev,
                assignedPickers: event.assignedPickers || []
            }));
        }
    }, [event?.assignedPickers]);

    const isKa = t('language') === 'ka' || localStorage.getItem('agri-app-lang') === 'ka';

    const machineryItems = (inventoryItems || []).filter(i => i.category === 'Machinery');

    // Filter all active employees for Harvest so workers added from Weight Station or HR are immediately available
    const harvestEmployees = useMemo(() => {
        const filtered = (employees || []).filter(e => e.status !== 'inactive');
        return [...filtered].sort((a, b) => a.name.localeCompare(b.name));
    }, [employees]);

    // Unassigned pickers available for "Add Single Picker"
    const unassignedPickers = useMemo(() => {
        return (harvestEmployees || []).filter(e => !formState.assignedPickers.some(p => p.employeeId === e.id));
    }, [harvestEmployees, formState.assignedPickers]);

    // Filtered assigned pickers matching search query & sorted by selected criteria
    const filteredAssignedPickers = useMemo(() => {
        let list = [...(formState.assignedPickers || [])];

        const query = assignedSearchQuery.trim().toLowerCase();
        if (query) {
            list = list.filter(ap => {
                const emp = employees.find(e => e.id === ap.employeeId);
                if (!emp) return false;
                const nameMatch = emp.name.toLowerCase().includes(query);
                const idMatch = emp.idNumber && emp.idNumber.toLowerCase().includes(query);
                const barcodeMatch = emp.barcode && emp.barcode.toLowerCase().includes(query);
                const codeMatch = emp.employeeCodeOverride && emp.employeeCodeOverride.toLowerCase().includes(query);
                const modelMatch = ap.paymentModel && ap.paymentModel.toLowerCase().includes(query);
                const roleMatch = ap.assignedRole && ap.assignedRole.toLowerCase().includes(query);
                return nameMatch || idMatch || barcodeMatch || codeMatch || modelMatch || roleMatch;
            });
        }

        return list.sort((apA, apB) => {
            const empA = employees.find(e => e.id === apA.employeeId);
            const empB = employees.find(e => e.id === apB.employeeId);

            let cmp = 0;
            if (pickerSortBy === 'reg_date') {
                const dateA = (empA as any)?.registrationDate || (empA as any)?.hireDate || (empA as any)?.joinedAt || (empA as any)?.createdAt || '';
                const dateB = (empB as any)?.registrationDate || (empB as any)?.hireDate || (empB as any)?.joinedAt || (empB as any)?.createdAt || '';
                cmp = dateA.localeCompare(dateB);
            } else if (pickerSortBy === 'role') {
                const roleA = apA.assignedRole || 'Picker';
                const roleB = apB.assignedRole || 'Picker';
                cmp = roleA.localeCompare(roleB);
            } else if (pickerSortBy === 'payment_model') {
                const modelA = apA.paymentModel || '';
                const modelB = apB.paymentModel || '';
                cmp = modelA.localeCompare(modelB);
            } else if (pickerSortBy === 'rate') {
                const rateA = Number(apA.rate) || 0;
                const rateB = Number(apB.rate) || 0;
                cmp = rateA - rateB;
            } else {
                const nameA = empA?.name || apA.employeeId || '';
                const nameB = empB?.name || apB.employeeId || '';
                cmp = nameA.localeCompare(nameB);
            }

            return pickerSortOrder === 'asc' ? cmp : -cmp;
        });
    }, [formState.assignedPickers, employees, assignedSearchQuery, pickerSortBy, pickerSortOrder]);

    const availableVarieties = useMemo(() => {
        const varietiesSet = new Set<string>();
        
        // Add varieties from selected sectors
        formState.sectorIds.forEach(id => {
            const sector = sectors.find(s => s.id === id);
            if (sector?.cropVariety) {
                if (Array.isArray(sector.cropVariety)) {
                    sector.cropVariety.forEach(v => varietiesSet.add(v));
                } else {
                    varietiesSet.add(sector.cropVariety);
                }
            }
        });

        // Also check all crops in the organization to provide a comprehensive list if needed
        plantationFeatures.forEach(f => {
            if (f.type === 'area' || f.type === 'sector') {
                const sector = f as AreaPlantationFeature;
                if (sector.cropVariety) {
                    if (Array.isArray(sector.cropVariety)) {
                        sector.cropVariety.forEach(v => varietiesSet.add(v));
                    } else {
                        varietiesSet.add(sector.cropVariety);
                    }
                }
            }
        });

        return Array.from(varietiesSet).sort();
    }, [formState.sectorIds, sectors, plantationFeatures]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormState(prev => ({ ...prev, [name]: value }));
    };
    
    const toggleSector = (id: string) => {
        setFormState(prev => {
            const current = prev.sectorIds || [];
            const newIds = current.includes(id) ? current.filter(sid => sid !== id) : [...current, id];
            return { ...prev, sectorIds: newIds };
        });
    };

    const handleVarietyToggle = (variety: string) => {
        setFormState(prev => {
            const current = prev.varieties || [];
            const newVarieties = current.includes(variety) ? current.filter(v => v !== variety) : [...current, variety];
            return { ...prev, varieties: newVarieties };
        });
    };

    const handleSaleDetailsChange = (field: keyof HarvestSaleDetails, value: any) => {
        setFormState(prev => {
            // FIX: Added missing paymentMethod property to default saleDetails object.
            const currentDetails: HarvestSaleDetails = prev.saleDetails || { buyerName: '', pricePerUnit: 0, totalValue: 0, soldQuantity: 0, saleDate: '', saleMethod: 'personal', paymentMethod: 'cash' };
            const newDetails = { ...currentDetails, [field]: value };
            // Auto calc total
            if (field === 'pricePerUnit' || field === 'soldQuantity') {
                newDetails.totalValue = newDetails.pricePerUnit * newDetails.soldQuantity;
            }
            return { ...prev, saleDetails: newDetails };
        });
    };

    const handleAddPicker = (employeeId: string) => {
        const employee = harvestEmployees.find(e => e.id === employeeId);
        if (!employee) return;
        if (formState.assignedPickers.some(p => p.employeeId === employeeId)) {
            alert(`${employee.name} is already assigned.`);
            return;
        }
        const newPicker: AssignedPicker = {
            employeeId,
            paymentModel: (employee.paymentType as PaymentModel) || 'per_weight',
            rate: employee.paymentRate,
        };
        setFormState(prev => ({ ...prev, assignedPickers: [...prev.assignedPickers, newPicker] }));
    };

    const handleBulkAddTeam = () => {
        if (!selectedGroup) return;
        const group = employeeGroups.find(g => g.id === selectedGroup);
        if (!group) return;

        const newPickers = group.employeeIds
            .filter(empId => !formState.assignedPickers.some(p => p.employeeId === empId))
            .filter(empId => harvestEmployees.some(e => e.id === empId))
            .map(empId => ({
                employeeId: empId,
                paymentModel: bulkPaymentModel,
                rate: bulkRate,
            }));
        
        setFormState(prev => ({ ...prev, assignedPickers: [...prev.assignedPickers, ...newPickers] }));
        setSelectedGroup('');
    };
    
    const handlePickerChange = (index: number, field: keyof AssignedPicker, value: any) => {
        const newPickers = [...formState.assignedPickers];
        newPickers[index] = { ...newPickers[index], [field]: value };
        setFormState(prev => ({ ...prev, assignedPickers: newPickers }));
    };
    
    const removePicker = (index: number) => {
        setFormState(prev => ({ ...prev, assignedPickers: prev.assignedPickers.filter((_, i) => i !== index) }));
    };

    const handleAddVehicle = () => {
        const newVehicle: AssignedVehicle = {
            id: `veh-${Date.now()}`,
            name: 'New Vehicle',
            isOwned: true,
            hiredCost: 0,
            usageHours: 0
        };
        setFormState(prev => ({ ...prev, assignedVehicles: [...(prev.assignedVehicles || []), newVehicle] }));
    };

    const handleVehicleChange = (index: number, field: keyof AssignedVehicle, value: any) => {
        const newVehicles = [...(formState.assignedVehicles || [])];
        newVehicles[index] = { ...newVehicles[index], [field]: value };
        setFormState(prev => ({ ...prev, assignedVehicles: newVehicles }));
    };

    const removeVehicle = (index: number) => {
        setFormState(prev => ({ ...prev, assignedVehicles: (prev.assignedVehicles || []).filter((_, i) => i !== index) }));
    };

    const handleAddMaterial = () => {
        setFormState(p => ({ ...p, materialsUsed: [...(p.materialsUsed || []), { inventoryItemId: '', quantity: 0 }] }));
    };

    const handleMaterialChange = (index: number, field: keyof MaterialUsed, value: string | number) => {
        const list = [...(formState.materialsUsed || [])];
        (list[index] as any)[field] = value;
        setFormState(p => ({ ...p, materialsUsed: list }));
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const finalSectorIds = formState.sectorIds.length > 0 ? formState.sectorIds : [formState.sectorId].filter(Boolean);
        const cleanedPickers = (formState.assignedPickers || []).map(p => ({
            ...p,
            rate: (p.rate as any) === '' ? 0 : Number(p.rate) || 0
        }));
        onSave({ 
            id: event?.id || '', 
            ...formState, 
            assignedPickers: cleanedPickers,
            sectorIds: finalSectorIds,
            sectorId: finalSectorIds[0] || '',
            varieties: availableVarieties
        });
    };

    const stopScanner = () => {
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop());
            streamRef.current = null;
        }
        if (animationFrameRef.current) {
            cancelAnimationFrame(animationFrameRef.current);
            animationFrameRef.current = null;
        }
        setIsScanning(false);
    };

    const handleScanLoop = () => {
        if (!videoRef.current || videoRef.current.readyState !== videoRef.current.HAVE_ENOUGH_DATA) {
            animationFrameRef.current = requestAnimationFrame(handleScanLoop);
            return;
        }

        const now = Date.now();
        // Throttle QR decoding attempts to once per 200ms (5 FPS) instead of 60 FPS
        if (now - lastQrScanAttemptRef.current >= 200) {
            lastQrScanAttemptRef.current = now;

            const video = videoRef.current;
            if (!qrCanvasRef.current) {
                qrCanvasRef.current = document.createElement('canvas');
            }
            const canvas = qrCanvasRef.current;

            // Downscale to max 480px width/height to limit pixel processing area
            const maxDimension = 480;
            let scanWidth = video.videoWidth || 640;
            let scanHeight = video.videoHeight || 480;
            if (scanWidth > maxDimension) {
                const ratio = maxDimension / scanWidth;
                scanWidth = maxDimension;
                scanHeight = Math.round(video.videoHeight * ratio);
            }

            if (canvas.width !== scanWidth || canvas.height !== scanHeight) {
                canvas.width = scanWidth;
                canvas.height = scanHeight;
            }

            const ctx = canvas.getContext('2d');
            if (ctx) {
                ctx.drawImage(video, 0, 0, scanWidth, scanHeight);
                const imageData = ctx.getImageData(0, 0, scanWidth, scanHeight);
                const code = jsQR(imageData.data, imageData.width, imageData.height, {
                    inversionAttempts: "dontInvert",
                });

                if (code && code.data) {
                    handleScanCapture(code.data);
                    return;
                }
            }
        }
        animationFrameRef.current = requestAnimationFrame(handleScanLoop);
    };

    const startScanner = async () => {
        try {
            setIsScanning(true);
            if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
                throw new Error("Secure Context Required: Browsers block camera access on insecure HTTP local connections. Access via HTTPS or localhost to enable, or adjust browser flags.");
            }
            let stream: MediaStream;
            try {
                stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
            } catch (e) {
                console.warn("Retrying camera with default constraints...");
                stream = await navigator.mediaDevices.getUserMedia({ video: true });
            }
            streamRef.current = stream;
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
                videoRef.current.onloadedmetadata = () => {
                    videoRef.current!.play().catch(playErr => {
                        console.error("Video play failed in HarvestEventModal:", playErr);
                    });
                    handleScanLoop();
                };
            }
        } catch (err) {
            console.error("Camera access denied:", err);
            setIsScanning(false);
            const errorMsg = err instanceof Error ? err.message : String(err);
            toast.error("Camera Access Failed", {
                description: errorMsg.includes("Secure Context") 
                    ? `${errorMsg} (Tip: In Chrome on your tablet, go to chrome://flags/#unsafely-treat-insecure-origin-as-secure, add "http://${window.location.hostname}:${window.location.port || '3000'}" and enable it to bypass this block!)`
                    : `${errorMsg}. If you are in an iframe, try opening the app in a new tab.`,
                duration: 12000,
            });
        }
    };

    useEffect(() => {
        return () => stopScanner();
    }, []);

    const handleScanCapture = (rawData: string) => {
        let scannedId = rawData;
        try {
            const parsed = JSON.parse(rawData);
            if (parsed && parsed.id) scannedId = parsed.id;
        } catch (e) { }

        const employee = harvestEmployees.find(e => e.barcode === scannedId || e.idNumber === scannedId);
        
        if (employee) {
            stopScanner();
            if (!formState.assignedPickers.some(p => p.employeeId === employee.id)) {
                handleAddPicker(employee.id);
                setTimeout(() => alert(`Success! Added: ${employee.name}`), 100);
            } else {
                setTimeout(() => alert(`${employee.name} is already on the list.`), 100);
            }
        } 
    };

    return (
        <>
            <div className="fixed inset-0 bg-white md:bg-black/50 z-[5000] flex items-center justify-center md:p-4" onClick={onClose}>
                <div className="bg-white w-full h-full md:h-auto md:rounded-lg md:shadow-xl md:max-w-5xl flex flex-col" onClick={e => e.stopPropagation()}>
                <div className="p-4 border-b flex justify-between items-center flex-shrink-0">
                    <h2 className="text-lg font-bold text-gray-800">{event ? t('harvest.edit_event') : t('harvest.new_event')}</h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><XCircleIcon className="h-6 w-6" /></button>
                </div>
                
                {isScanning ? (
                    <div className="flex-grow flex flex-col bg-black relative">
                        <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover"/>
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                            <div className="w-64 h-64 border-2 border-green-500 rounded-lg bg-transparent opacity-70 animate-pulse"></div>
                        </div>
                        <div className="absolute bottom-8 left-0 right-0 flex flex-col justify-center items-center gap-4 z-50">
                            <label className="bg-green-600 text-white px-6 py-2 rounded-full font-bold shadow-lg cursor-pointer flex items-center gap-2">
                                <CameraIcon className="h-4 w-4" /> Take Photo Instead
                                <input type="file" accept="image/*" capture="environment" className="hidden" onChange={async (e) => {
                                    const file = e.target.files?.[0];
                                    if (file) {
                                        try {
                                            const { processQrImageFile } = await import('../utils/qrFileScanner');
                                            const result = await processQrImageFile(file);
                                            handleScanCapture(result);
                                            toast.success("QR read from photo.");
                                        } catch (err: any) {
                                            toast.error(err.message || 'Failed to read QR');
                                        }
                                    }
                                }}/>
                            </label>
                            <button type="button" onClick={stopScanner} className="bg-white text-black px-6 py-2 rounded-full font-bold shadow-lg">Cancel Scan</button>
                        </div>
                    </div>
                ) : (
                <form onSubmit={handleSubmit} className="flex-grow flex flex-col overflow-hidden">
                    <div className="p-6 flex-grow overflow-y-auto grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-4">
                            {(event?.status === 'completed' || formState.status === 'completed') && (
                                <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg mb-4">
                                    <h3 className="font-bold text-blue-800 mb-2">Post-Harvest / Sale Details</h3>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="text-xs font-semibold text-gray-600">Buyer Name / Option</label>
                                            <input 
                                                className="input-field text-sm font-bold text-slate-800 bg-white" 
                                                value={formState.saleDetails?.buyerName || ''} 
                                                onChange={e => handleSaleDetailsChange('buyerName', e.target.value)} 
                                                list="buyer-suggestions"
                                                placeholder="Type or select..."
                                            />
                                            <datalist id="buyer-suggestions">
                                                <option value="Saved to Stock" />
                                                <option value="Consignment" />
                                                <option value="Transfer" />
                                                <option value="Export" />
                                                <option value="საწყობში შენახვა" />
                                                <option value="კონსიგნაცია" />
                                                <option value="გადაცემა" />
                                                <option value="ექსპორტი" />
                                            </datalist>
                                        </div>
                                        <div>
                                            <label className="text-xs font-semibold text-gray-600">Sale Date</label>
                                            <input type="date" className="input-field text-sm" value={formatDateForInput(formState.saleDetails?.saleDate)} onChange={e => handleSaleDetailsChange('saleDate', e.target.value)} />
                                        </div>
                                        <div>
                                            <label className="text-xs font-semibold text-gray-600">Sold Qty</label>
                                            <input type="number" className="input-field text-sm" value={formState.saleDetails?.soldQuantity || 0} onChange={e => handleSaleDetailsChange('soldQuantity', parseFloat(e.target.value))} />
                                        </div>
                                        <div>
                                            <label className="text-xs font-semibold text-gray-600">Price/Unit</label>
                                            <input type="number" className="input-field text-sm" value={formState.saleDetails?.pricePerUnit || 0} onChange={e => handleSaleDetailsChange('pricePerUnit', parseFloat(e.target.value))} />
                                        </div>
                                    </div>
                                    <div className="mt-2 text-right font-bold text-green-700">Total Value: {formatCurrency(formState.saleDetails?.totalValue || 0)}</div>
                                </div>
                            )}

                            <div>
                                <label className="text-sm font-medium">{t('harvest.event_name')}</label>
                                <input name="name" value={formState.name} onChange={handleChange} className="input-field mt-1" required />
                            </div>

                            <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                                <label className="text-sm font-bold block mb-2">{t('harvest.method')}</label>
                                <div className="flex gap-4">
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input type="radio" name="type" value="standard" checked={formState.type === 'standard'} onChange={() => setFormState(p => ({...p, type: 'standard'}))} className="h-4 w-4 text-green-600 focus:ring-green-500" />
                                        <span className="text-sm font-medium">Standard (Daily/Manual)</span>
                                    </label>
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input type="radio" name="type" value="box_counting" checked={formState.type === 'box_counting'} onChange={() => setFormState(p => ({...p, type: 'box_counting', defaultBoxWeightKg: 5.8}))} className="h-4 w-4 text-green-600 focus:ring-green-500" />
                                        <span className="text-sm font-medium">Box Counting (Automatic)</span>
                                    </label>
                                </div>
                                {formState.type === 'box_counting' && (
                                    <div className="mt-4 animate-in fade-in slide-in-from-top-1">
                                        <label className="text-xs font-black text-gray-500 uppercase tracking-widest block mb-1">Default Weight per Box (kg)</label>
                                        <div className="flex items-center gap-2">
                                            <input type="number" step="0.01" value={formState.defaultBoxWeightKg} onChange={e => setFormState(p => ({...p, defaultBoxWeightKg: parseFloat(e.target.value) || 0}))} className="input-field w-32" />
                                            <span className="text-xs text-gray-400 italic">Net weight will be calculated automatically upon box scan.</span>
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div>
                                <label className="text-sm font-medium mb-2 block">{t('harvest.sectors')}</label>
                                <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto border p-2 rounded bg-gray-50">
                                    {(sectors || []).map(s => {
                                        const isSelected = formState.sectorIds.includes(s.id);
                                        return (
                                            <div key={s.id} onClick={() => toggleSector(s.id)} className={`p-2 rounded border cursor-pointer flex items-center gap-2 text-xs transition-colors ${isSelected ? 'bg-green-50 border-green-300' : 'bg-white border-gray-200 hover:bg-gray-100'}`}>
                                                {isSelected ? <CheckboxCheckedIcon className="h-4 w-4 text-green-600 flex-shrink-0" /> : <CheckboxEmptyIcon className="h-4 w-4 text-gray-400 flex-shrink-0" />}
                                                <span className={`truncate font-medium ${isSelected ? 'text-green-800' : 'text-gray-700'}`}>{s.name}</span>
                                            </div>
                                        );
                                    })}
                                    {sectors.length === 0 && <p className="text-xs text-gray-500 italic col-span-2">No areas defined.</p>}
                                </div>
                            </div>
                            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                                <label className="text-[10px] font-black text-slate-800 uppercase tracking-widest block mb-2">{t('harvest.sectors')}</label>
                                <div className="text-[10px] text-slate-500 font-medium italic">
                                    {t('harvest.selected_sectors_info')}
                                </div>
                            </div>
                            <div>
                                <label className="text-sm font-medium">{t('harvest.planned_date')}</label>
                                <input name="plannedStartDate" type="date" value={formatDateForInput(formState.plannedStartDate)} onChange={handleChange} className="input-field mt-1" required />
                            </div>
                            
                            <div className="border-t pt-4">
                                <div className="flex justify-between items-center mb-2">
                                    <h4 className="font-semibold text-gray-700">{t('harvest.assigned_vehicles')}</h4>
                                    <button type="button" onClick={handleAddVehicle} className="text-sm text-blue-600 hover:underline flex items-center gap-1"><PlusIcon className="h-4 w-4"/> {t('common.add')}</button>
                                </div>
                                <div className="space-y-2 max-h-40 overflow-y-auto">
                                    {(formState.assignedVehicles || []).map((v, index) => (
                                        <div key={index} className="p-2 bg-gray-50 rounded border text-sm space-y-2">
                                            <div className="flex gap-2">
                                                <input value={v.name} onChange={e => handleVehicleChange(index, 'name', e.target.value)} className="input-field flex-grow" placeholder={t('harvest.vehicle_name')} />
                                                <button type="button" onClick={() => removeVehicle(index)} className="text-red-500 hover:text-red-700"><TrashIcon className="h-5 w-5"/></button>
                                            </div>
                                            <div className="flex gap-4 items-center flex-wrap">
                                                <label className="flex items-center gap-1"><input type="checkbox" checked={v.isOwned} onChange={e => handleVehicleChange(index, 'isOwned', e.target.checked)} /> {t('harvest.is_owned')}</label>
                                                <div className="flex items-center gap-1"><span className="text-xs">Cost/Hr:</span><input type="number" value={v.hiredCost} onChange={e => handleVehicleChange(index, 'hiredCost', parseFloat(e.target.value) || 0)} className="input-field w-20" placeholder={formatCurrency(0)} /></div>
                                                <div className="flex items-center gap-1"><span className="text-xs">Hours:</span><input type="number" value={v.usageHours} onChange={e => handleVehicleChange(index, 'usageHours', parseFloat(e.target.value) || 0)} className="input-field w-20" placeholder="0.0" /></div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        <div className="space-y-4">
                            {/* Bulk Add Team Section */}
                            <div className="bg-green-50 p-3 rounded-md border border-green-200 space-y-2">
                                <h4 className="font-semibold text-green-800 text-sm flex items-center gap-2"><UsersIcon className="h-4 w-4"/> {t('harvest.bulk_add')} (Loaded: {employeeGroups.length})</h4>
                                <div className="grid grid-cols-2 gap-2">
                                    <select className="input-field text-xs" value={selectedGroup} onChange={e => {
                                        console.log('Selected group:', e.target.value);
                                        setSelectedGroup(e.target.value);
                                    }}>
                                        <option value="">{t('harvest.select_group')}</option>
                                        {employeeGroups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                                    </select>
                                    <select className="input-field text-xs" value={bulkPaymentModel} onChange={e => setBulkPaymentModel(e.target.value as PaymentModel)}>
                                        {PAYMENT_MODELS.map(m => <option key={m} value={m} className="capitalize">{m.replace('_', ' ')}</option>)}
                                    </select>
                                </div>
                                <div className="flex gap-2">
                                    <input type="number" className="input-field text-xs flex-grow" placeholder="Rate" value={bulkRate || ''} onChange={e => setBulkRate(parseFloat(e.target.value))} />
                                    <button type="button" onClick={handleBulkAddTeam} className="px-3 py-1 bg-green-600 text-white text-xs font-bold rounded hover:bg-green-700 disabled:bg-gray-400" disabled={!selectedGroup}>
                                        {t('harvest.add_team')}
                                    </button>
                                </div>
                            </div>

                            <div className="flex flex-wrap justify-between items-center gap-2">
                                <h4 className="font-semibold text-gray-700">{t('harvest.assigned_pickers')} ({formState.assignedPickers.length})</h4>
                                <div className="flex items-center gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setIsUniversalScannerOpen(true)}
                                        className="py-1.5 px-3 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
                                        title={isKa ? "მუშაკის ID ბარათის ან QR-ის სკანირება სიაში დასამატებლად" : "Scan Worker ID badge or Harvest QR to drop worker in list"}
                                    >
                                        <ScanLine size={13} className="text-emerald-400" />
                                        <span>{isKa ? 'QR სკანერი (მუშები / მასალები)' : 'Scan Workers / Materials'}</span>
                                    </button>
                                    <label className="text-xs text-slate-500 hover:text-slate-700 cursor-pointer flex items-center gap-1 border border-slate-200 px-2 py-1.5 rounded-xl bg-slate-50">
                                        <CameraIcon className="h-3 w-3" /> +Photo
                                        <input type="file" accept="image/*" capture="environment" className="hidden" onChange={async (e) => {
                                            const file = e.target.files?.[0];
                                            if (file) {
                                                try {
                                                    const { processQrImageFile } = await import('../utils/qrFileScanner');
                                                    const result = await processQrImageFile(file);
                                                    handleScanCapture(result);
                                                    toast.success("QR read from photo.");
                                                } catch (err: any) {
                                                    toast.error(err.message || 'Failed to read QR');
                                                }
                                            }
                                        }}/>
                                    </label>
                                </div>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                <div className="relative">
                                    <input 
                                        type="text" 
                                        list="unassigned-pickers-datalist"
                                        placeholder={isKa ? '+ მუშაკის დამატება (სახელი ან ID)...' : '+ Add single picker (type name or ID)...'}
                                        value={singlePickerSearchQuery}
                                        onChange={(e) => {
                                            const val = e.target.value;
                                            setSinglePickerSearchQuery(val);
                                            const match = unassignedPickers.find(p => 
                                                p.id === val || 
                                                p.name.toLowerCase() === val.toLowerCase() ||
                                                (p.idNumber && p.idNumber === val) ||
                                                (p.barcode && p.barcode === val) ||
                                                (p.employeeCodeOverride && p.employeeCodeOverride === val)
                                            );
                                            if (match) {
                                                handleAddPicker(match.id);
                                                setSinglePickerSearchQuery('');
                                                toast.success(`Added: ${match.name}`);
                                            }
                                        }}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') {
                                                e.preventDefault();
                                                const q = singlePickerSearchQuery.trim().toLowerCase();
                                                if (!q) return;
                                                const match = unassignedPickers.find(p => 
                                                    p.name.toLowerCase().includes(q) ||
                                                    (p.idNumber && p.idNumber.toLowerCase().includes(q)) ||
                                                    (p.barcode && p.barcode.toLowerCase().includes(q)) ||
                                                    (p.employeeCodeOverride && p.employeeCodeOverride.toLowerCase().includes(q))
                                                );
                                                if (match) {
                                                    handleAddPicker(match.id);
                                                    setSinglePickerSearchQuery('');
                                                    toast.success(`Added: ${match.name}`);
                                                } else {
                                                    toast.error(isKa ? 'მუშაკი ვერ მოიძებნა' : 'Worker not found');
                                                }
                                            }
                                        }}
                                        className="input-field text-xs py-1.5 w-full"
                                    />
                                    <datalist id="unassigned-pickers-datalist">
                                        {unassignedPickers.map(e => (
                                            <option key={e.id} value={e.name}>
                                                {e.name} {e.idNumber ? `(ID: ${e.idNumber})` : e.employeeCodeOverride ? `(Code: ${e.employeeCodeOverride})` : ''}
                                            </option>
                                        ))}
                                    </datalist>
                                </div>
                                <select 
                                    className="input-field text-xs py-1.5" 
                                    onChange={(e) => { 
                                        if (e.target.value) { 
                                            handleAddPicker(e.target.value); 
                                            e.target.value = ''; 
                                        } 
                                    }}
                                >
                                    <option value="">{t('harvest.add_single_picker')} ({unassignedPickers.length})</option>
                                    {unassignedPickers.map(e => (
                                        <option key={e.id} value={e.id}>
                                            {e.name} {e.idNumber ? `[${e.idNumber}]` : ''}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center bg-slate-50 p-2 rounded-lg border border-slate-200 gap-2">
                                {formState.assignedPickers.length > 0 && (
                                    <label className="flex items-center gap-2 text-xs font-bold text-slate-700 cursor-pointer whitespace-nowrap">
                                        <input 
                                            type="checkbox" 
                                            checked={filteredAssignedPickers.length > 0 && selectedPickers.size === filteredAssignedPickers.length}
                                            onChange={(e) => {
                                                if (e.target.checked) {
                                                    setSelectedPickers(new Set(filteredAssignedPickers.map(p => p.employeeId)));
                                                } else {
                                                    setSelectedPickers(new Set());
                                                }
                                            }}
                                            className="rounded text-indigo-600 focus:ring-indigo-500 h-3.5 w-3.5 cursor-pointer"
                                        />
                                        <span>Select All ({filteredAssignedPickers.length})</span>
                                    </label>
                                )}

                                <div className="flex items-center gap-1.5 flex-grow max-w-xs">
                                    <div className="relative flex-grow">
                                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                                        <input 
                                            type="text" 
                                            placeholder={isKa ? 'ძებნა მუშაკის სახელით, ID-ით...' : 'Search worker in event...'}
                                            value={assignedSearchQuery}
                                            onChange={e => setAssignedSearchQuery(e.target.value)}
                                            className="w-full pl-8 pr-7 py-1 text-xs border border-slate-300 rounded-md bg-white focus:outline-none focus:ring-1 focus:ring-green-500"
                                        />
                                        {assignedSearchQuery && (
                                            <button 
                                                type="button" 
                                                onClick={() => setAssignedSearchQuery('')}
                                                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                                            >
                                                <XCircleIcon className="h-3.5 w-3.5" />
                                            </button>
                                        )}
                                    </div>

                                    {/* Three Dots Sort Menu Button */}
                                    <div className="relative flex-shrink-0">
                                        <button
                                            type="button"
                                            onClick={() => setIsSortMenuOpen(prev => !prev)}
                                            className={`p-1 bg-white hover:bg-slate-100 border rounded-md text-slate-700 transition-colors cursor-pointer flex items-center justify-center gap-1 ${
                                                pickerSortBy !== 'name' || pickerSortOrder !== 'asc'
                                                    ? 'border-indigo-400 bg-indigo-50 text-indigo-700 font-bold'
                                                    : 'border-slate-300'
                                            }`}
                                            title={isKa ? 'სორტირება' : 'Sort Workers'}
                                        >
                                            <MoreVertical className="h-4 w-4 text-slate-600" />
                                        </button>

                                        {isSortMenuOpen && (
                                            <>
                                                <div 
                                                    className="fixed inset-0 z-40" 
                                                    onClick={() => setIsSortMenuOpen(false)} 
                                                />
                                                <div className="absolute right-0 top-full mt-1.5 w-56 bg-white rounded-xl shadow-xl border border-slate-200 z-50 p-1.5 text-xs animate-fadeIn">
                                                    <div className="px-2.5 py-1 text-[10px] font-black uppercase text-slate-400 tracking-wider flex justify-between items-center border-b border-slate-100 pb-1 mb-1">
                                                        <span>{isKa ? 'სორტირება (3 DOTS)' : 'SORT WORKERS'}</span>
                                                        <button
                                                            type="button"
                                                            onClick={() => setPickerSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
                                                            className="text-indigo-600 hover:text-indigo-800 font-bold flex items-center gap-0.5 cursor-pointer text-[10px]"
                                                        >
                                                            <ArrowUpDown className="h-3 w-3" />
                                                            {pickerSortOrder === 'asc' ? 'Asc ↑' : 'Desc ↓'}
                                                        </button>
                                                    </div>

                                                    {[
                                                        { id: 'reg_date', label: isKa ? 'რეგისტრაციის თარიღი (Reg Date)' : 'Reg Date (Registration Date)' },
                                                        { id: 'role', label: isKa ? 'როლი (Event Role)' : 'Role' },
                                                        { id: 'payment_model', label: isKa ? 'ანაზღაურების ტიპი (Payment Model)' : 'Payment Model' },
                                                        { id: 'rate', label: isKa ? 'ტარიფი (Rate)' : 'Rate' },
                                                        { id: 'name', label: isKa ? 'სახელი / ანბანი' : 'Worker Name' }
                                                    ].map(opt => (
                                                        <button
                                                            key={opt.id}
                                                            type="button"
                                                            onClick={() => {
                                                                if (pickerSortBy === opt.id) {
                                                                    setPickerSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
                                                                } else {
                                                                    setPickerSortBy(opt.id as any);
                                                                }
                                                                setIsSortMenuOpen(false);
                                                            }}
                                                            className={`w-full text-left px-2.5 py-1.5 rounded-lg flex items-center justify-between font-medium cursor-pointer transition-colors ${
                                                                pickerSortBy === opt.id
                                                                    ? 'bg-indigo-50 text-indigo-700 font-bold'
                                                                    : 'text-slate-700 hover:bg-slate-100'
                                                            }`}
                                                        >
                                                            <span>{opt.label}</span>
                                                            {pickerSortBy === opt.id && <Check className="h-3.5 w-3.5 text-indigo-600 flex-shrink-0 ml-1" />}
                                                        </button>
                                                    ))}
                                                </div>
                                            </>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {selectedPickers.size > 0 && (
                                <div className="bg-indigo-50 border border-indigo-100 p-2.5 rounded-lg flex flex-col gap-2 animate-fadeIn text-xs">
                                    <div className="flex items-center justify-between">
                                        <span className="font-bold text-indigo-900">👥 {selectedPickers.size} selected</span>
                                        <button 
                                            type="button" 
                                            onClick={() => setSelectedPickers(new Set())} 
                                            className="text-slate-400 hover:text-slate-600 text-[10px] font-bold"
                                        >
                                            Clear Selection
                                        </button>
                                    </div>
                                    <div className="flex gap-2 items-center flex-wrap">
                                        <select 
                                            id="event-bulk-payment-model" 
                                            className="input-field text-xs p-1 flex-grow bg-white"
                                            defaultValue="per_weight"
                                        >
                                            <option value="per_weight">Per Weight</option>
                                            <option value="hourly">Hourly</option>
                                            <option value="daily">Daily</option>
                                            <option value="combined">Combined</option>
                                            <option value="salary">Salary</option>
                                        </select>
                                        <input 
                                            id="event-bulk-rate-input" 
                                            type="number" 
                                            step="0.01" 
                                            placeholder="Rate" 
                                            className="input-field text-xs p-1 w-20 bg-white"
                                        />
                                        <button 
                                            type="button"
                                            onClick={() => {
                                                const modelEl = document.getElementById('event-bulk-payment-model') as HTMLSelectElement;
                                                const rateEl = document.getElementById('event-bulk-rate-input') as HTMLInputElement;
                                                const newModel = modelEl.value as PaymentModel;
                                                const newRate = parseFloat(rateEl.value);

                                                const updated = formState.assignedPickers.map(p => {
                                                    if (selectedPickers.has(p.employeeId)) {
                                                        return {
                                                            ...p,
                                                            paymentModel: newModel,
                                                            rate: isNaN(newRate) ? p.rate : newRate
                                                        };
                                                    }
                                                    return p;
                                                });
                                                setFormState(prev => ({ ...prev, assignedPickers: updated }));
                                                setSelectedPickers(new Set());
                                                if (rateEl) rateEl.value = '';
                                                toast.success('Updated workers in bulk!');
                                            }}
                                            className="px-3 py-1 bg-indigo-600 text-white rounded font-bold hover:bg-indigo-700 transition-colors"
                                        >
                                            Apply
                                        </button>
                                    </div>
                                    <div className="border-t border-indigo-200/50 pt-2 flex gap-2 items-center flex-wrap">
                                        <input 
                                            type="text" 
                                            placeholder="Create Team from Selected..." 
                                            value={newTeamName}
                                            onChange={e => setNewTeamName(e.target.value)}
                                            className="input-field text-xs p-1 flex-grow bg-white"
                                        />
                                        <button 
                                            type="button"
                                            onClick={() => {
                                                const teamName = newTeamName.trim();
                                                if (!teamName) {
                                                    toast.error('Please enter a team name');
                                                    return;
                                                }
                                                if (onSetEmployeeGroups) {
                                                    const newGroup: EmployeeGroup = {
                                                        id: `group-${Date.now()}`,
                                                        organizationId: event?.organizationId || '',
                                                        name: teamName,
                                                        employeeIds: Array.from(selectedPickers)
                                                    };
                                                    onSetEmployeeGroups([...(employeeGroups || []), newGroup]);
                                                    toast.success(`Team "${teamName}" created successfully!`);
                                                    setNewTeamName('');
                                                    setSelectedPickers(new Set());
                                                } else {
                                                    toast.error('Unable to create team - missing handler');
                                                }
                                            }}
                                            className="px-3 py-1 bg-green-600 text-white rounded font-bold hover:bg-green-700 transition-colors"
                                        >
                                            Create Team
                                        </button>
                                    </div>
                                </div>
                            )}

                            <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                                {filteredAssignedPickers.length === 0 ? (
                                    <div className="text-center py-4 text-xs text-slate-400 italic bg-slate-50 rounded border border-slate-100">
                                        {formState.assignedPickers.length === 0 
                                            ? (isKa ? 'მუშაკები ჯერ არ არიან დამატებული' : 'No workers assigned yet')
                                            : (isKa ? 'შესაბამისი მუშაკი ვერ მოიძებნა' : 'No matching workers found')}
                                    </div>
                                ) : (
                                    filteredAssignedPickers.map((ap, pIdx) => {
                                        const employeeData = employees.find(e => e.id === ap.employeeId);
                                        const actualIndex = formState.assignedPickers.findIndex(p => p.employeeId === ap.employeeId);
                                        return (
                                            <div key={`${ap.employeeId || 'picker'}-${pIdx}`} className={`grid grid-cols-12 gap-2 items-center p-2 rounded border ${selectedPickers.has(ap.employeeId) ? 'bg-indigo-50/50 border-indigo-200' : 'bg-gray-50'}`}>
                                                <div className="col-span-1 flex items-center justify-center">
                                                    <input 
                                                        type="checkbox" 
                                                        checked={selectedPickers.has(ap.employeeId)}
                                                        onChange={() => {
                                                            const copy = new Set(selectedPickers);
                                                            if (copy.has(ap.employeeId)) {
                                                                copy.delete(ap.employeeId);
                                                            } else {
                                                                copy.add(ap.employeeId);
                                                            }
                                                            setSelectedPickers(copy);
                                                        }}
                                                        className="rounded text-indigo-600 focus:ring-indigo-500 h-3.5 w-3.5 cursor-pointer"
                                                    />
                                                </div>
                                                <div className="col-span-3">
                                                    <label className="text-[10px] text-gray-500">{t('weigh.picker')}</label>
                                                    <p className="font-semibold truncate text-sm" title={employeeData?.name}>{employeeData?.name}</p>
                                                </div>
                                                <div className="col-span-3">
                                                    <label className="text-[10px] text-indigo-700 font-bold">{isKa ? 'როლი ღონისძიებაში' : 'Event Role'}</label>
                                                    <select 
                                                        value={ap.assignedRole || (employeeData?.roleId ? (roles?.find(r => r.id === employeeData.roleId)?.name || employeeData.roleId) : 'Picker')} 
                                                        onChange={e => handlePickerChange(actualIndex, 'assignedRole' as any, e.target.value)} 
                                                        className="input-field text-xs p-1 bg-indigo-50/80 border-indigo-200 text-indigo-900 font-bold cursor-pointer"
                                                    >
                                                        {['Picker', 'Loader', 'Weigher', 'Keeper', 'Driver', 'Supervisor', 'Field Worker', 'Security', ...(roles || []).map(r => r.name)]
                                                            .filter((v, i, a) => v && a.indexOf(v) === i)
                                                            .map(rName => (
                                                                <option key={rName} value={rName}>{rName}</option>
                                                            ))
                                                        }
                                                    </select>
                                                </div>
                                                <div className="col-span-2">
                                                    <label className="text-[10px] text-gray-500">Model</label>
                                                    <select value={ap.paymentModel} onChange={e => handlePickerChange(actualIndex, 'paymentModel', e.target.value as PaymentModel)} className="input-field text-xs p-1">
                                                        {PAYMENT_MODELS.map(model => (
                                                            <option key={model} value={model} className="capitalize">{model.replace('_', ' ')}</option>
                                                        ))}
                                                    </select>
                                                </div>
                                                <div className="col-span-2">
                                                    <label className="text-[10px] text-gray-500">{t('emp.rate')}</label>
                                                    <input type="number" step="0.01" value={ap.rate} onChange={e => handlePickerChange(actualIndex, 'rate', e.target.value === '' ? '' : parseFloat(e.target.value))} className="input-field text-xs p-1"/>
                                                </div>
                                                <div className="col-span-1 flex justify-end">
                                                    <button type="button" onClick={() => removePicker(actualIndex)} className="text-red-500 hover:text-red-700 p-1"><TrashIcon className="h-4 w-4"/></button>
                                                </div>
                                            </div>
                                        );
                                    })
                                )}
                            </div>

                             <div className="border-t pt-4">
                                <div className="flex justify-between items-center mb-2">
                                    <h4 className="font-semibold text-gray-700">{t('harvest.materials_used')}</h4>
                                    <div className="flex items-center gap-2">
                                        <button 
                                            type="button" 
                                            onClick={() => setIsUniversalScannerOpen(true)} 
                                            className="text-xs text-emerald-600 hover:underline flex items-center gap-1 font-bold cursor-pointer"
                                        >
                                            <ScanLine className="h-3 w-3" /> {isKa ? 'მასალის QR სკანირება' : 'Scan Material QR'}
                                        </button>
                                        <button type="button" onClick={handleAddMaterial} className="text-xs text-blue-600 hover:underline flex items-center gap-1">
                                            <PlusIcon className="h-3 w-3"/> {t('work.add_material')}
                                        </button>
                                    </div>
                                </div>
                                <div className="space-y-2 max-h-40 overflow-y-auto">
                                    {(formState.materialsUsed || []).map((mu, idx) => (
                                        <div key={idx} className="flex gap-2 items-end">
                                            <div className="flex-grow">
                                                <select value={mu.inventoryItemId} onChange={e => handleMaterialChange(idx, 'inventoryItemId', e.target.value)} className="input-field text-xs" required>
                                                    <option value="">Select Item</option>
                                                    {inventoryItems.map(i => <option key={i.id} value={i.id}>{i.name} ({i.category})</option>)}
                                                </select>
                                            </div>
                                            <div className="w-24">
                                                <input type="number" step="0.01" value={mu.quantity} onChange={e => handleMaterialChange(idx, 'quantity', parseFloat(e.target.value) || 0)} className="input-field text-xs" placeholder="Qty" required />
                                            </div>
                                            <button type="button" onClick={() => setFormState(p => ({...p, materialsUsed: p.materialsUsed?.filter((_, i) => i !== idx)}))} className="p-2 text-red-500"><TrashIcon className="h-4 w-4"/></button>
                                        </div>
                                    ))}
                                    {(formState.materialsUsed || []).length === 0 && <p className="text-xs text-gray-400 italic">No materials added.</p>}
                                </div>
                            </div>


                        </div>
                    </div>
                    <div className="p-4 bg-gray-50 flex justify-end gap-3 flex-shrink-0">
                        <button type="button" onClick={onClose} className="button-secondary">{t('common.cancel')}</button>
                        <button type="submit" className="button-primary">{event ? t('common.save') : t('common.add')}</button>
                    </div>
                </form>
                )}
            </div>
            </div>

            {isUniversalScannerOpen && (
                <QrScannerModal
                    isOpen={isUniversalScannerOpen}
                    onClose={() => setIsUniversalScannerOpen(false)}
                    title={isKa ? "მოსავლის სკანერი (მუშები & მასალები)" : "Harvest Event Scanner (Workers & Materials)"}
                    description={isKa ? "დაასკანერეთ მუშაკის ID ბარათი, ყუთის QR ან მასალის კოდი" : "Scan Worker ID badge, Crate QR or Material barcode"}
                    mockEmployees={employees}
                    mockItems={inventoryItems}
                    onScan={(scannedCode, cat, parsedData) => {
                        const code = String(scannedCode).trim();
                        const parsed = parsedData || parseUniversalScan(code, employees, inventoryItems, 'auto');

                        // 1. Worker Detection
                        if (parsed.detectedType === 'worker' || parsed.employee) {
                            const emp = parsed.employee || findMatchingEmployee(employees, code) || employees.find(e => e.id === code || e.barcode === code || e.idNumber === code);
                            if (emp) {
                                if (!formState.assignedPickers.some(p => p.employeeId === emp.id)) {
                                    handleAddPicker(emp.id);
                                    toast.success(isKa ? `✓ მუშა დაემატა: ${emp.name}` : `✓ Worker added: ${emp.name}`);
                                } else {
                                    toast.info(isKa ? `${emp.name} უკვე სიაშია` : `${emp.name} is already assigned`);
                                }
                                return;
                            }
                        }

                        // 2. Harvest Box QR (with mapped worker)
                        if (parsed.detectedType === 'harvest_box' && parsed.harvestBox) {
                            const workerId = parsed.harvestBox.pickerId;
                            if (workerId) {
                                const emp = employees.find(e => e.id === workerId);
                                if (emp && !formState.assignedPickers.some(p => p.employeeId === emp.id)) {
                                    handleAddPicker(emp.id);
                                    toast.success(isKa ? `✓ ყუთიდან დაემატა მუშა: ${emp.name}` : `✓ Worker added from box QR: ${emp.name}`);
                                    return;
                                }
                            }
                        }

                        // 3. Material Detection
                        if (parsed.detectedType === 'material' || parsed.material) {
                            const mat = parsed.material?.item || inventoryItems.find(i => 
                                i.id === code || (i as any).sku === code || (i as any).barcode === code
                            );
                            if (mat) {
                                const qty = parsed.material?.quantity || 1;
                                const existingIndex = (formState.materialsUsed || []).findIndex(m => m.inventoryItemId === mat.id);
                                if (existingIndex >= 0) {
                                    const updated = [...(formState.materialsUsed || [])];
                                    updated[existingIndex].quantity = (Number(updated[existingIndex].quantity) || 0) + qty;
                                    setFormState(p => ({ ...p, materialsUsed: updated }));
                                    toast.success(isKa ? `✓ +${qty} ${mat.name} დაემატა!` : `✓ +${qty} ${mat.name} added!`);
                                } else {
                                    const newMat = { inventoryItemId: mat.id, quantity: qty };
                                    setFormState(p => ({ ...p, materialsUsed: [...(p.materialsUsed || []), newMat] }));
                                    toast.success(isKa ? `✓ ${mat.name} (${qty}) დაემატა მასალებში!` : `✓ Added ${mat.name} (${qty}) to materials!`);
                                }
                                return;
                            }
                        }

                        // Fallback check on employee lookup
                        const fallbackEmp = employees.find(e => 
                            e.id === code || e.barcode === code || e.idNumber === code || e.name.toLowerCase().includes(code.toLowerCase())
                        );
                        if (fallbackEmp) {
                            if (!formState.assignedPickers.some(p => p.employeeId === fallbackEmp.id)) {
                                handleAddPicker(fallbackEmp.id);
                                toast.success(isKa ? `✓ დაემატა: ${fallbackEmp.name}` : `✓ Added: ${fallbackEmp.name}`);
                            } else {
                                toast.info(isKa ? `${fallbackEmp.name} უკვე სიაშია` : `${fallbackEmp.name} already in list`);
                            }
                            return;
                        }

                        toast.warning(isKa ? `კოდი ვერ მოიძებნა: ${code}` : `Unrecognized code: ${code}`);
                    }}
                />
            )}
             <style>{`
                .input-field { width: 100%; padding: 0.5rem; border: 1px solid #d1d5db; border-radius: 0.375rem; background-color: white; }
                .button-primary { padding: 0.5rem 1rem; background-color: #16a34a; color: white; border-radius: 0.375rem; font-weight: 600; }
                .button-secondary { padding: 0.5rem 1rem; background-color: #e5e7eb; color: #1f2937; border-radius: 0.375rem; font-weight: 600; }
            `}</style>
        </>
    );
};

export default HarvestEventModal;
