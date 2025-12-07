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

    // Validate required fields
    if (!name || !name.trim()) {
      throw new BadRequestError('Nome do protocolo é obrigatório');
    }

    if (!category) {
      throw new BadRequestError('Categoria é obrigatória');
    }

    // Validate category enum
    const validCategories = ['MEDICATION', 'MONITORING'];
    if (!validCategories.includes(category)) {
      throw new BadRequestError('Categoria inválida. Use MEDICATION ou MONITORING');
    }

    if (!frequencyDays || frequencyDays < 1) {
      throw new BadRequestError('Frequência (dias) é obrigatória e deve ser maior que 0');
    }

    // Check for duplicate name
    const existingProtocol = await prisma.protocol.findUnique({
      where: { name: name.trim() },
    });

    if (existingProtocol) {
      throw new BadRequestError('Já existe um protocolo com este nome');
    }

    const protocol = await prisma.protocol.create({
      data: {
        name: name.trim(),
        category,
        medicationType: medicationType || null,
        frequencyDays: Number(frequencyDays),
        goal: goal || null,
        message: message || null,
        ...(milestones && milestones.length > 0 && {
          milestones: {
            create: milestones.map((m: { day: number; message: string }) => ({
              day: Number(m.day),
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

    // Validate category if provided
    if (category) {
      const validCategories = ['MEDICATION', 'MONITORING'];
      if (!validCategories.includes(category)) {
        throw new BadRequestError('Categoria inválida. Use MEDICATION ou MONITORING');
      }
    }

    // Validate frequencyDays if provided
    if (frequencyDays !== undefined && frequencyDays < 1) {
      throw new BadRequestError('Frequência (dias) deve ser maior que 0');
    }

    // Check for duplicate name if name is being changed
    if (name && name.trim()) {
      const existingProtocol = await prisma.protocol.findFirst({
        where: {
          name: name.trim(),
          id: { not: id },
        },
      });

      if (existingProtocol) {
        throw new BadRequestError('Já existe um protocolo com este nome');
      }
    }

    // If milestones are provided, delete existing and create new ones
    if (milestones !== undefined) {
      await prisma.protocolMilestone.deleteMany({
        where: { protocolId: id },
      });
    }

    const protocol = await prisma.protocol.update({
      where: { id },
      data: {
        ...(name && { name: name.trim() }),
        ...(category && { category }),
        ...(medicationType !== undefined && { medicationType: medicationType || null }),
        ...(frequencyDays && { frequencyDays: Number(frequencyDays) }),
        ...(goal !== undefined && { goal: goal || null }),
        ...(message !== undefined && { message: message || null }),
        ...(milestones && {
          milestones: {
            create: milestones.map((m: { day: number; message: string }) => ({
              day: Number(m.day),
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
