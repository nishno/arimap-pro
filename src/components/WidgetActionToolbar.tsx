
import React from 'react';
import { ShareIcon, PlusCircleIcon } from './Icons';

interface WidgetActionToolbarProps {
    onAddToDashboard: () => void;
    onShare: () => void;
    title?: string;
}

const WidgetActionToolbar: React.FC<WidgetActionToolbarProps> = ({ onAddToDashboard, onShare, title }) => {
    return (
        <div className="flex items-center gap-2 mt-2 pt-2 border-t border-gray-100">
            <button 
                onClick={onAddToDashboard} 
                className="flex items-center gap-1 text-xs font-semibold text-green-600 hover:text-green-800 hover:bg-green-50 px-2 py-1 rounded transition-colors"
                title="Add to Dashboard"
            >
                <PlusCircleIcon className="h-4 w-4" />
                Add to Dashboard
            </button>
            <div className="h-4 w-px bg-gray-200"></div>
            <button 
                onClick={onShare} 
                className="flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-800 hover:bg-blue-50 px-2 py-1 rounded transition-colors"
                title="Share"
            >
                <ShareIcon className="h-4 w-4" />
                Share
            </button>
        </div>
    );
};

export default WidgetActionToolbar;
