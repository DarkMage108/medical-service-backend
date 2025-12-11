import { Request, Response, NextFunction } from 'express';
import prisma from '../utils/prisma.js';
import { BadRequestError, NotFoundError } from '../utils/errors.js';

// Define UserRole enum locally to avoid Prisma client generation issues
enum UserRole {
  ADMIN = 'ADMIN',
  DOCTOR = 'DOCTOR',
  SECRETARY = 'SECRETARY',
  NURSE = 'NURSE',
}

// Define available menu items with their default permissions per role
export const MENU_ITEMS = [
  { key: 'dashboard', label: 'Dashboard', path: '/' },
  { key: 'checklist', label: 'Checklist', path: '/checklist' },
  { key: 'nursing', label: 'Enfermagem', path: '/enfermagem' },
  { key: 'patients', label: 'Pacientes', path: '/pacientes' },
  { key: 'history', label: 'Histórico', path: '/historico' },
  { key: 'inventory', label: 'Estoque', path: '/estoque' },
  { key: 'diagnoses', label: 'Diagnósticos', path: '/diagnosticos' },
  { key: 'protocols', label: 'Protocolos', path: '/protocolos' },
];

// Default permissions for each role
const DEFAULT_PERMISSIONS: Record<UserRole, Record<string, boolean>> = {
  [UserRole.ADMIN]: {
    dashboard: true,
    checklist: true,
    nursing: true,
    patients: true,
    history: true,
    inventory: true,
    diagnoses: true,
    protocols: true,
  },
  [UserRole.DOCTOR]: {
    dashboard: true,
    checklist: true,
    nursing: true,
    patients: true,
    history: true,
    inventory: true,
    diagnoses: true,
    protocols: true,
  },
  [UserRole.SECRETARY]: {
    dashboard: true,
    checklist: true,
    nursing: true,
    patients: true,
    history: true,
    inventory: false,
    diagnoses: false,
    protocols: false,
  },
  [UserRole.NURSE]: {
    dashboard: true,
    checklist: true,
    nursing: true,
    patients: true,
    history: true,
    inventory: false,
    diagnoses: false,
    protocols: false,
  },
};

// Get all permissions (grouped by role)
export const getAll = async (
  _req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const permissions = await prisma.rolePermission.findMany({
      orderBy: [{ role: 'asc' }, { menuKey: 'asc' }],
    });

    // Group permissions by role
    const groupedPermissions: Record<string, Record<string, boolean>> = {};

    // Initialize with default permissions
    for (const role of Object.values(UserRole)) {
      groupedPermissions[role] = { ...DEFAULT_PERMISSIONS[role] };
    }

    // Override with stored permissions
    for (const permission of permissions) {
      if (!groupedPermissions[permission.role]) {
        groupedPermissions[permission.role] = {};
      }
      groupedPermissions[permission.role][permission.menuKey] = permission.canAccess;
    }

    res.json({
      data: groupedPermissions,
      menuItems: MENU_ITEMS,
    });
  } catch (error) {
    next(error);
  }
};

// Get permissions for a specific role
export const getByRole = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { role } = req.params;

    if (!Object.values(UserRole).includes(role as UserRole)) {
      throw new BadRequestError('Invalid role');
    }

    const permissions = await prisma.rolePermission.findMany({
      where: { role: role as UserRole },
    });

    // Start with default permissions and override with stored ones
    const rolePermissions: Record<string, boolean> = { ...DEFAULT_PERMISSIONS[role as UserRole] };

    for (const permission of permissions) {
      rolePermissions[permission.menuKey] = permission.canAccess;
    }

    res.json({
      data: rolePermissions,
      menuItems: MENU_ITEMS,
    });
  } catch (error) {
    next(error);
  }
};

// Get permissions for current user
export const getMyPermissions = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const userRole = req.user!.role as UserRole;

    const permissions = await prisma.rolePermission.findMany({
      where: { role: userRole as any },
    });

    // Start with default permissions and override with stored ones
    const rolePermissions: Record<string, boolean> = { ...DEFAULT_PERMISSIONS[userRole] };

    for (const permission of permissions) {
      rolePermissions[permission.menuKey] = permission.canAccess;
    }

    // Return menu items with access info
    const accessibleMenus = MENU_ITEMS.map(item => ({
      ...item,
      canAccess: rolePermissions[item.key] ?? false,
    }));

    res.json({
      data: accessibleMenus,
      permissions: rolePermissions,
    });
  } catch (error) {
    next(error);
  }
};

// Update permissions for a role (bulk update)
export const updateRolePermissions = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { role } = req.params;
    const { permissions } = req.body;

    if (!Object.values(UserRole).includes(role as UserRole)) {
      throw new BadRequestError('Invalid role');
    }

    if (!permissions || typeof permissions !== 'object') {
      throw new BadRequestError('Permissions object is required');
    }

    // Validate all menu keys
    const validMenuKeys = MENU_ITEMS.map(item => item.key);
    for (const key of Object.keys(permissions)) {
      if (!validMenuKeys.includes(key)) {
        throw new BadRequestError(`Invalid menu key: ${key}`);
      }
    }

    // Upsert each permission
    const upsertPromises = Object.entries(permissions).map(([menuKey, canAccess]) =>
      prisma.rolePermission.upsert({
        where: {
          role_menuKey: {
            role: role as UserRole,
            menuKey,
          },
        },
        update: { canAccess: Boolean(canAccess) },
        create: {
          role: role as UserRole,
          menuKey,
          canAccess: Boolean(canAccess),
        },
      })
    );

    await Promise.all(upsertPromises);

    // Fetch updated permissions
    const updatedPermissions = await prisma.rolePermission.findMany({
      where: { role: role as UserRole },
    });

    const rolePermissions: Record<string, boolean> = { ...DEFAULT_PERMISSIONS[role as UserRole] };
    for (const permission of updatedPermissions) {
      rolePermissions[permission.menuKey] = permission.canAccess;
    }

    res.json({
      message: 'Permissions updated successfully',
      data: rolePermissions,
    });
  } catch (error) {
    next(error);
  }
};

// Reset permissions to default for a role
export const resetRolePermissions = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { role } = req.params;

    if (!Object.values(UserRole).includes(role as UserRole)) {
      throw new BadRequestError('Invalid role');
    }

    // Delete all custom permissions for this role
    await prisma.rolePermission.deleteMany({
      where: { role: role as UserRole },
    });

    res.json({
      message: 'Permissions reset to default',
      data: DEFAULT_PERMISSIONS[role as UserRole],
    });
  } catch (error) {
    next(error);
  }
};
