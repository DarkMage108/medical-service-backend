import { Request, Response, NextFunction } from 'express';
import prisma from '../utils/prisma.js';
import { NotFoundError, BadRequestError } from '../utils/errors.js';
import { sendSuccess, sendPaginated, sendCreated, sendNoContent } from '../utils/response.js';

export const getPatients = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { search, diagnosis, active, page = '1', limit = '20' } = req.query;

    const pageNum = parseInt(page as string, 10);
    const limitNum = Math.min(parseInt(limit as string, 10), 100);
    const skip = (pageNum - 1) * limitNum;

    const where: any = {};

    if (search) {
      const searchStr = search as string;
      where.OR = [
        { fullName: { contains: searchStr, mode: 'insensitive' } },
        { guardian: { phonePrimary: { contains: searchStr.replace(/\D/g, '') } } },
        { guardian: { phoneSecondary: { contains: searchStr.replace(/\D/g, '') } } },
      ];
    }

    if (diagnosis) {
      where.mainDiagnosis = { contains: diagnosis as string, mode: 'insensitive' };
    }

    if (active !== undefined) {
      where.active = active === 'true';
    }

    const [patients, total] = await Promise.all([
      prisma.patient.findMany({
        where,
        include: {
          guardian: {
            select: {
              id: true,
              fullName: true,
              phonePrimary: true,
              phoneSecondary: true,
              relationship: true,
            },
          },
          address: true,
          treatments: {
            where: { status: 'ONGOING' },
            include: {
              protocol: { select: { frequencyDays: true } },
              doses: {
                orderBy: { applicationDate: 'asc' },
                select: { status: true, applicationDate: true, cycleNumber: true },
              },
            },
          },
        },
        skip,
        take: limitNum,
        orderBy: { fullName: 'asc' },
      }),
      prisma.patient.count({ where }),
    ]);

    // Calculate adherence level for each patient based on SCHEDULED doses from protocol
    // Rules: Sem atraso = BOA, <30 dias de atraso = ATRASADO, >30 dias de atraso = ABANDONO
    // IMPORTANT: Delay is calculated from SCHEDULED date (startDate + frequencyDays * cycleNumber)
    // NOT from the date the dose was added in the system
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const patientsWithAdherence = patients.map((patient: any) => {
      let adherenceLevel: string | null = null;

      if (patient.treatments && patient.treatments.length > 0) {
        let maxDelayDays = 0;
        let hasOngoingTreatment = false;
        let hasOverdueDose = false;

        patient.treatments.forEach((treatment: any) => {
          if (treatment.status === 'ONGOING') {
            hasOngoingTreatment = true;
            const doses = treatment.doses || [];
            const frequencyDays = treatment.protocol?.frequencyDays || 28;

            // Parse start date correctly to avoid timezone issues
            const startDateStr = treatment.startDate.toISOString ?
              treatment.startDate.toISOString() :
              treatment.startDate;
            const startDateOnly = startDateStr.split('T')[0];
            const [startYear, startMonth, startDay] = startDateOnly.split('-').map(Number);
            const startDate = new Date(startYear, startMonth - 1, startDay);

            // Count applied doses vs planned doses
            const appliedCount = doses.filter((d: any) => d.status === 'APPLIED').length;
            const plannedCount = treatment.plannedDosesBeforeConsult || 0;

            // If all planned doses are applied, treatment is complete - no delay
            if (plannedCount > 0 && appliedCount >= plannedCount) {
              return; // This treatment is complete, skip delay calculation
            }

            // Check each planned dose based on SCHEDULED date from protocol
            for (let i = 0; i < plannedCount; i++) {
              const cycleNumber = i + 1;

              // Calculate SCHEDULED date: Dose 1 = startDate, Dose 2 = startDate + frequencyDays, etc.
              const scheduledDate = new Date(startDate);
              if (i > 0) {
                scheduledDate.setDate(scheduledDate.getDate() + frequencyDays * i);
              }

              // Check if scheduled date has passed
              const daysUntilScheduled = Math.floor((scheduledDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

              if (daysUntilScheduled < 0) {
                // Scheduled date has passed - check if dose was applied
                const existingDose = doses.find((d: any) => d.cycleNumber === cycleNumber);

                if (!existingDose || existingDose.status !== 'APPLIED') {
                  // This dose is overdue
                  hasOverdueDose = true;
                  const delayDays = Math.abs(daysUntilScheduled);

                  if (delayDays > maxDelayDays) {
                    maxDelayDays = delayDays;
                  }
                  break; // Only count the first overdue dose per treatment
                }
              }
            }
          }
        });

        // Classify adherence based on delay from SCHEDULED doses
        if (hasOngoingTreatment) {
          if (!hasOverdueDose) {
            adherenceLevel = 'BOA';
          } else if (maxDelayDays > 30) {
            adherenceLevel = 'ABANDONO';
          } else if (maxDelayDays > 0) {
            adherenceLevel = 'ATRASADO';
          } else {
            adherenceLevel = 'BOA';
          }
        }
      }

      // Remove treatments from response to keep it lean
      const { treatments, ...patientData } = patient;
      return { ...patientData, adherenceLevel };
    });

    sendPaginated(res, patientsWithAdherence, {
      total,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(total / limitNum),
    });
  } catch (error) {
    next(error);
  }
};

