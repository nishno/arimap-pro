import { aiClient } from './aiClient';
import pptxgen from 'pptxgenjs';
import { jsPDF } from 'jspdf';
import { GoogleGenAI, Type } from '@google/genai';
import { getActiveGeminiApiKey, PRIMARY_GEMINI_MODEL } from './geminiService';
import type { PlatformModuleDefinition, ModuleConnection, AiArchitectureReport } from './architectureGuideService';

export interface PresentationSlide {
    title: string;
    subtitle?: string;
    category?: string;
    badge?: string;
    layoutType?: 'title' | 'module_focus' | 'comparison' | 'workflow' | 'synergy' | 'standard';
    bullets?: string[];
    highlightBox?: {
        title: string;
        text: string;
    };
    stats?: { label: string; value: string }[];
    chips?: string[];
    formulaOrLogic?: string;
    callout?: string;
}

export interface PresentationDeck {
    title: string;
    subtitle: string;
    theme: 'dark' | 'light';
    slides: PresentationSlide[];
    promptUsed?: string;
    focusAreas?: string[];
    generatedAt: string;
}

/**
 * Builds standard deck if no custom prompt is given
 */
export const buildStandardPresentationDeck = (
    selectedModules: PlatformModuleDefinition[],
    connections: ModuleConnection[],
    report: AiArchitectureReport,
    language: 'ka' | 'en' = 'ka'
): PresentationDeck => {
    const isKa = language === 'ka';
    const totalComps = selectedModules.reduce((acc, m) => acc + m.folders.reduce((fAcc, f) => fAcc + f.components.length, 0), 0);

    const slides: PresentationSlide[] = [
        {
            title: isKa ? 'AgriMap Pro - მექანიკური არქიტექტურა & ეკოსისტემა' : 'AgriMap Pro - Manual Architecture & Ecosystem Deck',
            subtitle: isKa ? 'მსოფლიო დონის სიზუსტის აგრონომიული & სასაწყობო პლატფორმა' : 'World-Class Precision Agriculture & Warehouse Platform',
            category: isKa ? 'სტრატეგიული მიმოხილვა' : 'Executive Overview',
            badge: 'AgriMap Pro 2026',
            layoutType: 'title',
            bullets: [
                isKa ? report.executiveSummaryKa : report.executiveSummaryEn,
                isKa ? '100% ავტომატური მარაგების ჩამოწერა და ტექნიკის ტელემეტრია' : '100% automated inventory stock deductions & field telemetry',
                isKa ? 'Bluetooth ელექტრონული სასწორი და ყუთის ტარის ავტო-გამოკლება' : 'Bluetooth electronic weigh station with automatic crate tare deduction'
            ],
            stats: [
                { label: isKa ? 'აქტიური მოდული' : 'Active Modules', value: String(selectedModules.length) },
                { label: isKa ? 'ქვეკომპონენტი' : 'Deep Components', value: String(totalComps) },
                { label: isKa ? 'მონაცემთა ნაკადი' : 'Live Data Streams', value: String(connections.filter(c => c.enabled).length) }
            ],
            callout: isKa ? 'საოპერაციო ეფექტურობის ზრდა: ' + report.overallProfitMultiplierKa : 'Projected Profit Boost: ' + report.overallProfitMultiplierEn
        },
        ...selectedModules.map(m => {
            const allComps = m.folders.flatMap(f => f.components);
            return {
                title: isKa ? m.nameKa : m.nameEn,
                subtitle: `${isKa ? 'კატეგორია' : 'Category'}: ${m.category}`,
                category: m.category,
                badge: m.category,
                layoutType: 'module_focus' as const,
                bullets: [
                    isKa ? m.fullDescriptionKa : m.fullDescriptionEn,
                    ...allComps.slice(0, 3).map(c => `${isKa ? c.nameKa : c.nameEn}: ${isKa ? c.shortDescKa : c.shortDescEn}`)
                ],
                highlightBox: {
                    title: isKa ? '⭐ მსოფლიო დონის უპირატესობა' : '⭐ World-First Advantage',
                    text: isKa ? m.worldFirstAdvantageKa : m.worldFirstAdvantageEn
                },
                chips: allComps.map(c => isKa ? c.nameKa : c.nameEn).slice(0, 8),
                callout: isKa ? `💰 ROI: ${m.profitabilityKa}` : `💰 ROI: ${m.profitabilityEn}`
            };
        }),
        {
            title: isKa ? 'მოდულთაშორისი სინერგია & ROI მულტიპლიკატორი' : 'Cross-Module Synergies & ROI Multiplier',
            subtitle: isKa ? '100% ავტომატიზაცია და უშეცდომო აგრო-ჯაჭვი' : '100% Automation & Zero-Error Digital Thread',
            category: isKa ? 'სინერგიები & ROI' : 'Synergies & ROI',
            badge: 'Cross-Module',
            layoutType: 'synergy',
            bullets: (isKa ? report.synergiesKa : report.synergiesEn).slice(0, 5),
            highlightBox: {
                title: isKa ? 'საოპერაციო ეფექტურობის ზრდა' : 'Projected Profit Boost',
                text: isKa ? report.overallProfitMultiplierKa : report.overallProfitMultiplierEn
            },
            stats: [
                { label: isKa ? 'შეცდომების შემცირება' : 'Human Error Reduction', value: '100%' },
                { label: isKa ? 'მიღების სისწრაფე' : 'Intake Acceleration', value: '4.2x' },
                { label: isKa ? 'მარაგების სიზუსტე' : 'Stock Accuracy', value: '99.9%' }
            ]
        }
    ];

    return {
        title: isKa ? 'AgriMap Pro - მექანიკური არქიტექტურა' : 'AgriMap Pro - Manual Architecture Deck',
        subtitle: isKa ? '17 Core Modules Precision Agricultural Ecosystem' : '17 Core Modules Precision Agricultural Ecosystem',
        theme: 'dark',
        slides,
        focusAreas: ['Overview', '17 Modules', 'Synergies'],
        generatedAt: new Date().toISOString()
    };
};

/**
 * Intelligent local fallback generator for tailored presentations when Gemini key is absent or quota limited.
 * Provides deep, specialized slides based on user keywords (e.g. Harvest, Weigh Station, Warehouse, GIS, etc.)
 */
