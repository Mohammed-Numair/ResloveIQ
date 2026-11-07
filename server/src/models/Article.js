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
      enum: ['TECHNICAL', 'BILLING', 'ACCOUNT', 'GENERAL', 'PAYMENTS_UPI'],
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
    notHelpfulCount: {
      type: Number,
      default: 0,
    },
    status: {
      type: String,
      enum: ['PUBLISHED', 'DRAFT', 'ARCHIVED'],
      default: 'PUBLISHED',
    },
    authorName: {
      type: String,
      default: 'ResolveIQ Team',
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    feedback: [
      {
        user: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User',
          required: true,
        },
        helpful: {
          type: Boolean,
          required: true,
        },
        createdAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
  },
  {
    timestamps: true,
  }
);

articleSchema.index({ category: 1, status: 1 });
articleSchema.index({ 'feedback.user': 1 });
articleSchema.index({ title: 'text', content: 'text', keywords: 'text' });

export const DEFAULT_ARTICLES = [
  {
    title: 'How to Reset Your Account Password',
    category: 'ACCOUNT',
    content: 'If you forgot your password, click the "Forgot Password" link on the login page or ask an administrator to trigger a password reset for your account.',
    keywords: ['password', 'reset', 'login', 'account', 'access', 'forgot'],
    status: 'PUBLISHED',
    authorName: 'Security Ops Team',
  },
  {
    title: 'Understanding Billing Cycles and Invoices',
    category: 'BILLING',
    content: 'Invoices are generated on the 1st day of every calendar month. If you observe discrepancies or duplicate charges, submit a Billing ticket with your transaction ID.',
    keywords: ['billing', 'invoice', 'payment', 'charge', 'refund', 'card', 'subscription'],
    status: 'PUBLISHED',
    authorName: 'Billing & Finance',
  },
  {
    title: 'Troubleshooting Connection & Timeout Errors',
    category: 'TECHNICAL',
    content: 'Verify that your local firewall permits outbound traffic on port 5000 and 443. Clear your browser cache and cookies, then try refreshing the page.',
    keywords: ['network', 'timeout', 'connection', 'error', 'slow', 'server', 'bug', 'crash'],
    status: 'PUBLISHED',
    authorName: 'DevOps & Infrastructure',
  },
  {
    title: 'General Helpdesk SLA & Response Times',
    category: 'GENERAL',
    content: 'ResolveIQ handles Urgent tickets within 4 hours, High priority within 12 hours, Medium within 24 hours, and Low within 48 hours.',
    keywords: ['sla', 'hours', 'time', 'urgent', 'policy', 'support', 'response'],
    status: 'PUBLISHED',
    authorName: 'ResolveIQ Support Ops',
  },
  {
    title: 'Resolving UPI & Payment Gateway Transaction Delays',
    category: 'PAYMENTS_UPI',
    content: 'UPI transactions typically settle within 15 minutes. If money was debited but the order shows pending, your bank will auto-reconcile within 2 banking hours or reverse the funds within 48 hours.',
    keywords: ['upi', 'payment', 'transaction', 'bank', 'transfer', 'failed', 'refund', 'delay'],
    status: 'PUBLISHED',
    authorName: 'Fintech Payments Desk',
  },
];

const Article = mongoose.model('Article', articleSchema);

export default Article;

