require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const prisma = new PrismaClient();

async function reconcile() {
  console.log('--- Starting Payment Reconciliation ---');
  
  // Find all PENDING payments that have a Stripe session ID
  const pendingPayments = await prisma.payment.findMany({
    where: {
      status: 'PENDING',
      stripeSessionId: { not: null }
    }
  });

  console.log(`Found ${pendingPayments.length} pending payments with Stripe sessions.`);

  for (const payment of pendingPayments) {
    try {
      console.log(`Checking payment ${payment.paymentReference} (Session: ${payment.stripeSessionId})...`);
      
      const session = await stripe.checkout.sessions.retrieve(payment.stripeSessionId);
      
      if (session.payment_status === 'paid') {
        console.log(`✅ Payment ${payment.paymentReference} is actually PAID in Stripe! Updating database...`);
        
        await prisma.payment.update({
          where: { id: payment.id },
          data: {
            status: 'PAID',
            stripePaymentIntentId: session.payment_intent,
            paidAt: payment.paidAt || new Date(session.created * 1000), // Approximate if unknown
          }
        });

        // Also update application status if applicable
        if (payment.applicationId) {
          await prisma.application.update({
            where: { id: payment.applicationId },
            data: {
              status: 'SUBMITTED',
              submittedAt: payment.paidAt || new Date()
            }
          });
          console.log(`   - Linked application status updated to SUBMITTED.`);
        }
      } else {
        console.log(`   - Payment ${payment.paymentReference} status in Stripe is: ${session.payment_status}`);
      }
    } catch (error) {
      console.error(`❌ Error checking payment ${payment.paymentReference}:`, error.message);
    }
  }

  console.log('--- Reconciliation Finished ---');
}

reconcile()
  .catch(e => console.error(e))
  .finally(async () => await prisma.$disconnect());
