import React from 'react';
import WidgetActionToolbar from '../WidgetActionToolbar';

interface StatCardProps {
    title: string;
    value: string | number;
    color: string;
    onAddToDashboard?: () => void;
}

const StatCard: React.FC<StatCardProps> = ({ title, value, color, onAddToDashboard }) => (
    <div className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-slate-100 group">
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{title}</p>
        <p className={`text-2xl font-black mt-1 ${color}`}>{value}</p>
        {onAddToDashboard && (
            <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                <WidgetActionToolbar 
                    onAddToDashboard={onAddToDashboard} 
                    onShare={() => alert(`Shared stats: ${title} - ${value}`)} 
                />
            </div>
        )}
    </div>
);

export default StatCard;
