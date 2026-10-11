import React, { useState, useRef, useEffect } from 'react';
import type { Transaction, Account, PurchaseOrder, TransactionRecordType } from '../types';
import { XCircleIcon, SparklesIcon, ArrowUpTrayIcon } from './Icons';
import { analyzeTransactionDocument } from '../services/geminiService';
import { useLanguage } from '../contexts/LanguageContext';

interface TransactionModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (transaction: Transaction) => void;
    transaction: Transaction | null;
    accounts: Account[];
    purchaseOrders: PurchaseOrder[];
    suppliers: any[];
}

const fileToDataUrl = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = error => reject(error);
        reader.readAsDataURL(file);
    });
};

const fileToBase64 = (dataUrl: string): string => {
    return dataUrl.split(',')[1];
};

const safeDateValue = (dateStr: string) => {
    try {
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) return new Date().toISOString().split('T')[0];
        return d.toISOString().split('T')[0];
    } catch {
        return new Date().toISOString().split('T')[0];
    }
};

const TransactionModal: React.FC<TransactionModalProps> = ({ isOpen, onClose, onSave, transaction, accounts, purchaseOrders }) => {
    const { t, formatCurrency, language } = useLanguage();
    const isKa = language === 'ka';

    const getInitialState = () => ({
        date: new Date().toISOString().split('T')[0],
        description: '',
        debitAccountId: '',
        creditAccountId: '',
        amount: 0,
        relatedPurchaseId: undefined,
        documentUrl: undefined,
        documentAnalysis: null,
        transactionType: 'Outgoing Payment' as TransactionRecordType,
        documentNumber: '',
        senderName: '',
        senderBank: '',
        senderAccount: '',
        receiverName: '',
        receiverBank: '',
        receiverAccount: '',
        paymentMode: 'Cash' as any,
        paidBy: '',
    });

    const [formState, setFormState] = useState<Omit<Transaction, 'id'>>(getInitialState());
    
    const [uploadedFile, setUploadedFile] = useState<File | null>(null);
    const [documentDataUrl, setDocumentDataUrl] = useState<string | null>(null);
    const [shouldTranslate, setShouldTranslate] = useState(false);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [analysisError, setAnalysisError] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (isOpen) {
            if (transaction) {
                setFormState({ 
                    ...getInitialState(),
                    ...transaction, 
                    date: new Date(transaction.date).toISOString().split('T')[0] 
                });
                if(transaction.documentUrl) {
                    setDocumentDataUrl(transaction.documentUrl);
                }
            } else {
                setFormState(getInitialState());
                resetAnalysisState();
            }
        }
    }, [transaction, isOpen]);

    const resetAnalysisState = () => {
        setUploadedFile(null);
        setDocumentDataUrl(null);
        setAnalysisError(null);
        setIsAnalyzing(false);
        if(fileInputRef.current) fileInputRef.current.value = "";
    }

    const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        resetAnalysisState();
        setFormState(p => ({...p, documentUrl: undefined, documentAnalysis: null}));
        setUploadedFile(file);
        const dataUrl = await fileToDataUrl(file);
        setDocumentDataUrl(dataUrl);
    };

    const handleAnalyze = async () => {
        if (!documentDataUrl || !uploadedFile) return;

        setIsAnalyzing(true);
        setAnalysisError(null);
        try {
            const base64Data = fileToBase64(documentDataUrl);
            const analysis = await analyzeTransactionDocument(base64Data, uploadedFile.type, shouldTranslate);
            
            setFormState(prev => ({
                ...prev,
                documentAnalysis: analysis,
                documentUrl: documentDataUrl,
                date: analysis.date || prev.date,
                amount: analysis.amount || prev.amount,
                description: analysis.description || prev.description,
                documentNumber: analysis.documentNumber || prev.documentNumber,
                senderName: analysis.senderName || prev.senderName,
                senderBank: analysis.senderBank || prev.senderBank,
                senderAccount: analysis.senderAccount || prev.senderAccount,
                receiverName: analysis.receiverName || prev.receiverName,
                receiverBank: analysis.receiverBank || prev.receiverBank,
                receiverAccount: analysis.receiverAccount || prev.receiverAccount,
            }));
            
            setUploadedFile(null);
        } catch (err) {
            setAnalysisError(err instanceof Error ? err.message : (isKa ? 'ანალიზი ვერ შესრულდა.' : 'Analysis failed.'));
        } finally {
            setIsAnalyzing(false);
        }
    };
    
    const handleAttachOnly = () => {
        setFormState(prev => ({ ...prev, documentUrl: documentDataUrl || undefined }));
        setUploadedFile(null);
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        const { name, value, type } = e.target;
        setFormState(prev => ({ ...prev, [name]: type === 'number' ? parseFloat(value) || 0 : value }));
    };
    
    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSave({ id: transaction?.id || '', ...formState, date: new Date(formState.date).toISOString() });
    };

    if (!isOpen) return null;
    
    const InputField: React.FC<{label: string, name: string, value: string | number | undefined, onChange: any, type?: string, required?: boolean, placeholder?: string}> = ({label, ...props}) => (
        <div><label className="font-medium text-xs text-gray-600">{label}</label><input {...props} className="input-field mt-1" /></div>
    );
    
    const SelectField: React.FC<{label: string, name: string, value: string, onChange: any, children: React.ReactNode, required?: boolean}> = ({label, ...props}) => (
        <div><label className="font-medium text-xs text-gray-600">{label}</label><select {...props} className="input-field mt-1">{props.children}</select></div>
    );

    return (
        <div className="fixed inset-0 bg-black/50 z-[5000] flex items-center justify-center p-4" onClick={onClose}>
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-4xl overflow-hidden" onClick={e => e.stopPropagation()}>
                <div className="p-4 border-b flex justify-between items-center bg-slate-50">
                    <h2 className="text-lg font-bold text-gray-800">{transaction ? t('txn.edit') : t('txn.new')}</h2>
                    <button onClick={onClose} className="cursor-pointer text-slate-400 hover:text-slate-700"><XCircleIcon className="h-6 w-6" /></button>
                </div>
                <form onSubmit={handleSubmit}>
                    <div className="p-6 grid grid-cols-1 md:grid-cols-5 gap-6 max-h-[70vh] overflow-y-auto">
                        <div className="md:col-span-2 space-y-4 border-r pr-6">
                            <h3 className="font-semibold text-gray-800 flex items-center gap-2">
                                <SparklesIcon className="h-5 w-5 text-emerald-500"/> 
                                {isKa ? 'დოკუმენტის AI დამუშავება' : 'AI Document Processor'}
                            </h3>
                            <input type="file" accept="image/*,application/pdf" ref={fileInputRef} onChange={handleFileSelect} className="hidden" />
                            
                            {documentDataUrl && !uploadedFile ? (
                                <div>
                                    <h4 className="font-semibold text-sm mb-2">{isKa ? 'მიმაგრებული დოკუმენტი:' : 'Attached Document:'}</h4>
                                    <img src={documentDataUrl} alt="Document preview" className="w-full rounded-lg border shadow-sm max-h-48 object-contain" />
                                    <button type="button" onClick={resetAnalysisState} className="text-xs text-red-500 hover:underline w-full mt-2 cursor-pointer">{isKa ? 'დოკუმენტის წაშლა' : 'Remove Document'}</button>
                                </div>
                            ) : !documentDataUrl ? (
                                <button type="button" onClick={() => fileInputRef.current?.click()} className="w-full p-4 border-2 border-dashed border-gray-300 rounded-lg text-center hover:border-emerald-500 hover:bg-emerald-50 cursor-pointer">
                                    <ArrowUpTrayIcon className="h-6 w-6 mx-auto text-gray-400" />
                                    <span className="mt-1 block font-semibold text-emerald-600">{isKa ? 'ქვითრის ან დოკუმენტის ატვირთვა' : 'Upload Receipt or Document'}</span>
                                </button>
                            ) : null}

                            {documentDataUrl && uploadedFile && (
                                <div className="space-y-3">
                                    <img src={documentDataUrl} alt="Uploaded document preview" className="w-full rounded-lg border shadow-sm max-h-48 object-contain" />
                                    <div className="p-4 bg-gray-50 rounded-lg space-y-3">
                                        <div className="flex items-center gap-2">
                                            <button type="button" onClick={handleAnalyze} disabled={isAnalyzing} className="button-primary text-sm flex-1 flex items-center justify-center gap-2 cursor-pointer">
                                                <SparklesIcon className="h-4 w-4"/> {isAnalyzing ? (isKa ? 'მუშავდება...' : 'Analyzing...') : (isKa ? 'დოკუმენტის გაანალიზება' : 'Analyze Document')}
                                            </button>
                                            <label className="flex items-center gap-1 text-xs text-gray-600 cursor-pointer">
                                                <input type="checkbox" checked={shouldTranslate} onChange={(e) => setShouldTranslate(e.target.checked)} /> 
                                                {isKa ? 'თარგმნა' : 'Translate'}
                                            </label>
                                        </div>
                                         <button type="button" onClick={handleAttachOnly} disabled={isAnalyzing} className="button-secondary text-sm w-full cursor-pointer">{isKa ? 'მხოლოდ დოკუმენტის მიმაგრება' : 'Attach Document Only'}</button>
                                         <button type="button" onClick={resetAnalysisState} className="text-xs text-red-500 hover:underline w-full mt-1 cursor-pointer">{isKa ? 'დოკუმენტის წაშლა' : 'Remove Document'}</button>
                                         {analysisError && <p className="text-xs text-red-600 text-center">{analysisError}</p>}
                                    </div>
                                </div>
                            )}

                            {formState.documentAnalysis && (
                                <div className="border-t pt-4 space-y-2 text-xs">
                                    <h4 className="font-semibold text-sm mb-1">{isKa ? 'ანალიზის შედეგები' : 'Analysis Results'}</h4>
                                    <p><strong>{isKa ? 'გამგზავნი:' : 'Sender:'}</strong> {formState.documentAnalysis.senderName || 'N/A'}</p>
                                    <p><strong>{isKa ? 'მიმღები:' : 'Receiver:'}</strong> {formState.documentAnalysis.receiverName || 'N/A'}</p>
                                    <p className="max-h-24 overflow-y-auto bg-gray-50 p-1 rounded"><strong>{isKa ? 'აღწერა:' : 'Description:'}</strong> {formState.documentAnalysis.description}</p>
                                </div>
                            )}
                        </div>

                        <div className="md:col-span-3 space-y-4 text-sm">
                            <div className="grid grid-cols-2 gap-4">
                               <SelectField label={t('txn.type')} name="transactionType" value={formState.transactionType} onChange={handleChange}>
                                    <option value="Outgoing Payment">{isKa ? 'გასავალი გადახდა' : 'Outgoing Payment'}</option>
                                    <option value="Incoming Payment">{isKa ? 'შემოსავალი' : 'Incoming Payment'}</option>
                                    <option value="Bank Transfer">{isKa ? 'ბანკებს შორის გადარიცხვა' : 'Bank Transfer'}</option>
                                    <option value="Journal Entry">{isKa ? 'ბუღალტრული გატარება' : 'Journal Entry'}</option>
                                </SelectField>
                                <InputField label={t('common.date')} name="date" type="date" value={safeDateValue(formState.date)} onChange={handleChange} required />
                                <InputField label={t('txn.amount')} name="amount" type="number" value={formState.amount} onChange={handleChange} required />
                                <InputField label={t('txn.doc_num')} name="documentNumber" type="text" value={formState.documentNumber || ''} onChange={handleChange} />
                            </div>
                            
                            <div className="grid grid-cols-2 gap-4 pt-4 border-t">
                                <div className="space-y-3 p-3 border rounded-lg bg-gray-50">
                                    <h4 className="font-semibold">{t('txn.sender')}</h4>
                                     <InputField label={isKa ? 'სახელი' : 'Name'} name="senderName" type="text" value={formState.senderName || ''} onChange={handleChange} />
                                     <InputField label={isKa ? 'ბანკი' : 'Bank'} name="senderBank" type="text" value={formState.senderBank || ''} onChange={handleChange} />
                                     <InputField label={isKa ? 'ანგარიში' : 'Account #'} name="senderAccount" type="text" value={formState.senderAccount || ''} onChange={handleChange} />
                                     <SelectField label={t('txn.source_account')} name="creditAccountId" value={formState.creditAccountId} onChange={handleChange} required>
                                        <option value="">{isKa ? 'აირჩიეთ ანგარიში' : 'Select Account'}</option>
                                        {accounts.map(a => <option key={a.id} value={a.id}>{a.name} ({a.type})</option>)}
                                    </SelectField>
                                </div>
                                 <div className="space-y-3 p-3 border rounded-lg bg-gray-50">
                                    <h4 className="font-semibold">{t('txn.receiver')}</h4>
                                     <InputField label={isKa ? 'სახელი' : 'Name'} name="receiverName" type="text" value={formState.receiverName || ''} onChange={handleChange} />
                                     <InputField label={isKa ? 'ბანკი' : 'Bank'} name="receiverBank" type="text" value={formState.receiverBank || ''} onChange={handleChange} />
                                     <InputField label={isKa ? 'ანგარიში' : 'Account #'} name="receiverAccount" type="text" value={formState.receiverAccount || ''} onChange={handleChange} />
                                     <SelectField label={t('txn.dest_account')} name="debitAccountId" value={formState.debitAccountId} onChange={handleChange} required>
                                        <option value="">{isKa ? 'აირჩიეთ ანგარიში' : 'Select Account'}</option>
                                        {accounts.map(a => <option key={a.id} value={a.id}>{a.name} ({a.type})</option>)}
                                    </SelectField>
                                </div>
                            </div>
                            
                            <div className="grid grid-cols-2 gap-4">
                                <SelectField label={isKa ? 'გადახდის ფორმა' : 'Payment Mode'} name="paymentMode" value={formState.paymentMode || 'Cash'} onChange={handleChange}>
                                    <option value="Cash">{isKa ? 'ნაღდი' : 'Cash'}</option>
                                    <option value="By Card">{isKa ? 'ბარათით / გადარიცხვით' : 'By Card / Transfer'}</option>
                                    <option value="Purchase Agreement">{isKa ? 'შესყიდვის აქტით' : 'Purchase Agreement'}</option>
                                    <option value="Contract for IE/Physical Person">{isKa ? 'ინდ.მეწარმის ხელშეკრულება' : 'Contract for IE/Physical Person'}</option>
                                </SelectField>
                                <InputField label={isKa ? 'გადამხდელი პირი' : 'Paid By'} name="paidBy" type="text" value={formState.paidBy || ''} onChange={handleChange} placeholder={isKa ? "ვინ გადაიხადა (მაგ. გიორგი)" : "Who paid (e.g. Giorgi)"} />
                            </div>
                            
                            <div><label className="font-medium text-xs text-gray-600">{isKa ? 'აღწერა' : 'Description'}</label><textarea name="description" value={formState.description} onChange={handleChange} className="input-field mt-1" rows={2} required /></div>
                            
                            <SelectField label={isKa ? `${t('txn.rel_po')} (არასავალდებულო)` : `${t('txn.rel_po')} (Optional)`} name="relatedPurchaseId" value={formState.relatedPurchaseId || ''} onChange={handleChange}>
                                <option value="">{isKa ? 'არცერთი' : 'None'}</option>
                                {purchaseOrders.map(p => <option key={p.id} value={p.id}>PO #{String(p.id || '').slice(-6)} - {formatCurrency(p.totalCost)}</option>)}
                            </SelectField>
                        </div>
                    </div>
                    <div className="p-4 bg-gray-50 flex justify-end gap-3 border-t">
                        <button type="button" onClick={onClose} className="button-secondary cursor-pointer">{t('common.cancel')}</button>
                        <button type="submit" className="button-primary cursor-pointer">{t('common.save')}</button>
                    </div>
                </form>
            </div>
            <style>{`
                .input-field { width: 100%; padding: 0.5rem; border: 1px solid #d1d5db; border-radius: 0.375rem; background-color: white; font-size: 0.875rem; }
                .button-primary { padding: 0.5rem 1rem; background-color: #16a34a; color: white; border-radius: 0.375rem; font-weight: 600; transition: background-color 0.2s; }
                .button-primary:disabled { background-color: #9ca3af; cursor: not-allowed; }
                .button-secondary { padding: 0.5rem 1rem; background-color: #e5e7eb; color: #1f2937; border-radius: 0.375rem; font-weight: 600; transition: background-color 0.2s; }
            `}</style>
        </div>
    );
};

export default TransactionModal;
