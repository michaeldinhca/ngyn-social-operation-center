// Administrator command for agent access. Writes .data/governance.json; a running server picks the
// change up on its next request. It never touches tokens or the demo store directly.
//
//   npm run agent-access -- list
//   npm run agent-access -- grant <userId> read|draft --by "Name"
//   npm run agent-access -- revoke <userId> --by "Name"          (no access, and signs agents out)
//   npm run agent-access -- sign-out <userId> --by "Name"        (keeps the grant, signs agents out)
//   npm run agent-access -- resident-content allow --approved-by "Name, title" --ref "Council motion 2026-14" --provider "ChatGPT (OpenAI)" --by "Name"
//   npm run agent-access -- resident-content deny --by "Name"
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseArgs } from 'node:util'
import { db } from '../../web/src/mock/db.ts'
import { GovernanceStore } from './governance.ts'
import { SocOAuthProvider } from './oauth.ts'
import { installFileStorage } from './store.ts'

const dataDir = join(dirname(fileURLToPath(import.meta.url)), '..', '.data')
// Read-only view of the store for names; this command never saves to it.
installFileStorage(null)
const governance = new GovernanceStore(join(dataDir, 'governance.json'))

const { positionals, values } = parseArgs({
  allowPositionals: true,
  options: { by: { type: 'string', default: '' }, 'approved-by': { type: 'string', default: '' }, ref: { type: 'string', default: '' }, provider: { type: 'string', default: '' } },
})
const [cmd, a, b] = positionals

function user(id: string | undefined) {
  const u = db().users.find((x) => x.id === id)
  if (!u) throw new Error(`No staff member "${id}". Run list to see ids.`)
  return u
}

try {
  if (cmd === 'list' || !cmd) {
    const g = governance.snapshot
    console.log(`Resident content for agents: ${g.residentContent.allowed ? `ALLOWED (approved by ${g.residentContent.approvedBy}, ${g.residentContent.approvalRef}, ${g.residentContent.provider})` : 'not allowed'}`)
    console.log('\nStaff and agent access:')
    for (const u of db().users) console.log(`  ${u.id.padEnd(8)} ${u.name.padEnd(22)} ${u.role.padEnd(16)} ${u.status.padEnd(10)} ${governance.level(u.id)}`)
    const conns = new SocOAuthProvider({ file: join(dataDir, 'oauth.json'), passcode: 'x'.repeat(12), issuer: new URL('http://localhost'), governance }).connections()
    console.log(`\nConnected agents: ${conns.length}`)
    for (const c of conns) console.log(`  ${c.userId.padEnd(8)} ${c.client} [${c.scopes.join(' ')}] until ${c.until}`)
  } else if (cmd === 'grant') {
    if (b !== 'read' && b !== 'draft') throw new Error('Level must be read or draft.')
    governance.setLevel(user(a), b, values.by)
    console.log(`${user(a).name}: agent access is now ${b}.`)
  } else if (cmd === 'revoke') {
    governance.setLevel(user(a), 'none', values.by)
    console.log(`${user(a).name}: no agent access, and connected agents are signed out.`)
  } else if (cmd === 'sign-out') {
    governance.signOut(user(a), values.by)
    console.log(`${user(a).name}: connected agents are signed out. They can sign in again.`)
  } else if (cmd === 'resident-content' && a === 'allow') {
    governance.allowResidentContent({ approvedBy: values['approved-by'], approvalRef: values.ref, provider: values.provider, recordedBy: values.by })
    console.log('Agents may now read resident comments and messages.')
  } else if (cmd === 'resident-content' && a === 'deny') {
    governance.denyResidentContent(values.by)
    console.log('Agents may no longer read resident comments and messages.')
  } else {
    throw new Error(`Unknown command "${positionals.join(' ')}". See the top of src/admin.ts.`)
  }
} catch (e) {
  console.error(e instanceof Error ? e.message : e)
  process.exitCode = 1
}
