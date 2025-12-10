import { Request, Response, NextFunction } from 'express';
import prisma from '../utils/prisma.js';
import { sendSuccess, sendCreated } from '../utils/response.js';

export const getStats = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const today = new Date();
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);

    const [
      totalPatients,
      activePatients,
      pendingDoses,
      appliedDosesThisMonth,
      pendingPayments,
      patientsWithoutDocuments,
      lowStockItems,
      pendingPurchaseRequests,
      surveyScores,
    ] = await Promise.all([
      prisma.patient.count(),
      prisma.patient.count({ where: { active: true } }),
      prisma.dose.count({ where: { status: 'PENDING' } }),
      prisma.dose.count({
        where: {
          status: 'APPLIED',
          applicationDate: {
            gte: startOfMonth,
            lte: endOfMonth,
          },
        },
      }),
      prisma.dose.count({
        where: {
          paymentStatus: {
            in: ['WAITING_PIX', 'WAITING_CARD', 'WAITING_BOLETO', 'WAITING_DELIVERY'],
          },
        },
      }),
      prisma.patient.count({
        where: {
          active: true,
          consentDocuments: {
            none: {},
          },
        },
      }),
      prisma.inventoryItem.count({
        where: {
          active: true,
          quantity: { lte: 5 },
          expiryDate: { gt: today },
        },
      }),
      prisma.purchaseRequest.count({ where: { status: 'PENDING' } }),
      prisma.dose.findMany({
        where: {
          surveyStatus: 'ANSWERED',
          surveyScore: { not: null },
        },
        select: { surveyScore: true },
      }),
    ]);

    // Calculate NPS
    const validScores = surveyScores.filter((s: { surveyScore: number | null }) => s.surveyScore !== null && s.surveyScore > 0);
    const npsScore =
      validScores.length > 0
        ? validScores.reduce((sum: number, s: { surveyScore: number | null }) => sum + (s.surveyScore || 0), 0) / validScores.length
        : 0;

    sendSuccess(res, {
      totalPatients,
      activePatients,
      pendingDoses,
      appliedDosesThisMonth,
      pendingPayments,
      pendingDocuments: patientsWithoutDocuments,
      lowStockAlerts: lowStockItems,
      pendingPurchaseRequests,
      npsScore: Math.round(npsScore * 10) / 10,
    });
  } catch (error) {
    next(error);
  }
};

export const getUpcomingContacts = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { days = '7' } = req.query;
    const daysAhead = parseInt(days as string, 10);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const pastLimit = new Date(today);
    pastLimit.setDate(pastLimit.getDate() - 60);

    const futureLimit = new Date(today);
    futureLimit.setDate(futureLimit.getDate() + daysAhead);

    // Get active treatments with protocols and milestones
    const treatments = await prisma.treatment.findMany({
      where: {
        status: 'ONGOING',
      },
      include: {
        patient: {
          select: {
            id: true,
            fullName: true,
            guardian: {
              select: { phonePrimary: true },
            },
          },
        },
        protocol: {
          include: {
            milestones: true,
          },
        },
      },
    });

    // Get dismissed logs
    const dismissedLogs = await prisma.dismissedLog.findMany();
    const dismissedSet = new Set(dismissedLogs.map((d: { contactId: string }) => d.contactId));

    // Calculate upcoming contacts
    const contacts: any[] = [];

    treatments.forEach((treatment: any) => {
      treatment.protocol.milestones.forEach((milestone: any) => {
        const contactDate = new Date(treatment.startDate);
        contactDate.setDate(contactDate.getDate() + milestone.day);

        const contactId = `${treatment.id}_m_${milestone.day}`;

        // Include if within date range and not dismissed
        if (contactDate >= pastLimit && contactDate <= futureLimit && !dismissedSet.has(contactId)) {
          contacts.push({
            contactId,
            treatmentId: treatment.id,
            patientId: treatment.patient.id,
            patientName: treatment.patient.fullName,
            guardianPhone: treatment.patient.guardian?.phonePrimary,
            contactDate,
            message: milestone.message,
            protocolName: treatment.protocol.name,
          });
        }
      });
    });

    // Sort by date
    contacts.sort((a, b) => a.contactDate.getTime() - b.contactDate.getTime());

    sendSuccess(res, { data: contacts });
  } catch (error) {
    next(error);
  }
};

