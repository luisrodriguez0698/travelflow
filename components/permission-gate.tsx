'use client';

import { useSession } from 'next-auth/react';

interface PermissionGateProps {
  module: string;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export function PermissionGate({ module, children, fallback = null }: PermissionGateProps) {
  const { data: session } = useSession();
  const permissions = (session?.user as any)?.permissions as string[] | undefined;

  // If no permissions info yet (loading), show children to avoid flicker
  if (!session) return null;

  // Legacy ADMIN users without permissions array get full access
  if (!permissions && (session?.user as any)?.role === 'ADMIN') {
    return <>{children}</>;
  }

  if (!permissions?.includes(module)) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}
