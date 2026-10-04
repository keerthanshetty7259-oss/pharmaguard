const express = require('express');
const config = require('../config');
const { asyncHandler, httpError } = require('../utils');

const router = express.Router();

const SYSTEM_PROMPT = `You are the PharmaGuard health information assistant.
- Answer simple, general questions about medicines (what they are used for, how they work in general, common side effects), diseases, symptoms and related health topics, in clear plain language.
- You provide general educational information only, not a diagnosis or personal medical advice. For personal medical decisions, dosing for a specific person, or anything urgent, tell the user to speak to a doctor or pharmacist. For emergencies tell them to contact local emergency services.
- Do NOT determine or judge drug-drug interactions, and do not say whether two medicines are safe to take together. If asked, explain that formal interaction checks are done by PharmaGuard's dedicated interaction checker when a medicine is added (Prescription / Medicine Input page), and suggest asking a pharmacist or doctor.
- If a question is unrelated to medicines, health or diseases, politely say you can only help with health and medicine questions.
- Keep answers concise and easy to read.`;

let client = null;
function getClient() {
  if (!client) {
    const OpenAI = require('openai');
    client = new OpenAI({ apiKey: config.openaiApiKey });
  }
  return client;
}

router.post(
  '/',
  asyncHandler(async (req, res) => {
    if (!config.openaiApiKey) {
      throw httpError(503, 'The chatbot is not configured yet. Add your OPENAI_API_KEY to backend/.env and restart the server.');
    }
    const incoming = Array.isArray(req.body.messages) ? req.body.messages : [];
    const history = incoming
      .filter((m) => m && ['user', 'assistant'].includes(m.role) && typeof m.content === 'string' && m.content.trim())
      .slice(-12)
      .map((m) => ({ role: m.role, content: m.content.slice(0, 2000) }));
    if (!history.length || history[history.length - 1].role !== 'user') throw httpError(400, 'Please type a question.');

    try {
      const completion = await getClient().chat.completions.create({
        model: config.openaiModel,
        messages: [{ role: 'system', content: SYSTEM_PROMPT }, ...history],
        temperature: 0.3,
        max_tokens: 700,
      });
      res.json({ reply: completion.choices[0]?.message?.content?.trim() || 'Sorry, I could not produce an answer.' });
    } catch (err) {
      console.error('[chat]', err.status, err.message);
      if (err.status === 401) throw httpError(502, 'The OpenAI API key was rejected. Please check OPENAI_API_KEY in backend/.env.');
      if (err.status === 429) throw httpError(502, 'OpenAI rate limit or quota reached. Please check your OpenAI account billing/usage.');
      throw httpError(502, 'The chatbot service is unavailable right now. Please try again.');
    }
  })
);

module.exports = router;
