import { Request, Response, NextFunction } from 'express';
import prisma from '../utils/prisma.js';
import { sendSuccess, sendCreated } from '../utils/response.js';
import { renderTemplate } from '../services/messageVariables.service.js';

// Local helpers for inline variable rendering in upcoming-contacts (avoids per-contact DB calls).
const MONTH_NAMES_PT = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

const firstName = (full?: string | null): string => {
  if (!full) return '';
  return full.trim().split(/\s+/)[0] || '';
};

const formatDateBR = (date: Date | string | null | undefined): string => {
  if (!date) return '';
  const d = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString('pt-BR', { timeZone: 'UTC' });
};

const formatConsultationPeriod = (
  month?: number | null,
  year?: number | null,
  fortnight?: number | null,
  fallbackDate?: Date | null,
): string => {
  if (month && year && fortnight) {
    const idx = Math.max(1, Math.min(12, month)) - 1;
    return `${MONTH_NAMES_PT[idx]}/${year} - ${fortnight === 1 ? '1ª Quinzena' : '2ª Quinzena'}`;
  }
  if (fallbackDate) {
    const d = new Date(fallbackDate);
    if (isNaN(d.getTime())) return '';
    const idx = d.getUTCMonth();
    const fn = d.getUTCDate() <= 15 ? '1ª Quinzena' : '2ª Quinzena';
    return `${MONTH_NAMES_PT[idx]}/${d.getUTCFullYear()} - ${fn}`;
  }
  return '';
};

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
      // March 2026: 3 operational counters for new Painel de Controle Operacional
      toDeliverCount,        // ENTREGAR: Pago + Aguardando Entrega
      toPayCount,            // A PAGAR: pagamento pendente
      nursingPendingCount,   // ENFERMAGEM: doses aguardando aplicação pela enfermeira
      // March 2026: pending Dose 1 confirmation
      confirmApplicationCount,
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
            in: ['WAITING_PIX', 'WAITING_CARD', 'WAITING_BOLETO'],
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
      prisma.dose.count({
        where: {
          paymentStatus: 'PAID',
          deliveryStatus: 'waiting',
        },
      }),
      prisma.dose.count({
        where: {
          paymentStatus: { in: ['WAITING_PIX', 'WAITING_CARD', 'WAITING_BOLETO'] },
        },
      }),
      prisma.dose.count({
        where: {
          nurse: true,
          status: 'PENDING',
        },
      }),
      prisma.dose.count({ where: { status: 'CONFIRM_APPLICATION' } }),
    ]);

    // Calculate NPS — only valid 1-10 scores; null is "not evaluated" (per March 2026 bug fix)
    const validScores = surveyScores.filter(
      (s: { surveyScore: number | null }) => s.surveyScore !== null && s.surveyScore > 0
    );
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
      // March 2026 operational counters
      toDeliverCount,
      toPayCount,
      nursingPendingCount,
      confirmApplicationCount,
    });
  } catch (error) {
    next(error);
  }
};

