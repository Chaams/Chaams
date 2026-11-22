export type HandoffFields = {
  goal: string
  done: string
  decisions: string
  files: string
  next: string
  acceptance: string
}

export type Recipient = { address: string; label: string }

export type Draft = {
  fields: HandoffFields
  status: string
  isBusy: boolean
  redactions: number
}

declare module 'claude-code' {
  interface PluginState {
    'session-handoff': {
      draft: Shaped<Draft>
      recipients: Shaped<Recipient[]>
      recipient: Shaped<string>
    }
  }
}
