import { Request, Response, NextFunction } from 'express';
import prisma from '../utils/prisma.js';
import { sendSuccess } from '../utils/response.js';

export const getDispenseLogs = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { patientId, medicationName, fromDate, toDate } = req.query;

    const where: any = {};

    if (patientId) where.patientId = patientId;
    if (medicationName) {
      where.medicationName = { contains: medicationName as string, mode: 'insensitive' };
    }
    if (fromDate) where.date = { ...where.date, gte: new Date(fromDate as string) };
    if (toDate) where.date = { ...where.date, lte: new Date(toDate as string) };

    const logs = await prisma.dispenseLog.findMany({
      where,
      include: {
        patient: {
          select: { id: true, fullName: true },
        },
        inventoryItem: {
          select: { id: true, lotNumber: true },
        },
      },
      orderBy: { date: 'desc' },
    });

    sendSuccess(res, { data: logs });
  } catch (error) {
    next(error);
  }
};

export const getDispenseReport = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { period = 'monthly', year } = req.query;

    const currentYear = year ? parseInt(year as string, 10) : new Date().getFullYear();
    const startDate = new Date(currentYear, 0, 1);
    const endDate = new Date(currentYear, 11, 31);

    const logs = await prisma.dispenseLog.findMany({
      where: {
        date: {
          gte: startDate,
          lte: endDate,
        },
      },
      orderBy: { date: 'asc' },
    });

    // Group by medication and period
    const report: Record<string, { medicationName: string; periods: Record<string, number>; total: number }> = {};

    logs.forEach((log) => {
      const date = new Date(log.date);
      let periodKey: string;

      if (period === 'quarterly') {
        const quarter = Math.floor(date.getMonth() / 3) + 1;
        periodKey = `${currentYear}-Q${quarter}`;
      } else if (period === 'yearly') {
        periodKey = `${currentYear}`;
      } else {
        // monthly
        periodKey = `${currentYear}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      }

      if (!report[log.medicationName]) {
        report[log.medicationName] = {
          medicationName: log.medicationName,
          periods: {},
          total: 0,
        };
      }

      if (!report[log.medicationName].periods[periodKey]) {
        report[log.medicationName].periods[periodKey] = 0;
      }

      report[log.medicationName].periods[periodKey] += log.quantity;
      report[log.medicationName].total += log.quantity;
    });

    // Convert to array format
    const data = Object.values(report).map((item) => ({
      medicationName: item.medicationName,
      periods: Object.entries(item.periods).map(([period, quantity]) => ({
        period,
        quantity,
      })),
      total: item.total,
    }));

    sendSuccess(res, { data });
  } catch (error) {
    next(error);
  }
};
