import { RoleType } from '../types';

// ============================================================================
// 1. AUTHORITATIVE PERMISSION CONSTANTS (MIRRORS BACKEND RBAC ENGINE)
// ============================================================================

export const PERM_ORGANIZATIONS_MANAGE = 'organizations.manage';
export const PERM_USERS_MANAGE = 'users.manage';
export const PERM_ROLES_ASSIGN = 'roles.assign';
export const PERM_PRODUCTS_MANAGE = 'products.manage';
export const PERM_WAREHOUSES_MANAGE = 'warehouses.manage';
export const PERM_INVENTORY_VIEW = 'inventory.view';
export const PERM_INVENTORY_RECEIVE = 'inventory.receive';
export const PERM_INVENTORY_DISPATCH = 'inventory.dispatch';
export const PERM_INVENTORY_ADJUST = 'inventory.adjust';
export const PERM_BATCHES_MANAGE = 'batches.manage';
export const PERM_FORECASTS_VIEW = 'forecasts.view';
export const PERM_OPTIMIZATION_RUN = 'optimization.run';
export const PERM_OPTIMIZATION_REVIEW = 'optimization.review';
export const PERM_OPTIMIZATION_APPROVE = 'optimization.approve';
export const PERM_TRANSFERS_VIEW = 'transfers.view';
export const PERM_TRANSFERS_CREATE = 'transfers.create';
export const PERM_TRANSFERS_DISPATCH = 'transfers.dispatch';
export const PERM_TRANSFERS_RECEIVE = 'transfers.receive';
export const PERM_IOT_DEVICES_MANAGE = 'iot.devices.manage';
export const PERM_IOT_READINGS_VIEW = 'iot.readings.view';
export const PERM_ALERTS_MANAGE = 'alerts.manage';
export const PERM_REPORTS_VIEW = 'reports.view';
export const PERM_AUDIT_VIEW = 'audit.view';
export const PERM_INTEGRATIONS_MANAGE = 'integrations.manage';
export const PERM_PLATFORM_HEALTH_VIEW = 'platform.health.view';
export const PERM_SCANS_EXECUTE = 'scans.execute';
export const PERM_DELIVERY_CONFIRM = 'delivery.confirm';
export const PERM_TASKS_ASSIGN = 'tasks.assign';
export const PERM_TASKS_VIEW = 'tasks.view';
export const PERM_TASKS_EXECUTE = 'tasks.execute';
export const PERM_DAMAGE_REPORT = 'damage.report';

// ============================================================================
// 2. DEFAULT PERMISSIONS PER ROLE (EXACT BACKEND MIRROR)
// ============================================================================

