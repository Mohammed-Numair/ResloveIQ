import mongoose from 'mongoose';

export const POLICY_TYPES = {
  ALLOW_DIY: 'ALLOW_DIY',
  ASSIST_ONLY: 'ASSIST_ONLY',
  RESTRICTED_CALL_REQUIRED: 'RESTRICTED_CALL_REQUIRED',
};

const troubleshootingStepSchema = new mongoose.Schema(
  {
    stepNumber: {
      type: Number,
      required: true,
    },
    title: {
      type: String,
      required: true,
    },
    instructions: {
      type: String,
      required: true,
    },
    isResolvingAction: {
      type: Boolean,
      default: false,
    },
    requiresHumanVerification: {
      type: Boolean,
      default: false,
    },
  },
  { _id: true }
);

const categorySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Category name is required'],
      trim: true,
      unique: true,
    },
    slug: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
    },
    description: {
      type: String,
      required: true,
      trim: true,
    },
    defaultPriority: {
      type: String,
      enum: ['LOW', 'MEDIUM', 'HIGH', 'URGENT'],
      default: 'MEDIUM',
    },
    defaultSlaHours: {
      type: Number,
      default: 24,
    },
    policyType: {
      type: String,
      enum: Object.values(POLICY_TYPES),
      default: POLICY_TYPES.ALLOW_DIY,
    },
    troubleshootingSteps: [troubleshootingStepSchema],
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

export const DEFAULT_CATEGORIES = [
  {
    name: 'Technical Support & Platform Errors',
    slug: 'TECHNICAL',
    description: 'Bugs, connection timeouts, syntax errors, and web application issues.',
    defaultPriority: 'HIGH',
    defaultSlaHours: 12,
    policyType: POLICY_TYPES.ALLOW_DIY,
    troubleshootingSteps: [
      {
        stepNumber: 1,
        title: 'Clear Browser Cache & Cookies',
        instructions: 'Open your browser settings, clear cookies and cache for the past 24 hours, and restart your browser window.',
        isResolvingAction: false,
      },
      {
        stepNumber: 2,
        title: 'Verify Network Proxy and Port Access',
        instructions: 'Ensure ports 5000 and 443 are not blocked by a corporate VPN or strict university firewall.',
        isResolvingAction: false,
      },
      {
        stepNumber: 3,
        title: 'Check Developer Console Logs',
        instructions: 'Press F12, inspect the Console tab, take a screenshot of any red error traces, and attach them to your ticket.',
        isResolvingAction: true,
      },
    ],
  },
  {
    name: 'UPI, Payments & Financial Transactions',
    slug: 'PAYMENTS_UPI',
    description: 'UPI transaction failures, payment deductions without confirmation, and double-charges.',
    defaultPriority: 'URGENT',
    defaultSlaHours: 4,
    policyType: POLICY_TYPES.RESTRICTED_CALL_REQUIRED, // Sensitive financial policy!
    troubleshootingSteps: [
      {
        stepNumber: 1,
        title: 'Check Bank UTR / Transaction Reference Number',
        instructions: 'Locate the 12-digit UTR number in your banking or UPI app (e.g. GPay, PhonePe, Paytm).',
        isResolvingAction: false,
      },
      {
        stepNumber: 2,
        title: 'Automated 2-Hour Banking Auto-Reversal Window',
        instructions: 'Under banking guidelines, money debited during gateway timeouts is auto-refunded within 2 to 24 banking hours if uncollected.',
        isResolvingAction: false,
      },
      {
        stepNumber: 3,
        title: 'Mandatory Human Financial Agent Verification',
        instructions: 'High-value and UPI transactions require certified human agent verification. Automated refunds are restricted for your safety.',
        isResolvingAction: true,
        requiresHumanVerification: true,
      },
    ],
  },
  {
    name: 'Billing, Invoices & Subscriptions',
    slug: 'BILLING',
    description: 'Subscription renewals, receipt requests, tax invoices, and plan upgrades.',
    defaultPriority: 'MEDIUM',
    defaultSlaHours: 24,
    policyType: POLICY_TYPES.ASSIST_ONLY,
    troubleshootingSteps: [
      {
        stepNumber: 1,
        title: 'Download Invoices from Billing Portal',
        instructions: 'Navigate to Account Settings > Billing & Invoices to view past downloadable PDF receipts.',
        isResolvingAction: false,
      },
      {
        stepNumber: 2,
        title: 'Verify Card Expiration & Auto-Renew',
        instructions: 'Check that your payment method on file has not expired and 3D Secure verification was completed.',
        isResolvingAction: true,
      },
    ],
  },
  {
    name: 'Account Access & Security Credentials',
    slug: 'ACCOUNT',
    description: 'Login failures, password resets, account locking, and role permission queries.',
    defaultPriority: 'HIGH',
    defaultSlaHours: 12,
    policyType: POLICY_TYPES.RESTRICTED_CALL_REQUIRED,
    troubleshootingSteps: [
      {
        stepNumber: 1,
        title: 'Self-Service Password Reset',
        instructions: 'Use the official Password Reset tool on the login page to send a secure recovery link.',
        isResolvingAction: false,
      },
      {
        stepNumber: 2,
        title: 'Security Identity Verification',
        instructions: 'For account unlock or email changes, an agent must verify your identity to prevent unauthorized takeover.',
        isResolvingAction: true,
        requiresHumanVerification: true,
      },
    ],
  },
  {
    name: 'General Inquiries & Feedback',
    slug: 'GENERAL',
    description: 'General questions, feature requests, partnership inquiries, and feedback.',
    defaultPriority: 'LOW',
    defaultSlaHours: 48,
    policyType: POLICY_TYPES.ALLOW_DIY,
    troubleshootingSteps: [
      {
        stepNumber: 1,
        title: 'Check Knowledge Base Documentation',
        instructions: 'Browse our self-help Knowledge Base FAQs for answers to frequently asked questions.',
        isResolvingAction: true,
      },
    ],
  },
];

const Category = mongoose.model('Category', categorySchema);

export default Category;