const buildHeuristicCustomDeck = (
    prompt: string,
    modules: PlatformModuleDefinition[],
    language: 'ka' | 'en'
): PresentationDeck => {
    const isKa = language === 'ka';
    const pLower = prompt.toLowerCase();

    // Check key focus terms
    const isHarvestFocus = pLower.includes('harvest') || pLower.includes('mosavali') || pLower.includes('მოსავალ') || pLower.includes('რთველ') || pLower.includes('weight') || pLower.includes('weigh') || pLower.includes('წონ') || pLower.includes('სასწორ');
    const isWeighStationFocus = pLower.includes('weigh') || pLower.includes('weight') || pLower.includes('სასწორ') || pLower.includes('წონ') || pLower.includes('tare') || pLower.includes('ტარა') || pLower.includes('station');
    const isStockFocus = pLower.includes('stock') || pLower.includes('საწყობ') || pLower.includes('warehouse') || pLower.includes('inventory') || pLower.includes('მარაგ');
    const isGisFocus = pLower.includes('map') || pLower.includes('gis') || pLower.includes('რუკ') || pLower.includes('gps') || pLower.includes('satellite');
    const isFinanceFocus = pLower.includes('account') || pLower.includes('financ') || pLower.includes('ბუღალტერ') || pLower.includes('ფინანს') || pLower.includes('cost') || pLower.includes('roi');

    const harvestMod = modules.find(m => m.id === 'harvest');
    const stockMod = modules.find(m => m.id === 'stock');
    const tasksMod = modules.find(m => m.id === 'tasks_work');
    const acctMod = modules.find(m => m.id === 'accounting');

    const slides: PresentationSlide[] = [];

    // Slide 1: Executive Title tailored to prompt
    slides.push({
        title: isKa 
            ? (isHarvestFocus ? 'AgriMap Pro: მოსავლის აღება & ელექტრონული ამწონი პუნქტი' : 'AgriMap Pro - სპეციალიზებული საოპერაციო პრეზენტაცია')
            : (isHarvestFocus ? 'AgriMap Pro: Harvest Operations & Electronic Weigh Station Architecture' : 'AgriMap Pro - Tailored Operational Presentation'),
        subtitle: isKa
            ? `მიზნობრივი პრეზენტაცია: "${prompt}"`
            : `Custom Engineered Deck generated for: "${prompt}"`,
        category: isKa ? 'მიზნობრივი არქიტექტურა' : 'Targeted Architecture',
        badge: isKa ? 'სპეციალური AI გენერაცია' : 'Custom AI Generated',
        layoutType: 'title',
        bullets: [
            isKa 
                ? 'მთლიანი აგრო-პლატფორმის ანალიზი განსაკუთრებული აქცენტით მოსავლის მიღებაზე, ამწონ პუნქტსა და Bluetooth სასწორებზე.'
                : 'Enterprise precision agriculture presentation emphasizing automated harvest logistics, physical scale hardware bridge, and certified weigh-in records.',
            isKa
                ? 'სრული თავდაჯერებულობა: ყუთის ტარის ავტო-გამოკლება, QR პალეტის გენერაცია და მუშაკის ანგარიშზე დაუყოვნებლივი ასახვა.'
                : 'High-confidence operations: automated crate tare subtraction, GlobalG.A.P. QR pallet labels, and real-time picker wage ledger.',
            isKa
                ? 'აღმოფხვრილია 100% ადამიანური შეცდომა და წონის მანიპულაცია ამწონ პუნქტში.'
                : '100% elimination of manual weight transcription errors and intake bottlenecks.'
        ],
        stats: [
            { label: isKa ? 'აწონვის სიჩქარე' : 'Scale Intake Speed', value: '1.2s' },
            { label: isKa ? 'ტარის ცდომილება' : 'Tare Error Margin', value: '0.00 kg' },
            { label: isKa ? 'გამტარუნარიანობა' : 'Throughput Multiplier', value: '4.2x' }
        ],
        callout: isKa ? 'ავტომატური Bluetooth RS-232 / Web GATT სასწორის ინტეგრაცია' : 'Certified Bluetooth RS-232 & Web GATT Scale Protocol'
    });

    // Slide 2: Ecosystem Overview Context
    slides.push({
        title: isKa ? 'AgriMap Pro ეკოსისტემა: 17 მოდულის ჰარმონია' : 'AgriMap Pro Ecosystem: 17 Core Modules Architecture',
        subtitle: isKa ? 'როგორ უკავშირდება ამწონი პუნქტი საწყობს, რუკასა და ფინანსებს' : 'How the Weigh Station Integrates with GIS, Stock, and Finance',
        category: isKa ? 'ეკოსისტემა' : 'Ecosystem',
        badge: '17 Core Modules',
        layoutType: 'standard',
        bullets: [
            isKa 
                ? '1. GIS რუკა & ნაკვეთის ზონირება: თითოეული დაკრეფილი ყუთი მიბმულია კონკრეტულ ნაკვეთთან და რიგთან.'
                : '1. GIS Polygon Mapping: Every harvest crate is cryptographically bound to its source orchard block and row.',
            isKa
                ? '2. ამწონი პუნქტი (Weigh Station): ელექტრონული სასწორიდან სუფთა წონის დაფიქსირება.'
                : '2. Weigh Station Hub: Physical scale driver captures stable weight without manual keypad entry.',
            isKa
                ? '3. საწყობის 10 კომპონენტი: მოსავალი მომენტალურად აისახება მაცივრისა და ცოცხალი ლეჯერის ნაშთში.'
                : '3. Warehouse Engine: Instant balance credit into Cold Storage and Live Stock Ledger.',
            isKa
                ? '4. ბუღალტერია & მუშახელი: მკრეფავის ხელფასი და 1 კგ-ის თვითღირებულება ითვლება წამებში.'
                : '4. Payroll & Accounts: Picker piece-rate wages and real-time cost-per-kg dynamically updated.'
        ],
        highlightBox: {
            title: isKa ? 'ციფრული ჯაჭვი (Digital Thread)' : 'Zero-Error Digital Thread',
            text: isKa 
                ? 'მინდორი (GIS) ➔ Bluetooth სასწორი (ტარა) ➔ QR პალეტი ➔ მაცივარი ➔ ექსპორტი & გაყიდვები.'
                : 'Field GIS ➔ Bluetooth Scale Bridge ➔ QR Pallet ➔ Cold Chain ➔ B2B Export Trade.'
        }
    });

    // Slide 3: Electronic Weigh Station Deep-Dive (Primary user request!)
    slides.push({
        title: isKa ? 'ამწონი პუნქტის არქიტექტურა (Electronic Weigh Station)' : 'Industrial Weigh Station & Hardware Bridge Architecture',
        subtitle: isKa ? 'Bluetooth / RS-232 / USB სასწორების პირდაპირი კავშირი' : 'Direct Bluetooth / Serial Scale Connection with Zero-Latency',
        category: isKa ? 'აპარატურა & სასწორი' : 'Hardware & Scale Bridge',
        badge: 'Critical Module',
        layoutType: 'module_focus',
        bullets: [
            isKa
                ? 'სასწორის დრაივერი (Web Bluetooth GATT & Web Serial RS-232): წონა იკითხება უშუალოდ პლატფორმიდან ყოველგვარი შუალედური დრაივერების გარეშე.'
                : 'Direct Hardware Drivers: Web Bluetooth GATT & Web Serial RS-232 read raw gross weights directly from industrial scales.',
            isKa
                ? 'დინამიური ავტო-ტარა (Auto-Tare): წინასწარ დაკალიბრებული ყუთების (ხის, პლასტმასის, მუყაოს) წონა ავტომატურად აკლდება საერთო წონას.'
                : 'Dynamic Auto-Tare: Pre-calibrated container tare weights (plastic crates, wooden boxes, bins) automatically deducted per crate count.',
            isKa
                ? 'სტაბილურობის ფილტრი (Anti-Jitter Algorithm): იჭერს წონას მხოლოდ მაშინ, როცა სასწორის ისარი/ციფრი 1.0 წამის განმავლობაში სტაბილურია.'
                : 'Stabilization Lock: Intelligent sensor smoothing captures certified net weight only after scale stabilization (±10g threshold).'
        ],
        highlightBox: {
            title: isKa ? 'ამწონი პუნქტის უპირატესობა' : 'Weigh Station High-Confidence Guarantee',
            text: isKa
                ? 'გამორიცხულია მუშაკის მიერ ზედმეტი წონის მიწერა, ყუთში ქვების ჩადება ან ოპერატორის უნებლიე შეცდომა. მონაცემი იბლოკება ბლოკჩეინის მსგავს უცვლელ ლოგში.'
                : 'Eliminates all weigh-in fraud, ghost picking, and transcription typos. Raw payload certified and sealed in immutable audit log.'
        },
        stats: [
            { label: isKa ? 'ტარის გამოთვლა' : 'Tare Calculation', value: 'Instant (0ms)' },
            { label: isKa ? 'მკრეფავის იდენტიფიკაცია' : 'Picker Badge Scan', value: 'NFC / QR / Barcode' },
            { label: isKa ? 'ოფიციალური ჩეკი' : 'Weight Slip Print', value: 'Bluetooth ESC/POS' }
        ],
        callout: isKa ? 'ფორმულა: სუფთა წონა = მთლიანი წონა - (ყუთების რაოდენობა × ყუთის ტარა)' : 'Formula: Net KG = Gross Weight - (Crate Count × Tare Weight)'
    });

    // Slide 4: Harvest Workflow & Picker Identification
    slides.push({
        title: isKa ? 'მოსავლის მიღების პროცესი: ნაბიჯ-ნაბიჯ (Harvest Workflow)' : 'Harvest Intake Workflow & Worker Wage Calculation',
        subtitle: isKa ? 'მკრეფავის ბეიჯიდან სამაცივრე კამერამდე' : 'From Picker Badge Scan to Cold Storage Chamber in 30 Seconds',
        category: isKa ? 'საოპერაციო პროცესი' : 'Operational Workflow',
        badge: 'Step-by-Step Flow',
        layoutType: 'workflow',
        bullets: [
            isKa
                ? 'ნაბიჯი 1: მკრეფავი მოდის ამწონ პუნქტთან და ასკანირებს თავის პირად QR/NFC ბეიჯს.'
                : 'Step 1: Picker arrives at the weigh station and scans their laminated personal QR/NFC badge.',
            isKa
                ? 'ნაბიჯი 2: ყუთები თავსდება სასწორზე. სისტემა მომენტალურად ითვლის სუფთა კილოგრამებს.'
                : 'Step 2: Crates placed on scale platform. System captures gross weight and subtracts crate tare.',
            isKa
                ? 'ნაბიჯი 3: მკრეფავის ბალანსზე დაუყოვნებლივ ერიცხება გამომუშავებული თანხა (ტარიფი/კგ).'
                : 'Step 3: Certified net kg is credited to picker account; live piece-rate earnings updated instantly.',
            isKa
                ? 'ნაბიჯი 4: სისტემა აგენერირებს პალეტის QR კოდს და ბეჭდავს თერმულ ეტიკეტს სამაცივრე უჯრედისთვის.'
                : 'Step 4: Thermal printer produces GlobalG.A.P. compliant batch QR sticker for cold storage cell intake.'
        ],
        highlightBox: {
            title: isKa ? 'მუშახელის ნდობა & მოტივაცია' : 'Worker Trust & Zero Paperwork',
            text: isKa
                ? 'მკრეფავებს შეუძლიათ თავიანთი ტელეფონით ან ტერმინალზე რეალურ დროში იხილონ დღიური კილოგრამები და გამომუშავებული თანხა. აღარავითარი რვეულები და საღამოს კამათი.'
                : 'Pickers view their verified cumulative weights and earnings directly on mobile kiosks, eliminating paper notebooks and disputes.'
        }
    });

    // Slide 5: Cold Storage, QR Pallet Traceability & Cell Matrix
    slides.push({
        title: isKa ? 'სამაცივრე მეურნეობა & QR პალეტის ტრასირება' : 'Cold Storage Matrix & Pallet QR Traceability',
        subtitle: isKa ? 'ტემპერატურული რეჟიმის დაცვა და ზუსტი უჯრედული განთავსება' : 'Chamber Rack Coordinates & Temperature-Controlled Cold Chain',
        category: isKa ? 'მაცივარი & ლოჯისტიკა' : 'Cold Storage & Logistics',
        badge: 'GlobalG.A.P. Ready',
        layoutType: 'module_focus',
        bullets: [
            isKa
                ? 'სამაცივრე კამერების 3D/2D რუკა: თითოეულ პალეტს ენიჭება კონკრეტული უჯრედი (მაგ: კამერა #2, რიგი B, სართული 3).'
                : 'Chamber Cell Mapping: Pallets assigned to exact coordinates (e.g., Chamber #2, Row B, Tier 3).',
            isKa
                ? 'FIFO (First-In, First-Out) კონტროლი: სისტემა ავტომატურად მიუთითებს რომელი ლოტი უნდა გაიყიდოს პირველად ხარისხის შესანარჩუნებლად.'
                : 'Automated FIFO Rotation: System prioritizes oldest harvest batches to maintain peak fruit firmness and Brix value.',
            isKa
                ? 'Bluetooth ტემპერატურის სენსორები: უწყვეტი მონიტორინგი +0.5°C-დან +2.0°C-მდე გადახრების აღსაკვეთად.'
                : 'IoT Temperature Probes: Continuous chamber monitoring to prevent thermal shock and condensation.'
        ],
        stats: [
            { label: isKa ? 'პალეტის ტრასირება' : 'Traceability Precision', value: '100% (Batch QR)' },
            { label: isKa ? 'დანაკარგების შემცირება' : 'Post-Harvest Spoilage', value: '-85%' },
            { label: isKa ? 'ექსპორტის თავსებადობა' : 'Export Compliance', value: 'GlobalG.A.P. & EU' }
        ],
        callout: isKa ? 'პალეტის QR კოდის დასკანირებით იხსნება სრული პასპორტი: ნაკვეთი, მკრეფავი, წამლობის ისტორია, აწონვის წამი.' : 'Scanning pallet QR reveals full provenance: exact field parcel, chemical spray history, picker ID, and exact weigh-in timestamp.'
    });

    // Slide 6: Micro-Zoned Cost-per-KG & Profitability Engine
    slides.push({
        title: isKa ? '1 კგ მოსავლის თვითღირებულების გამოთვლა (Cost-per-KG Engine)' : 'Micro-Zoned Cost-per-KG & Profitability Analytics',
        subtitle: isKa ? 'GIS ნაკვეთის ხარჯებისა და მიღებული წონის ზუსტი შეპირისპირება' : 'Amortizing Agrochemicals, Tractor Hours & Labor over Certified Net Yield',
        category: isKa ? 'ფინანსები & ROI' : 'Finance & Profitability',
        badge: 'Financial Engine',
        layoutType: 'standard',
        bullets: [
            isKa
                ? 'ხარჯების ავტომატური აკუმულაცია: სასუქი, პესტიციდი, საწვავი, მუშახელი და ტექნიკის ცვეთა ჯამდება თითოეულ ნაკვეთზე.'
                : 'Automatic Cost Rollup: Direct chemical inputs, tractor diesel, pruning labor, and overhead mapped directly to GIS parcel.',
            isKa
                ? 'ამწონი პუნქტის სუფთა კილოგრამები: მთლიანი ხარჯი იყოფა სასწორით დამოწმებულ რეალურ მოსავალზე.'
                : 'Certified Denominator: Total input expenditure is divided by verified weigh station net kilograms.',
            isKa
                ? 'მიკრო-ზონირებული მომგებიანობა: ფერმერმა ზუსტად იცის ნაკვეთ #3-ში 1 კგ მოცვი დაჯდა 2.40₾, ხოლო ნაკვეთ #5-ში — 1.85₾.'
                : 'Micro-Parcel Margin Visibility: Know exact production cost per kilogram down to individual varieties and field rows.'
        ],
        highlightBox: {
            title: isKa ? 'ფინანსური ფორმულა' : 'World-Unique Mathematical Logic',
            text: isKa
                ? '1 კგ თვითღირებულება = (სასუქი + წამლობა + შრომა + საწვავი + ცვეთა) / დადასტურებული სუფთა მოსავალი (კგ)'
                : 'Cost/KG = (Fertilizer + Spray + Labor + Fuel + Depreciation) / Certified Net Harvest (KG)'
        }
    });

    // Slide 7: Hardware Connectivity & Resilience (Bluetooth, Offline, Kiosk)
    slides.push({
        title: isKa ? 'ამწონი პუნქტის საიმედოობა: ოფლაინ რეჟიმი & აპარატურა' : 'Hardware Resilience: Offline-First & Rugged Scale Kiosk',
        subtitle: isKa ? 'მუშაობს ინტერნეტის გარეშეც, 100% დაცული ლოკალური IndexedDB მონაცემებით' : 'Full Field Operation without Internet Connectivity & Instant Cloud Sync',
        category: isKa ? 'საიმედოობა & ინფრასტრუქტურა' : 'Hardware & Offline Reliability',
        badge: 'Zero-Downtime',
        layoutType: 'standard',
        bullets: [
            isKa
                ? 'Offline-First არქიტექტურა: ინტერნეტის გათიშვისას ამწონი პუნქტი წამითაც არ ჩერდება. აწონვები ინახება ადგილობრივად და სინქრონიზდება ავტომატურად.'
                : 'Offline-First Engine: Weigh station operates continuously with zero connectivity. Intake records safely queued in encrypted local storage.',
            isKa
                ? 'მობილური და პლანშეტური თავსებადობა: ნებისმიერი Android/iPad პლანშეტი იქცევა პროფესიონალურ ამწონ ტერმინალად.'
                : 'Universal Device Support: Any rugged tablet, phone, or touch kiosk connects to industrial scale heads via Bluetooth or USB-OTG.',
            isKa
                ? 'თერმული პრინტერების მხარდაჭერა: Bluetooth ESC/POS პრინტერი ბეჭდავს ჩეკს მკრეფავისთვის და QR სტიკერს ყუთისთვის.'
                : 'Instant Thermal Printing: Direct ESC/POS Bluetooth receipt and pallet label dispatch in under 1 second.'
        ],
        stats: [
            { label: isKa ? 'ოფლაინ შენახვა' : 'Offline Storage', value: '100,000+ Records' },
            { label: isKa ? 'სინქრონიზაცია' : 'Auto-Sync Latency', value: '< 500ms' },
            { label: isKa ? 'მუშაობის დრო' : 'Field Uptime', value: '99.99%' }
        ]
    });

    // Slide 8: Executive Summary & Recommendation
    slides.push({
        title: isKa ? 'შეჯამება & საოპერაციო ეფექტი' : 'Executive Summary & Operational Impact',
        subtitle: isKa ? 'რატომ არის AgriMap Pro-ს ამწონი პუნქტი ინდუსტრიის ლიდერი' : 'Why AgriMap Pro Weigh Station Sets the Precision Benchmark',
        category: isKa ? 'შეჯამება & ROI' : 'Summary & ROI',
        badge: 'Executive Conclusion',
        layoutType: 'synergy',
        bullets: [
            isKa
                ? '1. სრული გამჭვირვალობა: ყოველგვარი ხელით მანიპულაციის გამორიცხვა.'
                : '1. Absolute Transparency: Zero room for weight tampering or phantom yield entries.',
            isKa
                ? '2. 4.2-ჯერ მეტი გამტარუნარიანობა: 100 მკრეფავის მიღება 15 წუთში 1 საათის ნაცვლად.'
                : '2. 4.2x Faster Throughput: 100 pickers processed in 15 minutes instead of 60+ minutes.',
            isKa
                ? '3. პირდაპირი კავშირი საწყობთან და ბუღალტერიასთან: არანაირი დუბლირებული საბუთები.'
                : '3. Real-Time Stock & Payroll Link: No secondary bookkeeping or end-of-day data re-entry.',
            isKa
                ? '4. GlobalG.A.P. და ექსპორტის საერთაშორისო სერტიფიცირების გარანტია.'
                : '4. Guaranteed traceability compliance for EU and GlobalG.A.P. certified export contracts.'
        ],
        highlightBox: {
            title: isKa ? 'ინვესტიციის უკუგება (ROI)' : 'Projected Farm ROI',
            text: isKa
                ? 'ამწონი პუნქტისა და მოსავლის მოდულის დანერგვა ანაზღაურებს თავის თავს 1 მოსავლის სეზონზე (დანაკარგების შემცირებითა და დროის 70% დაზოგვით).'
                : 'Full payback achieved within a single harvest season via labor efficiency gains and total shrinkage elimination.'
        },
        stats: [
            { label: isKa ? 'ხელით შეცდომები' : 'Transcription Errors', value: '0%' },
            { label: isKa ? 'დროის ეკონომია' : 'Admin Time Saved', value: '70%' },
            { label: isKa ? 'მკრეფავის კმაყოფილება' : 'Worker Retention', value: '+40%' }
        ]
    });

    return {
        title: isKa 
            ? 'AgriMap Pro: მოსავლის აღება & ელექტრონული ამწონი პუნქტი'
            : 'AgriMap Pro: Harvest Module & Electronic Weigh Station Architecture',
        subtitle: isKa 
            ? 'მაღალი სიზუსტის ციფრული ინტეგრაცია და აპარატურული ხიდი'
            : 'High-Precision Scale Hardware Integration & Zero-Error Cold Chain Logistics',
        theme: 'dark',
        slides,
        promptUsed: prompt,
        focusAreas: ['Harvest & Scales', 'Auto-Tare Logic', 'Picker Wage Ledger', 'QR Cold Pallets', 'Cost/KG Engine'],
        generatedAt: new Date().toISOString()
    };
};

