import React, { useState, useEffect } from 'react';
import type { User, UserRole, Organization, ForumPost, Membership, Employee } from '../types';
import { XIcon, CheckIcon, ChevronRightIcon, ChevronLeftIcon, SearchIcon, BuildingStorefrontIcon } from './Icons';
import { toast } from 'sonner';

import { auth, db } from '../firebase';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc, getDocFromServer as getDoc } from '../firebase';
import { USE_FIREBASE } from '../config';
import { useLanguage } from '../contexts/LanguageContext';
import { safeStorage } from '../services/storageService';
import { DEFAULT_COMPANIES } from '../hooks/useFirebaseData';

const transliterateGeoToEng = (str: string): string => {
  const geoToEngMap: { [key: string]: string } = {
    'ა': 'a', 'ბ': 'b', 'გ': 'g', 'დ': 'd', 'ე': 'e', 'ვ': 'v', 'ზ': 'z', 'თ': 't',
    'ი': 'i', 'კ': 'k', 'ლ': 'l', 'მ': 'm', 'ნ': 'n', 'ო': 'o', 'პ': 'p', 'ჟ': 'zh',
    'რ': 'r', 'ს': 's', 'ტ': 't', 'უ': 'u', 'ფ': 'p', 'ქ': 'k', 'ღ': 'gh', 'ყ': 'q',
    'შ': 'sh', 'ჩ': 'ch', 'ც': 'ts', 'ძ': 'dz', 'წ': 'ts', 'ჭ': 'ch', 'ხ': 'kh', 'ჯ': 'j', 'ჰ': 'h'
  };
  return str.split('').map(char => geoToEngMap[char] || char).join('');
};

const transliterateEngToGeo = (str: string): string => {
  const engToGeoMap: { [key: string]: string } = {
    'a': 'ა', 'b': 'ბ', 'g': 'გ', 'd': 'დ', 'e': 'ე', 'v': 'ვ', 'z': 'ზ', 't': 'თ',
    'i': 'ი', 'k': 'კ', 'l': 'ლ', 'm': 'მ', 'n': 'ნ', 'o': 'ო', 'p': 'პ', 'r': 'რ',
    's': 'ს', 'u': 'უ', 'q': 'ყ', 'j': 'ჯ', 'h': 'ჰ'
  };
  return str.split('').map(char => engToGeoMap[char.toLowerCase()] || char).join('');
};

interface RegistrationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRegister: (user: User, orgToJoin?: Organization | null) => void;
  onGoogleLogin: () => void;
  onAddPost?: (post: Partial<ForumPost>) => void;
  organizations: Organization[];
  currentUser?: User | null;
  onAddOrg?: (org: Organization, mem: Membership, selectedCrops?: any[]) => void;
}