// List patients pending Dose 1 confirmation (CONFIRM_APPLICATION status) — March 2026 spec
export const getConfirmApplicationDoses = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const doses = await prisma.dose.findMany({
      where: { status: 'CONFIRM_APPLICATION' },
      include: {
        treatment: {
          include: {
            patient: {
              select: {
                id: true,
                fullName: true,
                guardian: {
                  select: { fullName: true, phonePrimary: true },
                },
              },
            },
            protocol: {
              select: { id: true, name: true, frequencyDays: true },
            },
          },
        },
      },
      orderBy: { applicationDate: 'asc' },
    });

    sendSuccess(res, { data: doses });
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

    // Get active treatments with protocols, milestones, and applied doses (for Dose 1 / last dose detection).
    // March 2026: nextConsultationMonth/Year/Fortnight + protocol.frequencyDays needed for variable rendering.
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
              select: { phonePrimary: true, fullName: true },
            },
          },
        },
        protocol: {
          include: {
            milestones: true,
          },
        },
        doctor: {
          select: { id: true, name: true },
        },
        doses: {
          orderBy: { applicationDate: 'desc' },
          select: { id: true, cycleNumber: true, status: true, applicationDate: true },
        },
      },
    });

    // Get dismissed logs
    const dismissedLogs = await prisma.dismissedLog.findMany();
    const dismissedSet = new Set(dismissedLogs.map((d: { contactId: string }) => d.contactId));

    // Calculate upcoming contacts honoring per-dose protocol config
    const contacts: any[] = [];

    treatments.forEach((treatment: any) => {
      // Last applied dose (any of APPLIED/APPLIED_LATE/CONFIRM_APPLICATION) drives the timeline
      const appliedDoses = (treatment.doses || []).filter((d: any) =>
        ['APPLIED', 'APPLIED_LATE', 'CONFIRM_APPLICATION'].includes(d.status)
      );
      const lastAppliedDose = appliedDoses[0]; // ordered desc
      const referenceDate = lastAppliedDose?.applicationDate || treatment.startDate;

      // Per March 2026 spec: protocol messages anchored at lastAppliedDose are the "post-dose" reminders.
      // "Não enviar mensagens padrão na Dose 1" = skip messages that follow the application of Dose 1.
      // "Não enviar mensagens padrão na Última Dose" = skip messages that follow the last dose.
      // If no dose has been applied yet, neither toggle applies — default messages still send.
      const plannedDoses = treatment.plannedDosesBeforeConsult || 0;
      const isOnDose1 = lastAppliedDose?.cycleNumber === 1;
      const isOnLastDose = plannedDoses > 0 && lastAppliedDose?.cycleNumber === plannedDoses;

      // Apply per-dose toggles for default protocol messages
      const skipDefault =
        (isOnDose1 && treatment.protocol.dose1MessageEnabled === false) ||
        (isOnLastDose && treatment.protocol.lastDoseMessageEnabled === false);

      // March 2026: build the variable map ONCE per treatment so all milestones / extras
      // get auto-filled with patient/guardian/doctor data when shown in the dashboard popup.
      // Determine the next pending dose for {data_proxima_dose}.
      const firstPendingDose = (treatment.doses || []).find((d: any) => d.status === 'PENDING');
      const nextDoseDate: Date | null = firstPendingDose
        ? new Date(firstPendingDose.applicationDate)
        : (lastAppliedDose
            ? (() => {
                const d = new Date(lastAppliedDose.applicationDate);
                d.setDate(d.getDate() + (treatment.protocol?.frequencyDays || 28));
                return d;
              })()
            : null);

      const treatmentVars: Record<string, string> = {
        '{nome_responsavel}':      firstName(treatment.patient.guardian?.fullName),
        '{nome_paciente}':         firstName(treatment.patient.fullName),
        '{nome_medico}':           treatment.doctor?.name || '',
        '{data_proxima_dose}':     formatDateBR(nextDoseDate),
        '{data_proxima_consulta}': formatConsultationPeriod(
          treatment.nextConsultationMonth,
          treatment.nextConsultationYear,
          treatment.nextConsultationFortnight,
          treatment.nextConsultationDate,
        ),
      };

      if (!skipDefault) {
        treatment.protocol.milestones.forEach((milestone: any) => {
          const contactDate = new Date(referenceDate);
          contactDate.setDate(contactDate.getDate() + milestone.day);

          const contactId = `${treatment.id}_m_${milestone.day}`;

          if (contactDate >= pastLimit && contactDate <= futureLimit && !dismissedSet.has(contactId)) {
            contacts.push({
              contactId,
              treatmentId: treatment.id,
              patientId: treatment.patient.id,
              patientName: treatment.patient.fullName,
              guardianPhone: treatment.patient.guardian?.phonePrimary,
              guardianName: treatment.patient.guardian?.fullName,
              doctorName: treatment.doctor?.name,
              contactDate,
              // March 2026: render variables so the dashboard popup shows resolved text.
              message: renderTemplate(milestone.message, treatmentVars),
              messageRaw: milestone.message,
              protocolName: treatment.protocol.name,
            });
          }
        });
      }

      // Per-dose extra messages: dispatched on the application date itself
      const pushExtra = (cycle: number, message: string | null, suffix: string) => {
        if (!message) return;
        const dose = (treatment.doses || []).find((d: any) => d.cycleNumber === cycle);
        // Anchor the extra message to the dose's date (or, for upcoming, to projected schedule)
        const anchor = dose?.applicationDate || referenceDate;
        const contactDate = new Date(anchor);
        const contactId = `${treatment.id}_extra_${suffix}`;

        if (contactDate >= pastLimit && contactDate <= futureLimit && !dismissedSet.has(contactId)) {
          contacts.push({
            contactId,
            treatmentId: treatment.id,
            patientId: treatment.patient.id,
            patientName: treatment.patient.fullName,
            guardianPhone: treatment.patient.guardian?.phonePrimary,
            guardianName: treatment.patient.guardian?.fullName,
            doctorName: treatment.doctor?.name,
            contactDate,
            message: renderTemplate(message, treatmentVars),
            messageRaw: message,
            protocolName: treatment.protocol.name,
            isExtra: true,
            extraType: suffix,
          });
        }
      };

      pushExtra(1, treatment.protocol.dose1ExtraMessage, 'dose1');
      if (plannedDoses > 0) {
        pushExtra(plannedDoses, treatment.protocol.lastDoseExtraMessage, 'lastDose');
      }
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

    if (!contactId) {
      return res.status(400).json({ error: 'contactId is required' });
    }

    // March 2026: idempotent — if already dismissed, refresh feedback fields instead of erroring.
    // Sidebar pages (March 2026) reuse this endpoint with stable contactIds.
    const data = {
      contactId,
      feedbackText: feedback?.text || null,
      feedbackClassification: feedback?.classification || null,
      feedbackNeedsMedical: feedback?.needsMedicalResponse || null,
      feedbackUrgency: feedback?.urgency || null,
      feedbackStatus: feedback?.text ? 'pending' : null,
      origin: 'regua' as const,
    };

    const dismissed = await prisma.dismissedLog.upsert({
      where: { contactId },
      update: data,
      create: data,
    });

    sendCreated(res, dismissed);
  } catch (error) {
    next(error);
  }
};

// Create manual contact registration (not from regua)
export const createManualContact = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { patientId, patientName, patientPhone, message, feedback } = req.body;

    if (!patientId || !patientName) {
      return res.status(400).json({ error: 'Patient ID and name are required' });
    }

    // Generate unique contactId for manual entries
    const timestamp = Date.now();
    const contactId = `manual_${patientId}_${timestamp}`;

    const dismissed = await prisma.dismissedLog.create({
      data: {
        contactId,
        origin: 'manual',
        patientId,
        patientName,
        patientPhone: patientPhone || null,
        manualMessage: message || null,
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
