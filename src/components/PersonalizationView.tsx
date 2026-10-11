
import React, { useRef } from 'react';
import type { ThemeSettings } from '../types';
import { PhotoIcon, TrashIcon, SwatchIcon } from './Icons';

const THEME_PRESETS = [
    { name: 'Standard', primary: '#16a34a', bg: '#f3f4f6', text: '#1f2937', font: 'inter', image: '' },
    { name: 'Ocean', primary: '#0ea5e9', bg: '#f0f9ff', text: '#0c4a6e', font: 'sans', image: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1000&q=80' },
    { name: 'Earth', primary: '#ca8a04', bg: '#fefce8', text: '#422006', font: 'serif', image: 'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?auto=format&fit=crop&w=1000&q=80' },
    { name: 'Midnight', primary: '#6366f1', bg: '#1e1b4b', text: '#e2e8f0', font: 'mono', image: 'https://images.unsplash.com/photo-1475274047050-1d0c0975c63e?auto=format&fit=crop&w=1000&q=80' },
    { name: 'Forest', primary: '#15803d', bg: '#f0fdf4', text: '#14532d', font: 'inter', image: 'https://images.unsplash.com/photo-1448375240586-dfd8d395ea6c?auto=format&fit=crop&w=1000&q=80' },
    { name: 'Berry', primary: '#db2777', bg: '#fdf2f8', text: '#831843', font: 'sans', image: '' },
];

interface PersonalizationViewProps {
    themeSettings?: ThemeSettings;
    onSetThemeSettings: (settings: ThemeSettings) => void;
}

const PersonalizationView: React.FC<PersonalizationViewProps> = ({ themeSettings, onSetThemeSettings }) => {
    const currentSettings = themeSettings || { font: 'inter', primaryColor: '#16a34a', backgroundColor: '#f3f4f6', textColor: '#1f2937' };
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (ev) => {
                onSetThemeSettings({ ...currentSettings, backgroundImage: ev.target?.result as string });
            };
            reader.readAsDataURL(file);
        }
    };

    const applyPreset = (preset: typeof THEME_PRESETS[0]) => {
        onSetThemeSettings({
            font: preset.font as any,
            primaryColor: preset.primary,
            backgroundColor: preset.bg,
            textColor: preset.text,
            backgroundImage: preset.image
        });
    };

    return (
        <main className="flex-1 bg-gray-100 overflow-y-auto p-8">
            <div className="max-w-6xl mx-auto space-y-8">
                <div>
                    <h1 className="text-3xl font-bold text-gray-800 flex items-center gap-3">
                        <SwatchIcon className="h-8 w-8 text-green-600" />
                        Personalization
                    </h1>
                    <p className="mt-1 text-gray-500">Customize the look and feel of your workspace.</p>
                </div>

                <div className="space-y-6">
                    {/* Preview Area */}
                    <div className="bg-white p-6 rounded-xl shadow-sm border">
                        <h3 className="text-lg font-bold text-gray-800 mb-4">Current Desktop</h3>
                        <div 
                            className="h-48 rounded-lg border shadow-inner relative overflow-hidden transition-all duration-300"
                            style={{ 
                                backgroundColor: currentSettings.backgroundColor,
                                backgroundImage: currentSettings.backgroundImage ? `url(${currentSettings.backgroundImage})` : 'none',
                                backgroundSize: 'cover',
                                backgroundPosition: 'center',
                            }}
                        >
                            <div className="absolute inset-0 bg-black/10"></div>
                            <div className="absolute top-8 left-8 right-8 bottom-8 bg-white/90 backdrop-blur-sm rounded-lg shadow-lg p-4 flex flex-col gap-3">
                                <div className="h-4 w-1/3 rounded" style={{ backgroundColor: currentSettings.primaryColor }}></div>
                                <div className="space-y-2">
                                    <div className="h-3 w-full bg-gray-200 rounded"></div>
                                    <div className="h-3 w-5/6 bg-gray-200 rounded"></div>
                                </div>
                                <button className="mt-auto self-start px-4 py-1.5 rounded text-white text-sm font-medium" style={{ backgroundColor: currentSettings.primaryColor, fontFamily: currentSettings.font }}>
                                    Button Preview
                                </button>
                                <p className="text-xs mt-1" style={{ color: currentSettings.textColor, fontFamily: currentSettings.font }}>
                                    Sample text preview for font color.
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Presets */}
                    <div className="bg-white p-6 rounded-xl shadow-sm border">
                        <h3 className="text-lg font-bold text-gray-800 mb-4">Select a theme to apply</h3>
                        <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
                            {THEME_PRESETS.map(preset => (
                                <button 
                                    key={preset.name}
                                    onClick={() => applyPreset(preset)}
                                    className="flex flex-col gap-2 group text-left"
                                >
                                    <div className="h-20 w-full rounded-lg border shadow-sm relative overflow-hidden group-hover:ring-2 ring-offset-2 ring-green-500 transition-all">
                                        <div className="absolute inset-0" style={{ backgroundColor: preset.bg }}>
                                            {preset.image && <img src={preset.image} className="w-full h-full object-cover opacity-80" alt="" />}
                                        </div>
                                        <div className="absolute bottom-2 right-2 w-4 h-4 rounded-full shadow-md" style={{ backgroundColor: preset.primary }}></div>
                                    </div>
                                    <span className="text-sm font-medium text-gray-700 text-center w-full">{preset.name}</span>
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Background */}
                        <div className="bg-white p-6 rounded-xl shadow-sm border">
                            <h3 className="text-lg font-bold text-gray-800 mb-4">Background</h3>
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">Choose a photo</label>
                                    <div className="flex gap-2">
                                        <button onClick={() => fileInputRef.current?.click()} className="flex-1 py-3 border-2 border-dashed border-gray-300 rounded-lg hover:bg-gray-50 flex items-center justify-center gap-2 text-gray-600 transition-colors">
                                            <PhotoIcon className="h-5 w-5" /> Upload Photo
                                        </button>
                                        <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleFileChange} />
                                        {currentSettings.backgroundImage && (
                                            <button 
                                                onClick={() => onSetThemeSettings({...currentSettings, backgroundImage: ''})} 
                                                className="px-4 py-3 bg-red-100 text-red-600 rounded-lg hover:bg-red-200"
                                                title="Remove Image"
                                            >
                                                <TrashIcon className="h-5 w-5" />
                                            </button>
                                        )}
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">Or Solid Background Color</label>
                                    <div className="flex items-center gap-3">
                                        <input 
                                            type="color" 
                                            value={currentSettings.backgroundColor}
                                            onChange={(e) => onSetThemeSettings({...currentSettings, backgroundColor: e.target.value, backgroundImage: ''})}
                                            className="h-10 w-full rounded cursor-pointer"
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Colors & Fonts */}
                        <div className="bg-white p-6 rounded-xl shadow-sm border space-y-6">
                            <div>
                                <h3 className="text-lg font-bold text-gray-800 mb-4">Colors</h3>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Accent Color</label>
                                        <div className="flex gap-2 items-center">
                                            <input 
                                                type="color" 
                                                value={currentSettings.primaryColor}
                                                onChange={(e) => onSetThemeSettings({...currentSettings, primaryColor: e.target.value})}
                                                className="h-8 w-8 rounded overflow-hidden cursor-pointer border-0 p-0"
                                            />
                                            <span className="text-xs text-gray-500 font-mono">{currentSettings.primaryColor}</span>
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Font (Text) Color</label>
                                        <div className="flex gap-2 items-center">
                                            <input 
                                                type="color" 
                                                value={currentSettings.textColor || '#1f2937'}
                                                onChange={(e) => onSetThemeSettings({...currentSettings, textColor: e.target.value})}
                                                className="h-8 w-8 rounded overflow-hidden cursor-pointer border-0 p-0"
                                            />
                                            <span className="text-xs text-gray-500 font-mono">{currentSettings.textColor || '#1f2937'}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="pt-4 border-t">
                                <h3 className="text-lg font-bold text-gray-800 mb-4">Fonts</h3>
                                <div className="grid grid-cols-4 gap-2">
                                    {['inter', 'serif', 'mono', 'sans'].map((font) => (
                                        <button
                                            key={font}
                                            onClick={() => onSetThemeSettings({ ...currentSettings, font: font as any })}
                                            className={`py-2 px-3 rounded border text-sm capitalize ${currentSettings.font === font ? 'bg-gray-800 text-white border-gray-800' : 'bg-white text-gray-700 hover:bg-gray-50'}`}
                                            style={{ fontFamily: font === 'inter' ? 'Inter, sans-serif' : font === 'serif' ? 'serif' : font === 'mono' ? 'monospace' : 'sans-serif' }}
                                        >
                                            {font}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </main>
    );
};

export default PersonalizationView;
