import { Request, Response, NextFunction } from 'express';
import prisma from '../utils/prisma.js';
import { NotFoundError, BadRequestError } from '../utils/errors.js';
import { sendSuccess, sendPaginated, sendCreated, sendNoContent } from '../utils/response.js';
import { PaymentMethod } from '@prisma/client';

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
    const limitNum = Math.min(parseInt(limit as string, 10), 1000);
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
          appliedBy: {
            select: { id: true, name: true },
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
        appliedBy: {
          select: { id: true, name: true },
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
      scheduledDate,
      applicationDate,
      lotNumber,
      expiryDate,
      status,
      inventoryLotId,
      isLastBeforeConsult,
      consultationDate,
      paymentStatus,
      paymentMethod,
      paymentDate,
      nurse,
      purchased,
      deliveryStatus,
      surveyStatus,
      surveyScore,
      surveyComment,
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
    const schedDate = scheduledDate ? new Date(scheduledDate) : appDate;

    // Validate: Cannot mark as APPLIED if date is in the future
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    if ((status === 'APPLIED' || status === 'APPLIED_LATE') && appDate > today) {
      throw new BadRequestError('Não é possível marcar como "Aplicada" uma dose com data futura. Use o status "Pendente" para agendamentos futuros.');
    }

    // CONFIRM_APPLICATION is a visual-only status; logically behaves as APPLIED
    // but does not trigger sale/inventory flow nor require nurse data
    let effectiveStatus = status || 'PENDING';
    if (effectiveStatus === 'APPLIED') {
      // Auto-detect APPLIED_LATE: if applied after scheduled date
      const schedDay = new Date(schedDate); schedDay.setHours(0, 0, 0, 0);
      const appDay = new Date(appDate); appDay.setHours(0, 0, 0, 0);
      if (appDay.getTime() > schedDay.getTime()) {
        effectiveStatus = 'APPLIED_LATE';
      }
    }

    const { calculatedNextDate, daysUntilNext } = calculateDoseLogic(
      appDate,
      treatment.protocol.frequencyDays
    );

    // Track who applied the dose (when status moves to APPLIED/APPLIED_LATE)
    const isNowApplied = effectiveStatus === 'APPLIED' || effectiveStatus === 'APPLIED_LATE';

    // Create the dose
    const dose = await prisma.dose.create({
      data: {
        treatmentId,
        cycleNumber,
        scheduledDate: schedDate,
        applicationDate: appDate,
        lotNumber: lotNumber || null,
        expiryDate: expiryDate ? new Date(expiryDate) : null,
        status: effectiveStatus,
        calculatedNextDate,
        daysUntilNext,
        isLastBeforeConsult: isLastBeforeConsult || false,
        consultationDate: consultationDate ? new Date(consultationDate) : null,
        paymentStatus: paymentStatus || 'WAITING_PIX',
        paymentMethod: paymentMethod || null,
        paymentDate: paymentDate ? new Date(paymentDate) : null,
        nurse: nurse || false,
        surveyStatus: surveyStatus || (nurse ? 'WAITING' : 'NOT_SENT'),
        // March 2026 spec: 0 não faz parte da escala válida (1-10). Treat 0 as null ("não avaliado").
        surveyScore: typeof surveyScore === 'number' && surveyScore > 0 ? surveyScore : null,
        surveyComment: surveyComment || null,
        inventoryLotId: inventoryLotId || null,
        purchased: purchased !== undefined ? purchased : true,
        deliveryStatus: deliveryStatus || null,
        appliedByUserId: isNowApplied ? (req.user?.id || null) : null,
        appliedAt: isNowApplied ? new Date() : null,
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

    // CONFIRM_APPLICATION: skip sale/inventory flow per spec
    // (visual-only status, will be completed later when nurse fills data and confirms)
    const isConfirmApplication = effectiveStatus === 'CONFIRM_APPLICATION';

    // Dispense medication from inventory when purchased=true (regardless of dose status)
    // purchased=false means patient brought their own medication, no inventory deduction
    const shouldDispense = !isConfirmApplication && purchased !== false;
    if (inventoryLotId && shouldDispense) {
      await dispenseMedication(inventoryLotId, treatment.patient.id, dose.id);
    }

    // Always update treatment startDate based on dose dates (for message timeline)
    await updateTreatmentStartDate(treatmentId);

    // Recalculate future scheduled dates if applied late or applied
    // (CONFIRM_APPLICATION also behaves as applied for dose-chain purposes per spec)
    if (effectiveStatus === 'APPLIED_LATE' || effectiveStatus === 'APPLIED' || isConfirmApplication) {
      await recalculateFutureScheduledDates(treatmentId, { cycleNumber, applicationDate: appDate });
      await checkAndFinishTreatment(treatmentId);
    }

    // Auto-create Sale record when paymentDate is set (for CAIXA module).
    // Skipped for CONFIRM_APPLICATION (financial data not yet entered).
    if (!isConfirmApplication && paymentDate && paymentMethod) {
      await createOrUpdateSaleFromDose(dose.id, treatment.patient.id, paymentMethod as PaymentMethod, new Date(paymentDate));
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
      paymentMethod,
      paymentDate,
      nurse,
      surveyStatus,
      surveyScore,
      surveyComment,
      purchased,
      deliveryStatus,
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

    // Determine the application date to validate (new or existing)
    const appDateToValidate = applicationDate !== undefined
      ? new Date(applicationDate)
      : existingDose.applicationDate;

    // Validate: Cannot mark as APPLIED if date is in the future
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    if ((status === 'APPLIED' || status === 'APPLIED_LATE') && appDateToValidate > today) {
      throw new BadRequestError('Não é possível marcar como "Aplicada" uma dose com data futura. Use o status "Pendente" para agendamentos futuros.');
    }

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
    // BUG FIX: do NOT auto-overwrite applicationDate on status change.
    // The manually-entered date must be preserved when moving to APPLIED.

    // Auto-detect APPLIED_LATE: compare applicationDate vs scheduledDate
    let effectiveStatus = status;
    if (status === 'APPLIED' || status === 'APPLIED_LATE') {
      const finalAppDate = new Date(applicationDate || existingDose.applicationDate);
      const finalSchedDate = new Date(existingDose.scheduledDate);
      finalAppDate.setHours(0, 0, 0, 0);
      finalSchedDate.setHours(0, 0, 0, 0);
      effectiveStatus = finalAppDate.getTime() > finalSchedDate.getTime() ? 'APPLIED_LATE' : 'APPLIED';
    }
    // CONFIRM_APPLICATION passes through unchanged (visual-only)

    if (lotNumber !== undefined) updateData.lotNumber = lotNumber;
    if (expiryDate !== undefined) updateData.expiryDate = new Date(expiryDate);
    if (effectiveStatus !== undefined) {
      updateData.status = effectiveStatus;

      // Track who set the dose to APPLIED/APPLIED_LATE (for "Application Data" highlight card)
      const wasApplied = existingDose.status === 'APPLIED' || existingDose.status === 'APPLIED_LATE';
      const isNowApplied = effectiveStatus === 'APPLIED' || effectiveStatus === 'APPLIED_LATE';
      if (isNowApplied && !wasApplied) {
        updateData.appliedByUserId = req.user?.id || null;
        updateData.appliedAt = new Date();
      }
    }
    if (inventoryLotId !== undefined) updateData.inventoryLotId = inventoryLotId;
    if (isLastBeforeConsult !== undefined) updateData.isLastBeforeConsult = isLastBeforeConsult;
    if (consultationDate !== undefined) {
      updateData.consultationDate = consultationDate ? new Date(consultationDate) : null;
    }
    if (paymentStatus !== undefined) {
      updateData.paymentStatus = paymentStatus;
      updateData.paymentUpdatedAt = new Date();
    }
    if (paymentMethod !== undefined) {
      updateData.paymentMethod = paymentMethod || null;
    }
    if (paymentDate !== undefined) {
      updateData.paymentDate = paymentDate ? new Date(paymentDate) : null;
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
    if (surveyScore !== undefined) {
      // March 2026 spec: treat 0 as null (escala válida é 1-10).
      updateData.surveyScore = typeof surveyScore === 'number' && surveyScore > 0 ? surveyScore : null;
    }
    if (surveyComment !== undefined) updateData.surveyComment = surveyComment;
    if (purchased !== undefined) updateData.purchased = purchased;
    if (deliveryStatus !== undefined) updateData.deliveryStatus = deliveryStatus;

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
        appliedBy: {
          select: { id: true, name: true },
        },
      },
    });

    // Handle inventory dispensing when purchased changes to true
    // purchased=false means patient brought their own medication, no inventory deduction
    const wasPurchased = purchased !== undefined ? purchased : existingDose.purchased;
    const wasNotPurchasedBefore = existingDose.purchased === false;
    const isNowPurchased = wasPurchased !== false;
    const lotId = inventoryLotId || existingDose.inventoryLotId;

    // Dispense if: purchased is now true AND either:
    // 1. It's a new inventory lot being assigned, OR
    // 2. purchased changed from false to true (and there's already a lot)
    if (lotId && isNowPurchased) {
      // Only dispense if this is a new purchase action (wasn't purchased before, or new lot assigned)
      const newLotAssigned = inventoryLotId && inventoryLotId !== existingDose.inventoryLotId;
      const purchaseStatusChanged = wasNotPurchasedBefore && purchased === true;

      if (newLotAssigned || purchaseStatusChanged) {
        await dispenseMedication(lotId, existingDose.treatment.patient.id, dose.id);
      }
    }

    // Always update treatment startDate when dose date changes or status changes
    // This ensures the timeline is always in sync with actual dose dates
    if (applicationDate !== undefined || status !== undefined) {
      await updateTreatmentStartDate(existingDose.treatmentId);
    }

    // Check if treatment should be finished (all planned doses applied).
    // CONFIRM_APPLICATION counts as applied for chain/finish logic per spec.
    const isAppliedLike = effectiveStatus === 'APPLIED' || effectiveStatus === 'APPLIED_LATE' || effectiveStatus === 'CONFIRM_APPLICATION';
    if (isAppliedLike) {
      // Recalculate future scheduled dates based on actual application
      const finalAppDate = new Date(applicationDate || existingDose.applicationDate);
      await recalculateFutureScheduledDates(existingDose.treatmentId, {
        cycleNumber: existingDose.cycleNumber,
        applicationDate: finalAppDate
      });
      await checkAndFinishTreatment(existingDose.treatmentId);
    }

    // Auto-create/update Sale record when paymentDate is set (for CAIXA module).
    // Only when not CONFIRM_APPLICATION (financial data not finalized yet).
    if (effectiveStatus !== 'CONFIRM_APPLICATION' && paymentDate && paymentMethod) {
      await createOrUpdateSaleFromDose(dose.id, existingDose.treatment.patient.id, paymentMethod as PaymentMethod, new Date(paymentDate));
    }

    sendSuccess(res, dose);
  } catch (error) {
    next(error);
  }
};

export const deleteDose = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    // Get the dose first to know which treatment to update
    const dose = await prisma.dose.findUnique({
      where: { id },
      select: { treatmentId: true },
    });

    await prisma.dose.delete({
      where: { id },
    });

    // Update treatment startDate after deletion
    if (dose) {
      await updateTreatmentStartDate(dose.treatmentId);
    }

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
        // March 2026 spec: treat 0 as null (escala válida é 1-10).
        ...(surveyScore !== undefined && {
          surveyScore: typeof surveyScore === 'number' && surveyScore > 0 ? surveyScore : null,
        }),
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

// Helper function to update treatment startDate based on dose dates
// Priority: 1) Latest APPLIED dose, 2) First PENDING dose
// This ensures the message timeline (D0, D1, D30, D77, etc.) uses the correct reference date
async function updateTreatmentStartDate(treatmentId: string) {
  // Get the most recent applied dose for this treatment.
  // CONFIRM_APPLICATION behaves as APPLIED per spec.
  const latestAppliedDose = await prisma.dose.findFirst({
    where: {
      treatmentId,
      status: { in: ['APPLIED', 'APPLIED_LATE', 'CONFIRM_APPLICATION'] },
    },
    orderBy: { applicationDate: 'desc' },
    select: { applicationDate: true },
  });

  if (latestAppliedDose) {
    // Use last applied dose date as reference
    await prisma.treatment.update({
      where: { id: treatmentId },
      data: { startDate: latestAppliedDose.applicationDate },
    });
    return;
  }

  // If no applied dose, use first pending dose
  const firstPendingDose = await prisma.dose.findFirst({
    where: {
      treatmentId,
      status: 'PENDING',
    },
    orderBy: { applicationDate: 'asc' },
    select: { applicationDate: true },
  });

  if (firstPendingDose) {
    await prisma.treatment.update({
      where: { id: treatmentId },
      data: { startDate: firstPendingDose.applicationDate },
    });
  }
}

// Helper function to check if all planned doses are applied and finish the treatment
// When applied doses >= plannedDosesBeforeConsult, change status to FINISHED
async function checkAndFinishTreatment(treatmentId: string) {
  const treatment = await prisma.treatment.findUnique({
    where: { id: treatmentId },
    select: {
      plannedDosesBeforeConsult: true,
      status: true,
    },
  });

  if (!treatment || treatment.status !== 'ONGOING') {
    return; // Only check ongoing treatments
  }

  // If plannedDosesBeforeConsult is 0 or not set, don't auto-finish
  if (!treatment.plannedDosesBeforeConsult || treatment.plannedDosesBeforeConsult <= 0) {
    return;
  }

  // Count applied doses for this treatment.
  // Per spec, CONFIRM_APPLICATION behaves as APPLIED for system logic.
  const appliedDosesCount = await prisma.dose.count({
    where: {
      treatmentId,
      status: { in: ['APPLIED', 'APPLIED_LATE', 'CONFIRM_APPLICATION'] },
    },
  });

  // If applied doses >= planned doses, finish the treatment
  if (appliedDosesCount >= treatment.plannedDosesBeforeConsult) {
    await prisma.treatment.update({
      where: { id: treatmentId },
      data: { status: 'FINISHED' },
    });
  }
}

// Helper function to recalculate future scheduled dates when a dose is applied
// This ensures future PENDING doses get their scheduledDate updated based on the actual application date
async function recalculateFutureScheduledDates(treatmentId: string, fromDose: { cycleNumber: number; applicationDate: Date }) {
  const treatment = await prisma.treatment.findUnique({
    where: { id: treatmentId },
    include: { protocol: { select: { frequencyDays: true } } },
  });
  if (!treatment) return;

  const frequencyDays = treatment.protocol.frequencyDays;

  // Get all PENDING doses with cycleNumber > the applied dose
  const futurePendingDoses = await prisma.dose.findMany({
    where: {
      treatmentId,
      status: 'PENDING',
      cycleNumber: { gt: fromDose.cycleNumber },
    },
    orderBy: { cycleNumber: 'asc' },
  });

  // Recalculate each future dose's scheduledDate
  let previousDate = fromDose.applicationDate;
  for (const futureDose of futurePendingDoses) {
    const newScheduledDate = new Date(previousDate);
    newScheduledDate.setDate(newScheduledDate.getDate() + frequencyDays);

    await prisma.dose.update({
      where: { id: futureDose.id },
      data: {
        scheduledDate: newScheduledDate,
        applicationDate: newScheduledDate, // For PENDING doses, keep dates in sync
      },
    });

    previousDate = newScheduledDate;
  }
}

// Helper function to auto-create/update Sale record when dose has financial data
// This makes the sale appear in the CAIXA module
async function createOrUpdateSaleFromDose(
  doseId: string,
  patientId: string,
  paymentMethod: PaymentMethod,
  saleDate: Date
) {
  // Get the dose with inventory info
  const dose = await prisma.dose.findUnique({
    where: { id: doseId },
    include: {
      inventoryItem: true,
      sale: true,
    },
  });

  if (!dose) return;

  // Get default values from inventory item if available
  const inventoryItem = dose.inventoryItem;
  const unitCost = inventoryItem?.unitCost || 0;
  const salePrice = inventoryItem?.baseSalePrice || 0;
  const commission = inventoryItem?.defaultCommission || 0;
  const tax = inventoryItem?.defaultTax || 0;
  const delivery = inventoryItem?.defaultDelivery || 0;
  const other = inventoryItem?.defaultOther || 0;

  // Calculate profits
  const grossProfit = salePrice - unitCost;
  const opex = commission + tax + delivery + other;
  const netProfit = grossProfit - opex;

  if (dose.sale) {
    // Update existing sale
    await prisma.sale.update({
      where: { id: dose.sale.id },
      data: {
        paymentMethod,
        saleDate,
      },
    });
  } else if (dose.inventoryLotId) {
    // Create new sale only if inventoryLotId exists (required field)
    await prisma.sale.create({
      data: {
        doseId,
        inventoryItemId: dose.inventoryLotId,
        patientId,
        salePrice,
        unitCost,
        commission,
        tax,
        delivery,
        other,
        grossProfit,
        netProfit,
        paymentMethod,
        saleDate,
      },
    });
  }
  // If no inventoryLotId and no existing sale, skip creating sale record
}