export const dismissContact = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { contactId, feedback } = req.body;

    const dismissed = await prisma.dismissedLog.create({
      data: {
        contactId,
        feedbackText: feedback?.text || null,
        feedbackClassification: feedback?.classification || null,
        feedbackNeedsMedical: feedback?.needsMedicalResponse || null,
        feedbackUrgency: feedback?.urgency || null,
        feedbackStatus: feedback?.text ? 'pending' : null,
      },
    });

    sendCreated(res, dismissed);
  } catch (error) {
    next(error);
  }
};

export const updateDismissedLogFeedback = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { contactId } = req.params;
    const { feedback } = req.body;

    const updated = await prisma.dismissedLog.update({
      where: { contactId },
      data: {
        feedbackText: feedback?.text,
        feedbackClassification: feedback?.classification,
        feedbackNeedsMedical: feedback?.needsMedicalResponse,
        feedbackUrgency: feedback?.urgency,
        feedbackStatus: feedback?.status || 'pending',
      },
    });

    sendSuccess(res, updated);
  } catch (error) {
    next(error);
  }
};

export const resolveFeedback = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { contactId } = req.params;

    const updated = await prisma.dismissedLog.update({
      where: { contactId },
      data: { feedbackStatus: 'resolved' },
    });

    sendSuccess(res, updated);
  } catch (error) {
    next(error);
  }
};

export const getActivityWindow = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { days = '60' } = req.query;
    const windowDays = parseInt(days as string, 10);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const pastLimit = new Date(today);
    pastLimit.setDate(pastLimit.getDate() - windowDays);

    const futureLimit = new Date(today);
    futureLimit.setDate(futureLimit.getDate() + windowDays);

    const doses = await prisma.dose.findMany({
      where: {
        OR: [
          {
            applicationDate: {
              gte: pastLimit,
              lte: futureLimit,
            },
          },
          {
            calculatedNextDate: {
              gte: pastLimit,
              lte: futureLimit,
            },
          },
        ],
        treatment: {
          status: 'ONGOING',
        },
      },
      include: {
        treatment: {
          include: {
            patient: {
              select: { id: true, fullName: true },
            },
            protocol: {
              select: { name: true },
            },
          },
        },
      },
      orderBy: { applicationDate: 'asc' },
    });

    const data = doses.map((dose: any) => ({
      id: dose.id,
      patientId: dose.treatment.patient.id,
      patientName: dose.treatment.patient.fullName,
      protocolName: dose.treatment.protocol.name,
      applicationDate: dose.applicationDate,
      calculatedNextDate: dose.calculatedNextDate,
      daysUntilNext: dose.daysUntilNext,
      status: dose.status,
      paymentStatus: dose.paymentStatus,
      nurse: dose.nurse,
      surveyStatus: dose.surveyStatus,
    }));

    sendSuccess(res, { data });
  } catch (error) {
    next(error);
  }
};

export const getAllDismissedLogs = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const dismissedLogs = await prisma.dismissedLog.findMany({
      orderBy: { dismissedAt: 'desc' },
    });

    sendSuccess(res, { data: dismissedLogs });
  } catch (error) {
    next(error);
  }
};

export const getAllDocuments = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const documents = await prisma.consentDocument.findMany({
      include: {
        patient: {
          select: { id: true, fullName: true },
        },
      },
      orderBy: { uploadDate: 'desc' },
    });

    sendSuccess(res, { data: documents });
  } catch (error) {
    next(error);
  }
};
