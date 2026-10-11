import React, { useState, useEffect } from 'react';
// FIX: Added SaveIcon to imports.
import { XIcon, SaveIcon } from './Icons';
import { useLanguage } from '../contexts/LanguageContext';

interface SaveFieldModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (projectName: string) => void;
}

const SaveFieldModal: React.FC<SaveFieldModalProps> = ({ isOpen, onClose, onSave }) => {
  const { language } = useLanguage();
  const isKa = language === 'ka';
  const [projectName, setProjectName] = useState('');

  useEffect(() => {
    if (isOpen) {
      setProjectName('');
    }
  }, [isOpen]);

  if (!isOpen) {
    return null;
  }

  const handleSave = () => {
    if (projectName.trim()) {
      onSave(projectName.trim());
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-[5000] flex items-center justify-center p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="p-4 border-b flex justify-between items-center">
          <h2 className="text-lg font-bold text-gray-800">
            {isKa ? 'ნაკვეთის / გეგმის შენახვა' : 'Save Field'}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 cursor-pointer">
            <XIcon className="h-6 w-6" />
          </button>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label htmlFor="project-name" className="block text-sm font-medium text-gray-700 mb-1">
              {isKa ? 'ნაკვეთის / პროექტის სახელი' : 'Field Name'}
            </label>
            <input
              type="text"
              id="project-name"
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              className="w-full p-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500 focus:outline-none"
              placeholder={isKa ? "მაგ. 'ჩემი ვენახის გეგმა'" : "e.g., 'My Vineyard Plan'"}
              autoFocus
            />
          </div>
        </div>
        <div className="p-4 bg-gray-50 rounded-b-lg flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-200 text-gray-800 rounded-xl hover:bg-gray-300 transition cursor-pointer"
          >
            {isKa ? 'გაუქმება' : 'Cancel'}
          </button>
          <button
            onClick={handleSave}
            disabled={!projectName.trim()}
            className="px-4 py-2 bg-green-600 text-white rounded-xl hover:bg-green-700 disabled:bg-gray-400 transition flex items-center gap-2 cursor-pointer"
          >
            <SaveIcon className="h-5 w-5" />
            {isKa ? 'შენახვა' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default SaveFieldModal;
