import { Request, Response, NextFunction } from 'express';
import prisma from '../utils/prisma.js';
import { BadRequestError } from '../utils/errors.js';

// Get all settings
export const getAll = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const settings = await prisma.systemSettings.findMany({
      orderBy: { key: 'asc' },
    });
    res.json({ data: settings });
  } catch (error) {
    next(error);
  }
};

// Get adherence-related settings only
export const getAdherenceSettings = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const settings = await prisma.systemSettings.findMany({
      where: { key: { startsWith: 'adherence_' } },
      orderBy: { key: 'asc' },
    });
    // Return as key-value map for easy consumption
    const map: Record<string, string> = {};
    settings.forEach((s: any) => { map[s.key] = s.value; });
    res.json({ data: map });
  } catch (error) {
    next(error);
  }
};

// Update settings (bulk upsert)
export const updateSettings = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { settings } = req.body;
    if (!settings || typeof settings !== 'object') {
      throw new BadRequestError('Settings object is required');
    }

    const entries = Object.entries(settings) as [string, string][];
    for (const [key, value] of entries) {
      await prisma.systemSettings.upsert({
        where: { key },
        update: { value: String(value) },
        create: { key, value: String(value) },
      });
    }

    const updated = await prisma.systemSettings.findMany({ orderBy: { key: 'asc' } });
    res.json({ data: updated });
  } catch (error) {
    next(error);
  }
};
