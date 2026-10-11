
export type AppMode = 'dashboard' | 'ai' | 'design' | 'community' | 'marketplace' | 'system' | 'agronomy' | 'harvesting' | 'stock' | 'accounting' | 'founders' | 'tools' | 'tasks' | 'personalization' | 'admin' | 'invitations' | 'logs' | 'profile' | 'onboarding' | 'labs' | 'guide';

export type NetworkMode = 'cloud' | 'local' | 'offline';

export type UserRole = 'Guest' | 'Employee' | 'Buyer' | 'Agro-Agent' | 'Accountant' | 'Agronomist' | 'Admin' | 'Founder' | 'Co-Founder' | 'ROOT_SUPER_ADMIN' | 'seller' | 'planter' | 'worker' | 'Agro-Shop' | 'company' | 'Independent' | 'Field Manager' | 'Daily Worker' | 'Foreman';
export type SubscriptionTier = 'Free' | 'Pro' | 'Enterprise';
export type SubscriptionStatus = 'Trial' | 'Paid' | 'Unpaid';

export type OrganizationType = 'LTD' | 'Cooperative' | 'Individual Entrepreneur';
export type AgricultureType = 'Blueberry' | 'Lemon' | 'Hazelnut' | 'Grape' | 'General' | 'Other';

export interface SubscriptionRequest {
    id: string;
    organizationId?: string;
    userId: string;
    planId: string;
    status: 'pending' | 'approved' | 'rejected' | 'modified';
    requestedAt: string;
    approvedAt?: string;
    adminComment?: string;
    modifiedPrice?: number;
    modifiedExpiry?: string;
}

export interface Location {
    id?: string | number;
    place_id?: number;
    lat: number;
    lon: number;
    lng?: number;
    display_name?: string;
    name?: string;
    type?: string;
}

export interface Invitation {
    fromId: string;
    fromName: string;
    status: 'pending' | 'accepted' | 'ignored';
    timestamp: string;
}

export interface Organization {
    id: string;
    uniqueId: string; // New: Unique ID like Comp01023
    type: OrganizationType;
    name: string;
    legalName: string;
    registrationNumber: string;
    taxNumber: string; // TAX-iD number
    establishmentDate?: string;
    agricultureType: AgricultureType;
    country: string;
    region?: string; // New: region
    location?: [number, number];
    areaGeometry?: [number, number][];
    areaHa?: number; // New: area size
    legalStructure?: string; // New: ltd, etc.
    isDiscoverable: boolean;
    createdBy: string;
    createdAt: string;
    status: 'active' | 'archived' | 'suspended' | 'blocked' | 'paused';
    isPaused?: boolean;
    trial_start_date: string;
    trialExpiry: string;
    isPaid: boolean;
    tier: SubscriptionTier;
    subscriptionStatus: SubscriptionStatus;
    subscriptionPlan?: string; // New: per year, etc.
    discount?: number;
    payrollConfig?: { rate: number; frequency: string; };
    subscriptionExpiry?: string;
    price?: number;
    identificationCode?: string;
    phoneNumber?: string;
    email?: string;
    crops?: string[]; // Multiple crops selected for the plantation e.g. ['Apple', 'Lemons']
    plantationCrops?: string[]; // Array of selected crops for plantation
}

export interface Membership {
    id: string;
    userId: string;
    organizationId: string;
    role: UserRole;
    permissionLevel: 'read' | 'write' | 'admin';
    isGlobalRegistrationAgreed?: boolean;
    status: 'active' | 'invited' | 'suspended' | 'pending';
    joinedAt: string;
}

export interface Crop {
    id: string;
    organizationId: string;
    name: string;
    varieties: string[];
}

export type UserGoal = 'EXPLORE_GUEST' | 'OFFER_SERVICE' | 'BUY_PRODUCTS' | 'BECOME_AGENT' | 'MANAGE_COMPANY';

export interface WorkExperience {
    id: string;
    title: string;
    company: string;
    startDate: string;
    endDate: string;
    location?: string;
    locationCoords?: [number, number];
    isCompanyRole?: boolean;
    organizationId?: string;
    isDiscoverable?: boolean;
    isPublic?: boolean;
    workZone?: any;
    rating?: number;
    description?: string;
}

export interface User {
    id: string;
    globalUniqueId: string; // G-001 (Master Identity)
    individualUniqueId?: string; // I-001 (Freelance/Tools)
    companyUniqueId?: string; // C-001 (Founder/Employee)
    workerUniqueId?: string; // W-001 (Daily Worker)
    activeRole: 'individual' | 'company' | 'worker' | 'guest';
    firstName?: string;
    lastName?: string;
    name: string;
    email: string;
    avatar?: string;
    password?: string;
    phone?: string;
    personalNumber?: string;
    identificationNumber?: string;
    taxNumber?: string;
    isGlobalAccount?: boolean; 
    isGlobalProfile?: boolean;
    tier?: SubscriptionTier;
    subscriptionStatus?: SubscriptionStatus;
    subscriptionType?: string;
    subscriptionExpiry?: string;
    currentOrgId?: string | null;
    verificationStatus: 'unverified' | 'verified' | 'full_verified';
    isVerified?: boolean;
    kycStatus: 'none' | 'pending' | 'approved' | 'rejected';
    establishmentDate?: string;
    isProfileDiscoverable: boolean;
    isPubliclyVisible?: boolean;
    status: 'active' | 'suspended' | 'blocked' | 'deleted' | 'free' | 'busy';
    roles: UserRole[];
    role?: string;
    assignedPickers?: string[];
    assignedVehicles?: string[];
    createdAt: string;
    isGuest?: boolean;
    professions?: string[];
    primaryGoal?: UserGoal;
    region?: string;
    country?: string;
    companyName?: string;
    aiQueryCount: number;
    invitations?: Invitation[];
    location?: [number, number];
    workingArea?: {
        center: [number, number];
        radius: number;
        geometry?: any;
        isDiscoverable?: boolean;
        name?: string;
        isActive?: boolean;
    };
    publicData?: {
        description?: string;
    };
    servicesOffered?: string[];
    cv?: {
        experience?: WorkExperience[];
        education?: string[];
        skills?: string[];
        certifications?: string[];
        availability?: 'full-time' | 'part-time' | 'contract';
        preferredRegions?: string[];
    };
    agentData?: {
        capacity: number;
        team?: { id: string; name: string; phone: string; }[];
    };
    buyerPreferences?: {
        isCorporate: boolean;
        preferredCrops: string[];
        volume: string;
        companyName?: string;
    };
    availability?: 'Available' | 'Unavailable';
    lastActive?: string;
    lastSeen?: string; // High-frequency presence indicator
    visibleModules?: AppMode[];
    discount?: number;
    isFree?: boolean;
    price?: number;
    payrollConfig?: { rate: number; frequency: string; };
    workRecords?: WorkRecord[];
}

export interface WorkRecord {
    id: string;
    userId: string;
    organizationId: string;
    organizationName: string;
    date: string;
    workType: string;
    amountHarvested?: number;
    moneyEarned: number;
    status: 'completed' | 'ongoing';
}

export interface SystemLog {
    id: string;
    timestamp: string;
    organizationId?: string | null;
    userId: string;
    userName?: string;
    action: string;
    module: AppMode;
    status: 'success' | 'failure' | 'alert';
    report?: string;
}

// Map / Design Types
export type FeatureType = 'area' | 'line' | 'seedling' | 'note' | 'sector' | 'checkpoint' | 'boundary' | 'trench' | 'irrigation_line' | 'pencil' | 'camera' | 'drone_path';
export type DrawingTool = FeatureType | 'measure' | 'pencil' | 'camera' | 'drone_path';

export interface ActiveDrawingTool {
    tool: DrawingTool | null;
    color?: string;
    priority?: 'urgent' | 'high' | 'medium' | 'low';
    activeLayerId?: string;
    context?: any;
    metadata?: any;
}

export interface Layer {
    id: string;
    name: string;
    isFolder: boolean;
    isVisible: boolean;
    parentId?: string;
    organizationId?: string;
    createdBy?: string;
}

export interface BasePlantationFeature {
    id: string;
    name: string;
    type: FeatureType;
    layerId: string;
    parentId?: string;
    isVisible?: boolean;
    color?: string;
    customColor?: string;
    priority?: 'low' | 'medium' | 'high' | 'urgent';
    status?: string;
    organizationId?: string;
    createdBy?: string;
    notes?: string;
    zIndex?: number;
    inventoryItemId?: string;
    inventoryQuantity?: number;
    isDraft?: boolean;
    isSimulated?: boolean;
    isPencil?: boolean;
    subType?: string;
    comment?: string;
    showCommentOnMap?: boolean;
    bundledLines?: LinePlantationFeature[];
}

