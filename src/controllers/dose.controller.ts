import { Request, Response, NextFunction } from 'express';
import prisma from '../utils/prisma.js';
import { NotFoundError, BadRequestError } from '../utils/errors.js';
import { sendSuccess, sendPaginated, sendCreated, sendNoContent } from '../utils/response.js';

// Helper function to calculate dose logic
const calculateDoseLogic = (applicationDate: Date, frequencyDays: number) => {
  const nextDate = new Date(applicationDate);
  nextDate.setDate(nextDate.getDate() + frequencyDays);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const diffTime = nextDate.getTime() - today.getTime();
  const daysUntilNext = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  return {
    calculatedNextDate: nextDate,
    daysUntilNext,
  };
};

export const getDoses = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { treatmentId, status, paymentStatus, nurse, fromDate, toDate, page = '1', limit = '20' } = req.query;

    const pageNum = parseInt(page as string, 10);
    const limitNum = Math.min(parseInt(limit as string, 10), 100);
    const skip = (pageNum - 1) * limitNum;

    const where: any = {};

    if (treatmentId) where.treatmentId = treatmentId;
    if (status) where.status = status;
    if (paymentStatus) where.paymentStatus = paymentStatus;
    if (nurse !== undefined) where.nurse = nurse === 'true';
    if (fromDate) where.applicationDate = { ...where.applicationDate, gte: new Date(fromDate as string) };
    if (toDate) where.applicationDate = { ...where.applicationDate, lte: new Date(toDate as string) };

    const [doses, total] = await Promise.all([
      prisma.dose.findMany({
        where,
        include: {
          treatment: {
            include: {
              patient: {
                select: { id: true, fullName: true },
              },
              protocol: {
                select: { id: true, name: true, frequencyDays: true },
              },
            },
          },
          inventoryItem: {
            select: { id: true, medicationName: true, lotNumber: true },
          },
        },
        skip,
        take: limitNum,
        orderBy: { applicationDate: 'desc' },
      }),
      prisma.dose.count({ where }),
    ]);

    sendPaginated(res, doses, {
      total,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(total / limitNum),
    });
  } catch (error) {
    next(error);
  }
};

export const getDose = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const dose = await prisma.dose.findUnique({
      where: { id },
      include: {
        treatment: {
          include: {
            patient: {
              select: { id: true, fullName: true },
            },
            protocol: {
              select: { id: true, name: true, frequencyDays: true },
            },
          },
        },
        inventoryItem: {
          select: { id: true, medicationName: true, lotNumber: true, quantity: true },
        },
      },
    });

    if (!dose) {
      throw new NotFoundError('Dose not found');
    }

    sendSuccess(res, dose);
  } catch (error) {
    next(error);
  }
};

export const createDose = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const {
      treatmentId,
      cycleNumber,
      applicationDate,
      lotNumber,
      expiryDate,
      status,
      inventoryLotId,
      isLastBeforeConsult,
      consultationDate,
      paymentStatus,
      nurse,
    } = req.body;

    if (!treatmentId || !cycleNumber || !applicationDate) {
      throw new BadRequestError('Treatment, cycle number, and application date are required');
    }

    // Get treatment with protocol for frequency calculation
    const treatment = await prisma.treatment.findUnique({
      where: { id: treatmentId },
      include: {
        protocol: { select: { frequencyDays: true } },
        patient: { select: { id: true } },
      },
    });

    if (!treatment) {
      throw new NotFoundError('Treatment not found');
    }

    const appDate = new Date(applicationDate);
    const { calculatedNextDate, daysUntilNext } = calculateDoseLogic(
      appDate,
      treatment.protocol.frequencyDays
    );

    // Create the dose
    const dose = await prisma.dose.create({
      data: {
        treatmentId,
        cycleNumber,
        applicationDate: appDate,
        lotNumber: lotNumber || null,
        expiryDate: expiryDate ? new Date(expiryDate) : null,
        status: status || 'PENDING',
        calculatedNextDate,
        daysUntilNext,
        isLastBeforeConsult: isLastBeforeConsult || false,
        consultationDate: consultationDate ? new Date(consultationDate) : null,
        paymentStatus: paymentStatus || 'WAITING_PIX',
        nurse: nurse || false,
        surveyStatus: nurse ? 'WAITING' : 'NOT_SENT',
        inventoryLotId: inventoryLotId || null,
      },
      include: {
        treatment: {
          include: {
            patient: { select: { id: true, fullName: true } },
            protocol: { select: { id: true, name: true } },
          },
        },
      },
    });

    // If dose is applied and has inventory lot, dispense medication
    if (status === 'APPLIED' && inventoryLotId) {
      await dispenseMedication(inventoryLotId, treatment.patient.id, dose.id);
    }

    sendCreated(res, dose);
  } catch (error) {
    next(error);
  }
};