export const ROLE_DEFAULT_PERMISSIONS: Record<RoleType, Set<string>> = {
  super_admin: new Set([
    PERM_ORGANIZATIONS_MANAGE,
    PERM_PLATFORM_HEALTH_VIEW,
    PERM_AUDIT_VIEW,
    PERM_INTEGRATIONS_MANAGE,
    PERM_USERS_MANAGE,
    PERM_REPORTS_VIEW,
    PERM_IOT_READINGS_VIEW,
    PERM_INVENTORY_VIEW,
    PERM_TRANSFERS_VIEW,
    PERM_OPTIMIZATION_APPROVE,
    PERM_SCANS_EXECUTE,
    PERM_ALERTS_MANAGE,
    PERM_FORECASTS_VIEW,
    PERM_OPTIMIZATION_RUN,
    PERM_OPTIMIZATION_REVIEW,
    PERM_WAREHOUSES_MANAGE,
    PERM_PRODUCTS_MANAGE,
    PERM_BATCHES_MANAGE,
  ]),
  org_admin: new Set([
    PERM_USERS_MANAGE,
    PERM_ROLES_ASSIGN,
    PERM_PRODUCTS_MANAGE,
    PERM_WAREHOUSES_MANAGE,
    PERM_INVENTORY_VIEW,
    PERM_INVENTORY_RECEIVE,
    PERM_INVENTORY_DISPATCH,
    PERM_INVENTORY_ADJUST,
    PERM_BATCHES_MANAGE,
    PERM_TRANSFERS_VIEW,
    PERM_TRANSFERS_CREATE,
    PERM_OPTIMIZATION_APPROVE,
    PERM_IOT_DEVICES_MANAGE,
    PERM_IOT_READINGS_VIEW,
    PERM_ALERTS_MANAGE,
    PERM_REPORTS_VIEW,
    PERM_AUDIT_VIEW,
    PERM_INTEGRATIONS_MANAGE,
    PERM_SCANS_EXECUTE,
  ]),
  supply_chain_manager: new Set([
    PERM_INVENTORY_VIEW,
    PERM_INVENTORY_RECEIVE,
    PERM_FORECASTS_VIEW,
    PERM_OPTIMIZATION_RUN,
    PERM_OPTIMIZATION_REVIEW,
    PERM_OPTIMIZATION_APPROVE,
    PERM_TRANSFERS_VIEW,
    PERM_TRANSFERS_CREATE,
    PERM_TRANSFERS_DISPATCH,
    PERM_TRANSFERS_RECEIVE,
    PERM_REPORTS_VIEW,
    PERM_IOT_READINGS_VIEW,
    PERM_ALERTS_MANAGE,
    PERM_SCANS_EXECUTE,
  ]),
  warehouse_manager: new Set([
    PERM_INVENTORY_VIEW,
    PERM_INVENTORY_RECEIVE,
    PERM_INVENTORY_DISPATCH,
    PERM_INVENTORY_ADJUST,
    PERM_BATCHES_MANAGE,
    PERM_TRANSFERS_VIEW,
    PERM_TRANSFERS_RECEIVE,
    PERM_TASKS_ASSIGN,
    PERM_IOT_READINGS_VIEW,
    PERM_ALERTS_MANAGE,
    PERM_REPORTS_VIEW,
    PERM_SCANS_EXECUTE,
    PERM_DAMAGE_REPORT,
  ]),
  operator: new Set([
    PERM_INVENTORY_VIEW,
    PERM_INVENTORY_RECEIVE,
    PERM_TRANSFERS_DISPATCH,
    PERM_TRANSFERS_RECEIVE,
    PERM_TASKS_VIEW,
    PERM_TASKS_EXECUTE,
    PERM_SCANS_EXECUTE,
    PERM_DAMAGE_REPORT,
  ]),
  distributor: new Set([
    PERM_TRANSFERS_VIEW,
    PERM_TRANSFERS_RECEIVE,
    PERM_TRANSFERS_DISPATCH,
    PERM_SCANS_EXECUTE,
    PERM_DELIVERY_CONFIRM,
    PERM_DAMAGE_REPORT,
    PERM_INVENTORY_VIEW,
  ]),
};

export const ROLE_DISPLAY_NAMES: Record<RoleType, string> = {
  super_admin: 'Super Admin',
  org_admin: 'Organization Admin',
  supply_chain_manager: 'Supply Chain Manager',
  warehouse_manager: 'Warehouse Manager',
  distributor: 'Distributor / Fleet',
  operator: 'Warehouse Operator',
};

// ============================================================================
// 3. EFFECTIVE PERMISSION EVALUATOR
// ============================================================================

export function getUserEffectivePermissions(
  role: RoleType,
  explicitPermissions?: string[] | null
): Set<string> {
  const defaults = ROLE_DEFAULT_PERMISSIONS[role] || new Set();
  const custom = new Set(explicitPermissions || []);
  return new Set([...defaults, ...custom]);
}

export function hasPermission(
  role: RoleType,
  explicitPermissions: string[] | null | undefined,
  requiredPermission: string
): boolean {
  if (role === 'super_admin') return true;
  const effective = getUserEffectivePermissions(role, explicitPermissions);
  return effective.has(requiredPermission);
}

export function isRouteAuthorized(
  allowedRoles?: RoleType[],
  requiredPermission?: string,
  userRole: RoleType = 'operator',
  userPermissions?: string[] | null
): boolean {
  if (userRole === 'super_admin') return true;

  // Check role whitelist if provided
  if (allowedRoles && allowedRoles.length > 0) {
    if (!allowedRoles.includes(userRole)) {
      return false;
    }
  }

  // Check explicit permission if provided
  if (requiredPermission) {
    return hasPermission(userRole, userPermissions, requiredPermission);
  }

  return true;
}
