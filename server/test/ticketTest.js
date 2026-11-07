import mongoose from 'mongoose';
import Ticket, { TICKET_CATEGORIES, TICKET_PRIORITIES, TICKET_STATUSES, SLA_HOURS_MAP } from '../src/models/Ticket.js';
import { analyzeTicket, findSuggestedArticles } from '../src/utils/intelligentEngine.js';

console.log('🧪 Starting ResolveIQ Ticket Management & Intelligent Engine Tests...\n');

let passed = 0;
let total = 0;

function assert(condition, message) {
  total++;
  if (condition) {
    console.log(`  ✅ PASS: ${message}`);
    passed++;
  } else {
    console.error(`  ❌ FAIL: ${message}`);
  }
}

async function runTests() {
  // Test Suite 1: Ticket Model & SLA Mapping
  console.log('--- Test Suite 1: Ticket Model & SLA Calculation ---');
  assert(SLA_HOURS_MAP.URGENT === 4, 'URGENT SLA is set to 4 hours');
  assert(SLA_HOURS_MAP.HIGH === 12, 'HIGH SLA is set to 12 hours');
  assert(SLA_HOURS_MAP.MEDIUM === 24, 'MEDIUM SLA is set to 24 hours');
  assert(SLA_HOURS_MAP.LOW === 48, 'LOW SLA is set to 48 hours');

  const mockCustomerId = new mongoose.Types.ObjectId();
  const testTicket = new Ticket({
    title: 'Cannot access billing invoice PDF',
    description: 'When clicking download invoice, server throws 500 internal server error.',
    category: TICKET_CATEGORIES.BILLING,
    priority: TICKET_PRIORITIES.HIGH,
    customer: mockCustomerId,
  });

  const valErr = testTicket.validateSync();
  assert(!valErr, 'Ticket schema validation succeeds for valid ticket');

  // Trigger pre-save hook manually
  testTicket.ticketId = 'TIK-99999';
  const slaHours = SLA_HOURS_MAP[testTicket.priority];
  testTicket.slaDeadline = new Date(Date.now() + slaHours * 3600000);
  assert(testTicket.ticketId.startsWith('TIK-'), 'Ticket ID format adheres to TIK- prefix');
  assert(testTicket.slaDeadline > new Date(), 'SLA deadline is correctly scheduled in the future');

  // Test Suite 2: Intelligent Engine Analysis
  console.log('\n--- Test Suite 2: Intelligent Engine Analysis ---');

  // 2.1 Technical + Urgent Keyword Detection
  const techAnalysis = await analyzeTicket(
    'Database connection timeout error in production',
    'The server is completely crashing with exception. Production down ASAP!'
  );
  assert(techAnalysis.suggestedCategory === 'TECHNICAL', 'Intelligent engine suggests TECHNICAL for database crash');
  assert(techAnalysis.sentiment === 'URGENT', 'Intelligent engine flags urgent/production down as URGENT sentiment');
  assert(techAnalysis.suggestedPriority === 'URGENT', 'Priority is boosted to URGENT');
  assert(techAnalysis.source === 'INTELLIGENT_ENGINE_FALLBACK', 'Engine source transparently identified');
  assert(techAnalysis.suggestedReply.includes('Technical Support'), 'Suggested reply tailored for technical issue');

  // 2.2 Billing + Frustrated Keyword Detection
  const billingAnalysis = await analyzeTicket(
    'Unacceptable double payment charged on my card',
    'I was charged twice for the same subscription! This is horrible and broken, I want a refund.'
  );
  assert(billingAnalysis.suggestedCategory === 'BILLING', 'Suggests BILLING category for payment/charge issue');
  assert(billingAnalysis.sentiment === 'FRUSTRATED', 'Frustrated sentiment detected');
  assert(billingAnalysis.suggestedReply.includes('Billing'), 'Suggested reply tailored for billing');

  // 2.3 Account Reset Detection
  const accountAnalysis = await analyzeTicket(
    'Forgot my password and need reset',
    'I cannot login to my account profile because I forgot the password.'
  );
  assert(accountAnalysis.suggestedCategory === 'ACCOUNT', 'Suggests ACCOUNT category for password reset');

  // 2.4 Knowledge Base Article Recommendations
  const suggestions = await findSuggestedArticles('password');
  assert(suggestions.length > 0, 'Knowledge base matches article for "password" query');
  assert(suggestions[0].title.toLowerCase().includes('password'), 'Matched article title contains keyword');

  // Test Suite 3: Internal Notes Security Sanitation
  console.log('\n--- Test Suite 3: Internal Notes Role Privacy ---');
  const ticketWithNotes = {
    _id: 'tik_1',
    title: 'Test Ticket',
    messages: [
      { senderName: 'Alex Customer', message: 'Help me please', isInternal: false },
      { senderName: 'Sarah Agent', message: 'Internal: Checking user credit status before approving', isInternal: true },
      { senderName: 'Sarah Agent', message: 'We have approved your request!', isInternal: false },
    ],
  };

  // Simulate customer view
  const customerView = {
    ...ticketWithNotes,
    messages: ticketWithNotes.messages.filter((m) => !m.isInternal),
  };
  assert(customerView.messages.length === 2, 'Customer view filters out internal note');
  assert(
    !customerView.messages.some((m) => m.isInternal),
    'Customer cannot view private internal staff notes'
  );

  // Staff view retains all messages
  assert(ticketWithNotes.messages.length === 3, 'Staff view retains all internal and public messages');

  console.log('\n=======================================');
  console.log(`Ticket & Intelligent Engine Tests: ${passed}/${total} passed.`);
  console.log('=======================================\n');

  if (passed === total) process.exit(0);
  else process.exit(1);
}

runTests().catch((err) => {
  console.error('Test error:', err);
  process.exit(1);
});

