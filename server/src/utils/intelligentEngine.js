import Article, { DEFAULT_ARTICLES } from '../models/Article.js';

/**
 * Intelligent Engine for ResolveIQ
 * Analyzes ticket text, performs sentiment analysis, category suggestion,
 * priority scoring, executive summaries, suggested agent responses,
 * and self-service article matching.
 */
export const analyzeTicket = async (title, description) => {
  const combinedText = `${title} ${description}`.toLowerCase();

  // Check if GEMINI_API_KEY is configured
  if (process.env.GEMINI_API_KEY) {
    try {
      const geminiResult = await callGeminiAnalysis(title, description);
      if (geminiResult) return geminiResult;
    } catch (err) {
      console.warn('Gemini API call failed, falling back to Intelligent Rule Engine:', err.message);
    }
  }

  // --- Rule-Based Fallback Intelligent Engine ---
  return performRuleBasedAnalysis(title, description, combinedText);
};

/**
 * High-accuracy NLP Rule-Based Analysis
 */
const performRuleBasedAnalysis = (title, description, text) => {
  // 1. Sentiment Detection
  let sentiment = 'NEUTRAL';
  const urgentKeywords = ['urgent', 'emergency', 'immediately', 'critical', 'asap', 'outage', 'blocker', 'production down'];
  const frustratedKeywords = ['angry', 'broken', 'terrible', 'worst', 'unacceptable', 'ridiculous', 'failed', 'useless', 'refund', 'scam', 'horrible'];
  const positiveKeywords = ['thank', 'great', 'awesome', 'appreciate', 'helpful', 'good', 'excellent'];

  if (urgentKeywords.some((w) => text.includes(w))) {
    sentiment = 'URGENT';
  } else if (frustratedKeywords.some((w) => text.includes(w))) {
    sentiment = 'FRUSTRATED';
  } else if (positiveKeywords.some((w) => text.includes(w))) {
    sentiment = 'POSITIVE';
  }

  // 2. Category Suggestion
  let suggestedCategory = 'GENERAL';
  const upiKeywords = ['upi', 'gpay', 'phonepe', 'paytm', 'utr', 'bank', 'debited', 'double charge', 'transfer'];
  const technicalKeywords = ['error', 'bug', 'crash', 'exception', 'server', 'database', 'api', 'slow', 'fail', 'code', 'build', 'syntax'];
  const billingKeywords = ['billing', 'invoice', 'charge', 'card', 'refund', 'money', 'subscription', 'price', 'fee'];
  const accountKeywords = ['login', 'password', 'account', 'auth', 'access', 'reset', 'profile', 'email', 'locked', 'mfa', 'jwt'];

  if (upiKeywords.some((w) => text.includes(w))) {
    suggestedCategory = 'PAYMENTS_UPI';
  } else if (technicalKeywords.some((w) => text.includes(w))) {
    suggestedCategory = 'TECHNICAL';
  } else if (billingKeywords.some((w) => text.includes(w))) {
    suggestedCategory = 'BILLING';
  } else if (accountKeywords.some((w) => text.includes(w))) {
    suggestedCategory = 'ACCOUNT';
  }

  // 3. Priority Suggestion
  let suggestedPriority = 'MEDIUM';
  if (sentiment === 'URGENT' || text.includes('production') || text.includes('cannot access') || text.includes('critical')) {
    suggestedPriority = 'URGENT';
  } else if (sentiment === 'FRUSTRATED' || text.includes('failed') || text.includes('error') || text.includes('charge')) {
    suggestedPriority = 'HIGH';
  } else if (text.includes('how to') || text.includes('question') || text.includes('inquiry')) {
    suggestedPriority = 'LOW';
  }

  // 4. Executive Summary Generation
  const firstSentence = description.split(/[.!?\n]/)[0].trim();
  const summary = firstSentence.length > 20 && firstSentence.length < 140
    ? `Customer reported: ${firstSentence}.`
    : `Issue regarding: ${title}. Key topic identified under ${suggestedCategory}.`;

  // 5. Contextual Suggested Agent Reply
  let suggestedReply = '';
  switch (suggestedCategory) {
    case 'PAYMENTS_UPI':
      suggestedReply = `Hello, thank you for reaching out to ResolveIQ Payment Support. We have logged your transaction inquiry for "${title}". We are verifying the bank reference UTR with our gateway partner to initiate reconciliation or refund.`;
      break;
    case 'TECHNICAL':
      suggestedReply = `Hello, thank you for contacting ResolveIQ Technical Support. We have logged this issue regarding "${title}". Our engineering team is currently investigating the logs. Could you share any error codes or steps to reproduce?`;
      break;
    case 'BILLING':
      suggestedReply = `Hello, thank you for reaching out to ResolveIQ Billing. We understand your inquiry regarding "${title}". We are pulling up your transaction ledger and will resolve any discrepancies immediately.`;
      break;
    case 'ACCOUNT':
      suggestedReply = `Hello, thank you for reaching out. We can assist you with your account security and access. For your security, please confirm your registered account email so we can verify your profile.`;
      break;
    default:
      suggestedReply = `Hello, thank you for contacting ResolveIQ Helpdesk. We have received your ticket regarding "${title}" and an agent has been assigned to assist you promptly.`;
  }

  return {
    sentiment,
    suggestedCategory,
    suggestedPriority,
    summary,
    suggestedReply,
    source: 'INTELLIGENT_ENGINE_FALLBACK',
  };
};