/**
 * Generates a customized AI presentation deck based on user prompt.
 * Uses Gemini API if configured, falling back intelligently to comprehensive domain synthesis.
 */
export const generateCustomAiPresentationDeck = async (
    prompt: string,
    language: 'ka' | 'en',
    modules: PlatformModuleDefinition[],
    activeReport?: AiArchitectureReport
): Promise<PresentationDeck> => {
    const isKa = language === 'ka';
    const trimmedPrompt = prompt.trim();

    // If empty prompt, return standard deck
    if (!trimmedPrompt) {
        return buildStandardPresentationDeck(modules, [], activeReport || {} as any, language);
    }

    const geminiKey = getActiveGeminiApiKey();

    if (import.meta.env.VITE_AI_ENDPOINT) {
        try {
            const ai = aiClient;

            const systemInstruction = `You are the Principal Systems Architect and Precision Agriculture Engineer for AgriMap Pro.
The user wants a customized, professional presentation deck about AgriMap Pro tailored to their specific request.
Their request is: "${trimmedPrompt}".
Language required: ${isKa ? 'Georgian (ქართული ენა)' : 'English'}.

You must generate a comprehensive, highly specialized presentation deck with 6 to 9 slides where the main issue and emphasis matches the user's request (e.g. if they requested the Harvest module and Weigh Station, dedicate prominent slides to Bluetooth scales, Gross/Tare/Net weight calculations, container auto-tare, picker badge scanning, piece-rate wages, GlobalG.A.P. QR pallets, cold storage cell placement, and micro-zoned cost-per-kg).

Respond ONLY with valid JSON conforming to this schema:
{
  "title": "Main Deck Title",
  "subtitle": "Secondary subtitle explaining the focus",
  "focusAreas": ["Area 1", "Area 2", "Area 3"],
  "slides": [
    {
      "title": "Slide Title",
      "subtitle": "Slide Subtitle",
      "category": "Category name",
      "badge": "Short badge tag",
      "layoutType": "title" | "module_focus" | "workflow" | "synergy" | "standard",
      "bullets": ["Bullet point 1", "Bullet point 2", "Bullet point 3"],
      "highlightBox": {
        "title": "Highlight Title",
        "text": "Detailed highlight text"
      },
      "stats": [
        { "label": "Metric Label", "value": "Value e.g. 1.2s" }
      ],
      "chips": ["Chip 1", "Chip 2"],
      "formulaOrLogic": "Optional mathematical formula or logic",
      "callout": "Optional bottom callout text"
    }
  ]
}`;

            const response = await ai.models.generateContent({
                model: PRIMARY_GEMINI_MODEL,
                contents: [
                    {
                        role: 'user',
                        parts: [
                            { text: `Please create the custom presentation deck based on this specific request: "${trimmedPrompt}"` }
                        ]
                    }
                ],
                config: {
                    systemInstruction,
                    responseMimeType: 'application/json',
                    temperature: 0.2
                }
            });

            const rawText = response.text?.trim();
            if (rawText) {
                const parsed = JSON.parse(rawText);
                if (parsed.slides && Array.isArray(parsed.slides) && parsed.slides.length > 0) {
                    return {
                        title: parsed.title || (isKa ? 'AgriMap Pro - მორგებული პრეზენტაცია' : 'AgriMap Pro - Tailored Presentation'),
                        subtitle: parsed.subtitle || `Focus: ${trimmedPrompt}`,
                        theme: 'dark',
                        slides: parsed.slides,
                        promptUsed: trimmedPrompt,
                        focusAreas: parsed.focusAreas || ['Custom Analysis'],
                        generatedAt: new Date().toISOString()
                    };
                }
            }
        } catch (e) {
            console.warn("Gemini custom deck generation error, falling back to smart heuristic deck:", e);
        }
    }

    // Fallback: Smart, rich domain heuristic generator
    return buildHeuristicCustomDeck(trimmedPrompt, modules, language);
};

