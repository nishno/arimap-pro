import React, { useState, useRef, useEffect } from 'react';
import { 
    Send, Bot, User, Sparkles, RefreshCw, Copy, Check, 
    ArrowRight, Compass, Building2, Tractor, Package, 
    Users, Banknote, HelpCircle, Lightbulb, ExternalLink, Key
} from 'lucide-react';
import { executeGeminiCall, getActiveGeminiApiKey, setCustomGeminiApiKey, testGeminiApiKey } from '../../services/geminiService';
import { AppMode } from '../../types';
import { toast } from 'sonner';

interface HelpAiAssistantChatProps {
    language?: string;
    onNavigateMode?: (mode: AppMode) => void;
    currentUser?: any;
}

interface ChatMessage {
    id: string;
    sender: 'user' | 'assistant';
    text: string;
    timestamp: Date;
    actions?: Array<{ label: string; mode: AppMode }>;
    isKnowledgeFallback?: boolean;
}

// Autonomous high-fidelity knowledge base engine
const generateKnowledgeBaseResponse = (
    query: string, 
    language: string, 
    isKa: boolean
): { text: string; actions: Array<{ label: string; mode: AppMode }> } => {
    const q = query.toLowerCase();

    // 1. Profile Creation & KYC Steps
    if (q.includes('profile') || q.includes('პროფილ') || q.includes('kyc') || q.includes('რეგისტრაცი') || q.includes('account') || q.includes('პირადი')) {
        const text = isKa
            ? `📋 **პროფილის შექმნისა და KYC ვერიფიკაციის ნაბიჯ-ნაბიჯ ინსტრუქცია:**

1. **პროფილის მოდულში გადასვლა:**
   - დააჭირეთ ქვემოთ მოცემულ ღილაკს **[პროფილის მართვა]** ან მთავარი მენიუს ზედა ზოლში მომხმარებლის ავატარს / სახელს.
   [ACTION:profile:პროფილის გახსნა]

2. **პერსონალური მონაცემების შევსება:**
   - შეიყვანეთ თქვენი **სახელი**, **გვარი**, **ტელეფონის ნომერი** და **საკონტაქტო ელ-ფოსტა**.
   - აირჩიეთ ინტერფეისის ძირითადი ენა (ქართული / English).

3. **აგრონომიული როლის არჩევა:**
   - მიუთითეთ თქვენი პოზიცია: *მეპატრონე / დამფუძნებელი (Founder)*, *აგრონომი (Agronomist)*, *მესაკუთრე-მენეჯერი (Admin)*, *მკრეფავი/მუშა (Worker)* ან *მყიდველი (Buyer)*.

4. **პირადობის KYC ვერიფიკაცია:**
   - ატვირთეთ პირადობის მოწმობის ან პასპორტის წინა და უკანა გვერდის ფოტოსურათები.
   - დააჭირეთ **"შენახვა"** (Save Profile). სისტემა ავტომატურად განაახლებს თქვენს პროფილის სტატუსს Dashboard-ზე (100% Complete).

5. **შემდეგი რეკომენდებული ნაბიჯი:**
   - გადადით **დამფუძნებელთა ჰაბში (Founders Hub)** კომპანიის იურიდიული მონაცემების, საიდენტიფიკაციო კოდისა და თანადამფუძნებელთა წილების დასარეგისტრირებლად.
   [ACTION:founders:კომპანიის რეგისტრაცია]`
            : `📋 **Step-by-Step Directives for Profile Creation & KYC Verification:**

1. **Access Profile Module:**
   - Click the **[Open Profile]** action button below, or select your user avatar in the top navigation bar or Dashboard profile card.
   [ACTION:profile:Open Profile]

2. **Enter Personal Details:**
   - Provide your **First Name**, **Last Name**, **Direct Phone Number**, and verify your registered **Email Address**.
   - Select your preferred interface language (English / Georgian).

3. **Select Primary Agronomic Role:**
   - Designate your operational authority: *Founder/Co-Founder*, *Agronomist*, *Field Manager / Admin*, *Daily Worker*, or *Commercial Buyer*.

4. **KYC Verification & Document Upload:**
   - Upload clear images of your National Identity Card or Passport (front & back).
   - Click **Save Changes**. The Dashboard profile completeness indicator will instantly update to 100%.

5. **Immediate Next Step:**
   - Proceed to **Founders Hub** to register your agricultural enterprise, legal tax ID, and equity structure.
   [ACTION:founders:Company & Founders Setup]`;

        return {
            text,
            actions: [
                { label: isKa ? 'პროფილის გახსნა' : 'Open Profile', mode: 'profile' },
                { label: isKa ? 'დამფუძნებელთა ჰაბი' : 'Founders Hub', mode: 'founders' },
                { label: isKa ? 'SOP გზამკვლევი' : 'SOP Timeline', mode: 'guide' }
            ]
        };
    }

    // 2. Locating Plantation on Satellite Map & Drawing Boundaries
    if (q.includes('map') || q.includes('რუკა') || q.includes('plantation') || q.includes('პლანტაცი') || q.includes('find') || q.includes('მოძებნ') || q.includes('boundary') || q.includes('საზღვრ') || q.includes('polygon') || q.includes('cadastr') || q.includes('საკადასტრო') || q.includes('ნაკვეთ')) {
        const text = isKa
            ? `🗺️ **პლანტაციის რუკაზე მოძიებისა და საზღვრების მოხაზვის ინსტრუქცია:**

1. **რუკის (Design) მოდულში გადასვლა:**
   - დააჭირეთ ქვემოთ ღილაკს **[რუკა & დიზაინი]** ან მთავარი მენიუდან აირჩიეთ "Map / Design".
   [ACTION:design:რუკის გახსნა]

2. **ნაკვეთის ლოკაციის მოძიება:**
   - რუკის ზედა საძიებო ზოლში შეიყვანეთ თქვენი ნაკვეთის **GPS კოორდინატები** (მაგ: \`41.8752, 44.5123\`), **საკადასტრო კოდი** (მაგ: \`05.24.03.112\`), ან რაიონის/სოფლის სახელი.
   - რუკის მარჯვენა მენიუდან ფენების ჩამრთველში აირჩიეთ **"Satellite" (სატელიტური ხედი)**, რათა დაინახოთ მიწის ზუსტი კონტურები.

3. **საზღვრების (Polygon) ხელსაწყოს გააქტიურება:**
   - რუკის მარცხენა პანელზე დააჭირეთ ღილაკს **"Draw Boundary" (პოლიგონის მოხაზვა)**.

4. **პლანტაციის პერიმეტრის მოხაზვა:**
   - დააწკაპუნეთ მაუსით თქვენი ნაკვეთის თითოეულ კუთხეში (წერტილში).
   - ბოლო წერტილზე ორჯერ დაწკაპუნებით (Double Click) ან პირველ წერტილზე დაკლიკებით პოლიგონი დაიხურება.

5. **პარამეტრების შენახვა და ავტო-გამოთვლა:**
   - გამოსულ ფანჯარაში მიუთითეთ პლანტაციის სახელი (მაგ: "ნაკვეთი A - ლურჯი მოცვი").
   - სისტემა **ავტომატურად გამოთვლის ფართობს ჰექტარებში (ჰა)**, კვადრატულ მეტრებს და ცენტრალურ კოორდინატებს.

6. **შემდეგი რეკომენდებული ნაბიჯი:**
   - მოხაზულ ნაკვეთში დაამატეთ შიდა სექტორები, ნერგების რიგები (სგრძივი თხრილები) და სარწყავი მაგისტრალი.
   [ACTION:design:რიგებისა და სექტორების დამატება]`
            : `🗺️ **Directives for Finding Your Plantation on the Map & Drawing Boundaries:**

1. **Navigate to Map & Design:**
   - Click the **[Open Map & Design]** action button below, or select "Design / Map" in the main navigation.
   [ACTION:design:Open Map & Design]

2. **Locate Your Agricultural Parcel:**
   - In the map's top search bar, enter your **GPS Coordinates** (e.g., \`41.8752, 44.5123\`), **Cadastral Code** (e.g., \`05.24.03.112\`), or town/village name.
   - In the top-right layer switcher, toggle to **Satellite View** (Google Satellite or ESRI World Imagery) for parcel terrain boundaries.

3. **Activate Boundary Drawing Tool:**
   - From the left GIS drawing toolbar, select the **Boundary / Polygon Tool**.

4. **Trace Plantation Perimeter:**
   - Single-click on each corner point of your parcel perimeter to place boundary vertices.
   - Double-click on the final vertex or click the initial starting point to seal the polygon boundary.

5. **Assign Metadata & Automatic Hectare Calculation:**
   - In the feature configuration dialog, enter the plantation name and primary crop (e.g., "North Sector - Blueberry Duke").
   - The engine automatically calculates exact **Surface Area in Hectares (ha)**, perimeter length, and geodesic coordinates.

6. **Immediate Next Step:**
   - Layer internal seedling rows (planting trenches), irrigation line corridors, and monitoring checkpoints within the perimeter.
   [ACTION:design:Draw Internal Rows & Sectors]`;

        return {
            text,
            actions: [
                { label: isKa ? 'რუკა & დიზაინი' : 'Open Map & Design', mode: 'design' },
                { label: isKa ? 'SOP ეტაპი 3' : 'Step 3 SOP Guide', mode: 'guide' },
                { label: isKa ? 'დაფაზე დაბრუნება' : 'Dashboard', mode: 'dashboard' }
            ]
        };
    }

    // 3. Next Steps After Registration
    if (q.includes('next step') || q.includes('შემდეგი ნაბიჯ') || q.includes('რა არის შემდეგი') || q.includes('შემდეგ') || q.includes('after') || q.includes('what next') || q.includes('რა ვქნა')) {
        const text = isKa
            ? `🚀 **სისტემის გამართვისა და მართვის სრული თანმიმდევრული ჯაჭვი (Next Steps):**

რეგისტრაციის შემდეგ სისტემის სრულფასოვნად ასამუშავებლად მიჰყევით ამ ეტაპებს:

1. **ეტაპი 1: პროფილი და KYC ვერიფიკაცია**
   - შეიყვანეთ საკონტაქტო მონაცემები და ატვირთეთ დოკუმენტები.
   [ACTION:profile:პროფილის მართვა]

2. **ეტაპი 2: აგრო-კომპანია და იურიდიული მონაცემები**
   - Founders Hub-ში დაარეგისტრირეთ საწარმოს საიდენტიფიკაციო კოდი, საბანკო რეკვიზიტები და დამფუძნებელთა წილები.
   [ACTION:founders:კომპანიის რეგისტრაცია]

3. **ეტაპი 3: პლანტაციის მოძებნა სატელიტზე და საზღვრების მოხაზვა**
   - Map & Design მოდულში მოხაზეთ ნაკვეთის პოლიგონი, გამოთვალეთ ჰექტრები და დაყავით სექტორებად.
   [ACTION:design:რუკაზე საზღვრების მოხაზვა]

4. **ეტაპი 4: კულტურებისა და ჯიშების კატალოგი**
   - დაამატეთ თქვენი კულტურები (მოცვი, თხილი, ვენახი), ჯიშები, დარგვის სქემა და ნერგების რაოდენობა.
   [ACTION:dashboard:კულტურების მართვა]

5. **ეტაპი 5: საწყობის მარაგები (ტარა, სასუქები, პუნეტები)**
   - საწყობში დაარეგისტრირეთ მოსავლის ასაღებად საჭირო ყუთები, წამლობის პრეპარატები და სასუქები.
   [ACTION:stock:საწყობის გახსნა]

6. **ეტაპი 6: მუშახელის რეგისტრაცია და ტარიფები**
   - Tools & HR-ში დაარეგისტრირეთ მკრეფავები, მუშები და დააწესეთ გამომუშავების ტარიფი (კგ/ყუთი).
   [ACTION:tools:HR & მუშახელი]

7. **ეტაპი 7: მოსავლის აღების ლაივ-მონიტორინგი & ელექტრონული სასწორი**
   - გახსენით მოსავლის აღების სესია, დააკავშირეთ სასწორი და დაიწყეთ მოსავლის ჩაბარება.
   [ACTION:harvesting:მოსავლის მონიტორინგი]`
            : `🚀 **Sequential Operational Roadmap & Next Steps After Registration:**

Follow this end-to-end implementation sequence to orchestrate your entire agricultural operation:

1. **Step 1: Profile & KYC Verification**
   - Complete contact credentials, operational role assignment, and identity verification.
   [ACTION:profile:Manage Profile]

2. **Step 2: Company Entity & Founders Hub**
   - Register farm corporate entity, tax ID, bank accounts, and partner equity percentages.
   [ACTION:founders:Company Setup]

3. **Step 3: GIS Satellite Mapping & Boundary Polygons**
   - Draw parcel perimeter polygons in Design mode to calculate acreage and define sectors.
   [ACTION:design:Draw Boundaries]

4. **Step 4: Crop & Variety Catalog**
   - Configure crops (Blueberry, Hazelnut, Vine), rootstocks, plant spacing, and row metrics.
   [ACTION:dashboard:Crop Management]

5. **Step 5: Warehouse & Packaging Inventory**
   - Stock packaging crates, punnets, drip irrigation lines, and crop protection inputs.
   [ACTION:stock:Warehouse Inventory]

6. **Step 6: Workforce Registration & Tariffs**
   - Onboard field workers, set piece-rate tariffs ($/kg or $/crate), and activate daily attendance.
   [ACTION:tools:HR & Workers]

7. **Step 7: Live Harvest Monitoring & Scale Weigh Stations**
   - Launch harvest events, connect Bluetooth scales, deduct tare weights, and generate batch receipts.
   [ACTION:harvesting:Live Harvest Monitor]`;

        return {
            text,
            actions: [
                { label: isKa ? 'პროფილი' : 'Profile', mode: 'profile' },
                { label: isKa ? 'რუკა & დიზაინი' : 'Map Design', mode: 'design' },
                { label: isKa ? 'მოსავლის აღება' : 'Harvesting', mode: 'harvesting' },
                { label: isKa ? '16-საფეხურიანი SOP' : 'Full 16-Step SOP', mode: 'guide' }
            ]
        };
    }

    // 4. Harvest Monitoring, Scale, Adding Vehicles & Materials
    if (q.includes('harvest') || q.includes('რთველ') || q.includes('მოსავალ') || q.includes('სასწორ') || q.includes('scale') || q.includes('წონ') || q.includes('vehicle') || q.includes('ავტომობილ') || q.includes('material') || q.includes('მასალ') || q.includes('standing register')) {
        const text = isKa
            ? `⚖️ **მოსავლის აღების ლაივ-მონიტორინგი, სასწორი და აქტიური რეესტრი:**

1. **მოსავლის მოდულში შესვლა:**
   - გადადით **Harvesting (მოსავლის აღება)** მოდულში და დააჭირეთ **"Live Harvest Monitoring"**.
   [ACTION:harvesting:მოსავლის მონიტორინგი]

2. **ღონისძიების გახსნა:**
   - აირჩიეთ აქტიური სექტორი/ნაკვეთი, კულტურის ჯიში და ყუთის ტარის წონა (მაგ: 0.35 კგ).
   - დააკავშირეთ ციფრული Bluetooth სასწორი ან აირჩიეთ ოპერატორის მექანიკური აწონვის რეჟიმი.

3. **ავტომობილებისა და მასალების დამატება (Active Standing Register):**
   - **"Add Vehicles" (ტრანსპორტის დამატება):** მიუთითეთ სატვირთო/მანქანის სახელმწიფო ნომერი, მძღოლი, ტევადობა და დანიშნულების საცავი/მაცივარი.
   - **"Add Materials" (მასალების დამატება):** რეესტრში გაწერეთ გასაცემი ყუთების, პუნეტებისა და პალეტების პარტიები.
   - სისტემა ავტომატურად აკავშირებს ყოველ აწონილ ყუთს საწყობის ნაშთთან და გამოაკლებს მასალას.

4. **მკრეფავის ჩაბარება და წონის დაფიქსირება:**
   - დაასკანერეთ მკრეფავის QR ბარათი ან აირჩიეთ სიიდან.
   - მოათავსეთ ყუთი სასწორზე. სისტემა გამოაკლებს ტარას, დააფიქსირებს წმინდა (Net) წონას, მიანიჭებს უნიკალურ პარტიის კოდს და დაითვლის მკრეფავის გამომუშავებას.

5. **სესიის დახურვა და დოკუმენტაცია:**
   - დააჭირეთ **"Close Harvest Event"** — ავტომატურად გენერირდება სასაქონლო ზედნადები, მიკვლევადობის პასპორტი და სახელფასო ანგარიშგება.`
            : `⚖️ **Harvest Live Monitoring, Scale Weigh Station & Active Standing Register:**

1. **Open Harvesting Module:**
   - Navigate to **Harvesting** and launch the **Live Harvest Monitoring** console.
   [ACTION:harvesting:Live Harvest Monitor]

2. **Initialize Harvest Event:**
   - Select the target field sector, crop variety, and configure empty crate tare deduction (e.g., 0.35 kg).
   - Pair your Bluetooth digital scale or operate in high-precision manual tally mode.

3. **Active Standing Register: Adding Vehicles & Materials:**
   - **"Add Vehicles":** Register transport trucks, license plates, refrigeration specs, and driver dispatch logs.
   - **"Add Materials":** Allocate crates, clamshell punnets, pallet wraps, and barcodes directly to the field weigh station.
   - All recorded crates automatically trigger real-time FIFO depletion from warehouse stock.

4. **Worker Weigh-In & Piece-Rate Accrual:**
   - Scan the picker's badge barcode or select their name from the active roster.
   - Place crate on scale. Net fruit weight is calculated instantly, stamped with a traceability batch ID, and credited to the picker's wage account.

5. **Event Finalization & Dispatch Records:**
   - Click **"Close Harvest Event"** to produce automated dispatch waybills, cold-storage receipts, and payroll export sheets.`;

        return {
            text,
            actions: [
                { label: isKa ? 'მოსავლის აღება' : 'Live Harvest Monitor', mode: 'harvesting' },
                { label: isKa ? 'საწყობი & ყუთები' : 'Stock & Crates', mode: 'stock' },
                { label: isKa ? 'HR & მკრეფავები' : 'HR & Pickers', mode: 'tools' }
            ]
        };
    }

    // 5. Warehouse, Stock, Inventory
    if (q.includes('stock') || q.includes('საწყობ') || q.includes('warehouse') || q.includes('ინვენტარ') || q.includes('inventory') || q.includes('მასალ') || q.includes('სასუქ')) {
        const text = isKa
            ? `📦 **საწყობისა და მარაგების მართვის ინსტრუქცია:**

1. **საწყობის მოდულში გადასვლა:**
   - მთავარი მენიუდან აირჩიეთ **Stock / Warehouse**.
   [ACTION:stock:საწყობის გახსნა]

2. **ახალი მასალის/საქონლის რეგისტრაცია:**
   - დააჭირეთ **"Add Item"** (საქონლის დამატება).
   - კატეგორიები: *ტარა და შეფუთვა (Crates/Boxes)*, *სასუქები (Fertilizers)*, *აგრო-ქიმიკატები (Chemicals)*, *საირიგაციო მასალები (Irrigation)*, *ინვენტარი (Tools)*.

3. **მინიმალური ზღვრები და გაფრთხილებები:**
   - მიუთითეთ საწყობის მინიმალური უსაფრთხო ნაშთი (Safety Stock). ნაშთის კრიტიკულ დონემდე დაცემისას სისტემა გამოგიგზავნით გაფრთხილებას.

4. **ავტომატური ჩამოწერის ლოგიკა:**
   - მოსავლის აღებისას ყუთების რაოდენობა რეალურ დროში ჩამოიწერება საწყობიდან.
   - აგრონომიულ კალენდარში წამლობის ან კვების აქტის შესრულებისას სასუქის ლიტრები და კილოგრამები ავტომატურად აკლდება ნაშთს.`
            : `📦 **Warehouse Inventory & Automated Stock Deduction Protocol:**

1. **Access Stock & Warehouse:**
   - Navigate to the **Stock / Warehouse** module.
   [ACTION:stock:Open Stock & Warehouse]

2. **Catalog New Inventory Items:**
   - Click **"Add Item"** and classify under: *Packaging (Crates, Punnets)*, *Fertilizers*, *Crop Protection*, *Irrigation Hardware*, or *Tools*.
   - Enter batch numbers, cost per unit, and warehouse location bin.

3. **Set Safety Threshold Alerts:**
   - Configure critical stock levels. The system warns operations teams prior to stockout during peak harvest.

4. **Automated Depletion Engine:**
   - Weighing crates during harvest operations triggers instantaneous stock deduction.
   - Completing fertilizer fertigation or spray tasks automatically draws down chemical quantities based on planned hectare dosage.`;

        return {
            text,
            actions: [
                { label: isKa ? 'საწყობი & მარაგები' : 'Stock & Warehouse', mode: 'stock' },
                { label: isKa ? 'მოსავლის აღება' : 'Harvesting', mode: 'harvesting' }
            ]
        };
    }

    // 6. HR, Workers, Payroll, Attendance
    if (q.includes('hr') || q.includes('worker') || q.includes('მუშ') || q.includes('მკრეფავ') || q.includes('ხელფას') || q.includes('ტარიფ') || q.includes('attendance') || q.includes('დასწრებ') || q.includes('payroll') || q.includes('employee')) {
        const text = isKa
            ? `👷 **მუშახელის რეგისტრაციის, გამომუშავებისა და დასწრების ინსტრუქცია:**

1. **HR მოდულში გადასვლა:**
   - მთავარი მენიუდან აირჩიეთ **Tools & Operations $\rightarrow$ HR & Personnel**.
   [ACTION:tools:HR მოდულის გახსნა]

2. **თანამშრომლის/მკრეფავის დამატება:**
   - დააჭირეთ **"Add Employee / Worker"**.
   - მიუთითეთ სახელი, პირადი ნომერი, ტელეფონი და ტიპი (*სეზონური მკრეფავი / მუდმივი თანამშრომელი / ბრიგადირი*).

3. **ტარიფების კონფიგურაცია:**
   - განსაზღვრეთ ანაზღაურების მოდელი: **ფიქსირებული დღიური** ან **გამომუშავებით (Piece-Rate)** — მაგალითად: 0.80 ₾ 1 კგ მოცვზე ან 1.50 ₾ ყუთზე.

4. **ყოველდღიური დასწრების ტაბელი:**
   - მონიშნეთ დილის გამოცხადება და სამუშაოს დასრულების დრო.
   - მოსავლის აღების სესიაზე აწონილი კილოგრამები ავტომატურად ჯამდება თითოეული მკრეფავის ბარათზე და იანგარიშება ხელფასი.`
            : `👷 **Workforce Onboarding, Piece-Rate Tariffs & Daily Attendance:**

1. **Navigate to HR & Tools:**
   - Select **Tools & Operations $\rightarrow$ HR & Personnel**.
   [ACTION:tools:Open HR & Personnel]

2. **Register Field Personnel:**
   - Click **"Add Worker / Employee"** and enter personal identification, contact phone, and role (*Seasonal Picker / Field Foreman / Permanent Staff*).

3. **Configure Compensation & Piece-Rate Tariffs:**
   - Assign wage model: *Fixed Daily Rate* or *Piece-Rate Yield Tariff* (e.g., $0.80 per kg harvested or $1.50 per crate).

4. **Attendance Logging & Automated Wage Accrual:**
   - Record daily check-in timestamps.
   - Harvest weigh-in logs synchronize directly with picker rosters, calculating accrued gross earnings without manual spreadsheet calculations.`;

        return {
            text,
            actions: [
                { label: isKa ? 'HR & მუშახელი' : 'HR & Workforce', mode: 'tools' },
                { label: isKa ? 'მოსავლის აღება' : 'Harvesting', mode: 'harvesting' }
            ]
        };
    }

    // 7. General Comprehensive Guidance
    const text = isKa
        ? `🌾 **AgriMap Pro 2.0.6 Enterprise - სისტემის მართვის გზამკვლევი:**

თქვენს შეკითხვასთან დაკავშირებით, სისტემაში ხელმისაწვდომია შემდეგი ძირითადი მოდულები და ოპერაციები:

1. **პროფილის და KYC მართვა:** პერსონალური მონაცემების, როლებისა და დოკუმენტების დადასტურება.
   [ACTION:profile:პროფილის მართვა]
2. **მიწის ნაკვეთები და რუკა:** სატელიტზე პლანტაციის საზღვრების მოხაზვა, ჰექტრების დათვლა და სექტორების გაშენება.
   [ACTION:design:რუკა & დიზაინი]
3. **აგრო-კომპანიის რეგისტრაცია:** საწარმოს მონაცემები, თანადამფუძნებელთა წილები და საბანკო ანგარიშები.
   [ACTION:founders:დამფუძნებელთა ჰაბი]
4. **მოსავლის აღების ლაივ-მონიტორინგი:** ელექტრონული სასწორი, ტრანსპორტი, ტარის ავტო-ჩამოწერა და მიკვლევადობა.
   [ACTION:harvesting:მოსავლის აღება]
5. **საწყობი და მარაგები:** ყუთების, სასუქების და აგრო-ქიმიკატების რეალურ დროში აღრიცხვა.
   [ACTION:stock:საწყობის გახსნა]
6. **16-საფეხურიანი სტანდარტული SOP გზამკვლევი:** სრული საოპერაციო პროცედურები ნაბიჯ-ნაბიჯ.
   [ACTION:guide:SOP გზამკვლევი]

დამატებითი კითხვისთვის აირჩიეთ ზემოთ მოცემული სწრაფი შეკითხვები ან ჩაწერეთ კონკრეტული მოდულის დასახელება!`
        : `🌾 **AgriMap Pro 2.0.6 Enterprise - System Management Guide:**

Here is a direct roadmap to the relevant application modules and workflows:

1. **User Profile & KYC:** Personal details, operational role assignment, and identity verification.
   [ACTION:profile:Manage Profile]
2. **Plantation Map & GIS Design:** Locate land on satellite imagery, trace boundary polygons, and calculate hectares.
   [ACTION:design:Open Map & Design]
3. **Agricultural Enterprise & Founders Hub:** Corporate entity registration, partner equity shares, and tax details.
   [ACTION:founders:Founders Hub]
4. **Harvest Live Monitoring & Scales:** Bluetooth weigh station, vehicle registers, crate deduction, and worker tracking.
   [ACTION:harvesting:Live Harvest Monitor]
5. **Stock & Warehouse Management:** Real-time inventory for packaging, agrochemicals, fertilizers, and supplies.
   [ACTION:stock:Open Stock & Warehouse]
6. **Standard 16-Step Operating Procedures:** Complete supply-chain lifecycle walkthrough.
   [ACTION:guide:Standard SOPs]

Select any quick prompt above or ask a specific operational question to receive immediate step-by-step guidance!`;

    return {
        text,
        actions: [
            { label: isKa ? 'პროფილის მართვა' : 'Manage Profile', mode: 'profile' },
            { label: isKa ? 'რუკა & დიზაინი' : 'Plantation Map', mode: 'design' },
            { label: isKa ? 'მოსავლის აღება' : 'Harvesting', mode: 'harvesting' },
            { label: isKa ? 'SOP გზამკვლევი' : 'SOP Timeline', mode: 'guide' }
        ]
    };
};

