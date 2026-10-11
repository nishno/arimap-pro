
import React, { createContext, useContext, useState } from 'react';
import { translations, Language } from '../translations';
import { safeStorage } from '../services/storageService';

export type Currency = 'USD' | 'GEL';

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  currency: Currency;
  setCurrency: (c: Currency) => void;
  formatCurrency: (amount: number) => string;
  t: (key: string, params?: Record<string, string | number>) => string;
}

const GLOBAL_CONTEXT_KEY = '__AGRIMAP_LANGUAGE_CONTEXT__';
let LanguageContext: React.Context<LanguageContextType | undefined>;
if (typeof window !== 'undefined') {
  if (!(window as any)[GLOBAL_CONTEXT_KEY]) {
    (window as any)[GLOBAL_CONTEXT_KEY] = createContext<LanguageContextType | undefined>(undefined);
  }
  LanguageContext = (window as any)[GLOBAL_CONTEXT_KEY];
} else {
  LanguageContext = createContext<LanguageContextType | undefined>(undefined);
}

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<Language>(() => {
    try {
      const saved = safeStorage.getItem('agri-app-lang');
      return (saved === 'ka' || saved === 'en') ? saved : 'en';
    } catch (e) {
      return 'en';
    }
  });

  const [currency, setCurrencyState] = useState<Currency>(() => {
    try {
      const saved = safeStorage.getItem('agri-app-currency');
      return (saved === 'USD' || saved === 'GEL') ? saved : 'USD';
    } catch (e) {
      return 'USD';
    }
  });

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    safeStorage.setItem('agri-app-lang', lang);
  };

  const setCurrency = (c: Currency) => {
    setCurrencyState(c);
    safeStorage.setItem('agri-app-currency', c);
  };

  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat(language === 'ka' ? 'ka-GE' : 'en-US', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 2
    }).format(amount);
  };

  const t = (key: string, params?: Record<string, string | number>): string => {
    if (!key || typeof key !== 'string') return '';
    const keys = key.split('.');
    let current: any = translations[language];
    let fallbackCurrent: any = translations['en'];

    // 1) Try flat lookup
    let result = current ? current[key] : undefined;

    // 2) Try nested lookup if flat lookup didn't return a string
    if (typeof result !== 'string' && keys.length > 1) {
      let node = current;
      for (const k of keys) {
        if (node && typeof node === 'object' && node[k] !== undefined) {
          node = node[k];
        } else {
          node = undefined;
          break;
        }
      }
      if (typeof node === 'string') {
        result = node;
      }
    }

    if (typeof result !== 'string') {
      // Fallback to English
      let fallbackResult = fallbackCurrent ? fallbackCurrent[key] : undefined;
      if (typeof fallbackResult !== 'string' && keys.length > 1) {
        let node = fallbackCurrent;
        for (const k of keys) {
          if (node && typeof node === 'object' && node[k] !== undefined) {
            node = node[k];
          } else {
            node = undefined;
            break;
          }
        }
        if (typeof node === 'string') {
          fallbackResult = node;
        }
      }
      result = typeof fallbackResult === 'string' ? fallbackResult : key;
    }

    if (typeof result !== 'string') {
      if (result && typeof result === 'object') {
        if (typeof (result as any).name === 'string') return (result as any).name;
        if (typeof (result as any).title === 'string') return (result as any).title;
        return String(key);
      }
      return String(result ?? key);
    }

    if (params && typeof result === 'string') {
      Object.entries(params).forEach(([paramKey, paramValue]) => {
        result = (result as string).replace(new RegExp(`\\{${paramKey}\\}`, 'g'), String(paramValue));
      });
    }

    return result;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, currency, setCurrency, formatCurrency, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};
