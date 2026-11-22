import type { Register } from 'claude-code'

export const register: Register = on => {
  // Slash command /my-mod, registered when the session starts.
  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'my-mod',
      description: 'Dit bonjour depuis my-mod',
    })
    return next(e)
  })

  on('command.run', { command: 'my-mod' }, async $ => {
    $.ui.toast('my-mod est chargé')
    return { text: `Bonjour depuis ${$.plugin.name} !` }
  })

  // Status line: show the last Bash command, marked when it failed.
  on('tool.call', { tool: 'Bash' }, async ($, e, next) => {
    const ran = await next(e)
    const failed = ran.deny === undefined && ran.isError === true
    $.ui.status(`${failed ? '✗' : '✓'} ${e.command.slice(0, 40)}`)
    return ran
  }).catch(($, e, next) => (next.called ? next(e) : { deny: `${$.plugin.name}: son hook a échoué.` }))
}
