import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAppStore } from './store/useAppStore';
import { Navbar } from './components/Navbar';
import { Sidebar } from './components/Sidebar';
import { ToastContainer } from './components/ToastContainer';
import { RoleGuard } from './components/RoleGuard';

// Pages
import { DashboardPage } from './pages/DashboardPage';
import { OptimizerPage } from './pages/OptimizerPage';
import { ForecastingPage } from './pages/ForecastingPage';
import { InventoryPage } from './pages/InventoryPage';
import { IoTPage } from './pages/IoTPage';
import { QRScannerPage } from './pages/QRScannerPage';
import { WhatsAppPage } from './pages/WhatsAppPage';
import { UsersPage } from './pages/UsersPage';
import { LoginPage } from './pages/LoginPage';
import { ExpressLanePage } from './pages/ExpressLanePage';
import { FleetSimulationPage } from './pages/FleetSimulationPage';

import { api } from './services/api';
import { 
  PERM_FORECASTS_VIEW, 
  PERM_INVENTORY_VIEW, 
  PERM_OPTIMIZATION_RUN, 
  PERM_TRANSFERS_VIEW, 
  PERM_SCANS_EXECUTE, 
  PERM_IOT_READINGS_VIEW, 
  PERM_INTEGRATIONS_MANAGE, 
  PERM_USERS_MANAGE 
} from './utils/permissions';

export const App: React.FC = () => {
  const { theme, setUser } = useAppStore();

  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  // Ensure an authenticated signed session is bootstrapped seamlessly
  useEffect(() => {
    const bootstrapAuth = async () => {
      const curToken = localStorage.getItem('stockpilot_token');
      if (curToken && curToken !== 'demo_token') {
        try {
          const me = await api.auth.getMe();
          setUser(me, curToken);
        } catch (e) {
          console.warn('Session verification failed, requesting authenticated session:', e);
          try {
            const activeRole = useAppStore.getState().activeRole || 'operator';
            const res = await api.auth.switchRole(activeRole);
            setUser(res.user, res.access_token);
          } catch (err) {
            console.warn('Initial session bootstrap fallback:', err);
          }
        }
      } else {
        try {
          const activeRole = useAppStore.getState().activeRole || 'operator';
          const res = await api.auth.switchRole(activeRole);
          setUser(res.user, res.access_token);
        } catch (e) {
          console.warn('Initial session bootstrap fallback:', e);
        }
      }
    };
    bootstrapAuth();
  }, [setUser]);

  return (
    <BrowserRouter>
      <Routes>
        {/* Dedicated 6-Role Login Portal */}
        <Route path="/login" element={<LoginPage />} />

        {/* Authenticated Workspace Layout */}
        <Route
          path="/*"
          element={
            <div className="min-h-screen flex bg-[#F5F8FC] text-[#172B3A] antialiased selection:bg-[#0D9488] selection:text-white">
              {/* Persistent Collapsible Sidebar with Dynamic Role-Filtered Navigation */}
              <Sidebar />

              {/* Main Content Area */}
              <div className="flex-1 flex flex-col min-w-0">
                <Navbar />

                <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
                  <Routes>
                    <Route path="/" element={<DashboardPage />} />
                    <Route 
                      path="/optimizer" 
                      element={
                        <RoleGuard 
                          allowedRoles={['super_admin', 'org_admin', 'supply_chain_manager']}
                          requiredPermission={PERM_OPTIMIZATION_RUN}
                        >
                          <OptimizerPage />
                        </RoleGuard>
                      } 
                    />
                    <Route 
                      path="/forecasting" 
                      element={
                        <RoleGuard 
                          allowedRoles={['super_admin', 'org_admin', 'supply_chain_manager']}
                          requiredPermission={PERM_FORECASTS_VIEW}
                        >
                          <ForecastingPage />
                        </RoleGuard>
                      } 
                    />
                    <Route 
                      path="/inventory" 
                      element={
                        <RoleGuard 
                          allowedRoles={['super_admin', 'org_admin', 'supply_chain_manager', 'warehouse_manager', 'distributor', 'operator']}
                          requiredPermission={PERM_INVENTORY_VIEW}
                        >
                          <InventoryPage />
                        </RoleGuard>
                      } 
                    />
                    <Route 
                      path="/iot" 
                      element={
                        <RoleGuard 
                          allowedRoles={['super_admin', 'org_admin', 'supply_chain_manager', 'warehouse_manager']}
                          requiredPermission={PERM_IOT_READINGS_VIEW}
                        >
                          <IoTPage />
                        </RoleGuard>
                      } 
                    />
                    <Route 
                      path="/qr" 
                      element={
                        <RoleGuard 
                          allowedRoles={['super_admin', 'org_admin', 'warehouse_manager', 'distributor', 'operator', 'supply_chain_manager']}
                          requiredPermission={PERM_SCANS_EXECUTE}
                          allowGuest={true}
                        >
                          <QRScannerPage />
                        </RoleGuard>
                      } 
                    />
                    <Route 
                      path="/scanner" 
                      element={
                        <RoleGuard 
                          allowedRoles={['super_admin', 'org_admin', 'warehouse_manager', 'distributor', 'operator', 'supply_chain_manager']}
                          requiredPermission={PERM_SCANS_EXECUTE}
                          allowGuest={true}
                        >
                          <QRScannerPage />
                        </RoleGuard>
                      } 
                    />
                    <Route 
                      path="/whatsapp" 
                      element={
                        <RoleGuard 
                          allowedRoles={['super_admin', 'org_admin', 'supply_chain_manager', 'warehouse_manager']}
                          requiredPermission={PERM_INTEGRATIONS_MANAGE}
                        >
                          <WhatsAppPage />
                        </RoleGuard>
                      } 
                    />
                    <Route 
                      path="/users" 
                      element={
                        <RoleGuard 
                          allowedRoles={['super_admin', 'org_admin']}
                          requiredPermission={PERM_USERS_MANAGE}
                        >
                          <UsersPage />
                        </RoleGuard>
                      } 
                    />
                    <Route 
                      path="/express" 
                      element={
                        <RoleGuard 
                          allowedRoles={['super_admin', 'org_admin', 'supply_chain_manager', 'warehouse_manager', 'distributor']}
                          requiredPermission={PERM_TRANSFERS_VIEW}
                        >
                          <ExpressLanePage />
                        </RoleGuard>
                      } 
                    />
                    <Route 
                      path="/simulation" 
                      element={
                        <RoleGuard allowedRoles={['super_admin', 'org_admin', 'supply_chain_manager', 'warehouse_manager', 'distributor', 'operator']}>
                          <FleetSimulationPage />
                        </RoleGuard>
                      } 
                    />
                    <Route path="/fleet" element={<Navigate to="/simulation" replace />} />
                    <Route path="/routes" element={<Navigate to="/simulation" replace />} />
                    <Route path="/transfers" element={<Navigate to="/express" replace />} />
                    <Route path="/reports" element={<Navigate to="/forecasting" replace />} />
                    <Route path="*" element={<Navigate to="/" replace />} />
                  </Routes>
                </main>
              </div>

              {/* Toast Notifications System */}
              <ToastContainer />
            </div>
          }
        />
      </Routes>
    </BrowserRouter>
  );
};

export default App;