const PRESET_QUESTIONS = [
    {
        labelEn: '👤 Give me steps for creating & verifying profile',
        labelKa: '👤 მომეცი პროფილის შექმნისა და ვერიფიკაციის ნაბიჯები',
        queryEn: 'Give me clear step-by-step instructions for creating and completing my profile in AgriMap Pro, including KYC identity verification and what details are needed.',
        queryKa: 'მომეცი დეტალური ნაბიჯ-ნაბიჯ ინსტრუქცია AgriMap Pro-ში პროფილის შექმნის, KYC ვერიფიკაციისა და პირადი მონაცემების შევსების შესახებ.'
    },
    {
        labelEn: '🗺️ How can I find my plantation on the map & draw boundaries?',
        labelKa: '🗺️ როგორ ვიპოვო ჩემი პლანტაცია რუკაზე და მოვხაზო საზღვრები?',
        queryEn: 'How can I find my agricultural land parcel on the map, switch to satellite view, and draw the plantation boundary polygon to calculate hectares?',
        queryKa: 'როგორ ვიპოვო ჩემი მიწის ნაკვეთი რუკაზე, გადავრთო სატელიტზე და მოვხაზო პლანტაციის საზღვრები ჰექტრების გამოსათვლელად?'
    },
    {
        labelEn: '🏢 What are the next steps after registering company?',
        labelKa: '🏢 რა არის შემდეგი ნაბიჯები კომპანიის რეგისტრაციის შემდეგ?',
        queryEn: 'I have registered my agricultural company in Founders Hub. What are the exact recommended next steps in the operational sequence for setting up the plantation?',
        queryKa: 'მე დავარეგისტრირე ჩემი აგრო-საწარმო დამფუძნებელთა ჰაბში. რა არის შემდეგი აუცილებელი ოპერაციული ნაბიჯები პლანტაციის გასამართად?'
    },
    {
        labelEn: '🍇 Help with harvest event and weigh station protocols',
        labelKa: '🍇 დამეხმარე მოსავლის ღონისძიებასა და ამწონი პუნქტის პროტოკოლებში',
        queryEn: 'Guide me through setting up a harvest event and operating the electronic scale weigh station (Protocol 1 and Protocol 2), box tare subtraction, and picker tracking.',
        queryKa: 'გამიწიე ინსტრუქტაჟი მოსავლის აღების ღონისძიების გახსნის, ელექტრონული სასწორის (პროტოკოლი 1 და 2), ტარის ჩამოჭრისა და მკრეფავების აღრიცხვის შესახებ.'
    },
    {
        labelEn: '📦 How to manage stock deduction and warehouse inventory?',
        labelKa: '📦 როგორ ვმართო მარაგების ავტო-ჩამოწერა და საწყობი?',
        queryEn: 'How do I add packaging crates and fertilizers to warehouse stock, and how does automated stock deduction work when recording harvest yields or spray plans?',
        queryKa: 'როგორ დავამატო ყუთები, პუნეტები და სასუქები საწყობში და როგორ მუშაობს ავტომატური ჩამოწერა მოსავლის აღების ან წამლობის დროს?'
    },
    {
        labelEn: '👷 How to register workers and track daily attendance?',
        labelKa: '👷 როგორ დავარეგისტრირო მუშახელი და ვაწარმოო ყოველდღიური დასწრება?',
        queryEn: 'How do I register field pickers, set piece-rate tariffs per kg/box, and record daily worker attendance in HR & Tools?',
        queryKa: 'როგორ დავარეგისტრირო მკრეფავები, განვსაზღვრო გამომუშავების ტარიფი (კგ/ყუთი) და ვაწარმოო ყოველდღიური დასწრების აღრიცხვა HR & Tools მოდულში?'
    }
];

