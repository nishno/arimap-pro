import React, { useState, useEffect, useRef } from 'react';
import { Note, User } from '../types';
import { useLanguage } from '../contexts/LanguageContext';
import { 
    MicrophoneIcon, 
    XIcon, 
    SparklesIcon, 
    TrashIcon, 
    TagIcon, 
    SpeakerWaveIcon, 
    StopIcon, 
    DocumentTextIcon, 
    MagnifyingGlassIcon,
    CheckIcon,
    FunnelIcon,
    ClockIcon,
    ArrowPathIcon
} from './Icons';
import { toast } from 'sonner';

interface GlobalVoiceNotesModalProps {
    isOpen: boolean;
    onClose: () => void;
    activeModuleName: string;
    activeOrgId: string;
    currentUser: User | null;
    notes: Note[];
    onAddNote: (
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
}

const PRESET_TAGS = [
    'irrigation-warning',
    'blueberry-sorting',
    'quality-control',
    'machinery-issue',
    'yield-update',
    'field-block-a',
    'field-block-b',
    'labor-shift',
    'urgent'
];

export const GlobalVoiceNotesModal: React.FC<GlobalVoiceNotesModalProps> = ({
    isOpen,
    onClose,
    activeModuleName,
    activeOrgId,
    currentUser,
    notes = [],
    onAddNote,
    onDeleteNote,
    onDeleteMultipleNotes
}) => {
    const { t } = useLanguage();
    const isKa = t('language') === 'ka' || localStorage.getItem('agri-app-lang') === 'ka';

    const [activeTab, setActiveTab] = useState<'record' | 'library'>('record');
    const [noteContent, setNoteContent] = useState('');
    const [selectedLanguage, setSelectedLanguage] = useState<'ka-GE' | 'en-US'>(isKa ? 'ka-GE' : 'en-US');
    const [selectedTags, setSelectedTags] = useState<string[]>([]);
    const [customTagInput, setCustomTagInput] = useState('');
    const [isRecording, setIsRecording] = useState(false);
    const [recordingTime, setRecordingTime] = useState(0);
    const [searchQuery, setSearchQuery] = useState('');
    const [moduleFilter, setModuleFilter] = useState<string>('all');
    const [isSpeakingId, setIsSpeakingId] = useState<string | null>(null);
    const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
    const [isCleanOldMenuOpen, setIsCleanOldMenuOpen] = useState(false);

    const recognitionRef = useRef<any>(null);
    const timerRef = useRef<any>(null);

    useEffect(() => {
        if (!confirmDeleteId) return;
        const timer = setTimeout(() => {
            setConfirmDeleteId(null);
        }, 4000);
        return () => clearTimeout(timer);
    }, [confirmDeleteId]);

    useEffect(() => {
        if (!isOpen) {
            stopRecording();
            setNoteContent('');
            setSelectedTags([]);
        }
    }, [isOpen]);

    useEffect(() => {
        if (isRecording) {
            timerRef.current = setInterval(() => {
                setRecordingTime(prev => prev + 1);
            }, 1000);
        } else {
            if (timerRef.current) clearInterval(timerRef.current);
            setRecordingTime(0);
        }
        return () => {
            if (timerRef.current) clearInterval(timerRef.current);
        };
    }, [isRecording]);

    const startRecording = () => {
        const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        if (!SpeechRecognition) {
            toast.error(isKa ? 'ხმოვანი შეყვანა არ არის მხარდაჭერილი თქვენს ბრაუზერში' : 'Voice recognition is not supported in this browser');
            return;
        }

        try {
            const recognition = new SpeechRecognition();
            recognitionRef.current = recognition;
            recognition.continuous = true;
            recognition.interimResults = true;
            recognition.lang = selectedLanguage;

            let interimText = '';

            recognition.onstart = () => {
                setIsRecording(true);
                toast.info(isKa ? 'ხმოვანი ჩაწერა დაიწყო... ისაუბრეთ ბუნებრივად' : 'Voice recording started... Speak naturally');
            };

            recognition.onresult = (event: any) => {
                let finalTranscript = '';
                for (let i = event.resultIndex; i < event.results.length; ++i) {
                    if (event.results[i].isFinal) {
                        finalTranscript += event.results[i][0].transcript + ' ';
                    } else {
                        interimText = event.results[i][0].transcript;
                    }
                }
                if (finalTranscript) {
                    setNoteContent(prev => (prev ? prev + ' ' + finalTranscript : finalTranscript).trim());
                }
            };

            recognition.onerror = (event: any) => {
                console.error('Speech recognition error:', event.error);
                if (event.error === 'not-allowed') {
                    toast.error(isKa ? 'მიკროფონის წვდომა უარყოფილია' : 'Microphone access denied');
                }
                setIsRecording(false);
            };

            recognition.onend = () => {
                setIsRecording(false);
            };

            recognition.start();
        } catch (err) {
            console.error('Failed to start speech recognition:', err);
            setIsRecording(false);
        }
    };

    const stopRecording = () => {
        if (recognitionRef.current) {
            try {
                recognitionRef.current.stop();
            } catch (e) {}
            recognitionRef.current = null;
        }
        setIsRecording(false);
    };

    const toggleRecording = () => {
        if (isRecording) {
            stopRecording();
        } else {
            startRecording();
        }
    };

    const handleAddTag = (tag: string) => {
        const clean = tag.trim().toLowerCase().replace(/^#/, '');
        if (!clean) return;
        if (!selectedTags.includes(clean)) {
            setSelectedTags(prev => [...prev, clean]);
        }
    };

    const handleRemoveTag = (tagToRemove: string) => {
        setSelectedTags(prev => prev.filter(t => t !== tagToRemove));
    };

    const handleSaveNote = async () => {
        if (!noteContent.trim()) {
            toast.error(isKa ? 'გთხოვთ ჩაწეროთ ან შეიყვანოთ შენიშვნის ტექსტი' : 'Please record or type your note content');
            return;
        }

        try {
            await onAddNote(
                noteContent.trim(),
                undefined,
                undefined,
                activeModuleName || 'General',
                selectedTags,
                true,
                selectedLanguage
            );

            toast.success(isKa ? 'ხმოვანი შენიშვნა წარმატებით შეინახა' : 'Global voice note saved successfully!');
            setNoteContent('');
            setSelectedTags([]);
            stopRecording();
            setActiveTab('library');
        } catch (err) {
            console.error('Error saving note:', err);
            toast.error(isKa ? 'შენიშვნის შენახვა ვერ მოხერხდა' : 'Failed to save note');
        }
    };

    const handleTextToSpeech = (note: Note) => {
        if (!('speechSynthesis' in window)) {
            toast.error(isKa ? 'ხმოვანი წაკითხვა არ არის მხარდაჭერილი' : 'Text-to-speech not supported');
            return;
        }

        if (isSpeakingId === note.id) {
            window.speechSynthesis.cancel();
            setIsSpeakingId(null);
            return;
        }

        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(note.content);
        utterance.lang = note.language || (isKa ? 'ka-GE' : 'en-US');
        utterance.rate = 0.95;

        utterance.onend = () => setIsSpeakingId(null);
        utterance.onerror = () => setIsSpeakingId(null);

        setIsSpeakingId(note.id);
        window.speechSynthesis.speak(utterance);
    };

    const formatTimer = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

    const handleDeleteSingle = (noteId: string) => {
        try {
            if (onDeleteNote) {
                onDeleteNote(noteId);
            } else {
                window.dispatchEvent(new CustomEvent('agrimap_delete_note', { detail: { id: noteId } }));
            }
        } catch (err) {
            console.error('Failed to delete note:', err);
        }
    };

    const handleDeleteOldNotes = (days: number) => {
        const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
        const oldNotes = filteredNotes.filter(n => new Date(n.timestamp).getTime() < cutoff);
        if (oldNotes.length === 0) {
            toast.info(isKa ? `${days} დღეზე ძველი ჩანაწერები არ მოიძებნა` : `No notes older than ${days} days found`);
            setIsCleanOldMenuOpen(false);
            return;
        }
        const ids = oldNotes.map(n => n.id);
        if (onDeleteMultipleNotes) {
            onDeleteMultipleNotes(ids);
        } else {
            ids.forEach(id => {
                if (onDeleteNote) onDeleteNote(id);
            });
            window.dispatchEvent(new CustomEvent('agrimap_delete_note', { detail: { ids } }));
        }
        setIsCleanOldMenuOpen(false);
    };

    const handleDeleteAllFiltered = () => {
        if (filteredNotes.length === 0) return;
        const ids = filteredNotes.map(n => n.id);
        if (onDeleteMultipleNotes) {
            onDeleteMultipleNotes(ids);
        } else {
            ids.forEach(id => {
                if (onDeleteNote) onDeleteNote(id);
            });
            window.dispatchEvent(new CustomEvent('agrimap_delete_note', { detail: { ids } }));
        }
        setIsCleanOldMenuOpen(false);
    };

    const filteredNotes = notes.filter(n => {
        const matchesOrg = !activeOrgId || n.organizationId === activeOrgId || !n.organizationId;
        if (!matchesOrg) return false;

        if (moduleFilter !== 'all') {
            if ((n.moduleName || 'General').toLowerCase() !== moduleFilter.toLowerCase()) return false;
        }

        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase();
            const textMatch = n.content.toLowerCase().includes(q);
            const tagMatch = n.tags?.some(t => t.toLowerCase().includes(q));
            const authorMatch = n.authorName?.toLowerCase().includes(q);
            const moduleMatch = n.moduleName?.toLowerCase().includes(q);
            return textMatch || tagMatch || authorMatch || moduleMatch;
        }

        return true;
    }).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    const availableModules = Array.from(new Set(notes.map(n => n.moduleName || 'General')));

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[9999] flex items-center justify-center p-4 sm:p-6 animate-fadeIn">
            <div className="bg-white w-full max-w-2xl rounded-[2.5rem] shadow-2xl border border-slate-100 flex flex-col max-h-[90vh] overflow-hidden animate-zoomIn">
                {/* Header */}
                <div className="p-6 pb-4 border-b border-slate-100 flex justify-between items-center bg-gradient-to-r from-emerald-50/80 via-white to-blue-50/80">
                    <div className="flex items-center gap-3">
                        <div className="w-12 h-12 bg-emerald-600 text-white rounded-2xl flex items-center justify-center shadow-lg shadow-emerald-200">
                            <MicrophoneIcon className="w-6 h-6 animate-pulse" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h2 className="text-lg font-black text-slate-900 uppercase tracking-tight">
                                    {isKa ? 'გლობალური AI ხმოვანი ჩანაწერები' : 'Global AI Voice-Enabled Notes'}
                                </h2>
                                <span className="px-2.5 py-0.5 bg-emerald-100 text-emerald-800 text-[10px] font-black uppercase tracking-wider rounded-full">
                                    AI Transcribed
                                </span>
                            </div>
                            <p className="text-xs font-semibold text-slate-500 flex items-center gap-1.5 mt-0.5">
                                <span>{isKa ? 'აქტიური მოდული:' : 'Active Context Module:'}</span>
                                <span className="text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200/60">
                                    {activeModuleName || 'General'}
                                </span>
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-full transition-colors cursor-pointer"
                    >
                        <XIcon className="w-6 h-6" />
                    </button>
                </div>

                {/* Tabs */}
                <div className="flex bg-slate-100 p-1.5 mx-6 mt-4 rounded-2xl">
                    <button
                        onClick={() => setActiveTab('record')}
                        className={`flex-1 py-2.5 px-4 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer ${
                            activeTab === 'record'
                                ? 'bg-white text-emerald-800 shadow-md shadow-slate-200'
                                : 'text-slate-500 hover:text-slate-800'
                        }`}
                    >
                        <MicrophoneIcon className="w-4 h-4 text-emerald-600" />
                        <span>{isKa ? 'ჩაწერა / ახალი' : 'Record & Create'}</span>
                    </button>
                    <button
                        onClick={() => setActiveTab('library')}
                        className={`flex-1 py-2.5 px-4 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer ${
                            activeTab === 'library'
                                ? 'bg-white text-slate-900 shadow-md shadow-slate-200'
                                : 'text-slate-500 hover:text-slate-800'
                        }`}
                    >
                        <DocumentTextIcon className="w-4 h-4 text-blue-600" />
                        <span>{isKa ? 'შენიშვნების ბიბლიოთეკა' : 'Notes Library'} ({filteredNotes.length})</span>
                    </button>
                </div>

                {/* Content Area */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                    {activeTab === 'record' ? (
                        <div className="space-y-6">
                            {/* Voice Recording Central Hero Controls */}
                            <div className="bg-gradient-to-b from-slate-50 to-emerald-50/40 p-6 rounded-[2rem] border border-slate-200/80 text-center flex flex-col items-center justify-center relative overflow-hidden">
                                <div className="flex items-center justify-between w-full mb-4 px-2">
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                                            {isKa ? 'ენა:' : 'Speech Language:'}
                                        </span>
                                        <div className="flex bg-white p-1 rounded-xl border border-slate-200 text-xs font-bold">
                                            <button
                                                type="button"
                                                onClick={() => setSelectedLanguage('ka-GE')}
                                                className={`px-2.5 py-1 rounded-lg transition-colors ${selectedLanguage === 'ka-GE' ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-100'}`}
                                            >
                                                🇬🇪 ქართული
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setSelectedLanguage('en-US')}
                                                className={`px-2.5 py-1 rounded-lg transition-colors ${selectedLanguage === 'en-US' ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-100'}`}
                                            >
                                                🇺🇸 English
                                            </button>
                                        </div>
                                    </div>

                                    {isRecording && (
                                        <div className="flex items-center gap-2 bg-red-100 text-red-700 px-3 py-1 rounded-full font-mono text-xs font-bold animate-pulse border border-red-200">
                                            <div className="w-2 h-2 rounded-full bg-red-600 animate-ping" />
                                            <span>{formatTimer(recordingTime)}</span>
                                        </div>
                                    )}
                                </div>

                                {/* Main Microphone Record Circle */}
                                <button
                                    type="button"
                                    onClick={toggleRecording}
                                    className={`relative w-24 h-24 rounded-full flex items-center justify-center transition-all duration-300 transform active:scale-95 shadow-xl cursor-pointer my-2 ${
                                        isRecording
                                            ? 'bg-red-600 text-white ring-8 ring-red-200 scale-105 shadow-red-300'
                                            : 'bg-emerald-600 text-white hover:bg-emerald-700 ring-8 ring-emerald-100 shadow-emerald-200'
                                    }`}
                                >
                                    {isRecording ? (
                                        <StopIcon className="w-10 h-10" />
                                    ) : (
                                        <MicrophoneIcon className="w-10 h-10" />
                                    )}
                                </button>

                                <div className="mt-2 text-center">
                                    <p className="text-xs font-black uppercase tracking-wider text-slate-700">
                                        {isRecording
                                            ? (isKa ? 'ჩაწერა მიმდინარეობს... დააჭირეთ დასასრულებლად' : 'Recording in progress... Click to stop')
                                            : (isKa ? 'დააჭირეთ მიკროფონს ჩაწერის დასაწყებად' : 'Click microphone to start voice recording')}
                                    </p>
                                    <p className="text-[11px] text-slate-400 font-medium mt-1">
                                        {isKa
                                            ? 'სისტემა ავტომატურად გადაიყვანს თქვენს ხმას ტექსტში'
                                            : 'System transcribes field speech into text automatically'}
                                    </p>
                                </div>
                            </div>

                            {/* Note Content Text Area */}
                            <div>
                                <div className="flex justify-between items-center mb-2">
                                    <label className="text-xs font-black uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                                        <DocumentTextIcon className="w-4 h-4 text-emerald-600" />
                                        <span>{isKa ? 'შენიშვნის ტექსტი (ტრანსკრიპცია)' : 'Note Content (Transcription)'}</span>
                                    </label>
                                    {noteContent && (
                                        <button
                                            type="button"
                                            onClick={() => setNoteContent('')}
                                            className="text-[10px] font-bold text-slate-400 hover:text-red-600 uppercase tracking-wider"
                                        >
                                            {isKa ? 'გასუფთავება' : 'Clear Text'}
                                        </button>
                                    )}
                                </div>
                                <textarea
                                    value={noteContent}
                                    onChange={(e) => setNoteContent(e.target.value)}
                                    rows={4}
                                    placeholder={
                                        isKa
                                            ? 'ისაუბრეთ მიკროფონით ან ჩაწერეთ შენიშვნა ხელით (მაგ: ბლოკ ა-ში სორტირება დასრულდა...)'
                                            : 'Speak with microphone or type manually (e.g. Block A blueberry sorting completed with 200 boxes...)'
                                    }
                                    className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all resize-none shadow-inner"
                                />
                            </div>

                            {/* Contextual Tagging */}
                            <div>
                                <label className="block text-xs font-black uppercase tracking-wider text-slate-700 mb-2 flex items-center gap-1.5">
                                    <TagIcon className="w-4 h-4 text-blue-600" />
                                    <span>{isKa ? 'კონტექსტური ტეგები' : 'Contextual Tags'}</span>
                                </label>

                                {/* Preset Tag Chips */}
                                <div className="flex flex-wrap gap-1.5 mb-3">
                                    {PRESET_TAGS.map(tag => {
                                        const isSelected = selectedTags.includes(tag);
                                        return (
                                            <button
                                                key={tag}
                                                type="button"
                                                onClick={() => isSelected ? handleRemoveTag(tag) : handleAddTag(tag)}
                                                className={`px-3 py-1 rounded-full text-xs font-bold transition-all cursor-pointer ${
                                                    isSelected
                                                        ? 'bg-blue-600 text-white shadow-xs'
                                                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200 border border-slate-200/60'
                                                }`}
                                            >
                                                #{tag}
                                            </button>
                                        );
                                    })}
                                </div>

                                {/* Custom Tag Input */}
                                <div className="flex gap-2">
                                    <input
                                        type="text"
                                        value={customTagInput}
                                        onChange={(e) => setCustomTagInput(e.target.value)}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') {
                                                e.preventDefault();
                                                handleAddTag(customTagInput);
                                                setCustomTagInput('');
                                            }
                                        }}
                                        placeholder={isKa ? 'დაამატეთ საკუთარი ტეგი (Enter)' : 'Add custom tag (press Enter)...'}
                                        className="flex-1 px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => {
                                            handleAddTag(customTagInput);
                                            setCustomTagInput('');
                                        }}
                                        className="px-4 py-2 bg-slate-800 text-white rounded-xl text-xs font-bold hover:bg-slate-900 transition-colors cursor-pointer"
                                    >
                                        + {isKa ? 'დამატება' : 'Add'}
                                    </button>
                                </div>

                                {/* Selected Tags Display */}
                                {selectedTags.length > 0 && (
                                    <div className="flex flex-wrap gap-1.5 mt-2 p-2 bg-blue-50/50 rounded-xl border border-blue-100">
                                        <span className="text-[10px] font-black uppercase text-blue-800 self-center mr-1">
                                            {isKa ? 'არჩეული:' : 'Selected:'}
                                        </span>
                                        {selectedTags.map(tag => (
                                            <span
                                                key={tag}
                                                className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-blue-600 text-white text-xs font-bold rounded-lg"
                                            >
                                                #{tag}
                                                <button
                                                    type="button"
                                                    onClick={() => handleRemoveTag(tag)}
                                                    className="hover:text-red-200 ml-1"
                                                >
                                                    ×
                                                </button>
                                            </span>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Save Action Bar */}
                            <div className="pt-4 border-t border-slate-100 flex justify-end gap-3">
                                <button
                                    type="button"
                                    onClick={onClose}
                                    className="px-6 py-3 text-xs font-black uppercase tracking-wider text-slate-600 hover:bg-slate-100 rounded-2xl transition-colors cursor-pointer"
                                >
                                    {isKa ? 'გაუქმება' : 'Cancel'}
                                </button>
                                <button
                                    type="button"
                                    onClick={handleSaveNote}
                                    className="px-8 py-3 text-xs font-black uppercase tracking-wider text-white bg-emerald-600 hover:bg-emerald-700 rounded-2xl shadow-lg shadow-emerald-200 transition-all flex items-center gap-2 cursor-pointer active:scale-95"
                                >
                                    <CheckIcon className="w-4 h-4" />
                                    <span>{isKa ? 'შენიშვნის შენახვა' : 'Save Voice Note'}</span>
                                </button>
                            </div>
                        </div>
                    ) : (
                        /* Notes Library Tab */
                        <div className="space-y-4">
                            {/* Search and Filters */}
                            <div className="flex flex-col sm:flex-row gap-3 bg-slate-50 p-3 rounded-2xl border border-slate-200">
                                <div className="relative flex-1">
                                    <MagnifyingGlassIcon className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                                    <input
                                        type="text"
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        placeholder={isKa ? 'ძებნა შენიშვნებში, ტეგებში, ავტორში...' : 'Search notes, tags, authors...'}
                                        className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500"
                                    />
                                </div>

                                <div className="flex items-center gap-2">
                                    <FunnelIcon className="w-4 h-4 text-slate-400 shrink-0" />
                                    <select
                                        value={moduleFilter}
                                        onChange={(e) => setModuleFilter(e.target.value)}
                                        className="bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 focus:outline-none cursor-pointer"
                                    >
                                        <option value="all">{isKa ? 'ყველა მოდული' : 'All Modules'}</option>
                                        {availableModules.map(m => (
                                            <option key={m} value={m}>{m}</option>
                                        ))}
                                    </select>

                                    {/* Clean / Delete Old Notes Menu */}
                                    <div className="relative">
                                        <button
                                            type="button"
                                            onClick={() => setIsCleanOldMenuOpen(prev => !prev)}
                                            className="flex items-center gap-1.5 px-3 py-2 bg-white hover:bg-red-50 text-slate-600 hover:text-red-600 border border-slate-200 hover:border-red-200 rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0 shadow-2xs active:scale-95"
                                            title={isKa ? 'ძველი ჩანაწერების გასუფთავება' : 'Delete Old Notes'}
                                        >
                                            <TrashIcon className="w-3.5 h-3.5 text-red-500" />
                                            <span className="hidden sm:inline">
                                                {isKa ? 'ძველების წაშლა' : 'Delete Old'}
                                            </span>
                                        </button>

                                        {isCleanOldMenuOpen && (
                                            <div 
                                                className="absolute right-0 top-full mt-1.5 w-60 bg-white rounded-2xl shadow-xl border border-slate-200 p-2 z-[100] text-slate-700 text-xs font-medium animate-in fade-in zoom-in-95 duration-100"
                                            >
                                                <div className="px-2 py-1 text-[10px] font-black uppercase text-slate-400 tracking-wider">
                                                    {isKa ? 'ძველი შენიშვნების წაშლა' : 'Delete Old Voice Notes'}
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={() => handleDeleteOldNotes(7)}
                                                    className="w-full text-left px-2.5 py-1.5 rounded-xl hover:bg-red-50 hover:text-red-700 flex items-center justify-between transition-colors cursor-pointer"
                                                >
                                                    <span>{isKa ? '> 7 დღეზე ძველი' : 'Older than 7 days'}</span>
                                                    <span className="text-[10px] font-bold text-slate-400">
                                                        ({filteredNotes.filter(n => Date.now() - new Date(n.timestamp).getTime() > 7 * 86400000).length})
                                                    </span>
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => handleDeleteOldNotes(30)}
                                                    className="w-full text-left px-2.5 py-1.5 rounded-xl hover:bg-red-50 hover:text-red-700 flex items-center justify-between transition-colors cursor-pointer"
                                                >
                                                    <span>{isKa ? '> 30 დღეზე ძველი' : 'Older than 30 days'}</span>
                                                    <span className="text-[10px] font-bold text-slate-400">
                                                        ({filteredNotes.filter(n => Date.now() - new Date(n.timestamp).getTime() > 30 * 86400000).length})
                                                    </span>
                                                </button>
                                                <div className="my-1 border-t border-slate-100" />
                                                <button
                                                    type="button"
                                                    onClick={handleDeleteAllFiltered}
                                                    className="w-full text-left px-2.5 py-1.5 rounded-xl hover:bg-red-100 text-red-600 font-bold flex items-center justify-between transition-colors cursor-pointer"
                                                >
                                                    <span>{isKa ? 'ყველა ნაჩვენების წაშლა' : 'Delete All Shown'}</span>
                                                    <span className="text-[10px] font-bold">({filteredNotes.length})</span>
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* List of Notes */}
                            {filteredNotes.length === 0 ? (
                                <div className="text-center py-12 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                                    <DocumentTextIcon className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                                    <p className="text-sm font-bold text-slate-600">
                                        {isKa ? 'ჩანაწერები არ მოიძებნა' : 'No voice notes found'}
                                    </p>
                                    <p className="text-xs text-slate-400 mt-1">
                                        {isKa ? 'ჩაწერთ პირველი ხმოვანი შენიშვნა "ჩაწერა" ჩანართიდან' : 'Record your first voice note from the "Record" tab'}
                                    </p>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {filteredNotes.map(note => {
                                        const isSpeaking = isSpeakingId === note.id;
                                        const isConfirming = confirmDeleteId === note.id;
                                        return (
                                            <div
                                                key={note.id}
                                                className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs hover:shadow-md transition-all flex flex-col gap-3 group"
                                            >
                                                <div className="flex items-start justify-between gap-2">
                                                    <div className="flex items-center gap-2 flex-wrap">
                                                        <span className="px-2.5 py-1 bg-emerald-100 text-emerald-800 text-[10px] font-black uppercase tracking-wider rounded-lg flex items-center gap-1">
                                                            <MicrophoneIcon className="w-3 h-3 text-emerald-600" />
                                                            {note.moduleName || 'General'}
                                                        </span>

                                                        <span className="text-[11px] font-bold text-slate-600 flex items-center gap-1">
                                                            <ClockIcon className="w-3.5 h-3.5 text-slate-400" />
                                                            {new Date(note.timestamp).toLocaleDateString()} {new Date(note.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                        </span>

                                                        <span className="text-[11px] text-slate-400">
                                                            • {note.authorName || 'Field Manager'}
                                                        </span>
                                                    </div>

                                                    <div className="flex items-center gap-1.5 shrink-0">
                                                        {/* Text to Speech Button */}
                                                        <button
                                                            type="button"
                                                            onClick={() => handleTextToSpeech(note)}
                                                            className={`p-1.5 rounded-xl border transition-all cursor-pointer ${
                                                                isSpeaking
                                                                    ? 'bg-emerald-600 text-white border-emerald-600 animate-pulse shadow-xs'
                                                                    : 'text-slate-400 hover:text-emerald-700 hover:bg-emerald-50 border-slate-200/80 bg-white'
                                                            }`}
                                                            title={isSpeaking ? (isKa ? "მოსმენის შეწყვეტა" : "Stop Reading") : (isKa ? "ხმამაღლა წაკითხვა" : "Read Aloud (Text to Speech)")}
                                                        >
                                                            <SpeakerWaveIcon className="w-4 h-4" />
                                                        </button>

                                                        {/* Delete Note Button - Always visible for deleting old voice notes */}
                                                        {isConfirming ? (
                                                            <div className="flex items-center gap-1 bg-red-50 p-1 rounded-xl border border-red-200 animate-in fade-in duration-150">
                                                                <span className="text-[10px] font-bold text-red-700 px-1">
                                                                    {isKa ? 'წავშალოთ?' : 'Delete?'}
                                                                </span>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => {
                                                                        handleDeleteSingle(note.id);
                                                                        setConfirmDeleteId(null);
                                                                    }}
                                                                    className="p-1 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-bold cursor-pointer transition-colors shadow-2xs"
                                                                    title={isKa ? 'დადასტურება' : 'Confirm Delete'}
                                                                >
                                                                    <CheckIcon className="w-3.5 h-3.5" />
                                                                </button>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => setConfirmDeleteId(null)}
                                                                    className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-200 rounded-lg text-xs cursor-pointer transition-colors"
                                                                    title={isKa ? 'გაუქმება' : 'Cancel'}
                                                                >
                                                                    <XIcon className="w-3.5 h-3.5" />
                                                                </button>
                                                            </div>
                                                        ) : (
                                                            <button
                                                                type="button"
                                                                onClick={() => setConfirmDeleteId(note.id)}
                                                                className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 bg-white border border-slate-200/80 hover:border-red-200 rounded-xl transition-all cursor-pointer shadow-2xs"
                                                                title={isKa ? "ძველი ჩანაწერის წაშლა" : "Delete Note"}
                                                            >
                                                                <TrashIcon className="w-4 h-4" />
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>

                                                <p className="text-sm font-medium text-slate-800 leading-relaxed bg-slate-50/70 p-3 rounded-xl border border-slate-100">
                                                    "{note.content}"
                                                </p>

                                                {/* Tags */}
                                                {note.tags && note.tags.length > 0 && (
                                                    <div className="flex flex-wrap gap-1">
                                                        {note.tags.map(tag => (
                                                            <span
                                                                key={tag}
                                                                className="px-2 py-0.5 bg-blue-50 text-blue-700 border border-blue-200/60 rounded-md text-[10px] font-bold"
                                                            >
                                                                #{tag}
                                                            </span>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default GlobalVoiceNotesModal;
