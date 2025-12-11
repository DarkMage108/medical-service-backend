import { Request, Response, NextFunction } from 'express';
import prisma from '../utils/prisma.js';
import { NotFoundError, BadRequestError } from '../utils/errors.js';
import { sendSuccess, sendCreated, sendNoContent } from '../utils/response.js';

export const getInventory = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { search, active, expired, grouped } = req.query;

    const where: any = {};

    if (search) {
      where.medicationName = { contains: search as string, mode: 'insensitive' };
    }

    if (active !== undefined) {
      where.active = active === 'true';
    }

    const today = new Date();
    if (expired === 'false') {
      where.expiryDate = { gt: today };
    }

    const items = await prisma.inventoryItem.findMany({
      where,
      orderBy: [{ medicationName: 'asc' }, { expiryDate: 'asc' }],
    });

    if (grouped === 'true') {
      // Group by medication name
      const grouped = items.reduce((acc: any, item: any) => {
        if (!acc[item.medicationName]) {
          acc[item.medicationName] = {
            medicationName: item.medicationName,
            totalQuantity: 0,
            lots: [],
          };
        }
        acc[item.medicationName].totalQuantity += item.quantity;
        acc[item.medicationName].lots.push(item);
        return acc;
      }, {});

      sendSuccess(res, { data: Object.values(grouped) });
    } else {
      sendSuccess(res, { data: items });
    }
  } catch (error) {
    next(error);
  }
};

export const getInventoryItem = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const item = await prisma.inventoryItem.findUnique({
      where: { id },
    });

    if (!item) {
      throw new NotFoundError('Inventory item not found');
    }

    sendSuccess(res, item);
  } catch (error) {
    next(error);
  }
};

export const createInventoryItem = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { medicationName, lotNumber, expiryDate, quantity, unit } = req.body;

    if (!medicationName || !lotNumber || !expiryDate || !quantity) {
      throw new BadRequestError('Medication name, lot number, expiry date, and quantity are required');
    }

    // Check if same medication + lot exists, if so add to quantity
    const existing = await prisma.inventoryItem.findUnique({
      where: {
        medicationName_lotNumber: {
          medicationName,
          lotNumber,
        },
      },
    });

    if (existing) {
      const updated = await prisma.inventoryItem.update({
        where: { id: existing.id },
        data: {
          quantity: { increment: quantity },
          active: true,
        },
      });
      sendSuccess(res, updated);
      return;
    }

    const item = await prisma.inventoryItem.create({
      data: {
        medicationName,
        lotNumber,
        expiryDate: new Date(expiryDate),
        quantity,
        unit: unit || 'Ampola',
      },
    });

    sendCreated(res, item);
  } catch (error) {
    next(error);
  }
};

export const updateInventoryItem = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { medicationName, lotNumber, expiryDate, quantity, unit, active } = req.body;

    const item = await prisma.inventoryItem.update({
      where: { id },
      data: {
        ...(medicationName && { medicationName }),
        ...(lotNumber && { lotNumber }),
        ...(expiryDate && { expiryDate: new Date(expiryDate) }),
        ...(quantity !== undefined && { quantity }),
        ...(unit && { unit }),
        ...(active !== undefined && { active }),
      },
    });

    sendSuccess(res, item);
  } catch (error) {
    next(error);
  }
};

export const deleteInventoryItem = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    await prisma.inventoryItem.delete({
      where: { id },
    });

    sendNoContent(res);
  } catch (error) {
    next(error);
  }
};

export const getAvailableLots = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { medicationName } = req.query;

    const today = new Date();

    const where: any = {
      active: true,
      quantity: { gt: 0 },
      expiryDate: { gt: today },
    };

    if (medicationName) {
      where.medicationName = { contains: medicationName as string, mode: 'insensitive' };
    }

    const items = await prisma.inventoryItem.findMany({
      where,
      select: {
        id: true,
        medicationName: true,
        lotNumber: true,
        expiryDate: true,
        quantity: true,
      },
      orderBy: { expiryDate: 'asc' },
    });

    sendSuccess(res, { data: items });
  } catch (error) {
    next(error);
  }
};