export interface AreaPlantationFeature extends BasePlantationFeature {
    type: 'area' | 'sector';
    geometry: [number, number][];
    cropType?: string;
    cropVariety?: string[];
    plantCount?: number;
    defaultTrenchSpacing?: number;
    defaultPlantSpacing?: number;
    defaultTrenchDirection?: number;
    bundledLines?: LinePlantationFeature[];
}

export interface LinePlantationFeature extends BasePlantationFeature {
    type: 'line' | 'trench' | 'irrigation_line';
    geometry: [number, number][];
    lineType?: LineType;
    widthMeters?: number;
    defaultPlantSpacing?: number;
    calculatedPlantCount?: number;
    bundledSeedlings?: SeedlingPlantationFeature[];
}

export type LineType = 'row' | 'path' | 'road' | 'irrigation';

export type SeedlingCondition = 'Good' | 'Suspicious' | 'Dried';
export const SEEDLING_CONDITIONS: SeedlingCondition[] = ['Good', 'Suspicious', 'Dried'];

export interface SeedlingPlantationFeature extends BasePlantationFeature {
    type: 'seedling';
    geometry: [number, number];
    condition: SeedlingCondition;
    cropVariety?: string;
}

export interface NotePlantationFeature extends BasePlantationFeature {
    type: 'note';
    geometry: [number, number];
    notes?: string;
    monitoringType?: 'checkpoint' | 'camera' | 'sensor';
    iconSize?: number;
}

export interface CheckpointPlantationFeature extends BasePlantationFeature {
    type: 'checkpoint';
    geometry: [number, number];
    status?: 'pending' | 'completed';
    date?: string;
}

export interface BoundaryPlantationFeature extends BasePlantationFeature {
    type: 'boundary';
    geometry: [number, number][];
}

export interface CameraPlantationFeature extends BasePlantationFeature {
    type: 'camera';
    geometry: [number, number];
    channel?: number;
    model?: string;
    ipAddress?: string;
    rtspPort?: number;
    streamUrl?: string;
    mountHeightM?: number;
    azimuthDeg?: number;
    fovAngleDeg?: number;
    rangeM?: number;
    tiltAngleDeg?: number; // e.g. 4 degrees down-tilt
    isPtz?: boolean;
    isNightVision?: boolean;
    status?: 'ONLINE' | 'STANDBY' | 'RECORDING';
}

export interface DroneMissionPlantationFeature extends BasePlantationFeature {
    type: 'drone_path';
    geometry: [number, number][]; // Sequence of waypoints: takeoff -> outbound -> return
    missionType?: 'waypoints' | 'circle_sector';
    altitudeM?: number;
    speedMs?: number;
    timeIntervalSec?: number;
    headingDeg?: number;
    circleCenter?: [number, number];
    circleRadiusM?: number;
    status?: 'planned' | 'in_flight' | 'completed';
}

export type PlantationFeature = 
    | AreaPlantationFeature 
    | LinePlantationFeature 
    | SeedlingPlantationFeature 
    | NotePlantationFeature 
    | CheckpointPlantationFeature 
    | BoundaryPlantationFeature
    | CameraPlantationFeature
    | DroneMissionPlantationFeature;

export interface Template {
    id: string;
    name: string;
    features: PlantationFeature[];
}

export interface Project {
    id: string;
    name: string;
    createdAt: string;
    data: ProjectData;
}

export interface OrganizationTicket {
    id: string;
    organizationId: string;
    name: string;
    role: string;
    status: 'Active' | 'Archived';
    years?: string;
    discoverable: boolean;
}

export interface ProjectData {
    mapCenter: [number, number];
    zoom: number;
    appMode: AppMode;
    dashboardLayout: DashboardWidget[];
    plantationFeatures: PlantationFeature[];
    workAssignments: WorkAssignment[];
    employees: Employee[];
    inventoryItems: InventoryItem[];
    harvestEvents: HarvestEvent[];
    dailyLogs: DailyLogEntry[];
    listings: Listing[];
    analysisResult?: AnalysisResult | null;
    sources?: GroundingSource[];
    selectedLocation?: [number, number] | null;
    searchedLocation?: Location | null;
    soilAnalysisResult?: SoilAnalysisResult | null;
    userPlaces?: any[];
    inventoryTransactions?: InventoryTransaction[];
    machinery?: Machinery[];
    harvestEntries?: HarvestEntry[];
    harvestLogs?: HarvestLog[];
    nutritionPlans?: NutritionPlan[];
    planExecutions?: PlanExecution[];
    layers?: Layer[];
    accounts?: Account[];
    transactions?: Transaction[];
    systemLogs?: SystemLog[];
    employeeGroups?: EmployeeGroup[];
    forumPosts?: ForumPost[];
    bids?: Bid[];
    reviews?: Review[];
    alerts?: Alert[];
    pallets?: Pallet[];
    operationalLogs?: OperationalLog[];
    activeOrgId?: string | null;
    localServerConfig?: LocalServerConfig;
}

export interface LocalServerConfig {
    isLocalMode: boolean;
    serverIp: string; // e.g. "192.168.1.100"
    serverPort?: number; // Port of client connection (typically 3000)
    firestorePort?: number; // Port for Firestore emulator
    authPort?: number; // Port for Auth emulator
    dataFolder?: string; // Path for desktop sync
    autoDiscovery: boolean;
}

export interface AssistantMessage {
    id: string;
    text: string;
    type: 'user' | 'bot' | 'error';
    timestamp?: string;
}

export interface WeatherData {
    current: { temperature: number; windspeed: number; weathercode: number };
    forecast: { time: string[]; weathercode: number[]; temperature_2m_max: number[]; temperature_2m_min: number[] };
    description: string;
    icon: any;
}

export interface DashboardWidget {
    id: string;
    type: DashboardWidgetType | 'custom_stat' | 'custom_text';
    title: string;
    isVisible: boolean;
    order: number;
    content?: any;
    colSpan?: 1 | 2 | 3;
    heightPx?: number;
}

export type DashboardWidgetType = 'attendance' | 'market_feed' | 'seedling_health' | 'harvest_pulse' | 'daily_news' | 'weather' | 'field_summary' | 'tasks' | 'planner' | 'hardware_labs' | 'team_hubs' | 'guest_stats' | 'seedling_stats' | 'seedling_summary' | 'crops_summary' | 'choose_goal' | 'agronomy_quick';

export interface GroundingSource {
    web?: { uri: string; title: string };
    maps?: { uri: string; title: string };
}

export interface AnalysisResult {
    summary: string;
    topLocations: string[];
    keyCompanies: string[];
    marketInsights: { profitability: string; statistics: string };
    potentialBuyers: string[];
}

export interface SoilData {
    ph?: number;
    nitrogen?: number;
    phosphorus?: number;
    potassium?: number;
}

export interface SoilAnalysisResult {
    analysis: string;
    recommendations: string[];
}

export interface PurchaseDocumentAnalysis {
    supplierName?: string;
    date?: string;
    totalAmount?: number;
    lineItems: {
        description: string;
        quantity: number;
        unitPrice: number;
        totalPrice: number;
        vat?: number;
    }[];
    fullTranslation?: string;
}

export interface TransactionDocumentAnalysis {
    date?: string;
    amount?: number;
    description?: string;
    documentNumber?: string;
    senderName?: string;
    senderBank?: string;
    senderAccount?: string;
    receiverName?: string;
    receiverBank?: string;
    receiverAccount?: string;
    fullTranslation?: string;
}

export interface MarketplaceItemAnalysis {
    quality: string;
    mainFeatures: string[];
    characteristics: string[];
    estimatedValue: string;
}

export interface PlantDiseaseAnalysis {
    diseaseName: string;
    confidence: number;
    description: string;
    treatmentSuggestions: string[];
}

export interface SustainabilityTip {
    title: string;
    content: string;
}

export interface AiReport {
    suitabilityRanking: SuitabilityItem[];
    agroCultureRecommendation: string;
    climateAnalysis: string;
    soilAnalysis: string;
}

export interface SuitabilityItem {
    crop: string;
    suitability: string;
    reason: string;
}

