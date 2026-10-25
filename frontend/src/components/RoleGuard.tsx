import React, { useEffect, useRef } from 'react';
import { Navigate } from 'react-router-dom';
import { useAppStore } from '../store/useAppStore';
import { RoleType } from '../types';
import { isRouteAuthorized } from '../utils/permissions';

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
  const { activeRole, user, token, addToast } = useAppStore();
  const toastFiredRef = useRef(false);

  // 1. If allowGuest is enabled (e.g. public QR inspector / Google Lens scanning), permit access
  if (allowGuest) {
    return <>{children}</>;
  }

  // 2. Unauthenticated users -> Redirect to login flow
  if (!token && !user) {
    return <Navigate to="/login" replace />;
  }

  // 3. Check authorization against authoritative permissions & roles
  const authorized = isRouteAuthorized(
    allowedRoles,
    requiredPermission,
    activeRole,
    user?.permissions
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

  // 3. Unauthorized authenticated users -> Silent redirect to dashboard without rendering sensitive content
  if (!authorized) {
    return <Navigate to={redirectTo} replace />;
  }

  // 4. Authorized -> Render page content
  return <>{children}</>;
};

export default RoleGuard;
