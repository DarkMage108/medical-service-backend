import { Request, Response, NextFunction } from 'express';
import prisma from '../utils/prisma.js';
import { NotFoundError, BadRequestError } from '../utils/errors.js';
import { sendSuccess, sendCreated, sendNoContent } from '../utils/response.js';

export const getDiagnoses = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const diagnoses = await prisma.diagnosis.findMany({
      orderBy: { name: 'asc' },
    });

    sendSuccess(res, { data: diagnoses });
  } catch (error) {
    next(error);
  }
};

export const getDiagnosis = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const diagnosis = await prisma.diagnosis.findUnique({
      where: { id },
    });

    if (!diagnosis) {
      throw new NotFoundError('Diagnosis not found');
    }

    sendSuccess(res, diagnosis);
  } catch (error) {
    next(error);
  }
};

export const createDiagnosis = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name, color, requiresConsent } = req.body;

    if (!name) {
      throw new BadRequestError('Name is required');
    }

    const diagnosis = await prisma.diagnosis.create({
      data: {
        name,
        color,
        requiresConsent: requiresConsent ?? false,
      },
    });

    sendCreated(res, diagnosis);
  } catch (error) {
    next(error);
  }
};

export const updateDiagnosis = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { name, color, requiresConsent } = req.body;

    const diagnosis = await prisma.diagnosis.update({
      where: { id },
      data: {
        ...(name && { name }),
        ...(color !== undefined && { color }),
        ...(requiresConsent !== undefined && { requiresConsent }),
      },
    });

    sendSuccess(res, diagnosis);
  } catch (error) {
    next(error);
  }
};

export const deleteDiagnosis = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    await prisma.diagnosis.delete({
      where: { id },
    });

    sendNoContent(res);
  } catch (error) {
    next(error);
  }
};
