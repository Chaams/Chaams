import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { Draft, Recipient } from '../types'
import {
  cleanFields,
  DEDUPE_MS,
  EMPTY_FIELDS,
  extractId,
  FIELD_KEYS,
  FIELD_LABELS,
  FORK_PROMPT,
  formatBody,
  formatMessage,
  handoffId,
  isHandoff,
  missingFields,
  parseDraft,
  recipientsFrom,
} from './handoff'

const PLUGIN = 'session-handoff'
const PANE = 'session-handoff'
const COMMAND = 'handoff'

const INITIAL: Draft = { fields: EMPTY_FIELDS, status: '', isBusy: false, redactions: 0 }

// Change a tag when that value's fields change: it declines what an earlier
// version stored, which outlives a reload.
const draft = atom({ plugin: 'session-handoff', key: 'draft' } as const, INITIAL, { shape: 'draft-1' })
const recipients = atom({ plugin: 'session-handoff', key: 'recipients' } as const, [] as Recipient[], {
  shape: 'recipients-1',
})
const recipient = atom({ plugin: 'session-handoff', key: 'recipient' } as const, '', { shape: 'recipient-1' })

const LOOP_REFUSAL = {
  isDelivered: false as const,
  reason: `${PLUGIN}: handoff messages are sent only from the /${COMMAND} pane, after review; no automatic reply or forwarding.`,
}

// One send at a time: a second press while one is in flight does nothing.
let isSending = false

async function setStatus($: EngineInterface, status: string, isBusy = false) {
  await update($, draft, d => ({ ...d, status, isBusy }))
}

async function refreshRecipients($: EngineInterface) {
  const listed = await $.tool.call({ tool: 'ListAgents' })
  if (listed.deny !== undefined) {
    await setStatus($, `تعذر سرد الجلسات: ${listed.deny}`)
    return
  }
  const found = recipientsFrom(listed.result)
  await update($, recipients, () => found)
  const chosen = await read($, recipient)
  if (!found.some(r => r.address === chosen)) await update($, recipient, () => '')
}

async function generate($: EngineInterface) {
  await setStatus($, 'جارٍ إعداد مسودة التسليم…', true)
  // A side completion over this session's own transcript: the transcript stays
  // here; only the summary it returns enters the draft.
  const reply = await $.model.fork({ prompt: FORK_PROMPT, effort: 'low' })
  if (!reply.isAnswered) {
    await setStatus($, `تعذر إعداد المسودة (${reply.reason}). اكتب الحقول يدويًا.`)
    return
  }
  const parsed = parseDraft(reply.text)
  if (parsed === undefined) {
    await setStatus($, 'لم تُفهم إجابة النموذج. اكتب الحقول يدويًا.')
    return
  }
  await update($, draft, () => ({
    fields: parsed.fields,
    redactions: parsed.redactions,
    isBusy: false,
    status: 'راجع الحقول واختر الجلسة المستقبلة، ثم اضغط «إرسال».',
  }))
}

