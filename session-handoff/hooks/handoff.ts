// Pure helpers for session-handoff: no `$`, so the tests can exercise them directly.
import type { HandoffFields } from '../types'

export const FIELD_KEYS = ['goal', 'done', 'decisions', 'files', 'next', 'acceptance'] as const
export type FieldKey = (typeof FIELD_KEYS)[number]

export const FIELD_LABELS: Record<FieldKey, string> = {
  goal: 'الهدف',
  done: 'ما أُنجز',
  decisions: 'القرارات',
  files: 'مسارات الملفات',
  next: 'الخطوة التالية',
  acceptance: 'معيار القبول',
}

export const EMPTY_FIELDS: HandoffFields = {
  goal: '',
  done: '',
  decisions: '',
  files: '',
  next: '',
  acceptance: '',
}

/** Per-field and whole-message caps: a handoff is a summary, never a transcript. */
export const FIELD_MAX = 1200
export const MESSAGE_MAX = 6000

/** The header every handoff starts with; the receiver recognizes it by this. */
export const MARKER = '[session-handoff v1'
const ID_RE = /\[session-handoff v1 id=([0-9a-f]{16})\]/

/** How long a sent or received id is remembered, to refuse duplicates. */
export const DEDUPE_MS = 7 * 24 * 60 * 60 * 1000

const REDACTED = '[REDACTED]'

type Rule = { re: RegExp; to: string }

