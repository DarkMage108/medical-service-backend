import { Request, Response, NextFunction } from 'express';
import prisma from '../utils/prisma.js';
import { NotFoundError, BadRequestError } from '../utils/errors.js';
import { sendSuccess, sendPaginated, sendCreated, sendNoContent } from '../utils/response.js';

// Get all events (for dashboard - all patients)
export const getAllPatientEvents = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { fromDate, toDate, page = '1', limit = '100' } = req.query;

    const pageNum = parseInt(page as string, 10);
    const limitNum = Math.min(parseInt(limit as string, 10), 500);
    const skip = (pageNum - 1) * limitNum;

    const where: any = {};

    if (fromDate) {
      where.eventDate = { ...where.eventDate, gte: new Date(fromDate as string) };
    }
    if (toDate) {
      where.eventDate = { ...where.eventDate, lte: new Date(toDate as string) };
    }

    const [events, total] = await Promise.all([
      prisma.patientEvent.findMany({
        where,
        skip,
        take: limitNum,
        orderBy: { eventDate: 'asc' },
        include: {
          patient: {
            select: {
              id: true,
              fullName: true,
              guardian: true,
            },
          },
        },
      }),
      prisma.patientEvent.count({ where }),
    ]);

    sendPaginated(res, events, {
      total,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(total / limitNum),
    });
  } catch (error) {
    next(error);
  }
};

// Get all events for a patient
export const getPatientEvents = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { patientId } = req.params;
    const { fromDate, toDate, page = '1', limit = '50' } = req.query;

    const pageNum = parseInt(page as string, 10);
    const limitNum = Math.min(parseInt(limit as string, 10), 100);
    const skip = (pageNum - 1) * limitNum;

    const where: any = { patientId };

    if (fromDate) {
      where.eventDate = { ...where.eventDate, gte: new Date(fromDate as string) };
    }
    if (toDate) {
      where.eventDate = { ...where.eventDate, lte: new Date(toDate as string) };
    }

    const [events, total] = await Promise.all([
      prisma.patientEvent.findMany({
        where,
        skip,
        take: limitNum,
        orderBy: { eventDate: 'asc' },
      }),
      prisma.patientEvent.count({ where }),
    ]);

    sendPaginated(res, events, {
      total,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(total / limitNum),
    });
  } catch (error) {
    next(error);
  }
};

// Create a new patient event
export const createPatientEvent = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { patientId } = req.params;
    const { title, eventDate, description } = req.body;

    if (!title || !eventDate) {
      throw new BadRequestError('Title and event date are required');
    }

    // Validate patient exists
    const patient = await prisma.patient.findUnique({
      where: { id: patientId },
    });

    if (!patient) {
      throw new NotFoundError('Patient not found');
    }

    // Validate date is not in the past
    const eventDateObj = new Date(eventDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (eventDateObj < today) {
      throw new BadRequestError('Event date cannot be in the past');
    }

    const event = await prisma.patientEvent.create({
      data: {
        patientId,
        title,
        eventDate: eventDateObj,
        description: description || null,
      },
    });

    sendCreated(res, event);
  } catch (error) {
    next(error);
  }
};

// Update a patient event
export const updatePatientEvent = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { title, eventDate, description } = req.body;

    const existingEvent = await prisma.patientEvent.findUnique({
      where: { id },
    });

    if (!existingEvent) {
      throw new NotFoundError('Event not found');
    }

    const updateData: any = {};

    if (title !== undefined) updateData.title = title;
    if (description !== undefined) updateData.description = description;

    if (eventDate !== undefined) {
      const eventDateObj = new Date(eventDate);
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      if (eventDateObj < today) {
        throw new BadRequestError('Event date cannot be in the past');
      }
      updateData.eventDate = eventDateObj;
    }

    const event = await prisma.patientEvent.update({
      where: { id },
      data: updateData,
    });

    sendSuccess(res, event);
  } catch (error) {
    next(error);
  }
};

// Delete a patient event
export const deletePatientEvent = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const existingEvent = await prisma.patientEvent.findUnique({
      where: { id },
    });

    if (!existingEvent) {
      throw new NotFoundError('Event not found');
    }

    await prisma.patientEvent.delete({
      where: { id },
    });

    sendNoContent(res);
  } catch (error) {
    next(error);
  }
};
