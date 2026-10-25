import { 
  isRouteAuthorized, 
  getUserEffectivePermissions, 
  hasPermission,
  PERM_FORECASTS_VIEW,
  PERM_REPORTS_VIEW,
  PERM_INVENTORY_VIEW,
  PERM_WAREHOUSES_MANAGE,
  PERM_TRANSFERS_VIEW,
  PERM_OPTIMIZATION_RUN,
  PERM_SCANS_EXECUTE,
  PERM_IOT_READINGS_VIEW,
  PERM_INTEGRATIONS_MANAGE,
  PERM_USERS_MANAGE,
  PERM_ORGANIZATIONS_MANAGE,
  PERM_AUDIT_VIEW
} from '../utils/permissions';
import { RoleType } from '../types';

// Mock navigation groups matching Sidebar.tsx exactly
interface NavItem {
  to: string;
  label: string;
  allowedRoles?: RoleType[];
  requiredPermission?: string;
}

interface NavGroup {
  name: string;
  items: NavItem[];
}

const NAV_GROUPS: NavGroup[] = [
  {
    name: 'ANALYTICS',
    items: [
      { 
        to: '/forecasting', 
        label: 'Forecasting', 
        allowedRoles: ['super_admin', 'org_admin', 'supply_chain_manager'],
        requiredPermission: PERM_FORECASTS_VIEW
      },
      { 
        to: '/forecasting#evaluation', 
        label: 'Reports', 
        allowedRoles: ['super_admin', 'org_admin', 'supply_chain_manager', 'warehouse_manager'],
        requiredPermission: PERM_REPORTS_VIEW
      }
    ]
  },
  {
    name: 'INVENTORY',
    items: [
      { 
        to: '/inventory', 
        label: 'Inventory', 
        allowedRoles: ['super_admin', 'org_admin', 'supply_chain_manager', 'warehouse_manager', 'distributor', 'operator'],
        requiredPermission: PERM_INVENTORY_VIEW
      },
      { 
        to: '/inventory?tab=warehouses', 
        label: 'Warehouses', 
        allowedRoles: ['super_admin', 'org_admin'],
        requiredPermission: PERM_WAREHOUSES_MANAGE
      },
      { 
        to: '/inventory?tab=batches', 
        label: 'Batches & Expiry', 
        allowedRoles: ['super_admin', 'org_admin', 'supply_chain_manager', 'warehouse_manager', 'operator'],
        requiredPermission: PERM_INVENTORY_VIEW
      }
    ]
  },
  {
    name: 'OPERATIONS',
    items: [
      { 
        to: '/express', 
        label: 'Transfers', 
        allowedRoles: ['super_admin', 'org_admin', 'supply_chain_manager', 'warehouse_manager', 'distributor'],
        requiredPermission: PERM_TRANSFERS_VIEW
      },
      { 
        to: '/simulation', 
        label: 'Route Simulator', 
        allowedRoles: ['super_admin', 'org_admin', 'supply_chain_manager', 'warehouse_manager', 'distributor', 'operator']
      },
      { 
        to: '/optimizer', 
        label: 'Optimization', 
        allowedRoles: ['super_admin', 'org_admin', 'supply_chain_manager'],
        requiredPermission: PERM_OPTIMIZATION_RUN
      },
      { 
        to: '/scanner', 
        label: 'QR Scanner', 
        allowedRoles: ['super_admin', 'org_admin', 'warehouse_manager', 'distributor', 'operator', 'supply_chain_manager'],
        requiredPermission: PERM_SCANS_EXECUTE
      }
    ]
  },
  {
    name: 'INTEGRATIONS',
    items: [
      { 
        to: '/iot', 
        label: 'IoT Monitoring', 
        allowedRoles: ['super_admin', 'org_admin', 'supply_chain_manager', 'warehouse_manager'],
        requiredPermission: PERM_IOT_READINGS_VIEW
      },
      { 
        to: '/whatsapp', 
        label: 'WhatsApp Alerts', 
        allowedRoles: ['super_admin', 'org_admin', 'supply_chain_manager', 'warehouse_manager'],
        requiredPermission: PERM_INTEGRATIONS_MANAGE
      }
    ]
  },
  {
    name: 'ADMINISTRATION',
    items: [
      { 
        to: '/users', 
        label: 'Users & Access', 
        allowedRoles: ['super_admin', 'org_admin'],
        requiredPermission: PERM_USERS_MANAGE
      },
      { 
        to: '/users?tab=org', 
        label: 'Organization Settings', 
        allowedRoles: ['super_admin'],
        requiredPermission: PERM_ORGANIZATIONS_MANAGE
      },
      { 
        to: '/inventory?tab=ledger', 
        label: 'Audit Logs', 
        allowedRoles: ['super_admin', 'org_admin'],
        requiredPermission: PERM_AUDIT_VIEW
      }
    ]
  }
];

