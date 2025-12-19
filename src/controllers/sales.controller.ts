import { Request, Response, NextFunction } from 'express';
import prisma from '../utils/prisma.js';
import { NotFoundError, BadRequestError } from '../utils/errors.js';
import { sendSuccess, sendCreated, sendNoContent } from '../utils/response.js';
import { DoseStatus, PaymentStatus } from '@prisma/client';

// Get all sales with filters
export const getSales = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { startDate, endDate, paymentMethod, patientId } = req.query;

    const where: any = {};

    if (startDate || endDate) {
      where.saleDate = {};
      if (startDate) where.saleDate.gte = new Date(startDate as string);
      if (endDate) where.saleDate.lte = new Date(endDate as string);
    }

    if (paymentMethod) {
      where.paymentMethod = paymentMethod;
    }

    if (patientId) {
      where.patientId = patientId;
    }

    const sales = await prisma.sale.findMany({
      where,
      include: {
        patient: {
          select: { id: true, fullName: true }
        },
        inventoryItem: {
          select: { id: true, medicationName: true, lotNumber: true }
        },
        dose: {
          select: { id: true, applicationDate: true, cycleNumber: true }
        }
      },
      orderBy: { saleDate: 'desc' }
    });

    sendSuccess(res, { data: sales });
  } catch (error) {
    next(error);
  }
};

// Get a single sale
export const getSale = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const sale = await prisma.sale.findUnique({
      where: { id },
      include: {
        patient: true,
        inventoryItem: true,
        dose: true
      }
    });

    if (!sale) {
      throw new NotFoundError('Sale not found');
    }

    sendSuccess(res, sale);
  } catch (error) {
    next(error);
  }
};

// Get pending sales (doses applied + paid but not registered in CAIXA)
export const getPendingSales = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Find doses that are APPLIED and PAID but don't have a sale record
    // and have an inventory lot linked
    const pendingDoses = await prisma.dose.findMany({
      where: {
        status: DoseStatus.APPLIED,
        paymentStatus: PaymentStatus.PAID,
        inventoryLotId: { not: null },
        sale: null  // No sale record yet
      },
      include: {
        treatment: {
          include: {
            patient: {
              select: { id: true, fullName: true }
            }
          }
        },
        inventoryItem: {
          select: {
            id: true,
            medicationName: true,
            lotNumber: true,
            unitCost: true,
            baseSalePrice: true,
            defaultCommission: true,
            defaultTax: true,
            defaultDelivery: true,
            defaultOther: true
          }
        }
      },
      orderBy: { applicationDate: 'asc' }  // Oldest first
    });

    // Transform to a cleaner format
    const pending = pendingDoses.map(dose => ({
      doseId: dose.id,
      applicationDate: dose.applicationDate,
      cycleNumber: dose.cycleNumber,
      patientId: dose.treatment.patient.id,
      patientName: dose.treatment.patient.fullName,
      inventoryItem: dose.inventoryItem,
      // Default values from lot
      defaults: dose.inventoryItem ? {
        salePrice: dose.inventoryItem.baseSalePrice || 0,
        unitCost: dose.inventoryItem.unitCost || 0,
        commission: dose.inventoryItem.defaultCommission || 0,
        tax: dose.inventoryItem.defaultTax || 0,
        delivery: dose.inventoryItem.defaultDelivery || 0,
        other: dose.inventoryItem.defaultOther || 0
      } : null
    }));

    sendSuccess(res, { data: pending, count: pending.length });
  } catch (error) {
    next(error);
  }
};

// Create a sale (register financial transaction)
export const createSale = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const {
      doseId,
      salePrice,
      commission = 0,
      tax = 0,
      delivery = 0,
      other = 0,
      paymentMethod
    } = req.body;

    if (!doseId || salePrice === undefined || !paymentMethod) {
      throw new BadRequestError('doseId, salePrice, and paymentMethod are required');
    }

    // Verify dose exists and has inventory linked
    const dose = await prisma.dose.findUnique({
      where: { id: doseId },
      include: {
        treatment: {
          include: {
            patient: true
          }
        },
        inventoryItem: true,
        sale: true
      }
    });

    if (!dose) {
      throw new NotFoundError('Dose not found');
    }

    if (dose.sale) {
      throw new BadRequestError('This dose already has a sale registered');
    }

    if (!dose.inventoryLotId || !dose.inventoryItem) {
      throw new BadRequestError('Dose must have an inventory lot linked');
    }

    // Get unit cost from inventory item
    const unitCost = dose.inventoryItem.unitCost || 0;

    // Calculate profits
    const grossProfit = salePrice - unitCost;
    const opex = commission + tax + delivery + other;
    const netProfit = grossProfit - opex;

    // Create sale record
    const sale = await prisma.sale.create({
      data: {
        doseId,
        inventoryItemId: dose.inventoryLotId,
        patientId: dose.treatment.patientId,
        salePrice,
        unitCost,
        commission,
        tax,
        delivery,
        other,
        grossProfit,
        netProfit,
        paymentMethod
      },
      include: {
        patient: {
          select: { id: true, fullName: true }
        },
        inventoryItem: {
          select: { id: true, medicationName: true, lotNumber: true }
        }
      }
    });

    sendCreated(res, sale);
  } catch (error) {
    next(error);
  }
};

