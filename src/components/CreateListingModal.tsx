import React, { useState, useRef, useEffect } from 'react';
import type { User, Listing, MarketplaceItemAnalysis, AvailabilityStatus } from '../types';
import { XCircleIcon, SparklesIcon, ArrowUpTrayIcon } from './Icons';
import { analyzeMarketplaceItem } from '../services/geminiService';
import { useLanguage } from '../contexts/LanguageContext';

interface CreateListingModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (listing: Partial<Listing>, file: File | null) => void;
    currentUser: User;
    mapCenter: [number, number];
    listingToEdit: Listing | null;
}

const fileToDataUrl = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = error => reject(error);
        reader.readAsDataURL(file);
    });
};

const fileToBase64 = (dataUrl: string): string => dataUrl.split(',')[1];

const getInitialFormState = () => ({
    cropType: '',
    variety: '',
    quantity: 1,
    maxQuantity: undefined as number | undefined,
    pricePerUnit: 10,
    unit: 'kg',
    availabilityStatus: 'now' as AvailabilityStatus,
    availableNeededDate: new Date().toISOString().split('T')[0],
    qualityGrade: 'Grade A',
    caliber: '',
    certifications: '',
    description: '',
    region: '',
    locationName: '',
    characteristicsDescription: '',
});


const CreateListingModal: React.FC<CreateListingModalProps> = ({ isOpen, onClose, onSave, currentUser, mapCenter, listingToEdit }) => {
    const { formatCurrency, currency } = useLanguage();
    const [listingType, setListingType] = useState<'sale' | 'wanted'>(listingToEdit?.type || 'sale');
    const [formState, setFormState] = useState(getInitialFormState());
    
    const [aiAnalysis, setAiAnalysis] = useState<MarketplaceItemAnalysis | null>(null);
    const [uploadedFile, setUploadedFile] = useState<File | null>(null);
    const [mediaPreview, setMediaPreview] = useState<string | null>(null);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [analysisError, setAnalysisError] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    
    useEffect(() => {
        if (isOpen) {
            if (listingToEdit) {
                setListingType(listingToEdit.type);
                setFormState({
                    cropType: listingToEdit.cropType || '',
                    variety: listingToEdit.cropVariety || '',
                    quantity: listingToEdit.quantity,
                    maxQuantity: listingToEdit.maxQuantity,
                    pricePerUnit: listingToEdit.pricePerUnit || listingToEdit.auctionDetails?.startPrice || 0,
                    unit: listingToEdit.unit,
                    availabilityStatus: listingToEdit.availabilityStatus || 'now',
                    availableNeededDate: (listingToEdit.auctionDetails?.availableFrom || listingToEdit.neededDate || new Date()).toString().split('T')[0],
                    qualityGrade: listingToEdit.qualityGrade || 'Grade A',
                    caliber: listingToEdit.caliber || '',
                    certifications: listingToEdit.certifications || '',
                    description: listingToEdit.additionalDescription || listingToEdit.description || '',
                    region: listingToEdit.region || '',
                    locationName: listingToEdit.locationName || '',
                    characteristicsDescription: listingToEdit.characteristicsDescription || '',
                });
                setMediaPreview(listingToEdit.mediaUrl || null);
                setAiAnalysis(listingToEdit.aiAnalysis || null);
            } else {
                setListingType('sale');
                setFormState(getInitialFormState());
                setAiAnalysis(null);
                setUploadedFile(null);
                setMediaPreview(null);
                setAnalysisError(null);
            }
        }
    }, [listingToEdit, isOpen]);


    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        const { name, value, type } = e.target;
        setFormState(p => ({ ...p, [name]: type === 'number' ? parseFloat(value) : value }));
    };
    
    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setUploadedFile(file);
        const dataUrl = await fileToDataUrl(file);
        setMediaPreview(dataUrl);
    };

    const handleAnalyze = async () => {
        if (!mediaPreview || !uploadedFile) return;
        setIsAnalyzing(true);
        setAnalysisError(null);
        try {
            const base64 = fileToBase64(mediaPreview);
            const analysis = await analyzeMarketplaceItem(base64, uploadedFile.type);
            setAiAnalysis(analysis);
            setFormState(p => ({
                ...p,
                description: `${analysis.quality}. Key features: ${analysis.mainFeatures.join(', ')}. Characteristics: ${analysis.characteristics.join(', ')}.`,
            }));
        } catch (err) {
            setAnalysisError(err instanceof Error ? err.message : 'Analysis failed');
        } finally {
            setIsAnalyzing(false);
        }
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        
        const partialListing: Partial<Listing> = {
            id: listingToEdit?.id,
            type: listingType,
            title: `${formState.cropType}${formState.variety ? ` - ${formState.variety}` : ''}`,
            description: formState.description.slice(0, 150), // Short description for previews
            additionalDescription: formState.description,
            category: 'Produce',
            cropType: formState.cropType,
            cropVariety: formState.variety,
            quantity: formState.quantity,
            unit: formState.unit,
            mediaUrl: mediaPreview || undefined,
            aiAnalysis,
            qualityGrade: formState.qualityGrade,
            caliber: formState.caliber,
            certifications: formState.certifications,
            region: formState.region,
            locationName: formState.locationName,
        };

        if (listingType === 'sale') {
            partialListing.availabilityStatus = formState.availabilityStatus;
            partialListing.maxQuantity = formState.maxQuantity;
            partialListing.auctionDetails = {
                status: listingToEdit?.auctionDetails?.status || 'active',
                availableFrom: new Date(formState.availableNeededDate).toISOString(),
                auctionEnds: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
                startPrice: formState.pricePerUnit,
                currentPrice: listingToEdit?.auctionDetails?.currentPrice || formState.pricePerUnit,
                highestBidderId: listingToEdit?.auctionDetails?.highestBidderId,
            };
        } else { // 'wanted'
            partialListing.neededDate = new Date(formState.availableNeededDate).toISOString();
            partialListing.pricePerUnit = formState.pricePerUnit;
            partialListing.characteristicsDescription = formState.characteristicsDescription;
        }
        
        onSave(partialListing, uploadedFile);
    };

    if (!isOpen) return null;
    
    const renderSaleFields = () => (
        <>
            <div className="space-y-4">
                <h4 className="font-semibold text-gray-500">Crop Details</h4>
                <div className="grid grid-cols-2 gap-4">
                    <div><label>Crop Type*</label><input name="cropType" value={formState.cropType} onChange={handleChange} className="input-field mt-1" required /></div>
                    <div><label>Variety</label><input name="variety" value={formState.variety} onChange={handleChange} className="input-field mt-1" /></div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label>Quantity ({formState.unit})*</label>
                        <div className="flex items-center gap-2 mt-1">
                            <input name="quantity" type="number" value={formState.quantity} onChange={handleChange} className="input-field" placeholder="From" required />
                             <span className="text-gray-500">-</span>
                             <input name="maxQuantity" type="number" value={formState.maxQuantity || ''} onChange={handleChange} className="input-field" placeholder="To (optional)" />
                        </div>
                    </div>
                </div>
                 <div className="grid grid-cols-2 gap-4 items-end">
                    <div><label>Price per {formState.unit} ({currency})*</label><input name="pricePerUnit" type="number" value={formState.pricePerUnit} onChange={handleChange} className="input-field mt-1" required /></div>
                    <div><label>Unit</label><select name="unit" value={formState.unit} onChange={handleChange} className="input-field mt-1"><option value="kg">kg</option><option value="ton">ton</option><option value="pcs">pcs</option></select></div>
                </div>
                <div className="grid grid-cols-2 gap-4 items-end">
                     <div><label>Availability</label><select name="availabilityStatus" value={formState.availabilityStatus} onChange={handleChange} className="input-field mt-1"><option value="now">Available Now</option><option value="pre-harvest">Pre-Harvest</option><option value="future">Future</option></select></div>
                     <div><label>Available Date*</label><input name="availableNeededDate" type="date" value={formState.availableNeededDate} onChange={handleChange} className="input-field mt-1" required /></div>
                </div>
                <h4 className="font-semibold text-gray-500 pt-2">Quality Details</h4>
                <div className="grid grid-cols-2 gap-4">
                    <div><label>Quality Grade</label><select name="qualityGrade" value={formState.qualityGrade} onChange={handleChange} className="input-field mt-1"><option>Grade A</option><option>Grade B</option><option>Grade C</option></select></div>
                    <div><label>Caliber</label><input name="caliber" value={formState.caliber} onChange={handleChange} className="input-field mt-1" placeholder="e.g., 14mm+" /></div>
                </div>
                <div><label>Certifications</label><input name="certifications" value={formState.certifications} onChange={handleChange} className="input-field mt-1" placeholder="e.g., Organic, GlobalG.A.P." /></div>
                <div><label>Description</label><textarea name="description" value={formState.description} onChange={handleChange} className="input-field mt-1" rows={4}></textarea></div>
            </div>
            <div className="space-y-4">
                 <h4 className="font-semibold text-gray-500">Location</h4>
                 <div className="grid grid-cols-2 gap-4">
                    <div><label>Region</label><input name="region" value={formState.region} onChange={handleChange} className="input-field mt-1" /></div>
                    <div><label>Location Name</label><input name="locationName" value={formState.locationName} onChange={handleChange} className="input-field mt-1" /></div>
                 </div>
                 <p className="text-xs text-gray-500 -mt-2">Latitude and longitude can be set by clicking on the map later.</p>

                 <h4 className="font-semibold text-gray-500 pt-2">Media</h4>
                 <input type="file" accept="image/*" ref={fileInputRef} onChange={handleFileChange} className="hidden" />
                <button type="button" onClick={() => fileInputRef.current?.click()} className="w-full p-4 border-2 border-dashed rounded-lg text-center hover:border-green-500 h-24 flex flex-col items-center justify-center">
                    <ArrowUpTrayIcon className="h-6 w-6 text-gray-400" />
                    <span className="mt-1 text-sm text-gray-600">Upload Photo</span>
                </button>
                 {mediaPreview && (
                    <div className="p-2 border rounded-lg">
                        <img src={mediaPreview} alt="Preview" className="w-full h-32 object-contain rounded" />
                        <button type="button" onClick={handleAnalyze} disabled={isAnalyzing || !uploadedFile} className="w-full mt-2 text-sm button-primary flex items-center justify-center gap-2">
                            <SparklesIcon className="h-4 w-4" /> {isAnalyzing ? 'Analyzing...' : 'AI Analysis'}
                        </button>
                        {analysisError && <p className="text-xs text-red-500 text-center">{analysisError}</p>}
                    </div>
                )}
            </div>
        </>
    );

     const renderWantedFields = () => (
        <>
            <div className="space-y-4">
                <h4 className="font-semibold text-gray-500">Crop Details</h4>
                <div className="grid grid-cols-2 gap-4">
                    <div><label>Crop Type*</label><input name="cropType" value={formState.cropType} onChange={handleChange} className="input-field mt-1" required /></div>
                    <div><label>Variety</label><input name="variety" value={formState.variety} onChange={handleChange} className="input-field mt-1" /></div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                     <div><label>Quantity ({formState.unit})*</label><input name="quantity" type="number" value={formState.quantity} onChange={handleChange} className="input-field mt-1" required /></div>
                     <div><label>Unit</label><select name="unit" value={formState.unit} onChange={handleChange} className="input-field mt-1"><option value="kg">kg</option><option value="ton">ton</option><option value="pcs">pcs</option></select></div>
                </div>
                 <div className="grid grid-cols-2 gap-4 items-end">
                    <div><label>Target Price ({currency} / {formState.unit})</label><input name="pricePerUnit" type="number" value={formState.pricePerUnit} onChange={handleChange} className="input-field mt-1" /></div>
                     <div><label>Needed Date*</label><input name="availableNeededDate" type="date" value={formState.availableNeededDate} onChange={handleChange} className="input-field mt-1" required /></div>
                </div>
                <h4 className="font-semibold text-gray-500 pt-2">Quality Details</h4>
                <div className="grid grid-cols-2 gap-4">
                    <div><label>Quality Grade</label><select name="qualityGrade" value={formState.qualityGrade} onChange={handleChange} className="input-field mt-1"><option>Grade A</option><option>Grade B</option><option>Grade C</option></select></div>
                    <div><label>Caliber</label><input name="caliber" value={formState.caliber} onChange={handleChange} className="input-field mt-1" placeholder="e.g., 14mm+" /></div>
                </div>
                <div><label>Certifications</label><input name="certifications" value={formState.certifications} onChange={handleChange} className="input-field mt-1" placeholder="e.g., Organic, GlobalG.A.P." /></div>
                <div><label>Description of Requirements</label><textarea name="characteristicsDescription" value={formState.characteristicsDescription} onChange={handleChange} className="input-field mt-1" rows={4}></textarea></div>
            </div>
             <div className="space-y-4">
                 <h4 className="font-semibold text-gray-500">Location</h4>
                 <div className="grid grid-cols-2 gap-4">
                    <div><label>Region</label><input name="region" value={formState.region} onChange={handleChange} className="input-field mt-1" /></div>
                    <div><label>Location Name</label><input name="locationName" value={formState.locationName} onChange={handleChange} className="input-field mt-1" /></div>
                 </div>
                 <p className="text-xs text-gray-500 -mt-2">Latitude and longitude can be set by clicking on the map later.</p>
            </div>
        </>
    );

    return (
        <div className="fixed inset-0 bg-black/50 z-[5000] flex items-center justify-center p-4" onClick={onClose}>
            <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl" onClick={e => e.stopPropagation()}>
                <div className="p-4 border-b flex justify-between items-center">
                    <h2 className="text-lg font-bold text-gray-800">{listingToEdit ? 'Edit Listing' : 'Create New Marketplace Listing'}</h2>
                    <button onClick={onClose}><XCircleIcon className="h-6 w-6" /></button>
                </div>
                <form onSubmit={handleSubmit}>
                    <div className="p-6 max-h-[70vh] overflow-y-auto">
                        <div className="inline-flex rounded-md shadow-sm">
                            <button type="button" onClick={() => setListingType('sale')} className={`px-4 py-2 text-sm font-medium border rounded-l-lg ${listingType === 'sale' ? 'bg-gray-200 z-10 ring-2 ring-green-500' : 'bg-white hover:bg-gray-50'}`}>
                                For Sale
                            </button>
                            <button type="button" onClick={() => setListingType('wanted')} className={`px-4 py-2 text-sm font-medium border-t border-b border-r rounded-r-lg ${listingType === 'wanted' ? 'bg-gray-200 z-10 ring-2 ring-green-500' : 'bg-white hover:bg-gray-50'}`}>
                                Wanted
                            </button>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4 mt-4 text-sm">
                            {listingType === 'sale' ? renderSaleFields() : renderWantedFields()}
                        </div>
                    </div>

                    <div className="p-4 bg-gray-50 flex justify-end gap-3">
                        <button type="button" onClick={onClose} className="button-secondary">Cancel</button>
                        <button type="submit" className="button-primary">{listingToEdit ? 'Save Changes' : 'Create Listing'}</button>
                    </div>
                </form>
            </div>
             <style>{`
                .input-field { width: 100%; padding: 0.5rem; border: 1px solid #d1d5db; border-radius: 0.375rem; background-color: white; }
                .input-field::placeholder { color: #9ca3af; }
                label { font-weight: 500; color: #374151; display: block; margin-bottom: 0.25rem; }
                h4 { font-size: 0.875rem; text-transform: uppercase; letter-spacing: 0.05em; color: #6b7280; border-bottom: 1px solid #e5e7eb; padding-bottom: 0.25rem; margin-top: 0.5rem; }
                .button-primary { padding: 0.6rem 1.2rem; background-color: #16a34a; color: white; border-radius: 0.375rem; font-weight: 600; }
                .button-secondary { padding: 0.6rem 1.2rem; background-color: #e5e7eb; color: #1f2937; border-radius: 0.375rem; font-weight: 600; }
            `}</style>
        </div>
    );
};

export default CreateListingModal;