import type { AppMode } from '../types';

export interface ModuleConnection {
    id: string;
    fromModuleId: string;
    toModuleId: string;
    labelEn: string;
    labelKa: string;
    type: 'data' | 'stock_deduction' | 'payroll_labor' | 'spatial_gis' | 'ai_telemetry';
    strength: number;
    enabled: boolean;
}

export interface ModuleComponentItem {
    id: string;
    folderId: string;
    nameEn: string;
    nameKa: string;
    shortDescEn: string;
    shortDescKa: string;
    fullDocEn: string;
    fullDocKa: string;
    technicalSpecsEn?: string[];
    technicalSpecsKa?: string[];
    inputsEn?: string[];
    inputsKa?: string[];
    outputsEn?: string[];
    outputsKa?: string[];
    formulaOrLogicEn?: string;
    formulaOrLogicKa?: string;
    hardwareBridgeEn?: string;
    hardwareBridgeKa?: string;
    isUniqueInWorld?: boolean;
    isCustom?: boolean;
    createdAt?: string;
}

export interface ModuleFolder {
    id: string;
    nameEn: string;
    nameKa: string;
    iconName: string;
    descriptionEn: string;
    descriptionKa: string;
    components: ModuleComponentItem[];
    isCustom?: boolean;
}

export interface ModuleSubOption {
    id: string;
    titleEn: string;
    titleKa: string;
    descriptionEn: string;
    descriptionKa: string;
    badge?: string;
    isUniqueInWorld?: boolean;
}

export interface PlatformModuleDefinition {
    id: string;
    appMode: AppMode | 'planner' | 'map_planner' | 'tasks_work' | 'tools' | 'help' | 'labs' | 'logs' | 'founders' | 'admin' | 'other_custom';
    nameEn: string;
    nameKa: string;
    shortDescEn: string;
    shortDescKa: string;
    iconName: string;
    color: string;
    category: 'Core & Dashboard' | 'Field & Agronomy' | 'Supply & Warehouse' | 'Finance & Trade' | 'Intelligence & AI' | 'Governance & System' | 'Custom & Extensions';
    fullDescriptionEn: string;
    fullDescriptionKa: string;
    subOptions: ModuleSubOption[];
    folders: ModuleFolder[];
    profitabilityEn: string;
    profitabilityKa: string;
    worldFirstAdvantageEn: string;
    worldFirstAdvantageKa: string;
    recommendedFutureUpgradesEn: string[];
    recommendedFutureUpgradesKa: string[];
    missedGapsEn: string[];
    missedGapsKa: string[];
    defaultPosition: { x: number; y: number };
    isCustom?: boolean;
}