// Update a sale
export const updateSale = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const {
      salePrice,
      commission,
      tax,
      delivery,
      other,
      paymentMethod
    } = req.body;

    // Get existing sale to recalculate profits
    const existingSale = await prisma.sale.findUnique({
      where: { id }
    });

    if (!existingSale) {
      throw new NotFoundError('Sale not found');
    }

    // Calculate new profits if salePrice changed
    const newSalePrice = salePrice !== undefined ? salePrice : existingSale.salePrice;
    const newCommission = commission !== undefined ? commission : existingSale.commission;
    const newTax = tax !== undefined ? tax : existingSale.tax;
    const newDelivery = delivery !== undefined ? delivery : existingSale.delivery;
    const newOther = other !== undefined ? other : existingSale.other;

    const grossProfit = newSalePrice - existingSale.unitCost;
    const opex = newCommission + newTax + newDelivery + newOther;
    const netProfit = grossProfit - opex;

    const sale = await prisma.sale.update({
      where: { id },
      data: {
        ...(salePrice !== undefined && { salePrice }),
        ...(commission !== undefined && { commission }),
        ...(tax !== undefined && { tax }),
        ...(delivery !== undefined && { delivery }),
        ...(other !== undefined && { other }),
        ...(paymentMethod && { paymentMethod }),
        grossProfit,
        netProfit
      },
      include: {
        patient: {
          select: { id: true, fullName: true }
        },
        inventoryItem: {
          select: { id: true, medicationName: true, lotNumber: true }
        }
      }
    });

    sendSuccess(res, sale);
  } catch (error) {
    next(error);
  }
};

// Delete a sale
export const deleteSale = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    await prisma.sale.delete({
      where: { id }
    });

    sendNoContent(res);
  } catch (error) {
    next(error);
  }
};

// Get KPIs (financial summary)
export const getKPIs = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { period = 'month' } = req.query;

    // Calculate date ranges
    const now = new Date();
    let currentStart: Date;
    let currentEnd: Date = now;
    let previousStart: Date;
    let previousEnd: Date;

    switch (period) {
      case 'month':
        currentStart = new Date(now.getFullYear(), now.getMonth(), 1);
        previousStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        previousEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
        break;
      case '3months':
        currentStart = new Date(now.getFullYear(), now.getMonth() - 2, 1);
        previousStart = new Date(now.getFullYear(), now.getMonth() - 5, 1);
        previousEnd = new Date(now.getFullYear(), now.getMonth() - 2, 0, 23, 59, 59);
        break;
      case 'year':
        currentStart = new Date(now.getFullYear(), 0, 1);
        previousStart = new Date(now.getFullYear() - 1, 0, 1);
        previousEnd = new Date(now.getFullYear() - 1, 11, 31, 23, 59, 59);
        break;
      case 'all':
        currentStart = new Date(2000, 0, 1);
        previousStart = new Date(2000, 0, 1);
        previousEnd = new Date(2000, 0, 1);
        break;
      default:
        currentStart = new Date(now.getFullYear(), now.getMonth(), 1);
        previousStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        previousEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
    }

    // Get current period sales
    const currentSales = await prisma.sale.findMany({
      where: {
        saleDate: {
          gte: currentStart,
          lte: currentEnd
        }
      }
    });

    // Get previous period sales (for comparison)
    const previousSales = period !== 'all' ? await prisma.sale.findMany({
      where: {
        saleDate: {
          gte: previousStart,
          lte: previousEnd
        }
      }
    }) : [];

    // Calculate current period metrics
    const grossRevenue = currentSales.reduce((sum, s) => sum + s.salePrice, 0);
    const netProfit = currentSales.reduce((sum, s) => sum + s.netProfit, 0);
    const current = {
      grossRevenue,
      totalSales: currentSales.length,
      cmv: currentSales.reduce((sum, s) => sum + s.unitCost, 0),
      opex: currentSales.reduce((sum, s) => sum + s.commission + s.tax + s.delivery + s.other, 0),
      netProfit,
      netMargin: grossRevenue > 0 ? ((netProfit / grossRevenue) * 100).toFixed(1) : '0'
    };

    // Calculate previous period metrics
    const previous = {
      grossRevenue: previousSales.reduce((sum, s) => sum + s.salePrice, 0),
      totalSales: previousSales.length,
      cmv: previousSales.reduce((sum, s) => sum + s.unitCost, 0),
      opex: previousSales.reduce((sum, s) => sum + s.commission + s.tax + s.delivery + s.other, 0),
      netProfit: previousSales.reduce((sum, s) => sum + s.netProfit, 0)
    };

    // Calculate variations
    const variation = {
      grossRevenue: {
        value: current.grossRevenue - previous.grossRevenue,
        percent: previous.grossRevenue > 0
          ? (((current.grossRevenue - previous.grossRevenue) / previous.grossRevenue) * 100).toFixed(1)
          : null
      },
      totalSales: {
        value: current.totalSales - previous.totalSales,
        percent: previous.totalSales > 0
          ? (((current.totalSales - previous.totalSales) / previous.totalSales) * 100).toFixed(1)
          : null
      },
      netProfit: {
        value: current.netProfit - previous.netProfit,
        percent: previous.netProfit > 0
          ? (((current.netProfit - previous.netProfit) / previous.netProfit) * 100).toFixed(1)
          : null
      }
    };

    sendSuccess(res, {
      period,
      current,
      previous: period !== 'all' ? previous : null,
      variation: period !== 'all' ? variation : null
    });
  } catch (error) {
    next(error);
  }
};