export const updateDose = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const {
      applicationDate,
      lotNumber,
      expiryDate,
      status,
      inventoryLotId,
      isLastBeforeConsult,
      consultationDate,
      paymentStatus,
      nurse,
      surveyStatus,
      surveyScore,
      surveyComment,
    } = req.body;

    // Get existing dose with treatment info
    const existingDose = await prisma.dose.findUnique({
      where: { id },
      include: {
        treatment: {
          include: {
            protocol: { select: { frequencyDays: true } },
            patient: { select: { id: true } },
          },
        },
      },
    });

    if (!existingDose) {
      throw new NotFoundError('Dose not found');
    }

    const updateData: any = {};

    if (applicationDate !== undefined) {
      const appDate = new Date(applicationDate);
      const { calculatedNextDate, daysUntilNext } = calculateDoseLogic(
        appDate,
        existingDose.treatment.protocol.frequencyDays
      );
      updateData.applicationDate = appDate;
      updateData.calculatedNextDate = calculatedNextDate;
      updateData.daysUntilNext = daysUntilNext;
    }

    if (lotNumber !== undefined) updateData.lotNumber = lotNumber;
    if (expiryDate !== undefined) updateData.expiryDate = new Date(expiryDate);
    if (status !== undefined) updateData.status = status;
    if (inventoryLotId !== undefined) updateData.inventoryLotId = inventoryLotId;
    if (isLastBeforeConsult !== undefined) updateData.isLastBeforeConsult = isLastBeforeConsult;
    if (consultationDate !== undefined) {
      updateData.consultationDate = consultationDate ? new Date(consultationDate) : null;
    }
    if (paymentStatus !== undefined) {
      updateData.paymentStatus = paymentStatus;
      updateData.paymentUpdatedAt = new Date();
    }

    // Handle nurse and survey status logic
    if (nurse !== undefined) {
      updateData.nurse = nurse;
      if (!nurse) {
        updateData.surveyStatus = 'NOT_SENT';
        updateData.surveyScore = null;
        updateData.surveyComment = null;
      }
    }

    if (surveyStatus !== undefined && (nurse || existingDose.nurse)) {
      updateData.surveyStatus = surveyStatus;
    }
    if (surveyScore !== undefined) updateData.surveyScore = surveyScore;
    if (surveyComment !== undefined) updateData.surveyComment = surveyComment;

    const dose = await prisma.dose.update({
      where: { id },
      data: updateData,
      include: {
        treatment: {
          include: {
            patient: { select: { id: true, fullName: true } },
            protocol: { select: { id: true, name: true } },
          },
        },
        inventoryItem: {
          select: { id: true, medicationName: true, lotNumber: true },
        },
      },
    });

    // Handle inventory dispensing when status changes to APPLIED
    if (
      status === 'APPLIED' &&
      existingDose.status !== 'APPLIED' &&
      (inventoryLotId || existingDose.inventoryLotId)
    ) {
      const lotId = inventoryLotId || existingDose.inventoryLotId;
      await dispenseMedication(lotId!, existingDose.treatment.patient.id, dose.id);
    }

    sendSuccess(res, dose);
  } catch (error) {
    next(error);
  }
};

export const deleteDose = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    await prisma.dose.delete({
      where: { id },
    });

    sendNoContent(res);
  } catch (error) {
    next(error);
  }
};

export const updateSurvey = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { surveyStatus, surveyScore, surveyComment } = req.body;

    const dose = await prisma.dose.update({
      where: { id },
      data: {
        ...(surveyStatus && { surveyStatus }),
        ...(surveyScore !== undefined && { surveyScore }),
        ...(surveyComment !== undefined && { surveyComment }),
      },
    });

    sendSuccess(res, dose);
  } catch (error) {
    next(error);
  }
};

// Helper function to dispense medication
async function dispenseMedication(inventoryLotId: string, patientId: string, doseId: string) {
  const inventoryItem = await prisma.inventoryItem.findUnique({
    where: { id: inventoryLotId },
  });

  if (!inventoryItem || inventoryItem.quantity <= 0) {
    throw new BadRequestError('Insufficient inventory');
  }

  await prisma.$transaction([
    prisma.inventoryItem.update({
      where: { id: inventoryLotId },
      data: { quantity: { decrement: 1 } },
    }),
    prisma.dispenseLog.create({
      data: {
        patientId,
        inventoryItemId: inventoryLotId,
        medicationName: inventoryItem.medicationName,
        quantity: 1,
        doseId,
      },
    }),
  ]);
}
