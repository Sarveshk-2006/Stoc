import { useAppStore } from '../store/useAppStore';
import { RoleType } from '../types';
import { getSeededUserForRole } from '../utils/mockAuth';

const API_BASE = '/api/v1';

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = useAppStore.getState().token;
  const headers = new Headers(options.headers || {});
  
  if (!headers.has('Content-Type') && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }
  
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
  });

  // Handle static server rewrites (e.g. Vercel returning index.html or 405 Method Not Allowed)
  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('text/html') || response.status === 404 || response.status === 405) {
    throw new Error(`Endpoint ${endpoint} unavailable (HTTP ${response.status}) in standalone deployment`);
  }

  // Handle 401 Unauthorized: only clear credentials if genuine 401 API response
  if (response.status === 401) {
    useAppStore.getState().setUser(null, null);
    localStorage.removeItem('stockpilot_token');
  }

  if (!response.ok) {
    let errorDetail = 'Network request failed';
    try {
      const errJson = await response.json();
      errorDetail = errJson.detail || errJson.message || JSON.stringify(errJson);
    } catch {
      errorDetail = response.statusText;
    }
    throw new Error(errorDetail);
  }

  return response.json();
}

export const api = {
  // Auth & Roles
  auth: {
    login: async (body: any) => {
      try {
        return await request<any>('/auth/login', { method: 'POST', body: JSON.stringify(body) });
      } catch (err) {
        console.warn('Backend login endpoint unavailable, using seeded credentials:', err);
        const email = (body?.email || '').toLowerCase().trim();
        const role: RoleType = email.includes('superadmin') ? 'super_admin'
          : email.includes('orgadmin') ? 'org_admin'
          : email.includes('supplychain') ? 'supply_chain_manager'
          : email.includes('whmanager') ? 'warehouse_manager'
          : email.includes('distributor') ? 'distributor'
          : 'operator';
        return getSeededUserForRole(role);
      }
    },
    getMe: async () => {
      try {
        return await request<any>('/auth/me');
      } catch {
        const activeRole = useAppStore.getState().activeRole || 'super_admin';
        return getSeededUserForRole(activeRole).user;
      }
    },
    inviteUser: (body: any) => request<any>('/auth/invite', { method: 'POST', body: JSON.stringify(body) }),
    listUsers: async () => {
      try {
        return await request<any[]>('/auth/users');
      } catch {
        const raw = (await import('../data/seedData.json')).default as any;
        return Object.values(raw.users || {});
      }
    },
    updateUser: (userId: string, body: any) => request<any>(`/auth/users/${userId}`, { method: 'PUT', body: JSON.stringify(body) }),
    toggleUserActive: (userId: string) => request<any>(`/auth/users/${userId}/toggle-active`, { method: 'POST' }),
    switchRole: async (role: string) => {
      try {
        return await request<any>('/auth/demo/switch-role', { method: 'POST', body: JSON.stringify({ role }) });
      } catch (err) {
        console.warn('Backend switch-role unavailable, initializing seeded persona:', err);
        return getSeededUserForRole(role as RoleType);
      }
    },
  },

  // Warehouses & Destinations
  warehouses: {
    list: async () => {
      try {
        return await request<any[]>('/warehouses');
      } catch {
        const raw = (await import('../data/seedData.json')).default as any;
        return Object.values(raw.warehouses || {});
      }
    },
    listDestinations: async () => {
      try {
        return await request<any[]>('/warehouses/destinations');
      } catch {
        const raw = (await import('../data/seedData.json')).default as any;
        return Object.values(raw.destinations || {});
      }
    },
    create: (body: any) => request<any>('/warehouses', { method: 'POST', body: JSON.stringify(body) }),
    toggleOperational: (id: string) => request<any>(`/warehouses/${id}/toggle-operational`, { method: 'POST' }),
  },

  // Products & QR
  products: {
    list: async () => {
      try {
        return await request<any[]>('/products');
      } catch {
        const raw = (await import('../data/seedData.json')).default as any;
        return Object.values(raw.products || {});
      }
    },
    create: (body: any) => request<any>('/products', { method: 'POST', body: JSON.stringify(body) }),
    resolveQr: async (code: string) => {
      try {
        return await request<any>(`/products/resolve-qr?code=${encodeURIComponent(code)}`);
      } catch (err) {
        console.warn('Backend resolve-qr unavailable or network error. Using embedded database seed:', err);
        const { clientResolveQr } = await import('./clientQrResolver');
        return clientResolveQr(code);
      }
    },
  },

  // Inventory & Ledger
  inventory: {
    list: (params?: { warehouse_id?: string; product_id?: string }) => {
      const search = new URLSearchParams();
      if (params?.warehouse_id && params.warehouse_id !== 'all') search.set('warehouse_id', params.warehouse_id);
      if (params?.product_id) search.set('product_id', params.product_id);
      return request<any[]>(`/inventory?${search.toString()}`);
    },
    listBatches: async (params?: { warehouse_id?: string; product_id?: string }) => {
      try {
        const search = new URLSearchParams();
        if (params?.warehouse_id && params.warehouse_id !== 'all') search.set('warehouse_id', params.warehouse_id);
        if (params?.product_id) search.set('product_id', params.product_id);
        return await request<any[]>(`/inventory/batches?${search.toString()}`);
      } catch {
        const raw = (await import('../data/seedData.json')).default as any;
        let list = Object.values(raw.inventory_batches || {}) as any[];
        if (params?.warehouse_id && params.warehouse_id !== 'all') list = list.filter(b => b.warehouse_id === params.warehouse_id);
        if (params?.product_id) list = list.filter(b => b.product_id === params.product_id);
        return list;
      }
    },
    listMovements: async (limit = 50) => {
      try {
        return await request<any[]>(`/inventory/movements?limit=${limit}`);
      } catch {
        const raw = (await import('../data/seedData.json')).default as any;
        return (Object.values(raw.inventory_movements || {}) as any[]).slice(0, limit);
      }
    },
    receiveStock: (body: any) => request<any>('/inventory/receive', { method: 'POST', body: JSON.stringify(body) }),
    dispatchStock: (body: any) => request<any>('/inventory/dispatch', { method: 'POST', body: JSON.stringify(body) }),
    adjustStock: (body: any) => request<any>('/inventory/adjust', { method: 'POST', body: JSON.stringify(body) }),
    reportDamage: (body: any) => request<any>('/inventory/damage', { method: 'POST', body: JSON.stringify(body) }),
    cycleCount: (body: any) => request<any>('/inventory/cycle-count', { method: 'POST', body: JSON.stringify(body) }),
    resolveDiscrepancy: (body: any) => request<any>('/inventory/discrepancy/resolve', { method: 'POST', body: JSON.stringify(body) }),
    reconcile: (warehouse_id: string, product_id?: string) => {
      const search = new URLSearchParams();
      search.set('warehouse_id', warehouse_id);
      if (product_id) search.set('product_id', product_id);
      return request<any>(`/inventory/reconcile?${search.toString()}`);
    },
    updateSafetyStock: (body: { product_id: string; warehouse_id?: string; safety_stock: number; notes?: string }) =>
      request<any>('/inventory/safety-stock', { method: 'PUT', body: JSON.stringify(body) }),
  },

  // Transfers
  transfers: {
    list: () => request<any[]>('/transfers'),
    create: (body: any) => request<any>('/transfers', { method: 'POST', body: JSON.stringify(body) }),
    approveOrReject: (body: any) => request<any>('/transfers/approve', { method: 'POST', body: JSON.stringify(body) }),
    dispatch: (body: any) => request<any>('/transfers/dispatch', { method: 'POST', body: JSON.stringify(body) }),
    receive: (body: any) => request<any>('/transfers/receive', { method: 'POST', body: JSON.stringify(body) }),
    cancel: (body: any) => request<any>('/transfers/cancel', { method: 'POST', body: JSON.stringify(body) }),
  },

  // Warehouse Floor Tasks
  tasks: {
    list: (params?: { warehouse_id?: string; status?: string }) => {
      const search = new URLSearchParams();
      if (params?.warehouse_id && params.warehouse_id !== 'all') search.set('warehouse_id', params.warehouse_id);
      if (params?.status) search.set('status', params.status);
      const qs = search.toString();
      return request<any[]>(`/tasks${qs ? `?${qs}` : ''}`);
    },
    complete: (taskId: string, body?: { notes?: string; scanned_units?: number; condition?: string }) =>
      request<any>(`/tasks/${encodeURIComponent(taskId)}/complete`, {
        method: 'POST',
        body: JSON.stringify(body || {}),
      }),
  },

  // Google OR-Tools Optimizer
  optimization: {
    run: (body: any) => request<any>('/optimization/run', { method: 'POST', body: JSON.stringify(body) }),
    listRuns: async () => {
      try {
        return await request<any[]>('/optimization/runs');
      } catch {
        const raw = (await import('../data/seedData.json')).default as any;
        return Object.values(raw.optimization_runs || {});
      }
    },
    getRun: (id: string) => request<any>(`/optimization/run/${id}`),
    createTransferFromRecommendation: (run_id: string, recommendation_id: string, notes?: string) =>
      request<any>('/optimization/create-transfer', {
        method: 'POST',
        body: JSON.stringify({ run_id, recommendation_id, notes }),
      }),
  },

  // Demand Forecasting
  forecast: {
    getProductForecast: async (productId: string, horizonDays = 14) => {
      try {
        return await request<any>(`/forecast/product/${productId}?horizon_days=${horizonDays}`);
      } catch (err) {
        console.warn('Backend forecast unavailable, using embedded seed:', err);
        const raw = (await import('../data/seedData.json')).default as any;
        const key = `fc_${productId}_${horizonDays}d`;
        if (raw.forecasts && raw.forecasts[key]) {
          return raw.forecasts[key];
        }
        const anyMatch = Object.values(raw.forecasts || {}).find((f: any) => f.product_id === productId);
        if (anyMatch) return anyMatch;
        return Object.values(raw.forecasts || {})[0];
      }
    },
  },

  // Executive & Operational Reports
  reports: {
    getSummary: async () => {
      try {
        return await request<any>('/reports/summary');
      } catch {
        const raw = (await import('../data/seedData.json')).default as any;
        return raw.reports_summary || {};
      }
    },
  },

  // IoT Cold Chain
  iot: {
    getDevices: async () => {
      try {
        return await request<any[]>('/iot/devices');
      } catch {
        const raw = (await import('../data/seedData.json')).default as any;
        return Object.values(raw.iot_devices || {});
      }
    },
    getReadings: (deviceId?: string) => request<any[]>(`/iot/readings${deviceId ? `?device_id=${deviceId}` : ''}`),
    getAlerts: async () => {
      try {
        return await request<any[]>('/iot/alerts');
      } catch {
        const raw = (await import('../data/seedData.json')).default as any;
        return Object.values(raw.alerts || {});
      }
    },
    acknowledgeAlert: (id: string) => request<any>(`/iot/alerts/${id}/acknowledge`, { method: 'POST' }),
    injectSimulator: (body: any) => request<any>('/iot/simulator/inject', { method: 'POST', body: JSON.stringify(body) }),
  },

  // WhatsApp
  whatsapp: {
    simulateChat: (message_text: string, from_number?: string) => 
      request<any>('/whatsapp/simulator/chat', { method: 'POST', body: JSON.stringify({ message_text, from_number }) }),
    getLogs: () => request<any[]>('/whatsapp/logs'),
    getBridgeStatus: () => request<any>('/whatsapp/bridge/status'),
    pairBridge: (phone: string) => request<any>('/whatsapp/bridge/pair', { method: 'POST', body: JSON.stringify({ phone }) }),
  },

  // Audit Logs
  audit: {
    list: async (limit = 50) => {
      try {
        return await request<any[]>(`/audit?limit=${limit}`);
      } catch {
        const raw = (await import('../data/seedData.json')).default as any;
        return (Object.values(raw.audit_logs || {}) as any[]).slice(0, limit);
      }
    },
  },

  // Express Lane Fast Fulfillment (Quick-Commerce Model)
  express: {
    getConfig: () => request<any>('/express/config'),
    updateConfig: (body: any) => request<any>('/express/config', { method: 'POST', body: JSON.stringify(body) }),
    getSosClocks: (sku = 'PRD-VAX-01') => request<any>(`/express/sos?sku=${sku}`),
    evaluateOptions: (nodeId: string, sku: string, stock?: number, hour?: number) => {
      const params = new URLSearchParams();
      if (stock !== undefined) params.append('stock', stock.toString());
      if (hour !== undefined) params.append('hour', hour.toString());
      const qs = params.toString();
      return request<any>(`/express/evaluate/${nodeId}/${sku}${qs ? `?${qs}` : ''}`);
    },
    rationContention: (items: any[]) => request<any>('/express/contention', { method: 'POST', body: JSON.stringify(items) }),
    approve: (body: any) => request<any>('/express/approve', { method: 'POST', body: JSON.stringify(body) }),
    getTransfers: () => request<any>('/express/transfers'),
    simulate: () => request<any>('/express/simulate'),
  },
};
