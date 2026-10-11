
import React, { useRef } from 'react';
import type { Project } from '../types';
import { XIcon, TrashIcon, ShareIcon, ArrowUpTrayIcon, ArrowDownTrayIcon } from './Icons';
import { useLanguage } from '../contexts/LanguageContext';

interface FieldManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  projects: Project[];
  onLoad: (project: Project) => void;
  onDelete: (projectId: string) => void;
  onShare: (project: Project) => void;
  onExport: () => void;
  onImport: (projects: Project[]) => void;
}

const FieldManagerModal: React.FC<FieldManagerModalProps> = ({ isOpen, onClose, projects, onLoad, onDelete, onShare, onExport, onImport }) => {
  const { language } = useLanguage();
  const isKa = language === 'ka';
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  if (!isOpen) {
    return null;
  }
  
  const sortedProjects = [...projects].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const content = e.target?.result as string;
          let parsed = JSON.parse(content);
          
          let projectsArray: any[] = [];
          if (Array.isArray(parsed)) {
              projectsArray = parsed;
          } else if (parsed && typeof parsed === 'object') {
              if (parsed.projects && Array.isArray(parsed.projects)) {
                  projectsArray = parsed.projects;
              } else if (parsed.id || parsed.name || parsed.data) {
                  projectsArray = [parsed];
              } else {
                  const newProj: Project = {
                      id: parsed.id || `proj-import-${Date.now()}`,
                      name: parsed.name || (isKa ? `იმპორტირებული ასლი ${parsed.timestamp ? parsed.timestamp.split('T')[0] : 'ავტო'}` : `Imported Backup ${parsed.timestamp ? parsed.timestamp.split('T')[0] : 'Auto'}`),
                      createdAt: parsed.createdAt || new Date().toISOString(),
                      data: parsed.data || parsed
                  };
                  projectsArray = [newProj];
              }
          }

          const formattedProjects: Project[] = projectsArray.map((p, idx) => {
              return {
                  id: p.id || `proj-import-${Date.now()}-${idx}`,
                  name: p.name || (isKa ? `იმპორტირებული ნაკვეთი ${idx + 1}` : `Imported Field ${idx + 1}`),
                  createdAt: p.createdAt || new Date().toISOString(),
                  data: p.data || p
              };
          });

          if (formattedProjects.length > 0) {
              onImport(formattedProjects);
          } else {
              throw new Error(isKa ? "ფაილში ნაკვეთის მონაცემები ვერ მოიძებნა." : "Could not find any valid field data in the file.");
          }
        } catch (error) {
          alert(`${isKa ? 'შეცდომა ფაილის იმპორტისას: ' : 'Error importing file: '}${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      };
      reader.onerror = () => {
        alert(isKa ? 'ფაილის წაკითხვის შეცდომა.' : 'Error reading file.');
      };
      reader.readAsText(file);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };


  return (
    <div className="fixed inset-0 bg-black/50 z-[5000] flex items-center justify-center p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl flex flex-col overflow-hidden" style={{height: 'min(600px, 80vh)'}} onClick={(e) => e.stopPropagation()}>
        <div className="p-4 border-b flex-shrink-0 flex justify-between items-center">
          <h2 className="text-lg font-bold text-gray-800">
            {isKa ? 'ნაკვეთების მენეჯერი' : 'Field Manager'}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 cursor-pointer">
            <XIcon className="h-6 w-6" />
          </button>
        </div>
        <div className="p-6 flex-grow overflow-y-auto">
          {sortedProjects.length === 0 ? (
            <div className="text-center text-gray-500 py-10">
              <p>{isKa ? 'შენახული ნაკვეთები არ გაქვთ.' : 'You have no saved fields.'}</p>
              <p className="text-sm">{isKa ? 'გამოიყენეთ ღილაკი "შენახვა" ჰედერში სამუშაოს შესანახად.' : 'Use the "Save Field" button in the header to save your work.'}</p>
            </div>
          ) : (
            <ul className="space-y-3">
              {sortedProjects.map(project => (
                <li key={project.id} className="bg-gray-50 p-3 rounded-xl flex items-center justify-between gap-3">
                  <div>
                    <p className="font-semibold text-gray-800">{project.name}</p>
                    <p className="text-xs text-gray-500">
                      {isKa ? 'შენახულია: ' : 'Saved on: '}{new Date(project.createdAt).toLocaleString(isKa ? 'ka-GE' : undefined)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button
                      onClick={() => onShare(project)}
                      className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-100 rounded-full transition cursor-pointer"
                      title={isKa ? "გაზიარება" : "Share Field"}
                    >
                      <ShareIcon className="h-5 w-5" />
                    </button>
                    <button
                      onClick={() => onDelete(project.id)}
                      className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-100 rounded-full transition cursor-pointer"
                      title={isKa ? "წაშლა" : "Delete Field"}
                    >
                      <TrashIcon className="h-5 w-5" />
                    </button>
                    <button
                      onClick={() => onLoad(project)}
                      className="px-4 py-2 bg-green-600 text-white text-sm font-semibold rounded-xl hover:bg-green-700 transition cursor-pointer"
                    >
                      {isKa ? 'ჩატვირთვა' : 'Load'}
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="p-4 bg-gray-50 rounded-b-xl flex-shrink-0 flex justify-between items-center">
            <div className="flex items-center gap-2">
                <input type="file" ref={fileInputRef} onChange={handleFileChange} accept=".json" className="hidden" />
                <button
                    onClick={handleImportClick}
                    className="px-3 py-2 text-sm bg-white border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 transition flex items-center gap-2 cursor-pointer"
                >
                    <ArrowUpTrayIcon className="h-4 w-4" /> {isKa ? 'იმპორტი' : 'Import'}
                </button>
                <button
                    onClick={onExport}
                    className="px-3 py-2 text-sm bg-white border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 transition flex items-center gap-2 cursor-pointer"
                >
                    <ArrowDownTrayIcon className="h-4 w-4" /> {isKa ? 'ყველას ექსპორტი' : 'Export All'}
                </button>
            </div>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-200 text-gray-800 rounded-xl hover:bg-gray-300 transition cursor-pointer"
          >
            {isKa ? 'დახურვა' : 'Close'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default FieldManagerModal;
