import type { Employee, User, Role } from '../types';

/**
 * Utility functions to filter employees based on roles, modules, and access privileges.
 * Prevents daily pickers / seasonal workers from cluttering specialized operational modules
 * (Agronomy, Work Assignments, Stock Management, etc.).
 */

/**
 * Detects if an employee is a daily laborer, seasonal picker, or per-weight harvester.
 */
export function isDailyWorker(employee: Employee | Partial<Employee> | User | Partial<User> | null | undefined): boolean {
    if (!employee) return false;

    // Check string role titles
    const roleStr = String((employee as any).role || '').toLowerCase();
    const rolesArr = Array.isArray((employee as any).roles) ? (employee as any).roles.map((r: any) => String(r).toLowerCase()) : [];
    const nameStr = String(employee.name || '').toLowerCase();

    // Specific picker/daily role indicators
    const dailyKeywords = [
        'picker',
        'მკრეფავი',
        'daily worker',
        'დღიური მუშა',
        'seasonal worker',
        'seasonal picker',
        'daily laborer',
        'harvester',
        'მუშა'
    ];

    // Priority exception: If role is explicit manager / agronomist / admin / specialist, they are NOT daily workers
    const privilegedKeywords = [
        'agronomist', 'აგრონომი', 'manager', 'მენეჯერი', 'admin', 'ადმინისტრატორი',
        'founder', 'director', 'supervisor', 'ზედამხედველი', 'specialist', 'სპეციალისტი',
        'technician', 'ტექნიკოსი', 'engineer', 'operator', 'ოპერატორი', 'foreman', 'ბრიგადირი'
    ];

    for (const pk of privilegedKeywords) {
        if (roleStr.includes(pk) || rolesArr.some((r: string) => r.includes(pk))) {
            return false;
        }
    }

    for (const dk of dailyKeywords) {
        if (roleStr.includes(dk) || rolesArr.some((r: string) => r.includes(dk))) {
            return true;
        }
    }

    // Check paymentType / employeeType for unassigned roles
    const paymentType = (employee as any).paymentType;
    const employeeType = (employee as any).employeeType;

    if (paymentType === 'per_weight' || (paymentType === 'daily' && employeeType === 'Seasonal')) {
        return true;
    }

    if ((employee as any).workerUniqueId && String((employee as any).workerUniqueId).startsWith('W-')) {
        return true;
    }

    return false;
}

/**
 * Filters employees who are authorized to execute or log Agronomy plans (feeding, treatment, fertigation).
 * Only Agronomists, Managers, Administrators, Directors, Supervisors, and Specialists.
 * Excludes all daily pickers and daily workers.
 */
export function getAgronomyEligibleEmployees(employees: Employee[] = []): Employee[] {
    if (!employees || employees.length === 0) return [];

    const agronomyAllowedKeywords = [
        'agronomist',
        'აგრონომი',
        'chief agronomist',
        'მთავარი აგრონომი',
        'senior agronomist',
        'manager',
        'მენეჯერი',
        'field manager',
        'admin',
        'ადმინისტრატორი',
        'founder',
        'director',
        'supervisor',
        'ზედამხედველი',
        'specialist',
        'სპეციალისტი',
        'fertigation',
        'technician',
        'ტექნიკოსი',
        'operator',
        'ოპერატორი',
        'foreman',
        'ბრიგადირი'
    ];

    const eligible = employees.filter(emp => {
        // Exclude daily workers
        if (isDailyWorker(emp)) return false;

        const roleLower = String(emp.role || '').toLowerCase();
        const roleIdLower = String(emp.roleId || '').toLowerCase();

        // Check if role or roleId matches allowed keywords
        const matchesRole = agronomyAllowedKeywords.some(keyword => 
            roleLower.includes(keyword) || roleIdLower.includes(keyword)
        );

        if (matchesRole) return true;

        // Check visibleModules if configured
        if (emp.visibleModules && (emp.visibleModules.includes('agronomy') || emp.visibleModules.includes('admin'))) {
            return true;
        }

        // Include Permanent / Contract staff with regular monthly/salary/hourly compensation if no daily worker match
        if ((emp.employeeType === 'Permanent' || emp.employeeType === 'Contract') && emp.paymentType !== 'daily' && emp.paymentType !== 'per_weight') {
            return true;
        }

        return false;
    });

    // If no eligible employee found due to empty mock data, fallback to non-daily workers
    if (eligible.length === 0) {
        return employees.filter(e => !isDailyWorker(e));
    }

    return eligible;
}

/**
 * Filters employees eligible for Work Assignments & Planner task execution / leadership.
 * Excludes bulk daily pickers, but includes team leaders, specialists, technicians, and permanent staff.
 */
export function getTaskEligibleEmployees(employees: Employee[] = []): Employee[] {
    if (!employees || employees.length === 0) return [];

    const eligible = employees.filter(emp => {
        // Always exclude pure daily pickers
        if (isDailyWorker(emp)) return false;

        // Include Permanent or Contract employees, or anyone with salaried/hourly roles
        if (emp.employeeType === 'Permanent' || emp.employeeType === 'Contract') return true;
        if (emp.paymentType === 'salary' || emp.paymentType === 'hourly') return true;

        const roleLower = String(emp.role || '').toLowerCase();
        const taskKeywords = [
            'manager', 'admin', 'supervisor', 'operator', 'technician', 
            'agronomist', 'foreman', 'specialist', 'driver', 'lead'
        ];

        return taskKeywords.some(k => roleLower.includes(k));
    });

    if (eligible.length === 0) {
        return employees.filter(e => !isDailyWorker(e));
    }

    return eligible;
}

/**
 * Filters employees authorized for Stock Management & Direct Charges.
 * Excludes daily workers.
 */
export function getInventoryEligibleEmployees(employees: Employee[] = []): Employee[] {
    if (!employees || employees.length === 0) return [];

    return employees.filter(emp => {
        if (isDailyWorker(emp)) return false;
        
        const roleLower = String(emp.role || '').toLowerCase();
        const invKeywords = [
            'manager', 'admin', 'warehouse', 'storekeeper', 'agronomist',
            'founder', 'supervisor', 'operator', 'specialist', 'accountant'
        ];

        if (invKeywords.some(k => roleLower.includes(k))) return true;
        if (emp.employeeType === 'Permanent' || emp.employeeType === 'Contract') return true;

        return false;
    });
}
