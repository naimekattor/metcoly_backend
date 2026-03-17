import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import 'dotenv/config';

const connectionString = process.env.DATABASE_URL;
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const servicesData = [
  {
    name: 'Student Visa Consultation',
    description: 'Expert guidance for student visa applications including document preparation and interview coaching.',
    serviceType: 'CONSULTATION',
    basePrice: 150.00,
    currency: 'USD',
    isActive: true,
  },
  {
    name: 'Work Visa Processing',
    description: 'Complete work visa application processing with employer verification and legal review.',
    serviceType: 'PROCESSING',
    basePrice: 500.00,
    currency: 'USD',
    isActive: true,
  },
  {
    name: 'Permanent Residency',
    description: 'Full PR application assistance including points calculation, document gathering, and submission.',
    serviceType: 'PROCESSING',
    basePrice: 1000.00,
    currency: 'USD',
    isActive: true,
  },
  {
    name: 'Citizenship Application',
    description: 'Assistance with citizenship applications, naturalization process, and ceremony preparation.',
    serviceType: 'PROCESSING',
    basePrice: 800.00,
    currency: 'USD',
    isActive: true,
  },
  {
    name: 'Family Sponsorship',
    description: 'Help with sponsoring family members for immigration, including paperwork and eligibility assessment.',
    serviceType: 'PROCESSING',
    basePrice: 750.00,
    currency: 'USD',
    isActive: true,
  },
  {
    name: 'Tourist Visa Assistance',
    description: 'Fast-track tourist visa assistance with itinerary planning, document checklist, and hotel bookings.',
    serviceType: 'CONSULTATION',
    basePrice: 100.00,
    currency: 'USD',
    isActive: true,
  },
];

async function main() {
  console.log('🌱 Seeding services...');

  const existingCount = await prisma.service.count();
  if (existingCount > 0) {
    console.log(`ℹ️  ${existingCount} services already exist. Skipping to avoid duplicates.`);
    console.log('   Delete existing services first if you want to re-seed.');
    return;
  }

  for (const service of servicesData) {
    const created = await prisma.service.create({ data: service });
    console.log(`✅ Created: ${created.name} ($${created.basePrice})`);
  }

  console.log(`\n✅ Done! ${servicesData.length} services seeded.`);
}

main()
  .catch((e) => {
    console.error('❌ Error seeding services:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
