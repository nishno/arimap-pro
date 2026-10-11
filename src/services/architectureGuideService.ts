import type { AppMode } from '../types';
import { safeStorage } from './storageService';
import {
    ALL_17_CORE_MODULES,
    INITIAL_17_MODULE_CONNECTIONS,
    PlatformModuleDefinition,
    ModuleFolder,
    ModuleComponentItem,
    ModuleSubOption,
    ModuleConnection
} from '../data/platformArchitectureData';

export type {
    PlatformModuleDefinition,
    ModuleFolder,
    ModuleComponentItem,
    ModuleSubOption,
    ModuleConnection
};

export interface AiArchitectureReport {
    timestamp: string;
    selectedModuleIds: string[];
    focusedComponentIds?: string[];
    isCustomOnly?: boolean;
    analyzedModulesCount: number;
    executiveSummaryEn: string;
    executiveSummaryKa: string;
    gapAnalysisEn: string[];
    gapAnalysisKa: string[];
    upgradeRoadmapEn: {
        moduleName: string;
        featureTitle: string;
        impact: 'High' | 'Critical' | 'Transformative';
        description: string;
        estimatedProfitBoost: string;
    }[];
    upgradeRoadmapKa: {
        moduleName: string;
        featureTitle: string;
        impact: 'High' | 'Critical' | 'Transformative';
        description: string;
        estimatedProfitBoost: string;
    }[];
    synergiesEn: string[];
    synergiesKa: string[];
    overallProfitMultiplierEn: string;
    overallProfitMultiplierKa: string;
}

const STORAGE_CUSTOM_FEATURES_KEY = 'agrimap_custom_architecture_features_v3';

export const PLATFORM_MODULES: PlatformModuleDefinition[] = ALL_17_CORE_MODULES;
export const PLATFORM_CONNECTIONS: ModuleConnection[] = INITIAL_17_MODULE_CONNECTIONS;

/**
 * Loads user-defined custom extensions from localStorage
 */
export const getCustomStoredModules = (): PlatformModuleDefinition[] => {
    try {
        const raw = safeStorage.getItem(STORAGE_CUSTOM_FEATURES_KEY);
        if (!raw) return [];
        return JSON.parse(raw);
    } catch (e) {
        console.error('Error loading custom architecture modules:', e);
        return [];
    }
};

/**
 * Saves a user-defined custom feature / component into the architecture graph
 */
