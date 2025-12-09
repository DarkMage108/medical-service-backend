import { PrismaClient, UserRole, ProtocolCategory, TreatmentStatus, DoseStatus, PaymentStatus, SurveyStatus, Gender } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

// Helper function to add days to a date
function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

// Helper function to subtract days from a date
function subtractDays(date: Date, days: number): Date {
  return addDays(date, -days);
}

async function main() {
  console.log('Seeding database with full test data...');

  const TODAY = new Date();

  // ============== USERS ==============
  console.log('\n--- Creating Users ---');

  const adminPassword = await bcrypt.hash('admin123', 12);
  const admin = await prisma.user.upsert({
    where: { email: 'admin@azevedo.com' },
    update: {},
    create: {
      email: 'admin@azevedo.com',
      password: adminPassword,
      name: 'Administrador',
      role: UserRole.ADMIN,
    },
  });
  console.log('Created admin:', admin.email);

  const doctorPassword = await bcrypt.hash('doctor123', 12);
  const doctor = await prisma.user.upsert({
    where: { email: 'medico@azevedo.com' },
    update: {},
    create: {
      email: 'medico@azevedo.com',
      password: doctorPassword,
      name: 'Dr. Carlos Azevedo',
      role: UserRole.DOCTOR,
    },
  });
  console.log('Created doctor:', doctor.email);

  const secretaryPassword = await bcrypt.hash('secretary123', 12);
  const secretary = await prisma.user.upsert({
    where: { email: 'secretaria@azevedo.com' },
    update: {},
    create: {
      email: 'secretaria@azevedo.com',
      password: secretaryPassword,
      name: 'Maria Santos',
      role: UserRole.SECRETARY,
    },
  });
  console.log('Created secretary:', secretary.email);

  // ============== DIAGNOSES ==============
  console.log('\n--- Creating Diagnoses ---');

  const diagnoses = [
    { name: 'Puberdade Precoce', color: '#3B82F6', requiresConsent: true },
    { name: 'Baixa Estatura', color: '#10B981', requiresConsent: true },
    { name: 'Hipotireoidismo', color: '#F59E0B', requiresConsent: false },
    { name: 'Diabetes Tipo 1', color: '#EF4444', requiresConsent: false },
    { name: 'Obesidade Infantil', color: '#8B5CF6', requiresConsent: false },
    { name: 'Deficiencia de GH', color: '#EC4899', requiresConsent: true },
  ];

  for (const diagnosis of diagnoses) {
    await prisma.diagnosis.upsert({
      where: { name: diagnosis.name },
      update: { color: diagnosis.color, requiresConsent: diagnosis.requiresConsent },
      create: diagnosis,
    });
  }
  console.log('Created', diagnoses.length, 'diagnoses');

  // ============== MEDICATION BASES ==============
  console.log('\n--- Creating Medication Bases ---');

  const medications = [
    { activeIngredient: 'Acetato de Leuprorrelina', dosage: '3.75mg', tradeName: 'Lectrum', manufacturer: 'Eurofarma', pharmaceuticalForm: 'Ampola' },
    { activeIngredient: 'Acetato de Leuprorrelina', dosage: '11.25mg', tradeName: 'Neodeca', manufacturer: 'Eurofarma', pharmaceuticalForm: 'Ampola' },
    { activeIngredient: 'Acetato de Leuprorrelina', dosage: '22.5mg', tradeName: 'Neodeca', manufacturer: 'Eurofarma', pharmaceuticalForm: 'Ampola' },
    { activeIngredient: 'Somatropina', dosage: '12mg', tradeName: 'Norditropin', manufacturer: 'Novo Nordisk', pharmaceuticalForm: 'Caneta' },
    { activeIngredient: 'Somatropina', dosage: '24mg', tradeName: 'Norditropin', manufacturer: 'Novo Nordisk', pharmaceuticalForm: 'Caneta' },
    { activeIngredient: 'Levotiroxina', dosage: '50mcg', tradeName: 'Puran T4', manufacturer: 'Sanofi', pharmaceuticalForm: 'Comprimido' },
  ];

  for (const med of medications) {
    await prisma.medicationBase.upsert({
      where: { activeIngredient_dosage: { activeIngredient: med.activeIngredient, dosage: med.dosage } },
      update: {},
      create: med,
    });
  }
  console.log('Created', medications.length, 'medication bases');

  // ============== PROTOCOLS ==============
  console.log('\n--- Creating Protocols ---');

  const protocolsData = [
    {
      name: 'Puberdade Precoce - Mensal',
      category: ProtocolCategory.MEDICATION,
      medicationType: 'Acetato de Leuprorrelina 3.75mg',
      frequencyDays: 28,
      goal: 'Bloquear progressao puberal',
      message: 'Lembrete: Aplicacao mensal de Leuprorrelina 3.75mg',
      milestones: [
        { day: 7, message: 'Verificar efeitos colaterais da primeira semana' },
        { day: 15, message: 'Contato de acompanhamento' },
        { day: 21, message: 'Confirmar agendamento da proxima aplicacao' },
      ],
    },
    {
      name: 'Puberdade Precoce - Trimestral',
      category: ProtocolCategory.MEDICATION,
      medicationType: 'Acetato de Leuprorrelina 11.25mg',
      frequencyDays: 84,
      goal: 'Bloquear progressao puberal',
      message: 'Lembrete: Aplicacao trimestral de Leuprorrelina 11.25mg',
      milestones: [
        { day: 7, message: 'Verificar efeitos colaterais da primeira semana' },
        { day: 28, message: 'Contato mensal de acompanhamento' },
        { day: 56, message: 'Segundo contato de acompanhamento' },
        { day: 77, message: 'Confirmar agendamento da proxima aplicacao' },
      ],
    },
    {
      name: 'Puberdade Precoce - Semestral',
      category: ProtocolCategory.MEDICATION,
      medicationType: 'Acetato de Leuprorrelina 22.5mg',
      frequencyDays: 168,
      goal: 'Bloquear progressao puberal',
      message: 'Lembrete: Aplicacao semestral de Leuprorrelina 22.5mg',
      milestones: [
        { day: 7, message: 'Verificar efeitos colaterais' },
        { day: 30, message: 'Contato de acompanhamento' },
        { day: 90, message: 'Contato trimestral' },
        { day: 150, message: 'Agendar proxima aplicacao' },
      ],
    },
    {
      name: 'Baixa Estatura - GH Diario',
      category: ProtocolCategory.MEDICATION,
      medicationType: 'Somatropina 12mg',
      frequencyDays: 30,
      goal: 'Estimular crescimento linear',
      message: 'Acompanhamento mensal do tratamento com GH',
      milestones: [
        { day: 7, message: 'Verificar tecnica de aplicacao' },
        { day: 15, message: 'Contato de acompanhamento' },
        { day: 25, message: 'Agendar proxima consulta' },
      ],
    },
    {
      name: 'Acompanhamento Trimestral',
      category: ProtocolCategory.MONITORING,
      medicationType: null,
      frequencyDays: 90,
      goal: 'Monitoramento clinico e laboratorial',
      message: 'Consulta de acompanhamento trimestral',
      milestones: [
        { day: 75, message: 'Solicitar exames de controle' },
        { day: 83, message: 'Confirmar agendamento da consulta' },
      ],
    },
  ];

  const protocols: Record<string, any> = {};
  for (const protocol of protocolsData) {
    const { milestones, ...protocolData } = protocol;

    // Delete existing milestones if protocol exists
    const existingProtocol = await prisma.protocol.findUnique({ where: { name: protocol.name } });
    if (existingProtocol) {
      await prisma.protocolMilestone.deleteMany({ where: { protocolId: existingProtocol.id } });
    }

    const created = await prisma.protocol.upsert({
      where: { name: protocol.name },
      update: { ...protocolData },
      create: {
        ...protocolData,
        milestones: { create: milestones },
      },
    });

    // Create milestones if they were deleted
    if (existingProtocol) {
      for (const milestone of milestones) {
        await prisma.protocolMilestone.create({
          data: { ...milestone, protocolId: created.id },
        });
      }
    }

    protocols[protocol.name] = created;
  }
  console.log('Created', Object.keys(protocols).length, 'protocols with milestones');

  // ============== INVENTORY ==============
  console.log('\n--- Creating Inventory Items ---');

  const inventoryItems = [
    { medicationName: 'Lectrum 3.75mg', lotNumber: 'LOT2024001', expiryDate: new Date('2025-12-31'), quantity: 25, unit: 'Ampola' },
    { medicationName: 'Lectrum 3.75mg', lotNumber: 'LOT2024010', expiryDate: new Date('2026-06-30'), quantity: 30, unit: 'Ampola' },
    { medicationName: 'Neodeca 11.25mg', lotNumber: 'LOT2024002', expiryDate: new Date('2025-06-30'), quantity: 18, unit: 'Ampola' },
    { medicationName: 'Neodeca 22.5mg', lotNumber: 'LOT2024003', expiryDate: new Date('2025-09-30'), quantity: 12, unit: 'Ampola' },
    { medicationName: 'Norditropin 12mg', lotNumber: 'LOT2024004', expiryDate: new Date('2025-08-31'), quantity: 15, unit: 'Caneta' },
    { medicationName: 'Norditropin 24mg', lotNumber: 'LOT2024005', expiryDate: new Date('2025-10-31'), quantity: 8, unit: 'Caneta' },
  ];

  const inventoryMap: Record<string, any> = {};
  for (const item of inventoryItems) {
    const created = await prisma.inventoryItem.upsert({
      where: { medicationName_lotNumber: { medicationName: item.medicationName, lotNumber: item.lotNumber } },
      update: { quantity: item.quantity },
      create: item,
    });
    inventoryMap[item.lotNumber] = created;
  }
  console.log('Created', inventoryItems.length, 'inventory items');

  // ============== PATIENTS ==============
  console.log('\n--- Creating Patients with Full Data ---');

  // Patient 1: Maria Silva - Active with ONGOING treatment, has pending doses and completed events
  const patient1 = await prisma.patient.upsert({
    where: { id: 'patient-maria-silva' },
    update: {},
    create: {
      id: 'patient-maria-silva',
      fullName: 'Maria Silva Santos',
      birthDate: new Date('2015-03-15'),
      gender: Gender.F,
      mainDiagnosis: 'Puberdade Precoce',
      clinicalNotes: 'Paciente em acompanhamento desde janeiro de 2024. Boa evolucao clinica. Exames de controle normais.',
      active: true,
      guardian: {
        create: {
          fullName: 'Ana Paula Silva',
          phonePrimary: '11999887766',
          phoneSecondary: '11988776655',
          email: 'ana.silva@email.com',
          relationship: 'Mae',
        },
      },
      address: {
        create: {
          street: 'Rua das Flores',
          number: '123',
          complement: 'Apto 45',
          neighborhood: 'Centro',
          city: 'Sao Paulo',
          state: 'SP',
          zipCode: '01310100',
        },
      },
    },
  });

  // Patient 2: Joao Pedro - Active with ONGOING treatment, has timeline events
  const patient2 = await prisma.patient.upsert({
    where: { id: 'patient-joao-pedro' },
    update: {},
    create: {
      id: 'patient-joao-pedro',
      fullName: 'Joao Pedro Oliveira',
      birthDate: new Date('2014-08-22'),
      gender: Gender.M,
      mainDiagnosis: 'Baixa Estatura',
      clinicalNotes: 'Iniciou tratamento com GH em setembro de 2024. Ganho de 2cm nos primeiros 3 meses.',
      active: true,
      guardian: {
        create: {
          fullName: 'Carlos Roberto Oliveira',
          phonePrimary: '11988776655',
          email: 'carlos.oliveira@email.com',
          relationship: 'Pai',
        },
      },
      address: {
        create: {
          street: 'Avenida Brasil',
          number: '456',
          neighborhood: 'Jardim America',
          city: 'Sao Paulo',
          state: 'SP',
          zipCode: '01430001',
        },
      },
    },
  });

  // Patient 3: Ana Carolina - Active with treatment, pending payment
  const patient3 = await prisma.patient.upsert({
    where: { id: 'patient-ana-carolina' },
    update: {},
    create: {
      id: 'patient-ana-carolina',
      fullName: 'Ana Carolina Mendes',
      birthDate: new Date('2016-11-10'),
      gender: Gender.F,
      mainDiagnosis: 'Puberdade Precoce',
      clinicalNotes: 'Segunda consulta realizada. Aguardando inicio do tratamento.',
      active: true,
      guardian: {
        create: {
          fullName: 'Patricia Mendes',
          phonePrimary: '11977665544',
          email: 'patricia.mendes@email.com',
          relationship: 'Mae',
        },
      },
      address: {
        create: {
          street: 'Rua Augusta',
          number: '789',
          complement: 'Sala 12',
          neighborhood: 'Consolacao',
          city: 'Sao Paulo',
          state: 'SP',
          zipCode: '01305000',
        },
      },
    },
  });

  // Patient 4: Lucas Ferreira - Active with trimestral protocol
  const patient4 = await prisma.patient.upsert({
    where: { id: 'patient-lucas-ferreira' },
    update: {},
    create: {
      id: 'patient-lucas-ferreira',
      fullName: 'Lucas Ferreira Costa',
      birthDate: new Date('2013-05-20'),
      gender: Gender.M,
      mainDiagnosis: 'Puberdade Precoce',
      clinicalNotes: 'Paciente masculino com puberdade precoce central. Bom controle com medicacao trimestral.',
      active: true,
      guardian: {
        create: {
          fullName: 'Fernanda Costa Ferreira',
          phonePrimary: '11966554433',
          phoneSecondary: '11955443322',
          email: 'fernanda.costa@email.com',
          relationship: 'Mae',
        },
      },
      address: {
        create: {
          street: 'Rua Oscar Freire',
          number: '321',
          neighborhood: 'Pinheiros',
          city: 'Sao Paulo',
          state: 'SP',
          zipCode: '05409010',
        },
      },
    },
  });

  // Patient 5: Isabella - Inactive patient (treatment finished)
  const patient5 = await prisma.patient.upsert({
    where: { id: 'patient-isabella-santos' },
    update: {},
    create: {
      id: 'patient-isabella-santos',
      fullName: 'Isabella Santos Lima',
      birthDate: new Date('2012-01-30'),
      gender: Gender.F,
      mainDiagnosis: 'Puberdade Precoce',
      clinicalNotes: 'Tratamento concluido com sucesso em outubro de 2024. Alta do acompanhamento.',
      active: false,
      guardian: {
        create: {
          fullName: 'Roberto Lima',
          phonePrimary: '11955443322',
          email: 'roberto.lima@email.com',
          relationship: 'Pai',
        },
      },
      address: {
        create: {
          street: 'Alameda Santos',
          number: '500',
          neighborhood: 'Cerqueira Cesar',
          city: 'Sao Paulo',
          state: 'SP',
          zipCode: '01418100',
        },
      },
    },
  });

  // Patient 6: Gabriel - New patient, incomplete registration
  const patient6 = await prisma.patient.upsert({
    where: { id: 'patient-gabriel-souza' },
    update: {},
    create: {
      id: 'patient-gabriel-souza',
      fullName: 'Gabriel Souza',
      birthDate: new Date('2017-07-14'),
      gender: Gender.M,
      mainDiagnosis: 'Deficiencia de GH',
      clinicalNotes: 'Paciente novo. Aguardando exames complementares.',
      active: true,
      // No guardian or address - incomplete registration
    },
  });

  console.log('Created 6 patients');

  // ============== TREATMENTS ==============
  console.log('\n--- Creating Treatments ---');

  // Treatment 1: Maria Silva - Mensal protocol with multiple doses
  const treatment1 = await prisma.treatment.upsert({
    where: { id: 'treatment-maria-1' },
    update: {},
    create: {
      id: 'treatment-maria-1',
      patientId: patient1.id,
      protocolId: protocols['Puberdade Precoce - Mensal'].id,
      status: TreatmentStatus.ONGOING,
      startDate: subtractDays(TODAY, 90), // Started 90 days ago
      plannedDosesBeforeConsult: 3,
      observations: 'Tratamento iniciado apos confirmacao diagnostica.',
    },
  });

  // Treatment 2: Joao Pedro - GH treatment
  const treatment2 = await prisma.treatment.upsert({
    where: { id: 'treatment-joao-1' },
    update: {},
    create: {
      id: 'treatment-joao-1',
      patientId: patient2.id,
      protocolId: protocols['Baixa Estatura - GH Diario'].id,
      status: TreatmentStatus.ONGOING,
      startDate: subtractDays(TODAY, 60), // Started 60 days ago
      plannedDosesBeforeConsult: 3,
      observations: 'Iniciado tratamento com GH. Orientacoes de aplicacao fornecidas.',
    },
  });

  // Treatment 3: Ana Carolina - New treatment, first dose pending
  const treatment3 = await prisma.treatment.upsert({
    where: { id: 'treatment-ana-1' },
    update: {},
    create: {
      id: 'treatment-ana-1',
      patientId: patient3.id,
      protocolId: protocols['Puberdade Precoce - Mensal'].id,
      status: TreatmentStatus.ONGOING,
      startDate: subtractDays(TODAY, 5), // Started 5 days ago
      plannedDosesBeforeConsult: 3,
      observations: 'Primeiro ciclo de tratamento.',
    },
  });

  // Treatment 4: Lucas - Trimestral protocol
  const treatment4 = await prisma.treatment.upsert({
    where: { id: 'treatment-lucas-1' },
    update: {},
    create: {
      id: 'treatment-lucas-1',
      patientId: patient4.id,
      protocolId: protocols['Puberdade Precoce - Trimestral'].id,
      status: TreatmentStatus.ONGOING,
      startDate: subtractDays(TODAY, 45), // Started 45 days ago
      plannedDosesBeforeConsult: 2,
      observations: 'Optou por protocolo trimestral para maior comodidade.',
    },
  });

  // Treatment 5: Isabella - Finished treatment
  const treatment5 = await prisma.treatment.upsert({
    where: { id: 'treatment-isabella-1' },
    update: {},
    create: {
      id: 'treatment-isabella-1',
      patientId: patient5.id,
      protocolId: protocols['Puberdade Precoce - Mensal'].id,
      status: TreatmentStatus.FINISHED,
      startDate: subtractDays(TODAY, 365), // Started 1 year ago
      plannedDosesBeforeConsult: 3,
      observations: 'Tratamento concluido. Paciente atingiu idade ossea adequada.',
    },
  });

  console.log('Created 5 treatments');

  // ============== DOSES ==============
  console.log('\n--- Creating Doses ---');

  // Maria's doses - 3 applied, 1 pending
  const mariaDoses = [
    {
      id: 'dose-maria-1',
      treatmentId: treatment1.id,
      cycleNumber: 1,
      applicationDate: subtractDays(TODAY, 90),
      lotNumber: 'LOT2024001',
      expiryDate: new Date('2025-12-31'),
      status: DoseStatus.APPLIED,
      paymentStatus: PaymentStatus.PAID,
      surveyStatus: SurveyStatus.ANSWERED,
      surveyScore: 10,
      surveyComment: 'Otimo atendimento. Equipe muito atenciosa.',
      inventoryLotId: inventoryMap['LOT2024001'].id,
    },
    {
      id: 'dose-maria-2',
      treatmentId: treatment1.id,
      cycleNumber: 2,
      applicationDate: subtractDays(TODAY, 62),
      lotNumber: 'LOT2024001',
      expiryDate: new Date('2025-12-31'),
      status: DoseStatus.APPLIED,
      paymentStatus: PaymentStatus.PAID,
      surveyStatus: SurveyStatus.ANSWERED,
      surveyScore: 9,
      surveyComment: 'Tudo correu bem.',
      inventoryLotId: inventoryMap['LOT2024001'].id,
    },
    {
      id: 'dose-maria-3',
      treatmentId: treatment1.id,
      cycleNumber: 3,
      applicationDate: subtractDays(TODAY, 34),
      lotNumber: 'LOT2024010',
      expiryDate: new Date('2026-06-30'),
      status: DoseStatus.APPLIED,
      paymentStatus: PaymentStatus.PAID,
      surveyStatus: SurveyStatus.SENT,
      inventoryLotId: inventoryMap['LOT2024010'].id,
    },
    {
      id: 'dose-maria-4',
      treatmentId: treatment1.id,
      cycleNumber: 4,
      applicationDate: subtractDays(TODAY, 6),
      lotNumber: 'LOT2024010',
      expiryDate: new Date('2026-06-30'),
      status: DoseStatus.PENDING,
      paymentStatus: PaymentStatus.PAID,
      surveyStatus: SurveyStatus.NOT_SENT,
      inventoryLotId: inventoryMap['LOT2024010'].id,
    },
  ];

  // Joao's doses - 2 applied, 1 pending
  const joaoDoses = [
    {
      id: 'dose-joao-1',
      treatmentId: treatment2.id,
      cycleNumber: 1,
      applicationDate: subtractDays(TODAY, 60),
      lotNumber: 'LOT2024004',
      expiryDate: new Date('2025-08-31'),
      status: DoseStatus.APPLIED,
      paymentStatus: PaymentStatus.PAID,
      surveyStatus: SurveyStatus.ANSWERED,
      surveyScore: 10,
      inventoryLotId: inventoryMap['LOT2024004'].id,
    },
    {
      id: 'dose-joao-2',
      treatmentId: treatment2.id,
      cycleNumber: 2,
      applicationDate: subtractDays(TODAY, 30),
      lotNumber: 'LOT2024004',
      expiryDate: new Date('2025-08-31'),
      status: DoseStatus.APPLIED,
      paymentStatus: PaymentStatus.PAID,
      surveyStatus: SurveyStatus.WAITING,
      inventoryLotId: inventoryMap['LOT2024004'].id,
    },
    {
      id: 'dose-joao-3',
      treatmentId: treatment2.id,
      cycleNumber: 3,
      applicationDate: addDays(TODAY, 1), // Tomorrow - pending
      lotNumber: 'LOT2024004',
      expiryDate: new Date('2025-08-31'),
      status: DoseStatus.PENDING,
      paymentStatus: PaymentStatus.WAITING_PIX,
      surveyStatus: SurveyStatus.NOT_SENT,
      inventoryLotId: inventoryMap['LOT2024004'].id,
    },
  ];

  // Ana's doses - 1 pending (first dose)
  const anaDoses = [
    {
      id: 'dose-ana-1',
      treatmentId: treatment3.id,
      cycleNumber: 1,
      applicationDate: addDays(TODAY, 3), // 3 days from now
      lotNumber: 'LOT2024001',
      expiryDate: new Date('2025-12-31'),
      status: DoseStatus.PENDING,
      paymentStatus: PaymentStatus.WAITING_CARD,
      surveyStatus: SurveyStatus.NOT_SENT,
      inventoryLotId: inventoryMap['LOT2024001'].id,
    },
  ];

  // Lucas's doses - 1 applied (trimestral)
  const lucasDoses = [
    {
      id: 'dose-lucas-1',
      treatmentId: treatment4.id,
      cycleNumber: 1,
      applicationDate: subtractDays(TODAY, 45),
      lotNumber: 'LOT2024002',
      expiryDate: new Date('2025-06-30'),
      status: DoseStatus.APPLIED,
      paymentStatus: PaymentStatus.PAID,
      surveyStatus: SurveyStatus.ANSWERED,
      surveyScore: 8,
      surveyComment: 'Aplicacao tranquila. Pequeno desconforto local que passou rapidamente.',
      inventoryLotId: inventoryMap['LOT2024002'].id,
    },
  ];

  // Isabella's doses - all applied (finished treatment)
  const isabellaDoses = [
    {
      id: 'dose-isabella-1',
      treatmentId: treatment5.id,
      cycleNumber: 1,
      applicationDate: subtractDays(TODAY, 365),
      lotNumber: 'LOT2024001',
      expiryDate: new Date('2025-12-31'),
      status: DoseStatus.APPLIED,
      paymentStatus: PaymentStatus.PAID,
      surveyStatus: SurveyStatus.ANSWERED,
      surveyScore: 10,
      inventoryLotId: inventoryMap['LOT2024001'].id,
    },
    {
      id: 'dose-isabella-2',
      treatmentId: treatment5.id,
      cycleNumber: 2,
      applicationDate: subtractDays(TODAY, 337),
      lotNumber: 'LOT2024001',
      expiryDate: new Date('2025-12-31'),
      status: DoseStatus.APPLIED,
      paymentStatus: PaymentStatus.PAID,
      surveyStatus: SurveyStatus.ANSWERED,
      surveyScore: 9,
      inventoryLotId: inventoryMap['LOT2024001'].id,
    },
    {
      id: 'dose-isabella-3',
      treatmentId: treatment5.id,
      cycleNumber: 3,
      applicationDate: subtractDays(TODAY, 309),
      lotNumber: 'LOT2024001',
      expiryDate: new Date('2025-12-31'),
      status: DoseStatus.APPLIED,
      paymentStatus: PaymentStatus.PAID,
      surveyStatus: SurveyStatus.ANSWERED,
      surveyScore: 10,
      inventoryLotId: inventoryMap['LOT2024001'].id,
    },
  ];

  const allDoses = [...mariaDoses, ...joaoDoses, ...anaDoses, ...lucasDoses, ...isabellaDoses];

  for (const dose of allDoses) {
    await prisma.dose.upsert({
      where: { id: dose.id },
      update: {},
      create: dose,
    });
  }
  console.log('Created', allDoses.length, 'doses');

  // ============== CONSENT DOCUMENTS ==============
  console.log('\n--- Creating Consent Documents ---');

  const documents = [
    {
      id: 'doc-maria-1',
      patientId: patient1.id,
      fileName: 'Termo_Consentimento_Maria_Silva.pdf',
      fileType: 'pdf',
      fileUrl: '/uploads/patient-maria-silva/termo_consentimento.pdf',
      uploadedBy: admin.id,
      uploadDate: subtractDays(TODAY, 95),
    },
    {
      id: 'doc-joao-1',
      patientId: patient2.id,
      fileName: 'Termo_Consentimento_Joao_Pedro.pdf',
      fileType: 'pdf',
      fileUrl: '/uploads/patient-joao-pedro/termo_consentimento.pdf',
      uploadedBy: secretary.id,
      uploadDate: subtractDays(TODAY, 65),
    },
    {
      id: 'doc-lucas-1',
      patientId: patient4.id,
      fileName: 'Termo_Consentimento_Lucas_Ferreira.pdf',
      fileType: 'pdf',
      fileUrl: '/uploads/patient-lucas-ferreira/termo_consentimento.pdf',
      uploadedBy: admin.id,
      uploadDate: subtractDays(TODAY, 50),
    },
    {
      id: 'doc-isabella-1',
      patientId: patient5.id,
      fileName: 'Termo_Consentimento_Isabella_Santos.pdf',
      fileType: 'pdf',
      fileUrl: '/uploads/patient-isabella-santos/termo_consentimento.pdf',
      uploadedBy: secretary.id,
      uploadDate: subtractDays(TODAY, 370),
    },
  ];

  for (const doc of documents) {
    await prisma.consentDocument.upsert({
      where: { id: doc.id },
      update: {},
      create: doc,
    });
  }
  console.log('Created', documents.length, 'consent documents');

  // ============== DISMISSED LOGS (Completed contacts) ==============
  console.log('\n--- Creating Dismissed Logs ---');

  const dismissedLogs = [
    // Maria's completed contacts
    { id: 'dismissed-maria-1', contactId: `${treatment1.id}_m_7`, dismissedAt: subtractDays(TODAY, 83) },
    { id: 'dismissed-maria-2', contactId: `${treatment1.id}_m_15`, dismissedAt: subtractDays(TODAY, 75) },
    // Joao's completed contacts
    { id: 'dismissed-joao-1', contactId: `${treatment2.id}_m_7`, dismissedAt: subtractDays(TODAY, 53) },
    // Lucas's completed contacts
    { id: 'dismissed-lucas-1', contactId: `${treatment4.id}_m_7`, dismissedAt: subtractDays(TODAY, 38) },
    { id: 'dismissed-lucas-2', contactId: `${treatment4.id}_m_28`, dismissedAt: subtractDays(TODAY, 17) },
  ];

  for (const log of dismissedLogs) {
    await prisma.dismissedLog.upsert({
      where: { id: log.id },
      update: {},
      create: log,
    });
  }
  console.log('Created', dismissedLogs.length, 'dismissed logs');

  // ============== DISPENSE LOGS ==============
  console.log('\n--- Creating Dispense Logs ---');

  const dispenseLogs = [
    { patientId: patient1.id, inventoryItemId: inventoryMap['LOT2024001'].id, medicationName: 'Lectrum 3.75mg', quantity: 1, doseId: 'dose-maria-1', date: subtractDays(TODAY, 90) },
    { patientId: patient1.id, inventoryItemId: inventoryMap['LOT2024001'].id, medicationName: 'Lectrum 3.75mg', quantity: 1, doseId: 'dose-maria-2', date: subtractDays(TODAY, 62) },
    { patientId: patient1.id, inventoryItemId: inventoryMap['LOT2024010'].id, medicationName: 'Lectrum 3.75mg', quantity: 1, doseId: 'dose-maria-3', date: subtractDays(TODAY, 34) },
    { patientId: patient2.id, inventoryItemId: inventoryMap['LOT2024004'].id, medicationName: 'Norditropin 12mg', quantity: 1, doseId: 'dose-joao-1', date: subtractDays(TODAY, 60) },
    { patientId: patient2.id, inventoryItemId: inventoryMap['LOT2024004'].id, medicationName: 'Norditropin 12mg', quantity: 1, doseId: 'dose-joao-2', date: subtractDays(TODAY, 30) },
    { patientId: patient4.id, inventoryItemId: inventoryMap['LOT2024002'].id, medicationName: 'Neodeca 11.25mg', quantity: 1, doseId: 'dose-lucas-1', date: subtractDays(TODAY, 45) },
  ];

  for (const log of dispenseLogs) {
    await prisma.dispenseLog.create({ data: log });
  }
  console.log('Created', dispenseLogs.length, 'dispense logs');

  // ============== PURCHASE REQUESTS ==============
  console.log('\n--- Creating Purchase Requests ---');

  const purchaseRequests = [
    { medicationName: 'Lectrum 3.75mg', predictedConsumption10Days: 8, currentStock: 25, suggestedQuantity: 0, status: 'PENDING' as const },
    { medicationName: 'Neodeca 11.25mg', predictedConsumption10Days: 3, currentStock: 5, suggestedQuantity: 10, status: 'ORDERED' as const },
  ];

  for (const req of purchaseRequests) {
    await prisma.purchaseRequest.create({ data: req });
  }
  console.log('Created', purchaseRequests.length, 'purchase requests');

  // ============== SUMMARY ==============
  console.log('\n========================================');
  console.log('SEED COMPLETED SUCCESSFULLY!');
  console.log('========================================');
  console.log('\nTest Users:');
  console.log('  Admin: admin@azevedo.com / admin123');
  console.log('  Doctor: medico@azevedo.com / doctor123');
  console.log('  Secretary: secretaria@azevedo.com / secretary123');
  console.log('\nTest Patients:');
  console.log('  1. Maria Silva Santos - Active, ONGOING treatment, 3 applied + 1 pending dose');
  console.log('  2. Joao Pedro Oliveira - Active, ONGOING treatment, 2 applied + 1 pending dose');
  console.log('  3. Ana Carolina Mendes - Active, ONGOING treatment, 1 pending dose (new patient)');
  console.log('  4. Lucas Ferreira Costa - Active, ONGOING treatment (trimestral), 1 applied dose');
  console.log('  5. Isabella Santos Lima - Inactive, FINISHED treatment');
  console.log('  6. Gabriel Souza - Active, incomplete registration (no guardian/address)');
  console.log('\nTimeline Events:');
  console.log('  - Maria: Has upcoming contacts (day 21) and past completed events');
  console.log('  - Joao: Has pending dose tomorrow + upcoming contacts');
  console.log('  - Ana: Has pending dose in 3 days + upcoming contacts');
  console.log('  - Lucas: Has upcoming contacts (day 56, 77)');
  console.log('\nChecklist Items:');
  console.log('  - Ana: Pending payment (WAITING_CARD)');
  console.log('  - Joao: Pending payment (WAITING_PIX)');
  console.log('  - Gabriel: Incomplete registration');
  console.log('========================================\n');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
