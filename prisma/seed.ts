import { PrismaClient, UserRole, ProtocolCategory } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // Create default admin user
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
  console.log('Created admin user:', admin.email);

  // Create doctor user
  const doctorPassword = await bcrypt.hash('doctor123', 12);
  const doctor = await prisma.user.upsert({
    where: { email: 'medico@azevedo.com' },
    update: {},
    create: {
      email: 'medico@azevedo.com',
      password: doctorPassword,
      name: 'Dr. Silva',
      role: UserRole.DOCTOR,
    },
  });
  console.log('Created doctor user:', doctor.email);

  // Create secretary user
  const secretaryPassword = await bcrypt.hash('secretary123', 12);
  const secretary = await prisma.user.upsert({
    where: { email: 'secretaria@azevedo.com' },
    update: {},
    create: {
      email: 'secretaria@azevedo.com',
      password: secretaryPassword,
      name: 'Maria Secretária',
      role: UserRole.SECRETARY,
    },
  });
  console.log('Created secretary user:', secretary.email);

  // Create diagnoses
  const diagnoses = [
    { name: 'Puberdade Precoce', color: '#3B82F6' },
    { name: 'Baixa Estatura', color: '#10B981' },
    { name: 'Hipotireoidismo', color: '#F59E0B' },
    { name: 'Diabetes Tipo 1', color: '#EF4444' },
    { name: 'Obesidade Infantil', color: '#8B5CF6' },
  ];

  for (const diagnosis of diagnoses) {
    await prisma.diagnosis.upsert({
      where: { name: diagnosis.name },
      update: {},
      create: diagnosis,
    });
  }
  console.log('Created diagnoses');

  // Create medication bases
  const medications = [
    {
      activeIngredient: 'Acetato de Leuprorrelina',
      dosage: '3.75mg',
      tradeName: 'Lectrum',
      manufacturer: 'Eurofarma',
      pharmaceuticalForm: 'Ampola',
    },
    {
      activeIngredient: 'Acetato de Leuprorrelina',
      dosage: '11.25mg',
      tradeName: 'Neodeca',
      manufacturer: 'Eurofarma',
      pharmaceuticalForm: 'Ampola',
    },
    {
      activeIngredient: 'Acetato de Leuprorrelina',
      dosage: '22.5mg',
      tradeName: 'Neodeca',
      manufacturer: 'Eurofarma',
      pharmaceuticalForm: 'Ampola',
    },
    {
      activeIngredient: 'Somatropina',
      dosage: '12mg',
      tradeName: 'Norditropin',
      manufacturer: 'Novo Nordisk',
      pharmaceuticalForm: 'Caneta',
    },
    {
      activeIngredient: 'Somatropina',
      dosage: '24mg',
      tradeName: 'Norditropin',
      manufacturer: 'Novo Nordisk',
      pharmaceuticalForm: 'Caneta',
    },
  ];

  for (const med of medications) {
    await prisma.medicationBase.upsert({
      where: {
        activeIngredient_dosage: {
          activeIngredient: med.activeIngredient,
          dosage: med.dosage,
        },
      },
      update: {},
      create: med,
    });
  }
  console.log('Created medication bases');

  // Create protocols
  const protocols = [
    {
      name: 'Puberdade Precoce - Mensal',
      category: ProtocolCategory.MEDICATION,
      medicationType: 'Acetato de Leuprorrelina 3.75mg',
      frequencyDays: 28,
      goal: 'Bloquear progressão puberal',
      message: 'Lembrete: Aplicação mensal de Leuprorrelina 3.75mg',
      milestones: [
        { day: 7, message: 'Verificar efeitos colaterais da primeira semana' },
        { day: 21, message: 'Confirmar agendamento da próxima aplicação' },
      ],
    },
    {
      name: 'Puberdade Precoce - Trimestral',
      category: ProtocolCategory.MEDICATION,
      medicationType: 'Acetato de Leuprorrelina 11.25mg',
      frequencyDays: 84,
      goal: 'Bloquear progressão puberal',
      message: 'Lembrete: Aplicação trimestral de Leuprorrelina 11.25mg',
      milestones: [
        { day: 7, message: 'Verificar efeitos colaterais da primeira semana' },
        { day: 60, message: 'Agendar próxima aplicação' },
        { day: 77, message: 'Confirmar agendamento da próxima aplicação' },
      ],
    },
    {
      name: 'Puberdade Precoce - Semestral',
      category: ProtocolCategory.MEDICATION,
      medicationType: 'Acetato de Leuprorrelina 22.5mg',
      frequencyDays: 168,
      goal: 'Bloquear progressão puberal',
      message: 'Lembrete: Aplicação semestral de Leuprorrelina 22.5mg',
      milestones: [
        { day: 7, message: 'Verificar efeitos colaterais' },
        { day: 90, message: 'Contato de acompanhamento' },
        { day: 150, message: 'Agendar próxima aplicação' },
      ],
    },
    {
      name: 'Baixa Estatura - GH Diário',
      category: ProtocolCategory.MEDICATION,
      medicationType: 'Somatropina 12mg',
      frequencyDays: 30,
      goal: 'Estimular crescimento linear',
      message: 'Acompanhamento mensal do tratamento com GH',
      milestones: [
        { day: 15, message: 'Verificar técnica de aplicação' },
        { day: 25, message: 'Agendar próxima consulta' },
      ],
    },
    {
      name: 'Acompanhamento Trimestral',
      category: ProtocolCategory.MONITORING,
      medicationType: null,
      frequencyDays: 90,
      goal: 'Monitoramento clínico e laboratorial',
      message: 'Consulta de acompanhamento trimestral',
      milestones: [
        { day: 75, message: 'Solicitar exames de controle' },
        { day: 83, message: 'Confirmar agendamento da consulta' },
      ],
    },
  ];

  for (const protocol of protocols) {
    const { milestones, ...protocolData } = protocol;
    const existingProtocol = await prisma.protocol.findUnique({
      where: { name: protocol.name },
    });

    if (!existingProtocol) {
      await prisma.protocol.create({
        data: {
          ...protocolData,
          milestones: {
            create: milestones,
          },
        },
      });
    }
  }
  console.log('Created protocols');

  // Create sample inventory
  const inventoryItems = [
    {
      medicationName: 'Lectrum 3.75mg',
      lotNumber: 'LOT2024001',
      expiryDate: new Date('2025-12-31'),
      quantity: 20,
      unit: 'Ampola',
    },
    {
      medicationName: 'Neodeca 11.25mg',
      lotNumber: 'LOT2024002',
      expiryDate: new Date('2025-06-30'),
      quantity: 15,
      unit: 'Ampola',
    },
    {
      medicationName: 'Neodeca 22.5mg',
      lotNumber: 'LOT2024003',
      expiryDate: new Date('2025-09-30'),
      quantity: 10,
      unit: 'Ampola',
    },
    {
      medicationName: 'Norditropin 12mg',
      lotNumber: 'LOT2024004',
      expiryDate: new Date('2025-03-31'),
      quantity: 8,
      unit: 'Caneta',
    },
  ];

  for (const item of inventoryItems) {
    await prisma.inventoryItem.upsert({
      where: {
        medicationName_lotNumber: {
          medicationName: item.medicationName,
          lotNumber: item.lotNumber,
        },
      },
      update: {},
      create: item,
    });
  }
  console.log('Created inventory items');

  // Create sample patient
  const patient = await prisma.patient.upsert({
    where: { id: 'sample-patient-1' },
    update: {},
    create: {
      id: 'sample-patient-1',
      fullName: 'Maria Silva Santos',
      birthDate: new Date('2015-03-15'),
      gender: 'F',
      mainDiagnosis: 'Puberdade Precoce',
      clinicalNotes: 'Paciente em acompanhamento desde janeiro de 2024',
      active: true,
      guardian: {
        create: {
          fullName: 'Ana Paula Silva',
          phonePrimary: '11999999999',
          phoneSecondary: '11888888888',
          email: 'ana.silva@email.com',
          relationship: 'Mãe',
        },
      },
      address: {
        create: {
          street: 'Rua das Flores',
          number: '123',
          complement: 'Apto 45',
          neighborhood: 'Centro',
          city: 'São Paulo',
          state: 'SP',
          zipCode: '01310100',
        },
      },
    },
  });
  console.log('Created sample patient:', patient.fullName);

  console.log('Seeding completed!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