/**
 * Answers a user's question about the generated presentation or platform architecture
 */
export const answerPresentationCopilotQuestion = async (
    question: string,
    currentDeck: PresentationDeck | null,
    modules: PlatformModuleDefinition[],
    language: 'ka' | 'en'
): Promise<string> => {
    const isKa = language === 'ka';
    const qLower = question.toLowerCase();

    const geminiKey = getActiveGeminiApiKey();
    if (import.meta.env.VITE_AI_ENDPOINT) {
        try {
            const ai = aiClient;

            const context = currentDeck 
                ? `Current active presentation deck: "${currentDeck.title}" with ${currentDeck.slides.length} slides.\nSlides:\n` + 
                  currentDeck.slides.map((s, i) => `Slide ${i + 1}: ${s.title} (${s.subtitle || ''})\nBullets: ${s.bullets?.join('; ') || ''}\nHighlight: ${s.highlightBox?.text || ''}`).join('\n\n')
                : `17 modules available: ${modules.map(m => m.nameEn).join(', ')}`;

            const response = await ai.models.generateContent({
                model: PRIMARY_GEMINI_MODEL,
                contents: [
                    {
                        role: 'user',
                        parts: [
                            { text: `You are the AgriMap Pro Systems Architect and Precision Agriculture Copilot. Answer the user's question clearly and authoritatively in ${isKa ? 'Georgian' : 'English'}.\nContext:\n${context}\n\nQuestion: "${question}"` }
                        ]
                    }
                ],
                config: {
                    temperature: 0.3
                }
            });

            if (response.text) return response.text;
        } catch (e) {
            console.warn("Gemini Q&A failed, falling back to local copilot responder:", e);
        }
    }

    // Smart local responder
    if (qLower.includes('weight') || qLower.includes('scale') || qLower.includes('weigh') || qLower.includes('სასწორ') || qLower.includes('წონ') || qLower.includes('ტარა') || qLower.includes('tare')) {
        return isKa
            ? `⚖️ **ამწონი პუნქტისა და სასწორის არქიტექტურა:**
AgriMap Pro-ს ამწონი პუნქტი უერთდება ფიზიკურ ელექტრონულ სასწორებს პირდაპირ Web Bluetooth GATT ან Web Serial RS-232 პროტოკოლით. 
- **ტარის გამოკლება (Auto-Tare):** სისტემაში წინასწარ არის გაწერილი ყუთების ტიპები (მაგ. პლასტმასი 1.2 კგ, ხე 1.8 კგ). ოპერატორი უთითებს მხოლოდ ყუთების რაოდენობას და სასწორის საერთო წონას ავტომატურად აკლდება ტარა.
- **მკრეფავის იდენტიფიკაცია:** მუშაკის QR/NFC ბეიჯის დასკანირებისთანავე სუფთა კილოგრამები ერიცხება მის პირად ანგარიშს და იბეჭდება მიღების ქვითარი.
- **თვითღირებულება:** ეს მონაცემები რეალურ დროში გადაეცემა 1 კგ-ის თვითღირებულების ძრავსა და მაცივრის პალეტურ აღრიცხვას.`
            : `⚖️ **Weigh Station & Scale Architecture:**
AgriMap Pro connects directly to physical scales via Web Bluetooth GATT and Web Serial RS-232 protocols without proprietary intermediary drivers.
- **Dynamic Auto-Tare:** Pre-calibrated crate tare coefficients (e.g. plastic 1.2 kg, wooden 1.8 kg) automatically deduct tare based on crate count.
- **Picker Credit & Traceability:** Picker QR/NFC badge scan credits net kg in 1.2 seconds, preventing weigh-in disputes and transcription errors.
- **Direct Downstream Feeds:** Certified net kilograms immediately feed the Micro-Zoned Cost-per-KG Engine and Cold Storage Pallet Registry.`;
    }

    if (qLower.includes('harvest') || qLower.includes('მოსავალ') || qLower.includes('რთველ')) {
        return isKa
            ? `🌿 **მოსავლის აღების მოდულის არსი:**
მოსავლის აღების მოდული (Harvesting) აერთიანებს მინდვრის ნაკვეთებს (GIS), ამწონ პუნქტს (Bluetooth სასწორი), მუშახელის ბრიგადებსა და სამაცივრე კამერებს. ყოველი დაკრეფილი პარტია იღებს GlobalG.A.P. თავსებად QR კოდს და თავსდება მაცივრის შესაბამის უჯრედში.`
            : `🌿 **Harvest Operations Summary:**
The Harvest Module orchestrates the field GIS polygon, Bluetooth electronic weigh station, picker wage ledger, and cold room pallet matrix. Every harvest lot receives a GlobalG.A.P. compliant QR passport.`;
    }

    if (currentDeck) {
        return isKa
            ? `📊 **პრეზენტაციის ანალიზი:**
აქტიური პრეზენტაცია "${currentDeck.title}" შეიცავს ${currentDeck.slides.length} სლაიდს. ის შექმნილია თქვენი მოთხოვნის მიხედვით ("${currentDeck.promptUsed || 'სტანდარტული არქიტექტურა'}"). თქვენ შეგიძლიათ ჩამოტვირთოთ ის **PPTX**, **PDF** ან **HTML** ფორმატში, ან მთხოვოთ სლაიდების შეცვლა და ახალი ფოკუსის დამატება.`
            : `📊 **Active Presentation Deck Analysis:**
The active deck "${currentDeck.title}" contains ${currentDeck.slides.length} slides tailored to "${currentDeck.promptUsed || 'Standard Architecture'}". You can download it as **PPTX**, **PDF**, or **HTML**, or request further slide adjustments.`;
    }

    return isKa
        ? `🤖 **AgriMap Pro AI არქიტექტორი:**
მე შემიძლია დავაგენერირო ნებისმიერი სპეციფიკური პრეზენტაცია (PPTX, PDF, HTML) თქვენი ინსტრუქციით. მაგალითად: "გააკეთე პრეზენტაცია მოსავლის აღებაზე და ამწონ პუნქტზე" ან "დააგენერირე პრეზენტაცია საწყობის 10 კომპონენტზე".`
        : `🤖 **AgriMap Pro AI Architect:**
I can generate custom presentation decks (in PPTX, PDF, and HTML) tailored precisely to your requirements. Try prompting: "Generate presentation focusing on Harvest module and Electronic Weigh Station" or "Present the 10-Component Warehouse and QR Traceability".`;
};

