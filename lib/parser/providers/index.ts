import { LLMProvider } from '../types';
import { GroqProvider } from './groq';
import { GeminiProvider } from './gemini';

/**
 * Returns the configured LLM provider based on environment variable LLM_PROVIDER.
 * Defaults to Groq.
 */
export function getLLMProvider(overrideProviderName?: string): LLMProvider {
  const providerName = (
    overrideProviderName ||
    process.env.LLM_PROVIDER ||
    'groq'
  ).toLowerCase();

  switch (providerName) {
    case 'gemini':
      return new GeminiProvider();
    case 'groq':
    default:
      return new GroqProvider();
  }
}