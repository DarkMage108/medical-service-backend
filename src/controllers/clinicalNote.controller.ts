import { Request, Response, NextFunction } from 'express';
import prisma from '../utils/prisma.js';
import { NotFoundError, BadRequestError } from '../utils/errors.js';
import { sendSuccess, sendPaginated, sendCreated, sendNoContent } from '../utils/response.js';

// Get all clinical notes for a patient
export const getByPatient = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { patientId } = req.params;

    const notes = await prisma.clinicalNote.findMany({
      where: { patientId },
      orderBy: { createdAt: 'desc' },
    });

    sendPaginated(res, notes, {
      total: notes.length,
      page: 1,
      limit: notes.length,
      totalPages: 1,
    });
  } catch (error) {
    next(error);
  }
};

// Create a new clinical note
export const create = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { patientId } = req.params;
    const { content } = req.body;

    if (!content || !content.trim()) {
      throw new BadRequestError('Content is required');
    }

    const patient = await prisma.patient.findUnique({ where: { id: patientId } });
    if (!patient) {
      throw new NotFoundError('Patient not found');
    }

    const note = await prisma.clinicalNote.create({
      data: {
        patientId,
        content: content.trim(),
      },
    });

    sendCreated(res, note);
  } catch (error) {
    next(error);
  }
};

// Update a clinical note
export const update = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { content } = req.body;

    if (!content || !content.trim()) {
      throw new BadRequestError('Content is required');
    }

    const existing = await prisma.clinicalNote.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundError('Clinical note not found');
    }

    const note = await prisma.clinicalNote.update({
      where: { id },
      data: { content: content.trim() },
    });

    sendSuccess(res, note);
  } catch (error) {
    next(error);
  }
};

// Delete a clinical note
export const remove = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const existing = await prisma.clinicalNote.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundError('Clinical note not found');
    }

    await prisma.clinicalNote.delete({ where: { id } });

    sendNoContent(res);
  } catch (error) {
    next(error);
  }
};
