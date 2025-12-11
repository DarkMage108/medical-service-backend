import { PrismaClient, UserRole, ProtocolCategory } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database with admin user only...');

  // ============== ADMIN USER ==============
  console.log('\n--- Creating Admin User ---');

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

  console.log('Created admin user: admin@azevedo.com');

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
  }
  console.log('Created', protocolsData.length, 'protocols with milestones');

  // ============== SUMMARY ==============
  console.log('\n========================================');
  console.log('SEED COMPLETED SUCCESSFULLY!');
  console.log('========================================');
  console.log('\nAdmin User:');
  console.log('  Email: admin@azevedo.com');
  console.log('  Password: admin123');
  console.log('\nBase Data Created:');
  console.log('  - 6 Diagnoses');
  console.log('  - 6 Medication Bases');
  console.log('  - 5 Protocols with milestones');
  console.log('\nNo test patients, treatments, doses, or other data created.');
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
