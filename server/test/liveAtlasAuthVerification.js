import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../.env') });

import User, { USER_ROLES } from '../src/models/User.js';
import { seedDemoAccounts } from '../src/utils/seedData.js';
import { generateToken } from '../src/utils/generateToken.js';

async function verifyLiveAtlasAuth() {
  console.log('🚀 Connecting Live to MongoDB Atlas to Verify Authentication...');

  if (!process.env.MONGODB_URI) {
    throw new Error('MONGODB_URI not found in server/.env');
  }

  await mongoose.connect(process.env.MONGODB_URI);
  console.log('✅ Connected Live to MongoDB Atlas Cluster:', mongoose.connection.host);

  // Ensure demo accounts are synced to live Atlas
  console.log('\n--- Ensuring Demo Accounts Synced in Atlas ---');
  await seedDemoAccounts();

  const accountsToVerify = [
    { label: 'Customer John', email: 'john@example.com', pass: 'Password@123', expectedRole: USER_ROLES.CUSTOMER },
    { label: 'Customer Alex', email: 'customer@resolveiq.test', pass: 'Customer@12345', expectedRole: USER_ROLES.CUSTOMER },
    { label: 'Support Agent', email: 'agent@resolveiq.test', pass: 'Agent@12345', expectedRole: USER_ROLES.SUPPORT_AGENT },
    { label: 'Support Manager', email: 'manager@resolveiq.test', pass: 'Manager@12345', expectedRole: USER_ROLES.SUPPORT_MANAGER },
    { label: 'Admin', email: 'admin@resolveiq.test', pass: 'Admin@12345', expectedRole: USER_ROLES.ADMIN },
  ];

  console.log('\n--- Verifying All 5 Accounts in Live MongoDB Atlas ---');
  let allPass = true;

  for (const acc of accountsToVerify) {
    console.log(`\nChecking: ${acc.label} (${acc.email})`);
    
    // 1. Fetch user from Live Atlas (with password explicitly selected)
    const user = await User.findOne({ email: acc.email.toLowerCase() }).select('+password');
    if (!user) {
      console.error(`  ❌ User not found in MongoDB Atlas!`);
      allPass = false;
      continue;
    }
    console.log(`  ✅ User Document Found in Atlas: _id=${user._id}, name="${user.name}", role="${user.role}"`);

    // 2. Verify Role
    if (user.role !== acc.expectedRole) {
      console.error(`  ❌ Role mismatch! Expected: ${acc.expectedRole}, Got: ${user.role}`);
      allPass = false;
    } else {
      console.log(`  ✅ Role matches expected: ${user.role}`);
    }

    // 3. Verify Password using bcrypt against stored hash in Atlas
    const isMatch = await bcrypt.compare(acc.pass, user.password);
    if (!isMatch) {
      console.error(`  ❌ Password verification failed for ${acc.pass}`);
      allPass = false;
    } else {
      console.log(`  ✅ Password "${acc.pass}" verified against live bcrypt hash`);
    }

    // 4. Verify invalid password rejection
    const isBadMatch = await bcrypt.compare('InvalidPassword999!', user.password);
    if (isBadMatch) {
      console.error(`  ❌ Failed to reject wrong password`);
      allPass = false;
    } else {
      console.log(`  ✅ Invalid password correctly rejected`);
    }

    // 5. Generate & Verify JWT Token
    const token = generateToken(user._id);
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'resolveiq_jwt_secret_token_dev_key');
    if (decoded.id.toString() !== user._id.toString()) {
      console.error(`  ❌ JWT token ID mismatch`);
      allPass = false;
    } else {
      console.log(`  ✅ JWT Token generated and verified for user _id`);
    }

    // 6. Test matchPassword method
    if (typeof user.matchPassword === 'function') {
      const methodMatch = await user.matchPassword(acc.pass);
      console.log(`  ✅ User.matchPassword() returned: ${methodMatch}`);
    }
  }

  console.log('\n======================================================');
  if (allPass) {
    console.log('✅ ALL 5 ACCOUNTS AUTHENTICATED SUCCESSFULLY AGAINST LIVE MONGODB ATLAS!');
  } else {
    console.error('❌ SOME ACCOUNTS FAILED AUTHENTICATION VERIFICATION');
  }
  console.log('======================================================\n');

  await mongoose.disconnect();
  process.exit(allPass ? 0 : 1);
}

verifyLiveAtlasAuth().catch((err) => {
  console.error('Fatal live auth error:', err);
  process.exit(1);
});