export const getPatient = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const patient = await prisma.patient.findUnique({
      where: { id },
      include: {
        guardian: true,
        address: true,
        treatments: {
          include: {
            protocol: {
              select: {
                id: true,
                name: true,
                frequencyDays: true,
                category: true,
              },
            },
          },
          orderBy: { createdAt: 'desc' },
        },
        consentDocuments: {
          orderBy: { uploadDate: 'desc' },
        },
      },
    });

    if (!patient) {
      throw new NotFoundError('Patient not found');
    }

    sendSuccess(res, patient);
  } catch (error) {
    next(error);
  }
};

export const createPatient = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { fullName, birthDate, gender, mainDiagnosis, clinicalNotes, guardian, address } = req.body;

    if (!fullName || !mainDiagnosis) {
      throw new BadRequestError('Full name and main diagnosis are required');
    }

    if (!birthDate) {
      throw new BadRequestError('Birth date is required');
    }

    if (!gender) {
      throw new BadRequestError('Gender is required');
    }

    if (!guardian || !guardian.fullName || !guardian.phonePrimary) {
      throw new BadRequestError('Guardian name and phone are required');
    }

    // Validate gender enum
    const validGenders = ['M', 'F', 'OTHER'];
    if (!validGenders.includes(gender)) {
      throw new BadRequestError('Invalid gender value. Must be M, F, or OTHER');
    }

    const patient = await prisma.patient.create({
      data: {
        fullName,
        birthDate: new Date(birthDate),
        gender,
        mainDiagnosis,
        clinicalNotes: clinicalNotes || null,
        active: true,
        guardian: {
          create: {
            fullName: guardian.fullName,
            phonePrimary: guardian.phonePrimary.replace(/\D/g, ''),
            phoneSecondary: guardian.phoneSecondary?.replace(/\D/g, '') || null,
            email: guardian.email || null,
            relationship: guardian.relationship || null,
          },
        },
        ...(address && address.street && {
          address: {
            create: {
              street: address.street,
              number: address.number,
              complement: address.complement || null,
              condominium: address.condominium || null,
              referencePoint: address.referencePoint || null,
              neighborhood: address.neighborhood,
              city: address.city,
              state: address.state,
              zipCode: address.zipCode?.replace(/\D/g, ''),
            },
          },
        }),
      },
      include: {
        guardian: true,
        address: true,
      },
    });

    sendCreated(res, patient);
  } catch (error) {
    next(error);
  }
};

export const updatePatient = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { fullName, birthDate, gender, mainDiagnosis, clinicalNotes, active } = req.body;

    const updateData: any = {};

    if (fullName !== undefined) updateData.fullName = fullName;
    if (birthDate !== undefined) updateData.birthDate = birthDate ? new Date(birthDate) : null;
    if (gender !== undefined) updateData.gender = gender;
    if (mainDiagnosis !== undefined) updateData.mainDiagnosis = mainDiagnosis;
    if (clinicalNotes !== undefined) updateData.clinicalNotes = clinicalNotes;
    if (active !== undefined) updateData.active = active;

    const patient = await prisma.patient.update({
      where: { id },
      data: updateData,
      include: {
        guardian: true,
        address: true,
      },
    });

    sendSuccess(res, patient);
  } catch (error) {
    next(error);
  }
};

export const deletePatient = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    await prisma.patient.delete({
      where: { id },
    });

    sendNoContent(res);
  } catch (error) {
    next(error);
  }
};