const RegistrationModal: React.FC<RegistrationModalProps> = ({ 
  isOpen, 
  onClose, 
  onRegister, 
  onGoogleLogin, 
  onAddPost, 
  organizations,
  currentUser,
  onAddOrg
}) => {
  const { t } = useLanguage();
  const orgList = organizations && organizations.length > 0 ? organizations : DEFAULT_COMPANIES;
  const [step, setStep] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [loggedInTab, setLoggedInTab] = useState<'handshake' | 'register'>('handshake');
  
  const [orgSearchQuery, setOrgSearchQuery] = useState('');
  const [debouncedOrgQuery, setDebouncedOrgQuery] = useState('');
  const [selectedOrgToJoin, setSelectedOrgToJoin] = useState<Organization | null>(null);
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [isLoggedInSearchFocused, setIsLoggedInSearchFocused] = useState(false);

  // New Company Fields for logged in users
  const [newCompanyData, setNewCompanyData] = useState({
      name: '',
      taxNumber: '',
      registrationNumber: '',
      phoneNumber: '',
      agricultureType: 'Blueberries' as any,
      type: 'LLC' as any,
      region: '',
      country: 'Georgia'
  });

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedOrgQuery(orgSearchQuery);
    }, 500);
    return () => clearTimeout(timer);
  }, [orgSearchQuery]);
  
  const [formData, setFormData] = useState({ 
    email: '', 
    password: '', 
    firstName: '', 
    lastName: '', 
  });

  if (!isOpen) return null;

  const handleSendHandshake = async () => {
      if (!selectedOrgToJoin || !currentUser) {
          toast.error("Please search and select an organization first.");
          return;
      }
      setIsLoading(true);
      setError(null);
      try {
          const membershipId = `${currentUser.id}_${selectedOrgToJoin.id}`;
          const newMembership: Membership = {
              id: membershipId,
              userId: currentUser.id,
              organizationId: selectedOrgToJoin.id,
              role: 'Employee',
              permissionLevel: 'write',
              status: 'pending',
              joinedAt: new Date().toISOString()
          };

          if (USE_FIREBASE) {
              await setDoc(doc(db, 'memberships', membershipId), newMembership);
              
              const newEmployee: Employee = {
                  id: `emp-${currentUser.id}-${selectedOrgToJoin.id}`,
                  name: currentUser.name || "Unknown",
                  email: currentUser.email || "",
                  phone: currentUser.phone || '',
                  idNumber: currentUser.personalNumber || '',
                  roleId: 'Employee',
                  paymentType: 'hourly',
                  paymentRate: 0,
                  barcode: `BC-${Date.now()}`,
                  employeeType: 'Temporary',
                  accountType: 'Bank Account',
                  status: 'active',
                  joinedAt: new Date().toISOString(),
                  organizationId: selectedOrgToJoin.id
              };
              await setDoc(doc(db, 'employees', newEmployee.id), newEmployee);

              const alertId = `alert-join-${Date.now()}`;
              await setDoc(doc(db, 'alerts', alertId), {
                  id: alertId,
                  organizationId: selectedOrgToJoin.id,
                  title: 'New Join Request',
                  content: `${currentUser.name} has requested to join ${selectedOrgToJoin.name}.`,
                  type: 'info',
                  timestamp: new Date().toISOString(),
                  isRead: false,
                  createdBy: currentUser.id,
                  metadata: { membershipId, userId: currentUser.id },
                  actions: [
                      { label: 'Approve', actionType: 'approve_join', actionData: { membershipId, userId: currentUser.id } }
                  ]
              });
          } else {
              const savedMemberships = safeStorage.safeParse(localStorage.getItem('mock_memberships'), []);
              const filteredMems = savedMemberships.filter((m: any) => m.id !== membershipId);
              localStorage.setItem('mock_memberships', JSON.stringify([...filteredMems, newMembership]));

              const newEmployee: Employee = {
                  id: `emp-${currentUser.id}-${selectedOrgToJoin.id}`,
                  name: currentUser.name || "Unknown",
                  email: currentUser.email || "",
                  phone: currentUser.phone || '',
                  idNumber: currentUser.personalNumber || '',
                  roleId: 'Employee',
                  paymentType: 'hourly',
                  paymentRate: 0,
                  barcode: `BC-${Date.now()}`,
                  employeeType: 'Temporary',
                  accountType: 'Bank Account',
                  status: 'active',
                  joinedAt: new Date().toISOString(),
                  organizationId: selectedOrgToJoin.id
              };
              const savedEmployees = safeStorage.safeParse(localStorage.getItem('mock_employees'), []);
              localStorage.setItem('mock_employees', JSON.stringify([...savedEmployees, newEmployee]));

              const alertId = `alert-join-${Date.now()}`;
              const newAlert = {
                  id: alertId,
                  organizationId: selectedOrgToJoin.id,
                  title: 'New Join Request',
                  content: `${currentUser.name} has requested to join ${selectedOrgToJoin.name}.`,
                  type: 'info',
                  timestamp: new Date().toISOString(),
                  isRead: false,
                  createdBy: currentUser.id,
                  metadata: { membershipId, userId: currentUser.id },
                  actions: [
                      { label: 'Approve', actionType: 'approve_join', actionData: { membershipId, userId: currentUser.id } }
                  ]
              };
              const savedAlerts = safeStorage.safeParse(localStorage.getItem('mock_alerts'), []);
              localStorage.setItem('mock_alerts', JSON.stringify([...savedAlerts.filter((a: any) => a.id !== alertId), newAlert]));
          }

          if (onAddPost) {
              onAddPost({
                  title: "Join Request",
                  content: `Hello, I'm ${currentUser.name}. I've sent a handshake request to join ${selectedOrgToJoin.name} as a professional partner.`,
                  authorId: currentUser.id,
                  authorName: currentUser.name,
                  timestamp: new Date().toISOString(),
                  hubType: 'internal',
                  channelId: 'general',
                  isDirectMessage: false,
                  organizationId: selectedOrgToJoin.id,
                  replies: []
              });
          }

          toast.success((t('reg.handshake_success') || "Handshake initiated with {orgName}.").replace('{orgName}', selectedOrgToJoin.name));
          onClose();
          setTimeout(() => {
              window.location.reload();
          }, 1000);
      } catch (err: any) {
          console.error("Handshake request failed:", err);
          setError(err.message || "Failed to send handshake request.");
      } finally {
          setIsLoading(false);
      }
  };

  const handleRegisterCompanyLoggedIn = async () => {
      if (!newCompanyData.name) {
          toast.error("Please provide a Company Name");
          return;
      }
      if (!currentUser) return;

      setIsLoading(true);
      setError(null);
      try {
          const orgId = `org-${Date.now()}`;
          const uId = `COMP-${Math.floor(10000 + Math.random() * 90000)}`;
          
          const newOrg: Organization = {
              id: orgId,
              uniqueId: uId,
              name: newCompanyData.name,
              legalName: newCompanyData.name,
              registrationNumber: newCompanyData.registrationNumber || `REG-${Date.now()}`,
              taxNumber: newCompanyData.taxNumber || `TAX-${Date.now()}`,
              agricultureType: newCompanyData.agricultureType,
              type: newCompanyData.type as any,
              country: newCompanyData.country,
              region: newCompanyData.region || 'Guria',
              isDiscoverable: true,
              createdBy: currentUser.id,
              createdAt: new Date().toISOString(),
              status: 'active',
              trial_start_date: '',
              trialExpiry: '',
              isPaid: false,
              tier: 'Free',
              subscriptionStatus: 'Unpaid',
              phoneNumber: newCompanyData.phoneNumber || ''
          };

          const memId = `${currentUser.id}_${orgId}`;
          const newMem: Membership = {
              id: memId,
              userId: currentUser.id,
              organizationId: orgId,
              role: 'Founder',
              permissionLevel: 'admin',
              status: 'active',
              joinedAt: new Date().toISOString()
          };

          if (onAddOrg) {
              await onAddOrg(newOrg, newMem, ['Blueberries', 'Citrus']);
              toast.success(`Company ${newOrg.name} has been successfully registered!`);
              onClose();
              setTimeout(() => {
                  window.location.reload();
              }, 1000);
          } else {
              toast.error("Add organization callback of system is missing.");
          }
      } catch (error: any) {
          console.error("Failed to register company:", error);
          setError(error.message || "Failed to register company.");
      } finally {
          setIsLoading(false);
      }
  };

  const handleFinish = async () => {
      if (!formData.email || !formData.password || !formData.firstName || !formData.lastName) {
          return setError(t('reg.fill_fields') || "Please fill in all required fields (Name, Email, Password).");
      }
      
      setIsLoading(true);
      try {
          // Generate Master Unique ID (G-ID)
          const { generateUniqueId } = await import('../lib/firebaseUtils');
          const digits = Math.floor(1000 + Math.random() * 9000).toString();
          const globalId = generateUniqueId('global', digits);
          const individualId = generateUniqueId('individual', digits);

          let firebaseUser: any = null;
          
          const cleanEmail = formData.email.trim().toLowerCase();
          
          if (USE_FIREBASE) {
              // 1. Create auth user
              const userCredential = await createUserWithEmailAndPassword(auth, cleanEmail, formData.password);
              firebaseUser = userCredential.user;
          } else {
              // Mock registration
              const existingUsersStr = localStorage.getItem('agri-planter-mock-all-users') || '[]';
              const existingUsers: User[] = JSON.parse(existingUsersStr);
              
              firebaseUser = {
                  uid: `mock-user-${Date.now()}`,
                  email: cleanEmail
              };

              const newUser: User = {
                id: firebaseUser.uid,
                globalUniqueId: globalId,
                individualUniqueId: individualId,
                activeRole: 'individual',
                firstName: formData.firstName,
                lastName: formData.lastName,
                name: `${formData.firstName} ${formData.lastName}`,
                email: cleanEmail,
                verificationStatus: 'unverified',
                isVerified: false,
                kycStatus: 'none',
                isProfileDiscoverable: true,
                isPubliclyVisible: true,
                status: 'active',
                roles: ['Guest'],
                role: 'Independent',
                subscriptionType: 'Individual Subscription',
                createdAt: new Date().toISOString(),
                aiQueryCount: 0,
                isGuest: false 
              };

              existingUsers.push(newUser);
              localStorage.setItem('agri-planter-mock-all-users', JSON.stringify(existingUsers));
              localStorage.setItem('agri-planter-mock-user', JSON.stringify(newUser));
          }

          const user: User = {
              id: firebaseUser.uid,
              globalUniqueId: globalId,
              individualUniqueId: individualId,
              activeRole: 'individual',
              firstName: formData.firstName,
              lastName: formData.lastName,
              name: `${formData.firstName} ${formData.lastName}`,
              email: cleanEmail,
              verificationStatus: 'unverified' as const,
              isVerified: false,
              kycStatus: 'none' as const,
              isProfileDiscoverable: true,
              isPubliclyVisible: true,
              status: 'active' as const,
              roles: ['Guest'],
              role: 'Independent',
              subscriptionType: 'Individual Subscription',
              createdAt: new Date().toISOString(),
              aiQueryCount: 0,
              isGuest: false
          };

          await onRegister(user, selectedOrgToJoin);

          if (selectedOrgToJoin && onAddPost) {
            onAddPost({
              title: "Join Request",
              content: `Hello, I'm ${user.name}. I've just registered and would like to join ${selectedOrgToJoin.name} as a professional partner.`,
              authorId: user.id,
              authorName: user.name,
              timestamp: new Date().toISOString(),
              hubType: 'internal',
              channelId: 'general',
              isDirectMessage: false,
              organizationId: selectedOrgToJoin.id,
              replies: []
            });
            toast.success((t('reg.handshake_success') || "Handshake initiated with {orgName}.").replace('{orgName}', selectedOrgToJoin.name));
          }

          onClose();
      } catch (err: any) {
          const errorCode = err?.code || "";
          const errorMessage = err?.message || "";
          const errorStr = (errorCode + " " + errorMessage).toLowerCase();
          
          let userMessage = "Registration failed. Please try again.";
          const isEmailInUse = errorStr.includes('email-already-in-use');
          const isWeakPassword = errorStr.includes('weak-password');
          const isNotAllowed = errorStr.includes('operation-not-allowed') || errorStr.includes('invalid-credential');

          if (isEmailInUse) {
              userMessage = t('reg.email_in_use') || "This email is already registered. Please login instead.";
              console.warn("Registration notification: Email already in use", err);
          } else if (isWeakPassword) {
              userMessage = t('reg.weak_password') || "The password is too weak. Please use at least 6 characters.";
              console.warn("Registration notification: Weak password", err);
          } else if (isNotAllowed) {
              userMessage = "Registration failed. This often happens if 'Email/Password' authentication is not enabled in the Firebase Console. Please enable it to continue.";
              console.error("Registration hard failure (configuration issue):", err);
          } else {
              if (errorMessage) {
                  userMessage = errorMessage;
              }
              console.error("Registration unexpected failure:", err);
          }
          
          setError(userMessage);
      } finally {
          setIsLoading(false);
      }
  };

  const handleSwitchToCloudManual = () => {
      localStorage.setItem('agrimap-local-config', JSON.stringify({ isLocalMode: false, serverIp: '127.0.0.1', autoDiscovery: true }));
      window.location.reload();
  };

  const savedConfig = localStorage.getItem('agrimap-local-config');
  let isLocalModeActive = false;
  try {
      if (savedConfig) isLocalModeActive = JSON.parse(savedConfig).isLocalMode;
  } catch (e) {}

  return (
    <div className="fixed inset-0 bg-black/60 z-[5000] flex items-center justify-center p-4 backdrop-blur-sm">
      <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-md flex flex-col max-h-[95vh] overflow-y-auto animate-slide-up">
        
        {currentUser && !currentUser.isGuest ? (
          // LOGGED IN USER VIEW - Handshake / Company Registration
          <>
            <div className="p-8 border-b bg-indigo-50/45 flex justify-between items-center">
                <div>
                    <h2 className="text-xl font-black text-slate-800 uppercase tracking-tight">
                        Workspace Linker
                    </h2>
                    <p className="text-[9px] font-black text-indigo-600 uppercase mt-1">
                        Active Profile: <span className="text-slate-700">{currentUser.name}</span>
                    </p>
                </div>
                <button onClick={onClose} className="p-2 hover:bg-gray-200 rounded-full transition-colors"><XIcon className="h-5 w-5 text-slate-400" /></button>
            </div>

            {/* TAB SELECTOR FOR LOGGED IN USERS */}
            <div className="flex border-b border-slate-100">
                <button 
                    onClick={() => setLoggedInTab('handshake')}
                    className={`flex-1 py-4 text-[10px] font-black uppercase tracking-wider text-center border-b-2 transition-all ${loggedInTab === 'handshake' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
                >
                    Link (Handshake Request)
                </button>
                <button 
                    onClick={() => setLoggedInTab('register')}
                    className={`flex-1 py-4 text-[10px] font-black uppercase tracking-wider text-center border-b-2 transition-all ${loggedInTab === 'register' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
                >
                    Register New Company
                </button>
            </div>

            <div className="p-10 flex-grow max-h-[60vh] overflow-y-auto">
                {error && (
                    <div className="mb-6 p-4 bg-red-50 text-red-600 rounded-2xl text-xs font-bold">
                        {error}
                    </div>
                )}

                {loggedInTab === 'handshake' ? (
                    // HANDSHAKE REQUEST TAB
                    <div className="space-y-6">
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">
                                SEARCH EXISTING REGISTRY
                            </label>
                            <p className="text-[9px] text-slate-400 uppercase">Search for the company you want to attach with or join</p>
                            <div 
                                className="relative"
                                onFocus={() => setIsLoggedInSearchFocused(true)}
                                onBlur={() => {
                                    setTimeout(() => {
                                        setIsLoggedInSearchFocused(false);
                                    }, 250);
                                }}
                            >
                                <input 
                                    placeholder={t('reg.search_company') || "Search by company name..."} 
                                    className="reg-input pl-12" 
                                    value={orgSearchQuery}
                                    onChange={(e) => {
                                        setOrgSearchQuery(e.target.value);
                                        if (selectedOrgToJoin) {
                                            setSelectedOrgToJoin(null);
                                        }
                                    }}
                                />
                                <SearchIcon size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />

                                {(orgSearchQuery.length > 0 || isLoggedInSearchFocused) && !selectedOrgToJoin && (
                                    <div className="absolute left-0 right-0 top-full mt-1 max-h-56 overflow-y-auto bg-white border-2 border-indigo-100/60 rounded-2xl shadow-2xl animate-in slide-in-from-top-1 p-1 z-50">
                                         {orgList
                                            .filter(o => {
                                                const queryClean = (debouncedOrgQuery || orgSearchQuery || '').toLowerCase().trim();
                                                if (!queryClean) return true;
                                                const queryTranslit = transliterateGeoToEng(queryClean);
                                                const queryReverse = transliterateEngToGeo(queryClean);
                                                
                                                const nameLower = (o.name || '').toLowerCase();
                                                const idLower = (o.id || '').toLowerCase();
                                                const legalLower = (o.legalName || '').toLowerCase();
                                                const agTypeLower = (o.agricultureType || '').toLowerCase();
                                                
                                                return nameLower.includes(queryClean) || 
                                                       idLower.includes(queryClean) || 
                                                       legalLower.includes(queryClean) ||
                                                       agTypeLower.includes(queryClean) ||
                                                       nameLower.includes(queryTranslit) ||
                                                       idLower.includes(queryTranslit) ||
                                                       legalLower.includes(queryTranslit) ||
                                                       nameLower.includes(queryReverse) ||
                                                       idLower.includes(queryReverse);
                                            })
                                            .slice(0, 15)
                                            .map(o => (
                                                <button 
                                                    key={o.id} 
                                                    type="button"
                                                    onClick={(e) => {
                                                        e.preventDefault();
                                                        setSelectedOrgToJoin(o);
                                                        setOrgSearchQuery(o.name);
                                                    }}
                                                    className="w-full p-4 hover:bg-indigo-50 rounded-xl text-left flex justify-between items-center group transition-colors"
                                                >
                                                    <div>
                                                        <div className="text-xs font-black text-slate-800 uppercase tracking-tight group-hover:text-indigo-600">{o.name}</div>
                                                        <div className="text-[8px] font-bold text-slate-400 uppercase mt-0.5">{o.agricultureType || 'Mixed Agriculture'} • {o.type}</div>
                                                    </div>
                                                    <ChevronRightIcon size={14} className="text-indigo-600" />
                                                </button>
                                            ))
                                        }
                                        {orgList.filter(o => {
                                            const queryClean = (debouncedOrgQuery || orgSearchQuery || '').toLowerCase().trim();
                                            if (!queryClean) return true;
                                            const queryTranslit = transliterateGeoToEng(queryClean);
                                            const queryReverse = transliterateEngToGeo(queryClean);
                                            
                                            const nameLower = (o.name || '').toLowerCase();
                                            const idLower = (o.id || '').toLowerCase();
                                            const legalLower = (o.legalName || '').toLowerCase();
                                            const agTypeLower = (o.agricultureType || '').toLowerCase();
                                            
                                            return nameLower.includes(queryClean) || 
                                                   idLower.includes(queryClean) || 
                                                   legalLower.includes(queryClean) ||
                                                   agTypeLower.includes(queryClean) ||
                                                   nameLower.includes(queryTranslit) ||
                                                   idLower.includes(queryTranslit) ||
                                                   legalLower.includes(queryTranslit) ||
                                                   nameLower.includes(queryReverse) ||
                                                   idLower.includes(queryReverse);
                                        }).length === 0 && (
                                            <div className="p-6 text-center text-[10px] font-black text-slate-300 uppercase italic">
                                                No registered companies found
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>

                        {!selectedOrgToJoin && orgSearchQuery.length === 0 && (
                            <div className="mt-4 border border-slate-100 rounded-3xl p-4 bg-slate-50/50">
                                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-2 font-bold animate-pulse">
                                    Discoverable Workspaces ({orgList.length})
                                </span>
                                <div className="max-h-40 overflow-y-auto space-y-2 pr-1 scrollbar-thin">
                                    {orgList.map(o => (
                                        <button 
                                            key={o.id} 
                                            type="button"
                                            onClick={(e) => {
                                                e.preventDefault();
                                                setSelectedOrgToJoin(o);
                                                setOrgSearchQuery(o.name);
                                            }}
                                            className="w-full p-3 bg-white hover:bg-slate-100/80 border border-slate-100 hover:border-slate-200 rounded-2xl flex justify-between items-center group transition-all text-left shadow-sm"
                                        >
                                            <div className="flex items-center gap-2.5">
                                                <div className="w-7 h-7 rounded-xl bg-indigo-50 group-hover:bg-indigo-100 flex items-center justify-center text-indigo-600 transition-colors">
                                                    <BuildingStorefrontIcon size={14} />
                                                </div>
                                                <div>
                                                    <div className="text-[10px] font-black text-slate-800 uppercase tracking-tight group-hover:text-indigo-600">{o.name}</div>
                                                    <div className="text-[8px] font-bold text-slate-400 uppercase mt-0.5">{o.agricultureType || 'Mixed Agriculture'} • {o.type}</div>
                                                </div>
                                            </div>
                                            <ChevronRightIcon size={14} className="text-slate-300 group-hover:text-indigo-400 transition-all font-bold" />
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        {selectedOrgToJoin && (
                            <div className="p-5 bg-indigo-50 rounded-2xl border-2 border-indigo-200 shadow-sm space-y-3">
                                <div className="flex items-start gap-3">
                                    <BuildingStorefrontIcon size={20} className="text-indigo-600 mt-0.5" />
                                    <div>
                                        <div className="text-[11px] font-black text-indigo-900 uppercase tracking-wider">{selectedOrgToJoin.name}</div>
                                        <p className="text-[9px] font-bold text-slate-500 uppercase">Registered corporate workspace</p>
                                        <div className="text-[8px] text-indigo-600/80 font-bold uppercase mt-1">Creator ID: {selectedOrgToJoin.createdBy || 'Unknown'}</div>
                                    </div>
                                </div>
                                <div className="border-t border-indigo-100 pt-3 flex justify-between items-center">
                                    <span className="text-[8px] font-black text-slate-400 uppercase">Handshake ID: {currentUser.id.substring(0,6)}_{selectedOrgToJoin.id.substring(4,10)}</span>
                                    <button 
                                        onClick={() => { setSelectedOrgToJoin(null); setOrgSearchQuery(''); }} 
                                        className="text-[9px] font-black text-red-500 uppercase hover:underline"
                                    >
                                        Change
                                    </button>
                                </div>
                            </div>
                        )}

                        <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                            <p className="text-[9px] text-slate-500 font-bold uppercase leading-relaxed text-center">
                                Sending this request starts an offline-first handshaking agreement queue. Once confirmed by the administrator or our system root console, you will get complete access.
                            </p>
                        </div>
                    </div>
                ) : (
                    // REGISTER NEW COMPANY WORKSPACE
                    <div className="space-y-4">
                        <div className="space-y-1">
                            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">Company Name *</label>
                            <input 
                                placeholder="e.g. Guria blueberries" 
                                className="reg-input" 
                                value={newCompanyData.name} 
                                onChange={e => setNewCompanyData({...newCompanyData, name: e.target.value})} 
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1">
                                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">Tax / VAT ID</label>
                                <input 
                                    placeholder="TAX-XXXXXX" 
                                    className="reg-input" 
                                    value={newCompanyData.taxNumber} 
                                    onChange={e => setNewCompanyData({...newCompanyData, taxNumber: e.target.value})} 
                                />
                            </div>
                            <div className="space-y-1">
                                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">Reg Code</label>
                                <input 
                                    placeholder="REG-XXXX" 
                                    className="reg-input" 
                                    value={newCompanyData.registrationNumber} 
                                    onChange={e => setNewCompanyData({...newCompanyData, registrationNumber: e.target.value})} 
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1">
                                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">Agriculture Theme</label>
                                <select 
                                    className="reg-input py-3"
                                    value={newCompanyData.agricultureType}
                                    onChange={e => setNewCompanyData({...newCompanyData, agricultureType: e.target.value as any})}
                                >
                                    <option value="Blueberries">Blueberries</option>
                                    <option value="Citrus Planting">Citrus Planting</option>
                                    <option value="Vineyards">Vineyards</option>
                                    <option value="Greenhouse">Greenhouse</option>
                                    <option value="Mixed Farming">Mixed Farming</option>
                                </select>
                            </div>
                            <div className="space-y-1">
                                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">Legal Corp Type</label>
                                <select 
                                    className="reg-input py-3"
                                    value={newCompanyData.type}
                                    onChange={e => setNewCompanyData({...newCompanyData, type: e.target.value as any})}
                                >
                                    <option value="LLC">LLC</option>
                                    <option value="Cooperative">Cooperative</option>
                                    <option value="Corporation">Corporation</option>
                                    <option value="Family Office">Family Office</option>
                                </select>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1">
                                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">Region</label>
                                <input 
                                    placeholder="e.g. Guria" 
                                    className="reg-input" 
                                    value={newCompanyData.region} 
                                    onChange={e => setNewCompanyData({...newCompanyData, region: e.target.value})} 
                                />
                            </div>
                            <div className="space-y-1">
                                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block font-medium">Phone</label>
                                <input 
                                    placeholder="+995 XXX XXX" 
                                    className="reg-input" 
                                    value={newCompanyData.phoneNumber} 
                                    onChange={e => setNewCompanyData({...newCompanyData, phoneNumber: e.target.value})} 
                                />
                            </div>
                        </div>
                    </div>
                )}
            </div>

            <div className="p-8 bg-gray-50 border-t flex justify-end gap-3 rounded-b-[2.5rem]">
                <button 
                    onClick={onClose} 
                    type="button"
                    className="px-6 py-4 border border-slate-200 rounded-2xl font-black text-[10px] uppercase tracking-widest bg-white text-slate-600 hover:bg-slate-50 transition-all active:scale-95"
                >
                    Cancel
                </button>
                {loggedInTab === 'handshake' ? (
                    <button 
                        onClick={handleSendHandshake}
                        disabled={isLoading || !selectedOrgToJoin}
                        className={`px-8 py-4 bg-indigo-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl shadow-indigo-100 flex items-center gap-2 active:scale-95 transition-all ${(!selectedOrgToJoin || isLoading) ? 'opacity-50 cursor-not-allowed' : 'hover:bg-indigo-700'}`}
                    >
                        {isLoading ? 'Sending Handshake...' : 'Send Handshake Request'} <CheckIcon size={16} />
                    </button>
                ) : (
                    <button 
                        onClick={handleRegisterCompanyLoggedIn}
                        disabled={isLoading || !newCompanyData.name}
                        className={`px-8 py-4 bg-indigo-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl shadow-indigo-100 flex items-center gap-2 active:scale-95 transition-all ${(!newCompanyData.name || isLoading) ? 'opacity-50 cursor-not-allowed' : 'hover:bg-indigo-700'}`}
                    >
                        {isLoading ? 'Creating Workspace...' : 'Register Company Workspace'} <CheckIcon size={16} />
                    </button>
                )}
            </div>
          </>
        ) : (
          // PUBLIC VISITOR VIEW - Registration & Email Signup
          <>
            <div className="p-8 border-b bg-gray-50/50 flex justify-between items-center">
                <div>
                    <h2 className="text-2xl font-black text-slate-800 uppercase tracking-tight">
                      {t('reg.create_account')}
                    </h2>
                    <p className="text-[10px] font-black text-slate-400 uppercase mt-1">
                      {t('reg.start_journey')}
                    </p>
                </div>
                <button onClick={onClose} className="p-2 hover:bg-gray-200 rounded-full transition-colors"><XIcon className="h-6 w-6 text-slate-400" /></button>
            </div>

            <div className="p-10 flex-grow max-h-[70vh] overflow-y-auto w-full">
                {isLocalModeActive && (
                    <div className="mb-6 p-3 bg-indigo-50 border border-indigo-100 rounded-2xl flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <div className="w-1.5 h-1.5 bg-indigo-600 rounded-full animate-pulse" />
                            <span className="text-[8px] font-black uppercase tracking-widest text-indigo-600">Local Node Active</span>
                        </div>
                        <button 
                            type="button"
                            onClick={handleSwitchToCloudManual}
                            className="text-[8px] font-black text-slate-400 hover:text-red-500 uppercase tracking-widest"
                        >
                            Switch to Cloud
                        </button>
                    </div>
                )}
                {error && (
                    <div className="mb-6 p-4 bg-red-50 text-red-600 rounded-2xl text-xs font-bold space-y-2">
                        <p>{error}</p>
                        {isLocalModeActive && (error.toLowerCase().includes('network') || error.toLowerCase().includes('failed')) && (
                            <button 
                              onClick={handleSwitchToCloudManual}
                              className="text-[10px] font-black text-red-600 uppercase hover:underline"
                            >
                                Emergency: Revert to Cloud Mode
                            </button>
                        )}
                    </div>
                )}

                <div className="space-y-6">
                    <div className="grid grid-cols-2 gap-4">
                        <input placeholder={t('reg.first_name') || "First Name"} className="reg-input" value={formData.firstName} onChange={e => setFormData({...formData, firstName: e.target.value})} />
                        <input placeholder={t('reg.last_name') || "Last Name"} className="reg-input" value={formData.lastName} onChange={e => setFormData({...formData, lastName: e.target.value})} />
                    </div>
                    
                    <input type="email" placeholder={t('reg.email_address') || "Email Address"} className="reg-input" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} />
                    <input type="password" placeholder={t('reg.password') || "Password"} className="reg-input" value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} />

                    <div className="pt-4 border-t border-slate-100">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 block">
                          {t('reg.join_existing')}
                        </label>
                        <div 
                            className="relative"
                            onFocus={() => setIsSearchFocused(true)}
                            onBlur={() => {
                                setTimeout(() => {
                                    setIsSearchFocused(false);
                                }, 250);
                            }}
                        >
                            <input 
                                placeholder={t('reg.search_company') || "Search by company name..."} 
                                className="reg-input pl-12" 
                                value={orgSearchQuery}
                                onChange={(e) => {
                                    setOrgSearchQuery(e.target.value);
                                    if (selectedOrgToJoin) {
                                        setSelectedOrgToJoin(null);
                                    }
                                }}
                            />
                            <SearchIcon size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />

                            {(orgSearchQuery.length > 0 || isSearchFocused) && !selectedOrgToJoin && (
                                <div className="absolute left-0 right-0 top-full mt-1 max-h-48 overflow-y-auto bg-white border-2 border-slate-100 rounded-2xl shadow-2xl animate-in slide-in-from-top-1 z-50 p-1 font-bold">
                                     {orgList
                                        .filter(o => {
                                            const queryClean = (debouncedOrgQuery || orgSearchQuery || '').toLowerCase().trim();
                                            if (!queryClean) return true;
                                            const queryTranslit = transliterateGeoToEng(queryClean);
                                            const queryReverse = transliterateEngToGeo(queryClean);
                                            
                                            const nameLower = (o.name || '').toLowerCase();
                                            const idLower = (o.id || '').toLowerCase();
                                            const legalLower = (o.legalName || '').toLowerCase();
                                            const agTypeLower = (o.agricultureType || '').toLowerCase();
                                            
                                            return nameLower.includes(queryClean) || 
                                                   idLower.includes(queryClean) || 
                                                   legalLower.includes(queryClean) ||
                                                   agTypeLower.includes(queryClean) ||
                                                   nameLower.includes(queryTranslit) ||
                                                   idLower.includes(queryTranslit) ||
                                                   legalLower.includes(queryTranslit) ||
                                                   nameLower.includes(queryReverse) ||
                                                   idLower.includes(queryReverse);
                                        })
                                        .slice(0, 15)
                                        .map(o => (
                                            <button 
                                                key={o.id} 
                                                type="button"
                                                onClick={(e) => {
                                                    e.preventDefault();
                                                    setSelectedOrgToJoin(o);
                                                    setOrgSearchQuery(o.name);
                                                    toast.info((t('reg.select_org_notice') || "{orgName} selected. Connection will be established after registration.").replace('{orgName}', o.name));
                                                }}
                                                className="w-full p-4 hover:bg-indigo-50 border-b border-slate-50 last:border-0 flex justify-between items-center group transition-colors text-left"
                                            >
                                                <div className="font-bold">
                                                    <div className="text-xs font-black text-slate-800 uppercase tracking-tight group-hover:text-indigo-600">{o.name}</div>
                                                    <div className="text-[8px] font-bold text-slate-400 uppercase mt-0.5">{o.agricultureType || 'Mixed Agriculture'} • {o.type}</div>
                                                </div>
                                                <ChevronRightIcon size={14} className="text-slate-300 group-hover:text-indigo-400 transition-all font-bold" />
                                            </button>
                                        ))
                                    }
                                    {orgList.filter(o => {
                                        const queryClean = (debouncedOrgQuery || orgSearchQuery || '').toLowerCase().trim();
                                        if (!queryClean) return true;
                                        const queryTranslit = transliterateGeoToEng(queryClean);
                                        const queryReverse = transliterateEngToGeo(queryClean);
                                        
                                        const nameLower = (o.name || '').toLowerCase();
                                        const idLower = (o.id || '').toLowerCase();
                                        const legalLower = (o.legalName || '').toLowerCase();
                                        const agTypeLower = (o.agricultureType || '').toLowerCase();
                                        
                                        return nameLower.includes(queryClean) || 
                                               idLower.includes(queryClean) || 
                                               legalLower.includes(queryClean) ||
                                               agTypeLower.includes(queryClean) ||
                                               nameLower.includes(queryTranslit) ||
                                               idLower.includes(queryTranslit) ||
                                               legalLower.includes(queryTranslit) ||
                                               nameLower.includes(queryReverse) ||
                                               idLower.includes(queryReverse);
                                    }).length === 0 && (
                                        <div className="p-6 text-center text-[10px] font-black text-slate-300 uppercase italic">
                                          {t('reg.searching_global')}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        {!selectedOrgToJoin && orgSearchQuery.length === 0 && (
                            <div className="mt-4 border border-slate-100 rounded-3xl p-4 bg-slate-50/50">
                                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-2 font-bold">
                                    Discoverable Workspaces ({orgList.length})
                                </span>
                                <div className="max-h-40 overflow-y-auto space-y-2 pr-1 scrollbar-thin">
                                    {orgList.map(o => (
                                        <button 
                                            key={o.id} 
                                            type="button"
                                            onClick={(e) => {
                                                e.preventDefault();
                                                setSelectedOrgToJoin(o);
                                                setOrgSearchQuery(o.name);
                                            }}
                                            className="w-full p-3 bg-white hover:bg-slate-100/80 border border-slate-100 hover:border-slate-200 rounded-2xl flex justify-between items-center group transition-all text-left shadow-sm"
                                        >
                                            <div className="flex items-center gap-2.5">
                                                <div className="w-7 h-7 rounded-xl bg-indigo-50 group-hover:bg-indigo-100 flex items-center justify-center text-indigo-600 transition-colors">
                                                    <BuildingStorefrontIcon size={14} />
                                                </div>
                                                <div>
                                                    <div className="text-[10px] font-black text-slate-800 uppercase tracking-tight group-hover:text-indigo-600">{o.name}</div>
                                                    <div className="text-[8px] font-bold text-slate-400 uppercase mt-0.5">{o.agricultureType || 'Mixed Agriculture'} • {o.type}</div>
                                                </div>
                                            </div>
                                            <ChevronRightIcon size={14} className="text-slate-300 group-hover:text-indigo-400 transition-all" />
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        {selectedOrgToJoin && (
                            <div className="mt-4 p-4 bg-indigo-50 rounded-2xl border border-indigo-100 flex items-center justify-between font-bold">
                                <div className="flex items-center gap-3">
                                    <BuildingStorefrontIcon size={16} className="text-indigo-600" />
                                    <div className="text-[10px] font-black text-indigo-700 uppercase tracking-tight">
                                      {(t('reg.joining_org') || 'Joining: {orgName}').replace('{orgName}', selectedOrgToJoin.name)}
                                    </div>
                                </div>
                                <button onClick={() => { setSelectedOrgToJoin(null); setOrgSearchQuery(''); }} className="text-[10px] font-black text-red-500 uppercase hover:underline">
                                  {t('reg.cancel_btn')}
                                </button>
                            </div>
                        )}
                    </div>
                </div>
                <p className="mt-6 text-[10px] text-slate-400 font-bold uppercase text-center leading-relaxed">
                  {t('reg.terms_agreement')}
                </p>
            </div>

            <div className="p-8 bg-gray-50 border-t flex flex-col gap-4 rounded-b-[2.5rem] w-full">
                <button
                    type="button"
                    onClick={onGoogleLogin}
                    className="w-full py-4 bg-white border border-gray-200 rounded-2xl text-gray-700 font-black text-xs uppercase tracking-widest shadow-sm hover:bg-gray-50 transition-all active:scale-95 flex items-center justify-center gap-3"
                >
                    <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" className="w-5 h-5" />
                    {t('reg.signup_google')}
                </button>
                
                <div className="flex items-center gap-4">
                    <div className="flex-1 h-px bg-gray-200"></div>
                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                      {t('reg.or_divider')}
                    </span>
                    <div className="flex-1 h-px bg-gray-200"></div>
                </div>

                <div className="flex justify-between items-center w-full">
                    <button 
                      onClick={() => {
                        onClose();
                        window.dispatchEvent(new CustomEvent('open-login-modal'));
                      }} 
                      className="text-[10px] font-black text-indigo-600 uppercase tracking-widest hover:underline text-left mr-2"
                    >
                      {t('reg.already_have_account')}
                    </button>
                    <button onClick={handleFinish} className="px-8 py-4 bg-indigo-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-indigo-100 flex items-center gap-2 active:scale-95 transition-all flex-shrink-0">
                        {t('reg.register_email')} <ChevronRightIcon size={18} />
                    </button>
                </div>
            </div>
          </>
        )}
      </div>
      <style>{`
        .reg-input { width: 100%; padding: 1rem 1.25rem; border: 2px solid #f1f5f9; border-radius: 1.25rem; font-weight: 700; font-size: 0.875rem; outline: none; transition: all 0.2s; background: #f8fafc; }
        .reg-input:focus { border-color: #6366f1; background: white; }
        .animate-slide-up { animation: slide-up 0.3s ease-out; }
        @keyframes slide-up { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
    </div>
  );
};

export default RegistrationModal;