async function send($: EngineInterface) {
  if (isSending) return
  isSending = true
  try {
    const to = await read($, recipient)
    const current = await read($, draft)
    if (to === '') return void (await setStatus($, 'اختر الجلسة المستقبلة أولًا.'))
    const missing = missingFields(current.fields)
    if (missing.length > 0) {
      return void (await setStatus($, `حقول ناقصة: ${missing.map(k => FIELD_LABELS[k]).join('، ')}`))
    }
    // Redact again: the person may have typed something in after generation.
    const cleaned = cleanFields(current.fields)
    const body = formatBody(cleaned.fields)
    const id = await handoffId(to, body)
    const key = `sent:${id}`
    const prior = await $.store.get(key)
    if (typeof prior === 'number' && Date.now() - prior < DEDUPE_MS) {
      return void (await setStatus($, `أُرسلت هذه الرسالة نفسها إلى ${to} من قبل؛ لم يُعَد إرسالها.`))
    }
    await setStatus($, `جارٍ الإرسال إلى ${to}…`, true)
    await $.store.set(key, Date.now())
    const sent = await $.session.send({ to, text: formatMessage(id, body) })
    if (!sent.isDelivered) {
      await $.store.delete(key)
      return void (await setStatus($, `لم تُسلَّم الرسالة: ${sent.reason}`))
    }
    await update($, draft, d => ({
      ...d,
      fields: cleaned.fields,
      isBusy: false,
      status: `أُرسل التسليم ${id} إلى ${to}.${cleaned.redactions > 0 ? ` (أُخفي ${cleaned.redactions} سر)` : ''}`,
    }))
    $.ui.toast(`session-handoff: أُرسل إلى ${to}`)
  } finally {
    isSending = false
  }
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: COMMAND,
      description: 'إعداد رسالة تسليم ومراجعتها وإرسالها إلى جلسة أخرى',
    })
    return next(e)
  })

  on('command.run', { command: COMMAND }, async $ => {
    await update($, draft, () => INITIAL)
    const opened = await $.ui.open({ id: PANE, title: 'تسليم الجلسة', focus: true })
    void refreshRecipients($)
      .then(() => generate($))
      .catch((err: unknown) => setStatus($, `خطأ: ${String(err)}`))
    return {
      text: opened.isPlaced
        ? 'فُتحت لوحة التسليم. لا يُرسل شيء قبل أن تضغط «إرسال».'
        : `تعذر فتح اللوحة: ${opened.reason}`,
    }
  }).catch(() => ({ text: `${PLUGIN}: تعذر فتح لوحة التسليم.` }))

  // Receiving side: a handoff already received is dropped; a new one is remembered.
  on('session.receive', async ($, e, next) => {
    if (!isHandoff(e.text)) return next(e)
    const id = extractId(e.text)
    if (id === undefined) return next(e)
    const key = `recv:${id}`
    const prior = await $.store.get(key)
    if (typeof prior === 'number' && Date.now() - prior < DEDUPE_MS) {
      return { consumed: `${PLUGIN}: duplicate handoff ${id}` }
    }
    await $.store.set(key, Date.now())
    return next(e)
  }).catch(($, e, next) => next(e))

  // Loop guard: the model may not send or forward a handoff on its own. Only the
  // person's press in the pane sends one (origin `plugin`).
  on('session.send', async ($, e, next) =>
    e.origin.kind === 'model' && isHandoff(e.text) ? LOOP_REFUSAL : next(e),
  ).catch(($, e, next) =>
    next.called || !(e.origin.kind === 'model' && isHandoff(e.text)) ? next(e) : LOOP_REFUSAL,
  )

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Text, Button, Input, Select } = $.ui.resolve(e)
    const d = await read($, draft)
    const list = await read($, recipients)
    const to = await read($, recipient)

    return (
      <Box flexDirection="column" gap={1}>
        <Box flexDirection="column">
          <Text bold>الجلسة المستقبلة</Text>
          {list.length === 0 ? (
            <Text dimColor>لا توجد جلسات أخرى متاحة الآن.</Text>
          ) : (
            <Select
              key="recipient"
              label="إلى:"
              options={[{ value: '', label: '— اختر —' }, ...list.map(r => ({ value: r.address, label: r.label }))]}
              value={to}
              onSelect={value => update($, recipient, () => value)}
            />
          )}
          <Button key="refresh" dimColor onPress={() => refreshRecipients($)}>
            تحديث القائمة
          </Button>
        </Box>

        {FIELD_KEYS.map(k => (
          <Input
            key={`field-${k}`}
            label={FIELD_LABELS[k]}
            rows={k === 'files' || k === 'done' ? 4 : 2}
            value={d.fields[k]}
            onInput={value => update($, draft, cur => ({ ...cur, fields: { ...cur.fields, [k]: value } }))}
            onSubmit={value => update($, draft, cur => ({ ...cur, fields: { ...cur.fields, [k]: value } }))}
          />
        ))}

        {d.redactions > 0 && <Text color="yellow">أُخفي {String(d.redactions)} نص يشبه سرًّا ([REDACTED]).</Text>}
        {d.status !== '' && <Text dimColor={!d.isBusy}>{d.status}</Text>}

        <Box flexDirection="row" gap={2}>
          <Button key="send" variant="primary" onPress={() => send($)}>
            إرسال
          </Button>
          <Button key="regenerate" onPress={() => generate($)}>
            إعادة إعداد المسودة
          </Button>
          <Button key="close" role="dismiss" onPress={() => $.ui.close({ id: PANE })}>
            إغلاق
          </Button>
        </Box>
      </Box>
    )
  })
}