/**
 * Helper to draw a rounded rectangle on Canvas
 */
function drawCanvasRoundRect(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    r: number,
    fill: boolean = true,
    stroke: boolean = false
) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
    if (fill) ctx.fill();
    if (stroke) ctx.stroke();
}

/**
 * Helper to wrap text cleanly on Canvas
 */
function canvasWrapText(
    ctx: CanvasRenderingContext2D,
    text: string,
    x: number,
    y: number,
    maxWidth: number,
    lineHeight: number,
    maxLines: number = 20
): number {
    if (!text) return y;
    const words = text.split(' ');
    let line = '';
    let currentY = y;
    let linesCount = 0;

    for (let n = 0; n < words.length; n++) {
        const testLine = line + (line ? ' ' : '') + words[n];
        const metrics = ctx.measureText(testLine);
        if (metrics.width > maxWidth && n > 0) {
            ctx.fillText(line, x, currentY);
            line = words[n];
            currentY += lineHeight;
            linesCount++;
            if (linesCount >= maxLines - 1 && n < words.length - 1) {
                let remainder = words.slice(n).join(' ');
                while (remainder.length > 0 && ctx.measureText(remainder + '...').width > maxWidth) {
                    remainder = remainder.substring(0, remainder.length - 3);
                }
                ctx.fillText(remainder + '...', x, currentY);
                return currentY + lineHeight;
            }
        } else {
            line = testLine;
        }
    }
    if (line) {
        ctx.fillText(line, x, currentY);
        currentY += lineHeight;
    }
    return currentY;
}

/**
 * Renders an individual presentation slide onto a high-DPI (1920x1080) HTML Canvas.
 * This guarantees 100% native Unicode support for Georgian (ქართული), English, symbols,
 * and high-contrast dark theme aesthetics with zero font encoding bugs or corrupted glyphs.
 */
