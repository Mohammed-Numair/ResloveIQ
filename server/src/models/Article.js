import mongoose from 'mongoose';

const articleSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    category: {
      type: String,
      required: true,
      enum: ['TECHNICAL', 'BILLING', 'ACCOUNT', 'GENERAL'],
    },
    content: {
      type: String,
      required: true,
    },
    keywords: [String],
    viewCount: {
      type: Number,
      default: 0,
    },
    helpfulCount: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

export const DEFAULT_ARTICLES = [
  {
    title: 'How to Reset Your Account Password',
    category: 'ACCOUNT',
    content: 'If you forgot your password, click the "Forgot Password" link on the login page or ask an administrator to trigger a password reset for your account.',
    keywords: ['password', 'reset', 'login', 'account', 'access', 'forgot'],
  },
  {
    title: 'Understanding Billing Cycles and Invoices',
    category: 'BILLING',
    content: 'Invoices are generated on the 1st day of every calendar month. If you observe discrepancies or duplicate charges, submit a Billing ticket with your transaction ID.',
    keywords: ['billing', 'invoice', 'payment', 'charge', 'refund', 'card', 'subscription'],
  },
  {
    title: 'Troubleshooting Connection & Timeout Errors',
    category: 'TECHNICAL',
    content: 'Verify that your local firewall permits outbound traffic on port 5000 and 443. Clear your browser cache and cookies, then try refreshing the page.',
    keywords: ['network', 'timeout', 'connection', 'error', 'slow', 'server', 'bug', 'crash'],
  },
  {
    title: 'General Helpdesk SLA & Response Times',
    category: 'GENERAL',
    content: 'ResolveIQ handles Urgent tickets within 4 hours, High priority within 12 hours, Medium within 24 hours, and Low within 48 hours.',
    keywords: ['sla', 'hours', 'time', 'urgent', 'policy', 'support', 'response'],
  },
];

const Article = mongoose.model('Article', articleSchema);

export default Article;

