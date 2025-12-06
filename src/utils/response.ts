import { Response } from 'express';

interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export const sendSuccess = <T>(
  res: Response,
  data: T,
  statusCode: number = 200
) => {
  res.status(statusCode).json(data);
};

export const sendPaginated = <T>(
  res: Response,
  data: T[],
  pagination: PaginationMeta
) => {
  res.json({
    data,
    ...pagination,
  });
};

export const sendCreated = <T>(res: Response, data: T) => {
  sendSuccess(res, data, 201);
};

export const sendNoContent = (res: Response) => {
  res.status(204).send();
};
