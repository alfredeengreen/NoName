/**
 * Permission types for role-based access control
 */
export type Permission = 
  | 'sites:read' | 'sites:write' | 'sites:delete'
  | 'reports:read' | 'reports:write'
  | 'users:read' | 'users:write' | 'users:delete'
  | 'settings:read' | 'settings:write'
  | '*'; // Wildcard for all permissions

/**
 * Role definitions with associated permissions
 */
export const ROLE_PERMISSIONS: Record<string, Permission[]> = {
  owner: ['*'], // All permissions (special case)
  admin: [
    'sites:read', 'sites:write',
    'reports:read', 'reports:write',
    'users:read', 'users:write',
    'settings:read', 'settings:write',
  ],
  editor: [
    'sites:read',
    'reports:read', 'reports:write',
  ],
  viewer: [
    'sites:read',
    'reports:read',
  ],
};

/**
 * Check if a role has a specific permission
 */
export function hasRolePermission(role: string, permission: Permission): boolean {
  if (role === 'owner') {
    return true; // Owner has all permissions
  }

  const rolePermissions = ROLE_PERMISSIONS[role] || [];
  return rolePermissions.includes(permission);
}

/**
 * Check if permissions array includes a permission
 */
export function hasPermission(permissions: Permission[], permission: Permission): boolean {
  return permissions.includes('*') || permissions.includes(permission);
}

