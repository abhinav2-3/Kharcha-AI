import Groq from 'groq-sdk';
import { LLMMessage, LLMProvider } from '../types';

export class GroqProvider implements LLMProvider {
  name = 'groq';
  private client: Groq | null = null;
  private defaultModel: string;

  constructor(apiKey?: string, model?: string) {
    const key = apiKey || process.env.GROQ_API_KEY;
    if (key) {
      this.client = new Groq({ apiKey: key });
    }
    this.defaultModel = model || process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';
  }

  async generateJSON(messages: LLMMessage[], options?: { timeoutMs?: number }): Promise<string> {
    if (!this.client) {
      // Lazy init or fallback check
      const key = process.env.GROQ_API_KEY;
      if (!key) {
        throw new Error('GROQ_API_KEY is not configured in environment variables');
      }
      this.client = new Groq({ apiKey: key });
    }

    const timeoutMs = options?.timeoutMs || 8000;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await this.client.chat.completions.create(
        {
          model: this.defaultModel,
          messages: messages.map((m) => ({
            role: m.role,
            content: m.content,
          })),
          response_format: { type: 'json_object' },
          temperature: 0,
        },
        { signal: controller.signal }
      );

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error('Empty response from Groq');
      }

      return content;
    } finally {
      clearTimeout(timeoutId);
    }
  }
}

