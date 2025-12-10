import { Request, Response, NextFunction } from 'express';
import prisma from '../utils/prisma.js';
import { NotFoundError } from '../utils/errors.js';
import { sendSuccess, sendNoContent } from '../utils/response.js';

export const getPurchaseRequests = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { status } = req.query;

    const where: any = {};
    if (status) where.status = status;

    const requests = await prisma.purchaseRequest.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });

    sendSuccess(res, { data: requests });
  } catch (error) {
    next(error);
  }
};

export const checkPurchaseTriggers = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const today = new Date();
    const next10Days = new Date();
    next10Days.setDate(today.getDate() + 10);

    // Get active treatments with upcoming doses
    const activeTreatments = await prisma.treatment.findMany({
      where: { status: 'ONGOING' },
      include: {
        protocol: {
          select: { medicationType: true, frequencyDays: true },
        },
        doses: {
          orderBy: { applicationDate: 'desc' },
          take: 1,
        },
      },
    });

    // Calculate demand per medication
    const demandMap: Record<string, number> = {};

    activeTreatments.forEach((treatment: any) => {
      if (!treatment.protocol.medicationType) return;

      const lastDose = treatment.doses[0];
      let nextDoseDate: Date;

      if (lastDose) {
        nextDoseDate = new Date(lastDose.applicationDate);
        nextDoseDate.setDate(nextDoseDate.getDate() + treatment.protocol.frequencyDays);
      } else {
        nextDoseDate = new Date(treatment.startDate);
      }

      // If next dose is within 10 days, add to demand
      if (nextDoseDate >= today && nextDoseDate <= next10Days) {
        const medName = treatment.protocol.medicationType;
        demandMap[medName] = (demandMap[medName] || 0) + 1;
      }
    });

    // Get current stock by medication
    const inventory = await prisma.inventoryItem.findMany({
      where: {
        active: true,
        quantity: { gt: 0 },
        expiryDate: { gt: today },
      },
    });

    const stockMap: Record<string, number> = {};
    inventory.forEach((item: any) => {
      stockMap[item.medicationName] = (stockMap[item.medicationName] || 0) + item.quantity;
    });

    // Check existing pending requests
    const existingRequests = await prisma.purchaseRequest.findMany({
      where: { status: 'PENDING' },
    });

    const existingMedications = new Set(existingRequests.map((r: any) => r.medicationName));

    // Create new requests where needed
    const created: any[] = [];

    for (const [medicationName, demand] of Object.entries(demandMap)) {
      const currentStock = stockMap[medicationName] || 0;

      // If stock is less than or equal to predicted demand and no pending request exists
      if (currentStock <= demand && !existingMedications.has(medicationName)) {
        const newRequest = await prisma.purchaseRequest.create({
          data: {
            medicationName,
            predictedConsumption10Days: demand,
            currentStock,
            suggestedQuantity: demand * 3, // Suggest 3x demand
            status: 'PENDING',
          },
        });
        created.push(newRequest);
      }
    }

    sendSuccess(res, {
      created,
      message: `${created.length} new purchase request(s) created`,
    });
  } catch (error) {
    next(error);
  }
};

export const updatePurchaseRequest = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const request = await prisma.purchaseRequest.update({
      where: { id },
      data: { status },
    });

    sendSuccess(res, request);
  } catch (error) {
    next(error);
  }
};

export const deletePurchaseRequest = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    await prisma.purchaseRequest.delete({
      where: { id },
    });

    sendNoContent(res);
  } catch (error) {
    next(error);
  }
};
