import { Request, Response, NextFunction } from 'express';
import prisma from '../utils/prisma.js';
import { NotFoundError, BadRequestError } from '../utils/errors.js';
import { sendSuccess, sendCreated, sendNoContent } from '../utils/response.js';

export const getProtocols = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { category } = req.query;

    const where: any = {};
    if (category) {
      where.category = category;
    }

    const protocols = await prisma.protocol.findMany({
      where,
      include: {
        milestones: {
          orderBy: { day: 'asc' },
        },
      },
      orderBy: { name: 'asc' },
    });

    sendSuccess(res, { data: protocols });
  } catch (error) {
    next(error);
  }
};

export const getProtocol = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const protocol = await prisma.protocol.findUnique({
      where: { id },
      include: {
        milestones: {
          orderBy: { day: 'asc' },
        },
      },
    });

    if (!protocol) {
      throw new NotFoundError('Protocol not found');
    }

    sendSuccess(res, protocol);
  } catch (error) {
    next(error);
  }
};

export const createProtocol = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name, category, medicationType, frequencyDays, goal, message, milestones } = req.body;

    if (!name || !category || !frequencyDays) {
      throw new BadRequestError('Name, category, and frequency are required');
    }

    const protocol = await prisma.protocol.create({
      data: {
        name,
        category,
        medicationType,
        frequencyDays,
        goal,
        message,
        ...(milestones && milestones.length > 0 && {
          milestones: {
            create: milestones.map((m: { day: number; message: string }) => ({
              day: m.day,
              message: m.message,
            })),
          },
        }),
      },
      include: {
        milestones: {
          orderBy: { day: 'asc' },
        },
      },
    });

    sendCreated(res, protocol);
  } catch (error) {
    next(error);
  }
};

export const updateProtocol = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { name, category, medicationType, frequencyDays, goal, message, milestones } = req.body;

    // If milestones are provided, delete existing and create new ones
    if (milestones !== undefined) {
      await prisma.protocolMilestone.deleteMany({
        where: { protocolId: id },
      });
    }

    const protocol = await prisma.protocol.update({
      where: { id },
      data: {
        ...(name && { name }),
        ...(category && { category }),
        ...(medicationType !== undefined && { medicationType }),
        ...(frequencyDays && { frequencyDays }),
        ...(goal !== undefined && { goal }),
        ...(message !== undefined && { message }),
        ...(milestones && {
          milestones: {
            create: milestones.map((m: { day: number; message: string }) => ({
              day: m.day,
              message: m.message,
            })),
          },
        }),
      },
      include: {
        milestones: {
          orderBy: { day: 'asc' },
        },
      },
    });

    sendSuccess(res, protocol);
  } catch (error) {
    next(error);
  }
};

export const deleteProtocol = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    await prisma.protocol.delete({
      where: { id },
    });

    sendNoContent(res);
  } catch (error) {
    next(error);
  }
};