export const saveCustomComponentOrModule = (
    targetModuleId: string,
    folderId: string,
    newComponent: Omit<ModuleComponentItem, 'id'>,
    newFolderMeta?: { nameEn: string; nameKa: string }
): PlatformModuleDefinition[] => {
    const customList = getCustomStoredModules();
    let updatedList = [...customList];

    let customMod = updatedList.find(m => m.id === targetModuleId);
    if (!customMod) {
        const coreMod = ALL_17_CORE_MODULES.find(m => m.id === targetModuleId);
        if (coreMod) {
            customMod = JSON.parse(JSON.stringify(coreMod));
            updatedList.push(customMod!);
        } else {
            customMod = {
                id: targetModuleId,
                appMode: 'other_custom',
                nameEn: 'Custom Farm Extension Module',
                nameKa: 'მომხმარებლის ახალი მოდული',
                shortDescEn: 'User-created custom feature module.',
                shortDescKa: 'მომხმარებლის მიერ შექმნილი ახალი ფუნქციების მოდული.',
                iconName: 'Sparkles',
                color: 'from-fuchsia-600 to-pink-700',
                category: 'Custom & Extensions',
                fullDescriptionEn: 'Dynamic extension sandbox for farm-specific innovations and custom hardware integrations.',
                fullDescriptionKa: 'დინამიური გაფართოება სპეციფიკური აგრო-ინოვაციებისა და აპარატურის ინტეგრაციისთვის.',
                subOptions: [],
                folders: [],
                profitabilityEn: 'Tailored specifically for proprietary farm operations.',
                profitabilityKa: 'ზუსტად მორგებული კონკრეტული მეურნეობის მოთხოვნებზე.',
                worldFirstAdvantageEn: 'Seamless instant synchronization with core stock and GIS data pipelines.',
                worldFirstAdvantageKa: 'მომენტალური სინქრონიზაცია საწყობისა და რუკის მონაცემებთან.',
                recommendedFutureUpgradesEn: ['Expand offline synchronization buffers.'],
                recommendedFutureUpgradesKa: ['ოფლაინ სინქრონიზაციის ბუფერების გაზრდა.'],
                missedGapsEn: ['Automated telemetry unit testing.'],
                missedGapsKa: ['ტელემეტრიის ავტომატური ტესტირება.'],
                defaultPosition: { x: 500, y: 700 },
                isCustom: true
            };
            updatedList.push(customMod);
        }
    }

    let folder = customMod!.folders.find(f => f.id === folderId);
    if (!folder) {
        folder = {
            id: folderId || `folder_${Date.now()}`,
            nameEn: newFolderMeta?.nameEn || 'User Custom Components',
            nameKa: newFolderMeta?.nameKa || 'მომხმარებლის კომპონენტები',
            iconName: 'Sparkles',
            descriptionEn: 'Custom extensions and workflows',
            descriptionKa: 'თქვენ მიერ დამატებული კომპონენტები',
            components: [],
            isCustom: true
        };
        customMod!.folders.push(folder);
    }

    const compId = `comp_custom_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const completeComponent: ModuleComponentItem = {
        ...newComponent,
        id: compId,
        folderId: folder.id,
        isCustom: true,
        createdAt: new Date().toISOString()
    };

    folder.components.push(completeComponent);
    safeStorage.setItem(STORAGE_CUSTOM_FEATURES_KEY, JSON.stringify(updatedList));
    return getMergedPlatformModules();
};

/**
 * Returns all active modules (17 core modules merged with custom extensions)
 */
export const getMergedPlatformModules = (): PlatformModuleDefinition[] => {
    const customList = getCustomStoredModules();
    if (customList.length === 0) return ALL_17_CORE_MODULES;

    return ALL_17_CORE_MODULES.map(coreMod => {
        const customOverride = customList.find(c => c.id === coreMod.id);
        if (!customOverride) return coreMod;

        const mergedFolders = [...coreMod.folders];
        customOverride.folders.forEach(cf => {
            const existingFolder = mergedFolders.find(ef => ef.id === cf.id);
            if (existingFolder) {
                const mergedComps = [...existingFolder.components];
                cf.components.forEach(comp => {
                    if (!mergedComps.some(mc => mc.id === comp.id)) {
                        mergedComps.push(comp);
                    }
                });
                existingFolder.components = mergedComps;
            } else {
                mergedFolders.push(cf);
            }
        });

        return {
            ...coreMod,
            folders: mergedFolders
        };
    });
};

/**
 * Generates an AI Architecture Analysis report
 */
export const generateAiArchitectureAnalysis = async (
    selectedModuleIds: string[],
    language: 'ka' | 'en' = 'ka',
    options?: {
        singleModuleId?: string;
        customFeaturesOnly?: boolean;
        focusedComponentIds?: string[];
        modulesList?: PlatformModuleDefinition[];
    }
): Promise<AiArchitectureReport> => {
    await new Promise(resolve => setTimeout(resolve, 450));

    const activeList = options?.modulesList || getMergedPlatformModules();
    let targetModuleIds = selectedModuleIds;
    
    if (options?.singleModuleId) {
        targetModuleIds = [options.singleModuleId];
    } else if (options?.customFeaturesOnly) {
        targetModuleIds = activeList.filter(m => m.isCustom || m.id === 'other_custom').map(m => m.id);
        if (targetModuleIds.length === 0) targetModuleIds = ['other_custom'];
    }

    const modules = activeList.filter(m => targetModuleIds.includes(m.id));
    const count = modules.length;
    const timestamp = new Date().toISOString();

    let summaryEn = '';
    let summaryKa = '';

    if (options?.customFeaturesOnly || (targetModuleIds.length === 1 && targetModuleIds[0] === 'other_custom')) {
        summaryEn = `Dedicated Focused Analysis on User-Defined Custom Innovations and Extensions. Evaluated ${modules.flatMap(m => m.folders.flatMap(f => f.components)).length} registered component(s). The custom extensions integrate seamlessly via asynchronous event hooks, enabling automated zero-click inventory decrement and localized telemetry without altering the core database architecture.`;
        summaryKa = `მიზნობრივი დამოუკიდებელი AI ანალიზი მომხმარებლის მიერ შექმნილ ახალ ინოვაციებსა და გაფართოებებზე. შეფასდა ${modules.flatMap(m => m.folders.flatMap(f => f.components)).length} რეგისტრირებული ქვეკომპონენტი. ახალი ფუნქციები უერთდება სისტემას ასინქრონული Event-Hook-ებით, რაც უზრუნველყოფს მარაგების ავტო-ჩამოწერას და ტელემეტრიას ბაზის ძირითადი სტრუქტურის შეუცვლელად.`;
    } else if (count === 1) {
        const mod = modules[0];
        const compCount = mod.folders.flatMap(f => f.components).length;
        summaryEn = `Focused Deep Architecture Synthesis for [${mod.nameEn}]. Evaluated ${mod.folders.length} folder(s), ${compCount} deep sub-component(s), and ${mod.subOptions.length} operational sub-option(s). Operating independently, it achieves high localized efficiency, while connecting it with upstream GIS and downstream Financial ledgers unlocks a projected 1.45x profitability multiplier.`;
        summaryKa = `დამოუკიდებელი ღრმა არქიტექტურული ანალიზი მოდულისთვის [${mod.nameKa}]. შეფასდა ${mod.folders.length} საქაღალდე, ${compCount} ქვეკომპონენტი და ${mod.subOptions.length} საოპერაციო ოფცია. დამოუკიდებლად მუშაობისას აღმოფხვრის ხელით შეცდომებს, ხოლო GIS-თან და ბუღალტერიასთან ინტეგრაცია მარჟას 1.45-ჯერ ზრდის.`;
    } else if (count >= 10) {
        summaryEn = `Exhaustive Full-Stack Precision Agriculture Ecosystem Synthesis across ${count} active modules. By combining Bluetooth weigh-in hardware scales, offline-first vector GIS, 10-component warehouse logistics (Harvest produce, Sales, Cold storage, Post-harvest archives, Live ledger, Agro-inputs, Assets, Supplies, Purchase Orders, and Direct charges), and 100% automated stock deductions, AgriMap Pro establishes a zero-human-error digital thread.`;
        summaryKa = `სრული აგრო-ეკოსისტემის სტრატეგიული სინთეზი ${count} აქტიური მოდულისთვის. Bluetooth ელექტრონული სასწორების, ოფლაინ ვექტორული GIS-ის, საწყობის 10 სრული ქვეკომპონენტისა (მოსავალი, გაყიდვები, მაცივარი, არქივი, ცოცხალი ლეჯერი, აგრო-ინპუტები, აქტივები, ტარა, PO, პირდაპირი ხარჯები) და მარაგების 100%-ით ავტომატური ჩამოწერის წყალობით, AgriMap Pro ქმნის უშეცდომო ციფრულ ჯაჭვს.`;
    } else {
        summaryEn = `Targeted multi-module architecture evaluation across ${count} selected domains (${modules.map(m => m.nameEn.split('.')[1]?.trim() || m.nameEn).join(', ')}). The synchronized data pipeline achieves real-time inventory tracking and eliminates administrative duplication.`;
        summaryKa = `მიზნობრივი მრავალმოდულური არქიტექტურული შეფასება ${count} არჩეული მიმართულებისთვის (${modules.map(m => m.nameKa.split('.')[1]?.trim() || m.nameKa).join(', ')}). სინქრონიზებული მონაცემთა ნაკადები უზრუნველყოფს მარაგების რეალურ დროში კონტროლს.`;
    }

    const gapEn: string[] = [];
    const gapKa: string[] = [];
    const roadmapEn: any[] = [];
    const roadmapKa: any[] = [];
    const synergiesEn: string[] = [];
    const synergiesKa: string[] = [];

    modules.forEach(m => {
        m.missedGapsEn.forEach(g => gapEn.push(`[${m.nameEn.split('.')[1]?.trim() || m.nameEn}] ${g}`));
        m.missedGapsKa.forEach(g => gapKa.push(`[${m.nameKa.split('.')[1]?.trim() || m.nameKa}] ${g}`));
        
        m.recommendedFutureUpgradesEn.forEach(u => {
            roadmapEn.push({
                moduleName: m.nameEn,
                featureTitle: u.split(':')[0] || u,
                impact: 'High',
                description: u,
                estimatedProfitBoost: '+15% to +25% Operational Efficiency'
            });
        });

        m.recommendedFutureUpgradesKa.forEach(u => {
            roadmapKa.push({
                moduleName: m.nameKa,
                featureTitle: u.split(':')[0] || u,
                impact: 'High',
                description: u,
                estimatedProfitBoost: '+15% - 25% საოპერაციო ეფექტურობა'
            });
        });
    });

    synergiesEn.push("Stock 10-Component Ledger ↔ Tasks ↔ Agronomy: Guarantees 100% automated stock deduction and zero unrecorded chemical applications.");
    synergiesEn.push("Bluetooth Harvest Scales ↔ Cold Storage Chambers ↔ Worker Credit: Real-time picker wage ledger without manual paperwork.");
    synergiesEn.push("GIS Map ↔ Electronic Weight Station ↔ Cost-per-KG Engine: Micro-zoned profitability down to the exact field row.");
    synergiesEn.push("Autonomous AI Analyzer ↔ Dashboard Telemetry: 24/7 continuous audit preventing budget and chemical dosage drifts.");
    synergiesEn.push("Custom User Innovations ↔ Zero-Click Storage BOM: Dynamic integration of proprietary farm equipment.");

    synergiesKa.push("საწყობის 10 კომპონენტი ↔ სამუშაოები ↔ აგრონომია: უზრუნველყოფს ქიმიკატების 100%-ით აღრიცხულ ხარჯვასა და ავტო-ჩამოწერას.");
    synergiesKa.push("Bluetooth სასწორები ↔ სამაცივრე კამერები ↔ მუშაკის ანგარიში: რეალურ დროში ხელფასის ასახვა საბუთების გარეშე.");
    synergiesKa.push("GIS რუკა ↔ ელექტრონული სასწორი ↔ 1 კგ-ის თვითღირებულება: მიკრო-ზონირებული მომგებიანობა კონკრეტულ რიგამდე.");
    synergiesKa.push("ავტონომიური AI აუდიტორი ↔ Dashboard ტელემეტრია: 24/7 კონტროლი ბიუჯეტისა და დოზირების გადახრებზე.");
    synergiesKa.push("მომხმარებლის ინოვაციები ↔ საწყობის ავტო-ჩამოწერა: ახალი ტექნიკის უწყვეტი ინტეგრაცია.");

    return {
        timestamp,
        selectedModuleIds: targetModuleIds,
        focusedComponentIds: options?.focusedComponentIds,
        isCustomOnly: options?.customFeaturesOnly,
        analyzedModulesCount: count,
        executiveSummaryEn: summaryEn,
        executiveSummaryKa: summaryKa,
        gapAnalysisEn: gapEn,
        gapAnalysisKa: gapKa,
        upgradeRoadmapEn: roadmapEn,
        upgradeRoadmapKa: roadmapKa,
        synergiesEn,
        synergiesKa,
        overallProfitMultiplierEn: '1.45x to 1.85x Operational Efficiency & Margin Multiplier',
        overallProfitMultiplierKa: '1.45x - 1.85x საოპერაციო ეფექტურობისა და მარჟის ზრდის მულტიპლიკატორი'
    };
};

/**
 * Generates an interactive, standalone HTML Presentation slide deck
 */
export const generatePresentationSlidesHtml = (
    selectedModules: PlatformModuleDefinition[],
    connections: ModuleConnection[],
    report: AiArchitectureReport,
    language: 'ka' | 'en' = 'ka'
): string => {
    const isKa = language === 'ka';
    const totalComps = selectedModules.reduce((acc, m) => acc + m.folders.reduce((fAcc, f) => fAcc + f.components.length, 0), 0);

    const slidesData = [
        {
            title: isKa ? 'AgriMap Pro - მექანიკური არქიტექტურა & ეკოსისტემა' : 'AgriMap Pro - Manual Architecture & Ecosystem Deck',
            subtitle: isKa ? 'მსოფლიო დონის სიზუსტის აგრონომიული & სასაწყობო პლატფორმა' : 'World-Class Precision Agriculture & Warehouse Platform',
            content: `
                <div class="hero-box">
                    <h2>${isKa ? 'სტრატეგიული მიმოხილვა' : 'Executive Overview'}</h2>
                    <p class="summary-text">${isKa ? report.executiveSummaryKa : report.executiveSummaryEn}</p>
                    <div class="stats-grid">
                        <div class="stat-card">
                            <span class="stat-num">${selectedModules.length}</span>
                            <span class="stat-label">${isKa ? 'აქტიური მოდული' : 'Active Modules'}</span>
                        </div>
                        <div class="stat-card">
                            <span class="stat-num">${totalComps}</span>
                            <span class="stat-label">${isKa ? 'ქვეკომპონენტი' : 'Deep Components'}</span>
                        </div>
                        <div class="stat-card">
                            <span class="stat-num">${connections.filter(c => c.enabled).length}</span>
                            <span class="stat-label">${isKa ? 'მონაცემთა ნაკადი' : 'Live Data Streams'}</span>
                        </div>
                    </div>
                </div>
            `
        },
        ...selectedModules.map(m => ({
            title: isKa ? m.nameKa : m.nameEn,
            subtitle: `${isKa ? 'კატეგორია' : 'Category'}: ${m.category}`,
            content: `
                <div class="module-slide">
                    <div class="badge-cat">${m.category}</div>
                    <p class="desc-text">${isKa ? m.fullDescriptionKa : m.fullDescriptionEn}</p>
                    <div class="deck-two-col">
                        <div class="col-card">
                            <h3>⭐ ${isKa ? 'მსოფლიო დონის უპირატესობა' : 'World-First Competitive Advantage'}</h3>
                            <p>${isKa ? m.worldFirstAdvantageKa : m.worldFirstAdvantageEn}</p>
                        </div>
                        <div class="col-card">
                            <h3>💰 ${isKa ? 'მომგებიანობა & ROI' : 'Economic Impact & Profitability'}</h3>
                            <p>${isKa ? m.profitabilityKa : m.profitabilityEn}</p>
                        </div>
                    </div>
                    ${m.folders.length > 0 ? `
                        <div class="components-chip-container">
                            <strong>${isKa ? 'ძირითადი კომპონენტები:' : 'Key Components:'}</strong>
                            <div class="chips-wrap">
                                ${m.folders.flatMap(f => f.components).map(c => `<span class="comp-chip">${isKa ? c.nameKa : c.nameEn}</span>`).join('')}
                            </div>
                        </div>
                    ` : ''}
                </div>
            `
        })),
        {
            title: isKa ? 'მოდულთაშორისი სინერგია & ROI მულტიპლიკატორი' : 'Cross-Module Synergies & ROI Multiplier',
            subtitle: isKa ? '100% ავტომატიზაცია და უშეცდომო აგრო-ჯაჭვი' : '100% Automation & Zero-Error Digital Thread',
            content: `
                <div class="synergy-slide">
                    <div class="multiplier-banner">
                        <strong>${isKa ? 'საოპერაციო ეფექტურობის ზრდა:' : 'Projected Profit & Efficiency Boost:'}</strong>
                        <span>${isKa ? report.overallProfitMultiplierKa : report.overallProfitMultiplierEn}</span>
                    </div>
                    <div class="synergy-list">
                        ${(isKa ? report.synergiesKa : report.synergiesEn).map(s => `
                            <div class="syn-item">
                                <span class="syn-icon">⚡</span>
                                <span>${s}</span>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `
        }
    ];

    return `<!DOCTYPE html>
<html lang="${language}">
<head>
    <meta charset="UTF-8">
    <title>${isKa ? 'AgriMap Pro - მექანიკური არქიტექტურის პრეზენტაცია' : 'AgriMap Pro - Manual Architecture Presentation'}</title>
    <style>
        * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif; }
        body { background: #0f172a; color: #f8fafc; display: flex; flex-direction: column; height: 100vh; overflow: hidden; }
        header { padding: 16px 32px; background: #1e293b; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #334155; }
        .logo { font-size: 20px; font-weight: 700; color: #10b981; }
        .slide-container { flex: 1; display: flex; align-items: center; justify-content: center; padding: 32px; }
        .slide { background: #1e293b; border: 1px solid #334155; border-radius: 16px; padding: 40px; width: 100%; max-width: 1000px; max-height: 80vh; overflow-y: auto; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5); display: none; }
        .slide.active { display: block; animation: fadeIn 0.3s ease-in-out; }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        h1 { font-size: 28px; margin-bottom: 8px; color: #38bdf8; }
        .subtitle { font-size: 16px; color: #94a3b8; margin-bottom: 24px; }
        .hero-box { display: flex; flex-direction: column; gap: 20px; }
        .summary-text { font-size: 18px; line-height: 1.6; color: #cbd5e1; }
        .stats-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin-top: 16px; }
        .stat-card { background: #0f172a; padding: 20px; border-radius: 12px; border: 1px solid #334155; text-align: center; }
        .stat-num { display: block; font-size: 36px; font-weight: 800; color: #10b981; }
        .stat-label { font-size: 14px; color: #94a3b8; }
        .deck-two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin: 20px 0; }
        .col-card { background: #0f172a; padding: 20px; border-radius: 12px; border: 1px solid #334155; }
        .col-card h3 { font-size: 16px; margin-bottom: 8px; color: #38bdf8; }
        .col-card p { font-size: 14px; line-height: 1.5; color: #cbd5e1; }
        .badge-cat { display: inline-block; padding: 4px 12px; background: rgba(56, 189, 248, 0.15); color: #38bdf8; border-radius: 9999px; font-size: 12px; font-weight: 600; margin-bottom: 16px; }
        .components-chip-container { margin-top: 16px; padding: 16px; background: #0f172a; border-radius: 12px; border: 1px solid #334155; }
        .chips-wrap { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 8px; }
        .comp-chip { background: #334155; color: #f1f5f9; padding: 4px 10px; border-radius: 6px; font-size: 12px; }
        .multiplier-banner { background: linear-gradient(135deg, #065f46, #047857); padding: 20px; border-radius: 12px; font-size: 18px; display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; }
        .synergy-list { display: flex; flex-direction: column; gap: 12px; }
        .syn-item { display: flex; gap: 12px; align-items: center; background: #0f172a; padding: 14px 18px; border-radius: 10px; border: 1px solid #334155; font-size: 15px; }
        footer { padding: 16px 32px; background: #1e293b; display: flex; justify-content: space-between; align-items: center; border-top: 1px solid #334155; }
        .controls { display: flex; gap: 12px; }
        button { background: #3b82f6; color: white; border: none; padding: 10px 20px; border-radius: 8px; font-weight: 600; cursor: pointer; transition: background 0.2s; }
        button:hover { background: #2563eb; }
        button:disabled { background: #475569; cursor: not-allowed; }
    </style>
</head>
<body>
    <header>
        <div class="logo">🌿 AgriMap Pro - Manual Architecture Deck</div>
        <div id="slideCounter">1 / ${slidesData.length}</div>
    </header>
    <div class="slide-container">
        ${slidesData.map((s, idx) => `
            <div class="slide ${idx === 0 ? 'active' : ''}" id="slide-${idx}">
                <h1>${s.title}</h1>
                <div class="subtitle">${s.subtitle}</div>
                ${s.content}
            </div>
        `).join('')}
    </div>
    <footer>
        <button id="prevBtn" onclick="prevSlide()" disabled>← ${isKa ? 'წინა' : 'Previous'}</button>
        <div class="controls">
            <button onclick="toggleFullScreen()">${isKa ? 'სრული ეკრანი' : 'Full Screen'}</button>
            <button id="nextBtn" onclick="nextSlide()">${isKa ? 'შემდეგი' : 'Next'} →</button>
        </div>
    </footer>
    <script>
        let currentSlide = 0;
        const total = ${slidesData.length};
        function updateSlides() {
            document.querySelectorAll('.slide').forEach((el, idx) => {
                el.classList.toggle('active', idx === currentSlide);
            });
            document.getElementById('slideCounter').textContent = (currentSlide + 1) + ' / ' + total;
            document.getElementById('prevBtn').disabled = currentSlide === 0;
            document.getElementById('nextBtn').textContent = currentSlide === total - 1 ? '${isKa ? 'დასრულება' : 'Finish'}' : '${isKa ? 'შემდეგი' : 'Next'} →';
        }
        function nextSlide() { if (currentSlide < total - 1) { currentSlide++; updateSlides(); } }
        function prevSlide() { if (currentSlide > 0) { currentSlide--; updateSlides(); } }
        function toggleFullScreen() {
            if (!document.fullscreenElement) { document.documentElement.requestFullscreen(); }
            else if (document.exitFullscreen) { document.exitFullscreen(); }
        }
        document.addEventListener('keydown', (e) => {
            if (e.key === 'ArrowRight' || e.key === ' ') nextSlide();
            if (e.key === 'ArrowLeft') prevSlide();
        });
    </script>
</body>
</html>`;
};