function filterNavGroupsForRole(role: RoleType, permissions?: string[]) {
  return NAV_GROUPS.map((group) => {
    const visibleItems = group.items.filter((item) =>
      isRouteAuthorized(item.allowedRoles, item.requiredPermission, role, permissions)
    );
    return { ...group, items: visibleItems };
  }).filter((group) => group.items.length > 0);
}

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`TEST FAILED: ${message}`);
  }
  console.log(`✓ ${message}`);
}

console.log('=== RUNNING FRONTEND RBAC & NAVIGATION TEST SUITE ===\n');

// --------------------------------------------------------------------------
// TEST 1: Warehouse Operator Access Restrictions
// --------------------------------------------------------------------------
console.log('[Test 1: Warehouse Operator Role]');
const operatorGroups = filterNavGroupsForRole('operator');
const operatorGroupNames = operatorGroups.map(g => g.name);

// Operator MUST NOT see ANALYTICS, INTEGRATIONS, or ADMINISTRATION
assert(!operatorGroupNames.includes('ANALYTICS'), 'Warehouse Operator cannot see ANALYTICS parent group');
assert(!operatorGroupNames.includes('INTEGRATIONS'), 'Warehouse Operator cannot see INTEGRATIONS parent group');
assert(!operatorGroupNames.includes('ADMINISTRATION'), 'Warehouse Operator cannot see ADMINISTRATION parent group');

// Operator MUST see INVENTORY and OPERATIONS
assert(operatorGroupNames.includes('INVENTORY'), 'Warehouse Operator sees INVENTORY parent group');
assert(operatorGroupNames.includes('OPERATIONS'), 'Warehouse Operator sees OPERATIONS parent group');

// Operator individual items
const operatorItems = operatorGroups.flatMap(g => g.items.map(i => i.to));
assert(!operatorItems.includes('/forecasting'), 'Forecasting is hidden from Warehouse Operator');
assert(!operatorItems.includes('/forecasting#evaluation'), 'Reports is hidden from Warehouse Operator');
assert(!operatorItems.includes('/optimizer'), 'Optimizer is hidden from Warehouse Operator');
assert(!operatorItems.includes('/iot'), 'IoT Monitoring is hidden from Warehouse Operator');
assert(!operatorItems.includes('/users'), 'Users is hidden from Warehouse Operator');
assert(!operatorItems.includes('/express'), 'Transfers is hidden from Warehouse Operator');
assert(!operatorItems.includes('/inventory?tab=warehouses'), 'Warehouse settings is hidden from Operator');

assert(operatorItems.includes('/inventory'), 'Inventory is accessible to Warehouse Operator');
assert(operatorItems.includes('/inventory?tab=batches'), 'Batches is accessible to Warehouse Operator');
assert(operatorItems.includes('/simulation'), 'Route Simulator is accessible to Warehouse Operator');
assert(operatorItems.includes('/scanner'), 'QR Scanner is accessible to Warehouse Operator');

// Route guard direct checks for Operator
assert(!isRouteAuthorized(['super_admin', 'org_admin', 'supply_chain_manager'], PERM_FORECASTS_VIEW, 'operator'), 'Direct navigation to /forecasting rejected for Operator');
assert(!isRouteAuthorized(['super_admin', 'org_admin', 'supply_chain_manager'], PERM_OPTIMIZATION_RUN, 'operator'), 'Direct navigation to /optimizer rejected for Operator');
assert(!isRouteAuthorized(['super_admin', 'org_admin'], PERM_USERS_MANAGE, 'operator'), 'Direct navigation to /users rejected for Operator');
assert(isRouteAuthorized(['super_admin', 'org_admin', 'supply_chain_manager', 'warehouse_manager', 'distributor', 'operator'], PERM_INVENTORY_VIEW, 'operator'), 'Direct navigation to /inventory allowed for Operator');
assert(isRouteAuthorized(['super_admin', 'org_admin', 'warehouse_manager', 'distributor', 'operator'], PERM_SCANS_EXECUTE, 'operator'), 'Direct navigation to /scanner allowed for Operator');

console.log('Test 1 Passed!\n');

// --------------------------------------------------------------------------
// TEST 2: Supply Chain Manager Role
// --------------------------------------------------------------------------
console.log('[Test 2: Supply Chain Manager Role]');
const scmGroups = filterNavGroupsForRole('supply_chain_manager');
const scmGroupNames = scmGroups.map(g => g.name);

