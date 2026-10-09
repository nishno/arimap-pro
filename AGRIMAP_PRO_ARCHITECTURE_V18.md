
# AgriMap Pro: System Architecture & Root Administration (V18)

This document serves as the master architectural annotation for AgriMap Pro, detailing the system's structure, user management, permissions, and monetization logic from the perspective of the **ROOT_USER** (`niku`).

---

## 1. Core Identity & Status Management

The system is built on a "Person-First" model. Each user account is a unique identity. Their status dictates their access level and visibility within the ecosystem.

### User Statuses:

*   **Active / Online**: User is logged in and actively using the application. Indicated by a green status icon.
*   **Trial**: User is within their initial 30-day free trial period with full access to all Pro modules.
*   **Paid**: User's trial has expired, and they have an active, paid subscription. Full access to purchased modules.
*   **Unpaid**: User's subscription has lapsed. Access is restricted to "Always Free" modules until payment is made.
*   **Guest**: A user who has registered but not completed the full onboarding for a specific role. Access is limited to "Always Free" modules.
*   **Inactive**: User account has been manually suspended by the Root User. The user cannot log in.

### Company Statuses:

*   **Active (Trial/Paid)**: The company account is in good standing.
*   **Suspended**: The company's subscription has lapsed, restricting access for all associated users (except for the Founder, who can access billing).

---

## 2. Hierarchical Roles

Roles define the default permission sets and user capabilities within the application.

1.  **Founder**: The creator of a Company. Has full control over their company's projects, billing, and user management.
2.  **Admin**: Appointed by a Founder. Has extensive management rights within a specific company but cannot manage billing or delete the company.
3.  **Manager**: A mid-level role with operational control over specific projects or teams (e.g., Field Manager).
4.  **Agronomy**: Specialist role focused on crop health, nutrition plans, and geospatial planning.
5.  **Accountant**: Specialist role with access to financial modules like Payroll and Ledger.
6.  **Agro-Agent (Brigadier)**: A labor contractor who manages teams of workers for hire.
7.  **Employee (Worker)**: A field worker who executes tasks and logs operational data.
8.  **Guest**: A registered user with limited, "Always Free" access.

---

## 3. Module & Component Breakdown

This section details the full hierarchy of the application's features.

### Module 1: Dashboard
*   **Purpose**: Provides a high-level, real-time overview of all operations.
*   **Components**:
    *   **Staff Attendance**:
        *   *Tools*: View daily check-ins, filter by date, see present/absent/late counts.
    *   **Harvest Pulse**:
        *   *Tools*: View live yield data from active harvest sessions, see total seasonal yield.
    *   **Seedling Pulse**:
        *   *Tools*: See a health summary (Good, Suspicious, Dried) of all registered seedlings.
    *   **Market Feed**:
        *   *Tools*: View the latest listings from the Marketplace.
    *   **Daily Briefing**:
        *   *Tools*: AI-curated news on agricultural prices, weather, and innovations.
    *   **Weather Widget**:
        *   *Tools*: View current and forecasted weather for the primary plantation location.
    *   **Field Summary**:
        *   *Tools*: See total cultivated area, plant counts, and variety distribution.
    *   **Upcoming Tasks**:
        *   *Tools*: A list of tasks scheduled for the current day.

### Module 2: Communicator
*   **Purpose**: Central hub for all internal and external communication.
*   **Components**:
    *   **Team Hub**:
        *   *Tools*: Private group chats, direct messaging, user status indicators (Online, Busy, Offline).
    *   **Public Forum**:
        *   *Tools*: Create posts, reply to threads, browse public discussions.
    *   **Knowledge Base**:
        *   *Tools*: Full-text search across all public and internal (permission-based) communications.
    *   **Partner Discovery**:
        *   *Tools*: Filter users by role/region, initiate direct messages, view profiles on the map.

### Module 3: AI-Agro Analyst
*   **Purpose**: Leverages AI for strategic planning and problem-solving.
*   **Components**:
    *   **Agro-Intelligence Planner**:
        *   *Tools*: Input soil data and location to get crop suitability rankings and recommendations.
    *   **Disease Detection**:
        *   *Tools*: Upload plant images to identify diseases and receive treatment suggestions.
    *   **Doc Analysis**:
        *   *Tools*: Compare multiple documents (e.g., lab reports) to analyze trends.
    *   **Market Intelligence**:
        *   *Tools*: Use natural language queries to get live market data, competitor info, and profitability analysis via Google Search grounding.

### Module 4: Market
*   **Purpose**: A digital marketplace for buying and selling produce and services.
*   **Components**:
    *   **Listing Browser**:
        *   *Tools*: Filter listings by type (Sale/Wanted), crop, region. View details.
    *   **Create Listing Form**:
        *   *Tools*: Form to create "For Sale" or "Wanted" posts with detailed specifications.
    *   **Bidding System**:
        *   *Tools*: Place bids on auction-style listings.
    *   **Review System**:
        *   *Tools*: Leave ratings and comments for completed transactions.