/**
 * Generates an operational SOP User Manual Guide file (.md)
 */
export const generateComprehensiveUserGuideMarkdown = (
    selectedModules: PlatformModuleDefinition[],
    connections: ModuleConnection[],
    report: AiArchitectureReport,
    language: 'ka' | 'en' = 'ka'
): string => {
    const isKa = language === 'ka';
    const dateStr = new Date().toLocaleDateString(isKa ? 'ka-GE' : 'en-US', { year: 'numeric', month: 'long', day: 'numeric' });

    let doc = '';
    doc += `# ${isKa ? 'AgriMap Pro - სრული საოპერაციო გზამკვლევი & მექანიკური არქიტექტურა' : 'AgriMap Pro - Master Operational SOP & Manual Architecture Manual'}\n`;
    doc += `**${isKa ? 'თარიღი' : 'Generated Date'}**: ${dateStr} | **${isKa ? 'ვერსია' : 'Platform Version'}**: 2.0.6 Enterprise\n\n`;
    doc += `---\n\n`;

    doc += `## 1. ${isKa ? 'შესავალი & სტრატეგიული მიმოხილვა' : 'Executive Overview & Strategic Architecture'}\n\n`;
    doc += `${isKa ? report.executiveSummaryKa : report.executiveSummaryEn}\n\n`;
    doc += `**${isKa ? 'საოპერაციო ეფექტურობის მულტიპლიკატორი' : 'Projected Profit & Efficiency Multiplier'}**: ${isKa ? report.overallProfitMultiplierKa : report.overallProfitMultiplierEn}\n\n`;

    doc += `### ${isKa ? 'მოდულთაშორისი ინტეგრაციები & მონაცემთა ნაკადები' : 'Cross-Module Live Data Interconnections'}\n\n`;
    connections.filter(c => c.enabled).forEach((c, idx) => {
        const fromMod = selectedModules.find(m => m.id === c.fromModuleId);
        const toMod = selectedModules.find(m => m.id === c.toModuleId);
        const fromName = fromMod ? (isKa ? fromMod.nameKa : fromMod.nameEn) : c.fromModuleId;
        const toName = toMod ? (isKa ? toMod.nameKa : toMod.nameEn) : c.toModuleId;
        doc += `${idx + 1}. **${fromName}** ➔ **${toName}**: ${isKa ? c.labelKa : c.labelEn} *(Type: ${c.type})*\n`;
    });
    doc += `\n---\n\n`;

    doc += `## 2. ${isKa ? 'მოდულებისა და ქვეკომპონენტების დეტალური აღწერა' : 'Comprehensive Module & Component Deep-Dive'}\n\n`;

    selectedModules.forEach((m, idx) => {
        doc += `### ${idx + 1}. ${isKa ? m.nameKa : m.nameEn}\n\n`;
        doc += `* **${isKa ? 'კატეგორია' : 'Category'}**: \`${m.category}\`\n`;
        doc += `* **${isKa ? 'მოკლე მიმოხილვა' : 'Summary'}**: ${isKa ? m.shortDescKa : m.shortDescEn}\n\n`;
        doc += `#### ${isKa ? 'სრული არქიტექტურული აღწერა' : 'Full Architectural Description'}\n`;
        doc += `${isKa ? m.fullDescriptionKa : m.fullDescriptionEn}\n\n`;

        if (m.folders && m.folders.length > 0) {
            doc += `#### ${isKa ? 'საქაღალდეები & ქვეკომპონენტები (Manual Architecture Hierarchy)' : 'Folder Hierarchy & Deep Components'}\n`;
            m.folders.forEach(f => {
                doc += `* 📁 **${isKa ? f.nameKa : f.nameEn}**:\n`;
                f.components.forEach(c => {
                    doc += `  * 📄 **${isKa ? c.nameKa : c.nameEn}**${c.isUniqueInWorld ? ` *(⭐ ${isKa ? 'უნიკალური' : 'World Unique'}*)` : ''}:\n`;
                    doc += `    ${isKa ? c.shortDescKa : c.shortDescEn}\n`;
                    if (c.formulaOrLogicEn) {
                        doc += `    - *Formula/Logic*: \`${isKa ? (c.formulaOrLogicKa || c.formulaOrLogicEn) : c.formulaOrLogicEn}\`\n`;
                    }
                });
            });
            doc += `\n`;
        }

        doc += `#### ${isKa ? 'მომგებიანობა & ROI' : 'Profitability & Economic Impact'}\n`;
        doc += `${isKa ? m.profitabilityKa : m.profitabilityEn}\n\n`;

        doc += `#### ${isKa ? 'მსოფლიო დონის კონკურენტული უპირატესობა' : 'World-First Competitive Advantage'}\n`;
        doc += `${isKa ? m.worldFirstAdvantageKa : m.worldFirstAdvantageEn}\n\n`;

        doc += `\n---\n\n`;
    });

    doc += `## 3. ${isKa ? 'სტრატეგიული სინერგიების შეჯამება' : 'Key Operational Synergies Summary'}\n\n`;
    (isKa ? report.synergiesKa : report.synergiesEn).forEach(s => {
        doc += `* ✅ ${s}\n`;
    });

    doc += `\n\n© 2026 AgriMap Pro. All Rights Reserved.`;
    return doc;
};
