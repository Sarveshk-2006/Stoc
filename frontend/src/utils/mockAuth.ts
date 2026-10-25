import { User, RoleType } from '../types';
import { ROLE_DEFAULT_PERMISSIONS } from './permissions';

const PERSONAS: Record<RoleType, { id: string; email: string; full_name: string; warehouse_id: string | null }> = {
  super_admin: {
    id: 'usr_superadmin',
    email: 'superadmin@stockpilot.ai',
    full_name: 'Sarah Chen',
    warehouse_id: null,
  },
  org_admin: {
    id: 'usr_orgadmin',
    email: 'orgadmin@stockpilot.ai',
    full_name: 'Marcus Vance',
    warehouse_id: null,
  },
  supply_chain_manager: {
    id: 'usr_supplychain',
    email: 'supplychain@stockpilot.ai',
    full_name: 'Elena Rostova',
    warehouse_id: null,
  },
  warehouse_manager: {
    id: 'usr_whmanager',
    email: 'whmanager@stockpilot.ai',
    full_name: 'David Sterling',
    warehouse_id: 'wh_kolhapur_central',
  },
  distributor: {
    id: 'usr_distributor',
    email: 'distributor@stockpilot.ai',
    full_name: 'Rajiv Patel',
    warehouse_id: 'wh_kolhapur_central',
  },
  operator: {
    id: 'usr_operator',
    email: 'operator@stockpilot.ai',
    full_name: "James O'Connor",
    warehouse_id: 'wh_kolhapur_central',
  },
};

export function getSeededUserForRole(role: RoleType): { user: User; access_token: string } {
  const p = PERSONAS[role] || PERSONAS.super_admin;
  const permsSet = ROLE_DEFAULT_PERMISSIONS[role] || ROLE_DEFAULT_PERMISSIONS.super_admin;

  const user: User = {
    id: p.id,
    email: p.email,
    full_name: p.full_name,
    role,
    org_id: 'org_triwiz_01',
    warehouse_id: p.warehouse_id,
    warehouse_ids: p.warehouse_id ? [p.warehouse_id] : null,
    permissions: Array.from(permsSet),
    phone_number: '+917385819857',
    is_active: true,
    created_at: new Date().toISOString(),
  };

  const access_token = `mock_jwt_token_${role}_2026`;

  return { user, access_token };
}