export interface AgroCultureAnalysis {
    analysisId: string;
    userId: string;
    locationGeo: { lat: number; lng: number };
    pHLevel: number;
    nitrogenLevel: number;
    phosphorusLevel: number;
    potassiumLevel: number;
    targetCultureQuestion: string;
    timestamp: string;
    aiReport: AiReport | null;
}

export interface UploadedDocument {
    id: string;
    fileName: string;
    content: string;
    file: File;
}

export interface Note {
    id: string;
    content: string;
    timestamp: string;
    organizationId: string;
    authorId: string;
    authorName: string;
    location?: { lat: number; lng: number };
    featureId?: string; // If attached to a map feature
    taskId?: string; // If linked to a work assignment
    status?: 'active' | 'archived' | 'completed';
    moduleName?: string; // e.g. 'Harvest', 'Stock', 'Agronomy', 'Maps', 'Planner', 'Tasks', 'Payroll', etc.
    tags?: string[];
    isVoiceNote?: boolean;
    language?: 'ka-GE' | 'en-US' | string;
    audioTranscript?: string;
}

export interface Checkpoint {
    id: string;
    name: string;
    location: { lat: number; lng: number };
    status: 'pending' | 'completed';
    timestamp: string;
    organizationId: string;
    featureId?: string; // If attached to a map feature
    taskId?: string; // If linked to a work assignment
}

export type Permission = 'edit_work' | 'edit_machinery' | 'edit_employees' | 'edit_roles' | 'view_accounting' | 'admin_access' | 'access_harvesting' | 'use_weigh_station' | 'access_stock' | 'access_accounting' | 'access_system';
export const ALL_PERMISSIONS: Permission[] = ['edit_work', 'edit_machinery', 'edit_employees', 'edit_roles', 'view_accounting', 'admin_access', 'access_harvesting', 'use_weigh_station', 'access_stock', 'access_accounting', 'access_system'];

export interface Role {
    id: string;
    name: string;
    permissions: Permission[];
}

export type EmployeeType = 'Permanent' | 'Contract' | 'Seasonal' | 'Temporary';
export const EMPLOYEE_TYPES: EmployeeType[] = ['Permanent', 'Contract', 'Seasonal', 'Temporary'];

export type AccountType = 'Bank Account' | 'Cash' | 'Mobile Money';
export const ACCOUNT_TYPES: AccountType[] = ['Bank Account', 'Cash', 'Mobile Money'];

export type PaymentType = 'hourly' | 'daily' | 'per_weight' | 'salary' | 'combined' | 'by_person' | 'by_car' | 'fixed' | 'custom';
export const PAYMENT_TYPES: PaymentType[] = ['hourly', 'daily', 'per_weight', 'salary', 'combined', 'by_person', 'by_car', 'fixed', 'custom'];

export interface Employee {
    id: string;
    name: string;
    idNumber: string;
    employeeType: EmployeeType;
    email: string;
    phone: string;
    roleId: string;
    role?: string;
    assignedPickers?: string[];
    assignedVehicles?: string[];
    paymentType: PaymentType;
    paymentRate: number;
    accountType: AccountType;
    barcode?: string;
    notes?: string;
    visibleModules?: string[];
    password?: string;
    status: 'active' | 'inactive' | 'suspended';
    joinedAt: string;
    organizationId?: string;
    isGlobalUser?: boolean; // New: Global user or local worker
    hardwareCredentials?: {
        type: 'NFC Card' | 'NFC Bracelet' | 'RFID Tag';
        serialNumber: string;
    };
    employeeCodeOverride?: string; // Manual override for QR/Labs
    age?: number;
    sex?: string;
    isGeorgianCitizen?: boolean;
}

export interface EmployeeGroup {
    id: string;
    organizationId: string;
    name: string;
    employeeIds: string[];
}

export type TaskStatus = 'planned' | 'active' | 'in-progress' | 'completed' | 'paused';
export type TaskType = 'Irrigation' | 'Fertilization' | 'Pesticide' | 'Harvest' | 'Pruning' | 'Planting' | 'Other';
export const TASK_TYPES: TaskType[] = ['Irrigation', 'Fertilization', 'Pesticide', 'Harvest', 'Pruning', 'Planting', 'Other'];

export interface WorkAssignmentAuditEntry {
    id?: string;
    timestamp: string;
    userName: string;
    userEmail?: string;
    action: string;
    details?: string;
    fieldChanged?: string;
    oldValue?: string;
    newValue?: string;
}

export interface WorkAssignment {
    id: string;
    organizationId?: string;
    workName: string;
    date: string;
    status: TaskStatus;
    taskType: TaskType;
    assignedEmployeeIds: string[];
    employeeHours?: EmployeeWorkLog[];
    sectorIds: string[];
    complexity?: 'solo' | 'team';
    plannedTime?: number;
    plannedHours?: number;
    priority?: 'low' | 'medium' | 'high' | 'urgent';
    color?: string;
    createdAt?: string;
    totalLaborCost?: number;
    totalMaterialCost?: number;
    totalCost?: number;
    notes?: string;
    source?: 'tasks' | 'planner';
    checkpointId?: string;
    linkedFeatureId?: string;
    attachedFileUrls?: string[];
    addToWorkAssignment?: boolean;
    logisticsRecords?: any[];
    assignedVehicles?: AssignedVehicle[];
    materialsUsed?: MaterialUsed[];
    changeHistory?: WorkAssignmentAuditEntry[];
    reminderSettings?: {
        enabled: boolean;
        offsetMinutes: number;
        type: 'email' | 'notification';
    };
    trenchRange?: string;
    measuredAreaM2?: number;
    totalAreaCovered?: number;
}

export interface EmployeeWorkLog {
    employeeId: string;
    hours: number;
    rate?: number;
    bonus?: number;
    totalPay?: number;
    overtimeHours?: number;
    notes?: string;
}

export interface Machinery {
    id: string;
    name: string;
    type: string;
    status: 'operational' | 'maintenance' | 'out-of-service';
    isOwned: boolean;
    hourlyRate?: number;
    fuelConsumption?: number;
    fuelItemId?: string;
    ownership?: 'owned' | 'rented';
    foremanId?: string;
    vehicleCategory?: 'passenger' | 'cargo' | 'tractor' | 'inventar';
    passengerCapacity?: number;
    cargoPurpose?: string;
    payloadCapacity?: number;
    enginePower?: string;
    implements?: string[];
    toolCategory?: string;
    baseCostRate?: number;
}

export interface OperationalLog {
    id: string;
    organizationId?: string;
    workAssignmentId: string;
    date: string;
    geometry: [number, number][];
    notes: string;
    areaHa: number;
    sectorId?: string;
    sectorName?: string;
    trenchRange?: string;
    trenchCount?: number;
    cropCount?: number;
    measuredDistanceM?: number;
    measuredAreaM2?: number;
    materialsUsed?: MaterialUsed[];
    assignedVehicles?: AssignedVehicle[];
    changeHistory?: WorkAssignmentAuditEntry[];
}

export interface DailyLogEntry {
    id: string;
    employeeId: string;
    date: string;
    logType: 'Present' | 'Absent' | 'Late';
}

export type InventoryCategory = 
    | 'Fertilizers' 
    | 'Pesticides' 
    | 'Chemicals' 
    | 'Bio-stimulants' 
    | 'Seeds' 
    | 'Fuel' 
    | 'Packaging' 
    | 'Pallets' 
    | 'Machinery' 
    | 'Tools' 
    | 'Fixed Assets' 
    | 'Spare Parts' 
    | 'Construction' 
    | 'Consumables' 
    | 'Produce' 
    | 'Other'
    | 'Uncategorized'
    | (string & {});

export const INVENTORY_CATEGORIES: InventoryCategory[] = [
    'Fertilizers', 
    'Pesticides', 
    'Chemicals', 
    'Bio-stimulants', 
    'Seeds', 
    'Packaging', 
    'Pallets', 
    'Fuel', 
    'Spare Parts', 
    'Construction', 
    'Consumables', 
    'Tools', 
    'Machinery', 
    'Fixed Assets', 
    'Produce', 
    'Other',
    'Uncategorized'
];

export interface CategoryGroupsMap {
    agroinputs: InventoryCategory[];
    supplies: InventoryCategory[];
    machinery: InventoryCategory[];
    farming: InventoryCategory[];
    materials: InventoryCategory[];
}

