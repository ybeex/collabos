/**
 * Shared Anthropic-compatible LLM client.
 *
 * PRD_AUDIT.md Finding #6: PRD §19/§20 specify "Enterprise can bring
 * their own LLM endpoint (BYO LLM)" — previously ANTHROPIC_API_KEY was a
 * single, global, deployment-wide env var with no per-workspace override
 * of any kind. This module now accepts an optional LLMOverride, sourced
 * from a workspace's encrypted settings (see workspace-llm-config.ts),
 * and falls back to the global env var when no override is configured —
 * every existing call site continues to work unchanged unless it
 * explicitly opts into passing a workspace's override.
 */
import { env } from '../utils/env.js'
import { ServiceUnavailableError } from '../utils/errors.js'

export interface LLMOverride {
  /** Custom endpoint URL. Must be Anthropic Messages-API-compatible (same request/response shape) — this client does not do provider-specific translation. */
  endpoint: string
  apiKey: string
  /** Model identifier to send in the request body. Falls back to the default Claude model if not set. */
  model?: string
}

const DEFAULT_ENDPOINT = 'https://api.anthropic.com/v1/messages'
const DEFAULT_MODEL = 'claude-sonnet-4-20250514'

export const callAnthropic = async (
  systemPrompt: string,
  userMessage: string,
  maxTokens = 1000,
  override?: LLMOverride,
): Promise<string> => {
  if (!env.ENABLE_AI) {
    throw new ServiceUnavailableError('AI features are disabled')
  }

  const endpoint = override?.endpoint ?? DEFAULT_ENDPOINT
  const apiKey = override?.apiKey ?? env.ANTHROPIC_API_KEY
  const model = override?.model ?? DEFAULT_MODEL

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      system: systemPrompt,
      messages: [{ role: 'user', content: userMessage }],
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    // Deliberately does not include the raw error body when a BYO
    // endpoint is in use — a misconfigured third-party endpoint could
    // leak provider-specific error details (e.g. exposing internal
    // infrastructure info) into an error message a non-admin user might
    // see surfaced by the calling route.
    if (override) {
      throw new ServiceUnavailableError('AI request failed using this workspace\'s configured LLM endpoint. Check the endpoint and API key in workspace AI settings.')
    }
    throw new ServiceUnavailableError(`AI request failed: ${err}`)
  }

  const data = await res.json() as {
    content: Array<{ type: string; text?: string }>
  }

  return data.content
    .filter((block) => block.type === 'text')
    .map((block) => block.text ?? '')
    .join('')
}
