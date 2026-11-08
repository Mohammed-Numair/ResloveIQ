import User, { USER_ROLES } from '../models/User.js';

export const DEMO_ACCOUNTS = [
  {
    name: 'Eleanor Vance (Admin)',
    email: 'admin@resolveiq.test',
    password: 'Admin@12345',
    role: USER_ROLES.ADMIN,
  },
  {
    name: 'Marcus Chen (Support Manager)',
    email: 'manager@resolveiq.test',
    password: 'Manager@12345',
    role: USER_ROLES.SUPPORT_MANAGER,
  },
  {
    name: 'Sarah Connor (Support Agent)',
    email: 'agent@resolveiq.test',
    password: 'Agent@12345',
    role: USER_ROLES.SUPPORT_AGENT,
  },
  {
    name: 'Alex Rivera (Customer)',
    email: 'customer@resolveiq.test',
    password: 'Customer@12345',
    role: USER_ROLES.CUSTOMER,
  },
  {
    name: 'John Customer (Customer)',
    email: 'john@example.com',
    password: 'Password@123',
    role: USER_ROLES.CUSTOMER,
  },
];

/**
 * Seed initial staff and customer demo accounts if they don't already exist
 */
export const seedDemoAccounts = async () => {
  try {
    const results = [];
    for (const acc of DEMO_ACCOUNTS) {
      const existing = await User.findOne({ email: acc.email });
      if (!existing) {
        // Create user - Mongoose pre-save hook will hash password with bcrypt
        const created = await User.create(acc);
        results.push({ email: created.email, role: created.role, created: true });
      } else {
        results.push({ email: existing.email, role: existing.role, created: false });
      }
    }
    return results;
  } catch (error) {
    console.error('Error seeding demo accounts:', error.message);
    throw error;
  }
};