export const HelpAiAssistantChat: React.FC<HelpAiAssistantChatProps> = ({
    language = 'en',
    onNavigateMode,
    currentUser
}) => {
    const isKa = language === 'ka';
    const [messages, setMessages] = useState<ChatMessage[]>(() => [
        {
            id: 'welcome',
            sender: 'assistant',
            text: isKa
                ? `გამარჯობა! მე ვარ AgriMap Pro-ს AI ასისტენტი და სისტემური მრჩეველი.
მე სრულად ვიცი პლატფორმის ყველა ტექნიკური დეტალი, მოდული და სამუშაო პროცესი:
• პროფილისა და კომპანიის რეგისტრაციის ეტაპები
• პლანტაციის მოძებნა სატელიტურ რუკაზე და საზღვრების მოხაზვა
• მოსავლის აღების სესიები და ელექტრონული სასწორის 6 პროტოკოლი
• საწყობის მარაგები და მოსავლის ტარის ავტომატური ჩამოწერა
• მუშახელის რეგისტრაცია და გამომუშავების აღრიცხვა

დასვით ნებისმიერი შეკითხვა ან აირჩიეთ ქვემოთ მოცემული მზა მოთხოვნებიდან!`
                : `Hello! I am the AgriMap Pro AI Assistant & System Navigator.
I have full architectural and operational knowledge of every module in the application:
• Step-by-step Profile & Company Registration workflows
• Locating land on satellite maps & drawing parcel boundary polygons
• Harvest Event execution & the 6 Weigh Station protocols
• Warehouse stock setup & automated container/chemical deductions
• Workforce onboarding, piece-rate wages, and daily attendance logs

Ask me anything or select one of the quick guided questions below!`,
            timestamp: new Date(),
            actions: [
                { label: isKa ? 'პროფილის მართვა' : 'Manage Profile', mode: 'profile' },
                { label: isKa ? 'რუკა & დიზაინი' : 'Plantation Map', mode: 'design' },
                { label: isKa ? 'დამფუძნებელთა ჰაბი' : 'Founders Hub', mode: 'founders' },
                { label: isKa ? 'მოსავლის აღება' : 'Harvesting', mode: 'harvesting' }
            ]
        }
    ]);
    const [inputText, setInputText] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [showKeyModal, setShowKeyModal] = useState(false);
    const [customKeyInput, setCustomKeyInput] = useState('');
    const [isTestingKey, setIsTestingKey] = useState(false);
    const [hasActiveCustomKey, setHasActiveCustomKey] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const activeKey = getActiveGeminiApiKey();
        setHasActiveCustomKey(!!activeKey);
    }, []);

    const handleSaveCustomKey = async () => {
        toast.error('Configure API credentials on the authenticated AI server. Browser key storage is disabled.');
    };

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, isLoading]);

    // Parse actionable directives from AI response text (e.g. [ACTION:mode:Label])
    const parseActionsFromResponse = (text: string): { cleanText: string; actions: Array<{ label: string; mode: AppMode }> } => {
        const actionRegex = /\[ACTION:([a-z_]+):([^\]]+)\]/gi;
        const actions: Array<{ label: string; mode: AppMode }> = [];
        let match;

        while ((match = actionRegex.exec(text)) !== null) {
            const mode = match[1].toLowerCase() as AppMode;
            const label = match[2].trim();
            if (mode && label) {
                actions.push({ label, mode });
            }
        }

        const cleanText = text.replace(actionRegex, '').trim();
        return { cleanText, actions };
    };

    const handleSendMessage = async (customQuery?: string) => {
        const query = customQuery || inputText.trim();
        if (!query || isLoading) return;

        const userMsg: ChatMessage = {
            id: `user-${Date.now()}`,
            sender: 'user',
            text: query,
            timestamp: new Date()
        };

        setMessages(prev => [...prev, userMsg]);
        if (!customQuery) setInputText('');
        setIsLoading(true);

        try {
            const systemPrompt = `You are the Master AI Operational Navigator and Lead Solutions Architect for AgriMap Pro (Enterprise Agricultural Platform).
The user is asking for exact system guidance, procedural steps, or technical directives.

CURRENT USER CONTEXT:
- Name: ${currentUser?.name || 'Authorized Member'}
- Email: ${currentUser?.email || 'N/A'}
- Global ID: ${currentUser?.globalUniqueId || 'N/A'}
- Roles: ${currentUser?.roles?.join(', ') || 'Authorized User'}
- Target Language: ${isKa ? 'Georgian (ქართული)' : 'English'}

COMPREHENSIVE KNOWLEDGE OF AGRIMAP PRO:
1. Module: Profile ('profile')
   - Identity, Contact Info (Name, Email, Phone, Country).
   - KYC Verification (Identity upload, Passport/ID document).
   - Unique IDs: Global Unique ID (G-xxx) & Individual ID (I-xxx).
   - Next Step: Proceed to Company Registration in Founders Hub ('founders').

2. Module: Founders & Enterprise ('founders')
   - Register Company Name, Tax ID, Legal Form (LLC, Cooperative, Joint Stock, Individual Enterprise).
   - Add Co-founders, Equity percentages (must total 100%), Signing rights.
   - Next Step: Open Map & Design ('design') to draw land boundaries.

3. Module: Plantation Map & GIS Design ('design')
   - How to find plantation on the map: Use search bar at top of map (type village/region or GPS coordinates like 41.99, 44.02), switch to Satellite/Aerial layer with layer toggle button, or click "Locate Me" GPS button.
   - Drawing Boundaries: Select "Draw Polygon" / "Boundary" tool. Click each vertex corner of the field parcel. Double-click or click initial point to close. The system automatically computes total area in hectares (ha) and square meters (m²). Add seedling rows, varieties, and irrigation lines.
   - Next Step: Register Workers in HR & Tools ('tools').

4. Module: HR, Personnel & Daily Labor ('tools')
   - Register seasonal pickers and permanent staff.
   - Set piece-rate wages (e.g. GEL/USD per Kg or per Box) or daily rate.
   - Terminal PIN code for quick check-in.
   - Daily attendance sheet with 1-click status (Present, Absent, Late).
   - Next Step: Setup Warehouse Stock ('stock').

5. Module: Warehouse & Inventory ('stock')
   - Add packaging crates, punets, fertilizers, chemical sprays, and fuel.
   - Set minimum stock safety thresholds.
   - Automated Stock Deduction: When a harvest event records crates or fruit, the corresponding packaging stock is automatically deducted in real time. When nutrition/spray plans are completed, chemical liters are automatically depleted.
   - Next Step: Create Harvest Event ('harvesting').

6. Module: Harvesting & Weigh Station ('harvesting')
   - Launch Harvest Event: Name, Sector/Field, Crop Variety, Target Kg/Boxes, Box Tare Weight (kg).
   - 6 Operational Protocols:
     * Protocol 1: Scale Weighing with QR Code (Electronic/Bluetooth scale + barcode crate scanning).
     * Protocol 2: Manual Scale Weighing (Operator reads scale, enters worker ID, net weight calculated automatically).
     * Protocol 3: Pallet Batching (Consolidating crates onto shipping pallets with dispatch QR).
     * Protocol 4: Container Lot Dispatch (Refrigerated truck bulk loading).
     * Protocol 5: Direct Box Counting (Tick-sheet counting for piece-rate workers).
     * Protocol 6: NFC / RFID Smart Crates (Contactless high-speed identification).
   - Live reconciliation, quality grading (Class 1, Class 2, Industrial), and automatic picker wage accruals.

7. Module: Accounting & Ledger ('accounting')
   - Chart of accounts, OPEX expense booking, direct wholesale sales revenue.

8. Offline Sync Engine:
   - 100% offline field functionality via IndexedDB/LocalStorage. Data auto-synchronizes when connectivity resumes.

DIRECTIVES & FORMATTING INSTRUCTIONS:
- Give direct, authoritative, step-by-step numbered directives.
- Specify the exact button names and menu paths.
- Recommend the immediate next step in the operational chain.
- Insert ACTION tags for relevant modules so the UI can render 1-click jump buttons. Format: [ACTION:modulename:Button Label]. Valid modules: profile, design, founders, harvesting, stock, tools, accounting, marketplace, guide, ai.
  Example: [ACTION:profile:Manage Profile] or [ACTION:design:Open Map & Draw Boundaries] or [ACTION:harvesting:Start Harvest Event].
- Answer in ${isKa ? 'fluent Georgian (ქართული)' : 'fluent English'}.`;

            const response = await executeGeminiCall({
                contents: `${systemPrompt}\n\nUSER QUESTION: ${query}`
            });

            if (response && response.text) {
                const { cleanText, actions } = parseActionsFromResponse(response.text);
                const assistantMsg: ChatMessage = {
                    id: `assistant-${Date.now()}`,
                    sender: 'assistant',
                    text: cleanText,
                    timestamp: new Date(),
                    actions: actions.length > 0 ? actions : [
                        { label: isKa ? 'SOP გზამკვლევი' : 'SOP Timeline', mode: 'guide' }
                    ]
                };
                setMessages(prev => [...prev, assistantMsg]);
            } else {
                throw new Error('No response from AI engine');
            }
        } catch (error) {
            // High-fidelity fallback to the internal comprehensive knowledge engine
            const fallback = generateKnowledgeBaseResponse(query, language || 'en', isKa);
            const assistantMsg: ChatMessage = {
                id: `assistant-kb-${Date.now()}`,
                sender: 'assistant',
                text: fallback.text,
                timestamp: new Date(),
                actions: fallback.actions,
                isKnowledgeFallback: true
            };
            setMessages(prev => [...prev, assistantMsg]);
        } finally {
            setIsLoading(false);
        }
    };

    const handleCopyText = (text: string) => {
        navigator.clipboard.writeText(text);
        toast.success(isKa ? 'პასუხი კოპირებულია' : 'Response copied to clipboard');
    };

    return (
        <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-sm overflow-hidden flex flex-col h-[750px]">
            {/* CHAT HEADER */}
            <div className="p-5 sm:p-6 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white flex items-center justify-between border-b border-indigo-900/50">
                <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-emerald-500 to-indigo-500 flex items-center justify-center text-white shadow-md shadow-indigo-950">
                        <Bot className="w-6 h-6" />
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <h3 className="font-black text-base text-white uppercase tracking-tight">
                                {isKa ? 'AI სისტემური ასისტენტი & გზამკვლევი' : 'AI System Navigator & Copilot'}
                            </h3>
                            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                        </div>
                        <p className="text-[11px] text-slate-300 font-medium">
                            {isKa 
                                ? 'სრული ტექნიკური მხარდაჭერა, ნაბიჯ-ნაბიჯ ინსტრუქციები და შემდეგი ეტაპის რეკომენდაციები' 
                                : 'Comprehensive operational directives, step-by-step walkthroughs & platform management'}
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        onClick={() => setShowKeyModal(true)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${
                            hasActiveCustomKey
                                ? 'bg-emerald-500/20 border-emerald-400 text-emerald-300 hover:bg-emerald-500/30'
                                : 'bg-slate-800/80 hover:bg-slate-700/80 border-slate-700 text-slate-300 hover:text-white'
                        }`}
                        title="Configure Gemini API Key"
                    >
                        <Key className="w-3.5 h-3.5 text-amber-400" />
                        <span className="hidden sm:inline">
                            {hasActiveCustomKey ? (isKa ? 'გასაღები აქტიურია' : 'Custom Key Active') : (isKa ? 'API გასაღები' : 'API Key')}
                        </span>
                    </button>
                    <div className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800/80 border border-slate-700 text-xs font-mono text-emerald-300">
                        <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Gemini 2.5 + Knowledge Engine</span>
                    </div>
                </div>
            </div>

            {/* PRESET GUIDED QUESTIONS BAR */}
            <div className="p-3 bg-slate-50 border-b border-slate-200/80 overflow-x-auto no-scrollbar">
                <div className="flex items-center gap-2 min-w-max">
                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 flex items-center gap-1 shrink-0 px-1">
                        <Lightbulb className="w-3.5 h-3.5 text-amber-500" />
                        {isKa ? 'სწრაფი შეკითხვები:' : 'Quick Prompts:'}
                    </span>
                    {PRESET_QUESTIONS.map((q, idx) => (
                        <button
                            key={idx}
                            type="button"
                            onClick={() => handleSendMessage(isKa ? q.queryKa : q.queryEn)}
                            disabled={isLoading}
                            className="px-3 py-1.5 rounded-xl bg-white hover:bg-indigo-50 text-slate-700 hover:text-indigo-600 border border-slate-200 hover:border-indigo-300 text-xs font-bold transition-all shadow-2xs shrink-0 cursor-pointer disabled:opacity-50"
                        >
                            {isKa ? q.labelKa : q.labelEn}
                        </button>
                    ))}
                </div>
            </div>

            {/* MESSAGES SCROLL AREA */}
            <div className="flex-1 p-5 sm:p-6 overflow-y-auto space-y-4 custom-scrollbar bg-slate-50/50">
                {messages.map((msg) => (
                    <div
                        key={msg.id}
                        className={`flex gap-3 max-w-3xl ${
                            msg.sender === 'user' ? 'ml-auto flex-row-reverse' : 'mr-auto'
                        }`}
                    >
                        {/* Avatar */}
                        <div
                            className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 shadow-2xs ${
                                msg.sender === 'user'
                                    ? 'bg-indigo-600 text-white'
                                    : 'bg-slate-900 text-emerald-400'
                            }`}
                        >
                            {msg.sender === 'user' ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
                        </div>

                        {/* Bubble */}
                        <div className="space-y-2">
                            <div
                                className={`p-4 sm:p-5 rounded-2xl text-xs sm:text-sm leading-relaxed ${
                                    msg.sender === 'user'
                                        ? 'bg-indigo-600 text-white rounded-tr-xs font-medium'
                                        : 'bg-white text-slate-800 rounded-tl-xs border border-slate-200/90 shadow-xs'
                                }`}
                            >
                                <div className="whitespace-pre-wrap font-sans">
                                    {msg.text}
                                </div>

                                {msg.sender === 'assistant' && (
                                    <div className="flex items-center justify-between pt-3 mt-3 border-t border-slate-100 text-[10px] text-slate-400">
                                        <div className="flex items-center gap-2">
                                            <span>{msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                            {msg.isKnowledgeFallback && (
                                                <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-semibold border border-slate-200 text-[9px]">
                                                    {isKa ? 'სისტემური ცოდნის ბაზა' : 'Internal Knowledge Engine'}
                                                </span>
                                            )}
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => handleCopyText(msg.text)}
                                            className="hover:text-indigo-600 transition-colors flex items-center gap-1 cursor-pointer"
                                            title="Copy response"
                                        >
                                            <Copy className="w-3 h-3" />
                                            <span>{isKa ? 'კოპირება' : 'Copy'}</span>
                                        </button>
                                    </div>
                                )}
                            </div>

                            {/* Actionable Directives / Jump Buttons */}
                            {msg.actions && msg.actions.length > 0 && onNavigateMode && (
                                <div className="flex flex-wrap items-center gap-2 pt-1 pl-1">
                                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 mr-1">
                                        {isKa ? 'პირდაპირი გადასვლა:' : 'Direct Action:'}
                                    </span>
                                    {msg.actions.map((act, aIdx) => (
                                        <button
                                            key={aIdx}
                                            type="button"
                                            onClick={() => onNavigateMode(act.mode)}
                                            className="px-3 py-1.5 rounded-xl bg-indigo-50 hover:bg-indigo-600 text-indigo-700 hover:text-white border border-indigo-200 hover:border-indigo-600 text-xs font-black transition-all flex items-center gap-1.5 shadow-2xs cursor-pointer active:scale-95"
                                        >
                                            <span>{act.label}</span>
                                            <ArrowRight className="w-3 h-3" />
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                ))}

                {isLoading && (
                    <div className="flex gap-3 max-w-md mr-auto">
                        <div className="w-9 h-9 rounded-xl bg-slate-900 text-emerald-400 flex items-center justify-center shrink-0 shadow-2xs">
                            <Bot className="w-4 h-4 animate-spin" />
                        </div>
                        <div className="p-4 rounded-2xl bg-white border border-slate-200 text-xs text-slate-500 flex items-center gap-2 shadow-xs">
                            <RefreshCw className="w-4 h-4 animate-spin text-indigo-600" />
                            <span className="font-semibold">
                                {isKa ? 'AI აანალიზებს სისტემურ მოდულებს და ამზადებს ინსტრუქციას...' : 'Formulating step-by-step operational directives...'}
                            </span>
                        </div>
                    </div>
                )}
                <div ref={messagesEndRef} />
            </div>

            {/* INPUT COMPOSER */}
            <div className="p-4 sm:p-5 bg-white border-t border-slate-200">
                <form
                    onSubmit={(e) => {
                        e.preventDefault();
                        handleSendMessage();
                    }}
                    className="flex items-center gap-2.5"
                >
                    <input
                        type="text"
                        value={inputText}
                        onChange={(e) => setInputText(e.target.value)}
                        placeholder={
                            isKa 
                                ? 'იკითხეთ ნებისმიერი რამ: "რა ვქნა რეგისტრაციის შემდეგ?", "როგორ დავიწყო აწონვა?"...' 
                                : 'Ask anything: "What are the next steps after registration?", "How do I start weighing?"...'
                        }
                        disabled={isLoading}
                        className="flex-1 bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-xs sm:text-sm text-slate-800 placeholder-slate-400 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 font-medium transition-all"
                    />
                    <button
                        type="submit"
                        disabled={!inputText.trim() || isLoading}
                        className="px-5 py-3 rounded-2xl bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white font-bold text-xs uppercase tracking-wider transition-all flex items-center gap-2 shadow-md shadow-indigo-200 disabled:opacity-40 cursor-pointer active:scale-95 shrink-0"
                    >
                        <span>{isKa ? 'გაგზავნა' : 'Send'}</span>
                        <Send className="w-4 h-4" />
                    </button>
                </form>
            </div>

            {/* GEMINI API KEY MODAL */}
            {showKeyModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
                    <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl border border-slate-200">
                        <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
                            <div className="flex items-center gap-2.5">
                                <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center border border-amber-200">
                                    <Key className="w-5 h-5" />
                                </div>
                                <div>
                                    <h4 className="font-black text-slate-900 text-sm uppercase tracking-tight">
                                        {isKa ? 'Gemini API გასაღების პარამეტრები' : 'Gemini API Key Configuration'}
                                    </h4>
                                    <p className="text-[11px] text-slate-500 font-medium">
                                        {isKa ? 'შეიყვანეთ თქვენი საკუთარი Google Gemini API გასაღები' : 'Provide your own Google Gemini API key to avoid rate limits'}
                                    </p>
                                </div>
                            </div>
                        </div>

                        <div className="space-y-4 text-xs text-slate-600">
                            <p className="leading-relaxed">
                                {isKa 
                                    ? 'თუ სისტემური კვოტა ამოიწურება, შეგიძლიათ შეიყვანოთ თქვენი პირადი უფასო Gemini API გასაღები Google AI Studio-დან.' 
                                    : 'When server quota is exhausted, you can supply your own free Gemini API key generated in Google AI Studio.'}
                            </p>

                            <div className="space-y-1.5">
                                <label className="font-bold text-slate-700 text-[11px] uppercase tracking-wider">
                                    {isKa ? 'Google Gemini API Key:' : 'Google Gemini API Key:'}
                                </label>
                                <input
                                    type="password"
                                    value={customKeyInput}
                                    onChange={(e) => setCustomKeyInput(e.target.value)}
                                    placeholder="AIzaSy..."
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs font-mono text-slate-800 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-all"
                                />
                            </div>

                            <div className="p-3 rounded-xl bg-amber-50 border border-amber-200/80 text-[11px] text-amber-800 flex items-start gap-2">
                                <ExternalLink className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                                <div>
                                    <span>
                                        {isKa ? 'უფასო გასაღების მიღება შესაძლებელია აქ:' : 'Get your free key at:'}{' '}
                                    </span>
                                    <a
                                        href="https://aistudio.google.com/app/apikey"
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="font-bold underline text-amber-900 hover:text-amber-700"
                                    >
                                        Google AI Studio API Keys
                                    </a>
                                </div>
                            </div>
                        </div>

                        <div className="flex items-center justify-end gap-2.5 mt-6 pt-4 border-t border-slate-100">
                            <button
                                type="button"
                                onClick={() => {
                                    setShowKeyModal(false);
                                    setCustomKeyInput('');
                                }}
                                className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 text-xs font-bold transition-all cursor-pointer"
                            >
                                {isKa ? 'გაუქმება' : 'Cancel'}
                            </button>
                            <button
                                type="button"
                                onClick={handleSaveCustomKey}
                                disabled={isTestingKey}
                                className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-all shadow-md shadow-indigo-200 flex items-center gap-2 cursor-pointer disabled:opacity-50"
                            >
                                {isTestingKey && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                                <span>{isKa ? 'შენახვა & შემოწმება' : 'Save & Test Key'}</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
