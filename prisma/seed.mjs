import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import bcrypt from 'bcryptjs';
import 'dotenv/config';

// Initialize Prisma Client with the same adapter pattern as your app
const connectionString = process.env.DATABASE_URL;
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('🌱 Starting seeding...');

  // Clear existing data (optional - be careful in production!)
  console.log('Cleaning existing data...');
  await prisma.$transaction([
    prisma.activityLog.deleteMany(),
    prisma.documentVersion.deleteMany(),
    prisma.document.deleteMany(),
    prisma.consultantNote.deleteMany(),
    prisma.payment.deleteMany(),
    prisma.applicationStatusHistory.deleteMany(),
    prisma.consultantAssignment.deleteMany(),
    prisma.application.deleteMany(),
    prisma.booking.deleteMany(),
    prisma.invitation.deleteMany(),
    prisma.user.deleteMany(),
    prisma.service.deleteMany(),
  ]);

  // ==================== CREATE SUPER ADMIN ====================
  console.log('👑 Creating Super Admin...');
  
  const superAdminPassword = await bcrypt.hash('Admin@123', 10);
  
  const superAdmin = await prisma.user.create({
    data: {
      email: 'admin@immigration.com',
      passwordHash: superAdminPassword,
      firstName: 'Super',
      lastName: 'Admin',
      role: 'SUPER_ADMIN',
      isActive: true,
      phone: '+1234567890',
    },
  });
  
  console.log(`✅ Super Admin created: ${superAdmin.email}`);

  // ==================== CREATE SERVICES ====================
  console.log('📋 Creating services...');
  
  const services = await Promise.all([
    prisma.service.create({
      data: {
        name: 'Student Visa Consultation',
        description: 'Expert guidance for student visa applications including document preparation and interview coaching.',
        serviceType: 'CONSULTATION',
        basePrice: 150.00,
        currency: 'USD',
        isActive: true,
      },
    }),
    prisma.service.create({
      data: {
        name: 'Work Visa Processing',
        description: 'Complete work visa application processing with employer verification and legal review.',
        serviceType: 'PROCESSING',
        basePrice: 500.00,
        currency: 'USD',
        isActive: true,
      },
    }),
    prisma.service.create({
      data: {
        name: 'Permanent Residency',
        description: 'Full PR application assistance including points calculation, document gathering, and submission.',
        serviceType: 'PROCESSING',
        basePrice: 1000.00,
        currency: 'USD',
        isActive: true,
      },
    }),
    prisma.service.create({
      data: {
        name: 'Citizenship Application',
        description: 'Assistance with citizenship applications, naturalization process, and ceremony preparation.',
        serviceType: 'PROCESSING',
        basePrice: 800.00,
        currency: 'USD',
        isActive: true,
      },
    }),
    prisma.service.create({
      data: {
        name: 'Family Sponsorship',
        description: 'Help with sponsoring family members for immigration, including paperwork and eligibility assessment.',
        serviceType: 'PROCESSING',
        basePrice: 750.00,
        currency: 'USD',
        isActive: true,
      },
    }),
  ]);
  
  console.log(`✅ Created ${services.length} services`);

  // ==================== CREATE CONSULTANTS ====================
  console.log('👨‍💼 Creating consultants...');
  
  const consultant1Password = await bcrypt.hash('Consultant@123', 10);
  const consultant2Password = await bcrypt.hash('Consultant@123', 10);
  
  const consultants = await Promise.all([
    prisma.user.create({
      data: {
        email: 'john.consultant@immigration.com',
        passwordHash: consultant1Password,
        firstName: 'John',
        lastName: 'Smith',
        role: 'CONSULTANT',
        isActive: true,
        phone: '+1234567891',
      },
    }),
    prisma.user.create({
      data: {
        email: 'jane.consultant@immigration.com',
        passwordHash: consultant2Password,
        firstName: 'Jane',
        lastName: 'Doe',
        role: 'CONSULTANT',
        isActive: true,
        phone: '+1234567892',
      },
    }),
    prisma.user.create({
      data: {
        email: 'michael.consultant@immigration.com',
        passwordHash: await bcrypt.hash('Consultant@123', 10),
        firstName: 'Michael',
        lastName: 'Chen',
        role: 'CONSULTANT',
        isActive: true,
        phone: '+1234567893',
      },
    }),
  ]);
  
  console.log(`✅ Created ${consultants.length} consultants`);

  // ==================== CREATE CLIENTS ====================
  console.log('👤 Creating sample clients...');
  
  const client1Password = await bcrypt.hash('Client@123', 10);
  const client2Password = await bcrypt.hash('Client@123', 10);
  
  const clients = await Promise.all([
    prisma.user.create({
      data: {
        email: 'alice.client@example.com',
        passwordHash: client1Password,
        firstName: 'Alice',
        lastName: 'Johnson',
        role: 'CLIENT',
        isActive: true,
        phone: '+1234567894',
      },
    }),
    prisma.user.create({
      data: {
        email: 'bob.client@example.com',
        passwordHash: client2Password,
        firstName: 'Bob',
        lastName: 'Williams',
        role: 'CLIENT',
        isActive: true,
        phone: '+1234567895',
      },
    }),
    prisma.user.create({
      data: {
        email: 'carol.client@example.com',
        passwordHash: await bcrypt.hash('Client@123', 10),
        firstName: 'Carol',
        lastName: 'Martinez',
        role: 'CLIENT',
        isActive: true,
        phone: '+1234567896',
      },
    }),
  ]);
  
  console.log(`✅ Created ${clients.length} clients`);

  // ==================== CREATE APPLICATIONS ====================
  console.log('📄 Creating sample applications...');
  
  // Application 1 - Draft
  const app1 = await prisma.application.create({
    data: {
      applicationNumber: `APP-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      clientId: clients[0].id,
      serviceId: services[0].id,
      status: 'DRAFT',
      country: 'Canada',
      formData: {
        education: 'Bachelor of Science in Computer Science',
        workExperience: 3,
        maritalStatus: 'single',
        languageScores: {
          ielts: 7.5,
        },
      },
    },
  });

  // Application 2 - Submitted (needs consultant assignment)
  const app2 = await prisma.application.create({
    data: {
      applicationNumber: `APP-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      clientId: clients[1].id,
      serviceId: services[1].id,
      status: 'SUBMITTED',
      country: 'Australia',
      submittedAt: new Date(),
      formData: {
        education: 'Master of Business Administration',
        workExperience: 8,
        maritalStatus: 'married',
        jobOffer: true,
      },
    },
  });

  // Application 3 - Under Review (assigned to consultant)
  const app3 = await prisma.application.create({
    data: {
      applicationNumber: `APP-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      clientId: clients[2].id,
      consultantId: consultants[0].id,
      serviceId: services[2].id,
      status: 'UNDER_REVIEW',
      country: 'New Zealand',
      submittedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 7 days ago
      assignedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000), // 5 days ago
      assignedById: superAdmin.id,
      formData: {
        education: 'PhD in Engineering',
        workExperience: 12,
        maritalStatus: 'married',
        children: 2,
      },
    },
  });

  // Create consultant assignment record
  await prisma.consultantAssignment.create({
    data: {
      applicationId: app3.id,
      consultantId: consultants[0].id,
      assignedById: superAdmin.id,
      isCurrent: true,
    },
  });

  // Application 4 - Documents Missing
  const app4 = await prisma.application.create({
    data: {
      applicationNumber: `APP-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      clientId: clients[0].id,
      consultantId: consultants[1].id,
      serviceId: services[3].id,
      status: 'DOCUMENTS_MISSING',
      country: 'UK',
      submittedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
      assignedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
      assignedById: superAdmin.id,
      formData: {
        education: 'Bachelor of Arts',
        workExperience: 5,
        maritalStatus: 'single',
      },
    },
  });

  await prisma.consultantAssignment.create({
    data: {
      applicationId: app4.id,
      consultantId: consultants[1].id,
      assignedById: superAdmin.id,
      isCurrent: true,
    },
  });

  // Add a consultant note for app4
  await prisma.consultantNote.create({
    data: {
      applicationId: app4.id,
      consultantId: consultants[1].id,
      noteType: 'CLIENT_VISIBLE',
      content: 'Please provide your police clearance certificate and updated bank statements.',
    },
  });

  // Application 5 - Processing
  const app5 = await prisma.application.create({
    data: {
      applicationNumber: `APP-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      clientId: clients[1].id,
      consultantId: consultants[2].id,
      serviceId: services[4].id,
      status: 'PROCESSING',
      country: 'Canada',
      submittedAt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000),
      assignedAt: new Date(Date.now() - 12 * 24 * 60 * 60 * 1000),
      assignedById: superAdmin.id,
      formData: {
        education: 'Master of Science',
        workExperience: 6,
        maritalStatus: 'married',
        spouseIncluded: true,
      },
    },
  });

  await prisma.consultantAssignment.create({
    data: {
      applicationId: app5.id,
      consultantId: consultants[2].id,
      assignedById: superAdmin.id,
      isCurrent: true,
    },
  });

  console.log(`✅ Created 5 sample applications`);

  // ==================== CREATE BOOKINGS ====================
  console.log('📅 Creating sample bookings...');
  
  const now = new Date();
  
  // Past booking - Completed
  await prisma.booking.create({
    data: {
      bookingReference: `BK-${Date.now()}-COMP`,
      clientId: clients[0].id,
      clientEmail: clients[0].email,
      clientName: `${clients[0].firstName} ${clients[0].lastName}`,
      clientPhone: clients[0].phone,
      serviceId: services[0].id,
      bookingStatus: 'COMPLETED',
      scheduledStart: new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000),
      scheduledEnd: new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000 + 60 * 60 * 1000),
      timezone: 'America/New_York',
      meetingLink: 'https://meet.google.com/abc-defg-hij',
      approvedById: superAdmin.id,
      approvedAt: new Date(now.getTime() - 12 * 24 * 60 * 60 * 1000),
      completedAt: new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000 + 2 * 60 * 60 * 1000),
    },
  });

  // Future booking - Approved
  await prisma.booking.create({
    data: {
      bookingReference: `BK-${Date.now()}-APP`,
      clientId: clients[1].id,
      clientEmail: clients[1].email,
      clientName: `${clients[1].firstName} ${clients[1].lastName}`,
      clientPhone: clients[1].phone,
      serviceId: services[1].id,
      bookingStatus: 'APPROVED',
      scheduledStart: new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000),
      scheduledEnd: new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000 + 60 * 60 * 1000),
      timezone: 'Australia/Sydney',
      meetingLink: 'https://meet.google.com/xyz-uvwx-yz',
      approvedById: superAdmin.id,
      approvedAt: new Date(),
    },
  });

  // Pending booking
  await prisma.booking.create({
    data: {
      bookingReference: `BK-${Date.now()}-PEND`,
      clientId: clients[2].id,
      clientEmail: clients[2].email,
      clientName: `${clients[2].firstName} ${clients[2].lastName}`,
      clientPhone: clients[2].phone,
      serviceId: services[2].id,
      bookingStatus: 'PENDING',
      scheduledStart: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000),
      scheduledEnd: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000 + 60 * 60 * 1000),
      timezone: 'Europe/London',
    },
  });

  console.log(`✅ Created 3 sample bookings`);

  // ==================== SUMMARY ====================
  console.log('\n📊 SEEDING SUMMARY');
  console.log('==================');
  console.log(`👑 Super Admin: admin@immigration.com / Admin@123`);
  console.log(`👨‍💼 Consultants: ${consultants.length} (e.g., john.consultant@immigration.com / Consultant@123)`);
  console.log(`👤 Clients: ${clients.length} (e.g., alice.client@example.com / Client@123)`);
  console.log(`📋 Services: ${services.length}`);
  console.log(`📄 Applications: 5`);
  console.log(`📅 Bookings: 3`);
  console.log('\n✅ Seeding completed successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Error during seeding:');
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });