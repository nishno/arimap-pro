import React, { useState, useRef, useEffect, useCallback } from 'react';
import type { AssistantMessage, Note, User } from '../types';
import { SparklesIcon, CommandLineIcon, ArrowUpCircleIcon, MicrophoneIcon, XIcon, ChevronDownIcon, ChevronUpIcon, ChatBubbleLeftRightIcon, PaperAirplaneIcon, StopIcon, DocumentTextIcon } from './Icons';
import { 
  MessageSquare, Video, GripHorizontal, ChevronDown, Sparkles, Mic, 
  Settings, CheckCircle2, AlertTriangle, RefreshCw, Key, Trash2, ExternalLink, ShieldCheck,
  Crown, Leaf, Briefcase, TrendingUp, Layers, Eye, History, FileText, Stethoscope,
  Maximize2, Minimize2, Minus, X, ArrowLeftRight, ArrowUpDown
} from 'lucide-react';
import AiAnalysisSuite from './AiAnalysisSuite';
import AiAnalysisModal from './AiAnalysisModal';
import GlobalVoiceNotesModal from './GlobalVoiceNotesModal';
import { GodAIIntelligenceHubModal } from '../new_engine/ui/GodAIIntelligenceHubModal';
import { AIAssistantMode } from '../new_engine/types';
import { safeStorage } from '../services/storageService';
import { useLanguage } from '../contexts/LanguageContext';
import { 
  getActiveGeminiApiKey, 
  setCustomGeminiApiKey, 
  testGeminiApiKey, 
  PRIMARY_GEMINI_MODEL 
} from '../services/geminiService';

// FIX: Add type definitions for the Web Speech API to resolve TS errors.
interface SpeechRecognitionEvent extends Event {
    results: SpeechRecognitionResultList;
}

interface SpeechRecognitionErrorEvent extends Event {
    error: string;
}

interface SpeechRecognition {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onstart: (() => void) | null;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
}

// Type assertion for SpeechRecognition
declare global {
  interface Window {
    SpeechRecognition: new () => SpeechRecognition;
    webkitSpeechRecognition: new () => SpeechRecognition;
  }
}

interface GlobalAssistantPanelProps {
  messages: AssistantMessage[];
  onSendCommand: (command: string) => void;
  isLoading: boolean;
  activeModuleName?: string;
  notes?: Note[];
  onAddNote?: (
      content: string, 
      location?: { lat: number; lng: number }, 
      featureId?: string, 
      moduleName?: string, 
      tags?: string[], 
      isVoiceNote?: boolean, 
      language?: string
  ) => Promise<void>;
  onDeleteNote?: (noteId: string) => void;
  onDeleteMultipleNotes?: (noteIds: string[]) => void;
  activeOrgId?: string;
  activeOrgName?: string;
  currentUser?: User | null;
  onOpenChat?: () => void;
  onOpenMeet?: () => void;
  currentAiMode?: AIAssistantMode;
  onSetAiMode?: (mode: AIAssistantMode) => void;
  organizations?: any[];
  workAssignments?: any[];
  harvestEntries?: any[];
  plantationFeatures?: any[];
  employees?: any[];
  machinery?: any[];
  nutritionPlans?: any[];
  onNavigateToTasks?: () => void;
  onAddTask?: (task: any) => void;
  onAddNutritionPlan?: (plan: any) => void;
}

const Message: React.FC<{ message: AssistantMessage; onOpenSettings?: () => void }> = ({ message, onOpenSettings }) => {
    const isUser = message.type === 'user';
    const isError = message.type === 'error';

    const baseClasses = 'p-3 rounded-lg max-w-sm text-sm whitespace-pre-wrap';
    const userClasses = 'bg-blue-500 text-white self-end';
    const botClasses = 'bg-gray-200 text-gray-800 self-start';
    const errorClasses = 'bg-red-50 border border-red-200 text-red-800 self-start shadow-sm';
    
    const icon = isUser ? <CommandLineIcon className="h-5 w-5 text-blue-200" /> : <SparklesIcon className="h-5 w-5 text-green-500" />;
    
    const isKeyIssue = isError && (message.text.includes("Key") || message.text.includes("Quota") || message.text.includes("429") || message.text.includes("Settings"));

    return (
        <div className={`flex items-start gap-2.5 ${isUser ? 'justify-end' : ''}`}>
            {!isUser && <div className="flex-shrink-0 mt-1">{icon}</div>}
            <div className={`${baseClasses} ${isUser ? userClasses : isError ? errorClasses : botClasses}`}>
                <div>{message.text}</div>
                {isKeyIssue && onOpenSettings && (
                    <button
                        onClick={onOpenSettings}
                        className="mt-2.5 text-xs font-semibold text-emerald-800 bg-emerald-100 hover:bg-emerald-200 px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors shadow-xs"
                    >
                        <Settings className="w-3.5 h-3.5 text-emerald-700" />
                        Configure Gemini API Key (⚙️)
                    </button>
                )}
            </div>
             {isUser && <div className="flex-shrink-0 mt-1">{icon}</div>}
        </div>
    );
};

const GlobalAssistantPanel: React.FC<GlobalAssistantPanelProps> = ({ 
  messages, 
  onSendCommand, 
  isLoading,
  activeModuleName = 'Dashboard',
  notes = [],
  onAddNote,
  onDeleteNote,
  onDeleteMultipleNotes,
  activeOrgId = '',
  activeOrgName = '',
  currentUser = null,
  onOpenChat,
  onOpenMeet,
  currentAiMode = 'standard',
  onSetAiMode,
  organizations = [],
  workAssignments = [],
  harvestEntries = [],
  plantationFeatures = [],
  employees = [],
  machinery = [],
  nutritionPlans = [],
  onNavigateToTasks,
  onAddTask,
  onAddNutritionPlan
}) => {
  const { language } = useLanguage();
  const isKa = language === 'ka';
  const [inputValue, setInputValue] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(true);
  const [assistantView, setAssistantView] = useState<'chat' | 'analysis'>('chat');
  const [analysisInitialTool, setAnalysisInitialTool] = useState<'disease' | 'document' | 'agro_image' | 'history'>('disease');
  const [isAnalysisModalOpen, setIsAnalysisModalOpen] = useState(false);
  const [isEnlarged, setIsEnlarged] = useState<boolean>(() => {
    return safeStorage.getItem('agrimap_assistant_enlarged') === 'true';
  });

  // Window Custom Dimensions (Live Resizing)
  const [panelSize, setPanelSize] = useState<{ width: number; height: number }>(() => {
    const stored = safeStorage.getItem('agrimap_assistant_custom_size');
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        if (Number.isFinite(parsed?.width) && Number.isFinite(parsed?.height)) {
          return {
            width: Math.max(340, Math.min(typeof window !== 'undefined' ? window.innerWidth - 16 : 1200, parsed.width)),
            height: Math.max(400, Math.min(typeof window !== 'undefined' ? window.innerHeight - 20 : 900, parsed.height)),
          };
        }
      } catch (e) {}
    }
    const defaultW = typeof window !== 'undefined' ? (window.innerWidth < 640 ? Math.max(320, window.innerWidth - 20) : 440) : 440;
    return { width: defaultW, height: 560 };
  });

  const toggleEnlarged = () => {
    setIsEnlarged(prev => {
      const next = !prev;
      safeStorage.setItem('agrimap_assistant_enlarged', next ? 'true' : 'false');
      if (next) {
        setPanelSize({
          width: Math.min(940, window.innerWidth - 24),
          height: Math.min(840, window.innerHeight - 30)
        });
      } else {
        setPanelSize({
          width: Math.min(440, window.innerWidth - 24),
          height: 560
        });
      }
      return next;
    });
  };
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isVoiceNotesOpen, setIsVoiceNotesOpen] = useState(false);
  const [isGodAIHubOpen, setIsGodAIHubOpen] = useState(false);
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [isTestingKey, setIsTestingKey] = useState(false);
  const [testStatus, setTestStatus] = useState<{ ok: boolean; message: string; latencyMs?: number; model?: string } | null>(null);
  const [saveStatus, setSaveStatus] = useState<{ type: 'success' | 'info'; message: string } | null>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const isSystemAdmin = Boolean(
      (currentUser as any)?.isSystemAdmin || 
      (currentUser as any)?.role === 'system_admin' || 
      ((currentUser as any)?.roles as any)?.includes?.('system_admin')
  );

  // Load currently active key on mount and when settings opens
  useEffect(() => {
    const key = getActiveGeminiApiKey();
    setApiKeyInput(key);
  }, [isSettingsOpen]);

  const handleSaveApiKey = () => {
    setSaveStatus({type:'info',message:'API keys must be configured on the authenticated AI server. No browser key was stored.'});
    setTestStatus(null);
  };

  const handleClearApiKey = () => {
    setCustomGeminiApiKey('');
    setApiKeyInput('');
    setSaveStatus({
      type: 'info',
      message: 'Browser key cleared. AI uses the authenticated server configuration.'
    });
    setTestStatus(null);
    setTimeout(() => setSaveStatus(null), 3500);
  };

  const handleTestConnection = async () => {
    setIsTestingKey(true);
    setTestStatus(null);
    try {
      const result = await testGeminiApiKey(apiKeyInput.trim() || undefined);
      setTestStatus(result);
    } catch (e: any) {
      setTestStatus({
        ok: false,
        message: e?.message || 'Failed to complete test.'
      });
    } finally {
      setIsTestingKey(false);
    }
  };

  useEffect(() => {
    const handleOpenNotes = () => setIsVoiceNotesOpen(true);
    const handleOpenAssistant = () => setIsCollapsed(false);
    window.addEventListener('agrimap_open_voice_notes', handleOpenNotes);
    window.addEventListener('agrimap_open_assistant', handleOpenAssistant);
    return () => {
      window.removeEventListener('agrimap_open_voice_notes', handleOpenNotes);
      window.removeEventListener('agrimap_open_assistant', handleOpenAssistant);
    };
  }, []);

  // Viewport resize clamping to ensure chat never slips off-screen or becomes inaccessible
  useEffect(() => {
    const handleWindowResize = () => {
      const availW = typeof window !== 'undefined' ? window.innerWidth : 1200;
      const availH = typeof window !== 'undefined' ? window.innerHeight : 800;

      setPanelSize(prev => {
        const maxW = Math.max(280, availW - 16);
        const maxH = Math.max(240, availH - 24);
        return {
          width: Math.max(280, Math.min(prev.width, maxW)),
          height: Math.max(240, Math.min(prev.height, maxH))
        };
      });

      setCommsPos(prev => {
        if (!prev) return prev;
        const clampedX = Math.max(8, Math.min(availW - 65, prev.x));
        const clampedY = Math.max(8, Math.min(availH - 75, prev.y));
        return { x: clampedX, y: clampedY };
      });
    };

    const handleWindowBlur = () => {
      if (isListening) {
        recognitionRef.current?.stop();
        setIsListening(false);
      }
    };

    window.addEventListener('resize', handleWindowResize);
    window.addEventListener('blur', handleWindowBlur);
    document.addEventListener('visibilitychange', handleWindowBlur);
    return () => {
      window.removeEventListener('resize', handleWindowResize);
      window.removeEventListener('blur', handleWindowBlur);
      document.removeEventListener('visibilitychange', handleWindowBlur);
    };
  }, [isListening]);

  // Movable Floating Comms Hub State
  const [commsPos, setCommsPos] = useState<{ x: number; y: number } | null>(() => {
      const stored = safeStorage.getItem('agrimap_floating_fabs_pos');
      if (stored) {
          try {
              const parsed = JSON.parse(stored);
              if (Number.isFinite(parsed?.x) && Number.isFinite(parsed?.y)) {
                  if (parsed.x < window.innerWidth - 50 && parsed.y < window.innerHeight - 50 && parsed.x >= 0 && parsed.y >= 0) {
                      return parsed;
                  }
              }
          } catch (e) {}
      }
      return null;
  });

  const commsContainerRef = useRef<HTMLDivElement | null>(null);
  const commsDragRef = useRef<{ startX: number; startY: number; startLeft: number; startTop: number } | null>(null);

  const handleCommsPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
      if ((e.target as HTMLElement).closest('button, input, a, textarea')) return;
      e.preventDefault();
      try {
          e.currentTarget.setPointerCapture(e.pointerId);
      } catch (err) {}

      const rect = commsContainerRef.current?.getBoundingClientRect();
      const currentLeft = rect ? rect.left : (window.innerWidth - 80);
      const currentTop = rect ? rect.top : (window.innerHeight - 280);

      commsDragRef.current = {
          startX: e.clientX,
          startY: e.clientY,
          startLeft: currentLeft,
          startTop: currentTop
      };
  };

  const handleCommsPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
      if (!commsDragRef.current) return;
      e.preventDefault();
      const deltaX = e.clientX - commsDragRef.current.startX;
      const deltaY = e.clientY - commsDragRef.current.startY;
      const newLeft = Math.max(8, Math.min(window.innerWidth - 65, commsDragRef.current.startLeft + deltaX));
      const newTop = Math.max(8, Math.min(window.innerHeight - 270, commsDragRef.current.startTop + deltaY));
      setCommsPos({ x: Math.round(newLeft), y: Math.round(newTop) });
  };

  const handleCommsPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
      if (!commsDragRef.current) return;
      try {
          e.currentTarget.releasePointerCapture(e.pointerId);
      } catch (err) {}
      commsDragRef.current = null;
      setCommsPos(curr => {
          if (curr) safeStorage.setItem('agrimap_floating_fabs_pos', JSON.stringify(curr));
          return curr;
      });
  };

  // Live Window Resizing Handlers
  const [isResizing, setIsResizing] = useState<string | null>(null);
  const resizeRef = useRef<{
    direction: string;
    startX: number;
    startY: number;
    startWidth: number;
    startHeight: number;
    startLeft: number;
    startTop: number;
  } | null>(null);

  const startResize = (e: React.PointerEvent<HTMLDivElement>, direction: string) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch (err) {}

    const rect = commsContainerRef.current?.getBoundingClientRect();
    const currentLeft = rect ? rect.left : 80;
    const currentTop = rect ? rect.top : 80;
    const currentWidth = rect ? rect.width : panelSize.width;
    const currentHeight = rect ? rect.height : panelSize.height;

    setIsResizing(direction);
    resizeRef.current = {
      direction,
      startX: e.clientX,
      startY: e.clientY,
      startWidth: currentWidth,
      startHeight: currentHeight,
      startLeft: currentLeft,
      startTop: currentTop
    };
  };

  const handleResizePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!resizeRef.current) return;
    e.preventDefault();
    const { direction, startX, startY, startWidth, startHeight, startLeft, startTop } = resizeRef.current;
    const deltaX = e.clientX - startX;
    const deltaY = e.clientY - startY;

    let newWidth = startWidth;
    let newHeight = startHeight;
    let newLeft = startLeft;
    let newTop = startTop;

    const minW = Math.min(340, window.innerWidth - 20);
    const maxW = Math.min(1300, window.innerWidth - 16);
    const minH = Math.min(380, window.innerHeight - 20);
    const maxH = window.innerHeight - 16;

    if (direction.includes('right')) {
      newWidth = Math.max(minW, Math.min(maxW, startWidth + deltaX));
    }
    if (direction.includes('left')) {
      const candidateWidth = startWidth - deltaX;
      if (candidateWidth >= minW && candidateWidth <= maxW) {
        newWidth = candidateWidth;
        newLeft = startLeft + deltaX;
      } else if (candidateWidth < minW) {
        newWidth = minW;
        newLeft = startLeft + (startWidth - minW);
      } else {
        newWidth = maxW;
        newLeft = startLeft + (startWidth - maxW);
      }
    }
    if (direction.includes('bottom')) {
      newHeight = Math.max(minH, Math.min(maxH, startHeight + deltaY));
    }
    if (direction.includes('top')) {
      const candidateHeight = startHeight - deltaY;
      if (candidateHeight >= minH && candidateHeight <= maxH) {
        newHeight = candidateHeight;
        newTop = startTop + deltaY;
      } else if (candidateHeight < minH) {
        newHeight = minH;
        newTop = startTop + (startHeight - minH);
      } else {
        newHeight = maxH;
        newTop = startTop + (startHeight - maxH);
      }
    }

    newLeft = Math.max(8, Math.min(window.innerWidth - newWidth - 8, newLeft));
    newTop = Math.max(8, Math.min(window.innerHeight - newHeight - 8, newTop));

    setPanelSize({ width: Math.round(newWidth), height: Math.round(newHeight) });
    setCommsPos({ x: Math.round(newLeft), y: Math.round(newTop) });
  };

  const handleResizePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!resizeRef.current) return;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch (err) {}
    resizeRef.current = null;
    setIsResizing(null);
    safeStorage.setItem('agrimap_assistant_custom_size', JSON.stringify(panelSize));
    if (commsPos) {
      safeStorage.setItem('agrimap_floating_fabs_pos', JSON.stringify(commsPos));
    }
  };

  // Close dropdown menu on outside click
  useEffect(() => {
      const handleClickOutside = (e: MouseEvent) => {
          if (commsContainerRef.current && !commsContainerRef.current.contains(e.target as Node)) {
              setIsMenuOpen(false);
          }
      };
      if (isMenuOpen) {
          document.addEventListener('pointerdown', handleClickOutside);
      }
      return () => document.removeEventListener('pointerdown', handleClickOutside);
  }, [isMenuOpen]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(scrollToBottom, [messages]);
  
  const handleVoiceCommand = () => {
    if (isListening) {
      recognitionRef.current?.stop();
      return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Voice commands are not supported by your browser.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognitionRef.current = recognition;

    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = 'en-US';
    
    recognition.onstart = () => {
        setIsListening(true);
        setInputValue("Listening...");
    };

    recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        setInputValue(transcript);
        onSendCommand(transcript);
    };
    
    recognition.onerror = (event) => {
        console.error("Speech recognition error:", event.error);
        if (event.error === 'not-allowed') {
            alert("Microphone access was denied. Please allow microphone access in your browser settings to use voice commands.");
        }
        setInputValue("");
    };

    recognition.onend = () => {
        setIsListening(false);
        recognitionRef.current = null;
        if (inputValue === "Listening...") {
             setInputValue("");
        }
    };

    recognition.start();
  };

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputValue.trim() && !isLoading) {
      onSendCommand(inputValue.trim());
      setInputValue('');
    }
  };

  if (isCollapsed) {
    return (
      <>
        <div 
          ref={commsContainerRef}
          style={{
              position: 'fixed',
              ...(commsPos ? { left: `${commsPos.x}px`, top: `${commsPos.y}px` } : { right: '16px', bottom: '80px' }),
              zIndex: 8500
          }}
          className="select-none pointer-events-auto"
        >
            {/* Direct Floating Circular Action Buttons Stack (Matches Screenshot: Meet -> Chat -> AI Note -> AI Assistant) */}
            <div className="flex flex-col items-center gap-2.5 sm:gap-3 group">
                {/* Drag Handle & Reset Button */}
                <div className="flex items-center gap-1 opacity-70 hover:opacity-100 transition-opacity">
                    <div 
                        onPointerDown={handleCommsPointerDown}
                        onPointerMove={handleCommsPointerMove}
                        onPointerUp={handleCommsPointerUp}
                        className="p-1 text-slate-400 hover:text-white bg-slate-950/80 hover:bg-slate-900 rounded-full shadow-md backdrop-blur-sm transition-all cursor-move flex items-center justify-center border border-slate-700/60"
                        title="Drag to reposition floating buttons anywhere on screen"
                    >
                        <GripHorizontal size={13} />
                    </div>
                    {commsPos && (
                        <button
                            onClick={() => {
                                setCommsPos(null);
                                safeStorage.removeItem('agrimap_floating_fabs_pos');
                            }}
                            className="w-5 h-5 rounded-full bg-slate-950/80 hover:bg-rose-950 text-slate-400 hover:text-rose-300 text-[10px] font-bold flex items-center justify-center border border-slate-700/60 transition-colors cursor-pointer"
                            title="Reset position to default"
                        >
                            ✕
                        </button>
                    )}
                </div>

                {/* 1. Google Meet Button (Top Blue Circle) */}
                <button
                    onClick={() => {
                        if (onOpenMeet) onOpenMeet();
                        window.dispatchEvent(new CustomEvent('agrimap_open_meet'));
                    }}
                    className="w-12 h-12 rounded-full bg-blue-600 hover:bg-blue-500 text-white shadow-xl shadow-blue-950/50 flex items-center justify-center transition-all transform hover:scale-110 active:scale-95 cursor-pointer border border-blue-400/30"
                    title="Google Meet Video Call"
                >
                    <Video className="w-6 h-6 text-white" />
                </button>

                {/* 2. Google Chat Button (Second Emerald Circle) */}
                <button
                    onClick={() => {
                        if (onOpenChat) onOpenChat();
                        window.dispatchEvent(new CustomEvent('agrimap_open_chat'));
                    }}
                    className="w-12 h-12 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white shadow-xl shadow-emerald-950/50 flex items-center justify-center transition-all transform hover:scale-110 active:scale-95 cursor-pointer border border-emerald-400/30"
                    title="Google Chat Workspace Hub"
                >
                    <MessageSquare className="w-6 h-6 text-white" />
                </button>

                {/* 3. AI Voice Notes Button (Third Darker Green / Teal Circle with subtle ring) */}
                <button
                    onClick={() => setIsVoiceNotesOpen(true)}
                    className="w-12 h-12 rounded-full bg-emerald-800 hover:bg-emerald-700 text-white shadow-xl shadow-emerald-950/60 flex items-center justify-center transition-all transform hover:scale-110 active:scale-95 border-2 border-emerald-400/50 relative cursor-pointer"
                    title="AI Voice Notes & Field Memos"
                >
                    <Mic className="w-6 h-6 text-white" />
                    {notes.length > 0 && (
                        <span className="absolute -top-1 -right-1 bg-amber-500 text-slate-950 text-[10px] font-mono font-black rounded-full px-1.5 py-0.2 border border-white shadow-sm">
                            {notes.length}
                        </span>
                    )}
                </button>

                {/* 4. AI Agro Diagnostics Pop-up Modal Button (Pop-up window directly) */}
                <button
                    onClick={() => {
                        setAnalysisInitialTool('disease');
                        setIsAnalysisModalOpen(true);
                    }}
                    className="w-12 h-12 rounded-full bg-gradient-to-tr from-teal-700 to-emerald-600 hover:from-teal-600 hover:to-emerald-500 text-white shadow-xl shadow-teal-950/60 flex items-center justify-center transition-all transform hover:scale-110 active:scale-95 cursor-pointer border-2 border-teal-300/50 relative"
                    title={isKa ? "AI აგრო დიაგნოსტიკა & კლინიკური Pop-up ფანჯარა" : "AI Agro Diagnostics & Clinical Pop-up Window"}
                >
                    <Stethoscope className="w-6 h-6 text-white" />
                </button>

                {/* 5. AI Assistant Button (Bottom Vibrant Green Circle with Sparkles) */}
                <button
                    onClick={() => setIsCollapsed(false)}
                    className="w-12 h-12 rounded-full bg-emerald-500 hover:bg-emerald-400 text-white shadow-xl shadow-emerald-950/50 flex items-center justify-center transition-all transform hover:scale-110 active:scale-95 cursor-pointer border border-emerald-300/40"
                    title={isKa ? "Gemini 2.5 Knowledge Engine - AI სისტემის ნავიგატორი & Copilot" : "Gemini 2.5 Knowledge Engine - AI System Navigator & Copilot"}
                >
                    <Sparkles className="w-6 h-6 text-white" />
                </button>

                {/* 6. Root AI & God AI Intelligence Console Button */}
                <button
                    onClick={() => setIsGodAIHubOpen(true)}
                    className="w-12 h-12 rounded-full bg-gradient-to-tr from-amber-600 via-amber-500 to-yellow-500 hover:from-amber-500 hover:to-yellow-400 text-white shadow-xl shadow-amber-950/60 flex items-center justify-center transition-all transform hover:scale-110 active:scale-95 cursor-pointer border-2 border-amber-300/50 relative"
                    title={isSystemAdmin ? (isKa ? "Root AI ასისტენტი & God AI კონსოლი (სუპერ ადმინი - ყველა კომპანია)" : "Root AI Assistant & God AI Console (Super Admin - All Companies)") : (isKa ? "აგრონომიული PM კონსოლი" : "Agronomy PM Intelligence Console")}
                >
                    <Crown className="w-6 h-6 text-white" />
                    <span className="absolute -top-1 -right-1 flex h-3 w-3">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-3 w-3 bg-amber-500 border border-white"></span>
                    </span>
                </button>
            </div>
        </div>

        {onAddNote && (
            <GlobalVoiceNotesModal
                isOpen={isVoiceNotesOpen}
                onClose={() => setIsVoiceNotesOpen(false)}
                activeModuleName={activeModuleName}
                activeOrgId={activeOrgId}
                currentUser={currentUser}
                notes={notes}
                onAddNote={onAddNote}
                onDeleteNote={onDeleteNote}
                onDeleteMultipleNotes={onDeleteMultipleNotes}
            />
        )}
      </>
    );
  }

  return (
    <>
      <div 
        ref={commsContainerRef}
        style={{
          position: 'fixed',
          left: commsPos ? `${Math.max(8, Math.min((typeof window !== 'undefined' ? window.innerWidth : 1200) - panelSize.width - 8, commsPos.x))}px` : undefined,
          top: commsPos ? `${Math.max(8, Math.min((typeof window !== 'undefined' ? window.innerHeight : 800) - panelSize.height - 8, commsPos.y))}px` : undefined,
          right: !commsPos ? '16px' : undefined,
          bottom: !commsPos ? '16px' : undefined,
          width: `${Math.max(280, Math.min(panelSize.width, typeof window !== 'undefined' ? window.innerWidth - 16 : 440))}px`,
          height: `${Math.max(240, Math.min(panelSize.height, typeof window !== 'undefined' ? window.innerHeight - 24 : 560))}px`,
          maxWidth: 'calc(100vw - 16px)',
          maxHeight: 'calc(100vh - 24px)',
          zIndex: 8500
        }}
        className="bg-white flex flex-col rounded-2xl shadow-2xl border border-slate-200 overflow-hidden animate-in zoom-in-95 duration-200 origin-bottom-right relative pointer-events-auto transition-[box-shadow,border-color] duration-150"
      >
        {/* Header */}
        <div className="p-2.5 sm:p-3 border-b bg-slate-50 flex justify-between items-center select-none shrink-0 gap-2">
          <div className="flex items-center gap-2 min-w-0">
              <div 
                onPointerDown={handleCommsPointerDown}
                onPointerMove={handleCommsPointerMove}
                onPointerUp={handleCommsPointerUp}
                className="cursor-move p-1 text-slate-400 hover:text-slate-700 rounded transition-colors shrink-0"
                title={isKa ? "ფანჯრის გადაადგილება" : "Drag Assistant Window"}
              >
                <GripHorizontal size={15} />
              </div>
              <SparklesIcon className="h-5 w-5 text-emerald-500 shrink-0" />
              <div className="min-w-0">
                <h3 className="text-xs sm:text-sm font-black text-slate-800 uppercase tracking-tight truncate">
                  {isKa ? 'AI სისტემის ნავიგატორი & Copilot' : 'AI System Navigator & Copilot'}
                </h3>
                <div className="flex items-center gap-1 flex-wrap mt-0.5">
                  <span className="text-[9px] font-black text-emerald-800 bg-emerald-100 px-1.5 py-0.2 rounded tracking-wide border border-emerald-300">
                    Gemini 2.5 Knowledge Engine
                  </span>
                  <span className="text-[9px] font-bold text-slate-600 bg-slate-200/80 px-1 py-0.2 rounded truncate max-w-[120px]">
                    {activeModuleName}
                  </span>
                  {isGodAIHubOpen && (
                    <span className="text-[8px] font-black text-amber-700 bg-amber-100 border border-amber-300 px-1 rounded animate-pulse">
                      Console Active
                    </span>
                  )}
                </div>
              </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
              {/* Dedicated Pop-up Window Button (Like Console) */}
              <button
                  type="button"
                  onClick={() => {
                      setAnalysisInitialTool('disease');
                      setIsAnalysisModalOpen(true);
                  }}
                  className="px-2 py-1 rounded-lg border border-emerald-300 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 transition-all flex items-center gap-1 text-[10px] font-black uppercase cursor-pointer shadow-2xs"
                  title={isKa ? "დიაგნოსტიკის გახსნა ცალკე Pop-up ფანჯარაში (კონსოლის მსგავსად)" : "Open Diagnostics in Dedicated Pop-up Modal"}
              >
                  <ExternalLink size={12} />
                  <span>{isKa ? 'Pop-up' : 'Pop-up'}</span>
              </button>

              {/* AI Analysis View Toggle */}
              <button
                  type="button"
                  onClick={() => {
                      setAssistantView(assistantView === 'analysis' ? 'chat' : 'analysis');
                  }}
                  className={`px-2 py-1 rounded-lg border transition-all flex items-center gap-1 text-[10px] font-black uppercase cursor-pointer shadow-2xs ${
                      assistantView === 'analysis'
                          ? 'bg-emerald-600 text-white border-emerald-600'
                          : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border-emerald-200'
                  }`}
                  title={isKa ? "მცენარეთა დაავადებების AI დიაგნოსტიკა" : "AI Plant Disease Diagnostic"}
              >
                  <Leaf size={12} />
                  <span>{isKa ? 'დიაგნოსტიკა' : 'Diagnostics'}</span>
              </button>

              {/* Chat Return Button when in Analysis View */}
              {assistantView === 'analysis' && (
                  <button
                      type="button"
                      onClick={() => setAssistantView('chat')}
                      className="px-2 py-1 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg text-[10px] font-black uppercase flex items-center gap-1 transition-colors cursor-pointer"
                      title={isKa ? "ჩატში დაბრუნება" : "Return to Chat"}
                  >
                      <MessageSquare size={12} />
                      <span>{isKa ? 'ჩატი' : 'Chat'}</span>
                  </button>
              )}

              {/* Settings */}
              <button 
                  onClick={() => setIsSettingsOpen(!isSettingsOpen)}
                  className="p-1.5 hover:bg-slate-200 rounded-lg transition-colors text-slate-500 hover:text-slate-800 cursor-pointer"
                  title={isKa ? "Gemini AI პარამეტრები" : "Gemini AI Settings & Diagnostics"}
              >
                  <Settings className="h-4 w-4" />
              </button>

              {/* Window Control Buttons: Collapse (-), Restore/Maximize [ ], Close (X) */}
              <div className="flex items-center gap-1 pl-1.5 ml-0.5 border-l border-slate-200">
                  {/* Collapse (-) Button */}
                  <button 
                      type="button"
                      onClick={() => setIsCollapsed(true)}
                      className="w-6 h-6 sm:w-7 sm:h-7 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 flex items-center justify-center transition-all cursor-pointer shadow-2xs hover:scale-105 active:scale-95"
                      title={isKa ? "ჩაკეცვა (-)" : "Collapse to Dock (-)"}
                  >
                     <Minus size={14} strokeWidth={2.5} />
                  </button>

                  {/* Enlarge / Shrink Button */}
                  <button
                      type="button"
                      onClick={toggleEnlarged}
                      className="w-6 h-6 sm:w-7 sm:h-7 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 flex items-center justify-center transition-all cursor-pointer shadow-2xs hover:scale-105 active:scale-95"
                      title={isEnlarged ? (isKa ? "სტანდარტული ზომა" : "Standard Size") : (isKa ? "ფანჯრის გაფართოება" : "Enlarge Window")}
                  >
                      {isEnlarged ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
                  </button>

                  {/* Close (X) Button */}
                  <button 
                      type="button"
                      onClick={() => setIsCollapsed(true)}
                      className="w-6 h-6 sm:w-7 sm:h-7 rounded-lg bg-rose-50 hover:bg-rose-600 text-rose-700 hover:text-white border border-rose-300 hover:border-rose-600 flex items-center justify-center transition-all cursor-pointer shadow-2xs hover:scale-105 active:scale-95"
                      title={isKa ? "დახურვა (X)" : "Close (X)"}
                  >
                     <X size={14} strokeWidth={2.5} />
                  </button>
              </div>
          </div>
        </div>

        {/* Mode Selector & Intelligence Hub Console Bar */}
        <div className="px-3 py-1.5 bg-slate-900 border-b border-slate-800 flex items-center justify-between text-xs select-none shrink-0 gap-2">
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
            <span className="text-[9px] uppercase font-black tracking-widest text-slate-400">{isKa ? 'რეჟიმი:' : 'Mode:'}</span>
            <div className="flex items-center bg-slate-950 p-0.5 rounded-lg border border-slate-800">
              <button
                type="button"
                onClick={() => onSetAiMode?.('standard')}
                className={`px-2 py-0.5 rounded text-[10px] font-bold transition-all cursor-pointer ${
                  currentAiMode === 'standard' 
                    ? 'bg-slate-700 text-white shadow-xs' 
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {isKa ? 'სტანდარტული' : 'Standard'}
              </button>
              <button
                type="button"
                onClick={() => onSetAiMode?.('expert')}
                className={`px-2 py-0.5 rounded text-[10px] font-bold transition-all flex items-center gap-1 cursor-pointer ${
                  currentAiMode === 'expert' 
                    ? 'bg-emerald-600 text-white shadow-xs' 
                    : 'text-slate-400 hover:text-emerald-300'
                }`}
                title={isKa ? "მიბმულია მიმდინარე კომპანიაზე: აკონტროლებს სამუშაოებს, ამოცანებს, ტექნიკას" : "Attached to active enterprise: monitors work, tasks, bottlenecks, machinery, labor"}
              >
                <Leaf size={10} />
                <span>Expert PM</span>
              </button>
              {isSystemAdmin && (
                <button
                  type="button"
                  onClick={() => onSetAiMode?.('god_ai')}
                  className={`px-2 py-0.5 rounded text-[10px] font-bold transition-all flex items-center gap-1 cursor-pointer ${
                    currentAiMode === 'god_ai' 
                      ? 'bg-amber-600 text-white shadow-xs animate-pulse' 
                      : 'text-slate-400 hover:text-amber-300'
                  }`}
                  title={isKa ? "სუპერ ადმინი God AI: კროს-კომპანიური მონაცემები" : "Super Admin God AI: Cross-enterprise learning across all registered companies"}
                >
                  <Crown size={10} />
                  <span>God AI</span>
                </button>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => {
                setAnalysisInitialTool('disease');
                setIsAnalysisModalOpen(true);
              }}
              className="px-2 py-1 bg-emerald-800/90 hover:bg-emerald-700 text-emerald-100 text-[10px] font-black uppercase tracking-wider rounded-lg shadow-sm flex items-center gap-1 cursor-pointer transition-all hover:scale-105 active:scale-95 border border-emerald-600/50"
              title={isKa ? "AI დიაგნოსტიკის ცალკე Pop-up ფანჯარაში გახსნა" : "Open AI Diagnostics in Dedicated Pop-up Modal"}
            >
              <Stethoscope size={11} />
              <span>{isKa ? 'დიაგნოსტიკა (Pop-up)' : 'Pop-up'}</span>
            </button>
            <button
              type="button"
              onClick={() => setIsGodAIHubOpen(true)}
              className="px-2 py-1 bg-gradient-to-r from-amber-600 to-emerald-600 hover:from-amber-500 hover:to-emerald-500 text-white text-[10px] font-black uppercase tracking-wider rounded-lg shadow-sm flex items-center gap-1 cursor-pointer transition-all hover:scale-105 active:scale-95"
              title={isKa ? "God AI & PM კონსოლის გახსნა" : "Open God AI & PM Intelligence Hub Console"}
            >
              <Sparkles size={11} />
              <span>{isKa ? 'კონსოლი' : 'Console'}</span>
            </button>
          </div>
        </div>

        {/* Tenant Attachment / Scope Radius / Root AI Banner */}
        {currentAiMode === 'expert' && (
          <div className="px-3 py-1.5 bg-emerald-950/95 border-b border-emerald-800/80 text-[10px] text-emerald-200 flex items-center justify-between shrink-0">
            <span className="flex items-center gap-1.5 truncate">
              <Leaf size={12} className="text-emerald-400 shrink-0" />
              <span><strong className="font-bold text-white">Attached Company Radius:</strong> {activeOrgName || activeOrgId || 'Active Enterprise'}</span>
            </span>
            <span className="text-[9px] bg-emerald-800/90 px-1.5 py-0.5 rounded text-emerald-100 uppercase tracking-wider font-mono shrink-0 ml-1 border border-emerald-600/40">
              Attached Scope
            </span>
          </div>
        )}
        {currentAiMode === 'standard' && (
          <div className="px-3 py-1.5 bg-slate-900 border-b border-slate-800 text-[10px] text-slate-300 flex items-center justify-between shrink-0">
            <span className="flex items-center gap-1.5 truncate">
              <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0 animate-pulse" />
              <span><strong className="font-bold text-slate-300">Attached Company Radius:</strong> <span className="text-emerald-300 font-bold">{activeOrgName || activeOrgId || 'Active Enterprise'}</span></span>
            </span>
            <span className="text-[9px] bg-slate-800 px-1.5 py-0.5 rounded text-slate-300 uppercase tracking-wider font-mono shrink-0 ml-1 border border-slate-700">
              Copilot Radius
            </span>
          </div>
        )}
        {currentAiMode === 'god_ai' && (
          <div className="px-3 py-1.5 bg-amber-950/95 border-b border-amber-800/80 text-[10px] text-amber-200 flex items-center justify-between shrink-0">
            <span className="flex items-center gap-1.5 truncate">
              <Crown size={12} className="text-amber-400 shrink-0 animate-pulse" />
              <span><strong className="font-bold text-white">Root AI Assistant:</strong> Multi-Company Oversight Across All {organizations?.length || 0} Enterprises</span>
            </span>
            <span className="text-[9px] bg-amber-800/90 px-1.5 py-0.5 rounded text-amber-100 uppercase tracking-wider font-mono shrink-0 ml-1 border border-amber-600/40">
              Super Admin
            </span>
          </div>
        )}

        {/* Quick Suggestion Chips */}
        <div className="px-3 py-1.5 bg-slate-50 border-b border-slate-100 flex items-center gap-1.5 overflow-x-auto no-scrollbar text-[10px] shrink-0">
          <button
            type="button"
            onClick={() => onSendCommand("Explain the whole application architecture, GIS cadastral workflow, and 16-step SOP directives for our attached company.")}
            className="whitespace-nowrap px-2 py-0.5 bg-indigo-50 border border-indigo-200 hover:bg-indigo-100 text-indigo-900 rounded-full font-bold transition-colors cursor-pointer flex items-center gap-1"
          >
            🧭 App Architecture & SOP
          </button>
          <button
            type="button"
            onClick={() => onSendCommand("How do I use the Active Standing Register to add vehicles and materials, and link them to tasks and work assignments?")}
            className="whitespace-nowrap px-2 py-0.5 bg-amber-50 border border-amber-200 hover:bg-amber-100 text-amber-900 rounded-full font-bold transition-colors cursor-pointer flex items-center gap-1"
          >
            🚜 Vehicles & Materials
          </button>
          <button
            type="button"
            onClick={() => onSendCommand("Detail the 6 electronic digital scale protocols, 0.35kg tare deduction, and harvest weigh station integration.")}
            className="whitespace-nowrap px-2 py-0.5 bg-blue-50 border border-blue-200 hover:bg-blue-100 text-blue-900 rounded-full font-bold transition-colors cursor-pointer flex items-center gap-1"
          >
            ⚖️ 6 Scale Protocols
          </button>
          <button
            type="button"
            onClick={() => onSendCommand(`Provide a full status report on work assignments, bottlenecks, inventory FIFO, and machinery strictly within the radius of our attached company (${activeOrgName || 'Active Enterprise'}).`)}
            className="whitespace-nowrap px-2 py-0.5 bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 text-emerald-900 rounded-full font-bold transition-colors cursor-pointer flex items-center gap-1"
          >
            📍 Company Radius Intel
          </button>
          {isSystemAdmin && (
            <button
              type="button"
              onClick={() => {
                if (currentAiMode !== 'god_ai' && onSetAiMode) onSetAiMode('god_ai');
                onSendCommand("As the Root AI Assistant, analyze cross-enterprise benchmarks and comparative performance across all registered companies.");
              }}
              className="whitespace-nowrap px-2 py-0.5 bg-gradient-to-r from-amber-500 to-amber-600 text-white rounded-full font-bold transition-colors cursor-pointer hover:opacity-90 flex items-center gap-1 shadow-xs"
            >
              👑 Root AI: All Companies
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              setAnalysisInitialTool('disease');
              setAssistantView('analysis');
            }}
            className="whitespace-nowrap px-2 py-0.5 bg-emerald-100 border border-emerald-300 text-emerald-900 rounded-full font-bold transition-colors cursor-pointer hover:bg-emerald-200 flex items-center gap-1"
          >
            <Leaf size={10} className="text-emerald-700" /> 🔬 AI დიაგნოსტიკა
          </button>
          <button
            type="button"
            onClick={() => setIsGodAIHubOpen(true)}
            className="whitespace-nowrap px-2 py-0.5 bg-gradient-to-r from-emerald-100 to-amber-100 border border-emerald-200 text-emerald-900 rounded-full font-bold transition-colors cursor-pointer hover:opacity-90 flex items-center gap-1"
          >
            <Sparkles size={10} className="text-amber-600" /> Console
          </button>
        </div>
        
        {isSettingsOpen && (
            <div className="absolute inset-0 bg-white z-20 p-5 flex flex-col overflow-y-auto">
                 <div className="flex justify-between items-center pb-3 border-b border-slate-100 mb-4">
                     <div className="flex items-center gap-2">
                         <div className="w-7 h-7 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600">
                             <Settings className="w-4 h-4" />
                         </div>
                         <div>
                             <h3 className="text-sm font-black text-slate-800 uppercase tracking-tight">AI & Gemini Configuration</h3>
                             <p className="text-[10px] text-slate-400">Settings for agrimap.pro & local servers</p>
                         </div>
                     </div>
                     <button 
                        onClick={() => setIsSettingsOpen(false)}
                        className="p-1 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-700"
                     >
                        <XIcon className="h-5 w-5" />
                     </button>
                 </div>
                 
                 <div className="space-y-4 text-xs">
                     {/* Active Status Card */}
                     <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                         <div className="flex items-center justify-between">
                             <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Current Status</span>
                             {getActiveGeminiApiKey() ? (
                                 <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                                     <ShieldCheck className="w-3 h-3" /> Key Detected
                                 </span>
                             ) : (
                                 <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800">
                                     <AlertTriangle className="w-3 h-3" /> No Key
                                 </span>
                             )}
                         </div>
                         <div className="text-[11px] text-slate-600 flex items-center justify-between">
                             <span>Model Tier:</span>
                             <span className="font-mono text-slate-800 font-medium">gemini-3.8-flash (auto-fallback)</span>
                         </div>
                     </div>

                     {/* API Key Input */}
                     <div className="space-y-1.5">
                         <div className="flex items-center justify-between">
                             <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wide">
                                 Gemini API Key
                             </label>
                             <a 
                                 href="https://aistudio.google.com/apikey" 
                                 target="_blank" 
                                 rel="noopener noreferrer"
                                 className="text-[10px] font-semibold text-emerald-600 hover:text-emerald-700 inline-flex items-center gap-1"
                             >
                                 Get Free Key <ExternalLink className="w-2.5 h-2.5" />
                             </a>
                         </div>
                         <input 
                             type="password"
                             value={apiKeyInput}
                             onChange={(e) => setApiKeyInput(e.target.value)}
                             className="w-full p-2.5 text-xs font-mono border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none bg-slate-50/50"
                             placeholder="AIzaSy..."
                         />
                         <p className="text-[10px] text-slate-400 leading-relaxed">
                             Stored securely in your local browser storage. Allows AI assistance even on custom domains or offline testing servers.
                         </p>
                     </div>

                     {/* Test Result Message */}
                     {testStatus && (
                         <div className={`p-3 rounded-xl border text-xs leading-relaxed ${
                             testStatus.ok 
                                 ? 'bg-emerald-50 border-emerald-200 text-emerald-800' 
                                 : 'bg-red-50 border-red-200 text-red-800'
                         }`}>
                             <div className="flex items-start gap-2">
                                 {testStatus.ok ? (
                                     <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                                 ) : (
                                     <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                                 )}
                                 <div>
                                     <div className="font-bold">{testStatus.ok ? 'Connection Successful' : 'Connection Failed'}</div>
                                     <div className="mt-0.5 text-[11px] whitespace-pre-wrap">{testStatus.message}</div>
                                     {testStatus.latencyMs && (
                                         <div className="mt-1 text-[10px] text-emerald-700 font-mono">
                                             Model: {testStatus.model} | Latency: {testStatus.latencyMs}ms
                                         </div>
                                     )}
                                 </div>
                             </div>
                         </div>
                     )}

                     {/* Save Status Alert */}
                     {saveStatus && (
                         <div className={`p-2.5 rounded-xl border text-xs ${
                             saveStatus.type === 'success' 
                                 ? 'bg-emerald-50 border-emerald-200 text-emerald-800' 
                                 : 'bg-blue-50 border-blue-200 text-blue-800'
                         }`}>
                             {saveStatus.message}
                         </div>
                     )}

                     {/* Action Buttons */}
                     <div className="grid grid-cols-2 gap-2 pt-1">
                         <button 
                             onClick={handleTestConnection}
                             disabled={isTestingKey}
                             className="py-2.5 px-3 border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition disabled:opacity-50"
                         >
                             <RefreshCw className={`w-3.5 h-3.5 ${isTestingKey ? 'animate-spin text-emerald-600' : ''}`} />
                             {isTestingKey ? 'Testing...' : 'Test Connection'}
                         </button>
                         <button 
                             onClick={handleSaveApiKey}
                             className="py-2.5 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition shadow-sm"
                         >
                             <Key className="w-3.5 h-3.5" />
                             Save Key
                         </button>
                     </div>

                     {/* Clear Key Option */}
                     {apiKeyInput && (
                         <button 
                             onClick={handleClearApiKey}
                             className="w-full py-1.5 text-center text-[11px] text-slate-400 hover:text-red-600 transition flex items-center justify-center gap-1"
                         >
                             <Trash2 className="w-3 h-3" /> Remove Browser Key & Reset
                         </button>
                     )}

                     {/* Server Deployment Note */}
                     <div className="mt-3 pt-3 border-t border-slate-100 text-[10px] text-slate-400 leading-relaxed space-y-1">
                         <div className="font-semibold text-slate-600">Production / Local Server Tip:</div>
                         <div>Add <code className="bg-slate-100 px-1 py-0.5 rounded text-slate-700">GEMINI_API_KEY=your_key</code> to your server <code className="bg-slate-100 px-1 py-0.5 rounded text-slate-700">.env</code> so you do not have to enter it in each browser.</div>
                     </div>
                 </div>
            </div>
        )}

        {assistantView === 'analysis' ? (
          <div className="flex-grow min-h-0 overflow-hidden flex flex-col bg-white">
            <div className="p-2 bg-emerald-50/90 border-b border-emerald-100 flex items-center justify-between text-xs px-3">
              <span className="text-[11px] font-bold text-emerald-950 flex items-center gap-1.5 truncate">
                <Stethoscope size={13} className="text-emerald-600 shrink-0" />
                <span>{isKa ? 'AI დიაგნოსტიკა & კლინიკური ანალიტიკა' : 'AI Diagnostics & Clinical Suite'}</span>
              </span>
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsAnalysisModalOpen(true)}
                  className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-[10px] font-black uppercase flex items-center gap-1 shadow-xs cursor-pointer transition-all hover:scale-105"
                  title={isKa ? 'ცალკე Pop-up ფანჯარაში გახსნა (კონსოლის მსგავსად)' : 'Open in Pop-up Modal (like Console)'}
                >
                  <ExternalLink size={11} />
                  <span>{isKa ? 'Pop-up ფანჯარა' : 'Pop-up Window'}</span>
                </button>
                <button
                  type="button"
                  onClick={toggleEnlarged}
                  className="px-2 py-1 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-lg text-[10px] font-black uppercase flex items-center gap-1 cursor-pointer transition-all"
                  title={isEnlarged ? (isKa ? 'ფანჯრის შემცირება' : 'Standard Size') : (isKa ? 'ფანჯრის გაფართოება' : 'Enlarge Window')}
                >
                  {isEnlarged ? <Minimize2 size={11} /> : <Maximize2 size={11} />}
                  <span>{isEnlarged ? (isKa ? 'შემცირება' : 'Shrink') : (isKa ? 'გაფართოება' : 'Enlarge')}</span>
                </button>
              </div>
            </div>
            <AiAnalysisSuite
              mode={isEnlarged ? 'full' : 'compact'}
              initialTool={analysisInitialTool}
              activeOrgId={activeOrgId}
              currentUser={currentUser}
              onClose={() => setAssistantView('chat')}
              onAddTask={onAddTask}
              onAddNutritionPlan={onAddNutritionPlan}
            />
          </div>
        ) : (
          <>
            <div className="flex-grow min-h-0 overflow-y-auto p-4 space-y-4 bg-white">
              {messages.map((msg) => (
                  <Message 
                      key={msg.id} 
                      message={msg} 
                      onOpenSettings={() => setIsSettingsOpen(true)}
                  />
              ))}
              {isLoading && (
                  <div className="flex items-start gap-2.5">
                       <div className="flex-shrink-0 mt-1"><SparklesIcon className="h-5 w-5 text-green-500 animate-pulse"/></div>
                      <div className="p-3 rounded-lg bg-gray-100 text-gray-500 text-xs italic">
                          {isKa ? 'ფიქრობს...' : 'Thinking...'}
                      </div>
                  </div>
              )}
              <div ref={messagesEndRef} />
            </div>
            
            <form onSubmit={handleSend} className="p-3 border-t bg-slate-50 flex items-center gap-2 relative shrink-0">
              <div className="absolute -top-10 left-4">
                   <div className="flex items-center gap-2 px-3 py-1 bg-emerald-50 border border-emerald-100 rounded-lg shadow-sm">
                      <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      <span className="text-[8px] font-black text-emerald-700 uppercase tracking-widest leading-none">
                        {isKa ? 'AI & დიაგნოსტიკა დაკავშირებულია' : 'AI & DIAGNOSTICS LINKED'}
                      </span>
                  </div>
              </div>
              <input
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder={isKa ? "ჰკითხეთ AI-ს ან მოიძიეთ კლინიკური დიაგნოსტიკა..." : "Ask Gemini 2.5 AI Navigator & Copilot..."}
                className="flex-grow p-2 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-green-500 focus:outline-none bg-white transition-all"
                disabled={isListening}
              />
              <button
                type="button"
                onClick={handleVoiceCommand}
                disabled={isListening}
                className={`p-2 rounded-xl transition-colors ${isListening ? 'bg-red-100 text-red-600 animate-pulse' : 'hover:bg-slate-200 text-slate-400'}`}
                title={isKa ? "ხმოვანი ბრძანება" : "Speak command"}
              >
                <MicrophoneIcon className="h-5 w-5" />
              </button>
              <button
                type="submit"
                disabled={!inputValue.trim() || isListening}
                className="p-2 bg-green-600 text-white rounded-xl hover:bg-green-700 disabled:bg-slate-300 transition-colors cursor-pointer flex items-center justify-center min-w-[36px]"
                title={isKa ? "გაგზავნა" : "Send message"}
              >
                {isLoading ? (
                  <Sparkles className="h-5 w-5 animate-spin text-white" />
                ) : (
                  <ArrowUpCircleIcon className="h-5 w-5" />
                )}
              </button>
            </form>
          </>
        )}
         <style>{`
          @keyframes pulse {
            50% { opacity: .5; }
          }
          .animate-pulse {
            animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
          }
        `}</style>

        {/* Live Window Resize Edge Handles with Hover Arrows */}
        {/* Left Edge */}
        <div
          onPointerDown={(e) => startResize(e, 'left')}
          onPointerMove={handleResizePointerMove}
          onPointerUp={handleResizePointerUp}
          className="group/edge-left absolute -left-1.5 top-3 bottom-3 w-4 cursor-ew-resize z-[3550] flex items-center justify-center select-none touch-none"
          title={isKa ? "ზომის გაზრდა / შემცირება (გაჭიმეთ მარცხნივ/მარჯვნივ)" : "Live resize width (drag left/right)"}
        >
          <div className="w-1 h-full bg-emerald-500/0 group-hover/edge-left:bg-emerald-500/50 rounded-full transition-colors" />
          <div className="absolute left-0.5 bg-emerald-600 text-white rounded-full p-1 shadow-lg border border-emerald-300 opacity-0 group-hover/edge-left:opacity-100 transition-opacity pointer-events-none flex items-center justify-center scale-90">
            <ArrowLeftRight size={12} />
          </div>
        </div>

        {/* Right Edge */}
        <div
          onPointerDown={(e) => startResize(e, 'right')}
          onPointerMove={handleResizePointerMove}
          onPointerUp={handleResizePointerUp}
          className="group/edge-right absolute -right-1.5 top-3 bottom-3 w-4 cursor-ew-resize z-[3550] flex items-center justify-center select-none touch-none"
          title={isKa ? "ზომის გაზრდა / შემცირება (გაჭიმეთ მარცხნივ/მარჯვნივ)" : "Live resize width (drag left/right)"}
        >
          <div className="w-1 h-full bg-emerald-500/0 group-hover/edge-right:bg-emerald-500/50 rounded-full transition-colors" />
          <div className="absolute right-0.5 bg-emerald-600 text-white rounded-full p-1 shadow-lg border border-emerald-300 opacity-0 group-hover/edge-right:opacity-100 transition-opacity pointer-events-none flex items-center justify-center scale-90">
            <ArrowLeftRight size={12} />
          </div>
        </div>

        {/* Top Edge */}
        <div
          onPointerDown={(e) => startResize(e, 'top')}
          onPointerMove={handleResizePointerMove}
          onPointerUp={handleResizePointerUp}
          className="group/edge-top absolute -top-1.5 left-3 right-3 h-4 cursor-ns-resize z-[3550] flex items-center justify-center select-none touch-none"
          title={isKa ? "ზომის გაზრდა / შემცირება (გაჭიმეთ ზემოთ/ქვემოთ)" : "Live resize height (drag up/down)"}
        >
          <div className="h-1 w-full bg-emerald-500/0 group-hover/edge-top:bg-emerald-500/50 rounded-full transition-colors" />
          <div className="absolute top-0.5 bg-emerald-600 text-white rounded-full p-1 shadow-lg border border-emerald-300 opacity-0 group-hover/edge-top:opacity-100 transition-opacity pointer-events-none flex items-center justify-center scale-90">
            <ArrowUpDown size={12} />
          </div>
        </div>

        {/* Bottom Edge */}
        <div
          onPointerDown={(e) => startResize(e, 'bottom')}
          onPointerMove={handleResizePointerMove}
          onPointerUp={handleResizePointerUp}
          className="group/edge-bottom absolute -bottom-1.5 left-3 right-3 h-4 cursor-ns-resize z-[3550] flex items-center justify-center select-none touch-none"
          title={isKa ? "ზომის გაზრდა / შემცირება (გაჭიმეთ ზემოთ/ქვემოთ)" : "Live resize height (drag up/down)"}
        >
          <div className="h-1 w-full bg-emerald-500/0 group-hover/edge-bottom:bg-emerald-500/50 rounded-full transition-colors" />
          <div className="absolute bottom-0.5 bg-emerald-600 text-white rounded-full p-1 shadow-lg border border-emerald-300 opacity-0 group-hover/edge-bottom:opacity-100 transition-opacity pointer-events-none flex items-center justify-center scale-90">
            <ArrowUpDown size={12} />
          </div>
        </div>

        {/* Corner Handles */}
        <div
          onPointerDown={(e) => startResize(e, 'bottom-right')}
          onPointerMove={handleResizePointerMove}
          onPointerUp={handleResizePointerUp}
          className="group/corner-br absolute -bottom-2 -right-2 w-6 h-6 cursor-nwse-resize z-[3560] flex items-center justify-center select-none touch-none"
          title={isKa ? "დიაგონალური ზომის შეცვლა" : "Diagonal resize"}
        >
          <div className="w-3.5 h-3.5 border-r-2 border-b-2 border-slate-400 group-hover/corner-br:border-emerald-500 rounded-br transition-colors" />
        </div>
        <div
          onPointerDown={(e) => startResize(e, 'bottom-left')}
          onPointerMove={handleResizePointerMove}
          onPointerUp={handleResizePointerUp}
          className="group/corner-bl absolute -bottom-2 -left-2 w-6 h-6 cursor-nesw-resize z-[3560] flex items-center justify-center select-none touch-none"
          title={isKa ? "დიაგონალური ზომის შეცვლა" : "Diagonal resize"}
        >
          <div className="w-3.5 h-3.5 border-l-2 border-b-2 border-slate-400 group-hover/corner-bl:border-emerald-500 rounded-bl transition-colors" />
        </div>
        <div
          onPointerDown={(e) => startResize(e, 'top-right')}
          onPointerMove={handleResizePointerMove}
          onPointerUp={handleResizePointerUp}
          className="group/corner-tr absolute -top-2 -right-2 w-6 h-6 cursor-nesw-resize z-[3560] flex items-center justify-center select-none touch-none"
          title={isKa ? "დიაგონალური ზომის შეცვლა" : "Diagonal resize"}
        >
          <div className="w-3.5 h-3.5 border-r-2 border-t-2 border-slate-400 group-hover/corner-tr:border-emerald-500 rounded-tr transition-colors" />
        </div>
        <div
          onPointerDown={(e) => startResize(e, 'top-left')}
          onPointerMove={handleResizePointerMove}
          onPointerUp={handleResizePointerUp}
          className="group/corner-tl absolute -top-2 -left-2 w-6 h-6 cursor-nwse-resize z-[3560] flex items-center justify-center select-none touch-none"
          title={isKa ? "დიაგონალური ზომის შეცვლა" : "Diagonal resize"}
        >
          <div className="w-3.5 h-3.5 border-l-2 border-t-2 border-slate-400 group-hover/corner-tl:border-emerald-500 rounded-tl transition-colors" />
        </div>

        {/* Live Resizing Dimension Overlay Badge */}
        {isResizing && (
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[3600] px-4 py-2 bg-slate-900/95 backdrop-blur-md text-white rounded-2xl shadow-2xl border border-emerald-500/80 text-xs font-mono font-bold flex items-center gap-2.5 pointer-events-none animate-in fade-in zoom-in-95 duration-150">
            <ArrowLeftRight size={14} className="text-emerald-400 animate-pulse" />
            <span>{Math.round(panelSize.width)} × {Math.round(panelSize.height)} px</span>
            <span className="text-[10px] text-emerald-300 font-sans font-medium">
              {isKa ? 'რეალურ დროში ზომა' : 'Live Size'}
            </span>
          </div>
        )}
      </div>

      {onAddNote && (
          <GlobalVoiceNotesModal
              isOpen={isVoiceNotesOpen}
              onClose={() => setIsVoiceNotesOpen(false)}
              activeModuleName={activeModuleName}
              activeOrgId={activeOrgId}
              currentUser={currentUser}
              notes={notes}
              onAddNote={onAddNote}
              onDeleteNote={onDeleteNote}
              onDeleteMultipleNotes={onDeleteMultipleNotes}
          />
      )}

      {/* God AI & Agronomy PM Intelligence Hub Modal */}
      <GodAIIntelligenceHubModal
          isOpen={isGodAIHubOpen}
          onClose={() => setIsGodAIHubOpen(false)}
          activeOrgId={activeOrgId}
          activeOrgName={activeOrgName}
          currentUser={currentUser}
          isSystemAdmin={isSystemAdmin}
          currentAiMode={currentAiMode}
          onSetAiMode={(mode) => {
              if (onSetAiMode) onSetAiMode(mode);
          }}
          organizations={organizations}
          workAssignments={workAssignments}
          harvestEntries={harvestEntries}
          plantationFeatures={plantationFeatures}
          employees={employees}
          machinery={machinery}
          nutritionPlans={nutritionPlans}
          notes={notes}
          onNavigateToTasks={onNavigateToTasks}
      />

      {/* AI Analysis Suite Dedicated Pop-up Modal (Matches Console Window) */}
      <AiAnalysisModal
          isOpen={isAnalysisModalOpen}
          onClose={() => setIsAnalysisModalOpen(false)}
          initialTool={analysisInitialTool}
          activeOrgId={activeOrgId}
          activeOrgName={activeOrgName}
          currentUser={currentUser}
          onAddTask={onAddTask}
          onAddNutritionPlan={onAddNutritionPlan}
      />
    </>
  );
};

export default GlobalAssistantPanel;
