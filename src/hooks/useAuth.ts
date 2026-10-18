import {isLocalRuntime,localRequest,localSession} from '../local/runtime';
import { useState, useEffect } from 'react';
import { auth, db, doc, getDocFromServer, setDoc, collection, query, where, getDocsFromServer, deleteDoc, getDoc, getDocs, updateDoc } from '../firebase';
import { onAuthStateChanged, signInWithPopup, signInWithRedirect, getRedirectResult, GoogleAuthProvider, signOut, signInWithEmailAndPassword, sendPasswordResetEmail, sendEmailVerification } from 'firebase/auth';
import { onSnapshot } from '../firebase';
import { User } from '../types';
import { handleFirestoreError, sanitizeObject } from '../lib/firebaseUtils';
import { safeStorage } from '../services/storageService';
import { toast } from 'sonner';
import { USE_FIREBASE } from '../config';

export const useAuth = () => {
    const [currentUser, setCurrentUser] = useState<User | null>(null);
    const [isAuthReady, setIsAuthReady] = useState(false);
    const [isGooglePending, setIsGooglePending] = useState(false);

    useEffect(() => {
        if (currentUser && currentUser.id !== 'guest') {
            try {
                const cache = JSON.parse(localStorage.getItem('agrimap-user-profiles-cache') || '{}');
                cache[currentUser.id] = currentUser;
                localStorage.setItem('agrimap-user-profiles-cache', JSON.stringify(cache));
            } catch (e) {
                console.warn("Failed to cache user profile:", e);
            }
        }
    }, [currentUser]);

    useEffect(() => {
        if(isLocalRuntime){
            let active=true;const expired=()=>window.location.assign('/local');
            window.addEventListener('agrimap-local-session-expired',expired);
            localRequest('profile').then(profile=>{if(active){setCurrentUser(profile);setIsAuthReady(true);}}).catch(()=>window.location.assign('/local'));
            return()=>{active=false;window.removeEventListener('agrimap-local-session-expired',expired);};
        }
        let unsubDoc: (() => void) | null = null;
        
        // Rapid safety timeout for fast startup: if Auth takes > 2.5s, fall back immediately
        const authTimeout = setTimeout(() => {
            if (!isAuthReady) {
                console.warn("[Auth] Rapid initialization timeout (2.5s), activating fallback/cached user state...");
                
                // Optimistic check: if we have a valid cached profile, use it first before reverting to guest
                try {
                    const cache = JSON.parse(localStorage.getItem('agrimap-user-profiles-cache') || '{}');
                    const lastLoginEmail = localStorage.getItem('agrimap-last-login-email');
                    const cachedUser = Object.values(cache).find((u: any) => u?.email?.trim().toLowerCase() === lastLoginEmail?.trim().toLowerCase()) as User;
                    
                    if (cachedUser && auth.currentUser?.uid === cachedUser.id) {
                        console.log("[Auth] Found cached user during timeout, using as optimistic state");
                        setCurrentUser(cachedUser);
                        setIsAuthReady(true);
                        return;
                    }
                } catch (e) {}

                setCurrentUser(prev => prev || { 
                    id: 'guest', 
                    globalUniqueId: 'G-GUEST',
                    activeRole: 'guest',
                    name: 'Guest Explorer', 
                    email: 'guest@agrimap.io',
                    verificationStatus: 'unverified',
                    kycStatus: 'none',
                    isProfileDiscoverable: false,
                    isPubliclyVisible: false,
                    status: 'active',
                    isGuest: true, 
                    roles: ['Guest'], 
                    aiQueryCount: 0, 
                    createdAt: new Date().toISOString() 
                });
                setIsAuthReady(true);
            }
        }, 2500); 

        if (!USE_FIREBASE) {
            // ... (Mock logic)
            const savedUser = localStorage.getItem('agri-planter-mock-user');
            if (savedUser) {
                setCurrentUser(JSON.parse(savedUser));
            } else {
                setCurrentUser({ 
                    id: 'guest', 
                    globalUniqueId: 'G-GUEST',
                    activeRole: 'guest',
                    name: 'Guest Explorer', 
                    email: 'guest@agrimap.io',
                    verificationStatus: 'unverified',
                    kycStatus: 'none',
                    isProfileDiscoverable: false,
                    isPubliclyVisible: false,
                    status: 'active',
                    isGuest: true, 
                    roles: ['Guest'], 
                    aiQueryCount: 0, 
                    createdAt: new Date().toISOString() 
                });
            }
            setIsAuthReady(true);
            return;
        }

        let isFirstAuthCheck = true;

        const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
            if (unsubDoc) {
                unsubDoc();
                unsubDoc = null;
            }

            if (user) {
                isFirstAuthCheck = false;
                // Save last login email for optimistic recovery
                if (user.email) localStorage.setItem('agrimap-last-login-email', user.email);

                const userDocRef = doc(db, 'users', user.uid);
                
                // First, check if document exists before setting up listener
                try {
                    // Try to get from cache first for maximum speed/offline resilience, then try server
                    let userDoc;
                    try {
                        // Use getDoc which checks local cache first
                        userDoc = await getDoc(userDocRef);
                    } catch (e: any) {
                        console.warn("Firestore fetch failed, checking emergency profile cache...", e?.message);
                        const manualCache = JSON.parse(localStorage.getItem('agrimap-user-profiles-cache') || '{}');
                        const cached = manualCache[user.uid];
                        if (cached) {
                            console.log("[Auth] Found user in manual profile cache");
                            setCurrentUser(cached);
                            setIsAuthReady(true);
                            return;
                        }
                    }
                    
                    if (userDoc && userDoc.exists()) {
                        const userData = userDoc.data() as User;
                        setCurrentUser(userData);
                        setIsAuthReady(true); // Ready once we have real data

                        // Now set up real-time listener for future updates
                        unsubDoc = onSnapshot(userDocRef, (docSnap) => {
                            if (docSnap.exists()) {
                                const newData = docSnap.data() as User;
                                
                                // Sync verification status from Firebase Auth to Firestore if needed
                                if (user.emailVerified && newData.verificationStatus === 'unverified' && newData.personalNumber) {
                                    updateDoc(userDocRef, { verificationStatus: 'verified', isVerified: true }).catch(console.error);
                                }

                                setCurrentUser(prev => {
                                    if (!prev) return newData;
                                    // Stabilize to prevent unnecessary App re-renders
                                    const prevHash = `${prev.id}_${prev.activeRole}_${prev.currentOrgId || ''}_${prev.subscriptionType}`;
                                    const nextHash = `${newData.id}_${newData.activeRole}_${newData.currentOrgId || ''}_${newData.subscriptionType}`;
                                    if (prevHash === nextHash) return prev;
                                    return newData;
                                });
                            }
                        }, (error: any) => {
                            if (error && typeof error.message === 'string' && error.message.includes('Target ID already exists')) {
                                console.warn("User doc snapshot internal warning:", error.message);
                            } else {
                                console.error("User doc snapshot error:", error);
                            }
                        });
                    } else if (user.email && navigator.onLine) {
                        // Check if a user with this email was pre-created (onboarded)
                        const q = query(collection(db, 'users'), where('email', '==', user.email));
                        let querySnapshot = await getDocs(q);
                        
                        if (!querySnapshot.empty) {
                            const existingDoc = querySnapshot.docs[0];
                            const existingData = existingDoc.data() as User;
                            
                            // Migrate to the new UID
                            const migratedUser: User = {
                                ...existingData,
                                id: user.uid,
                                name: existingData.name || user.displayName || 'New User'
                            };
                            
                            await setDoc(userDocRef, sanitizeObject(migratedUser));
                            if (existingDoc.id !== user.uid) {
                                try { await deleteDoc(doc(db, 'users', existingDoc.id)); } catch (e) {}
                            }
                            setCurrentUser(migratedUser);
                            setIsAuthReady(true);
                        } else {
                            // Non-registered email
                            const isNewRegistration = user.metadata.creationTime === user.metadata.lastSignInTime;
                            
                            if (isNewRegistration) {
                                // Wait a bit for App.tsx registration logic to finish writing if applicable
                                let retries = 3;
                                while (retries > 0) {
                                    await new Promise(resolve => setTimeout(resolve, 1000));
                                    const finalDoc = await getDocFromServer(userDocRef);
                                    if (finalDoc.exists()) {
                                        setCurrentUser(finalDoc.data() as User);
                                        setIsAuthReady(true);
                                        return;
                                    }
                                    retries--;
                                }

                                const digits = Math.floor(1000 + Math.random() * 9000).toString();
                                const newUser: User = {
                                    id: user.uid,
                                    globalUniqueId: `G-${digits}`,
                                    individualUniqueId: `I-${digits}`,
                                    activeRole: 'individual',
                                    name: user.displayName || 'New User',
                                    email: user.email || '',
                                    roles: ['Guest'],
                                    status: 'active',
                                    isGuest: true,
                                    createdAt: new Date().toISOString(),
                                    aiQueryCount: 0,
                                    verificationStatus: 'unverified',
                                    kycStatus: 'none',
                                    isProfileDiscoverable: false,
                                    isPubliclyVisible: true
                                };
                                await setDoc(userDocRef, sanitizeObject(newUser));
                                setCurrentUser(newUser);
                                setIsAuthReady(true);
                            } else {
                                // Existing Firebase Auth user but NO Firestore record
                                setCurrentUser({ 
                                    id: user.uid,
                                    globalUniqueId: 'G-GUEST',
                                    activeRole: 'guest',
                                    name: user.displayName || 'Guest Explorer', 
                                    email: user.email || 'guest@agrimap.io',
                                    verificationStatus: 'unverified',
                                    kycStatus: 'none',
                                    isProfileDiscoverable: false,
                                    isPubliclyVisible: false,
                                    status: 'active',
                                    isGuest: true, 
                                    roles: ['Guest'], 
                                    aiQueryCount: 0, 
                                    createdAt: new Date().toISOString() 
                                });
                                setIsAuthReady(true);
                            }
                        }
                    } else {
                        // Offline recovery or no email
                        const manualCache = JSON.parse(localStorage.getItem('agrimap-user-profiles-cache') || '{}');
                        const cached = manualCache[user.uid];
                        if (cached) {
                            setCurrentUser(cached);
                        } else {
                            setCurrentUser({ 
                                id: user.uid,
                                globalUniqueId: 'G-GUEST',
                                activeRole: 'guest',
                                name: user.displayName || 'Guest Explorer', 
                                email: user.email || 'guest@agrimap.io',
                                verificationStatus: 'unverified',
                                kycStatus: 'none',
                                isProfileDiscoverable: false,
                                isPubliclyVisible: false,
                                status: 'active',
                                isGuest: true, 
                                roles: ['Guest'], 
                                aiQueryCount: 0, 
                                createdAt: new Date().toISOString() 
                            });
                        }
                        setIsAuthReady(true);
                    }
                } catch (error: any) {
                    console.error("Auth initialization fetch error:", error);
                    // Final emergency fallback
                    try {
                        const cache = JSON.parse(localStorage.getItem('agrimap-user-profiles-cache') || '{}');
                        const cached = cache[user.uid];
                        if (cached) {
                            setCurrentUser(cached);
                        }
                    } catch (e) {}
                    setIsAuthReady(true);
                }
            } else {
                if (!isFirstAuthCheck) {
                    // Explicit logout, downgrade IMMEDIATELY to prevent active Firestore listeners from erroring
                    setCurrentUser({ 
                        id: 'guest', 
                        globalUniqueId: 'G-GUEST',
                        activeRole: 'guest',
                        name: 'Guest Explorer', 
                        email: 'guest@agrimap.io',
                        verificationStatus: 'unverified',
                        kycStatus: 'none',
                        isProfileDiscoverable: false,
                        isPubliclyVisible: false,
                        status: 'active',
                        isGuest: true, 
                        roles: ['Guest'], 
                        aiQueryCount: 0, 
                        createdAt: new Date().toISOString() 
                    });
                    setIsAuthReady(true);
                } else {
                    isFirstAuthCheck = false;
                    // Small delay for guest fallback on refresh to avoid flickering guest state
                    // while Firebase manages to find the session cookie
                    setTimeout(() => {
                        setCurrentUser(prev => {
                            // If we already have a real user from optimistic/previous state, 
                            // and Firebase says 'null', only downgrade if we are truly sure.
                            if (prev && !prev.isGuest && navigator.onLine) {
                                // If online but Firebase says null, then it's a real logout
                                return { 
                                    id: 'guest', 
                                    globalUniqueId: 'G-GUEST',
                                    activeRole: 'guest',
                                    name: 'Guest Explorer', 
                                    email: 'guest@agrimap.io',
                                    verificationStatus: 'unverified',
                                    kycStatus: 'none',
                                    isProfileDiscoverable: false,
                                    isPubliclyVisible: false,
                                    status: 'active',
                                    isGuest: true, 
                                    roles: ['Guest'], 
                                    aiQueryCount: 0, 
                                    createdAt: new Date().toISOString() 
                                };
                            }
                            return prev || { 
                                id: 'guest', 
                                globalUniqueId: 'G-GUEST',
                                activeRole: 'guest',
                                name: 'Guest Explorer', 
                                email: 'guest@agrimap.io',
                                verificationStatus: 'unverified',
                                kycStatus: 'none',
                                isProfileDiscoverable: false,
                                isPubliclyVisible: false,
                                status: 'active',
                                isGuest: true, 
                                roles: ['Guest'], 
                                aiQueryCount: 0, 
                                createdAt: new Date().toISOString() 
                            };
                        });
                        setIsAuthReady(true);
                    }, 3000);
                }
            }
        });
        return () => {
            clearTimeout(authTimeout);
            unsubscribeAuth();
            if (unsubDoc) unsubDoc();
        };
    }, []);

    const handleUpdateUser = async (updatedUser: User) => {
        if(isLocalRuntime){await setDoc(doc(db,'users',localSession().user.id),sanitizeObject(updatedUser),{merge:true});setCurrentUser(await localRequest('profile'));toast.success('Profile saved on farm server');return;}
        setCurrentUser(updatedUser);
        try {
            const cache = JSON.parse(localStorage.getItem('agrimap-user-profiles-cache') || '{}');
            if (updatedUser.id) {
                cache[updatedUser.id] = updatedUser;
                localStorage.setItem('agrimap-user-profiles-cache', JSON.stringify(cache));
            }
        } catch (e) {}

        if (!USE_FIREBASE || updatedUser.id === 'root-system' || updatedUser.id === 'guest' || updatedUser.isGuest || !auth.currentUser) {
            localStorage.setItem('agri-planter-mock-user', JSON.stringify(updatedUser));
            if (updatedUser.id === 'root-system') {
                localStorage.setItem('agri-planter-session', JSON.stringify(updatedUser));
            }
            // Only toast if not a background/silent update for guest
            if (!updatedUser.isGuest) {
                toast.success("Profile updated locally");
            }
            return;
        }
        if (updatedUser.id) {
            try {
                await setDoc(doc(db, 'users', updatedUser.id), sanitizeObject(updatedUser));
                toast.success("Profile updated successfully");
            } catch (error) {
                handleFirestoreError(error, 'write', `users/${updatedUser.id}`);
                toast.error("Failed to sync profile to cloud");
            }
        }
    };

    const handleLogout = async () => {
        if(isLocalRuntime){await localRequest('logout',{});window.location.assign('/local');return;}
        // Clear all session and registration related data
        localStorage.removeItem('agri-planter-session');
        localStorage.removeItem('agri-planter-active-org');
        localStorage.removeItem('agri-planter-mode');
        localStorage.removeItem('agri-planter-pending-org');
        localStorage.removeItem('agri-planter-temp-boundary');
        localStorage.removeItem('agri-planter-is-registering');
        sessionStorage.removeItem('agri-planter-welcome-seen');

        if (!USE_FIREBASE) {
            localStorage.removeItem('agri-planter-mock-user');
            window.location.reload();
            return;
        }
        try {
            await signOut(auth);
            window.location.reload();
        } catch (error) {
            console.error("Logout Error:", error);
            window.location.reload();
        }
    };

    const handleEmailLogin = async (email: string, pass: string) => {
        if(isLocalRuntime){await localRequest('login',{username:email,password:pass});window.location.reload();return;}
        const formattedEmail = email.trim().toLowerCase();
        
        // 1. Check for Offline Fallback (even before Firebase if Navigator is offline, or as a catch-all)
        const isOffline = !navigator.onLine;
        
        try {
            if (!USE_FIREBASE) {
                // Mock login logic remains similar but uses formattedEmail
                const savedUsersStr = localStorage.getItem('agri-planter-mock-all-users') || '[]';
                const allUsers: User[] = JSON.parse(savedUsersStr);
                const existingUser = allUsers.find(u => u.email === formattedEmail);

                if (existingUser) {
                    setCurrentUser(existingUser);
                    localStorage.setItem('agri-planter-mock-user', JSON.stringify(existingUser));
                    toast.success(`Logged in as ${existingUser.name} (Mock)`);
                    return;
                }

                const digits = Math.floor(1000 + Math.random() * 9000).toString();
                const mockUser: User = {
                    id: `mock-${formattedEmail}-${Date.now()}`,
                    globalUniqueId: `G-${digits}`,
                    individualUniqueId: `I-${digits}`,
                    activeRole: 'individual',
                    name: formattedEmail.split('@')[0],
                    email: formattedEmail,
                    roles: ['Admin'],
                    status: 'active',
                    isGuest: false,
                    createdAt: new Date().toISOString(),
                    aiQueryCount: 0,
                    verificationStatus: 'verified',
                    kycStatus: 'none',
                    isProfileDiscoverable: true,
                    isPubliclyVisible: true
                };
                
                allUsers.push(mockUser);
                localStorage.setItem('agri-planter-mock-all-users', JSON.stringify(allUsers));
                localStorage.setItem('agri-planter-mock-user', JSON.stringify(mockUser));
                setCurrentUser(mockUser);
                toast.success("Logged in (Mock Mode)");
                return;
            }

            // ATTEMPT FIREBASE LOGIN
            let isLocalNode = false;
            try {
                console.log("[Auth] Attempting login for:", formattedEmail);
                if (!formattedEmail.includes('@')) {
                    throw new Error("Please enter a valid email address.");
                }

                // Check for Local Server config to decide on emulator usage if not already connected
                const savedLocalConfig = localStorage.getItem('agrimap-local-config');
                if (savedLocalConfig) {
                    try {
                        const lConfig = JSON.parse(savedLocalConfig);
                        isLocalNode = lConfig.isLocalMode && lConfig.serverIp;
                    } catch (e) {}
                }

                if (isLocalNode && isOffline) {
                    // Force skip Firebase if definitely offline and in local mode
                    throw { code: 'auth/network-request-failed', message: 'Offline local node requested' };
                }
                
                const userCredential = await signInWithEmailAndPassword(auth, formattedEmail, pass);
                console.log("[Auth] Login successful:", userCredential.user.uid);
                
                // On success, try to fetch the profile immediately to update state faster than onAuthStateChanged
                const userDocRef = doc(db, 'users', userCredential.user.uid);
                let profileDoc = await getDoc(userDocRef);
                if (!profileDoc.exists()) {
                    profileDoc = await getDocFromServer(userDocRef);
                }
                
                if (profileDoc.exists()) {
                    const userData = profileDoc.data() as User;
                    setCurrentUser(userData);
                    // Update manual cache
                    const cache = JSON.parse(localStorage.getItem('agrimap-user-profiles-cache') || '{}');
                    cache[userData.id] = userData;
                    localStorage.setItem('agrimap-user-profiles-cache', JSON.stringify(cache));
                }

                // Mark as authorized for offline recovery
                const successfulLogins = JSON.parse(localStorage.getItem('agrimap-authorized-emails') || '{}');
                successfulLogins[formattedEmail] = {
                    lastLogin: new Date().toISOString(),
                    uid: userCredential.user.uid
                };
                localStorage.setItem('agrimap-authorized-emails', JSON.stringify(successfulLogins));
                
                toast.success(`Welcome back, ${profileDoc.exists() ? (profileDoc.data() as User).name : userCredential.user.email}`);
            } catch (firebaseError: any) {
                console.error("Firebase Auth Attempt Failed:", firebaseError.code);
                
                // OFFLINE / QUOTA FALLBACK
                const isNetworkError = firebaseError.code === 'auth/network-request-failed' || firebaseError.code === 'unknown';
                const isQuotaError = firebaseError.message?.includes('Quota exceeded');
                
                if (isLocalNode && (isNetworkError || isOffline)) {
                    const confirmSwitch = window.confirm("Connection to Local Server Node failed. Would you like to switch to Cloud Mode for this session?");
                    if (confirmSwitch) {
                        localStorage.setItem('agrimap-local-config', JSON.stringify({ isLocalMode: false, serverIp: '127.0.0.1', autoDiscovery: true }));
                        window.location.reload();
                        return;
                    }
                }

                if (isOffline || isNetworkError || isQuotaError) {
                    console.warn("[Auth] Using Offline Fallback for:", formattedEmail);
                    
                    // Check if they have ever logged in on this device successfully before
                    const authDirectoryByEmail = JSON.parse(localStorage.getItem('agrimap-authorized-emails') || '{}');
                    const authRecord = authDirectoryByEmail[formattedEmail];
                    
                    // Also check for the actual profile data in the "all users" cache
                    const localProfiles = JSON.parse(localStorage.getItem('agrimap-user-profiles-cache') || '{}');
                    const cachedProfile = localProfiles[authRecord?.uid] || Object.values(localProfiles).find((u: any) => u?.email?.trim().toLowerCase() === formattedEmail?.trim().toLowerCase());

                    if (cachedProfile) {
                        toast.info("Offline/Local Access Granted. Syncing will resume when online.");
                        setCurrentUser(cachedProfile as User);
                        localStorage.setItem('agri-planter-session', JSON.stringify(cachedProfile));
                        localStorage.setItem('agrimap-last-login-email', formattedEmail);
                        setIsAuthReady(true);
                        return;
                    }
                    
                    if (isQuotaError) {
                        throw new Error("Firestore Quota Exceeded. You can only login with accounts that have been used on this device before while in offline mode.");
                    }
                    
                    if (isOffline || isNetworkError) {
                        throw new Error("No Internet. You can only login offline if you have logged in on this device before while online.");
                    }
                }
                
                // If it's a real Auth error (bad password, etc.), rethrow it to the standard handler
                throw firebaseError;
            }
        } catch (error: any) {
            console.error("Email Login Error Details:", error);
            const errorCode = error.code || "";
            const errorMessage = error.message || "";

            if (errorCode === 'auth/invalid-credential' || errorMessage.includes('auth/invalid-credential')) {
                throw new Error("Login failed: The email or password may be incorrect. If you originally signed up with Google, please use the 'Continue with Google' button below.");
            }
            if (errorCode === 'auth/operation-not-allowed' || errorMessage.includes('auth/operation-not-allowed')) {
                throw new Error("Email/Password login is currently disabled. Please contact support or use Google Login.");
            }
            if (errorCode === 'auth/user-disabled' || errorMessage.includes('auth/user-disabled')) {
                throw new Error("This account has been disabled. Please contact support.");
            }
            if (errorCode === 'auth/too-many-requests' || errorMessage.includes('auth/too-many-requests')) {
                throw new Error("Too many failed login attempts. Please try again later or reset your password.");
            }
            if (errorCode === 'auth/user-not-found') {
                throw new Error("No account found with this email. Please check the spelling or register first.");
            }
            if (errorCode === 'auth/wrong-password') {
                throw new Error("Incorrect password. If you forgot your password, please use the 'Forgot Password?' link.");
            }
            throw new Error(errorMessage || "Login failed. Please try again.");
        }
    };

    useEffect(() => {
        if (USE_FIREBASE && !isLocalRuntime) {
            getRedirectResult(auth).then(async (result) => {
                if (result && result.user) {
                    console.log("[Auth] Redirect sign-in successful:", result.user.uid);
                    const userDocRef = doc(db, 'users', result.user.uid);
                    const profileDoc = await getDoc(userDocRef);
                    if (profileDoc.exists()) {
                        const userData = profileDoc.data() as User;
                        setCurrentUser(userData);
                        const cache = JSON.parse(localStorage.getItem('agrimap-user-profiles-cache') || '{}');
                        cache[userData.id] = userData;
                        localStorage.setItem('agrimap-user-profiles-cache', JSON.stringify(cache));
                    }
                    toast.success(`Welcome back, ${profileDoc.exists() ? (profileDoc.data() as User).name : result.user.displayName || 'User'}`);
                }
            }).catch((err) => {
                console.warn("[Auth] Redirect sign-in result check:", err);
            });
        }
    }, []);

    const handleGoogleLogin = async () => {
        if(isLocalRuntime){toast.info('Use your farm server account. Cloud backup has a separate connection.');return;}
        if (!USE_FIREBASE) {
            handleEmailLogin('google-user@example.com', '');
            return;
        }
        if (isGooglePending) {
            console.warn("[Auth] A Google Login request is already pending.");
            return;
        }
        setIsGooglePending(true);
        const provider = new GoogleAuthProvider();
        try {
            const result = await signInWithPopup(auth, provider);
            console.log("[Auth] Google Login successful:", result.user.uid);
            
            // Fast profile fetch
            const userDocRef = doc(db, 'users', result.user.uid);
            const profileDoc = await getDoc(userDocRef);
            if (profileDoc.exists()) {
                const userData = profileDoc.data() as User;
                setCurrentUser(userData);
                // Update manual cache
                const cache = JSON.parse(localStorage.getItem('agrimap-user-profiles-cache') || '{}');
                cache[userData.id] = userData;
                localStorage.setItem('agrimap-user-profiles-cache', JSON.stringify(cache));
            }
            toast.success(`Welcome back, ${profileDoc.exists() ? (profileDoc.data() as User).name : result.user.displayName || 'User'}`);
        } catch (error: any) {
            console.error("Login Error:", error);
            const errCode = error?.code || '';
            const errMsg = error?.message || '';
            
            if (errCode === 'auth/popup-blocked' || errMsg.includes('popup-blocked') || errMsg.includes('popup blocked')) {
                console.warn("[Auth] Google Sign-In popup was blocked by browser iframe policies. Trying redirect auth fallback...");
                try {
                    await signInWithRedirect(auth, provider);
                    return;
                } catch (redirectErr) {
                    console.error("[Auth] Redirect sign-in failed:", redirectErr);
                }
                toast.error("Google Sign-In popup was blocked by browser frame restrictions.", {
                    duration: 10000,
                    action: {
                        label: "Open in New Tab",
                        onClick: () => window.open(window.location.href, '_blank')
                    }
                });
            } else if (errCode === 'auth/cancelled-popup-request' || errMsg.includes('cancelled-popup-request') || errMsg.includes('popup closed')) {
                toast.info("Google Sign-In popup was closed. Please try again.");
            } else {
                toast.error("Google Login failed: " + (error?.message || "Please check browser permissions or try in a new tab."));
            }
        } finally {
            setIsGooglePending(false);
        }
    };

    const handleResetPassword = async (email: string) => {
        if(isLocalRuntime){toast.info('Use Local accounts & records in the top bar for server account controls.');return;}
        if (!USE_FIREBASE) {
            toast.success(`Password reset link sent to ${email} (Mock Mode)`);
            return;
        }
        if (!email) {
            toast.error("Email address is required for password reset.");
            return;
        }
        try {
            await sendPasswordResetEmail(auth, email);
            toast.success(`Password reset link sent to ${email}`);
        } catch (error: any) {
            console.error("Reset Password Error:", error);
            if (error.code === 'auth/operation-not-allowed') {
                toast.error("Password reset is currently disabled in Firebase Console.");
            } else {
                toast.error(error.message || "Failed to send reset link");
            }
        }
    };

    const handleSwitchOrg = async (orgId: string | null) => {
        if (!currentUser || currentUser.isGuest) return;
        const updatedUser = { ...currentUser, currentOrgId: orgId };
        setCurrentUser(updatedUser);
        localStorage.setItem('agri-planter-active-org', orgId || '');
        try {
            const cache = JSON.parse(localStorage.getItem('agrimap-user-profiles-cache') || '{}');
            cache[currentUser.id] = updatedUser;
            localStorage.setItem('agrimap-user-profiles-cache', JSON.stringify(cache));
        } catch (e) {}
        
        if (USE_FIREBASE && auth.currentUser && currentUser.id !== 'root-system') {
            try {
                await setDoc(doc(db, 'users', currentUser.id), { currentOrgId: orgId }, { merge: true });
            } catch (error) {
                handleFirestoreError(error, 'write', `users/${currentUser.id}`);
            }
        } else {
            localStorage.setItem('agri-planter-mock-user', JSON.stringify(updatedUser));
            if (currentUser.id === 'root-system') {
                localStorage.setItem('agri-planter-session', JSON.stringify(updatedUser));
            }
        }
    };

    const handleSwitchRole = async (role: 'individual' | 'company' | 'worker') => {
        if (!currentUser || currentUser.isGuest) return;
        
        let targetId = '';
        if (role === 'individual') targetId = currentUser.individualUniqueId || '';
        if (role === 'company') targetId = currentUser.companyUniqueId || '';
        if (role === 'worker') targetId = currentUser.workerUniqueId || '';

        // Generate missing sub-IDs on the fly if needed
        if (!targetId) {
            const { generateUniqueId } = await import('../lib/firebaseUtils');
            const digits = currentUser.globalUniqueId.split('-')[1];
            targetId = generateUniqueId(role, digits);
        }

        const roleUpdate: any = {
            activeRole: role,
        };
        
        if (role === 'individual') roleUpdate.individualUniqueId = targetId;
        if (role === 'company') roleUpdate.companyUniqueId = targetId;
        if (role === 'worker') roleUpdate.workerUniqueId = targetId;

        const updatedUser = { ...currentUser, ...roleUpdate };
        setCurrentUser(updatedUser);
        try {
            const cache = JSON.parse(localStorage.getItem('agrimap-user-profiles-cache') || '{}');
            cache[currentUser.id] = updatedUser;
            localStorage.setItem('agrimap-user-profiles-cache', JSON.stringify(cache));
        } catch (e) {}
        
        if (USE_FIREBASE && auth.currentUser && currentUser.id !== 'root-system') {
            try {
                await setDoc(doc(db, 'users', currentUser.id), roleUpdate, { merge: true });
                toast.success(`Switched to ${role.toUpperCase()} workspace`);
            } catch (error) {
                handleFirestoreError(error, 'write', `users/${currentUser.id}`);
            }
        } else {
            localStorage.setItem('agri-planter-mock-user', JSON.stringify(updatedUser));
            toast.success(`Switched to ${role.toUpperCase()} (Mock)`);
        }
    };

    const handleDeleteAccount = async () => {
        if(isLocalRuntime){toast.info('Use Local accounts & records in the top bar for server account controls.');return;}
        if (!currentUser) return;
        
        const confirmDelete = window.confirm("Are you SURE you want to delete your profile? This will permanently remove your global identity and all associated private data. This action CANNOT be undone.");
        if (!confirmDelete) return;

        try {
            if (USE_FIREBASE && auth.currentUser) {
                // 1. Delete Firestore record
                try {
                    await deleteDoc(doc(db, 'users', currentUser.id));
                } catch (e) {
                    console.warn("Could not delete user firestore doc:", e);
                }
                
                // 2. Delete Auth record (requires recent login)
                try {
                    await auth.currentUser.delete();
                } catch (error: any) {
                    console.error("Auth delete error:", error);
                    if (error.code === 'auth/requires-recent-login') {
                        toast.error("Security alert: Deletion requires a fresh login. Please logout and login again before deleting your account.");
                        return;
                    }
                }
            }

            // Also clear from mock_users and local storage
            const savedUsers = safeStorage.safeParse(localStorage.getItem('mock_users'), []);
            if (Array.isArray(savedUsers)) {
                localStorage.setItem('mock_users', JSON.stringify(savedUsers.filter((u: any) => u.id !== currentUser.id)));
            }
            localStorage.removeItem('agrimap-current-user');
            
            toast.success("Profile deleted successfully.");
            handleLogout();
        } catch (error: any) {
            console.error("Delete Account Error:", error);
            toast.error(`Deletion failed: ${error.message || 'Unknown error'}`);
        }
    };

    const handleSendVerification = async () => {
        if(isLocalRuntime){toast.info('Use Local accounts & records in the top bar for server account controls.');return;}
        if (!auth.currentUser) {
            toast.error("No active session found.");
            return;
        }
        try {
            await sendEmailVerification(auth.currentUser);
            toast.success("Verification link sent to your email!");
        } catch (error: any) {
            console.error("Verification error:", error);
            if (error.code === 'auth/too-many-requests') {
                toast.error("Too many requests. Please wait a moment before trying again.");
            } else {
                toast.error(error.message || "Failed to send verification link.");
            }
        }
    };

    const handleRefreshUser = async () => {
        if(isLocalRuntime){setCurrentUser(await localRequest('profile'));return;}
        if (!auth.currentUser) return;
        try {
            await auth.currentUser.reload();
            const user = auth.currentUser;
            if (user.emailVerified) {
                toast.success("Email verified!");
                // Trigger an update to the user doc too if they have a personalNumber
                const userDocRef = doc(db, 'users', user.uid);
                const userSnap = await getDoc(userDocRef);
                const userPNum = userSnap.exists() ? (userSnap.data() as User).personalNumber : '';
                if (userPNum) {
                    await updateDoc(userDocRef, { verificationStatus: 'verified', isVerified: true });
                } else {
                    toast.info("Email verified! Please complete profile verification with your Personal ID Number to unlock all modules.");
                }
            } else {
                toast.info("Verification still pending. Please check your inbox.");
            }
        } catch (error) {
            console.error("User reload failed:", error);
        }
    };

    return {
        currentUser,
        setCurrentUser,
        isAuthReady,
        handleUpdateUser,
        handleLogout,
        handleEmailLogin,
        handleGoogleLogin,
        handleResetPassword,
        handleSwitchOrg,
        handleSwitchRole,
        handleDeleteAccount,
        handleSendVerification,
        handleRefreshUser
    };
};