export const CATEGORY_GROUPS: CategoryGroupsMap = {
    agroinputs: ['Fertilizers', 'Pesticides', 'Chemicals', 'Bio-stimulants', 'Seeds'],
    supplies: ['Packaging', 'Pallets', 'Fuel', 'Spare Parts', 'Construction', 'Consumables', 'Tools', 'Other'],
    machinery: ['Machinery', 'Fixed Assets', 'Tools'],
    farming: ['Fertilizers', 'Pesticides', 'Chemicals', 'Bio-stimulants', 'Seeds'],
    materials: ['Packaging', 'Pallets', 'Fuel', 'Spare Parts', 'Construction', 'Consumables', 'Tools', 'Other'],
};

export interface RefrigeratorSaleRecord {
    saleId: string;
    saleDate: string;
    soldNetKg: number;
    pricePerKg: number;
    totalRevenue: number;
    buyerName: string;
    varietiesSold?: { variety: string; kg: number; pricePerKg?: number }[];
    palletsSold?: number;
    boxesSold?: number;
    punnetsSold?: number;
    transportType?: 'BUYER' | 'OWNER';
    vehicleInfo?: string;
    driverName?: string;
    driverCost?: number;
    loadersCount?: number;
    loadersNames?: string;
    loadersCost?: number;
    paymentType?: 'CASH' | 'LTD';
    paymentMode?: 'HAND' | 'BANK';
    paymentRecipient?: string;
    notes?: string;
}

export interface RefrigeratorLot {
    id: string;
    lotNumber: string;
    organizationId?: string;
    harvestEventId?: string;
    harvestEventName?: string;
    harvestDate: string;
    arrivalDateTime: string;
    arrivalDayPricePerKg: number;
    totalNetKg: number;
    remainingNetKg: number;
    varietiesBreakdown?: { variety: string; initialKg: number; remainingKg: number }[];
    palletsType?: 'Euro' | 'Ordinary' | 'Standard' | 'Other';
    palletsCount?: number;
    boxesCount?: number;
    punnetsCount?: number;
    loadersType?: 'OUR_TEAM' | 'REFRIGERATOR_SERVICE' | 'MIXED';
    loaderCount?: number;
    loaderNames?: string;
    loaderCost?: number;
    roomPlacementNotes?: string;
    status: 'IN_REFRIGERATOR' | 'PARTIALLY_SOLD' | 'FULLY_SOLD';
    salesHistory?: RefrigeratorSaleRecord[];
}

export interface SubStock {
    id: string;
    organizationId?: string;
    name: string;
    code: string;
    locationDescription?: string;
    managerName?: string;
    contactPhone?: string;
    isMain?: boolean;
    connectedToMain?: boolean;
    color?: string;
    notes?: string;
    createdAt?: string;
}

export interface InventoryItem {
    id: string;
    organizationId?: string;
    name: string;
    sku?: string;
    category: InventoryCategory;
    description?: string;
    unitOfMeasure: string;
    currentStock: number;
    minStockThreshold: number;
    location?: string;
    subStockId?: string;
    subStockName?: string;
    unitCost: number;
    supplierId?: string;
    avgTareWeightKg?: number;
    packageContent?: number;
    packageContentUnit?: string;
    seedInfo?: string;
    isPrivate?: boolean;
    relatedHarvestId?: string;
    machineryDetails?: {
        ownership?: 'owned' | 'rented';
        vehicleCategory?: string;
        passengerCapacity?: number;
        cargoPurpose?: string;
        payloadCapacity?: number;
        enginePower?: string;
        toolCategory?: string;
        baseCostRate?: number;
        foremanId?: string;
    };
    status?: string;
    tags?: string[];
    harvestIdentifier?: string;
    batch_id?: string;
    rate?: number;
    depositLLC?: number;
    physicalCash?: number;
    variety?: string;
    varietyKg?: number;
    variety2Kg?: number;
    depositedDeposit?: boolean;
    date?: string;
    buyer?: string;
    physicalBoxes?: number;
    physicalPunnets?: number;
    soldKg?: number;
    coldStorageKg?: number;
    coldStoragePrice?: number;
    coldStorageLocation?: string;
    transportCost?: number;
    transportLocation?: string;
    fulfillmentType?: 'DIRECT_WHOLESALE' | 'PARTLY_SOLD' | 'REFRIGERATOR';
    transportType?: 'BUYER' | 'OWNER';
    vehicleInfo?: string;
    driverName?: string;
    driverCost?: number;
    loadersCount?: number;
    loadersNames?: string;
    loadersCost?: number;
    materialsCost?: number;
    materialsDescription?: string;
    needsTransport?: boolean;
    daysInStorage?: number;
    harvestOpex?: number;
    netRevenue?: number;
    paymentType?: 'CASH' | 'LTD';
    paymentMode?: 'HAND' | 'BANK';
    paymentRecipient?: string;
    bankTransferReference?: string;
    varietiesBreakdown?: { variety: string; kg: number; boxes?: number; punnets?: number; pricePerKg?: number }[];
    buyersList?: { id: string; name: string; variety?: string; weightKg: number; pricePerKg?: number; totalAmount?: number }[];
    refrigeratorLot?: RefrigeratorLot;
    paidOpex?: number;
    paidSalary?: number;
}

export type StockChargeReasonCategory = 
    | 'DAMAGED_OR_SPILLED' 
    | 'UNLOGGED_TREATMENT_OR_FEEDING' 
    | 'SOLD_DIRECTLY' 
    | 'EXPIRED_OR_DEGRADED' 
    | 'INVENTORY_AUDIT_ADJUSTMENT' 
    | 'DONATION_OR_TRANSFER' 
    | 'OTHER';

export interface StockTransaction {
    id: string;
    organizationId: string;
    itemId: string;
    date: string;
    type: 'ADDITION' | 'DEDUCTION' | 'REFUND';
    quantity: number;
    sourceModule: 'AGRONOMY' | 'HARVEST' | 'TASKS' | 'MAP' | 'FLEET' | 'MANUAL' | 'DIRECT_CHARGE';
    referenceId?: string;
    reason?: string;
    // Direct Charge Audit & Tracking Fields
    chargeCategory?: StockChargeReasonCategory | string;
    chargedByUserId?: string;
    chargedByUserName?: string;
    responsibleEmployeeId?: string;
    responsibleEmployeeName?: string;
    note?: string;
    unitPriceAtCharge?: number;
    totalCostCharged?: number;
    stockBeforeCharge?: number;
    stockAfterCharge?: number;
    unitOfMeasure?: string;
    packageQuantityCharged?: number;
    massVolumeCharged?: number;
}

export interface HarvestedProduce {
    id: string;
    organizationId: string;
    session_id: string;
    start_time: string;
    end_time: string;
    total_kg: number;
    worker_salary_total: number;
    stock_material_charge: number;
    final_sale_price: number | null;
    commercial_status: 'WAITING_FOR_MARKET_SALE' | 'SOLD_VIA_MARKET' | 'DIRECT_SALE' | 'COLD_STORAGE';
    market_identifier?: string;
    crop?: string;
}

export interface InventoryTransaction {
    id: string;
    itemId: string;
    date: string;
    type: 'in' | 'out' | 'adjustment';
    quantity: number;
    reason?: string;
    relatedPurchaseId?: string;
    relatedWorkAssignmentId?: string;
    chargedByUserName?: string;
    chargedByUserId?: string;
    chargeCategory?: string;
    note?: string;
    totalCost?: number;
}

export interface Supplier {
    id: string;
    name: string;
    contactPerson?: string;
    email?: string;
    phone?: string;
    taxId?: string;
    address?: string;
    notes?: string;
}

export type PurchaseDocumentType = 'Invoice from Company' | 'IE Agreement' | 'Cash Receipt';
export const PURCHASE_DOCUMENT_TYPES: PurchaseDocumentType[] = ['Invoice from Company', 'IE Agreement', 'Cash Receipt'];

export interface PurchaseOrder {
    id: string;
    supplierId: string;
    supplierName?: string;
    date: string;
    expectedDate?: string;
    items: PurchaseOrderItem[];
    totalCost: number;
    status: 'Draft' | 'Pre-order' | 'Ordered' | 'Received' | 'Returned' | 'Cancelled';
    notes?: string;
    documentUrl?: string;
    documentAnalysis?: PurchaseDocumentAnalysis | null;
    documentType: PurchaseDocumentType;
    targetSubStockId?: string;
    targetSubStockName?: string;
    returnReason?: string;
    refundAmount?: number;
}