// Get prices/profitability by lot
export const getLotPricing = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { sortBy = 'margin', sortOrder = 'desc' } = req.query;

    const lots = await prisma.inventoryItem.findMany({
      where: {
        active: true,
        quantity: { gt: 0 }
      },
      select: {
        id: true,
        medicationName: true,
        lotNumber: true,
        quantity: true,
        unitCost: true,
        baseSalePrice: true,
        defaultCommission: true,
        defaultTax: true,
        defaultDelivery: true,
        defaultOther: true,
        expiryDate: true
      }
    });

    // Calculate estimated profit and margin for each lot
    const lotsWithPricing = lots.map(lot => {
      const unitCost = lot.unitCost || 0;
      const salePrice = lot.baseSalePrice || 0;
      const opex = (lot.defaultCommission || 0) + (lot.defaultTax || 0) +
                   (lot.defaultDelivery || 0) + (lot.defaultOther || 0);

      const estimatedProfit = salePrice - unitCost - opex;
      const estimatedMargin = salePrice > 0
        ? ((estimatedProfit / salePrice) * 100)
        : 0;

      return {
        ...lot,
        estimatedProfit: Math.round(estimatedProfit * 100) / 100,
        estimatedMargin: Math.round(estimatedMargin * 100) / 100
      };
    });

    // Sort
    lotsWithPricing.sort((a, b) => {
      let comparison = 0;
      if (sortBy === 'margin') {
        comparison = a.estimatedMargin - b.estimatedMargin;
      } else if (sortBy === 'profit') {
        comparison = a.estimatedProfit - b.estimatedProfit;
      } else if (sortBy === 'medication') {
        comparison = a.medicationName.localeCompare(b.medicationName);
      }
      return sortOrder === 'desc' ? -comparison : comparison;
    });

    sendSuccess(res, { data: lotsWithPricing });
  } catch (error) {
    next(error);
  }
};

// Get monthly report
export const getMonthlyReport = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { year, month } = req.query;

    const targetYear = year ? parseInt(year as string) : new Date().getFullYear();
    const targetMonth = month ? parseInt(month as string) - 1 : new Date().getMonth();

    const startDate = new Date(targetYear, targetMonth, 1);
    const endDate = new Date(targetYear, targetMonth + 1, 0, 23, 59, 59);

    // Get all sales for the month
    const sales = await prisma.sale.findMany({
      where: {
        saleDate: {
          gte: startDate,
          lte: endDate
        }
      },
      include: {
        patient: {
          select: { id: true, fullName: true }
        },
        inventoryItem: {
          select: { id: true, medicationName: true, lotNumber: true }
        }
      },
      orderBy: { saleDate: 'desc' }
    });

    // Calculate summary
    const summaryGrossRevenue = sales.reduce((sum, s) => sum + s.salePrice, 0);
    const summaryNetProfit = sales.reduce((sum, s) => sum + s.netProfit, 0);
    const summary = {
      grossRevenue: summaryGrossRevenue,
      cmv: sales.reduce((sum, s) => sum + s.unitCost, 0),
      opex: sales.reduce((sum, s) => sum + s.commission + s.tax + s.delivery + s.other, 0),
      netProfit: summaryNetProfit,
      totalSales: sales.length,
      netMargin: summaryGrossRevenue > 0 ? ((summaryNetProfit / summaryGrossRevenue) * 100).toFixed(1) : '0'
    };

    // Group by payment method
    const byPaymentMethod = {
      PIX: { count: 0, total: 0 },
      CARD: { count: 0, total: 0 },
      BOLETO: { count: 0, total: 0 }
    };

    sales.forEach(sale => {
      if (byPaymentMethod[sale.paymentMethod]) {
        byPaymentMethod[sale.paymentMethod].count++;
        byPaymentMethod[sale.paymentMethod].total += sale.salePrice;
      }
    });

    sendSuccess(res, {
      year: targetYear,
      month: targetMonth + 1,
      summary,
      byPaymentMethod,
      sales
    });
  } catch (error) {
    next(error);
  }
};
