import { Request, Response, NextFunction } from 'express';
import prisma from '../utils/prisma.js';
import { NotFoundError, BadRequestError } from '../utils/errors.js';
import { sendSuccess, sendPaginated, sendCreated, sendNoContent } from '../utils/response.js';

export const getTreatments = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { patientId, status, protocolId, page = '1', limit = '20' } = req.query;

    const pageNum = parseInt(page as string, 10);
    const limitNum = Math.min(parseInt(limit as string, 10), 100);
    const skip = (pageNum - 1) * limitNum;

    const where: any = {};

    if (patientId) where.patientId = patientId;
    if (status) where.status = status;
    if (protocolId) where.protocolId = protocolId;

    const [treatments, total] = await Promise.all([
      prisma.treatment.findMany({
        where,
        include: {
          patient: {
            select: {
              id: true,
              fullName: true,
              mainDiagnosis: true,
            },
          },
          protocol: {
            select: {
              id: true,
              name: true,
              frequencyDays: true,
              category: true,
              medicationType: true,
            },
          },
          _count: {
            select: { doses: true },
          },
        },
        skip,
        take: limitNum,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.treatment.count({ where }),
    ]);

    sendPaginated(res, treatments, {
      total,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(total / limitNum),
    });
  } catch (error) {
    next(error);
  }
};

export const getTreatment = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const treatment = await prisma.treatment.findUnique({
      where: { id },
      include: {
        patient: {
          select: {
            id: true,
            fullName: true,
            mainDiagnosis: true,
            guardian: {
              select: {
                phonePrimary: true,
                fullName: true,
              },
            },
          },
        },
        protocol: {
          include: {
            milestones: {
              orderBy: { day: 'asc' },
            },
          },
        },
        doses: {
          orderBy: { cycleNumber: 'asc' },
          include: {
            inventoryItem: {
              select: {
                id: true,
                medicationName: true,
                lotNumber: true,
              },
            },
          },
        },
      },
    });

    if (!treatment) {
      throw new NotFoundError('Treatment not found');
    }

    sendSuccess(res, treatment);
  } catch (error) {
    next(error);
  }
};

export const createTreatment = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { patientId, protocolId, startDate, nextConsultationDate, observations, plannedDosesBeforeConsult } = req.body;

    if (!patientId || !protocolId || !startDate) {
      throw new BadRequestError('Patient, protocol, and start date are required');
    }

    // Verify patient exists
    const patient = await prisma.patient.findUnique({
      where: { id: patientId },
    });

    if (!patient) {
      throw new NotFoundError('Patient not found');
    }

    // Verify protocol exists
    const protocol = await prisma.protocol.findUnique({
      where: { id: protocolId },
    });

    if (!protocol) {
      throw new NotFoundError('Protocol not found');
    }

    const treatment = await prisma.treatment.create({
      data: {
        patientId,
        protocolId,
        startDate: new Date(startDate),
        nextConsultationDate: nextConsultationDate ? new Date(nextConsultationDate) : null,
        observations,
        plannedDosesBeforeConsult: plannedDosesBeforeConsult || 0,
        status: 'ONGOING',
      },
      include: {
        patient: {
          select: { id: true, fullName: true },
        },
        protocol: {
          select: { id: true, name: true, frequencyDays: true },
        },
      },
    });

    // Update patient active status
    await prisma.patient.update({
      where: { id: patientId },
      data: { active: true },
    });

    sendCreated(res, treatment);
  } catch (error) {
    next(error);
  }
};

export const updateTreatment = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { status, nextConsultationDate, observations, plannedDosesBeforeConsult } = req.body;

    const existingTreatment = await prisma.treatment.findUnique({
      where: { id },
      select: { patientId: true },
    });

    if (!existingTreatment) {
      throw new NotFoundError('Treatment not found');
    }

    const treatment = await prisma.treatment.update({
      where: { id },
      data: {
        ...(status && { status }),
        ...(nextConsultationDate !== undefined && {
          nextConsultationDate: nextConsultationDate ? new Date(nextConsultationDate) : null,
        }),
        ...(observations !== undefined && { observations }),
        ...(plannedDosesBeforeConsult !== undefined && { plannedDosesBeforeConsult }),
      },
      include: {
        patient: {
          select: { id: true, fullName: true },
        },
        protocol: {
          select: { id: true, name: true, frequencyDays: true },
        },
      },
    });

    // Recalculate patient active status if treatment status changed
    if (status) {
      const allTreatments = await prisma.treatment.findMany({
        where: { patientId: existingTreatment.patientId },
        select: { status: true },
      });

      const isPatientActive = allTreatments.some(
        (t: { status: string }) => t.status === 'ONGOING' || t.status === 'EXTERNAL'
      );

      await prisma.patient.update({
        where: { id: existingTreatment.patientId },
        data: { active: isPatientActive },
      });
    }

    sendSuccess(res, treatment);
  } catch (error) {
    next(error);
  }
};

export const deleteTreatment = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const treatment = await prisma.treatment.findUnique({
      where: { id },
      select: { patientId: true },
    });

    if (!treatment) {
      throw new NotFoundError('Treatment not found');
    }

    await prisma.treatment.delete({
      where: { id },
    });

    // Recalculate patient active status
    const remainingTreatments = await prisma.treatment.findMany({
      where: { patientId: treatment.patientId },
      select: { status: true },
    });

    const isPatientActive = remainingTreatments.some(
      (t: { status: string }) => t.status === 'ONGOING' || t.status === 'EXTERNAL'
    );

    await prisma.patient.update({
      where: { id: treatment.patientId },
      data: { active: isPatientActive },
    });

    sendNoContent(res);
  } catch (error) {
    next(error);
  }
};
