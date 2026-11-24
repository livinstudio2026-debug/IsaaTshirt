// Back-office accounts, from the command line (there is no public sign-up).
//   npm run admin:create                   asks for email, name and password (the password isn't shown or kept in shell history)
//   npm run admin:password                 sets a new password and signs that person out everywhere
//   npm run admin:list                     who has access
//   npm run admin:unlock -- a@b.com       lifts a 15-minute sign-in pause right away (e.g. someone kept guessing the owner's password)
//   npm run admin:disable -- a@b.com       blocks sign-in and ends their sessions (add --enable to restore access)
// Optional flags: --email=  --name=  --role=owner|staff    Non-interactive: ADMIN_PASSWORD=... npm run admin:create -- --email=a@b.com --name=Leo
import readline from 'node:readline/promises'
import { stdin, stdout, argv, exit, env as penv } from 'node:process'
import { z } from 'zod'
import { connectDB, disconnectDB } from '../config/db.js'
import { Admin } from '../models/Admin.js'
import { AdminSession } from '../models/AdminSession.js'
import { hashPassword, passwordProblem } from '../utils/password.js'

const [command, ...rest] = argv.slice(2)
const flags = Object.fromEntries(rest.filter((a) => a.startsWith('--')).map((a) => { const [k, ...v] = a.slice(2).split('='); return [k, v.length ? v.join('=') : true] }))
const positional = rest.filter((a) => !a.startsWith('--'))

const fail = (msg) => { console.error(`\n✗ ${msg}`); exit(1) }
const emailSchema = z.string().trim().toLowerCase().pipe(z.email().max(254))

// Piped input (e.g. `echo ... | npm run admin:create`): read it all once, hand out one line per question.
let piped
const pipedLine = async () => {
  piped ??= await new Promise((resolve) => { let data = ''; stdin.on('data', (c) => (data += c)); stdin.on('end', () => resolve(data.split(/\r?\n/))) })
  return (piped.shift() ?? '').trim()
}

async function ask(question) {
  if (!stdin.isTTY) return pipedLine()
  const rl = readline.createInterface({ input: stdin, output: stdout })
  const answer = await rl.question(question)
  rl.close()
  return answer.trim()
}

// reads a line without echoing it
function askHidden(question) {
  if (!stdin.isTTY) return ask(question)
  return new Promise((resolve) => {
    stdout.write(question)
    stdin.setRawMode(true); stdin.resume(); stdin.setEncoding('utf8')
    let buf = ''
    const done = (value) => { stdin.setRawMode(false); stdin.pause(); stdin.off('data', onData); stdout.write('\n'); resolve(value) }
    const onData = (chunk) => {
      for (const c of chunk) {
        if (c === '\r' || c === '\n' || c === '\u0004') return done(buf)
        if (c === '\u0003') { stdout.write('\n'); exit(130) }
        if (c === '\u007f' || c === '\b') buf = buf.slice(0, -1)
        else buf += c
      }
    }
    stdin.on('data', onData)
  })
}

async function newPassword(email) {
  if (penv.ADMIN_PASSWORD) {
    const problem = passwordProblem(penv.ADMIN_PASSWORD, { email })
    if (problem) fail(problem)
    return penv.ADMIN_PASSWORD
  }
  for (;;) {
    const pw = await askHidden('Password (min 10 characters): ')
    const problem = passwordProblem(pw, { email })
    if (problem) { console.log(`  ${problem}`); if (!stdin.isTTY) exit(1); continue }
    if ((await askHidden('Repeat password: ')) !== pw) { console.log('  The passwords didn’t match, try again.'); if (!stdin.isTTY) exit(1); continue }
    return pw
  }
}

const getEmail = async () => {
  const parsed = emailSchema.safeParse(flags.email || positional[0] || (await ask('Email: ')))
  if (!parsed.success) fail('That doesn’t look like an email address.')
  return parsed.data
}

async function create() {
  const email = await getEmail()
  if (await Admin.exists({ email })) fail(`${email} already has an account. Use \`npm run admin:password\` to change the password.`)
  const name = (flags.name && flags.name !== true ? flags.name : await ask('Name: ')).trim().slice(0, 80)
  if (!name) fail('A name is required.')
  const first = !(await Admin.exists({}))
  const role = flags.role ?? (first ? 'owner' : 'staff') // the first account is the owner
  if (!['owner', 'staff'].includes(role)) fail('--role must be owner or staff.')
  const passwordHash = await hashPassword(await newPassword(email))
  await Admin.create({ email, name, role, passwordHash, passwordChangedAt: new Date() })
  console.log(`\n✓ Created ${role} ${name} <${email}>. They can sign in at /admin/login.`)
}

async function password() {
  const email = await getEmail()
  const admin = await Admin.findOne({ email })
  if (!admin) fail(`No admin with the email ${email}.`)
  admin.passwordHash = await hashPassword(await newPassword(email))
  Object.assign(admin, { passwordChangedAt: new Date(), failedAttempts: 0, lockedUntil: null })
  await admin.save()
  const { deletedCount } = await AdminSession.deleteMany({ admin: admin._id })
  console.log(`\n✓ Password updated for ${email}. Signed out of ${deletedCount} session${deletedCount === 1 ? '' : 's'}.`)
}

async function list() {
  const admins = await Admin.find().sort({ createdAt: 1 }).lean()
  if (!admins.length) return console.log('No admins yet. Run `npm run admin:create`.')
  for (const a of admins) console.log(`${a.isActive ? '●' : '○'} ${a.email.padEnd(32)} ${a.role.padEnd(6)} ${a.name}  (last sign-in: ${a.lastLoginAt ? a.lastLoginAt.toISOString().slice(0, 16).replace('T', ' ') : 'never'})${a.isActive ? '' : '  [disabled]'}`)
}

async function disable() {
  const email = await getEmail()
  const enable = Boolean(flags.enable)
  const { matchedCount } = await Admin.updateOne({ email }, { $set: { isActive: enable } })
  if (!matchedCount) fail(`No admin with the email ${email}.`)
  if (!enable) await AdminSession.deleteMany({ admin: (await Admin.findOne({ email }).select('_id').lean())._id })
  console.log(`\n✓ ${email} ${enable ? 'can sign in again' : 'is disabled and signed out'}.`)
}

async function unlock() {
  const email = await getEmail()
  const { matchedCount } = await Admin.updateOne({ email }, { $set: { failedAttempts: 0, lockedUntil: null } })
  if (!matchedCount) fail(`No admin with the email ${email}.`)
  console.log(`\n✓ ${email} can sign in again.`)
}

const commands = { create, password, list, disable, unlock }
if (!commands[command]) fail('Usage: npm run admin:create | admin:password | admin:list | admin:disable | admin:unlock -- <email>')

try {
  await connectDB()
  await commands[command]()
} catch (err) {
  fail(err.code === 11000 ? 'That email already has an account.' : err.message)
} finally {
  await disconnectDB()
}
