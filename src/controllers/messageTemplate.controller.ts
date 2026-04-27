import { Request, Response, NextFunction } from 'express';
import prisma from '../utils/prisma.js';
import { NotFoundError, BadRequestError } from '../utils/errors.js';
import { sendSuccess, sendCreated, sendNoContent } from '../utils/response.js';
import { resolveTemplateForTreatment, resolveTemplateForPatient } from '../services/messageVariables.service.js';

export const getMessageTemplates = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { trigger, active } = req.query;
    const where: any = {};
    if (trigger) where.trigger = trigger;
    if (active !== undefined) where.active = active === 'true';

    const templates = await prisma.messageTemplate.findMany({
      where,
      orderBy: { name: 'asc' },
    });

    sendSuccess(res, { data: templates });
  } catch (error) {
    next(error);
  }
};

export const getMessageTemplate = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const template = await prisma.messageTemplate.findUnique({ where: { id } });

    if (!template) {
      throw new NotFoundError('Message template not found');
    }

    sendSuccess(res, template);
  } catch (error) {
    next(error);
  }
};

export const createMessageTemplate = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name, trigger, content, active } = req.body;

    if (!name || !name.trim()) {
      throw new BadRequestError('Nome do modelo é obrigatório');
    }
    if (!content || !content.trim()) {
      throw new BadRequestError('Conteúdo do modelo é obrigatório');
    }

    const validTriggers = [
      'CONSENT_TERM',
      'SURVEY_PENDING',
      'SCHEDULE_CONSULTATION',
      'NEXT_DOSE',
      'LATE_DOSE',
      'GENERAL',
    ];
    if (trigger && !validTriggers.includes(trigger)) {
      throw new BadRequestError('Trigger inválido');
    }

    const template = await prisma.messageTemplate.create({
      data: {
        name: name.trim(),
        trigger: trigger || 'GENERAL',
        content,
        active: active !== undefined ? Boolean(active) : true,
      },
    });

    sendCreated(res, template);
  } catch (error) {
    next(error);
  }
};

export const updateMessageTemplate = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { name, trigger, content, active } = req.body;

    const template = await prisma.messageTemplate.update({
      where: { id },
      data: {
        ...(name !== undefined && { name: name.trim() }),
        ...(trigger !== undefined && { trigger }),
        ...(content !== undefined && { content }),
        ...(active !== undefined && { active: Boolean(active) }),
      },
    });

    sendSuccess(res, template);
  } catch (error) {
    next(error);
  }
};

export const deleteMessageTemplate = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    await prisma.messageTemplate.delete({ where: { id } });
    sendNoContent(res);
  } catch (error) {
    next(error);
  }
};

// Resolve a template (or ad-hoc content) against a treatment OR patient context — returns the rendered message.
// Used by the action-popup flow on the dashboard (March 2026 spec).
// Supports patient-only context (no active treatment) for Termo de Consentimento / inactive patients.
export const resolveTemplate = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { templateId, content, treatmentId, patientId, doseId } = req.body;

    if (!templateId && !content) {
      throw new BadRequestError('Forneça templateId ou content para resolver');
    }
    if (!treatmentId && !patientId) {
      throw new BadRequestError('treatmentId ou patientId é obrigatório');
    }

    let raw = content;
    if (templateId) {
      const tpl = await prisma.messageTemplate.findUnique({ where: { id: templateId } });
      if (!tpl) {
        throw new NotFoundError('Template não encontrado');
      }
      raw = tpl.content;
    }

    // Prefer treatment context (richer variable set); fall back to patient-only.
    const rendered = treatmentId
      ? await resolveTemplateForTreatment(raw, treatmentId, doseId)
      : await resolveTemplateForPatient(raw, patientId);

    sendSuccess(res, { rendered, raw });
  } catch (error) {
    next(error);
  }
};
