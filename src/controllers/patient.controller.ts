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
          address: {
            select: {
              city: true,
              state: true,
            },
          },
          treatments: {
            where: { status: 'ONGOING' },
            include: {
              protocol: { select: { frequencyDays: true } },
              doses: {
                orderBy: { applicationDate: 'asc' },
                select: { status: true, applicationDate: true },
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

    // Calculate adherence level for each patient
    const today = new Date();
    const patientsWithAdherence = patients.map((patient: any) => {
      let adherenceLevel: string | null = null;

      if (patient.treatments && patient.treatments.length > 0) {
        // Aggregate metrics across all treatments
        let totalMissed = 0;
        let totalSignificantDelays = 0;
        let maxDaysSinceLast = 0;
        let hasOngoingTreatment = false;

        patient.treatments.forEach((treatment: any) => {
          if (treatment.status === 'ONGOING') {
            hasOngoingTreatment = true;
            const doses = treatment.doses || [];
            const frequencyDays = treatment.protocol?.frequencyDays || 28;

            let lastApplicationDate: Date | null = null;

            doses.forEach((dose: any, index: number) => {
              if (dose.status === 'NOT_ACCEPTED') {
                totalMissed++;
              }

              if (dose.status === 'APPLIED' && index > 0) {
                const prevDose = doses[index - 1];
                if (prevDose.status === 'APPLIED') {
                  const prevDate = new Date(prevDose.applicationDate);
                  const expectedDate = new Date(prevDate);
                  expectedDate.setDate(expectedDate.getDate() + frequencyDays);
                  const actualDate = new Date(dose.applicationDate);
                  const delayDays = Math.max(0, Math.floor((actualDate.getTime() - expectedDate.getTime()) / (1000 * 60 * 60 * 24)));
                  if (delayDays > 3) {
                    totalSignificantDelays++;
                  }
                }
              }

              if (dose.status === 'APPLIED') {
                lastApplicationDate = new Date(dose.applicationDate);
              }
            });

            if (lastApplicationDate !== null) {
              const lastDate = lastApplicationDate as Date;
              const daysSinceLast = Math.floor((today.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24));
              if (daysSinceLast > maxDaysSinceLast) {
                maxDaysSinceLast = daysSinceLast;
              }
            }
          }
        });

        // Classify adherence
        if (hasOngoingTreatment) {
          if (maxDaysSinceLast > 30) {
            adherenceLevel = 'ABANDONO';
          } else if (totalMissed > 3 || totalSignificantDelays > 3) {
            adherenceLevel = 'BAIXA';
          } else if (totalSignificantDelays > 0 || totalMissed > 0) {
            adherenceLevel = 'MODERADA';
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

    if (!guardian || !guardian.fullName || !guardian.phonePrimary) {
      throw new BadRequestError('Guardian name and phone are required');
    }

    // Validate gender enum if provided
    const validGenders = ['M', 'F', 'OTHER'];
    const validGender = gender && validGenders.includes(gender) ? gender : null;

    const patient = await prisma.patient.create({
      data: {
        fullName,
        birthDate: birthDate ? new Date(birthDate) : null,
        gender: validGender,
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
              complement: address.complement,
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
    const { street, number, complement, neighborhood, city, state, zipCode } = req.body;

    if (!street || !number || !neighborhood || !city || !state || !zipCode) {
      throw new BadRequestError('All address fields are required');
    }

    const address = await prisma.address.upsert({
      where: { patientId },
      update: {
        street,
        number,
        complement,
        neighborhood,
        city,
        state,
        zipCode: zipCode.replace(/\D/g, ''),
      },
      create: {
        patientId,
        street,
        number,
        complement,
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
    const { fileName, fileType, fileUrl } = req.body;

    if (!fileName || !fileType || !fileUrl) {
      throw new BadRequestError('File name, type, and URL are required');
    }

    const document = await prisma.consentDocument.create({
      data: {
        patientId,
        fileName,
        fileType,
        fileUrl,
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