/**
 * Call Gemini Generative Language API if configured
 */
const callGeminiAnalysis = async (title, description) => {
  const apiKey = process.env.GEMINI_API_KEY;
  const prompt = `You are the AI triage brain of ResolveIQ Helpdesk. Analyze this ticket:
Title: ${title}
Description: ${description}

Respond ONLY with valid JSON with keys:
"sentiment" (must be one of: "FRUSTRATED", "URGENT", "NEUTRAL", "POSITIVE"),
"suggestedCategory" (must be one of: "TECHNICAL", "PAYMENTS_UPI", "BILLING", "ACCOUNT", "GENERAL"),
"suggestedPriority" (must be one of: "LOW", "MEDIUM", "HIGH", "URGENT"),
"summary" (one concise sentence summarizing the core issue),
"suggestedReply" (a professional, empathetic first response from a support agent).`;

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { responseMimeType: 'application/json' },
    }),
  });

  if (!response.ok) {
    throw new Error(`Gemini API returned status ${response.status}`);
  }

  const data = await response.json();
  const textResponse = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!textResponse) throw new Error('No candidate response from Gemini');

  const parsed = JSON.parse(textResponse);
  return {
    sentiment: parsed.sentiment || 'NEUTRAL',
    suggestedCategory: parsed.suggestedCategory || 'GENERAL',
    suggestedPriority: parsed.suggestedPriority || 'MEDIUM',
    summary: parsed.summary || title,
    suggestedReply: parsed.suggestedReply || 'Hello, an agent will assist you shortly.',
    source: 'GEMINI_AI',
  };
};

/**
 * Suggest Self-Service Articles based on ticket keywords
 */
export const findSuggestedArticles = async (queryText) => {
  try {
    const q = queryText.toLowerCase();
    const allArticles = await Article.find({ status: { $ne: 'DRAFT' } });
    const matched = allArticles.filter((art) => {
      const matchInTitle = art.title.toLowerCase().includes(q);
      const matchInKeywords = art.keywords.some((k) => q.includes(k.toLowerCase()));
      return matchInTitle || matchInKeywords;
    });

    if (matched.length > 0) return matched.slice(0, 3);
    // If no exact match, return top articles
    return allArticles.slice(0, 2);
  } catch (err) {
    return DEFAULT_ARTICLES.slice(0, 2);
  }
};