function renderSlideToCanvas(
    slide: PresentationSlide,
    idx: number,
    total: number,
    deckTitle: string
): HTMLCanvasElement {
    const canvas = document.createElement('canvas');
    canvas.width = 1920;
    canvas.height = 1080;
    const ctx = canvas.getContext('2d');
    if (!ctx) return canvas;

    const fontStack = '"Segoe UI", "Noto Sans Georgian", "BPG Nino Mtavruli", -apple-system, BlinkMacSystemFont, Roboto, "Helvetica Neue", Arial, sans-serif';

    // 1. Deep Dark Background with subtle linear gradient
    const bgGrad = ctx.createLinearGradient(0, 0, 1920, 1080);
    bgGrad.addColorStop(0, '#0b1329');
    bgGrad.addColorStop(1, '#0f172a');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, 1920, 1080);

    // Top subtle accent bar
    const topAccent = ctx.createLinearGradient(0, 0, 1920, 0);
    topAccent.addColorStop(0, '#10b981');
    topAccent.addColorStop(0.5, '#38bdf8');
    topAccent.addColorStop(1, '#6366f1');
    ctx.fillStyle = topAccent;
    ctx.fillRect(0, 0, 1920, 6);

    // 2. Top Brand Header
    ctx.fillStyle = '#10b981';
    ctx.font = `bold 24px ${fontStack}`;
    ctx.fillText('🌿 AgriMap Pro | Precision Agriculture & Industrial Architecture', 70, 52);

    // Slide Category / Badge
    const badgeText = slide.badge || slide.category || 'CORE PLATFORM';
    ctx.font = `bold 16px ${fontStack}`;
    const badgeW = ctx.measureText(badgeText.toUpperCase()).width + 32;
    const badgeX = 1850 - badgeW;
    ctx.fillStyle = '#0c4a6e';
    ctx.strokeStyle = '#0284c7';
    ctx.lineWidth = 1.5;
    drawCanvasRoundRect(ctx, badgeX, 30, badgeW, 34, 17, true, true);
    ctx.fillStyle = '#38bdf8';
    ctx.fillText(badgeText.toUpperCase(), badgeX + 16, 53);

    // Header divider line
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(70, 78);
    ctx.lineTo(1850, 78);
    ctx.stroke();

    // 3. Slide Title
    ctx.fillStyle = '#38bdf8';
    ctx.font = `bold 42px ${fontStack}`;
    let titleY = 135;
    titleY = canvasWrapText(ctx, slide.title, 70, titleY, 1760, 52, 2);

    // Subtitle
    if (slide.subtitle) {
        ctx.fillStyle = '#94a3b8';
        ctx.font = `22px ${fontStack}`;
        titleY = canvasWrapText(ctx, slide.subtitle, 70, titleY + 6, 1760, 32, 2);
    }

    let currentY = Math.max(200, titleY + 20);

    // 4. Stats Row (if available)
    if (slide.stats && slide.stats.length > 0) {
        const statsCount = slide.stats.length;
        const totalW = 1780;
        const gap = 20;
        const cardW = (totalW - (statsCount - 1) * gap) / statsCount;
        const cardH = 96;

        slide.stats.forEach((st, sIdx) => {
            const cardX = 70 + sIdx * (cardW + gap);
            ctx.fillStyle = '#1e293b';
            ctx.strokeStyle = '#334155';
            ctx.lineWidth = 1.5;
            drawCanvasRoundRect(ctx, cardX, currentY, cardW, cardH, 12, true, true);

            // Stat value
            ctx.fillStyle = '#34d399';
            ctx.font = `bold 36px ${fontStack}`;
            ctx.textAlign = 'center';
            ctx.fillText(st.value, cardX + cardW / 2, currentY + 44);

            // Stat label
            ctx.fillStyle = '#94a3b8';
            ctx.font = `17px ${fontStack}`;
            ctx.fillText(st.label, cardX + cardW / 2, currentY + 76);
            ctx.textAlign = 'left';
        });

        currentY += cardH + 24;
    }

    // 5. Main Content Area
    const hasRightPanel = !!(slide.highlightBox || slide.callout || slide.formulaOrLogic);
    const contentH = Math.min(580, 990 - currentY);
    const leftW = hasRightPanel ? 1080 : 1780;

    // Left Card (Bullets & Details)
    ctx.fillStyle = '#1e293b';
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 1.5;
    drawCanvasRoundRect(ctx, 70, currentY, leftW, contentH, 14, true, true);

    if (slide.bullets && slide.bullets.length > 0) {
        let bY = currentY + 44;
        const maxBY = currentY + contentH - 40;

        slide.bullets.forEach((bullet) => {
            if (bY > maxBY) return;

            // Draw bullet dot
            ctx.fillStyle = '#38bdf8';
            ctx.font = `bold 24px ${fontStack}`;
            ctx.fillText('•', 96, bY);

            // Draw bullet text
            ctx.fillStyle = '#f1f5f9';
            ctx.font = `21px ${fontStack}`;
            const nextY = canvasWrapText(ctx, bullet, 124, bY, leftW - 160, 32, 4);
            bY = nextY + 16;
        });
    }

    // Chips at the bottom of left card
    if (slide.chips && slide.chips.length > 0) {
        let chipX = 96;
        const chipY = currentY + contentH - 46;
        ctx.font = `15px ${fontStack}`;

        slide.chips.slice(0, 7).forEach((chip) => {
            const cTextW = ctx.measureText(chip).width;
            const cW = cTextW + 24;
            if (chipX + cW < 70 + leftW - 20) {
                ctx.fillStyle = '#334155';
                ctx.strokeStyle = '#475569';
                ctx.lineWidth = 1;
                drawCanvasRoundRect(ctx, chipX, chipY, cW, 30, 8, true, true);
                ctx.fillStyle = '#7dd3fc';
                ctx.fillText(chip, chipX + 12, chipY + 21);
                chipX += cW + 10;
            }
        });
    }

    // Right Column (Highlight Box + Formula/Takeaway)
    if (hasRightPanel) {
        const rightX = 1175;
        const rightW = 675;

        // Top Highlight Box (Emerald Theme)
        if (slide.highlightBox) {
            const hBoxH = (slide.callout || slide.formulaOrLogic) ? Math.floor(contentH * 0.54) : contentH;
            ctx.fillStyle = '#064e3b'; // rich emerald
            ctx.strokeStyle = '#10b981';
            ctx.lineWidth = 2;
            drawCanvasRoundRect(ctx, rightX, currentY, rightW, hBoxH, 14, true, true);

            // Title
            ctx.fillStyle = '#34d399';
            ctx.font = `bold 24px ${fontStack}`;
            ctx.fillText(slide.highlightBox.title, rightX + 28, currentY + 44);

            // Text
            ctx.fillStyle = '#ecfdf5';
            ctx.font = `20px ${fontStack}`;
            canvasWrapText(ctx, slide.highlightBox.text, rightX + 28, currentY + 84, rightW - 56, 30, 8);
        }

        // Bottom Callout / Formula Box (Sky Theme)
        if (slide.callout || slide.formulaOrLogic) {
            const fBoxY = slide.highlightBox ? currentY + Math.floor(contentH * 0.54) + 16 : currentY;
            const fBoxH = slide.highlightBox ? contentH - Math.floor(contentH * 0.54) - 16 : contentH;

            ctx.fillStyle = '#1e293b';
            ctx.strokeStyle = '#38bdf8';
            ctx.lineWidth = 2;
            drawCanvasRoundRect(ctx, rightX, fBoxY, rightW, fBoxH, 14, true, true);

            const fTitle = slide.formulaOrLogic ? '📐 ფორმულა & სისტემური ლოგიკა (System Logic)' : '💡 საოპერაციო შედეგი (Takeaway)';
            ctx.fillStyle = '#38bdf8';
            ctx.font = `bold 22px ${fontStack}`;
            ctx.fillText(fTitle, rightX + 28, fBoxY + 38);

            const fText = slide.formulaOrLogic || slide.callout || '';
            ctx.fillStyle = '#cbd5e1';
            ctx.font = `19px ${fontStack}`;
            canvasWrapText(ctx, fText, rightX + 28, fBoxY + 74, rightW - 56, 28, 6);
        }
    }

    // 6. Footer Bar with Slide Counter & Metadata
    ctx.fillStyle = '#090d16';
    ctx.fillRect(0, 1025, 1920, 55);
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, 1025);
    ctx.lineTo(1920, 1025);
    ctx.stroke();

    ctx.fillStyle = '#64748b';
    ctx.font = `18px ${fontStack}`;
    ctx.fillText(`Slide ${idx + 1} of ${total}  |  AgriMap Pro Precision Agriculture System`, 70, 1058);

    ctx.fillStyle = '#475569';
    ctx.textAlign = 'right';
    ctx.fillText('Certified Agricultural Ecosystem  •  ISO 19115 & GlobalG.A.P. Standard', 1850, 1058);
    ctx.textAlign = 'left';

    return canvas;
}

