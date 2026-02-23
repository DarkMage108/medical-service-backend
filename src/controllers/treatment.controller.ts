import { Request, Response, NextFunction } from 'express';
import prisma from '../utils/prisma.js';
import { NotFoundError, BadRequestError } from '../utils/errors.js';
import { sendSuccess, sendPaginated, sendCreated, sendNoContent } from '../utils/response.js';

export const getTreatments = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { patientId, status, protocolId, page = '1', limit = '20' } = req.query;

    const pageNum = parseInt(page as string, 10);
    const limitNum = Math.min(parseInt(limit as string, 10), 1000);
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
    const { status, nextConsultationDate, observations, plannedDosesBeforeConsult, startDate } = req.body;

    const existingTreatment = await prisma.treatment.findUnique({
      where: { id },
      include: {
        protocol: { select: { frequencyDays: true } },
      },
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
        ...(startDate && { startDate: new Date(startDate) }),
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

    // When startDate changes, recalculate all PENDING doses' scheduledDate
    if (startDate) {
      const newStartDate = new Date(startDate);
      const frequencyDays = existingTreatment.protocol.frequencyDays || 28;

      // Get all doses for this treatment ordered by cycleNumber
      const allDoses = await prisma.dose.findMany({
        where: { treatmentId: id },
        orderBy: { cycleNumber: 'asc' },
      });

      // Find the last applied dose to chain from
      const lastAppliedDose = [...allDoses]
        .filter((d: any) => d.status === 'APPLIED' || d.status === 'APPLIED_LATE')
        .sort((a: any, b: any) => b.cycleNumber - a.cycleNumber)[0];

      // Recalculate PENDING doses
      let previousDate: Date;
      let previousCycle: number;

      if (lastAppliedDose) {
        // Chain from the last applied dose
        previousDate = new Date(lastAppliedDose.applicationDate);
        previousCycle = lastAppliedDose.cycleNumber;
      } else {
        // No applied doses, chain from new startDate
        previousDate = newStartDate;
        previousCycle = 0;
      }

      const pendingDoses = allDoses
        .filter((d: any) => d.status === 'PENDING' && d.cycleNumber > previousCycle)
        .sort((a: any, b: any) => a.cycleNumber - b.cycleNumber);

      for (const dose of pendingDoses) {
        let newScheduledDate: Date;
        if (dose.cycleNumber === 1 && !lastAppliedDose) {
          // Dose 1 always matches startDate
          newScheduledDate = newStartDate;
        } else {
          newScheduledDate = new Date(previousDate);
          newScheduledDate.setDate(newScheduledDate.getDate() + frequencyDays);
        }

        await prisma.dose.update({
          where: { id: dose.id },
          data: {
            scheduledDate: newScheduledDate,
            applicationDate: newScheduledDate, // Keep in sync for PENDING doses
          },
        });

        previousDate = newScheduledDate;
      }
    }

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

// Generate Adherence Report for a treatment
export const getAdherenceReport = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const treatment = await prisma.treatment.findUnique({
      where: { id },
      include: {
        patient: {
          select: {
            id: true,
            fullName: true,
            birthDate: true,
            mainDiagnosis: true,
          },
        },
        protocol: {
          select: {
            id: true,
            name: true,
            frequencyDays: true,
            medicationType: true,
            goal: true,
          },
        },
        doses: {
          orderBy: { applicationDate: 'asc' },
        },
      },
    });

    if (!treatment) {
      throw new NotFoundError('Treatment not found');
    }

    const doses = treatment.doses;
    const frequencyDays = treatment.protocol.frequencyDays;
    const today = new Date();

    // Calculate adherence metrics
    let totalDelayDays = 0;
    let missedDoses = 0;
    let significantDelays = 0; // delays > 3 days
    let lastApplicationDate: Date | null = null;
    let daysSinceLastApplication = 0;

    doses.forEach((dose: any, index: number) => {
      if (dose.status === 'NOT_ACCEPTED') {
        missedDoses++;
        return;
      }

      if ((dose.status === 'APPLIED' || dose.status === 'APPLIED_LATE') && index > 0) {
        // Calculate expected date based on previous dose
        const prevDose = doses[index - 1];
        if ((prevDose.status === 'APPLIED' || prevDose.status === 'APPLIED_LATE')) {
          const prevDate = new Date(prevDose.applicationDate);
          const expectedDate = new Date(prevDate);
          expectedDate.setDate(expectedDate.getDate() + frequencyDays);

          const actualDate = new Date(dose.applicationDate);
          const delayMs = actualDate.getTime() - expectedDate.getTime();
          const delayDays = Math.max(0, Math.floor(delayMs / (1000 * 60 * 60 * 24)));

          if (delayDays > 0) {
            totalDelayDays += delayDays;
            if (delayDays > 3) {
              significantDelays++;
            }
          }
        }
      }

      if ((dose.status === 'APPLIED' || dose.status === 'APPLIED_LATE')) {
        lastApplicationDate = new Date(dose.applicationDate);
      }
    });

    // Calculate days since last application
    if (lastApplicationDate !== null) {
      const lastDate = lastApplicationDate as Date;
      daysSinceLastApplication = Math.floor(
        (today.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24)
      );
    }

    // Check for pending doses that are overdue
    const pendingDoses = doses.filter((d: any) => d.status === 'PENDING');
    let pendingOverdueDays = 0;
    pendingDoses.forEach((dose: any) => {
      const doseDate = new Date(dose.applicationDate);
      if (doseDate < today) {
        const overdue = Math.floor((today.getTime() - doseDate.getTime()) / (1000 * 60 * 60 * 24));
        pendingOverdueDays += overdue;
      }
    });

    // Determine adherence classification
    let adherenceClassification: string;
    let adherenceDescription: string;

    const treatmentStatus = treatment.status;
    const totalDoses = doses.length;
    const appliedDoses = doses.filter((d: any) => (d.status === 'APPLIED' || d.status === 'APPLIED_LATE')).length;

    if (treatmentStatus === 'REFUSED' || treatmentStatus === 'SUSPENDED') {
      adherenceClassification = 'Abandono confirmado';
      adherenceDescription = 'Tratamento interrompido ou recusado pelo paciente/responsável.';
    } else if (daysSinceLastApplication > 30 && treatmentStatus === 'ONGOING') {
      adherenceClassification = 'Possível abandono';
      adherenceDescription = `Mais de 30 dias sem aplicação do medicamento (${daysSinceLastApplication} dias desde a última dose).`;
    } else if (missedDoses > 3 || significantDelays > 3) {
      adherenceClassification = 'Baixa adesão';
      adherenceDescription = `Múltiplas falhas identificadas: ${missedDoses} doses não realizadas, ${significantDelays} atrasos superiores a 3 dias.`;
    } else if (significantDelays > 0 || missedDoses > 0) {
      adherenceClassification = 'Adesão parcial';
      adherenceDescription = `Algumas irregularidades: ${missedDoses} dose(s) esquecida(s), ${significantDelays} atraso(s) superior(es) a 3 dias.`;
    } else {
      adherenceClassification = 'Boa adesão';
      adherenceDescription = 'Paciente segue o tratamento conforme previsto, sem atrasos relevantes ou falhas significativas.';
    }

    // Format dates
    const formatDate = (date: Date | string | null) => {
      if (!date) return '-';
      const d = new Date(date);
      return d.toLocaleDateString('pt-BR');
    };

    // Generate dose details for report
    const doseDetails: string[] = [];
    doses.forEach((dose: any, index: number) => {
      if ((dose.status === 'APPLIED' || dose.status === 'APPLIED_LATE') && index > 0) {
        const prevDose = doses[index - 1];
        if ((prevDose.status === 'APPLIED' || prevDose.status === 'APPLIED_LATE')) {
          const prevDate = new Date(prevDose.applicationDate);
          const expectedDate = new Date(prevDate);
          expectedDate.setDate(expectedDate.getDate() + frequencyDays);
          const actualDate = new Date(dose.applicationDate);
          const delayMs = actualDate.getTime() - expectedDate.getTime();
          const delayDays = Math.max(0, Math.floor(delayMs / (1000 * 60 * 60 * 24)));
          if (delayDays > 0) {
            doseDetails.push(`- Dose ${dose.cycleNumber} (${formatDate(actualDate)}): Aplicada com ${delayDays} dias de atraso em relacao ao ciclo.`);
          }
        }
      }
      if (dose.status === 'NOT_ACCEPTED') {
        doseDetails.push(`- Dose ${dose.cycleNumber} (${formatDate(dose.applicationDate)}): Nao realizada.`);
      }
    });

    // Generate report text - simpler format
    const reportText = `RELATORIO DE ADESAO AO TRATAMENTO

1. IDENTIFICACAO DO PACIENTE
Nome: ${treatment.patient.fullName}
Data de Inicio: ${formatDate(treatment.startDate)}
Medicamento: ${treatment.protocol.medicationType || treatment.protocol.name}
Frequencia: A cada ${frequencyDays} dias
Dose Prescrita: Vide posologia (${treatment.patient.mainDiagnosis || 'Tratamento'} - ${treatment.protocol.name === treatment.protocol.medicationType ? 'Mensal' : treatment.protocol.name})

2. AVALIACAO DA ADESAO
Classificacao: ${adherenceClassification}: ${adherenceDescription.toLowerCase()}

3. DETALHAMENTO DAS FALHAS / OBSERVACOES
${doseDetails.length > 0 ? doseDetails.join('\n') : '- Nenhuma falha ou atraso significativo registrado.'}
${treatment.observations ? `\nObservacoes: ${treatment.observations}` : ''}`;

    // Also keep detailed metrics for the API response

    sendSuccess(res, {
      treatmentId: treatment.id,
      patientName: treatment.patient.fullName,
      adherenceClassification,
      adherenceDescription,
      metrics: {
        totalDoses,
        appliedDoses,
        missedDoses,
        totalDelayDays,
        significantDelays,
        daysSinceLastApplication,
        pendingOverdueDays,
      },
      reportText,
      generatedAt: today.toISOString(),
    });
  } catch (error) {
    next(error);
  }
};
