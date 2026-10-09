
import { initializeApp } from 'firebase/app';
import { 
    getFirestore, 
    collection, 
    getDocs, 
    query, 
    where, 
    doc, 
    setDoc, 
    deleteDoc,
    terminate
} from 'firebase/firestore';
import * as fs from 'fs';
import * as path from 'path';

// Read firebase-applet-config.json
const configPath = path.join(process.cwd(), 'firebase-applet-config.json');
const firebaseConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));

// Initialize Firebase client
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function run() {
    const targetEmail = 'ggwall@yandex.com';
    console.log(`=== DIAGNOSTIC & REPAIR SYSTEM FOR ${targetEmail} ===`);

    // 1. Fetch user by email
    const usersRef = collection(db, 'users');
    const userQuery = query(usersRef, where('email', '==', targetEmail));
    const userSnapshot = await getDocs(userQuery);

    if (userSnapshot.empty) {
        console.log(`[ERROR] No user found with email: ${targetEmail}`);
        await terminate(db).catch(() => {});
        process.exit(0);
        return;
    }

    const currentDoc = userSnapshot.docs[0];
    const currentUser = { id: currentDoc.id, ...currentDoc.data() as any };
    console.log(`[INFO] Found active user document:`);
    console.log(`  - Document ID (UID): ${currentUser.id}`);
    console.log(`  - Name: ${currentUser.name}`);
    console.log(`  - KYC Status: ${currentUser.kycStatus || 'none'}`);
    console.log(`  - Verification Status: ${currentUser.verificationStatus}`);
    console.log(`  - personalNumber: ${currentUser.personalNumber || 'None'}`);
    console.log(`  - Roles:`, currentUser.roles);
    console.log(`  - currentOrgId: ${currentUser.currentOrgId || 'None'}`);

    // 2. Fetch employee documents by email
    console.log(`\n[INFO] Searching for employee records with email: ${targetEmail}...`);
    const employeesRef = collection(db, 'employees');
    const employeeQuery = query(employeesRef, where('email', '==', targetEmail));
    const employeeSnapshot = await getDocs(employeeQuery);

    if (employeeSnapshot.empty) {
        console.log(`[WARN] No employee profiles found for ${targetEmail}`);
    } else {
        console.log(`[INFO] Found ${employeeSnapshot.size} employee profiles:`);
        for (const empDoc of employeeSnapshot.docs) {
            const emp = { id: empDoc.id, ...empDoc.data() as any };
            console.log(`  - Employee Doc ID: ${emp.id}`);
            console.log(`    * OrganizationId: ${emp.organizationId}`);
            console.log(`    * Role / Position: ${emp.roleId || emp.position}`);
            console.log(`    * Name: ${emp.name}`);
        }
    }

    // 3. Fetch all memberships in the database (since we want to find any that belong to old IDs)
    console.log(`\n[INFO] Loading all memberships from database...`);
    const membershipsRef = collection(db, 'memberships');
    const membershipsSnapshot = await getDocs(membershipsRef);
    console.log(`[INFO] Total memberships fetched: ${membershipsSnapshot.size}`);

    const matchByUserId: any[] = [];

    // Let's inspect memberships for potential old ID matches
    const targetOrgIds = employeeSnapshot.docs.map(doc => (doc.data() as any).organizationId);
    
    for (const memDoc of membershipsSnapshot.docs) {
        const mem = { id: memDoc.id, ...memDoc.data() as any };
        
        // If they belong to their organization, but userId is NOT their current real UID, it must be their old UID!
        if (targetOrgIds.includes(mem.organizationId)) {
            if (mem.userId !== currentUser.id) {
                matchByUserId.push(mem);
            }
        }
    }

    if (matchByUserId.length === 0) {
        console.log(`[INFO] No old memberships identified for this user's organizations.`);
    } else {
        console.log(`[INFO] Found ${matchByUserId.length} orphaned memberships for this user's organizations:`);
        for (const mem of matchByUserId) {
            console.log(`  - Org: ${mem.organizationId}, Old UserId: ${mem.userId}, Role: ${mem.role}, DocID: ${mem.id}`);
        }
    }

    // 4. PERFORM REPAIRS
    console.log(`\n=== PERFORMING COOLDOWN / SELF-HEAL REPAIRS ===`);
    let repairCount = 0;

    for (const mem of matchByUserId) {
        const oldUserId = mem.userId;
        const orgId = mem.organizationId;
        const newMembershipId = `${currentUser.id}_${orgId}`;

        console.log(`\n[REPAIR] Migrating membership for org ${orgId}:`);
        console.log(`  - Old Membership ID: ${mem.id}`);
        console.log(`  - New Membership ID: ${newMembershipId}`);

        // Write the new membership
        const newMem = {
            ...mem,
            id: newMembershipId,
            userId: currentUser.id,
            status: 'active'
        };
        const newMemDocRef = doc(db, 'memberships', newMembershipId);
        await setDoc(newMemDocRef, newMem);
        console.log(`  [SUCCESS] Written new membership document.`);

        // Delete the old membership
        const oldMemDocRef = doc(db, 'memberships', mem.id);
        await deleteDoc(oldMemDocRef);
        console.log(`  [SUCCESS] Deleted old membership document.`);

        repairCount++;
    }

    // Also migrate employee records to the correct employee id 'emp-[userId]-[orgId]'
    for (const empDoc of employeeSnapshot.docs) {
        const emp = { id: empDoc.id, ...empDoc.data() as any };
        const correctEmpId = `emp-${currentUser.id}-${emp.organizationId}`;
        
        if (emp.id !== correctEmpId) {
            console.log(`\n[REPAIR] Migrating employee profile:`);
            console.log(`  - Old Employee ID: ${emp.id}`);
            console.log(`  - New Employee ID: ${correctEmpId}`);

            const newEmp = {
                ...emp,
                id: correctEmpId,
                idNumber: currentUser.personalNumber || emp.idNumber || ''
            };
            const newEmpDocRef = doc(db, 'employees', correctEmpId);
            await setDoc(newEmpDocRef, newEmp);
            console.log(`  [SUCCESS] Written new employee document.`);

            const oldEmpDocRef = doc(db, 'employees', emp.id);
            await deleteDoc(oldEmpDocRef);
            console.log(`  [SUCCESS] Deleted old employee document.`);

            repairCount++;
        }
    }

    // Update currentOrgId on user document if it's currently null or incorrect
    if (targetOrgIds.length > 0 && (!currentUser.currentOrgId || !targetOrgIds.includes(currentUser.currentOrgId))) {
        const preferredOrgId = targetOrgIds[0];
        console.log(`\n[REPAIR] Updating active user's currentOrgId to: ${preferredOrgId}`);
        const userDocRef = doc(db, 'users', currentUser.id);
        
        // Also ensure roles includes Founder/Admin if employee/membership role dictates
        const currentRoles = Array.isArray(currentUser.roles) ? currentUser.roles : [];
        const foundRolesToInject = matchByUserId.map(m => m.role);
        const updatedRoles = Array.from(new Set([...currentRoles.filter(r => r !== 'Guest'), ...foundRolesToInject, 'company']));

        await setDoc(userDocRef, { 
            currentOrgId: preferredOrgId,
            roles: updatedRoles,
            isGuest: false,
            verificationStatus: 'verified'
        }, { merge: true });
        console.log(`  [SUCCESS] Updated user document.`);
        repairCount++;
    }

    console.log(`\n=== REPAIRS COMPLETED: ${repairCount} changes committed. ===`);
    
    // Explicitly terminate Firestore connection and exit cleanly
    await terminate(db).catch(() => {});
    process.exit(0);
}

run().catch(async (e) => {
    console.error(e);
    await terminate(db).catch(() => {});
    process.exit(1);
});