### Module 5: Map Planner
*   **Purpose**: Core geospatial tool for designing and managing plantations.
*   **Components**:
    *   **Contents Panel (Layer Tree)**:
        *   *Tools*: Create/delete/rename layers and folders, manage item visibility, drag-and-drop hierarchy.
    *   **Drawing Toolbar**:
        *   *Tools*: Draw polygons (areas), lines (trenches, paths), and placemarks (notes).
    *   **Info Panel**:
        *   *Tools*: Edit properties of selected features (name, color, type), access advanced generation tools.
    *   **Trench Generator**:
        *   *Tools*: Automatically generate parallel trench lines within a polygon based on spacing and angle.
    *   **Seedling Generator**:
        *   *Tools*: Automatically populate trenches with seedlings based on variety rules.
    *   **Irrigation Planner**:
        *   *Tools*: Design and lay out irrigation grids.

### Module 6: Agronomy
*   **Purpose**: Manage crop nutrition and treatment schedules.
*   **Components**:
    *   **Recipe Manager (Nutrition Plans)**:
        *   *Tools*: Create and manage multi-ingredient "recipes" for feeding or treatment.
    *   **Execution Logger**:
        *   *Tools*: Log the execution of a plan, specifying the date, sectors, and actual quantities used.
    *   **Calendar View**:
        *   *Tools*: Visualize past and future planned executions on a monthly calendar.

### Module 7: Field Manager
*   **Purpose**: Operational task management and workforce tracking.
*   **Components**:
    *   **Work Assignment Planner**:
        *   *Tools*: Create, assign, and track tasks for employees and machinery.
    *   **Daily Log (Attendance)**:
        *   *Tools*: Mark employee attendance (Present, Absent, etc.).
    *   **Operational Log Map**:
        *   *Tools*: Draw polygons on the map to log the specific area covered during a task.

### Module 8: Harvest
*   **Purpose**: End-to-end management of harvesting sessions.
*   **Components**:
    *   **Session Planner**:
        *   *Tools*: Create a harvest event, assign pickers and vehicles, define payment models.
    *   **Weigh Station**:
        *   *Tools*: Log individual crates of produce, linking them to a picker via QR code or manual selection.
    *   **Live Dashboard**:
        *   *Tools*: Monitor real-time statistics for an active harvest (total weight, cost, picker performance).
    *   **Payroll & Adjustment Terminal**:
        *   *Tools*: Manually override calculated hours/weights, add bonuses, and finalize picker payments.

### Module 9: Stock
*   **Purpose**: Inventory and warehouse management.
*   **Components**:
    *   **Item Registry**:
        *   *Tools*: Add, edit, and view all inventory items (produce, materials, assets).
    *   **Purchase Order System**:
        *   *Tools*: Create and manage purchase orders. Automatically update stock upon receipt.
    *   **Supplier Directory**:
        *   *Tools*: Maintain a list of suppliers and their contact information.
    *   **Transaction History**:
        *   *Tools*: View a full ledger of stock movements for any item.

### Module 10: Accounts
*   **Purpose**: Financial ledger and payroll management.
*   **Components**:
    *   **Transaction Ledger**:
        *   *Tools*: View all financial transactions. Manually add new transactions.
    *   **Payroll Manager**:
        *   *Tools*: Generate payroll runs based on completed work and harvest sessions. Mark runs as paid.
    *   **Manager Wallets (Petty Cash)**:
        *   *Tools*: View and manage balances for individual manager "wallets". Reimburse managers for expenses.

### Module 11: Profitability
*   **Purpose**: High-level financial analysis for founders.
*   **Components**:
    *   **Forensic Production Audit (Founders Vault)**:
        *   *Tools*: View a breakdown of costs (labor, machinery, materials) vs. revenue for completed harvests.
    *   **Settlement Terminal**:
        *   *Tools*: Finalize the profitability of a harvest, set prices, and determine the monetization path (Market, Storage, etc.).

### Module 12: Settings
*   **Purpose**: User and system configuration.
*   **Components**:
    *   **HR Management**:
        *   *Tools*: Onboard new employees, edit profiles, print ID cards.
    *   **Team Units (Groups)**:
        *   *Tools*: Create and manage groups of employees.
    *   **Roles & Permissions**:
        *   *Tools*: Create and define custom roles with specific permissions.

### Module 13: Personalization
*   **Purpose**: Customize the application's appearance.
*   **Components**:
    *   **Theme Selector**:
        *   *Tools*: Apply pre-defined color and font themes.
    *   **Customizer**:
        *   *Tools*: Set custom colors, fonts, and background images.