export const ALL_17_CORE_MODULES: PlatformModuleDefinition[] = [
    // 1. Dashboard
    {
        id: 'dashboard',
        appMode: 'dashboard',
        nameEn: '1. Dashboard',
        nameKa: '1. მთავარი პანელი (Dashboard)',
        shortDescEn: 'Central executive cockpit, real-time field telemetry, anomaly discovery stream & microclimate radar.',
        shortDescKa: 'ცენტრალური მართვის პანელი, საველე ტელემეტრია რეალურ დროში, AI ანომალიების ნაკადი და მეტეო სადგური.',
        iconName: 'LayoutDashboard',
        color: 'from-emerald-600 to-teal-700',
        category: 'Core & Dashboard',
        fullDescriptionEn: 'The real-time operational cockpit providing high-level oversight of ongoing field operations, stock depletion, weather telemetry, cold storage levels, and continuous AI anomaly alerts.',
        fullDescriptionKa: 'ფერმის ცენტრალური მართვის ცენტრი, რომელიც აერთიანებს საველე სამუშაოების სტატუსს, საწყობის მარაგების კლებას, მეტეო-ტელემეტრიას, მაცივრის ტონაჟს და AI ანომალიების მუდმივ მონიტორინგს.',
        subOptions: [
            { id: 'opt_dash_stream', titleEn: 'Autonomous AI Anomaly Stream', titleKa: 'ავტონომიური AI ანომალიების ნაკადი', descriptionEn: 'Background scanner detecting inventory surges, chemical over-application, and labor skews.', descriptionKa: 'ფონური AI სკანერი მარაგების გადახარჯვისა და დისბალანსის გამოსავლენად.' },
            { id: 'opt_dash_weather', titleEn: 'Hyperlocal Microclimate Radar', titleKa: 'მიკროკლიმატი & მეტეო სადგური', descriptionEn: 'Live temperature, precipitation, humidity, UV index, and soil frost warning triggers.', descriptionKa: 'ჰაერის ტემპერატურა, ნალექი, ტენიანობა და წაყინვის საშიშროება.' }
        ],
        folders: [
            {
                id: 'dash_components',
                nameEn: 'Dashboard Components',
                nameKa: 'დაშბორდის კომპონენტები',
                iconName: 'LayoutDashboard',
                descriptionEn: 'Core operational widgets and visual telemetry.',
                descriptionKa: 'ძირითადი ვიჯეტები და ვიზუალური ტელემეტრია.',
                components: [
                    {
                        id: 'comp_dash_live_pulse',
                        folderId: 'dash_components',
                        nameEn: 'Operational Pulse & Live GPS Radar',
                        nameKa: 'ოპერაციული პულსი & ცოცხალი GPS რადარი',
                        shortDescEn: 'Live map telemetry streaming worker field positions and active tractor routes.',
                        shortDescKa: 'მუშებისა და ტექნიკის გადაადგილების რუკა რეალურ დროში.',
                        fullDocEn: 'Aggregates GPS pings from worker smartphones and IoT tractor beacons onto the spatial parcel layer.',
                        fullDocKa: 'აგროვებს GPS სიგნალებს მუშების სმარტფონებიდან და ტრაქტორებიდან რუკაზე საჩვენებლად.',
                        isUniqueInWorld: true
                    },
                    {
                        id: 'comp_dash_anomaly_feed',
                        folderId: 'dash_components',
                        nameEn: 'AI Anomaly Discovery & Alert Stream',
                        nameKa: 'AI ანომალიების დეტექტორი & შეტყობინებები',
                        shortDescEn: 'Real-time alert banner for chemical over-dosage, delayed tasks, and stockouts.',
                        shortDescKa: 'მყისიერი შეტყობინებები დოზის გადაჭარბებაზე, დაგვიანებულ სამუშაოებსა და დეფიციტზე.',
                        fullDocEn: 'Processes cross-module signals to display high-priority operational risks immediately.',
                        fullDocKa: 'აანალიზებს მოდულების სიგნალებს და გამოაქვს კრიტიკული რისკები.'
                    },
                    {
                        id: 'comp_dash_kpi_metrics',
                        folderId: 'dash_components',
                        nameEn: 'Executive Harvest & Financial KPIs',
                        nameKa: 'მოსავლის & ფინანსური KPI ინდიკატორები',
                        shortDescEn: 'Daily net tonnage, cost per kg trend, and active workforce count.',
                        shortDescKa: 'დღიური ტონაჟი, თვითღირებულების ტრენდი და აქტიური მუშახელის რაოდენობა.',
                        fullDocEn: 'Aggregates live weigh-in receipts and task logs into instant executive summaries.',
                        fullDocKa: 'სასწორის ქვითრებისა და სამუშაოების მონაცემების შეჯამება ერთიან ჭრილში.'
                    }
                ]
            }
        ],
        profitabilityEn: 'Delivers immediate situational awareness, preventing costly field mistakes and eliminating 2-3 hours of daily manual status meetings.',
        profitabilityKa: 'იძლევა მყისიერ ხედვას ფერმის ყველა პროცესზე, რაც ზოგავს ყოველდღიურად 2-3 საათს და თავიდან აგაცილებთ დაგვიანებულ გადაწყვეტილებებს.',
        worldFirstAdvantageEn: 'Integrates real-time anomaly discovery stream with physical Bluetooth harvest scales and automated inventory deduction pipelines.',
        worldFirstAdvantageKa: 'ცოცხალი AI ანომალიების ნაკადის პირდაპირი კავშირი სასწორებთან, სასუქის ჩამოწერებთან და საველე GPS-თან.',
        recommendedFutureUpgradesEn: ['Predictive 7-day harvest volume forecasting based on cumulative heat units (GDD).', 'Voice-command natural language assistant for hands-free dashboard queries in the field.'],
        recommendedFutureUpgradesKa: ['7-დღიანი მოსავლის პროგნოზირება მზის სითბოს დაგროვების ინდექსის (GDD) მიხედვით.', 'ხმოვანი ბრძანებებით მართვა ტრაქტორში ან მინდორში ყოფნისას.'],
        missedGapsEn: ['Push notifications directly to smartwatches for high-severity frost alerts.'],
        missedGapsKa: ['Smartwatch შეტყობინებები წაყინვისა და კრიტიკული ანომალიების დროს.'],
        defaultPosition: { x: 80, y: 100 }
    },

    // 2. Planner
    {
        id: 'planner',
        appMode: 'tasks',
        nameEn: '2. Planner & Reminders',
        nameKa: '2. დამგეგმავი & კალენდარი (Planner)',
        shortDescEn: 'Seasonal crop calendars, spray schedule reminders, irrigation timings & brigade shift planner.',
        shortDescKa: 'სეზონური სამუშაოების კალენდარი, წამლობის შეხსენებები, რწყვის განრიგი და ცვლების დაგეგმვა.',
        iconName: 'Calendar',
        color: 'from-blue-600 to-indigo-700',
        category: 'Core & Dashboard',
        fullDescriptionEn: 'Full agro-calendar engine for scheduling seasonal operations, automated reminder triggers for agronomists and brigade leads, and synchronizing crop phenology with labor requirements.',
        fullDescriptionKa: 'სრული აგრო-დამგეგმავი: სეზონური სამუშაოების კალენდარი, ავტომატური შეხსენებები აგრონომებისა და ბრიგადირებისთვის და სამუშაოების განაწილება ფაზების მიხედვით.',
        subOptions: [
            { id: 'opt_plan_calendar', titleEn: 'Agro Phenology Master Calendar', titleKa: 'აგრო-ფენოლოგიური კალენდარი', descriptionEn: 'Timeline of upcoming pruning, spraying, fertigation, and harvest dates.', descriptionKa: 'სხვლის, წამლობის, კვებისა და რთველის ვადების კალენდარი.' },
            { id: 'opt_plan_reminders', titleEn: 'Smart Operational Reminders', titleKa: 'ჭკვიანი შეხსენებები', descriptionEn: 'Automated push/SMS notifications before safe re-entry periods and spray intervals.', descriptionKa: 'ავტომატური შეტყობინებები წამლობისა და უსაფრთხოების ვადების შესახებ.' }
        ],
        folders: [
            {
                id: 'planner_components',
                nameEn: 'Planner Components',
                nameKa: 'დამგეგმავის კომპონენტები',
                iconName: 'Calendar',
                descriptionEn: 'Agro-timeline, task queues, and team shift plans.',
                descriptionKa: 'აგრო-განრიგი, დავალებების რიგი და ცვლების გეგმა.',
                components: [
                    {
                        id: 'comp_plan_crop_timeline',
                        folderId: 'planner_components',
                        nameEn: 'Crop Cycle Phenology Timeline',
                        nameKa: 'კულტურის ციკლის ფენოლოგიური განრიგი',
                        shortDescEn: 'Visual Gantt chart of vegetative, flowering, fruit development, and harvest stages.',
                        shortDescKa: 'ყვავილობის, ნაყოფის ზრდისა და რთველის ფაზების განრიგი.',
                        fullDocEn: 'Maps each crop block to target phenological windows and required agro-interventions.',
                        fullDocKa: 'თითოეულ ბლოკს უსაბამებს საჭირო აგრონომიულ სამუშაოებს ფაზების მიხედვით.'
                    },
                    {
                        id: 'comp_plan_auto_reminders',
                        folderId: 'planner_components',
                        nameEn: 'Automated Agronomic Reminder Bot',
                        nameKa: 'ავტომატური შეხსენებების ბოტი',
                        shortDescEn: 'Triggers alerts for upcoming fertigation mixes and equipment preventative maintenance.',
                        shortDescKa: 'აფრთხილებს მორიგ კვებაზე და ტექნიკის სერვისის მოახლოებაზე.',
                        fullDocEn: 'Scans planned tasks and alerts managers 24 hours prior to required resource mobilization.',
                        fullDocKa: 'ამოწმებს დაგეგმილ სამუშაოებს და 24 საათით ადრე აფრთხილებს პასუხისმგებელ პირებს.'
                    }
                ]
            }
        ],
        profitabilityEn: 'Eliminates missed spray windows and harvest delays, increasing overall crop marketable grade by 12%.',
        profitabilityKa: 'გამორიცხავს წამლობის ვადების გაცდენას და მოსავლის დაგვიანებას, რაც ზრდის I ხარისხის მოსავლის წილს 12%-ით.',
        worldFirstAdvantageEn: 'Planner directly converts scheduled calendar events into zero-click warehouse stock requisitions.',
        worldFirstAdvantageKa: 'დაგეგმილი კალენდარული სამუშაოები ავტომატურად ქმნის საწყობის მასალების მოთხოვნას.',
        recommendedFutureUpgradesEn: ['AI-driven auto-rescheduling when weather radar predicts heavy rainfall.'],
        recommendedFutureUpgradesKa: ['წვიმის პროგნოზის დროს სამუშაოების ავტომატური გადატანა AI-ს მიერ.'],
        missedGapsEn: ['Google Calendar & Outlook bidirectional synchronization.'],
        missedGapsKa: ['Google Calendar-თან და Outlook-თან ორმხრივი სინქრონიზაცია.'],
        defaultPosition: { x: 300, y: 100 }
    },

    // 3. Map Planner
    {
        id: 'map_planner',
        appMode: 'design',
        nameEn: '3. Map Planner & GIS Cadastre',
        nameKa: '3. რუკა-დამგეგმავი & საკადასტრო GIS',
        shortDescEn: 'Sub-meter vector GIS, block partitioning, row spacing, rootstock mapping & topography modeling.',
        shortDescKa: 'სუბ-მეტრული ვექტორული GIS, ბლოკების ზონირება, რიგების დაშორება და ტოპოგრაფიული მოდელირება.',
        iconName: 'Map',
        color: 'from-blue-600 to-cyan-700',
        category: 'Field & Agronomy',
        fullDescriptionEn: 'Full-featured spatial agricultural GIS engine for surveying parcel boundaries, planning orchard block micro-zones, calculating planting densities, tracking elevation/slope gradients, and mapping physical farm infrastructure.',
        fullDescriptionKa: 'სრულფასოვანი გეოსაინფორმაციო (GIS) სისტემა მიწის ნაკვეთების აზომვისთვის, ბლოკების მიკრო-ზონირებისთვის, ნერგების რაოდენობისა და სიმჭიდროვის გაანგარიშებისთვის და ტოპოგრაფიული ანალიზისთვის.',
        subOptions: [
            { id: 'opt_gis_vector', titleEn: 'Cadastral Polygon Drawing & GeoJSON / KML Import', titleKa: 'საკადასტრო პოლიგონები & GeoJSON/KML იმპორტი', descriptionEn: 'Draw exact field boundaries with area calculation (hectares/sqm) and spatial imports.', descriptionKa: 'ზუსტი საზღვრების მოხაზვა ფართობის ავტომატური დათვლით და საკადასტრო ფაილების იმპორტი.' },
            { id: 'opt_gis_microzoning', titleEn: 'Micro-Zoning & Crop Variety Planting Densities', titleKa: 'მიკრო-ზონირება & ჯიშების დარგვის სიმჭიდროვე', descriptionEn: 'Map individual rows, tree spacing (e.g. 3m x 1m), rootstock varieties, and planting dates.', descriptionKa: 'რიგების დაშორება (მაგ. 3მ x 1მ), ჯიშები, საძირეები, დარგვის წლები და სექტორები.' }
        ],
        folders: [
            {
                id: 'map_planner_components',
                nameEn: 'Map Planner Components',
                nameKa: 'რუკა-დამგეგმავის კომპონენტები',
                iconName: 'Map',
                descriptionEn: 'Spatial vector layers, cadastre polygons, and zoning tools.',
                descriptionKa: 'სივრცითი ფენები, საკადასტრო პოლიგონები და ზონირება.',
                components: [
                    {
                        id: 'comp_gis_subblocks',
                        folderId: 'map_planner_components',
                        nameEn: 'Block Micro-Zoning & Crop Varietal Segments',
                        nameKa: 'ბლოკების მიკრო-ზონირება & ჯიშების სეგმენტაცია',
                        shortDescEn: 'Splits cadastral parcels into precise varietal sectors with calculated plant counts.',
                        shortDescKa: 'ნაკვეთის დაყოფა ჯიშურ სექტორებად ნერგების ზუსტი რაოდენობით.',
                        fullDocEn: 'Calculates the exact number of seedlings per hectare based on between-row and within-row spacing geometry.',
                        fullDocKa: 'ითვლის ნერგების რაოდენობას რიგთაშორისისა და ნერგთაშორისის დაშორების გეომეტრიით.',
                        isUniqueInWorld: true
                    },
                    {
                        id: 'comp_gis_drip_lines',
                        folderId: 'map_planner_components',
                        nameEn: 'Drip Irrigation Infrastructure Mapping',
                        nameKa: 'წვეთოვანი სარწყავი ქსელის რუკა',
                        shortDescEn: 'Vector mapping of mainline pipes, valves, emitter spacings, and zone meters.',
                        shortDescKa: 'ცენტრალური მილების, ონკანებისა და საწვეთურების რუკა.',
                        fullDocEn: 'Calculates water flow and pressure distribution across field elevation contours.',
                        fullDocKa: 'ითვლის წყლის წნევასა და ხარჯს რელიეფის სიმაღლეების მიხედვით.'
                    }
                ]
            }
        ],
        profitabilityEn: 'Optimizes land utilization efficiency by 12–18% and prevents costly errors during trenching, trellising, and seedling planting.',
        profitabilityKa: 'ზრდის მიწის გამოყენების ეფექტურობას 12-18%-ით და გამორიცხავს შეცდომებს ნერგების შეძენასა და შპალერის მონტაჟში.',
        worldFirstAdvantageEn: 'Combines offline vector GIS topology with per-plant yield heatmaps generated from Bluetooth harvest intake scales.',
        worldFirstAdvantageKa: 'სრულად ოფლაინ ვექტორული რუკა, რომელიც პირდაპირ კავშირშია ელექტრონული სასწორიდან მიღებულ მოსავლიანობის სითბურ რუკასთან (Heatmap).',
        recommendedFutureUpgradesEn: ['Automated elevation contour generation via satellite DEM for drainage runoff planning.', 'Multispectral Drone NDVI orthomosaic layer overlay.'],
        recommendedFutureUpgradesKa: ['რელიეფის სიმაღლეთა ჰორიზონტალების ავტომატური გენერირება წყლის დრენაჟისთვის (DEM).', 'დრონის NDVI მულტისპექტრული ორთოფოტოს დადება მცენარის ვეგეტაციისთვის.'],
        missedGapsEn: ['CAD DXF / DWG direct export for engineering blueprints and irrigation contractor handoffs.'],
        missedGapsKa: ['CAD DXF / DWG ექსპორტი სარწყავი სისტემების ინჟინრებისთვის.'],
        defaultPosition: { x: 520, y: 100 }
    },

    // 4. Agronomy
    {
        id: 'agronomy',
        appMode: 'agronomy',
        nameEn: '4. Agronomy & Crop Science',
        nameKa: '4. აგრონომია & კულტურის მეცნიერება',
        shortDescEn: 'Phenological stages, nutritional recipes, spray protocols, soil lab chemistry & over-application guards.',
        shortDescKa: 'ფენოლოგიური ფაზები, კვების რეცეპტები, შეწამვლის პროტოკოლები, ნიადაგის ანალიზი და დოზირების კონტროლი.',
        iconName: 'FlaskConical',
        color: 'from-lime-600 to-green-700',
        category: 'Field & Agronomy',
        fullDescriptionEn: 'The core crop science and plant physiology engine. Powers automated nutritional recipes (N-P-K & micronutrients), fertigation dosing, chemical spray intervals (PHI / REI), disease diagnosis, and soil chemistry optimization.',
        fullDescriptionKa: 'აგრონომიული მეცნიერების ცენტრი: მართავს კვების რეცეპტებს (N-P-K, მიკროელემენტები), ფერტიგაციას, წამლობის გეგმებს (ლოდინის პერიოდები PHI/REI), დაავადებების იდენტიფიცირებას და ნიადაგის ლაბორატორიულ ანალიზს.',
        subOptions: [
            { id: 'opt_agro_recipes', titleEn: 'Nutritional Fertigation Recipes by Phenological Stage', titleKa: 'კვების რეცეპტები ფენოლოგიური ფაზების მიხედვით', descriptionEn: 'Targeted nutrient balance formulations (Bud Break, Flowering, Fruit Set, Ripening) with kg/ha dosing.', descriptionKa: 'სასუქების ზუსტი ბალანსი ფაზების მიხედვით ჰექტარზე დოზირებით.' },
            { id: 'opt_agro_spray_logs', titleEn: 'Crop Protection, PHI / REI & Active Ingredients', titleKa: 'მცენარეთა დაცვა, ლოდინის ვადები (PHI/REI)', descriptionEn: 'Pesticide & fungicide spray logs tracking active ingredients, pre-harvest safe intervals, and residue limits.', descriptionKa: 'ფუნგიციდებისა და ინსექტიციდების წამლობის ჟურნალი ლოდინის ვადების (PHI) მკაცრი კონტროლით.' }
        ],
        folders: [
            {
                id: 'agronomy_components',
                nameEn: 'Agronomy Components',
                nameKa: 'აგრონომიის კომპონენტები',
                iconName: 'FlaskConical',
                descriptionEn: 'Fertigation recipes, tank calculators, and crop protection logs.',
                descriptionKa: 'კვების რეცეპტები, ავზების კალკულატორი და წამლობის ჟურნალი.',
                components: [
                    {
                        id: 'comp_agro_tank_calc',
                        folderId: 'agronomy_components',
                        nameEn: 'Automated Multi-Tank Dosing Engine',
                        nameKa: 'მრავალავზიანი დოზირების ავტომატური კალკულატორი',
                        shortDescEn: 'Calculates exact grams per cubic meter of water and triggers stock deduction.',
                        shortDescKa: 'ითვლის გრამებს წყლის კუბურ მეტრზე და ავტომატურად ჩამოწერს საწყობს.',
                        fullDocEn: 'Formulates EC, pH, and nutrient dilution curves based on crop stage and soil salinity.',
                        fullDocKa: 'ითვლის EC, pH და წყალში ხსნადობის მრუდებს კულტურის ფაზის მიხედვით.',
                        isUniqueInWorld: true
                    },
                    {
                        id: 'comp_agro_spray_phi',
                        folderId: 'agronomy_components',
                        nameEn: 'Pre-Harvest Interval (PHI) Lock Engine',
                        nameKa: 'ლოდინის პერიოდის (PHI) საკეტი & კონტროლი',
                        shortDescEn: 'Locks parcel harvest authorization until chemical degradation intervals lapse.',
                        shortDescKa: 'ბლოკავს მოსავლის აღებას, სანამ წამლის ლოდინის ვადა არ გავა.',
                        fullDocEn: 'Cross-checks chemical application timestamp against harvest schedule to ensure zero pesticide residue export compliance.',
                        fullDocKa: 'ადარებს წამლობის დროს რთველის თარიღს და უზრუნველყოფს უსაფრთხო მოსავლის აღებას.',
                        isUniqueInWorld: true
                    }
                ]
            }
        ],
        profitabilityEn: 'Reduces agrochemical and fertilizer spend by 20–35% while maximizing crop market grade (Grade A yield ratio).',
        profitabilityKa: 'ზოგავს სასუქებისა და პესტიციდების ხარჯს 20-35%-ით და ზრდის უმაღლესი კატეგორიის (Grade A) მოსავლის წილს.',
        worldFirstAdvantageEn: 'Direct integration between agronomist fertigation recipes and automatic warehouse stock deduction without human intervention.',
        worldFirstAdvantageKa: 'აგრონომის რეცეპტის ავტომატური კავშირი საწყობის ჩამოწერასთან ყოველგვარი ხელით შეყვანის გარეშე.',
        recommendedFutureUpgradesEn: ['IoT LoRaWAN Soil Moisture & EC probe telemetry integration for automated pulse fertigation.', 'Computer vision leaf disease diagnosis using on-device Gemini vision models.'],
        recommendedFutureUpgradesKa: ['IoT LoRaWAN ნიადაგის ტენიანობის სენსორების ინტეგრაცია ავტომატური წვეთოვანი რწყვის ჩასართავად.', 'ფოთლის დაავადების მომენტალური დიაგნოსტიკა სმარტფონის კამერით (Gemini Vision).'],
        missedGapsEn: ['EU / GlobalG.A.P. compliant official chemical spray certificate one-click PDF export.'],
        missedGapsKa: ['GlobalG.A.P. სტანდარტის შესაბამისი ოფიციალური წამლობის სერტიფიკატის 1-კლიკით ექსპორტი.'],
        defaultPosition: { x: 740, y: 100 }
    },

    // 5. Harvest
    {
        id: 'harvest',
        appMode: 'harvesting',
        nameEn: '5. Harvest & Scale Integration',
        nameKa: '5. მოსავლის აღება & ამწონი პუნქტი',
        shortDescEn: 'Bluetooth scale intake, auto tare deduction, QR batch printing, picker credit & cold storage cells.',
        shortDescKa: 'Bluetooth სასწორი, ტარის ავტო-გამოკლება, QR ბეიჯები, მკრეფავის დარიცხვა და სამაცივრე უჯრედები.',
        iconName: 'Scale',
        color: 'from-indigo-700 to-purple-800',
        category: 'Supply & Warehouse',
        fullDescriptionEn: 'The industrial harvest intake and cold chain management system. Connects directly to electronic scales via Bluetooth / RS232 / USB, automatically subtracts crate tare weight, logs net kilograms to pickers, prints QR traceability batch labels, and manages cold storage cell placement.',
        fullDescriptionKa: 'მოსავლის მიღებისა და სამაცივრე მეურნეობის ცენტრი: უერთდება ელექტრონულ სასწორებს (Bluetooth/USB), ავტომატურად აკლებს ყუთის ტარას, ურიცხავს კილოგრამებს მკრეფავს, ბეჭდავს QR ლოტებს და ანაწილებს მოსავალს სამაცივრე კამერებში.',
        subOptions: [
            { id: 'opt_harvest_scale', titleEn: 'Bluetooth / Serial Industrial Scale Hardware Bridge', titleKa: 'Bluetooth / Serial სასწორის პირდაპირი კავშირი', descriptionEn: 'Captures gross weights directly from physical scales into the cloud ledger without manual entry.', descriptionKa: 'წონის ავტომატური წაკითხვა სასწორიდან ყოველგვარი ხელით შეცდომებისა და მანიპულაციების გარეშე.', isUniqueInWorld: true },
            { id: 'opt_harvest_tare', titleEn: 'Dynamic Auto-Tare Deduction by Container Type', titleKa: 'ავტომატური ტარის გამოკლება ყუთის ტიპის მიხედვით', descriptionEn: 'Presets container tare weights to guarantee certified net harvest billing.', descriptionKa: 'ყუთის ზუსტი წონის ავტომატური გამოკლება სუფთა წონის მისაღებად.' }
        ],
        folders: [
            {
                id: 'harvest_components',
                nameEn: 'Harvest Components',
                nameKa: 'მოსავლის კომპონენტები',
                iconName: 'Scale',
                descriptionEn: 'Bluetooth scale drivers, picker credits, and cold cell placement.',
                descriptionKa: 'სასწორის დრაივერები, მკრეფავის დარიცხვა და სამაცივრე უჯრედები.',
                components: [
                    {
                        id: 'comp_harvest_bt_bridge',
                        folderId: 'harvest_components',
                        nameEn: 'Bluetooth Hardware Scale Driver & Auto-Tare',
                        nameKa: 'Bluetooth სასწორის დრაივერი & ავტო-ტარირება',
                        shortDescEn: 'Zero-latency gross weight reading with automatic tare deduction.',
                        shortDescKa: 'წონის წაკითხვა სასწორიდან და ტარის მომენტალური გამოკლება.',
                        fullDocEn: 'Captures stable weight readings via Web Bluetooth API or serial bridge and credits net kg to the picker.',
                        fullDocKa: 'კითხულობს წონას Bluetooth/Serial პროტოკოლით და სუფთა წონას ურიცხავს მკრეფავს.',
                        hardwareBridgeEn: 'Web Bluetooth GATT / Web Serial RS-232 Scale Driver',
                        hardwareBridgeKa: 'Web Bluetooth GATT / Web Serial RS-232 სასწორის დრაივერი',
                        isUniqueInWorld: true
                    },
                    {
                        id: 'comp_harvest_pallet_qr',
                        folderId: 'harvest_components',
                        nameEn: 'QR Pallet Traceability & Cold Cell Mapping',
                        nameKa: 'QR პალეტის ტრასირება & სამაცივრე უჯრედების რუკა',
                        shortDescEn: 'Assigns harvest pallets to exact rack coordinates with temperature tracking.',
                        shortDescKa: 'პალეტის განთავსება მაცივრის კონკრეტულ უჯრედში ტემპერატურის კონტროლით.',
                        fullDocEn: 'Prints GlobalG.A.P. compliant batch QR codes for cold room intake.',
                        fullDocKa: 'ბეჭდავს GlobalG.A.P. სტანდარტის QR კოდებს მაცივარში შესატანად.'
                    }
                ]
            }
        ],
        profitabilityEn: 'Eliminates 100% of harvest weigh-in fraud/errors, accelerates intake throughput by 4x, and ensures GlobalG.A.P. export compliance.',
        profitabilityKa: 'აღმოფხვრის აწონვისას შეცდომებსა და თაღლითობას, 4-ჯერ აჩქარებს მიღების პროცესს და უზრუნველყოფს GlobalG.A.P. სტანდარტს.',
        worldFirstAdvantageEn: 'Direct physical scale hardware-to-cloud bridge linking picker badge scan, auto-tare, and cold storage pallet GPS in under 1 second.',
        worldFirstAdvantageKa: 'სასწორიდან 1 წამში მონაცემის გადაცემა მკრეფავის ბეიჯზე, ტარის მოხსნა და მაცივრის უჯრედში ასახვა.',
        recommendedFutureUpgradesEn: ['Optical sorting camera integration for automated fruit blemish and caliber grading at the scale.'],
        recommendedFutureUpgradesKa: ['ოპტიკური კამერა კალიბრისა და დაზიანებების ავტომატური შეფასებისთვის აწონვისას.'],
        missedGapsEn: ['Automated pallet scale multi-crate batch weigh-in mode.'],
        missedGapsKa: ['პალეტური სასწორის რეჟიმი ერთდროულად 50-100 ყუთის სწრაფი მიღებისთვის.'],
        defaultPosition: { x: 960, y: 100 }
    },

    // 6. Stock (Contains the 10 exact components requested by user!)
    {
        id: 'stock',
        appMode: 'stock',
        nameEn: '6. Stock Management & Warehouse',
        nameKa: '6. საწყობი & მარაგების მართვა (Stock)',
        shortDescEn: 'Produce, sales, cold storage, archives, live ledger, agro-inputs, assets, supplies, POs & direct charges.',
        shortDescKa: 'მოსავალი, გაყიდვები, მაცივარი, არქივი, ცოცხალი ლეჯერი, აგრო-ინპუტები, ძირითადი საშუალებები, ტარა, PO და ხარჯები.',
        iconName: 'Package',
        color: 'from-amber-600 to-orange-700',
        category: 'Supply & Warehouse',
        fullDescriptionEn: 'The unified agricultural warehouse engine. Manages fertilizers, agrochemicals, trellising hardware, packaging boxes, fuel, and fresh harvest produce with real-time zero-click auto-deduction upon task completion.',
        fullDescriptionKa: 'საწყობის სრული აღრიცხვა: სასუქები, პესტიციდები, დამხმარე მასალები, ტარა, საწვავი და მიღებული მოსავალი. მთავარი ფუნქციაა მარაგების ავტომატური ჩამოწერა სამუშაოების შესრულებისთანავე.',
        subOptions: [
            { id: 'opt_stock_auto_deduct', titleEn: '100% Real-Time Automated Stock Deduction Engine', titleKa: '100% რეალურ დროში ავტომატური ჩამოწერის ძრავი', descriptionEn: 'Physical stock quantities are instantly deducted when field tasks close.', descriptionKa: 'მინდორში სამუშაოს დადასტურებისას მასალები მომენტალურად ჩამოიწერება საწყობიდან.', isUniqueInWorld: true },
            { id: 'opt_stock_lots', titleEn: 'Batch, Lot & Expiration Date Traceability', titleKa: 'პარტიების, ლოტებისა და ვარგისიანობის ვადების კონტროლი', descriptionEn: 'FIFO batch tracking, chemical batch registration numbers, and expiry alerts.', descriptionKa: 'FIFO პრინციპი, ქიმიკატების სარეგისტრაციო ლოტები და ვადის გასვლის გაფრთხილება.' }
        ],
        folders: [
            {
                id: 'stock_all_components',
                nameEn: 'Stock Core Components (10 Sections)',
                nameKa: 'საწყობის 10 ძირითადი კომპონენტი',
                iconName: 'Package',
                descriptionEn: 'All 10 authentic modules of the AgriMap Pro warehouse ledger.',
                descriptionKa: 'AgriMap Pro-ს საწყობის 10 სრული ქვეკომპონენტი.',
                components: [
                    {
                        id: 'comp_stock_harvest_produce',
                        folderId: 'stock_all_components',
                        nameEn: '1. Harvest Produce',
                        nameKa: '1. მიღებული მოსავალი (Harvest Produce)',
                        shortDescEn: 'Fresh harvested fruit inventory in crates and bins, net kg by variety, grade, and harvest date.',
                        shortDescKa: 'ახლად დაკრეფილი მოსავლის ნაშთები ყუთებში, ჯიშების, კატეგორიებისა და თარიღის მიხედვით.',
                        fullDocEn: 'Real-time inventory of freshly picked crops received from the electronic scales. Tracks gross, tare, and net weights with lot barcode linkage.',
                        fullDocKa: 'ელექტრონული სასწორიდან მიღებული ახალი მოსავლის ცოცხალი ნაშთები. აღრიცხავს სუფთა წონას, ჯიშს და ხარისხს.',
                        inputsEn: ['Bluetooth Scale Receipts', 'Picker QR Token'],
                        outputsEn: ['Produce Stock Ledger (KG)', 'Batch QR Codes']
                    },
                    {
                        id: 'comp_stock_sales',
                        folderId: 'stock_all_components',
                        nameEn: '2. Sales & Outbound Orders',
                        nameKa: '2. გაყიდვები & შეკვეთები (Sales)',
                        shortDescEn: 'Customer sales orders, dispatch shipments, wholesale packing slips, and delivery invoices.',
                        shortDescKa: 'მყიდველთა შეკვეთები, რეალიზაციის ზედნადებები, საბითუმო გატანები და ინვოისები.',
                        fullDocEn: 'Manages outbound fruit shipments, packaging specifications, buyer price agreements, and automated consignment decrement.',
                        fullDocKa: 'მართავს მყიდველებზე ხილის გაცემას, საბითუმო ფასებს და გაყიდული მოსავლის მომენტალურ ჩამოწერას.',
                        inputsEn: ['Sales Order', 'Buyer PO'],
                        outputsEn: ['Waybill (RS.ge)', 'Outbound Dispatch Ledger']
                    },
                    {
                        id: 'comp_stock_cold_storage',
                        folderId: 'stock_all_components',
                        nameEn: '3. Cold Storage Management',
                        nameKa: '3. სამაცივრე მეურნეობა (Cold Storage)',
                        shortDescEn: 'Refrigerated chambers, ethylene gas levels, temperature zones, pallet rack matrix, and cooling logs.',
                        shortDescKa: 'სამაცივრე კამერები, ეთილენის დონე, ტემპერატურული რეჟიმები, პალეტების უჯრედები და გაციების ჟურნალი.',
                        fullDocEn: 'Controls multi-chamber cold storage facilities with real-time temperature telemetry, pallet coordinate placement, and cooling curve monitoring.',
                        fullDocKa: 'აკონტროლებს სამაცივრე კამერების ტემპერატურას, პალეტების განთავსებას უჯრედებში და შენახვის ვადებს.',
                        inputsEn: ['Chamber IoT Sensors', 'Pallet Barcode'],
                        outputsEn: ['Cold Room Occupancy Matrix', 'Temperature Audit Logs']
                    },
                    {
                        id: 'comp_stock_post_harvest_archive',
                        folderId: 'stock_all_components',
                        nameEn: '4. Post Harvest Archive',
                        nameKa: '4. პოსტ-რთველის არქივი (Post Harvest Archive)',
                        shortDescEn: 'Historical multi-year harvest records, seasonal yield curves, culled fruit rates, and audit archives.',
                        shortDescKa: 'ისტორიული მოსავლის არქივი, წლიური დინამიკა, წუნდებული ხილის ანალიზი და აუდიტის ჩანაწერები.',
                        fullDocEn: 'Long-term immutable data warehouse for multi-season harvest benchmarking, yield per tree trends, and GlobalG.A.P. traceability archives.',
                        fullDocKa: 'მრავალწლიანი მოსავლის არქივი, ჯიშების მოსავლიანობის შედარება და აუდიტის სრული ისტორია.',
                        inputsEn: ['Closed Harvest Season Data'],
                        outputsEn: ['Multi-Year Trend Analysis', 'Historical Yield CSV']
                    },
                    {
                        id: 'comp_stock_live_ledger',
                        folderId: 'stock_all_components',
                        nameEn: '5. Live Warehouse Ledger',
                        nameKa: '5. ცოცხალი ლეჯერი (Live Ledger)',
                        shortDescEn: 'Continuous debit/credit inventory movements, physical vs system count balances, and instant valuation.',
                        shortDescKa: 'მარაგების უწყვეტი დებეტ/კრედიტის მოძრაობა, ფაქტობრივი ნაშთები და საწყობის ჯამური ღირებულება.',
                        fullDocEn: 'Double-entry agricultural stock ledger updating with zero latency upon every field task closure, harvest weigh-in, and purchase order arrival.',
                        fullDocKa: 'ორმაგი ჩაწერის სასაწყობე ლეჯერი, რომელიც წამიერად ახლდება ნებისმიერი სამუშაოს, აწონვისა თუ მიღების დროს.',
                        inputsEn: ['Task BOM Deductions', 'Goods Receipts', 'Sales Dispatches'],
                        outputsEn: ['Live Inventory Valuation (GEL/USD)', 'Audit Trail Logs'],
                        isUniqueInWorld: true
                    },
                    {
                        id: 'comp_stock_agro_inputs',
                        folderId: 'stock_all_components',
                        nameEn: '6. Agro Inputs (Chemicals, Fertilizers, Seeds)',
                        nameKa: '6. აგრო-ინპუტები (სასუქები, ქიმიკატები, ნერგები)',
                        shortDescEn: 'NPK granular & soluble fertilizers, fungicides, insecticides, biostimulants, rootstocks & certified seeds.',
                        shortDescKa: 'NPK სასუქები, ფუნგიციდები, ინსექტიციდები, ბიოსტიმულატორები, ნერგები და სერტიფიცირებული თესლები.',
                        fullDocEn: 'Catalogs all chemical formulations with active ingredients, purity percentages, shelf life, and strict safety data sheets (MSDS).',
                        fullDocKa: 'აღრიცხავს სასუქებსა და შხამქიმიკატებს აქტიური ნივთიერების, ვარგისიანობის ვადებისა და უსაფრთხოების წესების მიხედვით.',
                        inputsEn: ['Supplier Delivery Notes', 'Lab Certificate'],
                        outputsEn: ['Active Ingredient Quotas', 'Expiry Alert Feed']
                    },
                    {
                        id: 'comp_stock_assets',
                        folderId: 'stock_all_components',
                        nameEn: '7. Fixed Assets & Machinery Parts',
                        nameKa: '7. ძირითადი აქტივები & ტექნიკის ნაწილები (Assets)',
                        shortDescEn: 'Tractors, sprayers, mulchers, irrigation pumps, pruning shears, replacement parts & filters.',
                        shortDescKa: 'ტრაქტორები, შემასხურებლები, მულჩერები, ტუმბოები, სეკატორები, სათადარიგო ნაწილები და ფილტრები.',
                        fullDocEn: 'Fixed farm machinery inventory tracking operating hours, depreciation schedules, spare parts stocks, and maintenance logs.',
                        fullDocKa: 'ტექნიკისა და დანადგარების აღრიცხვა: მოტო-საათები, ცვეთა, სათადარიგო ნაწილების ნაშთები და სერვისის ისტორია.',
                        inputsEn: ['Equipment Purchase Invoices', 'Engine Hour Telemetry'],
                        outputsEn: ['Asset Depreciation Ledger', 'Parts Reorder Alerts']
                    },
                    {
                        id: 'comp_stock_supplies',
                        folderId: 'stock_all_components',
                        nameEn: '8. Supplies & Packaging Materials',
                        nameKa: '8. დამხმარე მასალები & ტარა (Supplies)',
                        shortDescEn: 'Plastic harvest crates, wooden export boxes, cardboard punnets, trellising wires, bamboo sticks & drip pipes.',
                        shortDescKa: 'საკრეფი ყუთები, საექსპორტო ხის ტარა, პალეტები, შპალერის მავთული, ბამბუკის ჭოკები და წვეთოვანი მილები.',
                        fullDocEn: 'Tracks circulating container stock, tare weights, packaging consumables, trellising hardware, and warehouse consumption rates.',
                        fullDocKa: 'აკონტროლებს საკრეფი ყუთების ბრუნვას, ტარას, შესაფუთ მასალებს და სამონტაჟო დეტალებს.',
                        inputsEn: ['Packaging Delivery Notes', 'Circulating Crate Returns'],
                        outputsEn: ['Packaging Stock Ledger', 'Tare Preset Table']
                    },
                    {
                        id: 'comp_stock_purchase_orders',
                        folderId: 'stock_all_components',
                        nameEn: '9. Purchase Orders (P. Order)',
                        nameKa: '9. შესყიდვის შეკვეთები (P. Order)',
                        shortDescEn: 'Supplier procurement orders, requisition approval workflows, receiving dock inspection & pending PO status.',
                        shortDescKa: 'მომწოდებლის შესყიდვები, დამტკიცების სამუშაო პროცესი, მიღება-ჩაბარება და შეკვეთის სტატუსები.',
                        fullDocEn: 'End-to-end procurement module creating supplier requests, tracking delivery lead times, price approvals, and direct receiving dock check-in.',
                        fullDocKa: 'შესყიდვების სრული ციკლი: მომწოდებელთან შეკვეთის გაგზავნა, ფასების დამტკიცება და საწყობში მიღება-ჩაბარება.',
                        inputsEn: ['Safety Stock Threshold Triggers', 'Agronomist Requisition'],
                        outputsEn: ['Formal PO Document (PDF)', 'Goods Receipt Note (GRN)']
                    },
                    {
                        id: 'comp_stock_direct_charges',
                        folderId: 'stock_all_components',
                        nameEn: '10. Directory & Direct Charges',
                        nameKa: '10. დირექტორია & პირდაპირი ხარჯები (Direct Charges)',
                        shortDescEn: 'Supplier directory, parcel expense tagging, direct operational charges, freight fees & utility billing.',
                        shortDescKa: 'მომწოდებელთა დირექტორია, ნაკვეთებზე პირდაპირი ხარჯების მიბმა, ტრანსპორტირებისა და კომუნალური ხარჯები.',
                        fullDocEn: 'Allocates direct overhead and supplier charges directly to specific parcel GIS polygons and crop batches for precise cost accounting.',
                        fullDocKa: 'ანაწილებს პირდაპირ საოპერაციო ხარჯებს კონკრეტულ ნაკვეთებზე, რაც უზრუნველყოფს თვითღირებულების ზუსტ გაანგარიშებას.',
                        inputsEn: ['Supplier Invoices', 'Utility Bills', 'Freight Charges'],
                        outputsEn: ['Parcel Expense Allocation Table', 'Vendor Directory Profile']
                    }
                ]
            }
        ],
        profitabilityEn: 'Prevents warehouse shrinkage/theft, eliminates chemical expiration losses, and removes unexpected inventory stockouts.',
        profitabilityKa: 'გამორიცხავს საწყობის დანაკარგებსა და ქურდობას, წამლების ვადის გასვლას და მასალების მოულოდნელ ამოწურვას.',
        worldFirstAdvantageEn: 'Zero-human-entry auto-deduction dynamically calculated from field parcel geometry and agronomist recipe dosing rates.',
        worldFirstAdvantageKa: 'ნულოვანი ხელით ჩარევა: ჩამოწერა გამოითვლება ნაკვეთის ფართობისა და აგრონომიული დოზირების გამრავლებით.',
        recommendedFutureUpgradesEn: ['RFID / Barcode handheld scanner direct warehouse intake sync.', 'Supplier price benchmarking and automated lowest-cost vendor RFQ dispatch.'],
        recommendedFutureUpgradesKa: ['RFID და შტრიხკოდების მობილური სკანერით საწყობის სწრაფი ინვენტარიზაცია.', 'მომწოდებლების ფასების ავტომატური შედარება.'],
        missedGapsEn: ['Digital consignment delivery note (Waybill / RS.ge) automatic API push.'],
        missedGapsKa: ['სასაქონლო ზედნადებების (RS.ge) ავტომატური გაგზავნა და მიღება საგადასახადოს სისტემასთან.'],
        defaultPosition: { x: 80, y: 300 }
    },

    // 7. Accounts
    {
        id: 'accounting',
        appMode: 'accounting',
        nameEn: '7. Accounts & Financial Ledger',
        nameKa: '7. აგრო-ბუღალტერია & ფინანსები (Accounts)',
        shortDescEn: 'Per-hectare & per-kg cost allocation, piece-rate payroll, automated P&L & activity-based costing.',
        shortDescKa: 'თვითღირებულება კილოგრამზე და ჰექტარზე, ხელფასების უწყისი, P&L და ხარჯების მიბმა ნაკვეთებზე.',
        iconName: 'Coins',
        color: 'from-amber-700 to-yellow-800',
        category: 'Finance & Trade',
        fullDescriptionEn: 'The full agricultural financial engine. Provides activity-based costing (ABC), allocating labor, fertilizers, packaging, fuel, and depreciation down to specific parcels and crop varieties to calculate the exact cost per kilogram harvested.',
        fullDescriptionKa: 'სრული აგრო-ფინანსური აღრიცხვა: ანაწილებს მუშახელის, სასუქის, ტარის, საწვავისა და ცვეთის ხარჯებს კონკრეტულ ნაკვეთებზე და ითვლის მოსავლის 1 კილოგრამის ზუსტ თვითღირებულებას.',
        subOptions: [
            { id: 'opt_acc_cost_kg', titleEn: 'Micro-Zoned Unit Costing (Cost per KG)', titleKa: 'მიკრო-ზონირებული თვითღირებულება (Cost per KG)', descriptionEn: 'Calculates exact production cost per kg harvested across all inputs.', descriptionKa: '1 კგ მოსავლის ზუსტი თვითღირებულების გამოთვლა ყველა ხარჯის გათვალისწინებით.', isUniqueInWorld: true },
            { id: 'opt_acc_payroll', titleEn: 'Automated Piece-Rate & Hourly Payroll Settlement', titleKa: 'ხელფასების ავტომატური უწყისი', descriptionEn: 'One-click batch payroll processing from verified task logs and scale receipts.', descriptionKa: 'ხელფასების უწყისის 1-კლიკით გენერირება სამუშაოებისა და წონის მიხედვით.' }
        ],
        folders: [
            {
                id: 'accounts_components',
                nameEn: 'Accounts Components',
                nameKa: 'ბუღალტერიის კომპონენტები',
                iconName: 'Coins',
                descriptionEn: 'Unit costing, payroll settlements, and financial ledger.',
                descriptionKa: 'თვითღირებულება, ხელფასები და ფინანსური ლეჯერი.',
                components: [
                    {
                        id: 'comp_acc_cost_per_kg_engine',
                        folderId: 'accounts_components',
                        nameEn: 'Micro-Zoned Cost-per-KG Real-Time Engine',
                        nameKa: '1 კგ-ის თვითღირებულების დინამიური ძრავი',
                        shortDescEn: 'Calculates precise net cost per kg tied to specific parcel GIS polygons.',
                        shortDescKa: 'ითვლის 1 კგ მოსავლის ზუსტ თვითღირებულებას კონკრეტული ნაკვეთის მიხედვით.',
                        fullDocEn: 'Combines direct chemical spend, tractor fuel, worker wages, and overhead amortized by verified weight intake.',
                        fullDocKa: 'აერთიანებს სასუქის, საწვავის, მუშახელისა და ცვეთის ხარჯებს და ყოფს მიღებულ სუფთა წონაზე.',
                        formulaOrLogicEn: 'Cost/KG = (Fertilizer + Spray + Labor + Fuel + Overhead) / Certified Net Harvest (KG)',
                        formulaOrLogicKa: 'თვითღირებულება/კგ = (სასუქი + წამლობა + შრომა + საწვავი + ზედნადები) / მიღებული სუფთა მოსავალი (კგ)',
                        isUniqueInWorld: true
                    },
                    {
                        id: 'comp_acc_payroll_calc',
                        folderId: 'accounts_components',
                        nameEn: 'Automated Piece-Rate Payroll Settlement',
                        nameKa: 'გამომუშავებითი ხელფასების ავტომატური გაანგარიშება',
                        shortDescEn: 'Generates bank payout sheets directly from Bluetooth harvest intake logs.',
                        shortDescKa: 'ქმნის საბანკო გადარიცხვის უწყისს სასწორიდან მიღებული კილოგრამების მიხედვით.',
                        fullDocEn: 'Sums verified picker kilograms, multiplies by wage tier, and deducts advances automatically.',
                        fullDocKa: 'აჯამებს დაკრეფილ კილოგრამებს, ამრავლებს ტარიფზე და აკლებს ავანსებს.'
                    }
                ]
            }
        ],
        profitabilityEn: 'Identifies unprofitable crop varieties and field blocks, maximizing overall farm gross margins by 18–25%.',
        profitabilityKa: 'ავლენს წამგებიან ჯიშებსა და ნაკვეთებს, რაც ზრდის საერთო საოპერაციო მარჟას 18-25%-ით.',
        worldFirstAdvantageEn: 'Direct automatic cost allocation tying financial debits directly to GPS coordinates and Bluetooth harvest scale logs.',
        worldFirstAdvantageKa: 'ფინანსური ხარჯების პირდაპირი ავტომატური მიბმა GPS კოორდინატებთან და სასწორის წონებთან.',
        recommendedFutureUpgradesEn: ['Direct automated tax authority API integration for electronic invoice and VAT filing.'],
        recommendedFutureUpgradesKa: ['საგადასახადოსთან (RS.ge) პირდაპირი ინტეგრაცია დეკლარაციების ავტომატური გაგზავნისთვის.'],
        missedGapsEn: ['Automated bank statement reconciliation via OpenBanking API.'],
        missedGapsKa: ['საბანკო ამონაწერების ავტომატური შედარება და ასახვა ბუღალტერიაში.'],
        defaultPosition: { x: 300, y: 300 }
    },

    // 8. Tasks and Work
    {
        id: 'tasks_work',
        appMode: 'tasks',
        nameEn: '8. Tasks and Work Execution',
        nameKa: '8. სამუშაოები & საველე ოპერაციები (Tasks & Work)',
        shortDescEn: 'Task dispatch, piece-rate vs hourly logs, GPS geofencing & labor ratio balancing.',
        shortDescKa: 'დავალებების გაცემა, გამომუშავებითი და საათობრივი აღრიცხვა, GPS გეოფენსინგი და შრომის ბალანსი.',
        iconName: 'CheckSquare',
        color: 'from-teal-600 to-emerald-800',
        category: 'Field & Agronomy',
        fullDescriptionEn: 'The operational command center for scheduling, dispatching, and verifying all farm labor activities (Pruning, Spraying, Weeding, Mowing, Trellis Repair, Irrigation). Logs piece-rate units and hours directly into the payroll engine.',
        fullDescriptionKa: 'ფერმის ყოველდღიური სამუშაოების ცენტრი: დავალებების გაცემა ბრიგადებზე (სხვლა, გათოხნა, შეწამვლა, გათიბვა, შპალერის შეკეთება), GPS კონტროლი და შესრულებული სამუშაოს პირდაპირი გადაცემა ხელფასების მოდულში.',
        subOptions: [
            { id: 'opt_tasks_dispatch', titleEn: 'Field Task Dispatch & Team Lead Assignment', titleKa: 'დავალებების გაცემა და ბრიგადირებზე მიმაგრება', descriptionEn: 'Assign specific tasks to individual workers or brigades with parcel targeting and unit targets.', descriptionKa: 'კონკრეტული სამუშაოს მიბმა მუშაკზე ან ბრიგადაზე ნაკვეთის მითითებით.' }
        ],
        folders: [
            {
                id: 'tasks_work_components',
                nameEn: 'Tasks & Work Components',
                nameKa: 'სამუშაოების კომპონენტები',
                iconName: 'CheckSquare',
                descriptionEn: 'Field operations, brigade assignments, and geofencing verifiers.',
                descriptionKa: 'საველე დავალებები, ბრიგადების განაწილება და GPS გადამოწმება.',
                components: [
                    {
                        id: 'comp_tasks_geofenced_checkin',
                        folderId: 'tasks_work_components',
                        nameEn: 'GPS Geofenced Task Completion Verifier',
                        nameKa: 'GPS გეოფენსინგით სამუშაოს დადასტურების მოდული',
                        shortDescEn: 'Validates worker presence inside parcel coordinates before logging completion.',
                        shortDescKa: 'ამოწმებს მუშის ყოფნას ნაკვეთში სამუშაოს დასრულების ჩასათვლელად.',
                        fullDocEn: 'Prevents fraudulent or mistaken task sign-offs outside assigned orchard blocks.',
                        fullDocKa: 'გამორიცხავს სამუშაოს არასწორ ან ფიქტიურ დახურვას სხვა ლოკაციიდან.',
                        isUniqueInWorld: true
                    },
                    {
                        id: 'comp_tasks_bom_auto_trigger',
                        folderId: 'tasks_work_components',
                        nameEn: 'Task Completion Stock Auto-Decrement Hook',
                        nameKa: 'სამუშაოს დახურვისას მასალების ავტო-ჩამოწერა',
                        shortDescEn: 'Automatically subtracts sprayed chemicals and fertilizers when operator marks done.',
                        shortDescKa: 'ავტომატურად აკლებს საწყობიდან გახარჯულ ქიმიას და სასუქს დავალების დახურვისას.',
                        fullDocEn: 'Links task target hectares with agronomist dosage rates to execute zero-click inventory depletion.',
                        fullDocKa: 'ამრავლებს ნაკვეთის ჰექტრებს აგრონომის დოზაზე და ზუსტად აკლებს საწყობს.',
                        isUniqueInWorld: true
                    }
                ]
            }
        ],
        profitabilityEn: 'Boosts field labor output by 25–40% and eliminates phantom hours and inaccurate timecard claims.',
        profitabilityKa: 'ზრდის მუშახელის პროდუქტიულობას 25-40%-ით და გამორიცხავს დაუდასტურებელი საათების ჩაწერას.',
        worldFirstAdvantageEn: 'Offline-first task completion that simultaneously decrements warehouse inventory and updates worker mobile balance in real time.',
        worldFirstAdvantageKa: 'ოფლაინ სამუშაოს დახურვა, რომელიც ერთდროულად ჩამოწერს საწყობს და მუშას ურიცხავს გამომუშავებას მის პირად აპლიკაციაში.',
        recommendedFutureUpgradesEn: ['Automated route optimization for tractor mowing and spraying operators.'],
        recommendedFutureUpgradesKa: ['ტრაქტორის მარშრუტის ოპტიმიზაცია საწვავის და დროის დასაზოგად.'],
        missedGapsEn: ['Voice notes and in-field photo attachments for pest spotting directly on task completion.'],
        missedGapsKa: ['ხმოვანი შეტყობინებისა და ფოტოს მიბმა დავალებაზე მავნებლების აღმოჩენისას.'],
        defaultPosition: { x: 520, y: 300 }
    },

    // 9. Market
    {
        id: 'marketplace',
        appMode: 'marketplace',
        nameEn: '9. Market & Commodity Trading',
        nameKa: '9. აგრო ბაზარი & ვაჭრობა (Market)',
        shortDescEn: 'Verified farm listings, cold storage forward trades, buyer escrow & direct export contracts.',
        shortDescKa: 'ვერიფიცირებული ლოტები, მაცივრიდან გაყიდვა, მყიდველის ესქროუ და პირდაპირი ექსპორტი.',
        iconName: 'ShoppingBag',
        color: 'from-orange-600 to-rose-700',
        category: 'Finance & Trade',
        fullDescriptionEn: 'Direct producer-to-buyer agricultural trade portal. Enables producers to list verified crop batches directly from cold storage with transparent weight, quality grade, and GlobalG.A.P. certificates, bypassing intermediary broker cuts.',
        fullDescriptionKa: 'ფერმერებისა და მსხვილი მყიდველების/ექსპორტიორების პირდაპირი სავაჭრო პლატფორმა: მოსავლის გაყიდვა პირდაპირ მაცივრიდან დადასტურებული ხარისხითა და სერტიფიკატებით, შუამავლების გარეშე.',
        subOptions: [
            { id: 'opt_market_listings', titleEn: 'Traceable Verified Batch Listings', titleKa: 'ვერიფიცირებული ლოტების განთავსება', descriptionEn: 'Produce listings verified by digital harvest scale intake records and soil lab sheets.', descriptionKa: 'მოსავლის განცხადებები, რომლებიც დამოწმებულია სასწორის ელექტრონული მონაცემებით.' }
        ],
        folders: [
            {
                id: 'market_components',
                nameEn: 'Market Components',
                nameKa: 'ბაზრის კომპონენტები',
                iconName: 'ShoppingBag',
                descriptionEn: 'Cryptographic lot verification, forward contracts, and export matcher.',
                descriptionKa: 'ლოტების ვერიფიკაცია, ფორვარდული კონტრაქტები და ექსპორტი.',
                components: [
                    {
                        id: 'comp_market_traceable_batch',
                        folderId: 'market_components',
                        nameEn: 'Cryptographically Verified Lot Listing',
                        nameKa: 'კრიპტოგრაფიულად დამოწმებული ლოტის განთავსება',
                        shortDescEn: 'Batch listing backed by unalterable scale records and GIS origin proof.',
                        shortDescKa: 'გასაყიდი ლოტი დამოწმებული სასწორის წონითა და წარმოშობის ნაკვეთით.',
                        fullDocEn: 'Guarantees export buyers 100% origin authenticity and cold chain history.',
                        fullDocKa: 'გარანტიას აძლევს მყიდველს მოსავლის ზუსტ წარმოშობასა და შენახვის ტემპერატურაზე.',
                        isUniqueInWorld: true
                    },
                    {
                        id: 'comp_market_escrow_bridge',
                        folderId: 'market_components',
                        nameEn: 'Buyer Escrow & Quality Protection Gate',
                        nameKa: 'მყიდველის ესქროუ & ხარისხის დაცვის გარანტი',
                        shortDescEn: 'Holds buyer funds securely until destination quality inspection sign-off.',
                        shortDescKa: 'იცავს თანხას მყიდველის მიერ ხარისხის დადასტურებამდე.',
                        fullDocEn: 'Protects growers against non-payment and guarantees buyers product grade authenticity.',
                        fullDocKa: 'იცავს ფერმერს გადაუხდელობისგან და მყიდველს უხარისხო პროდუქციისგან.'
                    }
                ]
            }
        ],
        profitabilityEn: 'Increases grower net realization prices by 15–28% by eliminating unnecessary middleman brokerage layers.',
        profitabilityKa: 'ზრდის ფერმერის შემოსავალს 15-28%-ით შუამავლების საკომისიოების ამოღებით.',
        worldFirstAdvantageEn: 'Every listing is backed by immutable cryptographic scale receipts and GPS parcel proof of origin.',
        worldFirstAdvantageKa: 'ყველა გასაყიდი ლოტი დამოწმებულია ელექტრონული სასწორის ჩანაწერებით და წარმოშობის ნაკვეთის GPS-ით.',
        recommendedFutureUpgradesEn: ['Smart Contract escrow for automated payout upon buyer port inspection sign-off.'],
        recommendedFutureUpgradesKa: ['Smart Contract ესქროუ თანხის უსაფრთხო გარანტიისთვის მყიდველის მიერ მიღებამდე.'],
        missedGapsEn: ['Customs export documentation automation (Phytosanitary certificate direct bridge).'],
        missedGapsKa: ['ფიტოსანიტარიული სერტიფიკატების ავტომატური გენერირება საბაჟოსთვის.'],
        defaultPosition: { x: 740, y: 300 }
    },

    // 10. AI
    {
        id: 'ai',
        appMode: 'ai',
        nameEn: '10. AI Agronomic Intelligence',
        nameKa: '10. ხელოვნური ინტელექტი & აუდიტორი (AI)',
        shortDescEn: 'Scheduled routine audits, precision date-range comparisons, anomaly engine & upgrade roadmaps.',
        shortDescKa: 'პერიოდული აუდიტი, თარიღების ინტერვალის ანალიზი, ანომალიების ძრავი და განვითარების რეკომენდაციები.',
        iconName: 'Brain',
        color: 'from-purple-600 to-indigo-900',
        category: 'Intelligence & AI',
        fullDescriptionEn: 'The cross-domain cognitive brain of AgriMap Pro. Autonomously analyzes telemetry across all modules, identifies hidden operational imbalances (e.g. stock spikes, chemical over-dosage, labor skews), executes scheduled interval audits (weekly/monthly/custom dates), and delivers strategic upgrade recommendations.',
        fullDescriptionKa: 'AgriMap Pro-ს ხელოვნური ინტელექტის ცენტრი: აანალიზებს ყველა მოდულის ურთიერთკავშირს, პოულობს ფარულ ანომალიებს (მარაგების გადახარჯვა, ქიმიის გადაჭარბება, შრომის დისბალანსი), ასრულებს პერიოდულ აუდიტს და იძლევა სტრატეგიულ რეკომენდაციებს.',
        subOptions: [
            { id: 'opt_ai_scheduler', titleEn: 'Autonomous Interval Scheduler (Weekly / Monthly / Range)', titleKa: 'ავტონომიური განრიგი (კვირეული, თვიური, თარიღების ინტერვალი)', descriptionEn: 'Configure routine audits or select precise historical windows to audit protocol adherence.', descriptionKa: 'ავტომატური პერიოდული აუდიტი ან კონკრეტული თარიღების დიაპაზონის შემოწმება.' },
            { id: 'opt_ai_cross_detect', titleEn: 'Multi-Domain Anomaly Correlator', titleKa: 'მრავალმოდულური ანომალიების კორელატორი', descriptionEn: 'Correlates stock depletion spikes with task logs and compares nutrition recipes against actual field logs.', descriptionKa: 'ადარებს საწყობიდან გასულ მასალებს შესრულებულ სამუშაოებს.' }
        ],
        folders: [
            {
                id: 'ai_components',
                nameEn: 'AI Components',
                nameKa: 'AI კომპონენტები',
                iconName: 'Brain',
                descriptionEn: 'Cross-module anomaly engine, LLM diagnostics, and strategic roadmap generators.',
                descriptionKa: 'ანომალიების ძრავი, LLM დიაგნოსტიკა და სტრატეგიული რეკომენდაციები.',
                components: [
                    {
                        id: 'comp_ai_anomaly_neural',
                        folderId: 'ai_components',
                        nameEn: 'Cross-Domain Anomaly Detection Engine',
                        nameKa: 'მრავალმოდულური ანომალიების დეტექტორი',
                        shortDescEn: 'Correlates stock debits, tractor telemetry, and field tare logs to spot leakages.',
                        shortDescKa: 'აკავშირებს საწყობს, ტრაქტორის საწვავსა და სასწორის ტარას დანაკარგების გამოსავლენად.',
                        fullDocEn: 'Executes continuous audit algorithms detecting deviations from standard agricultural protocols.',
                        fullDocKa: 'უწყვეტად ამოწმებს აგრონომიული სტანდარტებიდან გადახრებს.',
                        isUniqueInWorld: true
                    },
                    {
                        id: 'comp_ai_vision_scout',
                        folderId: 'ai_components',
                        nameEn: 'Gemini Vision Multi-Modal Crop Pathology',
                        nameKa: 'Gemini Vision კულტურის პათოლოგიების დიაგნოსტირება',
                        shortDescEn: 'Instant on-device pest and fungal disease identification from smartphone photos.',
                        shortDescKa: 'ფოტოდან მავნებლებისა და სოკოვანი დაავადებების მყისიერი ამოცნობა.',
                        fullDocEn: 'Diagnoses nutritional deficiencies (Iron chlorosis, Nitrogen deficit) and recommends exact curative recipe doses.',
                        fullDocKa: 'სვამს დიაგნოზს (ქლოროზი, აზოტის დეფიციტი) და იძლევა მკურნალობის რეცეპტს.'
                    }
                ]
            }
        ],
        profitabilityEn: 'Prevents operational budget overruns and chemical waste, delivering an estimated 15–30% net operational cost reduction.',
        profitabilityKa: 'თავიდან აგაცილებთ ბიუჯეტის გადახარჯვას და მასალების გაფლანგვას, რაც ზოგავს საოპერაციო ხარჯების 15-30%-ს.',
        worldFirstAdvantageEn: 'AI grounded specifically in agricultural agronomy laws, physical scale inputs, and real-time inventory ledger logic.',
        worldFirstAdvantageKa: 'აგრონომიულ მეცნიერებასა და რეალურ სასაწყობე-სასწორ ტელემეტრიაზე დაფუძნებული AI ანალიტიკა.',
        recommendedFutureUpgradesEn: ['Automated autonomous re-ordering of supplies when AI predicts impending seasonal shortages.'],
        recommendedFutureUpgradesKa: ['მარაგების ავტომატური შეკვეთა, როდესაც AI წინასწარ ხედავს სეზონურ დეფიციტს.'],
        missedGapsEn: ['Multi-farm regional benchmarking against anonymized peer performance data.'],
        missedGapsKa: ['რეგიონის სხვა ფერმების ანონიმურ მონაცემებთან შედარებითი ბენჩმარკინგი.'],
        defaultPosition: { x: 960, y: 300 }
    },

    // 11. Communicator
    {
        id: 'communicator',
        appMode: 'community',
        nameEn: '11. Communicator & Field Chat',
        nameKa: '11. კომუნიკატორი & საველე ჩათი',
        shortDescEn: 'Worker radio feed, urgent weather broadcasts, agronomist consultation & brigade group chats.',
        shortDescKa: 'მუშათა საკომუნიკაციო არხი, წაყინვის საგანგაშო შეტყობინებები და ბრიგადების ჩათი.',
        iconName: 'MessageSquare',
        color: 'from-cyan-600 to-blue-700',
        category: 'Core & Dashboard',
        fullDescriptionEn: 'Unified farm communications hub connecting agronomists, field operators, brigade leaders, and tractor drivers. Supports push broadcasts for urgent frost alerts, in-field photo sharing, and direct task commentary.',
        fullDescriptionKa: 'ფერმის ერთიანი საკომუნიკაციო ცენტრი: აკავშირებს აგრონომებს, ბრიგადირებსა და ტრაქტორისტებს. უზრუნველყოფს საგანგაშო შეტყობინებების გაგზავნას წაყინვაზე და საველე ფოტოების გაზიარებას.',
        subOptions: [
            { id: 'opt_comm_broadcast', titleEn: 'Urgent Weather & Frost Broadcasts', titleKa: 'საგანგაშო ამინდის შეტყობინებები', descriptionEn: 'Instant push/SMS emergency alerts to all farm workers in high-risk zones.', descriptionKa: 'მყისიერი SMS/Push შეტყობინებები წაყინვისა და სტიქიის საშიშროებაზე.' }
        ],
        folders: [
            {
                id: 'communicator_components',
                nameEn: 'Communicator Components',
                nameKa: 'კომუნიკატორის კომპონენტები',
                iconName: 'MessageSquare',
                descriptionEn: 'Field chat channels, voice memos, and alert broadcasts.',
                descriptionKa: 'ჩათის არხები, ხმოვანი შეტყობინებები და საგანგაშო გაფრთხილებები.',
                components: [
                    {
                        id: 'comp_comm_brigade_chat',
                        folderId: 'communicator_components',
                        nameEn: 'Brigade Field Task Channel',
                        nameKa: 'ბრიგადის საველე სამუშაო არხი',
                        shortDescEn: 'Encrypted group chat linked directly to active parcel tasks.',
                        shortDescKa: 'დაცული ჯგუფური ჩათი მიბმული კონკრეტულ ნაკვეთზე.',
                        fullDocEn: 'Enables workers to post instant photos of damaged drip pipes or spotted pests directly into task threads.',
                        fullDocKa: 'საშუალებას აძლევს მუშებს გააზიარონ დაზიანებული მილის ან მავნებლის ფოტო პირდაპირ დავალებაში.'
                    }
                ]
            }
        ],
        profitabilityEn: 'Saves 30–45 minutes of wasted field coordination per brigade daily and prevents crop losses during sudden frost events.',
        profitabilityKa: 'ზოგავს დღეში 30-45 წუთს თითოეულ ბრიგადაზე და იცავს მოსავალს უეცარი წაყინვის დროს.',
        worldFirstAdvantageEn: 'Chat messages are directly indexed to GIS coordinates and specific warehouse lot numbers.',
        worldFirstAdvantageKa: 'შეტყობინებები პირდაპირ კავშირშია ნაკვეთის GPS კოორდინატებთან და საწყობის ლოტებთან.',
        recommendedFutureUpgradesEn: ['AI-powered voice-to-task translation for hands-free command creation.'],
        recommendedFutureUpgradesKa: ['ხმოვანი შეტყობინების ავტომატური გარდაქმნა დავალებად AI-ს მეშვეობით.'],
        missedGapsEn: ['Walkie-talkie style push-to-talk audio channel integration.'],
        missedGapsKa: ['Walkie-talkie (რაციის) რეჟიმი საველე მუშაკებისთვის.'],
        defaultPosition: { x: 80, y: 500 }
    },

    // 12. Tools
    {
        id: 'tools',
        appMode: 'tools',
        nameEn: '12. Tools & Agronomic Calculators',
        nameKa: '12. ხელსაწყოები & აგრო-კალკულატორები (Tools)',
        shortDescEn: 'Spray calibration, drip water flow calculators, GDD heat accumulators & unit converters.',
        shortDescKa: 'შეწამვლის კალიბრაცია, წვეთოვანი რწყვის ხარჯი, GDD სითბოს ინდექსი და ერთეულების კონვერტერი.',
        iconName: 'Wrench',
        color: 'from-amber-600 to-yellow-700',
        category: 'Field & Agronomy',
        fullDescriptionEn: 'Suite of field-ready offline calculators: sprayer nozzle nozzle calibration, drip emitter flow rate vs pressure curves, growing degree day (GDD) calculators, and land area unit conversions (Hectares, Acres, SQM, Dekares).',
        fullDescriptionKa: 'საველე ოფლაინ კალკულატორების ნაკრები: შემასხურებლის საქშენების კალიბრაცია, წვეთოვანი სისტემის წყლის ხარჯი წნევის მიხედვით, GDD სითბოს დაგროვების ინდექსი და ფართობების კონვერტერი.',
        subOptions: [
            { id: 'opt_tools_spray_calc', titleEn: 'Tractor Speed & Nozzle Flow Calibrator', titleKa: 'ტრაქტორის სიჩქარისა და საქშენების კალიბრაცია', descriptionEn: 'Calculates exact L/ha spray volume based on tractor speed, boom width, and nozzle bar pressure.', descriptionKa: 'ითვლის შესხურების ზუსტ ნორმას (ლ/ჰა) ტრაქტორის სიჩქარისა და წნევის მიხედვით.' }
        ],
        folders: [
            {
                id: 'tools_components',
                nameEn: 'Tools Components',
                nameKa: 'ხელსაწყოების კომპონენტები',
                iconName: 'Wrench',
                descriptionEn: 'Mathematical agronomy engines and engineering calibrators.',
                descriptionKa: 'აგრონომიული კალკულატორები და საინჟინრო ხელსაწყოები.',
                components: [
                    {
                        id: 'comp_tools_flow_calibrator',
                        folderId: 'tools_components',
                        nameEn: 'Drip Irrigation Flow & Pressure Calibrator',
                        nameKa: 'წვეთოვანი რწყვის ხარჯისა & წნევის კალკულატორი',
                        shortDescEn: 'Computes total m3/hour water demand per orchard block.',
                        shortDescKa: 'ითვლის ბლოკისთვის საჭირო წყლის კუბურ მეტრებს საათში.',
                        fullDocEn: 'Accounts for emitter spacing (e.g. 0.5m), flow rate (1.6 L/h), and pipe friction loss.',
                        fullDocKa: 'ითვალისწინებს საწვეთურების დაშორებას (მაგ. 0.5მ), ხარჯს (1.6 ლ/სთ) და მილის ხახუნის დანაკარგს.'
                    }
                ]
            }
        ],
        profitabilityEn: 'Prevents 10–15% agrochemical over-spray and ensures uniform irrigation distribution across undulating topography.',
        profitabilityKa: 'თავიდან აგაცილებთ ქიმიის 10-15%-იან გადახარჯვას და უზრუნველყოფს თანაბარ მორწყვას რელიეფზე.',
        worldFirstAdvantageEn: 'Calculators push output formulas directly into the master Agronomy Recipe Formulation engine with one tap.',
        worldFirstAdvantageKa: 'კალკულატორის შედეგები 1 შეხებით გადადის აგრონომიულ რეცეპტებში.',
        recommendedFutureUpgradesEn: ['Smartphone camera spray nozzle droplet size analysis (VMD spectrum).'],
        recommendedFutureUpgradesKa: ['კამერით წვეთის ზომის (VMD) ანალიზი შესხურების ხარისხის შესაფასებლად.'],
        missedGapsEn: ['Solar pump panel output vs sunshine hours calculator.'],
        missedGapsKa: ['მზის ენერგიაზე მომუშავე ტუმბოების სიმძლავრის კალკულატორი.'],
        defaultPosition: { x: 300, y: 500 }
    },

    // 13. Help
    {
        id: 'help',
        appMode: 'guide',
        nameEn: '13. Help & Architecture Guide',
        nameKa: '13. დახმარება & არქიტექტურის გზამკვლევი (Help)',
        shortDescEn: 'Manual architecture explorer, step-by-step onboarding, PDF/Markdown user manuals & slide decks.',
        shortDescKa: 'მექანიკური არქიტექტურის მკვლევარი, ნაბიჯ-ნაბიჯ სწავლება, გზამკვლევის ჩამოტვირთვა და პრეზენტაცია.',
        iconName: 'HelpCircle',
        color: 'from-emerald-700 to-teal-900',
        category: 'Governance & System',
        fullDescriptionEn: 'The comprehensive documentation, interactive onboarding, and architecture inspection hub. Houses the Manual Architecture analyzer, platform user manual (.md) generator, and interactive presentation slide deck engine.',
        fullDescriptionKa: 'სრული დოკუმენტაცია, ინტერაქტიული გზამკვლევი და არქიტექტურის ანალიტიკა. მოიცავს მექანიკური არქიტექტურის მოდულს, ოფიციალური გზამკვლევის (.md) გენერატორსა და პრეზენტაციის სლაიდების ძრავს.',
        subOptions: [
            { id: 'opt_help_manual_arch', titleEn: 'Manual Architecture Explorer', titleKa: 'მექანიკური არქიტექტურა', descriptionEn: 'Explore all 17 modules, inspect components, and trigger categorized AI synthesis.', descriptionKa: 'შეისწავლეთ 17 მოდული, მათი კომპონენტები და ჩაატარეთ კატეგორიზებული AI ანალიზი.' },
            { id: 'opt_help_export_doc', titleEn: 'One-Click User Guide & Presentation Deck', titleKa: '1-კლიკით გზამკვლევი & პრეზენტაცია', descriptionEn: 'Download formatted markdown manuals and interactive HTML slide decks.', descriptionKa: 'ჩამოტვირთეთ დეტალური გზამკვლევი და ინტერაქტიული პრეზენტაცია.' }
        ],
        folders: [
            {
                id: 'help_components',
                nameEn: 'Help & Architecture Components',
                nameKa: 'დახმარების კომპონენტები',
                iconName: 'HelpCircle',
                descriptionEn: 'Architecture explorer, presentation generators, and system tutorials.',
                descriptionKa: 'არქიტექტურის ანალიტიკა, პრეზენტაციის გენერატორი და ტუტორიალები.',
                components: [
                    {
                        id: 'comp_help_manual_arch_engine',
                        folderId: 'help_components',
                        nameEn: 'Manual Architecture Deep Analyzer',
                        nameKa: 'მექანიკური არქიტექტურის ღრმა ანალიზატორი',
                        shortDescEn: 'Interactive hierarchy explorer with multi-select, focused analysis, and HUD telemetry.',
                        shortDescKa: 'იერარქიის მკვლევარი კომპონენტების შერჩევით, ფოკუსირებული ანალიზითა და HUD ტელემეტრიით.',
                        fullDocEn: 'Provides structural clarity into modules, folders, components, and inter-module data pipelines.',
                        fullDocKa: 'იძლევა სრულ ხედვას მოდულების, საქაღალდეების, კომპონენტებისა და მონაცემთა ნაკადების შესახებ.',
                        isUniqueInWorld: true
                    },
                    {
                        id: 'comp_help_deck_generator',
                        folderId: 'help_components',
                        nameEn: 'Executive Presentation Slide Deck Engine',
                        nameKa: 'ინტერაქტიული პრეზენტაციის სლაიდების გენერატორი',
                        shortDescEn: 'Compiles active modules into a self-contained responsive HTML slide deck.',
                        shortDescKa: 'არჩეულ მოდულებს გარდაქმნის მზა ინტერაქტიულ HTML პრეზენტაციად.',
                        fullDocEn: 'Generates investor-ready slides highlighting profitability metrics and competitive advantages.',
                        fullDocKa: 'ქმნის ინვესტორებისთვის განკუთვნილ სლაიდებს მომგებიანობისა და უპირატესობების ჩვენებით.'
                    }
                ]
            }
        ],
        profitabilityEn: 'Reduces staff training time by 75% and eliminates operational confusion across new farm employees.',
        profitabilityKa: 'ამცირებს ახალი პერსონალის სწავლების დროს 75%-ით და გამორიცხავს გაუგებრობებს სამუშაო პროცესში.',
        worldFirstAdvantageEn: 'Generates real-time architectural blueprints and user manuals customized to the farm’s exact active feature set.',
        worldFirstAdvantageKa: 'ქმნის რეალურ არქიტექტურულ გეგმებსა და გზამკვლევებს, რომლებიც ზუსტად ერგება თქვენი ფერმის მოდულებს.',
        recommendedFutureUpgradesEn: ['AI-guided interactive voice tour for first-time farm operators.'],
        recommendedFutureUpgradesKa: ['ინტერაქტიული ხმოვანი გიდი ახალი მომხმარებლებისთვის.'],
        missedGapsEn: ['Direct video tutorial embedding into individual component screens.'],
        missedGapsKa: ['ვიდეო გაკვეთილების პირდაპირი ინტეგრაცია კომპონენტების გვერდებზე.'],
        defaultPosition: { x: 520, y: 500 }
    },

    // 14. Labs
    {
        id: 'labs',
        appMode: 'labs',
        nameEn: '14. Labs & Chemical Soil Testing',
        nameKa: '14. ლაბორატორია & ნიადაგის ანალიზი (Labs)',
        shortDescEn: 'Soil chemistry, leaf tissue petiole analysis, water salinity/EC & fruit brix quality labs.',
        shortDescKa: 'ნიადაგის ქიმია, ფოთლის დიაგნოსტიკა, წყლის მარილიანობა/EC და ნაყოფის ბრიქსის ლაბორატორია.',
        iconName: 'TestTubes',
        color: 'from-violet-600 to-purple-800',
        category: 'Field & Agronomy',
        fullDescriptionEn: 'The scientific laboratory integration module. Ingests laboratory test reports for soil chemistry (N-P-K, pH, Organic Matter, Cation Exchange Capacity), leaf tissue mineral levels, irrigation water heavy metals/salinity, and post-harvest fruit sugar (Brix) and firmness.',
        fullDescriptionKa: 'სამეცნიერო ლაბორატორიული მოდული: აღრიცხავს ნიადაგის ქიმიურ ანალიზებს (N-P-K, pH, ორგანული ნივთიერება, EC), ფოთლის მინერალურ შემცველობას, სარწყავი წყლის ხარისხს და ნაყოფის შაქრიანობას (Brix).',
        subOptions: [
            { id: 'opt_labs_soil', titleEn: 'Soil Chemistry Sample Matrix', titleKa: 'ნიადაგის ნიმუშების მატრიცა', descriptionEn: 'GPS-tagged soil core sample results tracking macro and micro-nutrients across time.', descriptionKa: 'GPS-ით მიბმული ნიადაგის სინჯების შედეგები ელემენტების დინამიკით.' }
        ],
        folders: [
            {
                id: 'labs_components',
                nameEn: 'Labs Components',
                nameKa: 'ლაბორატორიის კომპონენტები',
                iconName: 'TestTubes',
                descriptionEn: 'Soil chemistry logs, leaf tissue mineral tests, and water lab charts.',
                descriptionKa: 'ნიადაგის ანალიზები, ფოთლის ტესტები და წყლის ხარისხის გრაფიკები.',
                components: [
                    {
                        id: 'comp_labs_soil_ph_ec',
                        folderId: 'labs_components',
                        nameEn: 'Soil pH, EC & Cation Exchange Engine',
                        nameKa: 'ნიადაგის pH, EC და კატიონური ტევადობის ძრავი',
                        shortDescEn: 'Maps soil chemistry results directly to parcel GIS polygons.',
                        shortDescKa: 'ასახავს ნიადაგის ანალიზის შედეგებს პირდაპირ ნაკვეთის GIS რუკაზე.',
                        fullDocEn: 'Automatically adjusts agronomist fertigation recommendations based on baseline soil buffering capacity.',
                        fullDocKa: 'ავტომატურად აკორექტირებს სასუქის დოზებს ნიადაგში არსებული მარაგების მიხედვით.',
                        isUniqueInWorld: true
                    }
                ]
            }
        ],
        profitabilityEn: 'Prevents nutrient lockouts and over-fertilization, saving 25% on redundant fertilizer spend.',
        profitabilityKa: 'თავიდან აგაცილებთ ელემენტების ბლოკირებას და ჭარბ განოყიერებას, რაც ზოგავს სასუქის ხარჯის 25%-ს.',
        worldFirstAdvantageEn: 'Direct automatic calibration of fertigation recipes from uploaded lab PDF test results.',
        worldFirstAdvantageKa: 'ლაბორატორიის PDF ანალიზიდან სასუქის რეცეპტის ავტომატური კორექტირება.',
        recommendedFutureUpgradesEn: ['Spectrophotometer Bluetooth direct sensor data capture.'],
        recommendedFutureUpgradesKa: ['სპექტროფოტომეტრის Bluetooth სენსორიდან მონაცემების პირდაპირი წაკითხვა.'],
        missedGapsEn: ['Automated historical soil fertility degradation trend alerts.'],
        missedGapsKa: ['ნიადაგის ნაყოფიერების კლების ტრენდის ავტომატური შეტყობინებები.'],
        defaultPosition: { x: 740, y: 500 }
    },

    // 15. Logs
    {
        id: 'logs',
        appMode: 'logs',
        nameEn: '15. Logs & System Audit Trail',
        nameKa: '15. ლოგები & სისტემური აუდიტი (Logs)',
        shortDescEn: 'Immutable audit trail, security events, weigh-in calibration history & sync conflict logs.',
        shortDescKa: 'აუდიტის უცვლელი ისტორია, უსაფრთხოების მოვლენები, სასწორის კალიბრაცია და სინქრონიზაციის ლოგები.',
        iconName: 'FileText',
        color: 'from-slate-700 to-zinc-900',
        category: 'Governance & System',
        fullDescriptionEn: 'The immutable system event ledger. Records every database write, stock debit, user login attempt, scale calibration change, offline sync vector, and role permission alteration to provide total compliance and forensic transparency.',
        fullDescriptionKa: 'სისტემის უცვლელი მოვლენების ჟურნალი: აღრიცხავს მონაცემთა ბაზის ყველა ჩანაწერს, საწყობის ჩამოწერას, ავტორიზაციას, სასწორის კალიბრაციას და ოფლაინ სინქრონიზაციას სრული გამჭვირვალობისთვის.',
        subOptions: [
            { id: 'opt_logs_audit', titleEn: 'Cryptographic Audit Trail', titleKa: 'კრიპტოგრაფიული აუდიტის ისტორია', descriptionEn: 'Tamper-proof event logs recording actor identity, IP, parcel ID, and exact delta values.', descriptionKa: 'დაცული ლოგები მომხმარებლის, დროის, ნაკვეთისა და შეცვლილი მნიშვნელობების ჩვენებით.' }
        ],
        folders: [
            {
                id: 'logs_components',
                nameEn: 'Logs Components',
                nameKa: 'ლოგების კომპონენტები',
                iconName: 'FileText',
                descriptionEn: 'Security events, data sync logs, and scale calibration records.',
                descriptionKa: 'უსაფრთხოების მოვლენები, სინქრონიზაციის ლოგები და სასწორის ჩანაწერები.',
                components: [
                    {
                        id: 'comp_logs_tamper_proof',
                        folderId: 'logs_components',
                        nameEn: 'Tamper-Proof Audit Event Stream',
                        nameKa: 'დაცული აუდიტ-მოვლენების ნაკადი',
                        shortDescEn: 'Searchable log stream of all administrative and financial mutations.',
                        shortDescKa: 'ყველა ადმინისტრაციული და ფინანსური ცვლილების საძიებო ჟურნალი.',
                        fullDocEn: 'Essential for GlobalG.A.P. and organic certification compliance audits.',
                        fullDocKa: 'აუცილებელია GlobalG.A.P. და ორგანული სერტიფიცირების აუდიტის წარმატებით გასავლელად.'
                    }
                ]
            }
        ],
        profitabilityEn: 'Guarantees zero internal data fraud, satisfies export certification audits, and protects enterprise integrity.',
        profitabilityKa: 'გამორიცხავს შიდა თაღლითობას, უზრუნველყოფს საექსპორტო სერტიფიკატების მიღებას და იცავს ბიზნესს.',
        worldFirstAdvantageEn: 'Cryptographically hashed event sequence ensuring historical records cannot be altered retroactively.',
        worldFirstAdvantageKa: 'კრიპტოგრაფიულად დაცული ლოგების ჯაჭვი, რომლის რეტროაქტიულად შეცვლა შეუძლებელია.',
        recommendedFutureUpgradesEn: ['Automated anomaly flag trigger on suspicious midnight data edits.'],
        recommendedFutureUpgradesKa: ['საეჭვო ღამის ჩანაწერებზე ავტომატური გაფრთხილების ჩართვა.'],
        missedGapsEn: ['Syslog export stream to enterprise SIEM platforms.'],
        missedGapsKa: ['Syslog ექსპორტი გარე უსაფრთხოების (SIEM) სისტემებში.'],
        defaultPosition: { x: 960, y: 500 }
    },

    // 16. Founders
    {
        id: 'founders',
        appMode: 'founders',
        nameEn: '16. Founders & Enterprise Governance',
        nameKa: '16. დამფუძნებლები & მმართველობა (Founders)',
        shortDescEn: 'Cap table, equity allocations, investor monthly KPI reports, valuation & expansion modeling.',
        shortDescKa: 'კაპიტალის სტრუქტურა (Cap Table), წილები, ინვესტორთა KPI რეპორტინგი და გაფართოების მოდელირება.',
        iconName: 'Crown',
        color: 'from-amber-700 to-yellow-900',
        category: 'Governance & System',
        fullDescriptionEn: 'The executive governance and shareholder management room. Manages farm cap table, partner equity distributions, investor monthly yield and revenue updates, capital expenditure (CapEx) ROI, and multi-year farm valuation models.',
        fullDescriptionKa: 'დამფუძნებლებისა და ინვესტორების მართვის ცენტრი: კაპიტალის წილები (Cap Table), დივიდენდები, ინვესტორთა ყოველთვიური ანგარიშგება, CapEx ინვესტიციების ROI და ფერმის შეფასება.',
        subOptions: [
            { id: 'opt_founders_captable', titleEn: 'Cap Table & Shareholder Structure', titleKa: 'Cap Table & წილების განაწილება', descriptionEn: 'Visual cap table tracking founder shares, investor equity, and dividend payout history.', descriptionKa: 'დამფუძნებელთა წილები, ინვესტორთა კაპიტალი და დივიდენდების ისტორია.' }
        ],
        folders: [
            {
                id: 'founders_components',
                nameEn: 'Founders Components',
                nameKa: 'დამფუძნებლების კომპონენტები',
                iconName: 'Crown',
                descriptionEn: 'Shareholder equity, investor reports, and valuation models.',
                descriptionKa: 'წილების განაწილება, ინვესტორთა რეპორტები და შეფასების მოდელები.',
                components: [
                    {
                        id: 'comp_founders_investor_kpi',
                        folderId: 'founders_components',
                        nameEn: 'Investor KPI & Yield Dispatch Generator',
                        nameKa: 'ინვესტორთა KPI & მოსავლიანობის რეპორტის გენერატორი',
                        shortDescEn: 'One-click monthly PDF update compiling net harvest tonnage and cost/kg margin.',
                        shortDescKa: 'ყოველთვიური რეპორტი ინვესტორებისთვის ტონაჟისა და თვითღირებულების ჩვენებით.',
                        fullDocEn: 'Provides total transparency to passive equity partners and banking institutions.',
                        fullDocKa: 'უზრუნველყოფს სრულ გამჭვირვალობას პარტნიორებისა და ბანკებისთვის.'
                    }
                ]
            }
        ],
        profitabilityEn: 'Accelerates equity financing and bank loan approvals by providing audit-grade farm valuation models.',
        profitabilityKa: 'აჩქარებს ინვესტიციებისა და აგრო-კრედიტების მოზიდვას ფერმის დადასტურებული შეფასებით.',
        worldFirstAdvantageEn: 'Enterprise valuation dynamically linked to real-time tree count GIS cadastre and cold storage assets.',
        worldFirstAdvantageKa: 'ფერმის ღირებულება ავტომატურად ითვლება ნაკვეთის ხეების რაოდენობისა და მაცივრის აქტივების მიხედვით.',
        recommendedFutureUpgradesEn: ['Multi-currency dividend distribution directly to investor international bank IBANs.'],
        recommendedFutureUpgradesKa: ['დივიდენდების ავტომატური განაწილება ინვესტორთა საერთაშორისო საბანკო ანგარიშებზე.'],
        missedGapsEn: ['Automated virtual boardroom voting protocols for major CapEx decisions.'],
        missedGapsKa: ['ვირტუალური კენჭისყრის პროტოკოლი მსხვილი შესყიდვების დასამტკიცებლად.'],
        defaultPosition: { x: 80, y: 700 }
    },

    // 17. Admin
    {
        id: 'admin',
        appMode: 'admin',
        nameEn: '17. Admin & Permissions',
        nameKa: '17. ადმინისტრირება & წვდომები (Admin)',
        shortDescEn: 'Multi-tenancy, RBAC roles, user licenses, database sync & global system configuration.',
        shortDescKa: 'მრავალორგანიზაციულობა, როლები და უფლებები (RBAC), ლიცენზიები და ბაზის სინქრონიზაცია.',
        iconName: 'ShieldCheck',
        color: 'from-red-700 to-rose-900',
        category: 'Governance & System',
        fullDescriptionEn: 'The root administrative control suite. Configures user roles and granular permissions (Owner, Agronomist, Warehouse Lead, Field Brigade Manager, Picker, Guest), multi-tenant farm accounts, licensing tiers, and offline-sync database settings.',
        fullDescriptionKa: 'ცენტრალური ადმინისტრაციული პანელი: მომხმარებელთა როლები და უფლებები (აგრონომი, მესაწყობე, ბრიგადირი, მკრეფავი), ორგანიზაციები, ლიცენზიები და სინქრონიზაციის წესები.',
        subOptions: [
            { id: 'opt_admin_rbac', titleEn: 'Granular Role-Based Access Control (RBAC)', titleKa: 'როლებზე დაფუძნებული წვდომის კონტროლი (RBAC)', descriptionEn: 'Restrict module visibility and write permissions by exact job responsibility.', descriptionKa: 'მოდულების ხილვადობისა და რედაქტირების შეზღუდვა თანამდებობის მიხედვით.' }
        ],
        folders: [
            {
                id: 'admin_components',
                nameEn: 'Admin Components',
                nameKa: 'ადმინის კომპონენტები',
                iconName: 'ShieldCheck',
                descriptionEn: 'RBAC permissions, user credential management, and multi-tenancy.',
                descriptionKa: 'როლები, მომხმარებლების მართვა და ორგანიზაციული პარამეტრები.',
                components: [
                    {
                        id: 'comp_admin_rbac_matrix',
                        folderId: 'admin_components',
                        nameEn: 'Granular Role Permission Matrix',
                        nameKa: 'წვდომის უფლებების მატრიცა',
                        shortDescEn: 'Drag-and-drop capability mapping for Agronomist, Brigade Lead, and Warehouse Lead.',
                        shortDescKa: 'უფლებების მართვა აგრონომისთვის, ბრიგადირისა და მესაწყობისთვის.',
                        fullDocEn: 'Guarantees field operators only see assigned blocks and hides company financial ledgers from unauthorized staff.',
                        fullDocKa: 'უზრუნველყოფს, რომ მუშაკმა ნახოს მხოლოდ თავისი ნაკვეთი და ფინანსები დარჩეს კონფიდენციალური.'
                    }
                ]
            }
        ],
        profitabilityEn: 'Prevents security leaks, accidental data deletions, and unauthorized cost ledger tampering.',
        profitabilityKa: 'იცავს სისტემას ინფორმაციის გაჟონვისგან, მონაცემების შემთხვევითი წაშლისა და ფინანსების შეცვლისგან.',
        worldFirstAdvantageEn: 'Role boundaries instantly enforce dynamic offline-cache restrictions to prevent unauthorized local data dumps.',
        worldFirstAdvantageKa: 'უფლებების შეზღუდვა მუშაობს ოფლაინ რეჟიმშიც, რაც იცავს ლოკალურ ბაზას არასანქცირებული წვდომისგან.',
        recommendedFutureUpgradesEn: ['Single Sign-On (SSO) with Okta / Google Workspace / Azure AD.'],
        recommendedFutureUpgradesKa: ['SSO ინტეგრაცია Google Workspace / Azure AD სისტემებთან.'],
        missedGapsEn: ['Session timeout auto-lock on shared field tablets.'],
        missedGapsKa: ['საველე პლანშეტზე სესიის ავტომატური დაბლოკვა უმოქმედობის დროს.'],
        defaultPosition: { x: 300, y: 700 }
    },

    // + Other / Custom Features
    {
        id: 'other_custom',
        appMode: 'other_custom',
        nameEn: '18. Other / Custom User-Defined Features',
        nameKa: '18. სხვა / მომხმარებლის ახალი ფუნქციები (Other)',
        shortDescEn: 'Create, test, configure and run AI architectural analysis on custom modules and new tools.',
        shortDescKa: 'შექმენით, შეამოწმეთ და გაანალიზეთ AI-ს მეშვეობით თქვენი ახალი მოდულები და ფუნქციები.',
        iconName: 'Sparkles',
        color: 'from-fuchsia-600 to-pink-700',
        category: 'Custom & Extensions',
        fullDescriptionEn: 'A dynamic extension sandbox enabling farm managers and software architects to introduce custom modules, experimental algorithms, proprietary hardware drivers, or specialized agronomic workflows into the AgriMap Pro architecture graph. Run dedicated AI synthesis on custom features alone or test their synergies with the core platform modules.',
        fullDescriptionKa: 'დინამიური გარემო, სადაც შეგიძლიათ დაამატოთ ნებისმიერი ახალი ფუნქცია, მოდული, აპარატურული დრაივერი ან სპეციფიკური სამუშაო პროცესი. AI გააანალიზებს ამ ახალ ფუნქციას როგორც დამოუკიდებლად (Only It), ისე სისტემის სხვა მოდულებთან სრულ სინერგიაში.',
        subOptions: [
            { id: 'opt_custom_feature_creator', titleEn: 'Custom Feature & Sub-Component Creator', titleKa: 'ახალი ფუნქციების & ქვეკომპონენტების შემქმნელი', descriptionEn: 'Define input schemas, data flows, hardware bridges, and formulas for your own proprietary farm innovations.', descriptionKa: 'განსაზღვრეთ მონაცემთა ნაკადები, ფორმულები და აპარატურული კავშირები თქვენი ახალი იდეებისთვის.' },
            { id: 'opt_custom_standalone_ai', titleEn: 'Dedicated "Only It" AI Strategic Analysis', titleKa: 'მხოლოდ ამ ფუნქციის დამოუკიდებელი AI ანალიზი', descriptionEn: 'Isolate and evaluate a specific custom feature to generate targeted gap analysis, offline sync requirements, and ROI models.', descriptionKa: 'გააანალიზეთ კონკრეტული ახალი ფუნქცია დამოუკიდებლად მისი ეკონომიკური ეფექტისა და არქიტექტურული თავსებადობის შესაფასებლად.', isUniqueInWorld: true }
        ],
        folders: [
            {
                id: 'custom_user_features',
                nameEn: 'User-Added Innovations',
                nameKa: 'მომხმარებლის ინოვაციები',
                iconName: 'Sparkles',
                descriptionEn: 'Custom extensions and workflows registered in the local architecture engine.',
                descriptionKa: 'თქვენ მიერ დამატებული ინოვაციური ფუნქციები და მოდულები.',
                components: [
                    {
                        id: 'comp_custom_default_drone',
                        folderId: 'custom_user_features',
                        nameEn: 'Autonomous Drone Spraying & Multispectral Scouting Bridge',
                        nameKa: 'ავტონომიური აგრო-დრონით შეწამვლა & მულტისპექტრული მონიტორინგი',
                        shortDescEn: 'Automated DJI Agras flight plan dispatch synced with agronomy recipes.',
                        shortDescKa: 'DJI Agras დრონების ფრენის გეგმის ავტომატური ფორმირება წამლობის რეცეპტით.',
                        fullDocEn: 'Sends variable-rate spraying mission files directly to agro-drones and logs chemical volume consumption directly into the warehouse inventory ledger.',
                        fullDocKa: 'უგზავნის დრონს ზუსტ კოორდინატებსა და დოზებს, რის შემდეგაც გახარჯული პესტიციდი ავტომატურად ჩამოიწერება საწყობიდან.',
                        inputsEn: ['Agronomy Spray Recipe', 'GIS Micro-Zoning Shapefile', 'Wind Speed Sensor'],
                        inputsKa: ['წამლობის რეცეპტი', 'GIS მიკრო-ზონირება', 'ქარის სიჩქარის სენსორი'],
                        outputsEn: ['DJI Mission KML', 'Real-time Chemical Stock Deduction', 'Flight Spray Map'],
                        outputsKa: ['DJI ფრენის KML', 'ქიმიის ავტო-ჩამოწერა', 'შესხურების რუკა'],
                        formulaOrLogicEn: 'Spray Volume = Targeted Parcel Area × Variable Canopy Rate (L/HA)',
                        formulaOrLogicKa: 'შესასხური მოცულობა = ნაკვეთის ფართობი × ცვალებადი ნორმა (ლ/ჰა)',
                        hardwareBridgeEn: 'DJI Terra / Agras Cloud API / ArduPilot MAVLink Protocol',
                        hardwareBridgeKa: 'DJI Terra / Agras Cloud API / ArduPilot MAVLink პროტოკოლი',
                        isUniqueInWorld: true,
                        isCustom: true
                    }
                ]
            }
        ],
        profitabilityEn: 'Enables limitless custom automation tailored to specific farm crops, increasing specialized operational efficiency by 25–50%.',
        profitabilityKa: 'იძლევა უსაზღვრო შესაძლებლობებს კონკრეტული მეურნეობისთვის, რაც ზრდის სპეციფიკურ საოპერაციო ეფექტურობას 25-50%-ით.',
        worldFirstAdvantageEn: 'Instant AI architectural synthesis that instantly calculates data flows and economic ROI for user-invented features.',
        worldFirstAdvantageKa: 'მომხმარებლის მიერ დამატებული ნებისმიერი ფუნქციის მყისიერი AI შეფასება, მონაცემთა ნაკადების მიბმა და ROI-ს დათვლა.',
        recommendedFutureUpgradesEn: ['Export custom feature specifications into production TypeScript code templates.'],
        recommendedFutureUpgradesKa: ['ახალი ფუნქციის არქიტექტურის ექსპორტი პირდაპირ TypeScript კოდის შაბლონად.'],
        missedGapsEn: ['Automated sandbox emulator testing before live farm deployment.'],
        missedGapsKa: ['სატესტო ემულატორი ახალი მოდულის რეალურ ფერმაში ჩაშვებამდე.'],
        defaultPosition: { x: 520, y: 700 },
        isCustom: true
    }
];