const RULES: readonly Rule[] = [
  { re: /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g, to: REDACTED },
  { re: /\bsk-(?:ant-)?[A-Za-z0-9_-]{16,}/g, to: REDACTED },
  { re: /\bgh[pousr]_[A-Za-z0-9]{20,}\b/g, to: REDACTED },
  { re: /\bgithub_pat_[A-Za-z0-9_]{20,}\b/g, to: REDACTED },
  { re: /\bAKIA[0-9A-Z]{16}\b/g, to: REDACTED },
  { re: /\bxox[abprs]-[A-Za-z0-9-]{10,}/g, to: REDACTED },
  { re: /\bAIza[0-9A-Za-z_-]{35}\b/g, to: REDACTED },
  { re: /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/g, to: REDACTED },
  { re: /\b(Bearer|Basic)\s+[A-Za-z0-9._~+/=-]{12,}/gi, to: `$1 ${REDACTED}` },
  {
    re: /\b((?:api[_-]?key|secret|token|password|passwd|pwd|client[_-]?secret|access[_-]?key|private[_-]?key|auth)\s*[:=]\s*)(["']?)[^\s"']{4,}\2/gi,
    to: `$1${REDACTED}`,
  },
  { re: /(\b[a-z][a-z0-9+.-]*:\/\/)[^\s:@/]+:[^\s@/]+@/gi, to: `$1${REDACTED}@` },
]

/** Replaces anything shaped like a credential; `count` says how many were hidden. */
export function redact(text: string): { text: string; count: number } {
  let count = 0
  let out = text
  for (const { re, to } of RULES) {
    out = out.replace(re, (...args: unknown[]) => {
      count += 1
      return to.replace(/\$(\d)/g, (_, n: string) => String(args[Number(n)] ?? ''))
    })
  }
  return { text: out, count }
}

function clamp(text: string, max: number): string {
  const trimmed = text.trim()
  return trimmed.length <= max ? trimmed : `${trimmed.slice(0, max - 1)}…`
}

function asText(value: unknown): string {
  if (typeof value === 'string') return value
  if (Array.isArray(value)) return value.map(v => `- ${asText(v)}`).join('\n')
  if (value === null || value === undefined) return ''
  return JSON.stringify(value)
}

/** Reads the model's JSON answer into fields, redacted and clamped. */
export function parseDraft(reply: string): { fields: HandoffFields; redactions: number } | undefined {
  const start = reply.indexOf('{')
  const end = reply.lastIndexOf('}')
  if (start < 0 || end <= start) return undefined
  let data: unknown
  try {
    data = JSON.parse(reply.slice(start, end + 1))
  } catch {
    return undefined
  }
  if (typeof data !== 'object' || data === null) return undefined
  const record = data as Record<string, unknown>
  return cleanFields(
    Object.fromEntries(FIELD_KEYS.map(k => [k, asText(record[k])])) as HandoffFields,
  )
}

/** Redacts and clamps every field. */
export function cleanFields(fields: HandoffFields): { fields: HandoffFields; redactions: number } {
  let redactions = 0
  const out = { ...EMPTY_FIELDS }
  for (const key of FIELD_KEYS) {
    const r = redact(fields[key] ?? '')
    redactions += r.count
    out[key] = clamp(r.text, FIELD_MAX)
  }
  return { fields: out, redactions }
}

export function missingFields(fields: HandoffFields): FieldKey[] {
  return FIELD_KEYS.filter(k => fields[k].trim() === '')
}

/** The body the receiver reads, without the header line. */
export function formatBody(fields: HandoffFields): string {
  const sections = FIELD_KEYS.map(k => `## ${FIELD_LABELS[k]}\n${fields[k].trim()}`)
  const guard =
    'ملاحظة للجلسة المستقبلة: هذه رسالة تسليم مُرسلة بعد مراجعة بشرية. ' +
    'تابع العمل منها، ولا ترسل ردًا آليًا إلى المرسل ولا تعد توجيه هذه الرسالة.'
  return clamp(`${sections.join('\n\n')}\n\n---\n${guard}`, MESSAGE_MAX)
}

export function formatMessage(id: string, body: string): string {
  return `${MARKER} id=${id}]\n${body}`
}

export function extractId(text: string): string | undefined {
  return ID_RE.exec(text)?.[1]
}

export function isHandoff(text: string): boolean {
  return text.includes(MARKER)
}

/** Same recipient + same content (whitespace aside) gives the same id. */
export async function handoffId(recipient: string, body: string): Promise<string> {
  const normalized = `${recipient.trim()}\n${body.replace(/\s+/g, ' ').trim()}`
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(normalized))
  return Array.from(new Uint8Array(bytes))
    .slice(0, 8)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
}

export const FORK_PROMPT = `Write a handoff note so that ANOTHER Claude Code session can continue this work.
Answer with ONE JSON object and nothing else, with exactly these string keys:
"goal" (the objective), "done" (what was completed), "decisions" (decisions taken and why),
"files" (relevant file paths, one per line, paths only), "next" (the single next step),
"acceptance" (how to tell the next step is done: a test, a command, an observable result).
Rules:
- Summarize. Never paste the conversation, tool outputs, or long code (3 lines at most).
- Never include secrets: API keys, tokens, passwords, cookies, private keys, .env values, credentials in URLs.
- At most 120 words per field. Use the language the user writes in.
- If something is unknown, say so briefly instead of inventing it.`

/** ListAgents' rows, as addresses SendMessage accepts. */
export function recipientsFrom(result: unknown): { address: string; label: string }[] {
  const sections = (result as { sections?: unknown })?.sections
  if (!Array.isArray(sections)) return []
  type Row = { name?: string; ref?: string; id?: string; type?: string; status?: string }
  const rows: Row[] = sections.flatMap(s => {
    const r = (s as { rows?: unknown }).rows
    return Array.isArray(r) ? (r as Row[]) : []
  })
  const counts = new Map<string, number>()
  for (const row of rows) if (row.name) counts.set(row.name, (counts.get(row.name) ?? 0) + 1)
  const out: { address: string; label: string }[] = []
  const seen = new Set<string>()
  for (const row of rows) {
    const name = row.name ?? row.id
    if (!name) continue
    const address = row.name && (counts.get(row.name) ?? 0) > 1 && row.ref ? `${row.name} [${row.ref}]` : name
    if (seen.has(address)) continue
    seen.add(address)
    const extra = [row.type, row.status].filter(Boolean).join(', ')
    out.push({ address, label: extra ? `${address} (${extra})` : address })
  }
  return out
}