---

## 4. Global Permissions Matrix

| Module / Component          | Guest | Employee | Agro-Agent | Accountant | Agronomist | Manager | Admin | Founder | Root  |
| --------------------------- | :---: | :------: | :--------: | :--------: | :--------: | :-----: | :---: | :-----: | :---: |
| **Dashboard**               |   ✅   |    ✅     |     ✅      |     ✅      |     ✅      |    ✅    |   ✅   |    ✅    |   ✅   |
| **AI-Agro Analyst**         |   ✅   |    ✅     |     ✅      |     ✅      |     ✅      |    ✅    |   ✅   |    ✅    |   ✅   |
| **Communicator**            |   ✅   |    ✅     |     ✅      |     ✅      |     ✅      |    ✅    |   ✅   |    ✅    |   ✅   |
| **Market (Discovery)**      |   👀   |    👀     |     👀      |     ❌      |     👀      |    ✅    |   ✅   |    ✅    |   ✅   |
| **Map Planner**             |   👀   |    👀     |     👀      |     ❌      |     ✅      |    ✅    |   ✅   |    ✅    |   ✅   |
| **Agronomy Logs**           |   ❌   |    ❌     |     ❌      |     ❌      |     ✅      |    ✅    |   ✅   |    ✅    |   ✅   |
| **Harvest & Stock**         |   ❌   |    ❌     |     ❌      |     👀      |     👀      |    ✅    |   ✅   |    ✅    |   ✅   |
| **Payroll & Ledger**        |   ❌   |    ❌     |     ❌      |     ✅      |     ❌      |    ❌    |   ✅   |    ✅    |   ✅   |
| **Profitability (Vault)**   |   ❌   |    ❌     |     ❌      |     ❌      |     ❌      |    ❌    |   ❌   |    ✅    |   ✅   |
| **Settings (Super Admin)**  |   ❌   |    ❌     |     ❌      |     ❌      |     ❌      |    ❌    |   ✅   |    ✅    |   ✅   |

**Legend**: ✅ = Full Access, 👀 = Read-Only, ❌ = No Access

---

## 5. Root User Control Center (Conceptual UI)

The Root User (`niku`) has a dedicated administrative interface for global user and system management.

### User Management Dashboard

A table view of all registered users with the following columns:

*   **User/Company Name**
*   **Email**
*   **Role(s)**
*   **Status** (`Active`, `Trial`, `Paid`, `Unpaid`, `Inactive`)
*   **Registration Date**
*   **Trial Ends**
*   **Actions** (Edit)

### User Detail Management Panel

Clicking "Edit" on a user opens a detailed management panel:

*   **User Information**: View all user-provided data.
*   **Subscription Control**:
    *   **Status**: A dropdown to manually set the user's billing tier (`TRIAL`, `ACTIVE (PAID)`, `FREE`, `INACTIVE`).
    *   **Trial Period**:
        *   A date picker to set a custom trial end date.
        *   Buttons: `+7 days`, `+30 days`, `End Trial Now`.
    *   **Subscription Price**:
        *   An input field to set a custom monthly price for this user (in GEL/USD).
        *   A button `Grant Free Access` which sets the price to 0 and status to `FREE`.
*   **Role Management**: Assign or revoke any role (except `ROOT_USER`).
*   **Lifecycle Actions**:
    *   `Suspend Account`: Deactivates the user's login.
    *   `Delete User`: Permanently removes the user and their associated data.

---

## 6. Software Upgrade & Maintenance Protocol

To ensure data integrity during software updates, the following protocol is in place.

### Maintenance Mode

*   **Activation**: The `ROOT_USER` can trigger a global "Maintenance Mode" from their control panel.
*   **User Experience**: When active, all users (except Root) attempting to access the application will see a simple, full-page message: *"System improvement in progress. AgriMap Pro will be back online shortly. Please return in 10 minutes."*
*   **Purpose**: This prevents any read/write operations to the database during critical migrations, eliminating the risk of data corruption.

### Data Migration Bridge

*   **Concept**: For complex schema changes, a "Data Migration Bridge" is used. This is a temporary, intermediate data structure or database schema.
*   **Process**:
    1.  Maintenance Mode is activated.
    2.  Data from the old schema is transformed and loaded into the "Bridge" structure. The original data is left untouched.
    3.  The new application code, which reads from the new schema, is deployed.
    4.  A final script moves data from the "Bridge" to the new, final schema.
    5.  Thorough validation checks are performed.
    6.  Maintenance Mode is deactivated.
*   **Safety**: If any step fails, the process can be rolled back by simply pointing the old application code back to the original, untouched database. The "Bridge" can be discarded, ensuring zero data loss.

