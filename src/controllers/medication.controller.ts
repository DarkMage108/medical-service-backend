import { Request, Response, NextFunction } from 'express';
import prisma from '../utils/prisma.js';
import { NotFoundError, BadRequestError } from '../utils/errors.js';
import { sendSuccess, sendCreated, sendNoContent } from '../utils/response.js';

export const getMedications = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const medications = await prisma.medicationBase.findMany({
      orderBy: [{ activeIngredient: 'asc' }, { dosage: 'asc' }],
    });

    sendSuccess(res, { data: medications });
  } catch (error) {
    next(error);
  }
};

export const getMedication = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const medication = await prisma.medicationBase.findUnique({
      where: { id },
    });

    if (!medication) {
      throw new NotFoundError('Medication not found');
    }

    sendSuccess(res, medication);
  } catch (error) {
    next(error);
  }
};

export const createMedication = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { activeIngredient, dosage, tradeName, manufacturer, pharmaceuticalForm } = req.body;

    if (!activeIngredient || !dosage) {
      throw new BadRequestError('Active ingredient and dosage are required');
    }

    const medication = await prisma.medicationBase.create({
      data: {
        activeIngredient,
        dosage,
        tradeName,
        manufacturer,
        pharmaceuticalForm,
      },
    });

    sendCreated(res, medication);
  } catch (error) {
    next(error);
  }
};

export const updateMedication = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { activeIngredient, dosage, tradeName, manufacturer, pharmaceuticalForm } = req.body;

    const medication = await prisma.medicationBase.update({
      where: { id },
      data: {
        ...(activeIngredient && { activeIngredient }),
        ...(dosage && { dosage }),
        ...(tradeName !== undefined && { tradeName }),
        ...(manufacturer !== undefined && { manufacturer }),
        ...(pharmaceuticalForm !== undefined && { pharmaceuticalForm }),
      },
    });

    sendSuccess(res, medication);
  } catch (error) {
    next(error);
  }
};

export const deleteMedication = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    await prisma.medicationBase.delete({
      where: { id },
    });

    sendNoContent(res);
  } catch (error) {
    next(error);
  }
};