assert(scmGroupNames.includes('ANALYTICS'), 'Supply Chain Manager sees ANALYTICS');
assert(scmGroupNames.includes('OPERATIONS'), 'Supply Chain Manager sees OPERATIONS');
assert(scmGroupNames.includes('INTEGRATIONS'), 'Supply Chain Manager sees INTEGRATIONS');
assert(!scmGroupNames.includes('ADMINISTRATION'), 'Supply Chain Manager cannot see ADMINISTRATION');

const scmItems = scmGroups.flatMap(g => g.items.map(i => i.to));
assert(scmItems.includes('/forecasting'), 'Forecasting is visible to Supply Chain Manager');
assert(scmItems.includes('/optimizer'), 'Optimizer is visible to Supply Chain Manager');
assert(scmItems.includes('/express'), 'Transfers is visible to Supply Chain Manager');
assert(!scmItems.includes('/users'), 'Users is hidden from Supply Chain Manager');
console.log('Test 2 Passed!\n');

// --------------------------------------------------------------------------
// TEST 3: Warehouse Manager Role
// --------------------------------------------------------------------------
console.log('[Test 3: Warehouse Manager Role]');
const wmGroups = filterNavGroupsForRole('warehouse_manager');
const wmItems = wmGroups.flatMap(g => g.items.map(i => i.to));

assert(!wmItems.includes('/forecasting'), 'Forecasting is hidden from Warehouse Manager');
assert(wmItems.includes('/forecasting#evaluation'), 'Reports is visible to Warehouse Manager (PERM_REPORTS_VIEW)');
assert(wmItems.includes('/iot'), 'IoT is visible to Warehouse Manager');
assert(!wmItems.includes('/optimizer'), 'Optimizer is hidden from Warehouse Manager');
assert(!wmItems.includes('/users'), 'Users is hidden from Warehouse Manager');
console.log('Test 3 Passed!\n');

// --------------------------------------------------------------------------
// TEST 4: Organization Admin Role
// --------------------------------------------------------------------------
console.log('[Test 4: Organization Admin Role]');
const orgAdminGroups = filterNavGroupsForRole('org_admin');
const orgAdminGroupNames = orgAdminGroups.map(g => g.name);

assert(orgAdminGroupNames.includes('ADMINISTRATION'), 'Org Admin sees ADMINISTRATION');
const orgAdminItems = orgAdminGroups.flatMap(g => g.items.map(i => i.to));
assert(orgAdminItems.includes('/users'), 'Users is visible to Org Admin');
assert(orgAdminItems.includes('/inventory?tab=warehouses'), 'Warehouse settings is visible to Org Admin');
assert(!orgAdminItems.includes('/users?tab=org'), 'Global SuperAdmin org settings is hidden from Org Admin');
console.log('Test 4 Passed!\n');

// --------------------------------------------------------------------------
// TEST 5: Super Admin Role (Unrestricted Access)
// --------------------------------------------------------------------------
console.log('[Test 5: Super Admin Role]');
const superAdminGroups = filterNavGroupsForRole('super_admin');
assert(superAdminGroups.length === NAV_GROUPS.length, 'Super Admin sees ALL 5 navigation groups');
const superAdminItems = superAdminGroups.flatMap(g => g.items.map(i => i.to));
const allItems = NAV_GROUPS.flatMap(g => g.items.map(i => i.to));
assert(superAdminItems.length === allItems.length, 'Super Admin sees all navigation items without restriction');
console.log('Test 5 Passed!\n');

// --------------------------------------------------------------------------
// TEST 6: Distributor Role
// --------------------------------------------------------------------------
console.log('[Test 6: Distributor Role]');
const distGroups = filterNavGroupsForRole('distributor');
const distGroupNames = distGroups.map(g => g.name);
assert(!distGroupNames.includes('ANALYTICS'), 'Distributor cannot see ANALYTICS');
assert(!distGroupNames.includes('INTEGRATIONS'), 'Distributor cannot see INTEGRATIONS');
assert(!distGroupNames.includes('ADMINISTRATION'), 'Distributor cannot see ADMINISTRATION');
const distItems = distGroups.flatMap(g => g.items.map(i => i.to));
assert(distItems.includes('/express'), 'Distributor sees Transfers');
assert(distItems.includes('/scanner'), 'Distributor sees QR Scanner');
assert(distItems.includes('/simulation'), 'Distributor sees Route Simulator');
console.log('Test 6 Passed!\n');

console.log('====================================================');
console.log('ALL FRONTEND RBAC AND NAVIGATION TESTS PASSED (100%)');
console.log('====================================================');
