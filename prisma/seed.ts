import { PrismaClient, UserRole, ProtocolCategory, TreatmentStatus, DoseStatus, PaymentStatus, SurveyStatus, Gender } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function subtractDays(date: Date, days: number): Date {
  return addDays(date, -days);
}

function calculateDoseFields(applicationDate: Date, frequencyDays: number) {
  const calculatedNextDate = addDays(applicationDate, frequencyDays);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diffTime = calculatedNextDate.getTime() - today.getTime();
  const daysUntilNext = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return { calculatedNextDate, daysUntilNext };
}

async function main() {
  console.log('Seeding database with diverse test data...');

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

  const nursePassword = await bcrypt.hash('nurse123', 12);
  const nurse = await prisma.user.upsert({
    where: { email: 'enfermeira@azevedo.com' },
    update: {},
    create: {
      email: 'enfermeira@azevedo.com',
      password: nursePassword,
      name: 'Ana Oliveira',
      role: UserRole.NURSE,
    },
  });

  console.log('Created 4 users (admin, doctor, secretary, nurse)');

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
  // Covering: All genders, all diagnoses, active/inactive, with/without guardian, different cities
  console.log('\n--- Creating Patients ---');

  // Patient 1: Female, Puberdade Precoce, Active, Full data, São Paulo
  const patient1 = await prisma.patient.upsert({
    where: { id: 'patient-001' },
    update: {},
    create: {
      id: 'patient-001',
      fullName: 'Maria Silva Santos',
      birthDate: new Date('2015-03-15'),
      gender: Gender.F,
      mainDiagnosis: 'Puberdade Precoce',
      clinicalNotes: 'Paciente em acompanhamento. Boa evolucao clinica.',
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

  // Patient 2: Male, Baixa Estatura, Active, Full data, Rio de Janeiro
  const patient2 = await prisma.patient.upsert({
    where: { id: 'patient-002' },
    update: {},
    create: {
      id: 'patient-002',
      fullName: 'Joao Pedro Oliveira',
      birthDate: new Date('2014-08-22'),
      gender: Gender.M,
      mainDiagnosis: 'Baixa Estatura',
      clinicalNotes: 'Iniciou tratamento com GH. Ganho de 2cm nos primeiros 3 meses.',
      active: true,
      guardian: {
        create: {
          fullName: 'Carlos Roberto Oliveira',
          phonePrimary: '21988776655',
          email: 'carlos.oliveira@email.com',
          relationship: 'Pai',
        },
      },
      address: {
        create: {
          street: 'Avenida Atlantica',
          number: '456',
          neighborhood: 'Copacabana',
          city: 'Rio de Janeiro',
          state: 'RJ',
          zipCode: '22070000',
        },
      },
    },
  });

  // Patient 3: Female, Hipotireoidismo, Active, Full data, Belo Horizonte
  const patient3 = await prisma.patient.upsert({
    where: { id: 'patient-003' },
    update: {},
    create: {
      id: 'patient-003',
      fullName: 'Ana Carolina Mendes',
      birthDate: new Date('2016-11-10'),
      gender: Gender.F,
      mainDiagnosis: 'Hipotireoidismo',
      clinicalNotes: 'Controle com Levotiroxina. TSH normalizado.',
      active: true,
      guardian: {
        create: {
          fullName: 'Patricia Mendes',
          phonePrimary: '31977665544',
          email: 'patricia.mendes@email.com',
          relationship: 'Mae',
        },
      },
      address: {
        create: {
          street: 'Rua da Bahia',
          number: '789',
          neighborhood: 'Funcionarios',
          city: 'Belo Horizonte',
          state: 'MG',
          zipCode: '30160010',
        },
      },
    },
  });

  // Patient 4: Male, Diabetes Tipo 1, Active, Full data, Curitiba
  const patient4 = await prisma.patient.upsert({
    where: { id: 'patient-004' },
    update: {},
    create: {
      id: 'patient-004',
      fullName: 'Lucas Ferreira Costa',
      birthDate: new Date('2013-05-20'),
      gender: Gender.M,
      mainDiagnosis: 'Diabetes Tipo 1',
      clinicalNotes: 'Controle glicemico adequado com insulina.',
      active: true,
      guardian: {
        create: {
          fullName: 'Fernanda Costa Ferreira',
          phonePrimary: '41966554433',
          phoneSecondary: '41955443322',
          email: 'fernanda.costa@email.com',
          relationship: 'Mae',
        },
      },
      address: {
        create: {
          street: 'Rua XV de Novembro',
          number: '321',
          neighborhood: 'Centro',
          city: 'Curitiba',
          state: 'PR',
          zipCode: '80020310',
        },
      },
    },
  });

  // Patient 5: Female, Puberdade Precoce, Inactive (FINISHED), Full data
  const patient5 = await prisma.patient.upsert({
    where: { id: 'patient-005' },
    update: {},
    create: {
      id: 'patient-005',
      fullName: 'Isabella Santos Lima',
      birthDate: new Date('2012-01-30'),
      gender: Gender.F,
      mainDiagnosis: 'Puberdade Precoce',
      clinicalNotes: 'Tratamento concluido com sucesso. Alta do acompanhamento.',
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

  // Patient 6: Male, Deficiencia de GH, Active, NO guardian/address (incomplete)
  const patient6 = await prisma.patient.upsert({
    where: { id: 'patient-006' },
    update: {},
    create: {
      id: 'patient-006',
      fullName: 'Gabriel Souza',
      birthDate: new Date('2017-07-14'),
      gender: Gender.M,
      mainDiagnosis: 'Deficiencia de GH',
      clinicalNotes: 'Paciente novo. Aguardando exames complementares.',
      active: true,
    },
  });

  // Patient 7: OTHER gender, Obesidade Infantil, Active, Full data, Salvador
  const patient7 = await prisma.patient.upsert({
    where: { id: 'patient-007' },
    update: {},
    create: {
      id: 'patient-007',
      fullName: 'Alex Ribeiro',
      birthDate: new Date('2015-09-05'),
      gender: Gender.OTHER,
      mainDiagnosis: 'Obesidade Infantil',
      clinicalNotes: 'Acompanhamento nutricional e endocrinologico.',
      active: true,
      guardian: {
        create: {
          fullName: 'Mariana Ribeiro',
          phonePrimary: '71988112233',
          email: 'mariana.ribeiro@email.com',
          relationship: 'Mae',
        },
      },
      address: {
        create: {
          street: 'Avenida Sete de Setembro',
          number: '100',
          complement: 'Bloco B',
          neighborhood: 'Barra',
          city: 'Salvador',
          state: 'BA',
          zipCode: '40140000',
        },
      },
    },
  });

  // Patient 8: Female, Baixa Estatura, Inactive (REFUSED), Full data
  const patient8 = await prisma.patient.upsert({
    where: { id: 'patient-008' },
    update: {},
    create: {
      id: 'patient-008',
      fullName: 'Laura Pereira',
      birthDate: new Date('2014-02-18'),
      gender: Gender.F,
      mainDiagnosis: 'Baixa Estatura',
      clinicalNotes: 'Familia recusou tratamento com GH.',
      active: false,
      guardian: {
        create: {
          fullName: 'Ricardo Pereira',
          phonePrimary: '51999887766',
          email: 'ricardo.pereira@email.com',
          relationship: 'Pai',
        },
      },
      address: {
        create: {
          street: 'Rua dos Andradas',
          number: '200',
          neighborhood: 'Centro Historico',
          city: 'Porto Alegre',
          state: 'RS',
          zipCode: '90020000',
        },
      },
    },
  });

  // Patient 9: Male, Puberdade Precoce, Active (EXTERNAL treatment)
  const patient9 = await prisma.patient.upsert({
    where: { id: 'patient-009' },
    update: {},
    create: {
      id: 'patient-009',
      fullName: 'Pedro Henrique Alves',
      birthDate: new Date('2013-12-01'),
      gender: Gender.M,
      mainDiagnosis: 'Puberdade Precoce',
      clinicalNotes: 'Paciente faz aplicacao em outra clinica.',
      active: true,
      guardian: {
        create: {
          fullName: 'Claudia Alves',
          phonePrimary: '61988776655',
          email: 'claudia.alves@email.com',
          relationship: 'Mae',
        },
      },
      address: {
        create: {
          street: 'SQN 308 Bloco A',
          number: '101',
          neighborhood: 'Asa Norte',
          city: 'Brasilia',
          state: 'DF',
          zipCode: '70747000',
        },
      },
    },
  });

  // Patient 10: Female, Deficiencia de GH, Active (SUSPENDED treatment)
  const patient10 = await prisma.patient.upsert({
    where: { id: 'patient-010' },
    update: {},
    create: {
      id: 'patient-010',
      fullName: 'Beatriz Gomes',
      birthDate: new Date('2016-04-25'),
      gender: Gender.F,
      mainDiagnosis: 'Deficiencia de GH',
      clinicalNotes: 'Tratamento suspenso temporariamente por viagem.',
      active: true,
      guardian: {
        create: {
          fullName: 'Fernando Gomes',
          phonePrimary: '81977665544',
          email: 'fernando.gomes@email.com',
          relationship: 'Pai',
        },
      },
      address: {
        create: {
          street: 'Avenida Boa Viagem',
          number: '3000',
          complement: 'Apto 1502',
          neighborhood: 'Boa Viagem',
          city: 'Recife',
          state: 'PE',
          zipCode: '51020000',
        },
      },
    },
  });

  console.log('Created 10 patients');

  // ============== TREATMENTS ==============
  // Covering all TreatmentStatus: ONGOING, FINISHED, REFUSED, EXTERNAL, SUSPENDED
  console.log('\n--- Creating Treatments ---');

  // Treatment 1: Maria - ONGOING, Mensal protocol
  const treatment1 = await prisma.treatment.upsert({
    where: { id: 'treatment-001' },
    update: {},
    create: {
      id: 'treatment-001',
      patientId: patient1.id,
      protocolId: protocols['Puberdade Precoce - Mensal'].id,
      status: TreatmentStatus.ONGOING,
      startDate: subtractDays(TODAY, 90),
      plannedDosesBeforeConsult: 3,
      observations: 'Tratamento iniciado apos confirmacao diagnostica.',
    },
  });

  // Treatment 2: Joao - ONGOING, GH treatment
  const treatment2 = await prisma.treatment.upsert({
    where: { id: 'treatment-002' },
    update: {},
    create: {
      id: 'treatment-002',
      patientId: patient2.id,
      protocolId: protocols['Baixa Estatura - GH Diario'].id,
      status: TreatmentStatus.ONGOING,
      startDate: subtractDays(TODAY, 60),
      plannedDosesBeforeConsult: 3,
      observations: 'Iniciado tratamento com GH.',
    },
  });

  // Treatment 3: Ana Carolina - ONGOING, Monitoring (no medication)
  const treatment3 = await prisma.treatment.upsert({
    where: { id: 'treatment-003' },
    update: {},
    create: {
      id: 'treatment-003',
      patientId: patient3.id,
      protocolId: protocols['Acompanhamento Trimestral'].id,
      status: TreatmentStatus.ONGOING,
      startDate: subtractDays(TODAY, 30),
      plannedDosesBeforeConsult: 1,
      observations: 'Acompanhamento de Hipotireoidismo.',
    },
  });

  // Treatment 4: Lucas - ONGOING, Trimestral protocol
  const treatment4 = await prisma.treatment.upsert({
    where: { id: 'treatment-004' },
    update: {},
    create: {
      id: 'treatment-004',
      patientId: patient4.id,
      protocolId: protocols['Puberdade Precoce - Trimestral'].id,
      status: TreatmentStatus.ONGOING,
      startDate: subtractDays(TODAY, 45),
      plannedDosesBeforeConsult: 2,
      observations: 'Protocolo trimestral para maior comodidade.',
    },
  });

  // Treatment 5: Isabella - FINISHED
  const treatment5 = await prisma.treatment.upsert({
    where: { id: 'treatment-005' },
    update: {},
    create: {
      id: 'treatment-005',
      patientId: patient5.id,
      protocolId: protocols['Puberdade Precoce - Mensal'].id,
      status: TreatmentStatus.FINISHED,
      startDate: subtractDays(TODAY, 365),
      plannedDosesBeforeConsult: 3,
      observations: 'Tratamento concluido. Paciente atingiu idade ossea adequada.',
    },
  });

  // Treatment 6: Alex - ONGOING, Semestral protocol
  const treatment6 = await prisma.treatment.upsert({
    where: { id: 'treatment-006' },
    update: {},
    create: {
      id: 'treatment-006',
      patientId: patient7.id,
      protocolId: protocols['Puberdade Precoce - Semestral'].id,
      status: TreatmentStatus.ONGOING,
      startDate: subtractDays(TODAY, 20),
      plannedDosesBeforeConsult: 1,
      observations: 'Primeira aplicacao semestral.',
    },
  });

  // Treatment 7: Laura - REFUSED
  const treatment7 = await prisma.treatment.upsert({
    where: { id: 'treatment-007' },
    update: {},
    create: {
      id: 'treatment-007',
      patientId: patient8.id,
      protocolId: protocols['Baixa Estatura - GH Diario'].id,
      status: TreatmentStatus.REFUSED,
      startDate: subtractDays(TODAY, 120),
      plannedDosesBeforeConsult: 3,
      observations: 'Familia optou por nao iniciar tratamento.',
    },
  });

  // Treatment 8: Pedro - EXTERNAL
  const treatment8 = await prisma.treatment.upsert({
    where: { id: 'treatment-008' },
    update: {},
    create: {
      id: 'treatment-008',
      patientId: patient9.id,
      protocolId: protocols['Puberdade Precoce - Mensal'].id,
      status: TreatmentStatus.EXTERNAL,
      startDate: subtractDays(TODAY, 180),
      plannedDosesBeforeConsult: 3,
      observations: 'Aplicacao realizada em clinica externa.',
    },
  });

  // Treatment 9: Beatriz - SUSPENDED
  const treatment9 = await prisma.treatment.upsert({
    where: { id: 'treatment-009' },
    update: {},
    create: {
      id: 'treatment-009',
      patientId: patient10.id,
      protocolId: protocols['Baixa Estatura - GH Diario'].id,
      status: TreatmentStatus.SUSPENDED,
      startDate: subtractDays(TODAY, 90),
      plannedDosesBeforeConsult: 3,
      observations: 'Suspenso por 60 dias devido viagem internacional.',
    },
  });

  console.log('Created 9 treatments covering all statuses');

  // ============== DOSES ==============
  // Covering: DoseStatus (PENDING, APPLIED, NOT_ACCEPTED)
  // PaymentStatus (WAITING_PIX, WAITING_CARD, WAITING_BOLETO, PAID, WAITING_DELIVERY)
  // SurveyStatus (WAITING, SENT, ANSWERED, NOT_SENT)
  console.log('\n--- Creating Doses ---');

  // Map treatment ID to frequency days
  const treatmentFrequencyMap: Record<string, number> = {
    'treatment-001': 28,  // Puberdade Precoce - Mensal
    'treatment-002': 30,  // Baixa Estatura - GH Diario
    'treatment-003': 90,  // Acompanhamento Trimestral
    'treatment-004': 84,  // Puberdade Precoce - Trimestral
    'treatment-005': 28,  // Puberdade Precoce - Mensal
    'treatment-006': 168, // Puberdade Precoce - Semestral
    'treatment-007': 30,  // Baixa Estatura - GH Diario
    'treatment-008': 28,  // Puberdade Precoce - Mensal
    'treatment-009': 30,  // Baixa Estatura - GH Diario
  };

  const allDoses = [
    // Maria's doses - varied statuses
    {
      id: 'dose-001',
      treatmentId: treatment1.id,
      cycleNumber: 1,
      applicationDate: subtractDays(TODAY, 90),
      lotNumber: 'LOT2024001',
      expiryDate: new Date('2025-12-31'),
      status: DoseStatus.APPLIED,
      paymentStatus: PaymentStatus.PAID,
      surveyStatus: SurveyStatus.ANSWERED,
      surveyScore: 10,
      surveyComment: 'Otimo atendimento.',
      inventoryLotId: inventoryMap['LOT2024001'].id,
    },
    {
      id: 'dose-002',
      treatmentId: treatment1.id,
      cycleNumber: 2,
      applicationDate: subtractDays(TODAY, 62),
      lotNumber: 'LOT2024001',
      expiryDate: new Date('2025-12-31'),
      status: DoseStatus.APPLIED,
      paymentStatus: PaymentStatus.PAID,
      surveyStatus: SurveyStatus.SENT,
      inventoryLotId: inventoryMap['LOT2024001'].id,
    },
    {
      id: 'dose-003',
      treatmentId: treatment1.id,
      cycleNumber: 3,
      applicationDate: subtractDays(TODAY, 34),
      lotNumber: 'LOT2024010',
      expiryDate: new Date('2026-06-30'),
      status: DoseStatus.APPLIED,
      paymentStatus: PaymentStatus.PAID,
      surveyStatus: SurveyStatus.WAITING,
      inventoryLotId: inventoryMap['LOT2024010'].id,
    },
    {
      id: 'dose-004',
      treatmentId: treatment1.id,
      cycleNumber: 4,
      applicationDate: subtractDays(TODAY, 6),
      lotNumber: 'LOT2024010',
      expiryDate: new Date('2026-06-30'),
      status: DoseStatus.PENDING,
      paymentStatus: PaymentStatus.WAITING_PIX,
      surveyStatus: SurveyStatus.NOT_SENT,
      inventoryLotId: inventoryMap['LOT2024010'].id,
    },

    // Joao's doses
    {
      id: 'dose-005',
      treatmentId: treatment2.id,
      cycleNumber: 1,
      applicationDate: subtractDays(TODAY, 60),
      lotNumber: 'LOT2024004',
      expiryDate: new Date('2025-08-31'),
      status: DoseStatus.APPLIED,
      paymentStatus: PaymentStatus.PAID,
      surveyStatus: SurveyStatus.ANSWERED,
      surveyScore: 8,
      surveyComment: 'Bom atendimento.',
      inventoryLotId: inventoryMap['LOT2024004'].id,
      nurse: true,
    },
    {
      id: 'dose-006',
      treatmentId: treatment2.id,
      cycleNumber: 2,
      applicationDate: subtractDays(TODAY, 30),
      lotNumber: 'LOT2024004',
      expiryDate: new Date('2025-08-31'),
      status: DoseStatus.APPLIED,
      paymentStatus: PaymentStatus.PAID,
      surveyStatus: SurveyStatus.NOT_SENT,
      inventoryLotId: inventoryMap['LOT2024004'].id,
      nurse: true,
    },
    {
      id: 'dose-007',
      treatmentId: treatment2.id,
      cycleNumber: 3,
      applicationDate: TODAY, // Dose para HOJE
      lotNumber: 'LOT2024004',
      expiryDate: new Date('2025-08-31'),
      status: DoseStatus.PENDING,
      paymentStatus: PaymentStatus.WAITING_CARD,
      surveyStatus: SurveyStatus.NOT_SENT,
      inventoryLotId: inventoryMap['LOT2024004'].id,
      nurse: true,
    },

    // Lucas's doses - trimestral
    {
      id: 'dose-008',
      treatmentId: treatment4.id,
      cycleNumber: 1,
      applicationDate: subtractDays(TODAY, 45),
      lotNumber: 'LOT2024002',
      expiryDate: new Date('2025-06-30'),
      status: DoseStatus.APPLIED,
      paymentStatus: PaymentStatus.PAID,
      surveyStatus: SurveyStatus.ANSWERED,
      surveyScore: 9,
      inventoryLotId: inventoryMap['LOT2024002'].id,
    },

    // Isabella's doses - finished treatment
    {
      id: 'dose-009',
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
      id: 'dose-010',
      treatmentId: treatment5.id,
      cycleNumber: 2,
      applicationDate: subtractDays(TODAY, 337),
      lotNumber: 'LOT2024001',
      expiryDate: new Date('2025-12-31'),
      status: DoseStatus.APPLIED,
      paymentStatus: PaymentStatus.PAID,
      surveyStatus: SurveyStatus.ANSWERED,
      surveyScore: 7,
      surveyComment: 'Tempo de espera um pouco longo.',
      inventoryLotId: inventoryMap['LOT2024001'].id,
    },

    // Alex's dose - semestral, WAITING_BOLETO
    {
      id: 'dose-011',
      treatmentId: treatment6.id,
      cycleNumber: 1,
      applicationDate: subtractDays(TODAY, 20),
      lotNumber: 'LOT2024003',
      expiryDate: new Date('2025-09-30'),
      status: DoseStatus.APPLIED,
      paymentStatus: PaymentStatus.WAITING_BOLETO,
      surveyStatus: SurveyStatus.SENT,
      inventoryLotId: inventoryMap['LOT2024003'].id,
    },

    // Laura's dose - NOT_ACCEPTED (refused)
    {
      id: 'dose-012',
      treatmentId: treatment7.id,
      cycleNumber: 1,
      applicationDate: subtractDays(TODAY, 120),
      lotNumber: 'LOT2024004',
      expiryDate: new Date('2025-08-31'),
      status: DoseStatus.NOT_ACCEPTED,
      paymentStatus: PaymentStatus.PAID,
      surveyStatus: SurveyStatus.NOT_SENT,
      inventoryLotId: inventoryMap['LOT2024004'].id,
    },

    // Pedro's dose - external, WAITING_DELIVERY
    {
      id: 'dose-013',
      treatmentId: treatment8.id,
      cycleNumber: 1,
      applicationDate: subtractDays(TODAY, 180),
      lotNumber: 'LOT2024001',
      expiryDate: new Date('2025-12-31'),
      status: DoseStatus.APPLIED,
      paymentStatus: PaymentStatus.WAITING_DELIVERY,
      surveyStatus: SurveyStatus.ANSWERED,
      surveyScore: 6,
      surveyComment: 'Entrega demorou.',
      inventoryLotId: inventoryMap['LOT2024001'].id,
    },

    // Beatriz's doses - suspended treatment
    {
      id: 'dose-014',
      treatmentId: treatment9.id,
      cycleNumber: 1,
      applicationDate: subtractDays(TODAY, 90),
      lotNumber: 'LOT2024005',
      expiryDate: new Date('2025-10-31'),
      status: DoseStatus.APPLIED,
      paymentStatus: PaymentStatus.PAID,
      surveyStatus: SurveyStatus.WAITING,
      inventoryLotId: inventoryMap['LOT2024005'].id,
    },
    {
      id: 'dose-015',
      treatmentId: treatment9.id,
      cycleNumber: 2,
      applicationDate: subtractDays(TODAY, 60),
      lotNumber: 'LOT2024005',
      expiryDate: new Date('2025-10-31'),
      status: DoseStatus.APPLIED,
      paymentStatus: PaymentStatus.PAID,
      surveyStatus: SurveyStatus.ANSWERED,
      surveyScore: 5,
      surveyComment: 'Atendimento ok, mas demorou.',
      inventoryLotId: inventoryMap['LOT2024005'].id,
    },

    // ============== NURSING TEST DATA ==============
    // More doses with nurse: true for Enfermagem page testing
    // All dates are unique to avoid duplication

    // Maria - nursing dose for TODAY morning (pending)
    {
      id: 'dose-016',
      treatmentId: treatment1.id,
      cycleNumber: 5,
      applicationDate: TODAY,
      lotNumber: 'LOT2024010',
      expiryDate: new Date('2026-06-30'),
      status: DoseStatus.PENDING,
      paymentStatus: PaymentStatus.PAID,
      surveyStatus: SurveyStatus.NOT_SENT,
      inventoryLotId: inventoryMap['LOT2024010'].id,
      nurse: true,
    },

    // Lucas - nursing dose for 2 days from now (pending)
    {
      id: 'dose-017',
      treatmentId: treatment4.id,
      cycleNumber: 2,
      applicationDate: addDays(TODAY, 2),
      lotNumber: 'LOT2024002',
      expiryDate: new Date('2025-06-30'),
      status: DoseStatus.PENDING,
      paymentStatus: PaymentStatus.WAITING_PIX,
      surveyStatus: SurveyStatus.NOT_SENT,
      inventoryLotId: inventoryMap['LOT2024002'].id,
      nurse: true,
    },

    // Alex - nursing dose applied 7 days ago with survey (promoter - score 9)
    {
      id: 'dose-018',
      treatmentId: treatment6.id,
      cycleNumber: 2,
      applicationDate: subtractDays(TODAY, 7),
      lotNumber: 'LOT2024003',
      expiryDate: new Date('2025-09-30'),
      status: DoseStatus.APPLIED,
      paymentStatus: PaymentStatus.PAID,
      surveyStatus: SurveyStatus.ANSWERED,
      surveyScore: 9,
      surveyComment: 'Excelente atendimento da enfermagem!',
      inventoryLotId: inventoryMap['LOT2024003'].id,
      nurse: true,
    },

    // Maria - nursing dose applied 12 days ago with survey (promoter - score 10)
    {
      id: 'dose-019',
      treatmentId: treatment1.id,
      cycleNumber: 6,
      applicationDate: subtractDays(TODAY, 12),
      lotNumber: 'LOT2024010',
      expiryDate: new Date('2026-06-30'),
      status: DoseStatus.APPLIED,
      paymentStatus: PaymentStatus.PAID,
      surveyStatus: SurveyStatus.ANSWERED,
      surveyScore: 10,
      surveyComment: 'Atendimento perfeito!',
      inventoryLotId: inventoryMap['LOT2024010'].id,
      nurse: true,
    },

    // Joao - nursing dose applied 18 days ago with survey (passive - score 7)
    {
      id: 'dose-020',
      treatmentId: treatment2.id,
      cycleNumber: 4,
      applicationDate: subtractDays(TODAY, 18),
      lotNumber: 'LOT2024004',
      expiryDate: new Date('2025-08-31'),
      status: DoseStatus.APPLIED,
      paymentStatus: PaymentStatus.PAID,
      surveyStatus: SurveyStatus.ANSWERED,
      surveyScore: 7,
      surveyComment: 'Atendimento bom, nada de especial.',
      inventoryLotId: inventoryMap['LOT2024004'].id,
      nurse: true,
    },

    // Lucas - nursing dose applied 25 days ago with survey (detractor - score 4)
    {
      id: 'dose-021',
      treatmentId: treatment4.id,
      cycleNumber: 3,
      applicationDate: subtractDays(TODAY, 25),
      lotNumber: 'LOT2024002',
      expiryDate: new Date('2025-06-30'),
      status: DoseStatus.APPLIED,
      paymentStatus: PaymentStatus.PAID,
      surveyStatus: SurveyStatus.ANSWERED,
      surveyScore: 4,
      surveyComment: 'Esperei muito tempo para ser atendido.',
      inventoryLotId: inventoryMap['LOT2024002'].id,
      nurse: true,
    },

    // Alex - nursing dose applied 40 days ago with survey (promoter - score 10)
    {
      id: 'dose-022',
      treatmentId: treatment6.id,
      cycleNumber: 3,
      applicationDate: subtractDays(TODAY, 40),
      lotNumber: 'LOT2024003',
      expiryDate: new Date('2025-09-30'),
      status: DoseStatus.APPLIED,
      paymentStatus: PaymentStatus.PAID,
      surveyStatus: SurveyStatus.ANSWERED,
      surveyScore: 10,
      surveyComment: 'Servico impecavel!',
      inventoryLotId: inventoryMap['LOT2024003'].id,
      nurse: true,
    },

    // Maria - nursing dose NOT_ACCEPTED 4 days ago (refused)
    {
      id: 'dose-023',
      treatmentId: treatment1.id,
      cycleNumber: 7,
      applicationDate: subtractDays(TODAY, 4),
      lotNumber: 'LOT2024010',
      expiryDate: new Date('2026-06-30'),
      status: DoseStatus.NOT_ACCEPTED,
      paymentStatus: PaymentStatus.PAID,
      surveyStatus: SurveyStatus.NOT_SENT,
      inventoryLotId: inventoryMap['LOT2024010'].id,
      nurse: true,
    },

    // Joao - nursing dose for tomorrow (pending - scheduled)
    {
      id: 'dose-024',
      treatmentId: treatment2.id,
      cycleNumber: 5,
      applicationDate: addDays(TODAY, 1),
      lotNumber: 'LOT2024004',
      expiryDate: new Date('2025-08-31'),
      status: DoseStatus.PENDING,
      paymentStatus: PaymentStatus.WAITING_CARD,
      surveyStatus: SurveyStatus.NOT_SENT,
      inventoryLotId: inventoryMap['LOT2024004'].id,
      nurse: true,
    },

    // Alex - nursing dose 5 days from now without lot/expiry (no medication purchase)
    {
      id: 'dose-025',
      treatmentId: treatment6.id,
      cycleNumber: 4,
      applicationDate: addDays(TODAY, 5),
      status: DoseStatus.PENDING,
      paymentStatus: PaymentStatus.PAID,
      surveyStatus: SurveyStatus.NOT_SENT,
      nurse: true,
    },
  ];

  for (const dose of allDoses) {
    const frequencyDays = treatmentFrequencyMap[dose.treatmentId] || 28;
    const { calculatedNextDate, daysUntilNext } = calculateDoseFields(dose.applicationDate, frequencyDays);

    await prisma.dose.upsert({
      where: { id: dose.id },
      update: {},
      create: {
        ...dose,
        calculatedNextDate,
        daysUntilNext,
      },
    });
  }
  console.log('Created', allDoses.length, 'doses');

  // ============== CONSENT DOCUMENTS ==============
  console.log('\n--- Creating Consent Documents ---');

  const documents = [
    { id: 'doc-001', patientId: patient1.id, fileName: 'Termo_Consentimento_Maria.pdf', fileType: 'pdf', fileUrl: '/uploads/patient-001/termo.pdf', uploadedBy: admin.id, uploadDate: subtractDays(TODAY, 95) },
    { id: 'doc-002', patientId: patient2.id, fileName: 'Termo_Consentimento_Joao.pdf', fileType: 'pdf', fileUrl: '/uploads/patient-002/termo.pdf', uploadedBy: secretary.id, uploadDate: subtractDays(TODAY, 65) },
    { id: 'doc-003', patientId: patient4.id, fileName: 'Termo_Consentimento_Lucas.pdf', fileType: 'pdf', fileUrl: '/uploads/patient-004/termo.pdf', uploadedBy: admin.id, uploadDate: subtractDays(TODAY, 50) },
    { id: 'doc-004', patientId: patient5.id, fileName: 'Termo_Consentimento_Isabella.pdf', fileType: 'pdf', fileUrl: '/uploads/patient-005/termo.pdf', uploadedBy: secretary.id, uploadDate: subtractDays(TODAY, 370) },
    { id: 'doc-005', patientId: patient7.id, fileName: 'Termo_Consentimento_Alex.pdf', fileType: 'pdf', fileUrl: '/uploads/patient-007/termo.pdf', uploadedBy: admin.id, uploadDate: subtractDays(TODAY, 25) },
    { id: 'doc-006', patientId: patient9.id, fileName: 'Termo_Consentimento_Pedro.pdf', fileType: 'pdf', fileUrl: '/uploads/patient-009/termo.pdf', uploadedBy: secretary.id, uploadDate: subtractDays(TODAY, 185) },
  ];

  for (const doc of documents) {
    await prisma.consentDocument.upsert({
      where: { id: doc.id },
      update: {},
      create: doc,
    });
  }
  console.log('Created', documents.length, 'consent documents');

  // ============== DISMISSED LOGS ==============
  console.log('\n--- Creating Dismissed Logs ---');

  const dismissedLogs = [
    { id: 'dismissed-001', contactId: `${treatment1.id}_m_7`, dismissedAt: subtractDays(TODAY, 83) },
    { id: 'dismissed-002', contactId: `${treatment1.id}_m_15`, dismissedAt: subtractDays(TODAY, 75) },
    { id: 'dismissed-003', contactId: `${treatment2.id}_m_7`, dismissedAt: subtractDays(TODAY, 53) },
    { id: 'dismissed-004', contactId: `${treatment4.id}_m_7`, dismissedAt: subtractDays(TODAY, 38) },
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
    { patientId: patient1.id, inventoryItemId: inventoryMap['LOT2024001'].id, medicationName: 'Lectrum 3.75mg', quantity: 1, doseId: 'dose-001', date: subtractDays(TODAY, 90) },
    { patientId: patient1.id, inventoryItemId: inventoryMap['LOT2024001'].id, medicationName: 'Lectrum 3.75mg', quantity: 1, doseId: 'dose-002', date: subtractDays(TODAY, 62) },
    { patientId: patient1.id, inventoryItemId: inventoryMap['LOT2024010'].id, medicationName: 'Lectrum 3.75mg', quantity: 1, doseId: 'dose-003', date: subtractDays(TODAY, 34) },
    { patientId: patient2.id, inventoryItemId: inventoryMap['LOT2024004'].id, medicationName: 'Norditropin 12mg', quantity: 1, doseId: 'dose-005', date: subtractDays(TODAY, 60) },
    { patientId: patient2.id, inventoryItemId: inventoryMap['LOT2024004'].id, medicationName: 'Norditropin 12mg', quantity: 1, doseId: 'dose-006', date: subtractDays(TODAY, 30) },
    { patientId: patient4.id, inventoryItemId: inventoryMap['LOT2024002'].id, medicationName: 'Neodeca 11.25mg', quantity: 1, doseId: 'dose-008', date: subtractDays(TODAY, 45) },
    { patientId: patient7.id, inventoryItemId: inventoryMap['LOT2024003'].id, medicationName: 'Neodeca 22.5mg', quantity: 1, doseId: 'dose-011', date: subtractDays(TODAY, 20) },
    { patientId: patient10.id, inventoryItemId: inventoryMap['LOT2024005'].id, medicationName: 'Norditropin 24mg', quantity: 1, doseId: 'dose-014', date: subtractDays(TODAY, 90) },
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
    { medicationName: 'Norditropin 24mg', predictedConsumption10Days: 2, currentStock: 8, suggestedQuantity: 5, status: 'RECEIVED' as const },
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
  console.log('\n--- COVERAGE SUMMARY ---');
  console.log('\nGenders: F(5), M(4), OTHER(1)');
  console.log('Diagnoses: All 6 types covered');
  console.log('Cities: SP, RJ, MG, PR, BA, RS, DF, PE');
  console.log('\nTreatment Statuses:');
  console.log('  ONGOING: 5 | FINISHED: 1 | REFUSED: 1 | EXTERNAL: 1 | SUSPENDED: 1');
  console.log('\nDose Statuses:');
  console.log('  APPLIED: 17 | PENDING: 6 | NOT_ACCEPTED: 2');
  console.log('\nPayment Statuses:');
  console.log('  PAID: Multiple | WAITING_PIX: 2 | WAITING_CARD: 2 | WAITING_BOLETO: 1 | WAITING_DELIVERY: 1');
  console.log('\nSurvey Statuses:');
  console.log('  ANSWERED: 12 | SENT: 2 | WAITING: 2 | NOT_SENT: 9');
  console.log('\nSurvey Scores: 4, 5, 6, 7, 8, 9, 10 (varied for NPS)');
  console.log('\nNursing (Enfermagem) Test Data:');
  console.log('  - 10 doses with nurse: true');
  console.log('  - 4 PENDING doses for today/future (Agendado status)');
  console.log('  - 5 APPLIED doses with surveys (various NPS scores)');
  console.log('  - 1 NOT_ACCEPTED dose (Recusado status)');
  console.log('  - NPS test scores: 4 (detractor), 7 (passive), 9, 10 (promoters)');
  console.log('\nSpecial Cases:');
  console.log('  - Gabriel: Incomplete registration (no guardian/address)');
  console.log('  - Ana Carolina: Monitoring protocol (no medication)');
  console.log('  - dose-025: No lot/expiry (medication not purchased)');
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
