import React, { useState, useEffect, useRef } from 'react';
import { 
  Sparkles, Leaf, FileText, History, Stethoscope, AlertTriangle, 
  CheckCircle2, Plus, Search, ChevronRight, Calendar, User, FlaskConical, 
  Database, RefreshCw, X, ArrowUpRight, Upload, Eye, Cpu, BookOpen, Layers
} from 'lucide-react';
import { 
  clinicalAnalysisService, 
  SavedAgroAnalysisRecord, 
  AgronomistPrescriptionConclusion,
  PeerComparisonData
} from '../services/clinicalAnalysisService';
import { 
  analyzePlantDisease, 
  analyzeAgriImage, 
  generateDocumentComparison 
} from '../services/geminiService';
import { useLanguage } from '../contexts/LanguageContext';
import { toast } from 'sonner';

interface AiAnalysisSuiteProps {
  mode?: 'compact' | 'full';
  activeOrgId?: string;
  currentUser?: any;
  onClose?: () => void;
  onAddTask?: (task: any) => void;
  onAddNutritionPlan?: (plan: any) => void;
  initialTool?: 'disease' | 'document' | 'agro_image' | 'history';
}

const fileToText = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = error => reject(error);
    reader.readAsDataURL(file);
  });
};

export const AiAnalysisSuite: React.FC<AiAnalysisSuiteProps> = ({
  mode = 'compact',
  activeOrgId,
  currentUser,
  onClose,
  onAddTask,
  onAddNutritionPlan,
  initialTool = 'disease'
}) => {
  const { language } = useLanguage();
  const isKa = language === 'ka';

  const [activeTab, setActiveTab] = useState<'disease' | 'document' | 'agro_image' | 'history'>(initialTool);
  const [savedRecords, setSavedRecords] = useState<SavedAgroAnalysisRecord[]>([]);
  const [selectedRecord, setSelectedRecord] = useState<SavedAgroAnalysisRecord | null>(null);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [searchFilter, setSearchFilter] = useState('');

  // Plant Disease Tool State
  const [plantImageFile, setPlantImageFile] = useState<File | null>(null);
  const [plantImageDataUrl, setPlantImageDataUrl] = useState<string>('');
  const [isAnalyzingDisease, setIsAnalyzingDisease] = useState(false);
  const [activeDiseaseResult, setActiveDiseaseResult] = useState<any | null>(null);

  // Document Comparison Tool State
  const [uploadedDocs, setUploadedDocs] = useState<{ id: string; fileName: string; content: string }[]>([]);
  const [isAnalyzingDocs, setIsAnalyzingDocs] = useState(false);
  const [docAnalysisSummary, setDocAnalysisSummary] = useState<string>('');

  // Agro Vision / General Image Tool State
  const [agroImageFile, setAgroImageFile] = useState<File | null>(null);
  const [agroImageDataUrl, setAgroImageDataUrl] = useState<string>('');
  const [isAnalyzingAgroImage, setIsAnalyzingAgroImage] = useState(false);
  const [activeAgroImageResult, setActiveAgroImageResult] = useState<any | null>(null);

  // Agronomist Conclusion Form State
  const [conclusionNotes, setConclusionNotes] = useState('');
  const [conclusionSeverity, setConclusionSeverity] = useState<'Mild' | 'Moderate' | 'Severe' | 'Critical'>('Moderate');
  const [prescribedTreatment, setPrescribedTreatment] = useState('');
  const [activeIngredients, setActiveIngredients] = useState<string[]>([]);
  const [recommendedDosage, setRecommendedDosage] = useState('');
  const [prescribedNutrition, setPrescribedNutrition] = useState('');
  const [preventiveMeasures, setPreventiveMeasures] = useState('');
  const [targetSector, setTargetSector] = useState('Sector A');
  const [isSavingConclusion, setIsSavingConclusion] = useState(false);
  const [showPeerComparisonModal, setShowPeerComparisonModal] = useState(false);
  const [peerComparisonData, setPeerComparisonData] = useState<PeerComparisonData | null>(null);

  const plantInputRef = useRef<HTMLInputElement>(null);
  const docInputRef = useRef<HTMLInputElement>(null);
  const agroImageInputRef = useRef<HTMLInputElement>(null);

  // Load Saved Analyses on Mount
  const loadHistory = async () => {
    setIsLoadingHistory(true);
    try {
      const records = await clinicalAnalysisService.getSavedAnalyses(activeOrgId);
      setSavedRecords(records);
      if (records.length > 0 && !selectedRecord) {
        setSelectedRecord(records[0]);
      }
    } catch (e) {
      console.warn('Failed to load clinical records:', e);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  useEffect(() => {
    loadHistory();
  }, [activeOrgId]);

  useEffect(() => {
    if (initialTool) {
      setActiveTab(initialTool);
    }
  }, [initialTool]);

  // When selecting a record from history, populate the agronomist conclusion fields
  useEffect(() => {
    if (selectedRecord) {
      if (selectedRecord.agronomistConclusion) {
        const c = selectedRecord.agronomistConclusion;
        setConclusionNotes(c.notes || '');
        setConclusionSeverity(c.severity || 'Moderate');
        setPrescribedTreatment(c.prescribedTreatment || '');
        setActiveIngredients(c.activeIngredients || []);
        setRecommendedDosage(c.recommendedDosage || '');
        setPrescribedNutrition(c.prescribedNutrition || '');
        setPreventiveMeasures(c.preventiveMeasures || '');
        setTargetSector(c.targetSectorOrPlot || 'Sector A');
      } else {
        // Default initial prefill based on raw AI result
        setConclusionNotes(selectedRecord.rawAiResult?.description || '');
        setConclusionSeverity('Moderate');
        setPrescribedTreatment(
          Array.isArray(selectedRecord.rawAiResult?.treatmentSuggestions)
            ? selectedRecord.rawAiResult.treatmentSuggestions.join('. ')
            : ''
        );
        setActiveIngredients([]);
        setRecommendedDosage('2.0 - 2.5 kg/ha');
        setPrescribedNutrition('Foliar Silicon (Si-K) & Amino Acid Biostimulant');
        setPreventiveMeasures('Canopy ventilation & 5-day monitoring cycle');
        setTargetSector('Sector A');
      }

      if (selectedRecord.peerComparison) {
        setPeerComparisonData(selectedRecord.peerComparison);
      }
    }
  }, [selectedRecord]);

  // --- Handlers for Plant Disease Diagnostic ---
  const handlePlantImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPlantImageFile(file);
    const reader = new FileReader();
    reader.onload = (ev) => {
      if (ev.target?.result) {
        setPlantImageDataUrl(ev.target.result as string);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleRunPlantDiseaseAnalysis = async () => {
    if (!plantImageFile && !plantImageDataUrl) {
      toast.error(isKa ? 'გთხოვთ ატვირთოთ ფოთლის ან მცენარის ფოტო' : 'Please upload a plant/leaf image');
      return;
    }

    setIsAnalyzingDisease(true);
    try {
      const base64Data = plantImageDataUrl.split(',')[1];
      const result = await analyzePlantDisease(base64Data, plantImageFile?.type || 'image/jpeg', isKa ? 'ka' : 'en');
      setActiveDiseaseResult(result);

      // Save to persistent clinical ledger immediately
      const saved = await clinicalAnalysisService.saveAnalysisRecord({
        type: 'disease',
        title: result.diseaseName || 'Plant Disease Diagnostic',
        organizationId: activeOrgId || 'default',
        imageDataUrl: plantImageDataUrl,
        rawAiResult: result,
        agronomistConclusion: {
          notes: `Identified symptoms: ${result.description || ''}`,
          severity: 'Moderate',
          prescribedTreatment: result.treatmentSuggestions?.join('; ') || '',
          activeIngredients: [],
          recommendedDosage: '2.0 - 2.5 kg/ha',
          prescribedNutrition: 'Foliar Potassium Phosphite & Calcium',
          preventiveMeasures: 'Regular inspection every 5 days; avoid overhead sprinkler watering.',
          targetSectorOrPlot: targetSector,
          authorName: currentUser?.name || 'Chief Agronomist',
          authorRole: currentUser?.roles?.[0] || 'Agronomist',
          authorId: currentUser?.id,
          isVerified: false,
          updatedAt: new Date().toISOString()
        }
      });

      setSelectedRecord(saved);
      loadHistory();
      toast.success(isKa ? 'დიაგნოსტიკა შესრულდა და შენახულია არქივში' : 'Diagnostic complete and saved to clinical archive');
    } catch (err) {
      console.error('Plant disease analysis error:', err);
      toast.error(isKa ? 'დიაგნოსტიკის შესრულება ვერ მოხერხდა' : 'Failed to analyze plant disease');
    } finally {
      setIsAnalyzingDisease(false);
    }
  };

  // --- Handlers for Document & Report Trends ---
  const handleDocUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const newDocs: { id: string; fileName: string; content: string }[] = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const text = await fileToText(file);
      newDocs.push({
        id: Math.random().toString(36).substring(2, 9),
        fileName: file.name,
        content: text
      });
    }

    const updated = [...uploadedDocs, ...newDocs];
    setUploadedDocs(updated);
  };

  const handleRunDocComparison = async () => {
    if (uploadedDocs.length === 0) {
      toast.error(isKa ? 'გთხოვთ ატვირთოთ დოკუმენტები' : 'Please upload documents to compare');
      return;
    }

    setIsAnalyzingDocs(true);
    try {
      const result = await generateDocumentComparison(uploadedDocs, isKa ? 'ka' : 'en');
      setDocAnalysisSummary(result);

      // Save to persistent clinical ledger
      const saved = await clinicalAnalysisService.saveAnalysisRecord({
        type: 'document',
        title: `Document Trend Report (${uploadedDocs.map(d => d.fileName).join(', ')})`,
        organizationId: activeOrgId || 'default',
        fileNames: uploadedDocs.map(d => d.fileName),
        rawAiResult: { comparisonReport: result },
        agronomistConclusion: {
          notes: 'Evaluated agronomic trend discrepancies across lab & soil testing reports.',
          severity: 'Moderate',
          prescribedTreatment: 'Nutrient re-balancing as indicated by comparative deficit analysis.',
          activeIngredients: [],
          recommendedDosage: 'Per specific soil deficit',
          prescribedNutrition: 'Custom blend',
          preventiveMeasures: 'Schedule follow-up soil core sampling in 30 days.',
          targetSectorOrPlot: targetSector,
          authorName: currentUser?.name || 'Chief Agronomist',
          authorRole: currentUser?.roles?.[0] || 'Agronomist',
          authorId: currentUser?.id,
          isVerified: false,
          updatedAt: new Date().toISOString()
        }
      });

      setSelectedRecord(saved);
      loadHistory();
      toast.success(isKa ? 'დოკუმენტების ანალიზი შენახულია არქივში' : 'Document analysis saved to clinical archive');
    } catch (err) {
      toast.error(isKa ? 'დოკუმენტების შედარება ვერ მოხერხდა' : 'Failed to analyze documents');
    } finally {
      setIsAnalyzingDocs(false);
    }
  };

  // --- Handlers for Agro Vision / Soil & Crop Image ---
  const handleAgroImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAgroImageFile(file);
    const reader = new FileReader();
    reader.onload = (ev) => {
      if (ev.target?.result) {
        setAgroImageDataUrl(ev.target.result as string);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleRunAgroImageAnalysis = async () => {
    if (!agroImageFile && !agroImageDataUrl) {
      toast.error(isKa ? 'გთხოვთ ატვირთოთ ნაკვეთის ან ნიადაგის ფოტო' : 'Please upload an agricultural/soil photo');
      return;
    }

    setIsAnalyzingAgroImage(true);
    try {
      const base64Data = agroImageDataUrl.split(',')[1];
      const result = await analyzeAgriImage(base64Data, agroImageFile?.type || 'image/jpeg', isKa ? 'ka' : 'en');
      setActiveAgroImageResult(result);

      // Save to persistent clinical ledger
      const saved = await clinicalAnalysisService.saveAnalysisRecord({
        type: 'agro_image',
        title: result.subject || 'Agro Vision Inspection',
        organizationId: activeOrgId || 'default',
        imageDataUrl: agroImageDataUrl,
        rawAiResult: result,
        agronomistConclusion: {
          notes: `Visual inspection: ${result.condition || ''}. Metrics: ${result.metrics || 'Normal'}.`,
          severity: 'Moderate',
          prescribedTreatment: result.recommendations?.join('; ') || '',
          activeIngredients: [],
          recommendedDosage: 'Standard foliar rate',
          prescribedNutrition: 'Chelated micronutrients + humic extract',
          preventiveMeasures: 'Visual scouting every week.',
          targetSectorOrPlot: targetSector,
          authorName: currentUser?.name || 'Chief Agronomist',
          authorRole: currentUser?.roles?.[0] || 'Agronomist',
          authorId: currentUser?.id,
          isVerified: false,
          updatedAt: new Date().toISOString()
        }
      });

      setSelectedRecord(saved);
      loadHistory();
      toast.success(isKa ? 'აგრო-ხედვის ანალიზი შენახულია არქივში' : 'Agro vision inspection saved');
    } catch (err) {
      toast.error(isKa ? 'ანალიზის შესრულება ვერ მოხერხდა' : 'Failed to analyze agricultural image');
    } finally {
      setIsAnalyzingAgroImage(false);
    }
  };

  // --- Handlers for Agronomist Conclusion & Learning ---
  const handleSaveAgronomistConclusion = async () => {
    if (!selectedRecord) {
      toast.error(isKa ? 'აირჩიეთ ან შეასრულეთ ანალიზი' : 'Please select or run an analysis first');
      return;
    }

    setIsSavingConclusion(true);
    try {
      const updated = await clinicalAnalysisService.updateAgronomistConclusion(
        selectedRecord.id,
        {
          notes: conclusionNotes,
          severity: conclusionSeverity,
          prescribedTreatment,
          activeIngredients,
          recommendedDosage,
          prescribedNutrition,
          preventiveMeasures,
          targetSectorOrPlot: targetSector,
          authorName: currentUser?.name || 'Lead Agronomist',
          authorRole: currentUser?.roles?.[0] || 'Agronomist',
          authorId: currentUser?.id,
          isVerified: true,
          updatedAt: new Date().toISOString()
        },
        activeOrgId
      );

      if (updated) {
        setSelectedRecord(updated);
        loadHistory();
        toast.success(
          isKa 
            ? 'აგრონომის დასკვნა შენახულია! AI სწავლობს გამოცდილებას.' 
            : 'Agronomist prescription saved! AI is learning from your clinical decision.'
        );
      }
    } catch (err) {
      toast.error(isKa ? 'დასკვნის შენახვა ვერ მოხერხდა' : 'Failed to save conclusion');
    } finally {
      setIsSavingConclusion(false);
    }
  };

  const handleOpenPeerComparison = async () => {
    if (!selectedRecord) return;
    const condition = selectedRecord.title || selectedRecord.rawAiResult?.diseaseName || 'General Crop Issue';
    const comp = await clinicalAnalysisService.generatePeerComparison(condition);
    setPeerComparisonData(comp);
    setShowPeerComparisonModal(true);
  };

  const handleCreateTreatmentTask = () => {
    if (!selectedRecord || !onAddTask) return;
    const taskName = `Treatment: ${selectedRecord.title} (${targetSector})`;
    onAddTask({
      id: `task-${Date.now()}`,
      name: taskName,
      taskType: 'Pesticide',
      targetSector: targetSector,
      prescribedChemical: activeIngredients.join(', ') || prescribedTreatment,
      dosage: recommendedDosage,
      nutritionNotes: prescribedNutrition,
      preventiveGuidelines: preventiveMeasures,
      status: 'pending',
      priority: conclusionSeverity === 'Critical' || conclusionSeverity === 'Severe' ? 'High' : 'Normal',
      createdAt: new Date().toISOString()
    });
    toast.success(isKa ? 'სამუშაო დავალება შექმნილია' : 'Treatment task created in Work Assignments');
  };

  const handleCreateNutritionPlan = () => {
    if (!selectedRecord || !onAddNutritionPlan) return;
    onAddNutritionPlan({
      id: `nutr-${Date.now()}`,
      name: `Clinical Nutrition: ${selectedRecord.title}`,
      elements: [
        { inventoryItemId: 'potassium', newItemName: 'Potassium Phosphite', quantity: 3.5, unit: 'kg/ha' },
        { inventoryItemId: 'silicon', newItemName: 'Potassium Silicate', quantity: 2.0, unit: 'L/ha' },
        { inventoryItemId: 'calcium', newItemName: 'Chelated Calcium', quantity: 2.5, unit: 'L/ha' }
      ],
      purpose: 'Disease Defense & Foliar Strengthening',
      startDate: new Date().toISOString().split('T')[0],
      notes: prescribedNutrition
    });
    toast.success(isKa ? 'კვების გეგმა გენერირებულია' : 'Prescribed nutrition plan added to Nutrition module');
  };

  // Active Ingredient Tags Selection Helpers
  const commonIngredients = [
    'Bacillus subtilis',
    'Bacillus thuringiensis',
    'Micronized Sulfur',
    'Potassium Bicarbonate',
    'Copper Hydroxide',
    'Mancozeb',
    'Metalaxyl-M',
    'Tebuconazole',
    'Fulvic Acid',
    'Silicon (Si-K)'
  ];

  const toggleActiveIngredient = (ingredient: string) => {
    setActiveIngredients(prev => 
      prev.includes(ingredient) ? prev.filter(i => i !== ingredient) : [...prev, ingredient]
    );
  };

  const filteredHistory = savedRecords.filter(r => {
    const q = searchFilter.toLowerCase();
    return (
      r.title.toLowerCase().includes(q) ||
      (r.agronomistConclusion?.notes || '').toLowerCase().includes(q) ||
      (r.agronomistConclusion?.authorName || '').toLowerCase().includes(q)
    );
  });

  return (
    <div className={`flex flex-col h-full bg-slate-50 text-slate-800 ${mode === 'compact' ? 'text-xs' : 'text-sm'}`}>
      {/* Top Header & Tool Switcher */}
      <div className="p-3 bg-white border-b border-slate-200 shrink-0 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-xs">
            <Stethoscope size={mode === 'compact' ? 16 : 18} />
          </div>
          <div>
            <h3 className="font-black text-slate-900 uppercase tracking-tight flex items-center gap-1.5">
              <span>{isKa ? 'AI აგრო ანალიტიკოსი & დიაგნოსტიკა' : 'AI Agro Diagnostic & Clinical Suite'}</span>
              <span className="px-1.5 py-0.2 rounded text-[9px] font-black uppercase bg-emerald-100 text-emerald-800 border border-emerald-200">
                Peer-Learning
              </span>
            </h3>
            <p className="text-[10px] text-slate-500 font-medium">
              {isKa 
                ? 'დაავადებების, მავნებლების აღრიცხვა, რეცეპტები & აგრონომთა გამოცდილება' 
                : 'Pest/disease diagnostics, agronomist prescriptions & AI cross-learning'}
            </p>
          </div>
        </div>

        {onClose && (
          <button 
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
          >
            <X size={16} />
          </button>
        )}
      </div>

      {/* Primary Tool Switcher Tabs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 bg-slate-100 p-1.5 border-b border-slate-200 shrink-0 gap-1.5">
        <button
          onClick={() => setActiveTab('disease')}
          className={`py-2 px-2 rounded-lg font-black text-[10px] sm:text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all cursor-pointer min-h-[38px] ${
            activeTab === 'disease'
              ? 'bg-emerald-600 text-white shadow-xs'
              : 'text-slate-600 hover:bg-white/80'
          }`}
        >
          <Leaf size={14} className="shrink-0" />
          <span className="truncate">{isKa ? 'დაავადებები' : 'Disease'}</span>
        </button>

        <button
          onClick={() => setActiveTab('document')}
          className={`py-2 px-2 rounded-lg font-black text-[10px] sm:text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all cursor-pointer min-h-[38px] ${
            activeTab === 'document'
              ? 'bg-blue-600 text-white shadow-xs'
              : 'text-slate-600 hover:bg-white/80'
          }`}
        >
          <FileText size={14} className="shrink-0" />
          <span className="truncate">{isKa ? 'დოკუმენტები' : 'Docs'}</span>
        </button>

        <button
          onClick={() => setActiveTab('agro_image')}
          className={`py-2 px-2 rounded-lg font-black text-[10px] sm:text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all cursor-pointer min-h-[38px] ${
            activeTab === 'agro_image'
              ? 'bg-purple-600 text-white shadow-xs'
              : 'text-slate-600 hover:bg-white/80'
          }`}
        >
          <Eye size={14} className="shrink-0" />
          <span className="truncate">{isKa ? 'აგრო ხედვა' : 'Vision'}</span>
        </button>

        <button
          onClick={() => setActiveTab('history')}
          className={`py-2 px-2 rounded-lg font-black text-[10px] sm:text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all cursor-pointer relative min-h-[38px] ${
            activeTab === 'history'
              ? 'bg-amber-600 text-white shadow-xs'
              : 'text-slate-600 hover:bg-white/80'
          }`}
        >
          <History size={14} className="shrink-0" />
          <span className="truncate">{isKa ? 'არქივი' : 'Ledger'}</span>
          {savedRecords.length > 0 && (
            <span className="ml-0.5 px-1.5 py-0.2 rounded-full text-[9px] font-black bg-white/30 text-current">
              {savedRecords.length}
            </span>
          )}
        </button>
      </div>

      {/* Main Content Workspace */}
      <div className={`flex-1 overflow-y-auto p-3 sm:p-5 ${
        mode === 'full' 
          ? 'grid grid-cols-1 lg:grid-cols-2 gap-5 items-start' 
          : 'space-y-4'
      }`}>
        <div className="space-y-4">
        
        {/* --- TAB 1: PLANT DISEASE DIAGNOSTIC --- */}
        {activeTab === 'disease' && (
          <div className="space-y-3">
            <div className="p-3 bg-white rounded-xl border border-slate-200 space-y-2 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase text-emerald-800 tracking-wider flex items-center gap-1">
                  <Leaf size={12} /> {isKa ? 'ფოტოს ატვირთვა დიაგნოსტიკისთვის' : 'Upload Leaf/Plant Photo for AI Diagnostics'}
                </span>
                {plantImageDataUrl && (
                  <button 
                    onClick={() => { setPlantImageFile(null); setPlantImageDataUrl(''); setActiveDiseaseResult(null); }}
                    className="text-[9px] text-red-600 font-bold hover:underline"
                  >
                    {isKa ? 'გასუფთავება' : 'Clear'}
                  </button>
                )}
              </div>

              <div 
                onClick={() => plantInputRef.current?.click()}
                className="border-2 border-dashed border-slate-300 hover:border-emerald-500 rounded-xl p-3 text-center cursor-pointer bg-slate-50 hover:bg-emerald-50/50 transition-all"
              >
                <input 
                  type="file" 
                  ref={plantInputRef} 
                  onChange={handlePlantImageSelect} 
                  accept="image/*" 
                  className="hidden" 
                />
                {plantImageDataUrl ? (
                  <div className="relative rounded-lg overflow-hidden max-h-40 mx-auto">
                    <img src={plantImageDataUrl} alt="Plant Preview" className="w-full h-36 object-cover rounded-lg" />
                  </div>
                ) : (
                  <div className="py-3">
                    <Upload size={22} className="mx-auto text-slate-400 mb-1" />
                    <p className="text-[11px] font-bold text-slate-700">
                      {isKa ? 'დააჭირეთ ფოთლის ან მცენარის ფოტოს ასატვირთად' : 'Click to select plant photo'}
                    </p>
                    <p className="text-[9px] text-slate-400">JPG, PNG, WebP</p>
                  </div>
                )}
              </div>

              <button
                onClick={handleRunPlantDiseaseAnalysis}
                disabled={isAnalyzingDisease || (!plantImageFile && !plantImageDataUrl)}
                className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-xl font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer"
              >
                {isAnalyzingDisease ? (
                  <>
                    <RefreshCw size={13} className="animate-spin" />
                    <span>{isKa ? 'მიმდინარეობს დიაგნოსტიკა...' : 'Running Diagnostics...'}</span>
                  </>
                ) : (
                  <>
                    <Sparkles size={13} />
                    <span>{isKa ? 'დიაგნოსტიკის დაწყება' : 'Run AI Diagnostic'}</span>
                  </>
                )}
              </button>
            </div>

            {/* Diagnostic Result Card */}
            {(activeDiseaseResult || (selectedRecord && selectedRecord.type === 'disease')) && (
              <div className="p-3 bg-red-50/80 rounded-xl border border-red-200 space-y-2 text-xs">
                <div className="flex items-center justify-between border-b border-red-200/80 pb-2">
                  <div className="flex items-center gap-1.5">
                    <AlertTriangle size={15} className="text-red-600" />
                    <span className="font-black text-red-950 uppercase tracking-tight">
                      {activeDiseaseResult?.diseaseName || selectedRecord?.title}
                    </span>
                  </div>
                  {activeDiseaseResult?.confidence && (
                    <span className="px-2 py-0.5 rounded-full text-[9px] font-black bg-red-200 text-red-800">
                      {(activeDiseaseResult.confidence * 100).toFixed(0)}% Match
                    </span>
                  )}
                </div>

                <p className="text-[11px] text-slate-700 font-medium leading-relaxed">
                  {activeDiseaseResult?.description || selectedRecord?.rawAiResult?.description}
                </p>

                {/* Treatment Suggestions from AI */}
                <div className="bg-white/80 p-2.5 rounded-lg border border-red-100 space-y-1">
                  <span className="text-[9px] font-black uppercase text-red-900 tracking-wider block">
                    {isKa ? 'AI-ს რეკომენდებული საწყისი პროტოკოლი:' : 'AI Suggested Treatment Protocol:'}
                  </span>
                  <ul className="space-y-1 text-[10px] text-slate-700 font-medium">
                    {(activeDiseaseResult?.treatmentSuggestions || selectedRecord?.rawAiResult?.treatmentSuggestions || []).map((s: string, idx: number) => (
                      <li key={idx} className="flex items-start gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-red-500 mt-1 shrink-0" />
                        <span>{s}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}
          </div>
        )}

        {/* --- TAB 2: DOCUMENT & REPORT COMPARISON --- */}
        {activeTab === 'document' && (
          <div className="space-y-3">
            <div className="p-3 bg-white rounded-xl border border-slate-200 space-y-2 shadow-xs">
              <span className="text-[10px] font-black uppercase text-blue-800 tracking-wider flex items-center gap-1">
                <FileText size={12} /> {isKa ? 'დოკუმენტების შედარება & ტენდენციები' : 'Compare Reports & Agronomic Trends'}
              </span>

              <div 
                onClick={() => docInputRef.current?.click()}
                className="border-2 border-dashed border-slate-300 hover:border-blue-500 rounded-xl p-3 text-center cursor-pointer bg-slate-50 hover:bg-blue-50/50 transition-all"
              >
                <input 
                  type="file" 
                  ref={docInputRef} 
                  onChange={handleDocUpload} 
                  multiple 
                  className="hidden" 
                />
                <Upload size={20} className="mx-auto text-slate-400 mb-1" />
                <p className="text-[11px] font-bold text-slate-700">
                  {isKa ? 'ატვირთეთ PDF ან ტექსტური რეპორტები' : 'Upload Lab PDFs or Field Memos'}
                </p>
                <p className="text-[9px] text-slate-400">PDF, TXT, CSV</p>
              </div>

              {uploadedDocs.length > 0 && (
                <div className="space-y-1">
                  <span className="text-[9px] font-black text-slate-400 uppercase">
                    {isKa ? 'არჩეული ფაილები:' : 'Selected Files:'}
                  </span>
                  {uploadedDocs.map((d, i) => (
                    <div key={d.id} className="flex items-center justify-between p-1.5 bg-slate-100 rounded-lg text-[10px] font-bold text-slate-700">
                      <span className="truncate">{d.fileName}</span>
                      <button 
                        onClick={() => setUploadedDocs(prev => prev.filter((_, idx) => idx !== i))}
                        className="text-red-500 hover:text-red-700 font-black ml-2"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <button
                onClick={handleRunDocComparison}
                disabled={isAnalyzingDocs || uploadedDocs.length === 0}
                className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-xl font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer"
              >
                {isAnalyzingDocs ? (
                  <>
                    <RefreshCw size={13} className="animate-spin" />
                    <span>{isKa ? 'შედარება...' : 'Comparing...'}</span>
                  </>
                ) : (
                  <>
                    <Sparkles size={13} />
                    <span>{isKa ? 'დოკუმენტების შედარება' : 'Analyze & Compare'}</span>
                  </>
                )}
              </button>
            </div>

            {(docAnalysisSummary || (selectedRecord && selectedRecord.type === 'document')) && (
              <div className="p-3 bg-blue-50 rounded-xl border border-blue-200 text-[11px] text-slate-700 leading-relaxed whitespace-pre-wrap font-medium">
                <span className="font-black text-blue-900 uppercase tracking-wider text-[10px] block mb-1">
                  {isKa ? 'შედარების ანალიტიკური ანგარიში:' : 'Comparative Analysis Report:'}
                </span>
                {docAnalysisSummary || selectedRecord?.rawAiResult?.comparisonReport}
              </div>
            )}
          </div>
        )}

        {/* --- TAB 3: AGRO VISION & GENERAL IMAGE --- */}
        {activeTab === 'agro_image' && (
          <div className="space-y-3">
            <div className="p-3 bg-white rounded-xl border border-slate-200 space-y-2 shadow-xs">
              <span className="text-[10px] font-black uppercase text-purple-800 tracking-wider flex items-center gap-1">
                <Eye size={12} /> {isKa ? 'ზოგადი აგრო ხედვა & ნიადაგის ინსპექცია' : 'General Crop, Soil & Yield Vision'}
              </span>

              <div 
                onClick={() => agroImageInputRef.current?.click()}
                className="border-2 border-dashed border-slate-300 hover:border-purple-500 rounded-xl p-3 text-center cursor-pointer bg-slate-50 hover:bg-purple-50/50 transition-all"
              >
                <input 
                  type="file" 
                  ref={agroImageInputRef} 
                  onChange={handleAgroImageSelect} 
                  accept="image/*" 
                  className="hidden" 
                />
                {agroImageDataUrl ? (
                  <div className="relative rounded-lg overflow-hidden max-h-40 mx-auto">
                    <img src={agroImageDataUrl} alt="Agro Preview" className="w-full h-36 object-cover rounded-lg" />
                  </div>
                ) : (
                  <div className="py-3">
                    <Upload size={22} className="mx-auto text-slate-400 mb-1" />
                    <p className="text-[11px] font-bold text-slate-700">
                      {isKa ? 'ატვირთეთ ნაკვეთის, კულტურის ან ნიადაგის ფოტო' : 'Upload orchard/soil photo'}
                    </p>
                    <p className="text-[9px] text-slate-400">JPG, PNG, WebP</p>
                  </div>
                )}
              </div>

              <button
                onClick={handleRunAgroImageAnalysis}
                disabled={isAnalyzingAgroImage || (!agroImageFile && !agroImageDataUrl)}
                className="w-full py-2.5 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white rounded-xl font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer"
              >
                {isAnalyzingAgroImage ? (
                  <>
                    <RefreshCw size={13} className="animate-spin" />
                    <span>{isKa ? 'ხედვის ანალიზი...' : 'Analyzing Vision...'}</span>
                  </>
                ) : (
                  <>
                    <Sparkles size={13} />
                    <span>{isKa ? 'აგრო ხედვის ანალიზი' : 'Inspect Crop / Soil Vision'}</span>
                  </>
                )}
              </button>
            </div>

            {(activeAgroImageResult || (selectedRecord && selectedRecord.type === 'agro_image')) && (
              <div className="p-3 bg-purple-50 rounded-xl border border-purple-200 space-y-2 text-xs">
                <div className="border-b border-purple-200 pb-1.5">
                  <span className="text-[9px] font-black uppercase text-purple-700 block tracking-widest">
                    {isKa ? 'იდენტიფიცირებული ობიექტი:' : 'Identified Subject:'}
                  </span>
                  <p className="font-black text-purple-950 text-sm">
                    {activeAgroImageResult?.subject || selectedRecord?.title}
                  </p>
                </div>

                <div>
                  <span className="text-[9px] font-black uppercase text-purple-700 block tracking-widest">
                    {isKa ? 'მდგომარეობის შეფასება:' : 'Condition Assessment:'}
                  </span>
                  <p className="text-[11px] text-slate-700 font-medium">
                    {activeAgroImageResult?.condition || selectedRecord?.rawAiResult?.condition}
                  </p>
                </div>

                {(activeAgroImageResult?.metrics || selectedRecord?.rawAiResult?.metrics) && (
                  <div>
                    <span className="text-[9px] font-black uppercase text-purple-700 block tracking-widest">
                      {isKa ? 'გამოთვლილი მეტრიკები:' : 'Calculated Metrics:'}
                    </span>
                    <p className="text-[11px] text-slate-700 font-medium">
                      {activeAgroImageResult?.metrics || selectedRecord?.rawAiResult?.metrics}
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* --- TAB 4: HISTORICAL ANALYSES ARCHIVE & LEDGER --- */}
        {activeTab === 'history' && (
          <div className="space-y-3">
            {/* Search filter */}
            <div className="relative">
              <Search size={14} className="absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                value={searchFilter}
                onChange={e => setSearchFilter(e.target.value)}
                placeholder={isKa ? 'ძიება დაავადების, ნაკვეთის ან აგრონომის მიხედვით...' : 'Filter clinical history...'}
                className="w-full pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
            </div>

            {/* List of saved clinical analyses */}
            <div className="space-y-2">
              {filteredHistory.length === 0 ? (
                <div className="p-6 text-center text-slate-400 font-medium text-xs">
                  {isKa ? 'ანალიზების ისტორია ცარიელია' : 'No recorded analyses found'}
                </div>
              ) : (
                filteredHistory.map(record => {
                  const isSelected = selectedRecord?.id === record.id;
                  return (
                    <div
                      key={record.id}
                      onClick={() => setSelectedRecord(record)}
                      className={`p-3 rounded-xl border transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-emerald-50 border-emerald-500 shadow-xs'
                          : 'bg-white border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <div className="flex items-center gap-1.5">
                          {record.type === 'disease' ? (
                            <Leaf size={14} className="text-emerald-600 shrink-0" />
                          ) : record.type === 'document' ? (
                            <FileText size={14} className="text-blue-600 shrink-0" />
                          ) : (
                            <Eye size={14} className="text-purple-600 shrink-0" />
                          )}
                          <span className="font-black text-slate-900 text-xs truncate">
                            {record.title}
                          </span>
                        </div>
                        <span className="text-[9px] font-bold text-slate-400 shrink-0">
                          {new Date(record.createdAt).toLocaleDateString()}
                        </span>
                      </div>

                      {/* Agronomist Conclusion Badge */}
                      {record.agronomistConclusion ? (
                        <div className="mt-1 pt-1 border-t border-slate-100 flex items-center justify-between text-[9px]">
                          <span className="font-bold text-emerald-800 flex items-center gap-1">
                            <CheckCircle2 size={10} className="text-emerald-600" />
                            {record.agronomistConclusion.authorName || 'Agronomist Verified'}
                          </span>
                          <span className={`font-black px-1.5 py-0.2 rounded ${
                            record.agronomistConclusion.severity === 'Critical' ? 'bg-red-100 text-red-800' :
                            record.agronomistConclusion.severity === 'Severe' ? 'bg-orange-100 text-orange-800' :
                            'bg-slate-100 text-slate-700'
                          }`}>
                            {record.agronomistConclusion.severity}
                          </span>
                        </div>
                      ) : (
                        <div className="text-[9px] text-amber-600 font-bold mt-1">
                          {isKa ? 'აგრონომის დასკვნა შესავსებია' : 'Pending Agronomist Prescription'}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}
        </div>

        {/* --- DEDICATED WINDOW: AGRONOMIST'S CLINICAL CONCLUSION & PRESCRIPTION --- */}
        {/* User requirement: Add a window for the agronomist's conclusion and notes, and save it also */}
        <div className="space-y-4">
          <div className="p-3.5 bg-white rounded-2xl border border-slate-200 shadow-sm space-y-3">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center font-black text-xs">
                <Stethoscope size={13} />
              </div>
              <div>
                <h4 className="font-black text-slate-900 uppercase tracking-tight text-xs">
                  {isKa ? 'აგრონომის კლინიკური დასკვნა & რეცეპტურა' : "Agronomist's Conclusion & Prescriptions"}
                </h4>
                <span className="text-[9px] text-slate-400 font-bold block">
                  {selectedRecord ? selectedRecord.title : (isKa ? 'აირჩიეთ ან შეასრულეთ ანალიზი' : 'Select an analysis to prescribe')}
                </span>
              </div>
            </div>

            <span className="px-2 py-0.5 rounded text-[9px] font-black uppercase bg-slate-100 text-slate-700">
              {isKa ? 'აღრიცხვა & სწავლება' : 'Record & Learn'}
            </span>
          </div>

          {/* Severity & Target Plot */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[9px] font-black uppercase text-slate-500 tracking-wider block mb-1">
                {isKa ? 'სიმძიმის ხარისხი:' : 'Severity Level:'}
              </label>
              <select
                value={conclusionSeverity}
                onChange={e => setConclusionSeverity(e.target.value as any)}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg p-1.5 text-xs font-bold text-slate-800 focus:bg-white"
              >
                <option value="Mild">{isKa ? 'მსუბუქი (Mild)' : 'Mild'}</option>
                <option value="Moderate">{isKa ? 'საშუალო (Moderate)' : 'Moderate'}</option>
                <option value="Severe">{isKa ? 'მძიმე (Severe)' : 'Severe'}</option>
                <option value="Critical">{isKa ? 'კრიტიკული (Critical)' : 'Critical'}</option>
              </select>
            </div>

            <div>
              <label className="text-[9px] font-black uppercase text-slate-500 tracking-wider block mb-1">
                {isKa ? 'სამიზნე სექტორი / ნაკვეთი:' : 'Target Sector / Plot:'}
              </label>
              <input
                type="text"
                value={targetSector}
                onChange={e => setTargetSector(e.target.value)}
                placeholder="Sector A, Row 12..."
                className="w-full bg-slate-50 border border-slate-200 rounded-lg p-1.5 text-xs font-bold text-slate-800 focus:bg-white"
              />
            </div>
          </div>

          {/* 1. Agronomist's Clinical Notes */}
          <div>
            <label className="text-[9px] font-black uppercase text-slate-500 tracking-wider block mb-1">
              {isKa ? '1. აგრონომის შეფასება & დასკვნა (Clinical Notes):' : '1. Clinical Observations & Diagnosis:'}
            </label>
            <textarea
              rows={2}
              value={conclusionNotes}
              onChange={e => setConclusionNotes(e.target.value)}
              placeholder={isKa ? 'აღწერეთ ინფექციის გავრცელების მასშტაბი, ფენოფაზა და სიმპტომები...' : 'Describe severity, infection spread, canopy symptoms...'}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs font-medium text-slate-800 focus:bg-white resize-none"
            />
          </div>

          {/* 2. Active Ingredients Quick Selector */}
          <div>
            <label className="text-[9px] font-black uppercase text-slate-500 tracking-wider block mb-1">
              {isKa ? 'აქტიური ნივთიერებები (Active Ingredients):' : 'Active Ingredients Selected:'}
            </label>
            <div className="flex flex-wrap gap-1">
              {commonIngredients.map(ing => {
                const isSelected = activeIngredients.includes(ing);
                return (
                  <button
                    key={ing}
                    type="button"
                    onClick={() => toggleActiveIngredient(ing)}
                    className={`px-1.5 py-0.5 rounded text-[9px] font-bold border transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-emerald-600 text-white border-emerald-600'
                        : 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200'
                    }`}
                  >
                    {isSelected ? '✓ ' : '+ '}{ing}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 3. Prescribed Treatment & Dosage */}
          <div className="grid grid-cols-3 gap-2">
            <div className="col-span-2">
              <label className="text-[9px] font-black uppercase text-slate-500 tracking-wider block mb-1">
                {isKa ? '2. დანიშნული მკურნალობის გეგმა:' : '2. Prescribed Treatment Plan:'}
              </label>
              <input
                type="text"
                value={prescribedTreatment}
                onChange={e => setPrescribedTreatment(e.target.value)}
                placeholder={isKa ? 'ფუნგიციდი, ბაქტერიოციდი, ბიოპრეპარატი...' : 'Fungicide / bio-control prescription...'}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg p-1.5 text-xs font-bold text-slate-800 focus:bg-white"
              />
            </div>
            <div>
              <label className="text-[9px] font-black uppercase text-slate-500 tracking-wider block mb-1">
                {isKa ? 'დოზირება:' : 'Dosage:'}
              </label>
              <input
                type="text"
                value={recommendedDosage}
                onChange={e => setRecommendedDosage(e.target.value)}
                placeholder="2.5 kg/ha"
                className="w-full bg-slate-50 border border-slate-200 rounded-lg p-1.5 text-xs font-bold text-slate-800 focus:bg-white"
              />
            </div>
          </div>

          {/* 4. Prescribed Nutrition Plan */}
          <div>
            <label className="text-[9px] font-black uppercase text-slate-500 tracking-wider block mb-1">
              {isKa ? '3. დანიშნული კვების გეგმა (Nutrition Plan):' : '3. Prescribed Nutrition Support:'}
            </label>
            <input
              type="text"
              value={prescribedNutrition}
              onChange={e => setPrescribedNutrition(e.target.value)}
              placeholder={isKa ? 'ფოსფიტები, სილიციუმი, კალციუმი, იმუნოსტიმულატორი...' : 'Phosphites, foliar silicon, biostimulants to harden cuticle...'}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg p-1.5 text-xs font-bold text-slate-800 focus:bg-white"
            />
          </div>

          {/* 5. Preventive Measures & Monitoring */}
          <div>
            <label className="text-[9px] font-black uppercase text-slate-500 tracking-wider block mb-1">
              {isKa ? '4. პრევენციული ზომები & მონიტორინგი (Preventive Measures):' : '4. Preventive Measures & Monitoring:'}
            </label>
            <input
              type="text"
              value={preventiveMeasures}
              onChange={e => setPreventiveMeasures(e.target.value)}
              placeholder={isKa ? 'მორწყვის გრაფიკის კორექცია, ვარჯის გაფურჩქნა, ინსპექცია 5 დღეში...' : 'Aeration pruning, drip timing, reinspect in 5 days...'}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg p-1.5 text-xs font-bold text-slate-800 focus:bg-white"
            />
          </div>

          {/* Action Buttons */}
          <div className="pt-2 border-t border-slate-100 flex flex-wrap gap-2">
            <button
              onClick={handleSaveAgronomistConclusion}
              disabled={isSavingConclusion || !selectedRecord}
              className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-black text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 shadow-sm transition-all cursor-pointer"
            >
              {isSavingConclusion ? <RefreshCw size={12} className="animate-spin" /> : <Database size={12} />}
              <span>{isKa ? 'დასკვნის შენახვა' : 'Save Prescription'}</span>
            </button>

            {/* Peer Comparison / AI Cross-Learning Button */}
            <button
              onClick={handleOpenPeerComparison}
              disabled={!selectedRecord}
              className="px-3 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-800 border border-indigo-200 rounded-xl font-black text-xs uppercase tracking-wider flex items-center gap-1.5 transition-all cursor-pointer"
              title="Compare with prescriptions made by other agronomists"
            >
              <Cpu size={12} className="text-indigo-600" />
              <span>{isKa ? 'AI სწავლება & შედარება' : 'Peer Learning'}</span>
            </button>

            {/* Quick Operational Dispatchers */}
            {onAddTask && (
              <button
                onClick={handleCreateTreatmentTask}
                className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-xs transition-colors cursor-pointer"
                title="Create Treatment Work Order"
              >
                + {isKa ? 'დავალება' : 'Task'}
              </button>
            )}

            {onAddNutritionPlan && (
              <button
                onClick={handleCreateNutritionPlan}
                className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-xs transition-colors cursor-pointer"
                title="Create Nutrition Plan"
              >
                + {isKa ? 'კვება' : 'Nutrition'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>

      {/* --- MODAL: PEER AGRONOMIST COMPARISON & AI LEARNING --- */}
      {/* What sets our AI apart is its ability to observe, compare, and learn from the prescriptions and decisions made by other agronomists */}
      {showPeerComparisonModal && peerComparisonData && (
        <div className="fixed inset-0 z-[6000] bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3">
          <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[85vh]">
            <div className="p-3 bg-indigo-900 text-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <Cpu size={16} className="text-indigo-300" />
                <div>
                  <h4 className="font-black text-xs uppercase tracking-tight">
                    {isKa ? 'AI სწავლება: სხვა აგრონომების გამოცდილება' : 'AI Cross-Agronomist Peer Comparison'}
                  </h4>
                  <span className="text-[9px] text-indigo-200">
                    {peerComparisonData.targetCondition} ({peerComparisonData.similarCasesFound} {isKa ? 'შესადარებელი შემთხვევა' : 'peer cases observed'})
                  </span>
                </div>
              </div>
              <button
                onClick={() => setShowPeerComparisonModal(false)}
                className="p-1 hover:bg-white/10 rounded-lg text-white/80 hover:text-white"
              >
                <X size={16} />
              </button>
            </div>

            <div className="p-4 overflow-y-auto space-y-4 text-xs">
              {/* Top Active Ingredients Consensus */}
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                <span className="text-[9px] font-black uppercase text-slate-700 tracking-wider block">
                  {isKa ? 'სხვა აგრონომების მიერ გამოყენებული აქტიური ნივთიერებები:' : 'Most Prescribed Active Ingredients by Peer Agronomists:'}
                </span>
                <div className="space-y-1.5">
                  {peerComparisonData.topActiveIngredients.map((item, idx) => (
                    <div key={idx} className="flex items-center justify-between text-[11px] bg-white p-2 rounded-lg border border-slate-100">
                      <span className="font-bold text-slate-800">{item.ingredient}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-slate-500 font-bold">{item.usagePercentage}% {isKa ? 'შემთხვევებში' : 'share'}</span>
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-black bg-emerald-100 text-emerald-800">
                          {item.avgRecoveryRate}% {isKa ? 'აღდგენა' : 'recovery'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Consensus Synthesized Protocol */}
              <div className="p-3 bg-indigo-50 border border-indigo-100 rounded-xl space-y-1">
                <span className="text-[9px] font-black uppercase text-indigo-900 tracking-wider block">
                  {isKa ? 'AI-ს მიერ სინთეზირებული აგრონომიული კონსენსუსი:' : 'AI Synthesized Agronomic Consensus:'}
                </span>
                <p className="text-[11px] text-slate-700 leading-relaxed font-medium">
                  {peerComparisonData.consensusTreatmentProtocol}
                </p>
              </div>

              {/* Observed Clinical Cases */}
              <div className="space-y-2">
                <span className="text-[9px] font-black uppercase text-slate-500 tracking-wider block">
                  {isKa ? 'დაკვირვებული პრაქტიკული შემთხვევები & გადაწყვეტილებები:' : 'Real Historical Prescriptions by Other Agronomists:'}
                </span>
                <div className="space-y-2">
                  {peerComparisonData.observedCases.map((c, i) => (
                    <div key={i} className="p-2.5 bg-slate-50 rounded-xl border border-slate-200 text-[10px] space-y-1">
                      <div className="flex items-center justify-between font-bold text-slate-800">
                        <span>{c.agronomistName}</span>
                        <span className="text-slate-400">{c.organization}</span>
                      </div>
                      <p className="text-slate-700">
                        <strong className="text-slate-900">{isKa ? 'მკურნალობა:' : 'Treatment:'}</strong> {c.prescribedTreatment} ({c.dosage})
                      </p>
                      <p className="text-slate-700">
                        <strong className="text-slate-900">{isKa ? 'კვება:' : 'Nutrition:'}</strong> {c.prescribedNutrition}
                      </p>
                      <div className="flex items-center justify-between pt-1 border-t border-slate-200/60 text-[9px]">
                        <span className="text-slate-500">{c.date}</span>
                        <span className="font-black text-emerald-700 bg-emerald-100 px-1.5 py-0.2 rounded">
                          {c.recoveryOutcomePercent}% {isKa ? 'გამოჯანმრთელების მაჩვენებელი' : 'Canopy Recovery'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="p-3 bg-slate-100 border-t border-slate-200 shrink-0 text-right">
              <button
                onClick={() => setShowPeerComparisonModal(false)}
                className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold"
              >
                {isKa ? 'დახურვა' : 'Close'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AiAnalysisSuite;