export interface PurchaseOrderItem {
    inventoryItemId: string;
    itemName?: string;
    description?: string;
    quantity: number;
    unitCost: number;
    vat: number;
    addToStock: boolean;
    barcode?: string;
    category?: string;
}

export type StockDocumentCategory = 
    | 'forms' 
    | 'templates' 
    | 'agreements' 
    | 'images' 
    | 'analysis' 
    | 'invoices' 
    | 'certificates' 
    | 'plantation_photos' 
    | 'lab_reports' 
    | 'contracts' 
    | 'other';

export interface StockDocument {
    id: string;
    title: string;
    category: StockDocumentCategory;
    fileUrl: string;
    fileType: string;
    fileSize?: string;
    date: string;
    notes?: string;
    tags?: string[];
    linkedSectorId?: string;
    linkedSectorName?: string;
    linkedItemId?: string;
    linkedItemName?: string;
    uploadedAt: number;
}

export type NutritionPlanPurpose = 'Feeding' | 'Treatment' | 'Irrigation' | 'Other';

export interface RecipeTankIngredient {
    inventoryItemId?: string;
    name: string;
    quantity: number;
    unit: 'kg' | 'L' | 'g' | 'mL';
}

export interface RecipeTankConfig {
    tankKey: string;
    tankName: string;
    tankType: 'fertilizer' | 'acid' | 'mixer' | 'custom';
    capacityLiters: number;
    waterLiters: number;
    expectedFeedingsPerBatch: number; // e.g. 1 (1 feed), 2 (2 feeds), 3 (3 feeds)
    ingredients: RecipeTankIngredient[];
}

export interface NutritionPlan {
    id: string;
    name: string;
    elements: PlanElement[];
    purpose: NutritionPlanPurpose;
    startDate?: string;
    endDate?: string;
    frequency?: string;
    targetWaterLiters?: number;
    targetEC?: number;
    targetPH?: number;
    recipeType?: 'standard' | 'system_feeding_tanks';
    tankConfigs?: RecipeTankConfig[];
}

export interface PlanElement {
    inventoryItemId: string;
    newItemName?: string;
    quantity: number;
    unit: string;
}

export interface PlanExecutionAuditLog {
    editedByUserName: string;
    editedByUserId?: string;
    editedAt: string;
    editReason: string;
    previousValuesSummary?: string;
}

export interface PlanExecutionSectorMeasurement {
    sectorId: string;
    sectorName?: string;
    durationMinutes: number;
    ec?: number;
    ph?: number;
}

export interface PlanExecution {
    id: string;
    planId: string;
    date: string;
    sectorIds: string[];
    executedByEmployeeId?: string;
    actualElements: PlanExecutionElement[];
    actualWaterLiters: number;
    notes?: string;
    sectorMeasurements?: PlanExecutionSectorMeasurement[];
    auditLogs?: PlanExecutionAuditLog[];
    isReverted?: boolean;
    revertedAt?: string;
    revertedBy?: string;
    cycleFeedingNumber?: number;
    totalCost?: number;
}

export interface PlanExecutionElement extends PlanElement {
    actualQuantity?: number;
    actualEC?: number;
    actualPH?: number;
    stockDeduction?: number;
}

export type VisualTankLevelPreset = 'FULL' | 'THREE_QUARTERS' | 'HALF' | 'ONE_THIRD' | 'TRACE' | 'EMPTY';

export interface TankDissolvedMaterial {
    inventoryItemId: string;
    name: string;
    dissolvedKg: number;
    activeConcentrationKgPerL?: number;
}

export interface FertigationTank {
    id: string;
    tankKey?: string;
    name: string;
    type: 'fertilizer' | 'acid' | 'mixer' | 'custom';
    capacityLiters: number;
    currentVolumeLiters: number;
    preparedWaterLiters: number;
    activeRecipeId?: string;
    activeRecipeName?: string;
    expectedFeedingsPerBatch?: number;
    feedsRemaining?: number;
    materials: TankDissolvedMaterial[];
    status: 'ACTIVE' | 'DEPLETED' | 'STANDBY';
    isEnabled?: boolean;
    lastRefilledAt?: string;
    autoCycleFactor?: number;
    colorTheme?: 'emerald' | 'blue' | 'purple' | 'amber' | 'cyan';
}

export interface TankFeedingSectorEntry {
    sectorId: string;
    sectorName?: string;
    durationMinutes: number;
    waterVolumeLiters?: number;
}

export interface TankFeedingSession {
    id: string;
    date: string;
    recipeId: string;
    recipeName: string;
    purpose: string;
    mode: 'AUTO' | 'MANUAL';
    operatorName?: string;
    sectors: TankFeedingSectorEntry[];
    totalDurationMinutes: number;
    tankSnapshots: {
        tankId: string;
        tankName: string;
        startVolumeLiters: number;
        endVolumeLiters: number;
        consumedLiters: number;
        isMarkedDepleted: boolean;
        consumedMaterials: {
            inventoryItemId: string;
            name: string;
            consumedKg: number;
            remainingInTankKg: number;
        }[];
    }[];
    totalConsumedCost?: number;
    notes?: string;
}

export type HarvestStatus = 'planned' | 'active' | 'paused' | 'completed' | 'deleted' | 'partially_sold';
export type HarvestEventType = 'standard' | 'box_counting' | 'qr_traceability' | 'bracelet_station' | 'rapid_cycle' | 'end_to_stock' | 'bulk_estimate' | 'smart_rfid_gps' | 'sticker_number' | 'group_qr_tracking';

export interface HarvestMethod {
    id: HarvestEventType;
    name: string;
    description: string;
    icon: string;
    protocol: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;
}

export const HARVEST_METHODS: HarvestMethod[] = [
    { id: 'qr_traceability', name: 'QR ტრეკინგი', description: 'ინდივიდუალური სტიკერი ყოველ ყუთზე. მაღალი დონის ვერიფიკაცია.', icon: 'QrCode', protocol: 1 },
    { id: 'bracelet_station', name: 'სამაჯურების პუნქტი', description: 'მუშის სამაჯური სკანირდება ასაწონ პუნქტში ავტო-ბეჭდვით.', icon: 'Fingerprint', protocol: 2 },
    { id: 'rapid_cycle', name: 'სწრაფი ციკლი', description: 'მრავალჯერადი ყუთები, სწრაფი აღრიცხვა შიდა დამუშავებისთვის.', icon: 'RefreshCcw', protocol: 3 },
    { id: 'end_to_stock', name: 'საწყობის სრული ციკლი', description: 'დაუყოვნებელი ინვენტარიზაცია ასაწონი პუნქტიდან.', icon: 'Box', protocol: 4 },
    { id: 'bulk_estimate', name: 'ჯგუფური რაოდენობა', description: 'ყუთების რაოდენობა მრავლდება საშუალო წონაზე სწრაფი აღრიცხვისთვის.', icon: 'Scale', protocol: 5 },
    { id: 'smart_rfid_gps', name: 'სმარტ-ტრეკინგი (NFC/GPS)', description: 'NFC ბარათის დადება ავტომატური GPS სექტორის რუკაზე ასახვით.', icon: 'MapPin', protocol: 6 },
    { id: 'sticker_number', name: 'სტიკერის №', description: 'ყუთების ხელით დანომრვა მიბმული მუშების უნიკალურ ნომრებთან.', icon: 'Tag', protocol: 7 },
    { id: 'group_qr_tracking', name: 'Group QR Tracking', description: 'სკანერით მრავალი QR-კოდის ერთდროული წაკითხვა და მუშების ჯგუფური აღრიცხვა წონის სადგურში.', icon: 'QrCode', protocol: 8 },
];

export type PaymentModel = 'per_weight' | 'hourly' | 'daily' | 'salary' | 'combined';
export const PAYMENT_MODELS: PaymentModel[] = ['per_weight', 'hourly', 'daily', 'salary', 'combined'];

