
import React, { useState } from 'react';
import type { User } from '../types';
import { XIcon, AlertTriangleIcon, LockClosedIcon, ShieldCheckIcon } from './Icons';

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLogin: (user: User) => void;
  onGoogleLogin: () => void;
  onEmailLogin: (email: string, pass: string) => Promise<void>;
  onResetPassword: (email: string) => Promise<void>;
}

const LoginModal: React.FC<LoginModalProps> = ({ isOpen, onClose, onLogin, onGoogleLogin, onEmailLogin, onResetPassword }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const isRootMode = false;
  const [error, setError] = useState<string | null>(null);

  const [isLoading, setIsLoading] = useState(false);
  const [resetSent, setResetSent] = useState(false);

  if (!isOpen) return null;

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!email || !password) {
      setError("Please fill in all fields.");
      return;
    }

    setIsLoading(true);
    try {
      await onEmailLogin(email, password);
      onClose();
    } catch (err: any) {
      console.error("Login failed", err);
      let userMessage = err.message || "An unexpected error occurred. Please try again.";
      
      const errorCode = err.code || (err.message?.includes('auth/invalid-credential') ? 'auth/invalid-credential' : null);

      if (errorCode === 'auth/network-request-failed' || errorCode === 'auth/unavailable') {
          const savedConfig = localStorage.getItem('agrimap-local-config');
          let isLocal = false;
          try {
              if (savedConfig) isLocal = JSON.parse(savedConfig).isLocalMode;
          } catch (e) {}

          if (isLocal) {
              userMessage = "Local Node Connection Failed. Your Local Server might be offline or misconfigured.";
              setError(userMessage);
              return;
          }
          userMessage = "Network request failed. Please check your internet connection.";
      } else if (errorCode === 'auth/operation-not-allowed') {
          userMessage = "Email/Password login is disabled. Please enable it in the Firebase Console.";
      } else if (errorCode === 'auth/invalid-credential' || errorCode === 'auth/user-not-found' || errorCode === 'auth/wrong-password') {
          userMessage = "Login failed: The email or password may be incorrect. If you originally signed up with Google, please use the 'Continue with Google' button below.";
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

  const handleSwitchToRegister = () => {
    onClose();
    // Use a custom event to open the registration modal from App.tsx
    window.dispatchEvent(new CustomEvent('open-registration-modal'));
  };

  const handleForgotPass = async () => {
    if (!email) {
      setError("Please enter your email address first.");
      return;
    }
    setIsLoading(true);
    try {
      await onResetPassword(email);
      setResetSent(true);
      setError(null);
    } catch (err: any) {
      setError(err.message || "Failed to send reset email.");
    } finally {
      setIsLoading(false);
    }
  };

  const savedConfig = localStorage.getItem('agrimap-local-config');
  let isLocalModeActive = false;
  try {
      if (savedConfig) isLocalModeActive = JSON.parse(savedConfig).isLocalMode;
  } catch (e) {}

  return (
    <div className="fixed inset-0 bg-black/60 z-[3001] flex items-center justify-center p-4 backdrop-blur-sm" onClick={onClose}>
      <form onSubmit={handleLogin} className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-md md:max-w-lg max-h-[95vh] overflow-y-auto animate-slide-up" onClick={(e) => e.stopPropagation()}>
        <div className="p-6 md:p-8 border-b flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-gray-50/50">
          <div>
            <h2 className="text-xl md:text-2xl font-black text-gray-800 tracking-tight uppercase">{isRootMode ? 'Account access' : 'Account Access'}</h2>
            <p className="text-[10px] md:text-xs font-bold text-gray-400 uppercase tracking-widest">{isRootMode ? 'System-level administrative entry' : 'Log in to your workspace'}</p>
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-end mt-1 sm:mt-0">
            {!isRootMode && (
              <button 
                type="button" 
                onClick={onClose} 
                className="px-4 py-2 bg-indigo-100 hover:bg-indigo-200 border border-indigo-200 text-indigo-800 font-black text-xs uppercase tracking-wider rounded-xl transition-all shadow-md active:scale-95 flex items-center gap-1.5"
              >
                <span>Guest Access / Skip</span>
                <span className="text-xs">➜</span>
              </button>
            )}
            <button type="button" onClick={onClose} className="text-slate-500 hover:text-slate-700 p-2.5 hover:bg-slate-200/60 rounded-full transition-all group shrink-0" aria-label="Close">
              <XIcon className="h-6 w-6 group-hover:rotate-90 transition-transform duration-300" />
            </button>
          </div>
        </div>
        <div className="p-6 md:p-8 space-y-4 md:space-y-6">
            {isLocalModeActive && (
                <div className="p-2 px-3 bg-indigo-50 border border-indigo-100 rounded-xl flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <div className="w-1.5 h-1.5 bg-indigo-600 rounded-full animate-pulse" />
                        <span className="text-[8px] font-black uppercase tracking-widest text-indigo-600">Active: Local Node Mode</span>
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
              <div className="flex flex-col gap-2">
                <div className="p-3 md:p-4 bg-red-50 border border-red-100 text-red-700 text-xs font-bold flex flex-col gap-2 rounded-2xl animate-shake">
                  <div className="flex items-start gap-3">
                    <AlertTriangleIcon className="h-5 w-5 flex-shrink-0 mt-0.5" />
                    <div className="flex flex-col gap-1">
                        <span>{error}</span>
                        {isLocalModeActive && error.toLowerCase().includes('network') && (
                            <button 
                              type="button"
                              onClick={handleSwitchToCloudManual}
                              className="text-[10px] font-black text-red-600 uppercase hover:underline text-left mt-1 cursor-pointer"
                            >
                                Revert to Cloud immediately
                            </button>
                        )}
                    </div>
                  </div>

                  {/* Recovery Action Buttons */}
                  <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-red-200/60 mt-1">
                    <button
                      type="button"
                      onClick={handleSwitchToRegister}
                      className="px-3 py-1.5 bg-red-100 hover:bg-red-200 text-red-800 text-[10px] font-black uppercase tracking-wider rounded-lg transition-colors cursor-pointer"
                    >
                      Register New Account
                    </button>
                    <button
                      type="button"
                      onClick={handleForgotPass}
                      className="px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-800 border border-slate-200 text-[10px] font-black uppercase tracking-wider rounded-lg transition-colors cursor-pointer"
                    >
                      Reset Password
                    </button>
                  </div>
                </div>

                <div className="px-4 py-2.5 bg-indigo-50 border border-indigo-100 text-indigo-700 text-[10px] font-black uppercase tracking-widest rounded-xl flex items-center justify-between gap-2">
                  <span>Having trouble signing in inside preview iframe?</span>
                  <button
                    type="button"
                    onClick={() => window.open(window.location.href, '_blank')}
                    className="px-3 py-1 bg-indigo-600 hover:bg-indigo-700 text-white font-black text-[9px] uppercase tracking-wider rounded-lg shadow-xs shrink-0 cursor-pointer"
                  >
                    Open in New Tab
                  </button>
                </div>
              </div>
            )}
          
          {resetSent && (
            <div className="p-3 md:p-4 bg-green-50 border border-green-100 text-green-700 text-xs font-bold flex items-center gap-3 rounded-2xl">
              <ShieldCheckIcon className="h-5 w-5 flex-shrink-0" />
              <span>Password reset link has been sent to your email.</span>
            </div>
          )}
          
          <div className="space-y-3 md:space-y-4">
            <div>
              <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 ml-1">
                {isRootMode ? 'Root Username (nishno)' : 'Email Address'}
              </label>
              <div className="relative">
                <input
                  type={isRootMode ? "text" : "email"}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={`w-full p-3 md:p-4 border rounded-2xl font-bold transition-all outline-none focus:ring-4 ${isRootMode ? 'bg-indigo-50 border-indigo-200 focus:ring-indigo-100' : 'bg-gray-50 border-gray-100 focus:ring-green-100 focus:border-green-400'}`}
                  placeholder={isRootMode ? "nishno" : "you@example.com"}
                  autoFocus={window.innerWidth > 768} // Only autofocus on desktop to prevent forced keyboard on mobile
                  required
                />
                {isRootMode && <ShieldCheckIcon className="absolute right-4 top-1/2 -translate-y-1/2 h-5 w-5 text-indigo-400" />}
              </div>
            </div>
            
            <div>
              <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 ml-1">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={`w-full p-3 md:p-4 border rounded-2xl font-bold transition-all outline-none focus:ring-4 ${isRootMode ? 'bg-indigo-50 border-indigo-200 focus:ring-indigo-100' : 'bg-gray-50 border-gray-100 focus:ring-green-100 focus:border-green-400'}`}
                required
              />
              {!isRootMode && (
                <button 
                  type="button" 
                  onClick={handleForgotPass}
                  className="mt-2 text-[10px] font-black text-indigo-600 uppercase tracking-widest hover:text-indigo-700 ml-1"
                >
                  Forgot Password?
                </button>
              )}
            </div>

            <div className="pt-1">
                <label className="flex items-center gap-3 cursor-pointer group select-none">
                    <div 
                        onClick={() => {  setEmail(''); setPassword(''); }}
                        className={`w-12 h-6 rounded-full p-1 transition-all duration-300 ${isRootMode ? 'bg-indigo-600' : 'bg-gray-200'}`}
                    >
                        <div className={`bg-white w-4 h-4 rounded-full shadow-md transition-all duration-300 ${isRootMode ? 'translate-x-6' : 'translate-x-0'}`} />
                    </div>
                    <span className={`text-[10px] font-black uppercase tracking-widest ${isRootMode ? 'text-indigo-600' : 'text-gray-400'}`}>Account access</span>
                </label>
            </div>
          </div>
        </div>
        <div className="p-6 md:p-8 bg-gray-50 flex flex-col gap-3 border-t border-gray-100">
          <button
            type="button"
            onClick={onGoogleLogin}
            className="w-full py-3 md:py-4 bg-white border border-gray-200 rounded-2xl text-gray-700 font-black text-xs uppercase tracking-widest shadow-sm hover:bg-gray-50 transition-all active:scale-95 flex items-center justify-center gap-3"
          >
            <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" className="w-5 h-5" />
            Continue with Google
          </button>
          <div className="flex items-center gap-4 my-1">
            <div className="flex-1 h-px bg-gray-200"></div>
            <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">OR</span>
            <div className="flex-1 h-px bg-gray-200"></div>
          </div>
          <button
            type="submit"
            disabled={isLoading}
            className={`w-full py-3 md:py-4 rounded-2xl text-white font-black text-xs uppercase tracking-widest shadow-xl transition-all active:scale-95 ${isLoading ? 'opacity-50 cursor-not-allowed' : ''} ${isRootMode ? 'bg-indigo-600 shadow-indigo-100 hover:bg-indigo-700' : 'bg-green-600 shadow-green-100 hover:bg-green-700'}`}
          >
            {isLoading ? 'Processing...' : (isRootMode ? 'Initiate System Entry' : 'Verify & Login')}
          </button>
          {!isRootMode && (
            <div className="flex flex-col gap-2 mt-2">
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest text-center">
                Don't have an account? <button type="button" onClick={handleSwitchToRegister} className="text-indigo-600 hover:underline">Register Now</button>
              </p>
              <button
                type="button"
                onClick={() => window.location.assign('/demo')}
                className="text-[10px] font-black text-slate-400 uppercase tracking-widest hover:text-slate-600 transition-colors pt-2"
              >
                Or Continue as <span className="text-indigo-500">Guest Explorer</span>
              </button>
            </div>
          )}
        </div>
      </form>
      <style>{`
        @keyframes shake { 0%, 100% { transform: translateX(0); } 25% { transform: translateX(-5px); } 75% { transform: translateX(5px); } }
        .animate-shake { animation: shake 0.3s ease-in-out; }
      `}</style>
    </div>
  );
};

export default LoginModal;
