/**
 * PRD_AUDIT.md Finding #6: resolves a workspace's BYO LLM configuration,
 * if one is set, into the LLMOverride shape services/anthropic.ts
 * expects. Config lives in Workspace.settings.llm (the existing generic
 * settings JSON column, same place services/automations.ts already
 * stores its own workspace-level config, rather than adding a dedicated
 * column for this one narrow purpose) with the API key encrypted at
 * rest via utils/encryption.ts — the same AES-256-GCM module already
 * used for SSO certificates and webhook secrets.
 */
import type { PrismaClient } from '@prisma/client'
import { decryptSafe } from '../utils/encryption.js'
import type { LLMOverride } from './anthropic.js'

interface WorkspaceLlmSettings {
  endpoint?: string
  encryptedApiKey?: string
  model?: string
  enabled?: boolean
}

/**
 * Returns the workspace's configured LLM override, or undefined if none
 * is set / it's disabled — callers pass the result straight to
 * callAnthropic's override parameter, where undefined correctly falls
 * back to the global ANTHROPIC_API_KEY.
 *
 * BYO LLM requires Enterprise plan (checked at config-write time in the
 * route below, not re-checked here — if a workspace is downgraded after
 * configuring it, this resolver still honors the stored config rather
 * than silently failing AI calls; that's a business-logic knob decision
 * for a future billing enforcement pass, not something to bake into the
 * hot path every AI call goes through).
 */
export const resolveWorkspaceLlmOverride = async (
  db: PrismaClient,
  workspaceId: string,
): Promise<LLMOverride | undefined> => {
  const workspace = await db.workspace.findUnique({
    where: { id: workspaceId },
    select: { settings: true },
  })
  if (!workspace) return undefined

  const settings = workspace.settings as { llm?: WorkspaceLlmSettings } | null
  const llm = settings?.llm
  if (!llm || llm.enabled === false || !llm.endpoint || !llm.encryptedApiKey) return undefined

  return {
    endpoint: llm.endpoint,
    apiKey: decryptSafe(llm.encryptedApiKey),
    // Bug fix (found via tsc): same exactOptionalPropertyTypes pattern
    // as cursor.ts — `llm.model` is `string | undefined`, but
    // `LLMOverride.model` may only be omitted, not present-as-undefined.
    ...(llm.model !== undefined && { model: llm.model }),
  }
}
