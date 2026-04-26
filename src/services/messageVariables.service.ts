import prisma from '../utils/prisma.js';

// Variables supported in message templates (March 2026 spec — see [E:/1/17.png])
//   {nome_responsavel}      → first name of guardian
//   {nome_paciente}         → first name of patient
//   {nome_medico}           → doctor full name from treatment plan
//   {data_proxima_dose}     → next dose date (DD/MM/YYYY)
//   {data_proxima_consulta} → "<Mes>/<Ano> - 1ª/2ª Quinzena"
export const VARIABLE_DEFINITIONS = [
  { tag: '{nome_responsavel}',      key: 'first_name_responsavel', returns: 'Primeiro nome do responsável',     source: 'Cadastro do paciente',   example: 'Maria' },
  { tag: '{nome_paciente}',         key: 'first_name_paciente',    returns: 'Primeiro nome do paciente',        source: 'Cadastro do paciente',   example: 'João' },
  { tag: '{nome_medico}',           key: 'first_name_medico',      returns: 'Nome do médico do tratamento',     source: 'Plano terapêutico',      example: 'Dra. Marcela' },
  { tag: '{data_proxima_dose}',     key: 'next_dose_date',         returns: 'Data da próxima dose',             source: 'Gestão de tratamento',   example: '18/04/2026' },
  { tag: '{data_proxima_consulta}', key: 'next_consulta_period',   returns: 'Período da próxima consulta',      source: 'Previsão de consulta',   example: 'Maio/2026 - 1ª Quinzena' },
];

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
  // Prefer structured fortnight format
  if (month && year && fortnight) {
    const idx = Math.max(1, Math.min(12, month)) - 1;
    const ord = fortnight === 1 ? '1ª Quinzena' : '2ª Quinzena';
    return `${MONTH_NAMES_PT[idx]}/${year} - ${ord}`;
  }
  // Fallback: derive from legacy nextConsultationDate
  if (fallbackDate) {
    const d = new Date(fallbackDate);
    if (isNaN(d.getTime())) return '';
    const idx = d.getUTCMonth();
    const fn = d.getUTCDate() <= 15 ? '1ª Quinzena' : '2ª Quinzena';
    return `${MONTH_NAMES_PT[idx]}/${d.getUTCFullYear()} - ${fn}`;
  }
  return '';
};

// Build the per-treatment variable map.
// `doseId` (optional) lets the next_dose_date resolver target a specific dose.
export const buildTreatmentVariables = async (
  treatmentId: string,
  doseId?: string,
): Promise<Record<string, string>> => {
  const treatment = await prisma.treatment.findUnique({
    where: { id: treatmentId },
    include: {
      patient: {
        include: { guardian: true },
      },
      protocol: { select: { frequencyDays: true } },
      doctor: { select: { name: true } },
      doses: {
        orderBy: { cycleNumber: 'asc' },
      },
    },
  });

  if (!treatment) return {};

  // Determine the "next dose date":
  //  - If a specific doseId is provided, use that dose's applicationDate
  //  - Otherwise pick the first PENDING dose (smallest cycleNumber)
  //  - Otherwise derive from latest applied + protocol frequencyDays
  let nextDoseDate: Date | null = null;
  if (doseId) {
    const target = treatment.doses.find((d: any) => d.id === doseId);
    if (target) nextDoseDate = new Date(target.applicationDate);
  }
  if (!nextDoseDate) {
    const firstPending = treatment.doses.find((d: any) => d.status === 'PENDING');
    if (firstPending) nextDoseDate = new Date(firstPending.applicationDate);
  }
  if (!nextDoseDate) {
    const appliedDoses = treatment.doses.filter((d: any) =>
      ['APPLIED', 'APPLIED_LATE', 'CONFIRM_APPLICATION'].includes(d.status)
    );
    if (appliedDoses.length > 0) {
      const latest = appliedDoses[appliedDoses.length - 1];
      const next = new Date(latest.applicationDate);
      next.setDate(next.getDate() + (treatment.protocol.frequencyDays || 28));
      nextDoseDate = next;
    }
  }

  return {
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
};

// Replace all {variable} tags in `template` with values from `vars`. Unknown tags are left intact.
export const renderTemplate = (template: string, vars: Record<string, string>): string => {
  return template.replace(/\{[a-zA-Z_]+\}/g, (match) => {
    return Object.prototype.hasOwnProperty.call(vars, match) ? vars[match] : match;
  });
};

export const resolveTemplateForTreatment = async (
  template: string,
  treatmentId: string,
  doseId?: string,
): Promise<string> => {
  const vars = await buildTreatmentVariables(treatmentId, doseId);
  return renderTemplate(template, vars);
};
