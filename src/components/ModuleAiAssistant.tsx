
import React, { useState, useRef, useEffect } from 'react';
import { MicrophoneIcon, StopIcon, AcademicCapIcon, XIcon, SparklesIcon } from './Icons';
import { toast } from 'sonner';

interface ModuleAiAssistantProps {
    onSendCommand: (command: string, context: any) => Promise<void>;
    isLoading: boolean;
    context?: any;
    title?: string;
    placeholder?: string;
}

const ModuleAiAssistant: React.FC<ModuleAiAssistantProps> = ({ 
    onSendCommand, 
    isLoading, 
    context, 
    title = "Agri Assistant",
    placeholder = "Ask me to create a task, analyze data, or give advice..."
}) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const [command, setCommand] = useState('');
    const [isRecording, setIsRecording] = useState(false);
    const recognitionRef = useRef<any>(null);

    useEffect(() => {
        if (typeof window !== 'undefined' && ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window)) {
            const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
            recognitionRef.current = new SpeechRecognition();
            recognitionRef.current.continuous = true;
            recognitionRef.current.interimResults = true;
            
            recognitionRef.current.onresult = (event: any) => {
                const transcript = Array.from(event.results)
                    .map((result: any) => result[0])
                    .map((result: any) => result.transcript)
                    .join('');
                setCommand(transcript);
            };

            recognitionRef.current.onend = () => {
                setIsRecording(false);
            };
        }
    }, []);

    const toggleRecording = () => {
        if (isRecording) {
            recognitionRef.current?.stop();
        } else {
            if (!recognitionRef.current) {
                toast.error("Speech recognition not supported in this browser.");
                return;
            }
            recognitionRef.current.start();
            setIsRecording(true);
            toast.info("Listening...");
        }
    };

    const handleSend = async (textOverride?: string) => {
        const textToSend = textOverride || command;
        if (!textToSend.trim() || isLoading) return;
        
        await onSendCommand(textToSend, context);
        setCommand('');
        setIsExpanded(false);
    };

    if (!isExpanded) {
        return (
            <button 
                onClick={() => setIsExpanded(true)}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-50 text-indigo-600 rounded-2xl hover:bg-indigo-100 transition-all border border-indigo-100 group shadow-sm"
            >
                <SparklesIcon className="h-4 w-4 animate-pulse group-hover:scale-110 transition-transform" />
                <span className="text-[10px] font-black uppercase tracking-widest">AI Assistant</span>
            </button>
        );
    }

    return (
        <div className="bg-white border border-indigo-100 rounded-2xl shadow-xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-300">
            <div className="p-3 bg-indigo-600 flex justify-between items-center">
                <h3 className="text-[10px] font-black text-white uppercase tracking-widest flex items-center gap-2">
                    <SparklesIcon className="h-3 w-3" /> {title}
                </h3>
                <button onClick={() => setIsExpanded(false)} className="text-white/80 hover:text-white">
                    <XIcon size={14} />
                </button>
            </div>
            <div className="p-4 space-y-3">
                <div className="flex flex-wrap gap-2">
                    <button 
                        onClick={() => handleSend("Analyze current state")}
                        className="px-3 py-1.5 bg-indigo-50 text-indigo-600 rounded-lg text-[10px] font-bold hover:bg-indigo-100 transition-colors border border-indigo-100"
                    >
                        Analyze View
                    </button>
                    <button 
                        onClick={() => handleSend("What should I do next?")}
                        className="px-3 py-1.5 bg-indigo-50 text-indigo-600 rounded-lg text-[10px] font-bold hover:bg-indigo-100 transition-colors border border-indigo-100"
                    >
                        Next Task?
                    </button>
                </div>

                <div className="relative">
                    <textarea 
                        className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-indigo-500 outline-none transition-all min-h-[80px]"
                        placeholder={placeholder}
                        value={command}
                        onChange={(e) => setCommand(e.target.value)}
                    />
                    <div className="absolute top-3 right-3">
                        <div className="flex items-center gap-1.5 px-2 py-0.5 bg-emerald-50 border border-emerald-100 rounded-md">
                            <div className="w-1 h-1 rounded-full bg-emerald-500 animate-pulse" />
                            <span className="text-[7px] font-black text-emerald-700 uppercase tracking-widest leading-none">EDD ACTIVE</span>
                        </div>
                    </div>
                    <div className="absolute bottom-2 right-2 flex gap-1">
                        <button 
                            onClick={toggleRecording}
                            className={`p-2 rounded-full transition-all ${isRecording ? 'bg-red-500 text-white animate-pulse' : 'bg-white text-slate-400 hover:text-indigo-600 border border-slate-200 shadow-sm'}`}
                        >
                            {isRecording ? <StopIcon size={14} /> : <MicrophoneIcon size={14} />}
                        </button>
                    </div>
                </div>
                <button 
                    onClick={() => handleSend()}
                    disabled={isLoading || !command.trim()}
                    className="w-full py-2 bg-indigo-600 text-white rounded-xl font-black uppercase tracking-widest text-[10px] hover:bg-indigo-700 transition-all disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg shadow-indigo-100"
                >
                    {isLoading ? (
                        <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                        <>
                            <AcademicCapIcon size={14} />
                            Analyze & Execute
                        </>
                    )}
                </button>
            </div>
        </div>
    );
};

export default ModuleAiAssistant;
