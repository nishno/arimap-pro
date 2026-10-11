import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
    Globe, 
    ExternalLink, 
    ArrowRight, 
    Map, 
    Snowflake, 
    Bot, 
    ShieldCheck, 
    X, 
    PackageCheck,
    FlaskConical,
    FileSpreadsheet,
    Compass,
    Sparkles,
    CheckCircle2,
    Scale,
    Layers,
    Cpu,
    Radio
} from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';

interface WelcomeModalProps {
    isOpen: boolean;
    onClose: () => void;
    onRegister: () => void;
    onExplore: () => void;
    onLogin: (email: string, pass: string) => Promise<void>;
}

export const WelcomeModal: React.FC<WelcomeModalProps> = ({ 
    isOpen, 
    onClose: _onClose, 
    onRegister: _onRegister, 
    onExplore,
    onLogin: _onLogin
}) => {
    const { language, setLanguage } = useLanguage();
    const isKa = language === 'ka';

    const handleGoToDashboard = () => {
        onExplore();
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-[7000] flex items-center justify-center p-0 bg-slate-950/85 backdrop-blur-md overflow-hidden animate-fade-in">
                    <motion.div
                        initial={{ opacity: 0, scale: 0.97, y: 10 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.97, y: 10 }}
                        transition={{ duration: 0.25, ease: 'easeOut' }}
                        style={{ width: '84vw', maxWidth: '84vw', height: '94vh', maxHeight: '94vh' }}
                        className="bg-slate-900 text-white rounded-[2rem] sm:rounded-[2.5rem] shadow-[0_25px_80px_rgba(0,0,0,0.8)] overflow-hidden border border-slate-700/80 flex flex-col relative m-auto"
                    >
                        {/* Top Navigation Bar */}
                        <div className="flex items-center justify-between px-5 sm:px-8 py-3.5 border-b border-slate-800 bg-slate-950/90 backdrop-blur-md shrink-0">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-gradient-to-tr from-emerald-600 to-teal-400 text-white rounded-2xl flex items-center justify-center shadow-lg shadow-emerald-500/20 font-black">
                                    <Map className="w-5 h-5" />
                                </div>
                                <div>
                                    <div className="flex items-center gap-2">
                                        <h1 className="font-black text-lg sm:text-xl tracking-tight text-white">
                                            AGRIMAP<span className="text-emerald-400">PRO</span>
                                        </h1>
                                        <span className="hidden sm:inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping"></span>
                                            {isKa ? 'ოფიციალური პორტალი' : 'Official Portal'}
                                        </span>
                                    </div>
                                    <p className="text-[11px] font-bold text-slate-400">
                                        {isKa ? 'სოფლის მეურნეობის ციფრული ტექნოლოგიები' : 'Mapping the Future of Precision Farming'}
                                    </p>
                                </div>
                            </div>

                            {/* Center Highlights (Desktop only) */}
                            <div className="hidden lg:flex items-center gap-5 text-xs font-bold text-slate-300">
                                <span className="flex items-center gap-1.5 text-emerald-400">
                                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                                    {isKa ? 'ავტო-ჩამოწერა საწყობიდან' : 'Auto Stock Depletion'}
                                </span>
                                <span className="flex items-center gap-1.5 text-cyan-400">
                                    <CheckCircle2 className="w-3.5 h-3.5 text-cyan-400" />
                                    {isKa ? 'აგრონომიული მონიტორინგი' : 'Agronomy Purpose Tracking'}
                                </span>
                                <span className="flex items-center gap-1.5 text-indigo-400">
                                    <CheckCircle2 className="w-3.5 h-3.5 text-indigo-400" />
                                    {isKa ? '100% ოფლაინ მზადყოფნა' : '100% Offline Capable'}
                                </span>
                            </div>

                            {/* Language Switcher & Close Button */}
                            <div className="flex items-center gap-2 sm:gap-3">
                                <div className="flex items-center bg-slate-800/90 border border-slate-700 rounded-xl p-0.5 shadow-inner">
                                    <button
                                        type="button"
                                        onClick={() => setLanguage('en')}
                                        className={`px-2.5 py-1 text-xs font-black rounded-lg transition-all cursor-pointer ${
                                            language === 'en'
                                                ? 'bg-emerald-600 text-white shadow-md'
                                                : 'text-slate-400 hover:text-white'
                                        }`}
                                    >
                                        EN
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setLanguage('ka')}
                                        className={`px-2.5 py-1 text-xs font-black rounded-lg transition-all cursor-pointer ${
                                            language === 'ka'
                                                ? 'bg-emerald-600 text-white shadow-md'
                                                : 'text-slate-400 hover:text-white'
                                        }`}
                                    >
                                        KA
                                    </button>
                                </div>

                                <button
                                    type="button"
                                    onClick={handleGoToDashboard}
                                    className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl transition-colors cursor-pointer border border-slate-700 flex items-center gap-1.5"
                                    title={isKa ? 'დახურვა და დაშბორდზე გადასვლა' : 'Close & Go to Dashboard'}
                                >
                                    <span className="hidden sm:inline text-xs font-bold text-slate-300">{isKa ? 'დახურვა' : 'Close'}</span>
                                    <X className="w-4 h-4 text-slate-300" />
                                </button>
                            </div>
                        </div>

                        {/* Scrollable Content Body with Agronomic Webpage Styling */}
                        <div className="flex-1 overflow-y-auto px-4 sm:px-8 py-5 sm:py-7 space-y-6 custom-scrollbar">
                            
                            {/* Rich Hero Banner with Agricultural Tablet Background Image */}
                            <div className="relative rounded-3xl overflow-hidden border border-emerald-500/30 shadow-2xl min-h-[300px] sm:min-h-[340px] flex flex-col justify-end p-5 sm:p-8">
                                {/* Background Image with Deep Gradient Shading */}
                                <div 
                                    className="absolute inset-0 bg-cover bg-center transition-transform duration-1000 scale-105 hover:scale-100"
                                    style={{
                                        backgroundImage: `url('https://images.unsplash.com/photo-1592982537447-7440770cbfc9?auto=format&fit=crop&w=2200&q=85')`
                                    }}
                                />
                                
                                {/* Multi-layer atmospheric overlays for crystal readability */}
                                <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/85 to-slate-900/60" />
                                <div className="absolute inset-0 bg-emerald-950/25 mix-blend-multiply" />
                                <div className="absolute top-0 right-0 w-80 h-80 bg-emerald-500/20 rounded-full blur-3xl pointer-events-none" />

                                <div className="relative z-10 max-w-4xl space-y-3">
                                    <div className="inline-flex items-center gap-2 px-3.5 py-1 bg-emerald-500/30 text-emerald-300 border border-emerald-400/40 rounded-full text-xs font-black uppercase tracking-wider backdrop-blur-md">
                                        <Sparkles className="w-3.5 h-3.5 text-emerald-300 animate-pulse" />
                                        <span>{isKa ? 'ჩვენს შესახებ • AGRIMAP PRO' : 'About Us • AgriMap Pro'}</span>
                                    </div>

                                    <h2 className="text-xl sm:text-3xl lg:text-4xl font-black tracking-tight text-white leading-[1.15]">
                                        {isKa 
                                            ? 'სრული აგრონომიული კონტროლი, მარაგების ავტო-ჩამოწერა და ანალიტიკა' 
                                            : 'Mapping the Future of Farming — Stock, Agronomy & Smart Logistics'}
                                    </h2>

                                    <p className="text-slate-200 text-xs sm:text-sm font-medium leading-relaxed max-w-3xl">
                                        {isKa
                                            ? 'AgriMap Pro ავტომატურად აკავშირებს მცენარეთა მკურნალობას, სასუქებსა და პესტიციდებს საწყობის ნაშთებთან. ნებისმიერი აგრო-ღონისძიების შესრულებისას მარაგი მყისიერად ჩამოიწერება, ხარჯები ნაწილდება ნაკვეთებზე და გენერირდება სრული სტატისტიკური ანგარიშგება.'
                                            : 'AgriMap Pro seamlessly interconnects field operations, fertilizer treatments, and spray records directly with real-time warehouse inventory. Logging any agronomy event instantly deducts stock balances, calculates per-hectare cost allocations, and consolidates high-precision reporting.'}
                                    </p>

                                    {/* Weight Station & Harvest Intake Callout Highlight */}
                                    <div className="p-3 bg-emerald-950/70 border border-emerald-500/40 rounded-2xl backdrop-blur-md flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 flex items-center justify-center shrink-0">
                                            <Scale className="w-4 h-4 text-emerald-300" />
                                        </div>
                                        <p className="text-xs font-bold text-emerald-200 leading-snug">
                                            {isKa 
                                                ? 'კრეფის მოცულობის ჩაბარება და ელექტრონული სასწორებით (ამწონი სადგური) ავტომატური აწონვა, ტარის დედუქცია & პარტიის QR იარლიყები.'
                                                : 'Harvest intake recording with electronic weight stations, auto gross/tare calculation, Bluetooth scale capture & batch QR labeling.'}
                                        </p>
                                    </div>

                                    {/* Real-time Metric Highlights */}
                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
                                        <div className="p-3 bg-slate-900/85 border border-emerald-500/40 rounded-2xl backdrop-blur-md shadow-lg">
                                            <p className="text-lg sm:text-2xl font-black text-emerald-400">100%</p>
                                            <p className="text-[10px] font-black text-slate-300 uppercase tracking-wider mt-0.5">{isKa ? 'ავტო-ჩამოწერა' : 'Auto Stock Depletion'}</p>
                                        </div>
                                        <div className="p-3 bg-slate-900/85 border border-cyan-500/40 rounded-2xl backdrop-blur-md shadow-lg">
                                            <p className="text-lg sm:text-2xl font-black text-cyan-400">GIS</p>
                                            <p className="text-[10px] font-black text-slate-300 uppercase tracking-wider mt-0.5">{isKa ? 'ნაკვეთის მონიტორინგი' : 'Plot Diagnostics'}</p>
                                        </div>
                                        <div className="p-3 bg-slate-900/85 border border-indigo-500/40 rounded-2xl backdrop-blur-md shadow-lg">
                                            <p className="text-lg sm:text-2xl font-black text-indigo-400">AI</p>
                                            <p className="text-[10px] font-black text-slate-300 uppercase tracking-wider mt-0.5">{isKa ? 'აგრონომის ანალიტიკა' : 'AI Agro Analyst'}</p>
                                        </div>
                                        <div className="p-3 bg-slate-900/85 border border-amber-500/40 rounded-2xl backdrop-blur-md shadow-lg">
                                            <p className="text-lg sm:text-2xl font-black text-amber-400">OPEX</p>
                                            <p className="text-[10px] font-black text-slate-300 uppercase tracking-wider mt-0.5">{isKa ? 'ერთიანი რეპორტები' : 'Unified Reports'}</p>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Core Functional Modules (Glassmorphic cards) */}
                            <div className="space-y-3.5">
                                <div className="flex items-center justify-between">
                                    <h3 className="text-xs font-black uppercase tracking-wider text-slate-400 flex items-center gap-2">
                                        <Compass className="w-4 h-4 text-emerald-400" />
                                        {isKa ? 'პლატფორმის ძირითადი მოდულები და ინოვაციები' : 'Platform Core Modules & Operations'}
                                    </h3>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                    
                                    {/* 1. Stock Management & Auto Depletion */}
                                    <div className="p-5 rounded-3xl bg-slate-800/80 border border-emerald-500/40 hover:border-emerald-400 hover:bg-slate-800 transition-all space-y-2.5 shadow-lg">
                                        <div className="w-10 h-10 bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 rounded-2xl flex items-center justify-center font-black">
                                            <PackageCheck className="w-5 h-5" />
                                        </div>
                                        <h4 className="font-black text-sm text-white">
                                            {isKa ? 'საწყობის მართვა & ავტო-ჩამოწერა' : 'Stock Management & Auto Charge'}
                                        </h4>
                                        <p className="text-[11px] font-medium text-slate-300 leading-relaxed">
                                            {isKa
                                                ? 'სასუქები, პრეპარატები და შეფუთვები ავტომატურად კონტროლდება და ჩამოიწერება საწყობიდან ყოველი დამუშავებისას ან მოსავლის აღებისას.'
                                                : 'All fertilizers, chemicals, spray items, and packaging materials are tracked and automatically deducted from warehouse stock upon activity logging.'}
                                        </p>
                                    </div>

                                    {/* 2. Agronomy Purpose Monitoring */}
                                    <div className="p-5 rounded-3xl bg-slate-800/80 border border-purple-500/40 hover:border-purple-400 hover:bg-slate-800 transition-all space-y-2.5 shadow-lg">
                                        <div className="w-10 h-10 bg-purple-500/20 text-purple-400 border border-purple-500/40 rounded-2xl flex items-center justify-center font-black">
                                            <FlaskConical className="w-5 h-5" />
                                        </div>
                                        <h4 className="font-black text-sm text-white">
                                            {isKa ? 'აგრონომიული მონიტორინგი' : 'Agronomy Purpose Monitoring'}
                                        </h4>
                                        <p className="text-[11px] font-medium text-slate-300 leading-relaxed">
                                            {isKa
                                                ? 'ყველა აგრონომიული მიზნის (მორწყვა, განაყოფიერება, წამლობა, გასხვლა) სრული ისტორია ნაკვეთებისა და რიგების მიხედვით.'
                                                : 'Track exact purpose, dosages, application timing, active ingredients, and recurrence schedule across specific field blocks and rows.'}
                                        </p>
                                    </div>

                                    {/* 3. Cross-Module Reports & Statistics */}
                                    <div className="p-5 rounded-3xl bg-slate-800/80 border border-blue-500/40 hover:border-blue-400 hover:bg-slate-800 transition-all space-y-2.5 shadow-lg">
                                        <div className="w-10 h-10 bg-blue-500/20 text-blue-400 border border-blue-500/40 rounded-2xl flex items-center justify-center font-black">
                                            <FileSpreadsheet className="w-5 h-5" />
                                        </div>
                                        <h4 className="font-black text-sm text-white">
                                            {isKa ? 'ერთიანი რეპორტები & სტატისტიკა' : 'Cross-Module Reports & Analytics'}
                                        </h4>
                                        <p className="text-[11px] font-medium text-slate-300 leading-relaxed">
                                            {isKa
                                                ? 'ავტომატური სტატისტიკა ყველა მოდულიდან: ხარჯები (OPEX), მოგება, თვითღირებულება, მუშახელი და მოსავლის ბალანსი.'
                                                : 'Consolidated reporting compiling real-time OPEX, net yield profitability, labor payroll, cold storage lots, and crop cost per KG.'}
                                        </p>
                                    </div>

                                    {/* 4. GIS Precision Mapping */}
                                    <div className="p-5 rounded-3xl bg-slate-800/80 border border-teal-500/40 hover:border-teal-400 hover:bg-slate-800 transition-all space-y-2.5 shadow-lg">
                                        <div className="w-10 h-10 bg-teal-500/20 text-teal-400 border border-teal-500/40 rounded-2xl flex items-center justify-center font-black">
                                            <Map className="w-5 h-5" />
                                        </div>
                                        <h4 className="font-black text-sm text-white">
                                            {isKa ? 'GIS დაგეგმვა & რუკები' : 'Precision GIS Mapping'}
                                        </h4>
                                        <p className="text-[11px] font-medium text-slate-300 leading-relaxed">
                                            {isKa
                                                ? 'ნაკვეთების საზღვრების ზუსტი აზომვა, ჯიშების ზონირება, GPS ტრეკინგი და ფენების მართვა.'
                                                : 'Sub-meter boundary tracing, crop variety zoning, real-time GPS land surveys, and topography layers.'}
                                        </p>
                                    </div>

                                    {/* 5. Weight Station & Cold Storage */}
                                    <div className="p-5 rounded-3xl bg-slate-800/80 border border-cyan-500/40 hover:border-cyan-400 hover:bg-slate-800 transition-all space-y-2.5 shadow-lg">
                                        <div className="w-10 h-10 bg-cyan-500/20 text-cyan-400 border border-cyan-500/40 rounded-2xl flex items-center justify-center font-black">
                                            <Scale className="w-5 h-5" />
                                        </div>
                                        <h4 className="font-black text-sm text-white">
                                            {isKa ? 'ამწონი სადგური & საცივრე' : 'Weight Station & Cold Storage'}
                                        </h4>
                                        <p className="text-[11px] font-medium text-slate-300 leading-relaxed">
                                            {isKa
                                                ? 'ელექტრონული სასწორებით ავტომატური აწონვა, ტარის გამოკლება, QR იარლიყები და სამაცივრე პარტიების კონტროლი.'
                                                : 'Weight Station integration with digital scales, auto-tare subtraction, QR batch tags, and cold storage routing.'}
                                        </p>
                                    </div>

                                    {/* 6. AI Agronomist & B2B Market */}
                                    <div className="p-5 rounded-3xl bg-slate-800/80 border border-amber-500/40 hover:border-amber-400 hover:bg-slate-800 transition-all space-y-2.5 shadow-lg">
                                        <div className="w-10 h-10 bg-amber-500/20 text-amber-400 border border-amber-500/40 rounded-2xl flex items-center justify-center font-black">
                                            <Bot className="w-5 h-5" />
                                        </div>
                                        <h4 className="font-black text-sm text-white">
                                            {isKa ? 'AI აგრონომი & ბაზარი' : 'AI Agro Analyst & Market'}
                                        </h4>
                                        <p className="text-[11px] font-medium text-slate-300 leading-relaxed">
                                            {isKa
                                                ? 'დაავადებების მყისიერი დიაგნოსტიკა ფოტოებით, მკურნალობის რეცეპტები და პირდაპირი B2B აგრო ვაჭრობა.'
                                                : '24/7 plant health image diagnostics, prescription generation, and direct producer-to-buyer commodity trading.'}
                                        </p>
                                    </div>

                                </div>
                            </div>

                        </div>

                        {/* Bottom Glowing High-Impact Action Footer */}
                        <div className="px-5 sm:px-8 py-3.5 sm:py-4 bg-slate-950 border-t border-slate-800 flex flex-col lg:flex-row items-center justify-between gap-4 shrink-0">
                            
                            <div className="flex items-center gap-3 text-xs font-bold text-slate-400 text-center lg:text-left">
                                <div className="p-2 bg-emerald-500/10 text-emerald-400 rounded-xl border border-emerald-500/20 shrink-0">
                                    <ShieldCheck className="w-4 h-4" />
                                </div>
                                <div>
                                    <p className="text-slate-200 font-bold text-xs">
                                        {isKa ? 'ღია წვდომა დაშბორდზე' : 'Instant Open Access to Dashboard'}
                                    </p>
                                    <p className="text-[11px] text-slate-400">
                                        {isKa ? 'გამოიკვლიეთ ყველა ფუნქცია თავისუფლად' : 'Explore all tools, GIS maps & AI analyst without restrictions'}
                                    </p>
                                </div>
                            </div>

                            {/* Noticeable & Blinking Action Buttons */}
                            <div className="flex flex-col sm:flex-row items-center gap-3.5 w-full lg:w-auto justify-end">
                                
                                {/* 1. Official Website Link (Noticeable with Glowing Border) */}
                                <a
                                    href="https://agrimappro.com"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="group relative px-5 py-3 rounded-2xl bg-slate-900 hover:bg-slate-850 text-white border-2 border-indigo-500/80 hover:border-indigo-400 font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2.5 shadow-[0_0_20px_rgba(99,102,241,0.25)] hover:shadow-[0_0_30px_rgba(99,102,241,0.45)] transition-all cursor-pointer w-full sm:w-auto"
                                >
                                    <span className="relative flex h-2.5 w-2.5">
                                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                                        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-indigo-500"></span>
                                    </span>
                                    <ExternalLink className="w-3.5 h-3.5 text-indigo-400 group-hover:scale-110 transition-transform" />
                                    <span>{isKa ? 'ოფიციალური საიტი: AGRIMAPPRO.COM' : 'VISIT WEBSITE (AGRIMAPPRO.COM)'}</span>
                                </a>

                                {/* 2. Application Dashboard Button (Pulsing Glow & Highly Noticeable) */}
                                <button
                                    type="button"
                                    onClick={handleGoToDashboard}
                                    className="group relative px-7 py-3 rounded-2xl bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2.5 shadow-[0_0_25px_rgba(16,185,129,0.35)] hover:shadow-[0_0_40px_rgba(16,185,129,0.6)] transition-all cursor-pointer w-full sm:w-auto border border-emerald-400/50"
                                >
                                    <span className="relative flex h-2.5 w-2.5">
                                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-90"></span>
                                        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-300"></span>
                                    </span>
                                    <span>{isKa ? 'აპლიკაციის დაშბორდზე გადასვლა' : 'LAUNCH APP DASHBOARD'}</span>
                                    <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                                </button>

                            </div>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
};

export default WelcomeModal;
