import { describe, expect, mock, test } from 'claude-code/testing'

// The test environment has timers; the hooks' own type set does not declare them.
declare const setTimeout: (fn: () => void, ms: number) => unknown

import {
  extractId,
  formatBody,
  formatMessage,
  handoffId,
  parseDraft,
  recipientsFrom,
  redact,
} from '../hooks/handoff'

const PANE = {
  plugin: 'session-handoff',
  component: 'Pane',
  requestId: 'session-handoff',
  surface: 'desktop',
  props: {
    title: 'تسليم الجلسة',
    isFocused: true,
    bodyColumns: 80,
    placement: 'dock',
    scroll: { offset: 0, bodyRows: 40 },
    view: {},
  },
} as const

const DRAFT_JSON = JSON.stringify({
  goal: 'Ajouter le mod session-handoff',
  done: 'Pane et tests écrits',
  decisions: 'Résumé par model.fork; token=abcd1234efgh posé par erreur',
  files: 'hooks/register.tsx\nhooks/handoff.ts',
  next: 'Lancer claude plugin test',
  acceptance: 'Tous les tests passent',
})

const LISTING = {
  listing: 'worker-a\nworker-b',
  sections: [{ kind: 'sessions', total: 2, rows: [{ name: 'worker-a' }, { name: 'worker-b', status: 'idle' }] }],
}

describe('pure helpers', () => {
  test('redact hides credentials and counts them', async () => {
    const r = redact(
      'key sk-ant-REDACTEDREDACTED123456 ghp_abcdefghijklmnopqrstuvwxyz0123 password=hunter22 https://u:p@host/x',
    )
    expect(r.text).not.toContain('sk-ant-')
    expect(r.text).not.toContain('ghp_')
    expect(r.text).not.toContain('hunter22')
    expect(r.text).not.toContain('u:p@')
    expect(r.count).toBe(4)
  })

  test('parseDraft reads JSON, redacts and ignores prose around it', async () => {
    const parsed = parseDraft(`Voici:\n${DRAFT_JSON}\nfin`)
    expect(parsed?.fields.goal).toBe('Ajouter le mod session-handoff')
    expect(parsed?.fields.decisions).toContain('[REDACTED]')
    expect(parsed?.redactions).toBe(1)
    expect(parseDraft('no json here')).toBe(undefined)
  })

  test('the id is stable per recipient and content', async () => {
    const body = formatBody(parseDraft(DRAFT_JSON)!.fields)
    const a = await handoffId('worker-a', body)
    expect(await handoffId('worker-a', `  ${body}  `)).toBe(a)
    expect(await handoffId('worker-b', body)).not.toBe(a)
    expect(extractId(formatMessage(a, body))).toBe(a)
  })

  test('the message holds all six sections', async () => {
    const body = formatBody(parseDraft(DRAFT_JSON)!.fields)
    for (const h of ['الهدف', 'ما أُنجز', 'القرارات', 'مسارات الملفات', 'الخطوة التالية', 'معيار القبول']) {
      expect(body).toContain(`## ${h}`)
    }
  })

  test('recipientsFrom disambiguates shared names with ref', async () => {
    const out = recipientsFrom({
      sections: [{ rows: [{ name: 'w', ref: 'r1' }, { name: 'w', ref: 'r2' }, { name: 'solo' }] }],
    })
    expect(out.map(r => r.address)).toEqual(['w [r1]', 'w [r2]', 'solo'])
  })
})

describe('the pane', () => {
  test('nothing is sent before the press; one press sends once, a second is refused', async ($, on) => {
    mock.store(on)
    const sent: { to: string; text: string }[] = []
    on('command.register', () => ({ value: { command: 'handoff' } }))
    on('ui.open', () => ({ value: { isPlaced: true } }))
    on('session.start', (_, e) => ({ cwd: e.cwd }))
    on('tool.call', { tool: 'ListAgents' }, () => ({ result: LISTING }))
    on('model.fork', () => ({
      value: { isAnswered: true, text: DRAFT_JSON, usage: { inputTokens: 1, outputTokens: 1 } } as never,
    }))
    on('session.send', (_, e) => {
      sent.push({ to: e.to, text: e.text })
      return { isDelivered: true }
    })

    await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
    await $.command.run({ command: 'handoff', args: '' } as never)

    const ui = await $.ui.mount(PANE)
    // The draft fills in from the fork; wait for it to be drawn.
    for (let i = 0; i < 50 && !(await ui.find({ type: 'Input', key: 'field-goal' }))?.text; i++) {
      await new Promise<void>(r => setTimeout(() => r(), 10))
    }
    expect(sent).toHaveLength(0)

    // Without a recipient the press refuses.
    await ui.press({ key: 'send' })
    expect(sent).toHaveLength(0)

    await ui.select({ key: 'recipient', value: 'worker-b' })
    await ui.press({ key: 'send' })
    expect(sent).toHaveLength(1)
    expect(sent[0]?.to).toBe('worker-b')
    expect(sent[0]?.text).toContain('[session-handoff v1 id=')
    expect(sent[0]?.text).not.toContain('abcd1234efgh')

    // Same content to the same recipient: refused as a duplicate.
    await ui.press({ key: 'send' })
    expect(sent).toHaveLength(1)
    await ui.unmount()
  })
})

describe('loop guards', () => {
  test('the model may not send or forward a handoff by itself', async ($, on) => {
    const reached: string[] = []
    on('session.send', (_, e) => {
      reached.push(e.text)
      return { isDelivered: true }
    })
    const model = { kind: 'model' } as const
    const r = await $.session.send({
      to: 'worker-a',
      text: '[session-handoff v1 id=0123456789abcdef]\nreply',
      origin: model,
    } as never)
    expect(reached).toHaveLength(0)
    expect(r.isDelivered).toBe(false)
    expect(r.reason).toContain('session-handoff')

    await $.session.send({ to: 'worker-a', text: 'normal message', origin: model } as never)
    expect(reached).toEqual(['normal message'])
  })

  test('a handoff received twice is consumed the second time', async ($, on) => {
    mock.store(on)
    on('session.receive', (_, e) => ({ text: e.text }))
    const text = '[session-handoff v1 id=0123456789abcdef]\n## الهدف\nx'
    const first = await $.session.receive({ origin: { kind: 'peer' }, text } as never)
    const second = await $.session.receive({ origin: { kind: 'peer' }, text } as never)
    expect(JSON.stringify(first)).not.toContain('consumed')
    expect(JSON.stringify(second)).toContain('duplicate')
  })
})