export interface HarvestEvent {
    id: string;
    organizationId?: string;
    isDeleted?: boolean;
    deletedAt?: string;
    name: string;
    type?: HarvestEventType;
    methodId?: HarvestEventType;
    protocol?: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;
    defaultBoxWeightKg?: number;
    sectorId: string;
    sectorIds: string[];
    plannedStartDate: string;
    actualStartDate?: string;
    actualEndDate?: string;
    status: HarvestStatus;
    assignedPickers: AssignedPicker[];
    logisticsRecords?: any[];
    assignedVehicles: AssignedVehicle[];
    materialsUsed: MaterialUsed[];
    boxScans?: BoxScan[];
    totalBoxes: number;
    totalPickerCost: number;
    totalNetWeightKg: number;
    totalGrossWeightKg?: number;
    totalVerifiedWeightKg?: number;
    totalEstimatedWeightKg?: number;
    totalPackagingCost: number;
    totalPallets: number;
    totalVehicleCost: number;
    manualOpex?: number;
    boxUnitCost?: number;
    punetUnitCost?: number;
    hasPunets?: boolean;
    punetsPerBox?: number;
    totalPunets?: number;
    physicalPunets?: number;
    physicalHalfBoxes?: number;
    mergeHalfBoxes?: boolean;
    standardBoxWeight?: number;
    correctedWeight?: number;
    leaveReconciliationAsIs?: boolean;
    manualVehicleCost?: number;
    otherOpexItems?: { id: string; name: string; cost: number }[];
    trenchIds?: string[];
    varieties?: string[];
    yieldByVariety?: YieldByVariety[];
    breaks: { start: string; end?: string }[];
    postHarvestAction?: PostHarvestAction;
    saleDetails?: HarvestSaleDetails;
    marketIdentifier?: string;
    finalNetYieldKg?: number;
    isSyncRequired?: boolean;
    syncStatus?: 'pending' | 'local_synced' | 'cloud_synced';
    reweighRecords?: { id: string; boxes: number; weight: number; brutto?: number; variety?: string; workerId?: string; salary?: number }[];
    isReverseMode?: boolean;
    reweighTotalWeight?: number;
    reweighTotalBoxes?: number;
    reweighTotalGrossWeight?: number;
    reweighTotalSalary?: number;
    sellerReportedWeight?: number;
    reweighNotes?: string;
    isAiGenerated?: boolean;
    customColor?: 'white' | 'yellow' | 'green' | 'red' | string;
    customNote?: string;
    sortOrder?: number;
    payrollApproved?: boolean;
    payrollApprovedAt?: string;
    payrollApprovedBy?: string;
    payrollNotes?: string;
}

export interface BoxScan {
    id: string;
    barcode: string;
    scannedAt: string;
    scannedBy: string;
    weightKg: number;
    trenchId?: string;
}

export interface AssignedPicker {
    employeeId: string;
    paymentModel: PaymentModel;
    rate: number;
    bonus?: number;
    manualHours?: number;
    manualBoxes?: number;
    manualNetWeight?: number;
    manualDays?: number;
    isDailyContract?: boolean;
    assignedRole?: string;
    payableNetWeight?: number;
    combinedBaseRate?: number;
    combinedPerKgRate?: number;
    combinedShiftFraction?: number;
    combinedDailyKg?: number;
    combinedSubModel?: string;
}

export interface AssignedVehicle {
    id: string;
    name: string;
    machineryId?: string;
    isOwned: boolean;
    hiredCost: number;
    usageHours: number;    vehicleType?: "cargo" | "passenger" | "other";    passengerCount?: number;    foremanId?: string;    foremanName?: string;    rateType?: "per_person" | "daily" | "fixed" | "per_kg";    rateAmount?: number;
    linkedWorkerIds?: string[];
}

export interface MaterialUsed {
    inventoryItemId: string;
    quantity: number;
    unitCost?: number;
    cost?: number;
    unit?: string;
}

export interface YieldByVariety {
    variety: string;
    weightKg: number;
    boxCount?: number;
    boxWeight?: number;
    netWeightKg?: number; // Manual net override
    isWeighted?: boolean; // Flag to indicate actual weight data exists
}

export interface HardwareDevice {
    id: string;
    organizationId: string;
    name: string;
    type: 'scanner' | 'scale' | 'printer';
    connectionType: 'bluetooth' | 'usb' | 'wifi';
    status: 'online' | 'offline';
    lastSeen?: string;
    strength?: number;
}

export interface HarvestEntry {
    id: string;
    organizationId?: string;
    harvestEventId: string;
    employeeId: string;
    scannedAt: string;
    timestamp?: string;
    grossWeightKg: number;
    tareWeightKg: number;
    netWeightKg: number;
    verifiedWeightKg?: number; // Exact scale weight
    estimatedWeightKg?: number; // Field estimate (box count * avg)
    isVerified?: boolean;
    gpsLocation?: { lat: number; lng: number };
    trenchId?: string;
    sectorId?: string;
    packagingItemId: string;
    ticketId?: string;
    variety?: string;
    varietyId?: string;
    rfidTag?: string;
    boxId?: string;
    boxCount?: number;
    isHalfBox?: boolean;
    punets?: number;
    punetCount?: number;
    hasPunets?: boolean;
    deviceId?: string;
    offlineTimestamp?: string;
    syncedAt?: string;
    crateCode?: string;
    scannedBy?: string;
    scannedByRole?: string;
    scannedByUserName?: string;
    createdBy?: string;
    recordedBy?: string;
    authorId?: string;
}

export interface Pallet {
    id: string;
    barcode: string;
    harvestEventId: string;
    variety: string;
    grossWeightKg: number;
    tareWeightKg: number;
    netWeightKg: number;
    entryIds: string[];
    status: 'In Field' | 'In Transit' | 'In Storage' | 'Shipped';
}

export interface HarvestLog {
    id: string;
    organizationId?: string;
    harvestEventId: string;
    date: string;
    geometry: [number, number][];
    areaHa: number;
    yieldByVariety: YieldByVariety[];
    detailedYieldEntries?: YieldEntry[];
    notes?: string;
    sectorId?: string;
    sectorIds?: string[];
    materialsUsed?: MaterialUsed[];
    assignedVehicles?: AssignedVehicle[];
}

export interface YieldEntry {
    featureId: string; // Trench or Sector ID
    featureName?: string;
    weightKg: number;
    boxCount?: number;
    boxWeight?: number;
    variety?: string;
}

export type PostHarvestAction = 'MARKETPLACE' | 'DIRECT_SALE' | 'COLD_STORAGE' | 'CREATE_MARKET_OFFER' | 'SOLD_EXTERNAL' | 'INTERNAL_TRANSFER';

export interface HarvestSaleDetails {
    buyerName: string;
    pricePerUnit: number;
    totalValue: number;
    soldQuantity: number;
    saleDate: string;
    saleMethod: 'personal' | 'agent' | 'platform';
    paymentMethod: 'cash' | 'bank' | 'other';
    weightTicket?: string;
    notes?: string;
}

export type TransactionRecordType = 'Outgoing Payment' | 'Incoming Payment' | 'Bank Transfer' | 'Journal Entry';
export type PaymentMode = 'Cash' | 'By Card' | 'Purchase Agreement' | 'Contract for IE/Physical Person';

export interface Account {
    id: string;
    name: string;
    type: 'Asset' | 'Liability' | 'Equity' | 'Revenue' | 'Expense';
    balance: number;
    isWallet?: boolean;
    organizationId?: string;
}

export interface Transaction {
    id: string;
    date: string;
    description: string;
    debitAccountId: string;
    creditAccountId: string;
    amount: number;
    transactionType: TransactionRecordType;
    organizationId?: string;
    referenceId?: string;
    category?: string;
    employeeId?: string;
    relatedPurchaseId?: string;
    documentUrl?: string;
    documentAnalysis?: TransactionDocumentAnalysis | null;
    paymentMode?: PaymentMode;
    managerOverrideAmount?: number;
    documentNumber?: string;
    senderName?: string;
    senderBank?: string;
    senderAccount?: string;
    receiverName?: string;
    receiverBank?: string;
    receiverAccount?: string;
    paidBy?: string;
}

export interface PayrollRun {
    id: string;
    date: string;
    periodStart: string;
    periodEnd: string;
    totalAmount: number;
    status: 'Draft' | 'Approved' | 'Paid';
    items: PayrollRunItem[];
}

export interface PayrollRunItem {
    employeeId: string;
    amount: number;
    status: 'Pending' | 'Paid';
}

export interface SubscriptionPlan {
    id: string;
    name: string;
    price: number;
    billingCycle: 'monthly' | 'yearly';
    features: string[];
    isCustom?: boolean;
    contactRequired?: boolean;
    freeDays?: number;
}

export interface ForumPost {
    id: string;
    title?: string;
    content: string;
    authorId: string;
    authorName: string;
    timestamp: string;
    hubType: 'internal' | 'regional' | 'global';
    channelId: string;
    organizationId?: string;
    isDirectMessage?: boolean;
    recipientId?: string;
    recipientName?: string;
    participantIds?: string[];
    attachment?: MessageAttachment;
    isRead?: boolean;
    readBy?: string[];
    parentPostId?: string;
    replies: ForumReply[];
}