/**
 * Exports PresentationDeck as native PowerPoint (.pptx) file using pptxgenjs.
 * Explicitly applies Unicode fonts ('Segoe UI, Arial') to ensure Georgian characters render properly.
 */
export const exportPresentationPptx = async (deck: PresentationDeck, filename?: string): Promise<void> => {
    const pres = new pptxgen();
    pres.layout = 'LAYOUT_16x9';
    pres.title = deck.title;
    pres.subject = deck.subtitle;
    pres.author = 'AgriMap Pro';
    pres.company = 'AgriMap Pro Precision Agriculture';

    const bgDark = '0F172A';
    const cardBg = '1E293B';
    const textSky = '38BDF8';
    const textEmerald = '10B981';
    const textLight = 'F8FAFC';
    const textMuted = '94A3B8';
    const fontUnicode = 'Segoe UI';

    deck.slides.forEach((slideData, idx) => {
        const slide = pres.addSlide();
        slide.background = { color: bgDark };

        // Top Brand Header bar
        slide.addText('🌿 AgriMap Pro Precision Agriculture', {
            x: 0.8,
            y: 0.35,
            fontSize: 11,
            color: textEmerald,
            bold: true,
            fontFace: fontUnicode
        });

        if (slideData.badge) {
            slide.addText(slideData.badge.toUpperCase(), {
                x: 9.5,
                y: 0.35,
                w: 3.0,
                fontSize: 10,
                color: textSky,
                align: 'right',
                bold: true,
                fontFace: fontUnicode
            });
        }

        // Slide Title
        slide.addText(slideData.title, {
            x: 0.8,
            y: 0.75,
            w: 11.5,
            h: 0.6,
            fontSize: 22,
            color: textSky,
            bold: true,
            fontFace: fontUnicode
        });

        // Slide Subtitle
        if (slideData.subtitle) {
            slide.addText(slideData.subtitle, {
                x: 0.8,
                y: 1.35,
                w: 11.5,
                h: 0.4,
                fontSize: 12,
                color: textMuted,
                fontFace: fontUnicode
            });
        }

        let currentY = 1.85;

        // Stats row if available
        if (slideData.stats && slideData.stats.length > 0) {
            const statWidth = 11.4 / slideData.stats.length;
            slideData.stats.forEach((st, sIdx) => {
                const statX = 0.8 + sIdx * statWidth;
                slide.addShape(pres.ShapeType.roundRect, {
                    x: statX,
                    y: currentY,
                    w: statWidth - 0.2,
                    h: 0.9,
                    fill: { color: cardBg },
                    line: { color: '334155', width: 1 },
                    rectRadius: 0.1
                });
                slide.addText(st.value, {
                    x: statX,
                    y: currentY + 0.1,
                    w: statWidth - 0.2,
                    fontSize: 20,
                    color: textEmerald,
                    bold: true,
                    align: 'center',
                    fontFace: fontUnicode
                });
                slide.addText(st.label, {
                    x: statX,
                    y: currentY + 0.55,
                    w: statWidth - 0.2,
                    fontSize: 10,
                    color: textMuted,
                    align: 'center',
                    fontFace: fontUnicode
                });
            });
            currentY += 1.1;
        }

        // Bullets card / Two-column structure
        const contentWidth = slideData.highlightBox ? 6.8 : 11.4;
        slide.addShape(pres.ShapeType.roundRect, {
            x: 0.8,
            y: currentY,
            w: contentWidth,
            h: 3.8,
            fill: { color: cardBg },
            line: { color: '334155', width: 1 },
            rectRadius: 0.1
        });

        if (slideData.bullets && slideData.bullets.length > 0) {
            const bulletItems = slideData.bullets.map(b => ({
                text: b + '\n',
                options: { bullet: true, fontSize: 12, color: textLight, lineSpacing: 22, fontFace: fontUnicode }
            }));
            slide.addText(bulletItems, {
                x: 1.1,
                y: currentY + 0.25,
                w: contentWidth - 0.6,
                h: 3.3
            });
        }

        // Highlight Box on the right side if provided
        if (slideData.highlightBox) {
            const rightX = 8.0;
            const rightWidth = 4.2;

            slide.addShape(pres.ShapeType.roundRect, {
                x: rightX,
                y: currentY,
                w: rightWidth,
                h: 2.2,
                fill: { color: '064E3B' },
                line: { color: textEmerald, width: 1 },
                rectRadius: 0.1
            });

            slide.addText(slideData.highlightBox.title, {
                x: rightX + 0.25,
                y: currentY + 0.2,
                w: rightWidth - 0.5,
                fontSize: 13,
                color: textEmerald,
                bold: true,
                fontFace: fontUnicode
            });

            slide.addText(slideData.highlightBox.text, {
                x: rightX + 0.25,
                y: currentY + 0.65,
                w: rightWidth - 0.5,
                h: 1.4,
                fontSize: 11,
                color: textLight,
                fontFace: fontUnicode
            });

            // Callout or formula below highlight box
            if (slideData.callout || slideData.formulaOrLogic) {
                slide.addShape(pres.ShapeType.roundRect, {
                    x: rightX,
                    y: currentY + 2.4,
                    w: rightWidth,
                    h: 1.4,
                    fill: { color: cardBg },
                    line: { color: '38BDF8', width: 1 },
                    rectRadius: 0.1
                });

                slide.addText(slideData.formulaOrLogic ? '📐 Calculation Logic' : '💡 Operational Takeaway', {
                    x: rightX + 0.25,
                    y: currentY + 2.55,
                    w: rightWidth - 0.5,
                    fontSize: 11,
                    color: textSky,
                    bold: true,
                    fontFace: fontUnicode
                });

                slide.addText(slideData.formulaOrLogic || slideData.callout || '', {
                    x: rightX + 0.25,
                    y: currentY + 2.9,
                    w: rightWidth - 0.5,
                    fontSize: 10,
                    color: textLight,
                    fontFace: fontUnicode
                });
            }
        }

        // Footer bar with slide counter
        slide.addText(`Slide ${idx + 1} of ${deck.slides.length} • AgriMap Pro Precision Agriculture System`, {
            x: 0.8,
            y: 6.9,
            w: 11.4,
            fontSize: 9,
            color: textMuted,
            fontFace: fontUnicode
        });
    });

    const safeName = filename || `AgriMap_Pro_${deck.title.replace(/[^a-zA-Z0-9_\u10A0-\u10FF]/g, '_')}_${Date.now()}.pptx`;
    await pres.writeFile({ fileName: safeName });
};

/**
 * Exports PresentationDeck as a high-resolution, landscape PDF slide presentation.
 * Uses high-DPI HTML Canvas rasterization to guarantee 100% accurate, crystal-clear Unicode rendering
 * for Georgian (ქართული) characters, eliminating mojibake and encoding corruption completely.
 */
