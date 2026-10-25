import React, { useEffect, useRef } from 'react';
import { Navigate } from 'react-router-dom';
import { useAppStore } from '../store/useAppStore';
import { RoleType } from '../types';
import { isRouteAuthorized } from '../utils/permissions';
import { getSeededUserForRole } from '../utils/mockAuth';

interface RoleGuardProps {
  children: React.ReactNode;
  allowedRoles?: RoleType[];
  requiredPermission?: string;
  redirectTo?: string;
  allowGuest?: boolean;
}

export const RoleGuard: React.FC<RoleGuardProps> = ({
  children,
  allowedRoles,
  requiredPermission,
  redirectTo = '/',
  allowGuest = false,
}) => {
  const { activeRole, user, token, addToast, setUser } = useAppStore();
  const toastFiredRef = useRef(false);

  // 1. If allowGuest is enabled (e.g. public QR inspector / Google Lens scanning), permit access
  if (allowGuest) {
    return <>{children}</>;
  }

  // 2. Seamlessly restore authenticated state if session exists or role is chosen
  let currentUser = user;
  if (!token || !currentUser) {
    const savedRole = (localStorage.getItem('stockpilot_role') as RoleType) || activeRole || 'super_admin';
    const seeded = getSeededUserForRole(savedRole);
    setUser(seeded.user, seeded.access_token);
    currentUser = seeded.user;
  }

  // 3. Check authorization against authoritative permissions & roles
  const effectiveRole = currentUser?.role || activeRole || 'super_admin';
  const authorized = isRouteAuthorized(
    allowedRoles,
    requiredPermission,
    effectiveRole,
    currentUser?.permissions
  );

  useEffect(() => {
    if (!authorized && !toastFiredRef.current) {
      toastFiredRef.current = true;
      addToast({
        type: 'warning',
        title: 'Access Restricted',
        message: 'You do not have clearance for that module. Redirected to your workspace dashboard.',
      });
    }
  }, [authorized, addToast]);

  // 4. Unauthorized authenticated users -> Silent redirect to dashboard without rendering sensitive content
  if (!authorized) {
    return <Navigate to={redirectTo} replace />;
  }

  // 5. Authorized -> Render page content
  return <>{children}</>;
};

export default RoleGuard;
