import { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/errors.js';

// Define error interface for Prisma-like errors
interface PrismaError extends Error {
  code?: string;
  meta?: { target?: string[] };
}

export const errorHandler = (
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction
) => {
  console.error('Error:', err);

  // App errors (custom)
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      error: err.name,
      message: err.message,
    });
  }

  // Prisma errors (check by name since we can't import Prisma types)
  const prismaErr = err as PrismaError;
  if (err.name === 'PrismaClientKnownRequestError' && prismaErr.code) {
    switch (prismaErr.code) {
      case 'P2002':
        return res.status(409).json({
          error: 'Conflict',
          message: 'A record with this value already exists',
          field: prismaErr.meta?.target?.join(', '),
        });
      case 'P2025':
        return res.status(404).json({
          error: 'Not Found',
          message: 'Record not found',
        });
      case 'P2003':
        return res.status(400).json({
          error: 'Bad Request',
          message: 'Foreign key constraint failed',
        });
      default:
        return res.status(400).json({
          error: 'Database Error',
          message: err.message,
        });
    }
  }

  if (err.name === 'PrismaClientValidationError') {
    return res.status(400).json({
      error: 'Validation Error',
      message: 'Invalid data provided',
    });
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Invalid token',
    });
  }

  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Token expired',
    });
  }

  // Default error
  return res.status(500).json({
    error: 'Internal Server Error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'An unexpected error occurred',
  });
};
