
import React, { useState, useEffect } from 'react';
import type { SubscriptionPlan, User, Organization, SubscriptionRequest } from '../types';
import { XIcon, CheckIcon, ShieldCheckIcon, PencilIcon, SaveIcon, PlusIcon, TrashIcon } from './Icons';
import { toast } from 'sonner';
import { db, auth, doc, setDoc } from '../firebase';
import { USE_FIREBASE } from '../config';

interface SubscriptionModalProps {
    isOpen: boolean;
    onClose: () => void;
    currentUser: User;
    activeOrg?: Organization;
    onUpdateOrg?: (org: Organization) => void;
    isSystemAdmin?: boolean;
}

const DEFAULT_PLANS: SubscriptionPlan[] = [
    {
        id: 'free_trial',
        name: '30 Days Free',
        price: 0,
        billingCycle: 'monthly',
        features: ['Full access to all modules', '5 User seats', 'Cloud storage included'],
        freeDays: 30
    },
    {
        id: 'monthly_pro',
        name: 'Monthly Pro',
        price: 49,
        billingCycle: 'monthly',
        features: ['Unlimited management', '20 User seats', 'Priority support']
    },
    {
        id: 'yearly_pro',
        name: 'Yearly Enterprise',
        price: 490,
        billingCycle: 'yearly',
        features: ['Save 2 months', 'Unlimited seats', 'On-site training']
    },
    {
        id: 'custom_plan',
        name: 'Custom Plan',
        price: 0,
        billingCycle: 'monthly',
        features: ['Tailored features', 'API Access', 'Dedicated account manager'],
        isCustom: true,
        contactRequired: true
    },
    {
        id: 'contact_us',
        name: 'Contact Sales',
        price: 0,
        billingCycle: 'monthly',
        features: ['Bespoke enterprise solutions', 'Deep integrations'],
        contactRequired: true
    }
];