export const recalculatePatientStatus = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const treatments = await prisma.treatment.findMany({
      where: { patientId: id },
      select: { status: true },
    });

    const isActive = treatments.some(
      (t: { status: string }) => t.status === 'ONGOING' || t.status === 'EXTERNAL'
    );

    const patient = await prisma.patient.update({
      where: { id },
      data: { active: isActive },
      select: { id: true, active: true },
    });

    sendSuccess(res, patient);
  } catch (error) {
    next(error);
  }
};

// Guardian endpoints
export const getGuardian = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { patientId } = req.params;

    const guardian = await prisma.guardian.findUnique({
      where: { patientId },
    });

    if (!guardian) {
      throw new NotFoundError('Guardian not found');
    }

    sendSuccess(res, guardian);
  } catch (error) {
    next(error);
  }
};

export const updateGuardian = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { patientId } = req.params;
    const { fullName, phonePrimary, phoneSecondary, email, relationship } = req.body;

    const guardian = await prisma.guardian.update({
      where: { patientId },
      data: {
        ...(fullName && { fullName }),
        ...(phonePrimary && { phonePrimary: phonePrimary.replace(/\D/g, '') }),
        ...(phoneSecondary !== undefined && { phoneSecondary: phoneSecondary?.replace(/\D/g, '') }),
        ...(email !== undefined && { email }),
        ...(relationship && { relationship }),
      },
    });

    sendSuccess(res, guardian);
  } catch (error) {
    next(error);
  }
};

// Address endpoints
export const getAddress = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { patientId } = req.params;

    const address = await prisma.address.findUnique({
      where: { patientId },
    });

    if (!address) {
      throw new NotFoundError('Address not found');
    }

    sendSuccess(res, address);
  } catch (error) {
    next(error);
  }
};

export const upsertAddress = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { patientId } = req.params;
    const { street, number, complement, condominium, referencePoint, neighborhood, city, state, zipCode } = req.body;

    if (!street || !number || !neighborhood || !city || !state || !zipCode) {
      throw new BadRequestError('All address fields are required');
    }

    const address = await prisma.address.upsert({
      where: { patientId },
      update: {
        street,
        number,
        complement: complement || null,
        condominium: condominium || null,
        referencePoint: referencePoint || null,
        neighborhood,
        city,
        state,
        zipCode: zipCode.replace(/\D/g, ''),
      },
      create: {
        patientId,
        street,
        number,
        complement: complement || null,
        condominium: condominium || null,
        referencePoint: referencePoint || null,
        neighborhood,
        city,
        state,
        zipCode: zipCode.replace(/\D/g, ''),
      },
    });

    sendSuccess(res, address);
  } catch (error) {
    next(error);
  }
};

export const deleteAddress = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { patientId } = req.params;

    await prisma.address.delete({
      where: { patientId },
    });

    sendNoContent(res);
  } catch (error) {
    next(error);
  }
};

// Document endpoints
export const getDocuments = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { patientId } = req.params;

    const documents = await prisma.consentDocument.findMany({
      where: { patientId },
      orderBy: { uploadDate: 'desc' },
    });

    sendSuccess(res, { data: documents });
  } catch (error) {
    next(error);
  }
};

export const uploadDocument = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { patientId } = req.params;
    const { fileName, fileType, fileUrl, status } = req.body;

    // Allow creating a document with just a status (SIGNED/REFUSED) without file
    // Or with a file (fileName, fileType, fileUrl required together)
    const hasFile = fileName && fileType && fileUrl;
    const hasStatus = status && (status === 'SIGNED' || status === 'REFUSED');

    if (!hasFile && !hasStatus) {
      throw new BadRequestError('Either file (name, type, URL) or status (SIGNED/REFUSED) is required');
    }

    const document = await prisma.consentDocument.create({
      data: {
        patientId,
        fileName: fileName || null,
        fileType: fileType || null,
        fileUrl: fileUrl || null,
        status: status || 'PENDING',
        uploadedBy: req.user!.id,
      },
    });

    sendCreated(res, document);
  } catch (error) {
    next(error);
  }
};

export const deleteDocument = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { documentId } = req.params;

    await prisma.consentDocument.delete({
      where: { id: documentId },
    });

    sendNoContent(res);
  } catch (error) {
    next(error);
  }
};