export const INITIAL_17_MODULE_CONNECTIONS: ModuleConnection[] = [
    { id: 'conn_map_agronomy', fromModuleId: 'map_planner', toModuleId: 'agronomy', labelEn: 'Parcel Micro-Zone Geometry & Varietal Density', labelKa: 'ნაკვეთის ფართობი & ჯიშური ზონირება', type: 'spatial_gis', strength: 5, enabled: true },
    { id: 'conn_map_tasks', fromModuleId: 'map_planner', toModuleId: 'tasks_work', labelEn: 'Target Block Polygons & Tree Count Targets', labelKa: 'სამუშაო ნაკვეთის პოლიგონები & ხეების რაოდენობა', type: 'spatial_gis', strength: 5, enabled: true },
    { id: 'conn_agronomy_stock', fromModuleId: 'agronomy', toModuleId: 'stock', labelEn: 'Fertigation Recipe Bill-of-Materials Auto-Deduction', labelKa: 'სასუქის რეცეპტის ავტომატური ჩამოწერა საწყობიდან', type: 'stock_deduction', strength: 5, enabled: true },
    { id: 'conn_tasks_stock', fromModuleId: 'tasks_work', toModuleId: 'stock', labelEn: 'Field Spraying / Material Depletion on Task Close', labelKa: 'მასალების (სასუქი, ლურსმანი) ჩამოწერა სამუშაოს დახურვისას', type: 'stock_deduction', strength: 5, enabled: true },
    { id: 'conn_tasks_accounting', fromModuleId: 'tasks_work', toModuleId: 'accounting', labelEn: 'Logged Field Labor Hours & Pruned Trees Ledger', labelKa: 'ნამუშევარი საათებისა და შესრულებული სამუშაოს ხელფასები', type: 'payroll_labor', strength: 5, enabled: true },
    { id: 'conn_harvest_accounting', fromModuleId: 'harvest', toModuleId: 'accounting', labelEn: 'Certified Net Weight Picker Balances & Cost per KG', labelKa: 'დაკრეფილი კილოგრამების ხელფასი & თვითღირებულება', type: 'payroll_labor', strength: 5, enabled: true },
    { id: 'conn_harvest_stock', fromModuleId: 'harvest', toModuleId: 'stock', labelEn: 'Harvest Crate Circulation & Cold Storage Intake', labelKa: 'საკრეფი ყუთების ბრუნვა & მაცივრის ნაშთები', type: 'stock_deduction', strength: 5, enabled: true },
    { id: 'conn_harvest_marketplace', fromModuleId: 'harvest', toModuleId: 'marketplace', labelEn: 'Verified Cold Storage Lots Direct B2B Listing', labelKa: 'მაცივარში შენახული ლოტების პირდაპირი გაყიდვა', type: 'data', strength: 4, enabled: true },
    { id: 'conn_ai_dashboard', fromModuleId: 'ai', toModuleId: 'dashboard', labelEn: 'Continuous Anomaly Diagnostic Stream & Alert Feed', labelKa: 'AI ანომალიების უწყვეტი ნაკადი & გაფრთხილებები', type: 'ai_telemetry', strength: 5, enabled: true },
    { id: 'conn_planner_tasks', fromModuleId: 'planner', toModuleId: 'tasks_work', labelEn: 'Calendar Schedule Dispatch to Field Brigades', labelKa: 'დაგეგმილი სამუშაოების გაცემა ბრიგადებზე', type: 'data', strength: 4, enabled: true },
    { id: 'conn_labs_agronomy', fromModuleId: 'labs', toModuleId: 'agronomy', labelEn: 'Soil Chemistry pH/EC Calibrated Recipe Dosing', labelKa: 'ნიადაგის ანალიზით სასუქის დოზის კორექცია', type: 'data', strength: 5, enabled: true },
    { id: 'conn_stock_accounting', fromModuleId: 'stock', toModuleId: 'accounting', labelEn: 'Direct Charges & Packaging Material Valuation', labelKa: 'საწყობის მასალების თვითღირებულებაში ასახვა', type: 'payroll_labor', strength: 4, enabled: true }
];