export interface ForumReply {
    id: string;
    authorId: string;
    authorName: string;
    content: string;
    timestamp: string;
}

export interface Conversation {
    id: string;
    participants: string[];
    participantNames: Record<string, string>;
    type: 'direct' | 'group';
    name?: string;
    lastMessage?: string;
    lastMessageAt?: string;
    createdAt: string;
    organizationId?: string; // If it's an internal org chat
}

export interface ChatMessage {
    id: string;
    conversationId: string;
    authorId: string;
    authorName: string;
    content: string;
    timestamp: string;
    attachment?: MessageAttachment;
}

export interface MessageAttachment {
    type: 'geo' | 'image' | 'audio' | 'file';
    payload: any;
    mimeType?: string;
    fileName?: string;
    fileSize?: number;
}

export type ListingType = 'sale' | 'wanted';
export type AvailabilityStatus = 'now' | 'pre-harvest' | 'future';

export interface Listing {
    id: string;
    createdAt?: string;
    type: ListingType;
    title: string;
    description: string;
    additionalDescription?: string;
    category: string;
    cropType: string;
    cropVariety?: string;
    quantity: number;
    unit: string;
    pricePerUnit?: number;
    sellerId: string;
    sellerName: string;
    location: [number, number];
    locationName?: string;
    region?: string;
    mediaUrl?: string;
    aiAnalysis?: MarketplaceItemAnalysis | null;
    qualityGrade?: string;
    caliber?: string;
    certifications?: string;
    availabilityStatus?: AvailabilityStatus;
    maxQuantity?: number;
    neededDate?: string;
    characteristicsDescription?: string;
    auctionDetails?: {
        status: 'active' | 'closed';
        availableFrom: string;
        auctionEnds: string;
        startPrice: number;
        currentPrice: number;
        highestBidderId?: string;
    };
}

export interface Bid {
    id: string;
    listingId: string;
    bidderId: string;
    amount: number;
    timestamp: string;
}

export interface Review {
    id: string;
    listingId?: string;
    targetId: string; // userId of person being reviewed
    authorId: string;
    authorName: string;
    rating: number;
    comment: string;
    timestamp: string;
}

export interface Alert {
    id: string;
    organizationId?: string;
    title: string;
    content: string;
    type: 'info' | 'warning' | 'error';
    timestamp: string;
    isRead?: boolean;
    readBy?: string[];
    metadata?: any;
    actions?: {
        label: string;
        actionType: 'approve_join' | 'open_chat' | 'link';
        actionData?: any;
    }[];
}

export interface VarietyRule {
    id: string;
    variety: string;
    from: number;
    to: number;
}

export interface ThemeSettings {
    font: 'inter' | 'serif' | 'mono' | 'sans';
    primaryColor: string;
    backgroundColor: string;
    textColor: string;
    backgroundImage?: string;
}

export interface ShareSettings {
    includeAnalysis: boolean;
    includePlantation: boolean;
    includeSoil: boolean;
    includePlaces: boolean;
    includeTasks: boolean;
    includeInventory: boolean;
    includeHarvest: boolean;
    includeAgronomy: boolean;
}

export interface AnalysisLocation {
    lat: number;
    lng: number;
    name?: string;
}

export const AI_FREE_LIMIT = 20;

type AccessLevel = 'full' | 'read' | 'none';

const permissionMatrix: Record<AppMode, Partial<Record<UserRole, AccessLevel>>> = {
    dashboard: { Founder: 'full', 'Co-Founder': 'full', Admin: 'full', Accountant: 'full', Agronomist: 'full', 'Agro-Agent': 'full', Buyer: 'full', Employee: 'full', Independent: 'full', ROOT_SUPER_ADMIN: 'full', Guest: 'read', 'Field Manager': 'full', company: 'full' },
    ai: { Founder: 'full', 'Co-Founder': 'full', Admin: 'full', Accountant: 'full', Agronomist: 'full', 'Agro-Agent': 'full', Buyer: 'full', Employee: 'full', Independent: 'full', ROOT_SUPER_ADMIN: 'full', Guest: 'full', 'Field Manager': 'full', company: 'full', 'Agro-Shop': 'full' },
    community: { Founder: 'full', 'Co-Founder': 'full', Admin: 'full', Accountant: 'full', Agronomist: 'full', 'Agro-Agent': 'full', Buyer: 'full', Employee: 'full', Independent: 'full', ROOT_SUPER_ADMIN: 'full', Guest: 'read', 'Field Manager': 'full', company: 'full', 'Agro-Shop': 'full' },
    tasks: { Founder: 'full', 'Co-Founder': 'full', Admin: 'full', Accountant: 'read', Agronomist: 'full', 'Agro-Agent': 'full', Buyer: 'full', Employee: 'read', Independent: 'full', ROOT_SUPER_ADMIN: 'full', Guest: 'read', 'Field Manager': 'full', company: 'full' },
    marketplace: { Founder: 'full', 'Co-Founder': 'full', Admin: 'full', Accountant: 'read', Agronomist: 'read', 'Agro-Agent': 'full', Buyer: 'full', Employee: 'read', Independent: 'full', ROOT_SUPER_ADMIN: 'full', Guest: 'read', 'Field Manager': 'read', company: 'full' },
    design: { Founder: 'full', 'Co-Founder': 'full', Admin: 'full', Agronomist: 'full', 'Agro-Agent': 'full', Accountant: 'none', Buyer: 'full', Employee: 'read', Independent: 'full', ROOT_SUPER_ADMIN: 'full', Guest: 'read', 'Field Manager': 'read', company: 'full' },
    agronomy: { Founder: 'full', 'Co-Founder': 'full', Admin: 'full', Agronomist: 'full', 'Agro-Agent': 'read', Accountant: 'none', Buyer: 'none', Employee: 'read', ROOT_SUPER_ADMIN: 'full', Guest: 'read', 'Field Manager': 'read', company: 'full' },
    harvesting: { Founder: 'full', 'Co-Founder': 'full', Admin: 'full', Agronomist: 'read', 'Agro-Agent': 'read', Accountant: 'read', Buyer: 'read', Employee: 'read', ROOT_SUPER_ADMIN: 'full', Guest: 'read', 'Field Manager': 'full', company: 'full' },
    stock: { Founder: 'full', 'Co-Founder': 'full', Admin: 'full', Agronomist: 'read', 'Agro-Agent': 'read', Accountant: 'read', Buyer: 'read', Employee: 'read', ROOT_SUPER_ADMIN: 'full', Guest: 'read', 'Field Manager': 'full', company: 'full' },
    accounting: { Founder: 'full', 'Co-Founder': 'full', Admin: 'read', Accountant: 'full', Agronomist: 'none', 'Agro-Agent': 'none', Buyer: 'none', Employee: 'read', ROOT_SUPER_ADMIN: 'full', Guest: 'none', 'Field Manager': 'read', company: 'full' },
    founders: { Founder: 'full', 'Co-Founder': 'full', Accountant: 'read', ROOT_SUPER_ADMIN: 'full', Guest: 'none', company: 'full', Independent: 'full' },
    logs: { Founder: 'full', Admin: 'full', Accountant: 'read', ROOT_SUPER_ADMIN: 'full', Guest: 'none', 'Field Manager': 'read', company: 'full' },
    tools: { Founder: 'full', 'Co-Founder': 'full', Admin: 'full', ROOT_SUPER_ADMIN: 'full', Guest: 'none', 'Field Manager': 'read', company: 'full', Independent: 'full', Buyer: 'full', 'Agro-Agent': 'full' },
    // Defaulting other modules to restricted
    system: { Founder: 'full', Admin: 'full', ROOT_SUPER_ADMIN: 'full', 'Field Manager': 'read', company: 'full' },
    personalization: { Founder: 'full', 'Co-Founder': 'full', Admin: 'full', Accountant: 'full', Agronomist: 'full', 'Agro-Agent': 'full', Buyer: 'full', Employee: 'full', Independent: 'full', ROOT_SUPER_ADMIN: 'full', Guest: 'full', 'Field Manager': 'full', company: 'full' },
    admin: { ROOT_SUPER_ADMIN: 'full' },
    invitations: { Founder: 'full', 'Co-Founder': 'full', Admin: 'full', Accountant: 'full', Agronomist: 'full', 'Agro-Agent': 'full', Buyer: 'full', Employee: 'full', Independent: 'full', ROOT_SUPER_ADMIN: 'full', Guest: 'none', 'Field Manager': 'full', company: 'full' },
    profile: { Founder: 'full', 'Co-Founder': 'full', Admin: 'full', Accountant: 'full', Agronomist: 'full', 'Agro-Agent': 'full', Buyer: 'full', Employee: 'full', Independent: 'full', ROOT_SUPER_ADMIN: 'full', Guest: 'read', 'Field Manager': 'full', company: 'full' },
    onboarding: { Founder: 'full', 'Co-Founder': 'full', Admin: 'full', Accountant: 'full', Agronomist: 'full', 'Agro-Agent': 'full', Buyer: 'full', Employee: 'full', Independent: 'full', ROOT_SUPER_ADMIN: 'full', Guest: 'read', 'Field Manager': 'full', company: 'full' },
    labs: { Founder: 'full', 'Co-Founder': 'full', Admin: 'full', Accountant: 'full', Agronomist: 'full', 'Agro-Agent': 'full', Buyer: 'full', Employee: 'full', Independent: 'full', ROOT_SUPER_ADMIN: 'full', Guest: 'full', 'Field Manager': 'full', company: 'full', 'Agro-Shop': 'full' },
    guide: { Founder: 'full', 'Co-Founder': 'full', Admin: 'full', Accountant: 'full', Agronomist: 'full', 'Agro-Agent': 'full', Buyer: 'full', Employee: 'full', Independent: 'full', ROOT_SUPER_ADMIN: 'full', Guest: 'full', 'Field Manager': 'full', company: 'full', 'Agro-Shop': 'full' }
};