const SubscriptionModal: React.FC<SubscriptionModalProps> = ({ isOpen, onClose, currentUser, activeOrg, onUpdateOrg, isSystemAdmin }) => {
    const [plans, setPlans] = useState<SubscriptionPlan[]>(DEFAULT_PLANS);
    const [isEditing, setIsEditing] = useState(false);
    const [editingPlan, setEditingPlan] = useState<SubscriptionPlan | null>(null);

    // In a real app, we would fetch plans from Firestore. For now, we'll use state and persist if admin.
    useEffect(() => {
        const savedPlans = localStorage.getItem('agrimap_subscription_plans');
        if (savedPlans) {
            setPlans(JSON.parse(savedPlans));
        }
    }, []);

    const handleSavePlans = () => {
        localStorage.setItem('agrimap_subscription_plans', JSON.stringify(plans));
        toast.success("Subscription plans updated successfully!");
        setIsEditing(false);
    };

    const handleSelectPlan = async (plan: SubscriptionPlan) => {
        if (!activeOrg) {
            toast.error("Please select an organization first.");
            return;
        }

        if (plan.contactRequired) {
            alert(`Please contact our sales team at sales@agrimap.ge for the ${plan.name}.`);
            return;
        }

        // If it's a free trial/plan, update immediately
        if (plan.price === 0) {
            const updatedOrg: Organization = {
                ...activeOrg,
                tier: 'Free',
                subscriptionStatus: 'Trial',
                isPaid: false,
                price: 0,
                subscriptionExpiry: new Date(Date.now() + (plan.freeDays || 30) * 24 * 60 * 60 * 1000).toISOString()
            };

            if (onUpdateOrg) onUpdateOrg(updatedOrg);
            toast.success(`Active trial: ${plan.name}`);
            onClose();
            return;
        }

        // For paid plans, create a request for admin approval
        if (USE_FIREBASE && auth.currentUser) {
            try {
                const requestId = `subreq-${Date.now()}`;
                const request: SubscriptionRequest = {
                    id: requestId,
                    organizationId: activeOrg.id,
                    userId: currentUser.id,
                    planId: plan.id,
                    status: 'pending',
                    requestedAt: new Date().toISOString()
                };

                await setDoc(doc(db, 'subscriptionRequests', requestId), request);
                toast.success(`Request for ${plan.name} sent to processing! We will contact you shortly.`);
                onClose();
            } catch (error) {
                console.error("Failed to send subscription request:", error);
                toast.error("Failed to send request. Please try again.");
            }
        } else {
            toast.success(`(Mock Mode) Request for ${plan.name} sent!`);
            onClose();
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/80 z-[8000] flex items-center justify-center p-4 backdrop-blur-md">
            <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-5xl overflow-hidden animate-slide-up flex flex-col max-h-[90vh]">
                <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                    <div>
                        <h2 className="text-2xl font-black text-slate-800 uppercase tracking-tight">Select Your Plan</h2>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">
                            {activeOrg ? `Managing subscription for: ${activeOrg.name}` : 'Choose the best plan for your team'}
                        </p>
                    </div>
                    <div className="flex items-center gap-4">
                        {isSystemAdmin && (
                            <button 
                                onClick={() => setIsEditing(!isEditing)}
                                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${isEditing ? 'bg-indigo-600 text-white' : 'bg-slate-200 text-slate-600 hover:bg-slate-300'}`}
                            >
                                <PencilIcon size={14} /> {isEditing ? 'Exit Customizer' : 'Manage Plans'}
                            </button>
                        )}
                        <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full transition-colors text-slate-400">
                            <XIcon size={24} />
                        </button>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-10">
                    {isEditing ? (
                        <div className="space-y-6">
                            <div className="flex justify-between items-center bg-indigo-50 p-6 rounded-3xl border border-indigo-100">
                                <p className="text-xs font-bold text-indigo-700 italic uppercase">System Administrator Mode: You are modifying global subscription options.</p>
                                <button onClick={handleSavePlans} className="flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-xl font-black text-xs uppercase tracking-widest shadow-lg hover:shadow-indigo-200 transition-all">
                                    <SaveIcon size={16} /> Save All Changes
                                </button>
                            </div>

                            <div className="grid grid-cols-1 gap-4">
                                {plans.map((plan, idx) => (
                                    <div key={plan.id} className="p-6 bg-white border border-slate-200 rounded-[2rem] flex flex-wrap items-center gap-6 shadow-sm hover:shadow-md transition-all">
                                        <div className="flex-1 space-y-4">
                                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                                <div>
                                                    <label className="text-[8px] font-black uppercase text-slate-400 ml-2">Plan Name</label>
                                                    <input 
                                                        className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-2 text-xs font-bold text-slate-800"
                                                        value={plan.name}
                                                        onChange={(e) => {
                                                            const newPlans = [...plans];
                                                            newPlans[idx].name = e.target.value;
                                                            setPlans(newPlans);
                                                        }}
                                                    />
                                                </div>
                                                <div>
                                                    <label className="text-[8px] font-black uppercase text-slate-400 ml-2">Price ($)</label>
                                                    <input 
                                                        type="number"
                                                        className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-2 text-xs font-bold text-slate-800"
                                                        value={plan.price}
                                                        onChange={(e) => {
                                                            const newPlans = [...plans];
                                                            newPlans[idx].price = Number(e.target.value);
                                                            setPlans(newPlans);
                                                        }}
                                                    />
                                                </div>
                                                <div>
                                                    <label className="text-[8px] font-black uppercase text-slate-400 ml-2">Billing Cycle</label>
                                                    <select 
                                                        className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-2 text-xs font-bold text-slate-800"
                                                        value={plan.billingCycle}
                                                        onChange={(e) => {
                                                            const newPlans = [...plans];
                                                            newPlans[idx].billingCycle = e.target.value as any;
                                                            setPlans(newPlans);
                                                        }}
                                                    >
                                                        <option value="monthly">Monthly</option>
                                                        <option value="yearly">Yearly</option>
                                                    </select>
                                                </div>
                                                <div className="flex items-center gap-2 pt-4">
                                                    <input 
                                                        type="checkbox" 
                                                        checked={plan.contactRequired}
                                                        onChange={(e) => {
                                                            const newPlans = [...plans];
                                                            newPlans[idx].contactRequired = e.target.checked;
                                                            setPlans(newPlans);
                                                        }}
                                                    />
                                                    <span className="text-[8px] font-black uppercase text-slate-400">Contact Required</span>
                                                </div>
                                            </div>
                                        </div>
                                        <button 
                                            onClick={() => {
                                                const newPlans = plans.filter((_, i) => i !== idx);
                                                setPlans(newPlans);
                                            }}
                                            className="p-3 bg-red-50 text-red-600 rounded-2xl hover:bg-red-100 transition-colors"
                                        >
                                            <TrashIcon size={18} />
                                        </button>
                                    </div>
                                ))}
                                <button 
                                    onClick={() => {
                                        const newPlan: SubscriptionPlan = {
                                            id: `plan-${Date.now()}`,
                                            name: 'New Plan',
                                            price: 99,
                                            billingCycle: 'monthly',
                                            features: ['Feature 1', 'Feature 2']
                                        };
                                        setPlans([...plans, newPlan]);
                                    }}
                                    className="w-full py-4 border-2 border-dashed border-slate-200 rounded-3xl text-slate-400 font-black text-xs uppercase tracking-widest hover:border-indigo-300 hover:text-indigo-500 transition-all flex items-center justify-center gap-2"
                                >
                                    <PlusIcon size={16} /> Add Custom Plan Option
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                            {plans.map((plan) => (
                                <div 
                                    key={plan.id} 
                                    className={`relative p-8 rounded-[3rem] border transition-all flex flex-col group ${plan.id === activeOrg?.tier ? 'bg-slate-900 text-white border-slate-900 shadow-2xl scale-105 z-10' : 'bg-white border-slate-100 text-slate-800 hover:border-indigo-200 hover:shadow-xl hover:scale-102'}`}
                                >
                                    {plan.id === activeOrg?.tier && (
                                        <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-indigo-600 text-white px-4 py-1 rounded-full text-[9px] font-black uppercase tracking-widest">Current Plan</div>
                                    )}
                                    
                                    <div className="mb-8">
                                        <h3 className={`text-xl font-black uppercase tracking-tight mb-2 ${plan.id === activeOrg?.tier ? 'text-white' : 'text-slate-800'}`}>{plan.name}</h3>
                                        <div className="flex items-baseline gap-1">
                                            <span className="text-4xl font-black">${plan.price}</span>
                                            <span className={`text-[10px] font-bold uppercase tracking-widest ${plan.id === activeOrg?.tier ? 'text-slate-400' : 'text-slate-400'}`}>/ {plan.billingCycle}</span>
                                        </div>
                                    </div>

                                    <div className="space-y-4 mb-10 flex-1">
                                        {plan.features.map((feature, i) => (
                                            <div key={i} className="flex items-start gap-3">
                                                <div className={`mt-0.5 p-0.5 rounded-full ${plan.id === activeOrg?.tier ? 'bg-indigo-500 text-white' : 'bg-green-100 text-green-600'}`}>
                                                    <CheckIcon size={10} strokeWidth={4} />
                                                </div>
                                                <span className={`text-[11px] font-bold leading-tight ${plan.id === activeOrg?.tier ? 'text-slate-300' : 'text-slate-500'}`}>{feature}</span>
                                            </div>
                                        ))}
                                    </div>

                                    <button 
                                        onClick={() => handleSelectPlan(plan)}
                                        disabled={plan.id === activeOrg?.tier}
                                        className={`w-full py-5 rounded-[2rem] font-black text-xs uppercase tracking-widest transition-all ${plan.id === activeOrg?.tier ? 'bg-slate-700 text-slate-500 cursor-not-allowed' : 'bg-indigo-600 text-white shadow-xl shadow-indigo-100 hover:bg-indigo-700 active:scale-95 group-hover:-translate-y-1'}`}
                                    >
                                        {plan.contactRequired ? 'Contact Sales' : (plan.id === activeOrg?.tier ? 'Current Tier' : 'Choose Plan')}
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <div className="p-8 border-t border-slate-100 bg-slate-50/50 flex flex-col md:flex-row justify-between items-center gap-4">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-white rounded-2xl flex items-center justify-center shadow-sm text-indigo-600 border border-slate-100">
                            <ShieldCheckIcon size={20} />
                        </div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest max-w-[300px] leading-tight">
                            Secure payment processing via Stripe. Enterprise users get dedicated support line: <strong className="text-slate-600">+995 555 XXX XXX</strong>
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SubscriptionModal;
