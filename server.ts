import express from 'express';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

dotenv.config();

const app = express();
app.use(express.json({ limit: '10mb' }));

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    },
  },
});

app.post('/api/ai/chat', async (req, res) => {
  try {
    const { message, context, chatHistory } = req.body;

    const systemInstruction = `You are the CFO AI Assistant embedded in this Corporate FP&A Variance Analysis & Board Commentary platform.
Your task is to analyze P&L performance, explain financial variances, evaluate IFRS accounting treatments, provide strategic turnaround or value-creation guidance, and answer what-if scenario questions.

Active P&L Dataset Context:
- Reporting Period: ${context?.period || 'Current Period'}
- Currency: ${context?.currency || '$'}
- Revenue Actual: ${context?.revenueActual || 'N/A'} (Budget: ${context?.revenueBudget || 'N/A'}, Variance: ${context?.revenueVariance || 'N/A'})
- Gross Profit Actual: ${context?.grossProfitActual || 'N/A'} (GM%: ${context?.grossMarginActual || 'N/A'}, Budget GM%: ${context?.grossMarginBudget || 'N/A'})
- Total Operating Expenses Actual: ${context?.opexActual || 'N/A'} (Budget: ${context?.opexBudget || 'N/A'})
- Operating Profit / (Loss) Actual: ${context?.opActual || 'N/A'} (Budget: ${context?.opBudget || 'N/A'}, Variance: ${context?.opVariance || 'N/A'})
- Material Exceptions Count: ${context?.materialExceptionsCount || 0}
- Key Analytical Review Findings: ${JSON.stringify(context?.topFindings || [])}
- Active Segments: ${JSON.stringify(context?.segments || [])}
- Top Adverse Drivers: ${JSON.stringify(context?.adverseDrivers || [])}
- Top Favourable Drivers: ${JSON.stringify(context?.favourableDrivers || [])}

Provide clear, structured, executive-level insights with markdown formatting (bullet points, bold text, concise tables if helpful). Be analytical, actionable, and mathematically precise based on the provided numbers.`;

    const formattedHistory = (chatHistory || []).map((msg: any) => ({
      role: msg.role === 'user' ? 'user' : 'model',
      parts: [{ text: msg.content }],
    }));

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const stream = await ai.interactions.create({
      model: 'gemini-3.8-flash',
      input: message,
      system_instruction: systemInstruction,
      stream: true,
    });

    for await (const event of stream) {
      if (event.event_type === 'step.delta' && event.delta.type === 'text') {
        res.write(`data: ${JSON.stringify({ text: event.delta.text })}\n\n`);
      }
    }

    res.write('data: [DONE]\n\n');
    res.end();
  } catch (error: any) {
    console.error('Gemini API Chat Error:', error);
    if (!res.headersSent) {
      res.status(500).json({ error: error.message || 'Failed to generate response' });
    } else {
      res.write(`data: ${JSON.stringify({ error: error.message || 'Stream interrupted' })}\n\n`);
      res.end();
    }
  }
});

async function startServer() {
  const PORT = process.env.PORT ? Number(process.env.PORT) : 3000;

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'custom',
    });
    app.use(vite.middlewares);

    app.use('*', async (req, res, next) => {
      const url = req.originalUrl;
      try {
        const rawHtml = fs.readFileSync(path.resolve('.', 'index.html'), 'utf-8');
        const html = await vite.transformIndexHtml(url, rawHtml);
        res.status(200).set({ 'Content-Type': 'text/html' }).end(html);
      } catch (e) {
        vite.ssrFixStacktrace(e as Error);
        next(e);
      }
    });
  } else {
    app.use(express.static('dist'));
    app.use('*', (req, res) => {
      res.sendFile(path.resolve('.', 'dist', 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