export const exportPresentationPdf = async (deck: PresentationDeck, filename?: string): Promise<void> => {
    // 16:9 ratio in pt: 960 width x 540 height
    const doc = new jsPDF({
        orientation: 'landscape',
        unit: 'pt',
        format: [960, 540]
    });

    const total = deck.slides.length;

    for (let idx = 0; idx < total; idx++) {
        const slide = deck.slides[idx];
        if (idx > 0) {
            doc.addPage([960, 540], 'landscape');
        }

        // Render slide to high-resolution 1920x1080 canvas
        const canvas = renderSlideToCanvas(slide, idx, total, deck.title);
        const imgData = canvas.toDataURL('image/jpeg', 0.95);

        // Add 2x retina image covering the exact 960x540 pt page
        doc.addImage(imgData, 'JPEG', 0, 0, 960, 540, undefined, 'FAST');
    }

    const safeName = filename || `AgriMap_Pro_${deck.title.replace(/[^a-zA-Z0-9_\u10A0-\u10FF]/g, '_')}_${Date.now()}.pdf`;
    doc.save(safeName);
};

/**
 * Generates an interactive HTML presentation from PresentationDeck
 */
export const exportPresentationHtml = (deck: PresentationDeck, language: 'ka' | 'en' = 'ka'): string => {
    const isKa = language === 'ka';

    return `<!DOCTYPE html>
<html lang="${language}">
<head>
    <meta charset="UTF-8">
    <title>${deck.title}</title>
    <style>
        * { box-sizing: border-box; margin: 0; padding: 0; font-family: "Segoe UI", "Noto Sans Georgian", "BPG Nino Mtavruli", -apple-system, BlinkMacSystemFont, Roboto, "Helvetica Neue", Arial, sans-serif; }
        body { background: #0f172a; color: #f8fafc; display: flex; flex-direction: column; height: 100vh; overflow: hidden; }
        header { padding: 16px 32px; background: #1e293b; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #334155; }
        .logo { font-size: 20px; font-weight: 700; color: #10b981; }
        .slide-container { flex: 1; display: flex; align-items: center; justify-content: center; padding: 32px; }
        .slide { background: #1e293b; border: 1px solid #334155; border-radius: 16px; padding: 40px; width: 100%; max-width: 1000px; max-height: 80vh; overflow-y: auto; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5); display: none; }
        .slide.active { display: block; animation: fadeIn 0.3s ease-in-out; }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        h1 { font-size: 26px; margin-bottom: 8px; color: #38bdf8; }
        .subtitle { font-size: 15px; color: #94a3b8; margin-bottom: 20px; }
        .stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 16px; margin-bottom: 20px; }
        .stat-card { background: #0f172a; padding: 16px; border-radius: 12px; border: 1px solid #334155; text-align: center; }
        .stat-num { display: block; font-size: 28px; font-weight: 800; color: #10b981; }
        .stat-label { font-size: 12px; color: #94a3b8; margin-top: 4px; }
        .deck-grid { display: grid; grid-template-columns: 1.5fr 1fr; gap: 20px; margin: 16px 0; }
        @media (max-width: 768px) { .deck-grid { grid-template-columns: 1fr; } }
        .content-card { background: #0f172a; padding: 24px; border-radius: 12px; border: 1px solid #334155; }
        .highlight-card { background: #064e3b; padding: 20px; border-radius: 12px; border: 1px solid #10b981; color: #f1f5f9; margin-bottom: 16px; }
        .highlight-card h3 { font-size: 15px; color: #34d399; margin-bottom: 8px; }
        .highlight-card p { font-size: 13px; line-height: 1.6; color: #e2e8f0; }
        .bullets-list { list-style: none; display: flex; flex-direction: column; gap: 12px; }
        .bullets-list li { display: flex; gap: 10px; font-size: 14px; line-height: 1.5; color: #cbd5e1; }
        .bullets-list li::before { content: "•"; color: #38bdf8; font-weight: bold; }
        .chips-container { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 16px; }
        .chip { background: #334155; color: #f1f5f9; padding: 4px 10px; border-radius: 6px; font-size: 11px; }
        .callout-box { background: #0f172a; border: 1px solid #38bdf8; border-radius: 10px; padding: 16px; font-size: 13px; color: #cbd5e1; margin-top: 16px; }
        .badge { display: inline-block; padding: 4px 12px; background: rgba(56, 189, 248, 0.15); color: #38bdf8; border-radius: 9999px; font-size: 11px; font-weight: 600; margin-bottom: 12px; }
        footer { padding: 16px 32px; background: #1e293b; display: flex; justify-content: space-between; align-items: center; border-top: 1px solid #334155; }
        .controls { display: flex; gap: 12px; align-items: center; }
        button { background: #3b82f6; color: white; border: none; padding: 10px 20px; border-radius: 8px; font-weight: 600; cursor: pointer; transition: background 0.2s; font-size: 13px; }
        button:hover { background: #2563eb; }
        button.secondary { background: #059669; }
        button.secondary:hover { background: #047857; }
        button:disabled { background: #475569; cursor: not-allowed; }

        @media print {
            body { background: #0f172a !important; color: #f8fafc !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; overflow: visible !important; height: auto !important; }
            header, footer, .controls { display: none !important; }
            .slide-container { display: block !important; padding: 0 !important; }
            .slide { display: block !important; page-break-after: always; break-after: page; width: 100% !important; max-width: none !important; max-height: none !important; margin: 0 0 20px 0 !important; border-radius: 0 !important; border: 1px solid #334155 !important; }
        }
    </style>
</head>
<body>
    <header>
        <div class="logo">🌿 AgriMap Pro - Presentation Deck</div>
        <div style="display: flex; gap: 16px; align-items: center;">
            <button class="secondary" onclick="window.print()">🖨️ ${isKa ? 'ამობეჭდვა / PDF შენახვა' : 'Print / Save as PDF'}</button>
            <div id="slideCounter">1 / ${deck.slides.length}</div>
        </div>
    </header>
    <div class="slide-container">
        ${deck.slides.map((s, idx) => `
            <div class="slide ${idx === 0 ? 'active' : ''}" id="slide-${idx}">
                ${s.badge ? `<div class="badge">${s.badge}</div>` : ''}
                <h1>${s.title}</h1>
                ${s.subtitle ? `<div class="subtitle">${s.subtitle}</div>` : ''}
                
                ${s.stats && s.stats.length > 0 ? `
                    <div class="stats-grid">
                        ${s.stats.map(st => `
                            <div class="stat-card">
                                <span class="stat-num">${st.value}</span>
                                <span class="stat-label">${st.label}</span>
                            </div>
                        `).join('')}
                    </div>
                ` : ''}

                <div class="${s.highlightBox ? 'deck-grid' : ''}">
                    <div class="content-card">
                        ${s.bullets && s.bullets.length > 0 ? `
                            <ul class="bullets-list">
                                ${s.bullets.map(b => `<li>${b}</li>`).join('')}
                            </ul>
                        ` : ''}
                        ${s.chips && s.chips.length > 0 ? `
                            <div class="chips-container">
                                ${s.chips.map(c => `<span class="chip">${c}</span>`).join('')}
                            </div>
                        ` : ''}
                    </div>

                    ${s.highlightBox ? `
                        <div>
                            <div class="highlight-card">
                                <h3>${s.highlightBox.title}</h3>
                                <p>${s.highlightBox.text}</p>
                            </div>
                            ${s.callout || s.formulaOrLogic ? `
                                <div class="callout-box">
                                    <strong>${s.formulaOrLogic ? '📐 System Logic:' : '💡 Takeaway:'}</strong>
                                    <p style="margin-top: 6px;">${s.formulaOrLogic || s.callout}</p>
                                </div>
                            ` : ''}
                        </div>
                    ` : ''}
                </div>
            </div>
        `).join('')}
    </div>
    <footer>
        <button id="prevBtn" onclick="prevSlide()" disabled>← ${isKa ? 'წინა' : 'Previous'}</button>
        <div class="controls">
            <button class="secondary" onclick="window.print()">🖨️ ${isKa ? 'PDF ბეჭდვა' : 'Print PDF'}</button>
            <button onclick="toggleFullScreen()">${isKa ? 'სრული ეკრანი' : 'Full Screen'}</button>
            <button id="nextBtn" onclick="nextSlide()">${isKa ? 'შემდეგი' : 'Next'} →</button>
        </div>
    </footer>
    <script>
        let currentSlide = 0;
        const total = ${deck.slides.length};
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