export const checkModuleAccess = (user: User | null, module: AppMode, activeOrg?: Organization, memberships?: Membership[]): AccessLevel => {
    // 1. Super Admin Override
    if (user?.roles?.includes('ROOT_SUPER_ADMIN')) return 'full';

    // 2. Guest Handling
    if (!user || user.isGuest) {
        return permissionMatrix[module]?.Guest || 'none';
    }

    const isIndividualRole = (user.roles || []).some(r => ['Independent', 'Buyer', 'Agro-Agent'].includes(r));

    // 3. Dormant State for Company Operational Modules (Deactivate if not in Org Context)
    const companyModules: AppMode[] = ['harvesting', 'stock', 'accounting', 'agronomy', 'logs', 'invitations', 'system', 'design', 'tasks'];
    
    if (!activeOrg && companyModules.includes(module)) {
        // Special bypass for individual roles to access map and planner if needed
        const individualAllowedModules: AppMode[] = ['design', 'tasks'];
        
        if (isIndividualRole && individualAllowedModules.includes(module)) {
            // Allow access to base permission matrix
        } else {
            return 'none';
        }
    }

    // 4. Determine User's Role in Context
    let userRole: UserRole = (user?.roles && user.roles.length > 0) ? user.roles[0] : 'Guest';
    if (userRole === 'company') userRole = 'Founder'; // Map company to Founder for permissions
    
    if (activeOrg) {
        const membership = memberships?.find(m => m.organizationId === activeOrg.id && m.userId === user.id);
        if (membership) {
            userRole = membership.role;
        }
    } else if (memberships && memberships.length > 0) {
        // "See All" Context: Check max permission across all memberships
        let maxAccess: AccessLevel = 'none';
        for (const m of memberships) {
             const role = m.role;
             const access = permissionMatrix[module]?.[role] || 'none';
             if (access === 'full') return 'full';
             if (access === 'read') maxAccess = 'read';
        }
        
        // Also check Individual roles
        const individualRoles: UserRole[] = ['Independent', 'Buyer', 'Agro-Agent'];
        for (const role of individualRoles) {
            if (user.roles?.includes(role)) {
                const access = permissionMatrix[module]?.[role] || 'none';
                if (access === 'full') return 'full';
                if (access === 'read' && maxAccess === 'none') maxAccess = 'read';
            }
        }
        
        return maxAccess;
    }

    // 5. Get base access from matrix
    const baseAccess = permissionMatrix[module]?.[userRole] || 'none';

    // 6. Final check for Profile-Centric Routing (Newly registered, no verification yet and no active organization)
    // Allows dashboard, profile, onboarding and core tools if role is selected
    if (user.verificationStatus === 'unverified' && !activeOrg) {
        if (module === 'profile' || module === 'dashboard' || module === 'onboarding') return baseAccess;
        
        // Allow users with Admin/Founder/Co-Founder privileges (global or via membership) to access management modules
        const hasAdminOrFounderPrivilege = 
            (user.roles || []).some(r => ['Admin', 'Founder', 'Co-Founder'].includes(r)) || 
            (memberships || []).some(m => m.userId === user.id && ['Admin', 'Founder', 'Co-Founder'].includes(m.role));
            
        if (hasAdminOrFounderPrivilege && (module === 'tools' || module === 'invitations' || module === 'system')) {
            return 'full';
        }

        if (isIndividualRole && (module === 'ai' || module === 'marketplace' || module === 'tools')) return baseAccess;
        return 'none';
    }

    // 7. Subscription Status Logic for Org-dependent modules
    if (activeOrg) {
        const isPaidModule = !['dashboard', 'ai', 'community', 'marketplace', 'profile', 'onboarding', 'settings', 'personalization'].includes(module);
        if (isPaidModule) {
            const status: SubscriptionStatus = new Date(activeOrg.trialExpiry) > new Date() ? 'Trial' : activeOrg.isPaid ? 'Paid' : 'Unpaid';
            if (status === 'Unpaid' && baseAccess === 'full') {
                return 'read'; // Downgrade access if subscription is unpaid for paid modules
            }
        }
    }
    
    return baseAccess;
};


export const isValidCoordinate = (p: any): p is [number, number] => {
    if (!Array.isArray(p) || p.length !== 2) return false;
    const lat = typeof p[0] === 'string' ? parseFloat(p[0]) : p[0];
    const lng = typeof p[1] === 'string' ? parseFloat(p[1]) : p[1];
    return Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;
};

// ==========================================
// Operational Anomaly & AI Analysis Suite
// ==========================================

export type AnalysisModuleScope = 'stock' | 'agronomy' | 'tasks' | 'harvest' | 'accounting' | 'machinery' | 'plantation';
export type AnalysisTriggerMode = 'scheduled' | 'interval' | 'on_demand';
export type AnalysisIntervalCadence = 'weekly' | 'monthly' | 'annual' | 'custom';
export type AiAnomalySeverity = 'low' | 'medium' | 'high' | 'critical';

export interface AiAnomalyAlert {
    id: string;
    module: AnalysisModuleScope;
    title: string;
    description: string;
    itemOrTargetName?: string;
    severity: AiAnomalySeverity;
    detectedAt: string;
    baselineMetric: string;
    currentMetric: string;
    variancePercentage: number; // e.g. +200% for 2x, +900% for 9x
    actionRecommendation: string;
    isResolved?: boolean;
    dataPoints?: { label: string; value: number; benchmark?: number }[];
}

export interface AiAnalysisScheduleConfig {
    isEnabled: boolean;
    cadence: AnalysisIntervalCadence; // weekly | monthly | annual | custom
    selectedModules: AnalysisModuleScope[];
    specificItems?: string[]; // e.g. ['Nails', 'Monopotassium phosphate', 'Pruning vs Planting']
    lastRunAt?: string;
    nextRunAt?: string;
    autoDisplayOnDashboard: boolean;
    dateRange?: {
        startDate: string; // e.g. '2026-05-14'
        endDate: string;   // e.g. '2026-07-10'
    };
}

export interface AiAnalysisReport {
    id: string;
    createdAt: string;
    triggerMode: AnalysisTriggerMode;
    cadence?: AnalysisIntervalCadence;
    dateRange?: { startDate: string; endDate: string };
    selectedModules: AnalysisModuleScope[];
    targetFilter?: string;
    executiveSummary: string;
    anomalies: AiAnomalyAlert[];
    moduleInsights: {
        module: AnalysisModuleScope;
        title: string;
        status: 'optimal' | 'warning' | 'anomaly_detected';
        summary: string;
        budgetVsActual?: { planned: number; actual: number; unit: string; variance: number };
        keyMetrics: { label: string; value: string | number; change?: string }[];
        recommendations: string[];
    }[];
    correlationInsights?: string[];
    totalCostImpactEstimatedGEL?: number;
}

