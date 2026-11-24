import { scrypt as scryptCb, randomBytes, timingSafeEqual } from 'node:crypto'
import { promisify } from 'node:util'

// Password hashing with scrypt (built into Node, no native add-on to install). Stored as
//   scrypt$N$r$p$<salt b64>$<hash b64>
// The cost parameters travel with each hash, so raising them later still verifies old passwords.
const scrypt = promisify(scryptCb)
const COST = { N: process.env.NODE_TEST_CONTEXT ? 2 ** 10 : 2 ** 15, r: 8, p: 1 } // tests use a cheap cost so they stay fast
const KEYLEN = 64
const maxmem = (N, r) => 128 * N * r * 2 // scrypt needs 128·N·r bytes; leave headroom

export async function hashPassword(password) {
  const salt = randomBytes(16)
  const key = await scrypt(password, salt, KEYLEN, { ...COST, maxmem: maxmem(COST.N, COST.r) })
  return ['scrypt', COST.N, COST.r, COST.p, salt.toString('base64'), key.toString('base64')].join('$')
}

export async function verifyPassword(password, stored) {
  const [scheme, N, r, p, salt, hash] = String(stored ?? '').split('$')
  if (scheme !== 'scrypt' || !salt || !hash) return false
  const n = Number(N), rr = Number(r), pp = Number(p)
  if (!Number.isInteger(n) || n < 2 ** 10 || n > 2 ** 20 || !Number.isInteger(rr) || !Number.isInteger(pp)) return false
  const expected = Buffer.from(hash, 'base64')
  const actual = await scrypt(password, Buffer.from(salt, 'base64'), expected.length, { N: n, r: rr, p: pp, maxmem: maxmem(n, rr) })
  return timingSafeEqual(actual, expected)
}

// A real hash of a throwaway password: checking against it when the email is unknown keeps the response time the same,
// so the login form can't be used to find out which emails have an account.
let dummy
export const dummyVerify = async (password) => { dummy ??= hashPassword('isaa-not-a-real-password'); return verifyPassword(password, await dummy) }

const COMMON = new Set(['password', 'password1', 'password12', 'password123', '1234567890', '12345678910', 'qwertyuiop', 'qwerty12345', 'iloveyou123', 'admin12345', 'welcome123', 'letmein1234', 'isaa123456', 'isaastore123'])

// Returns a message when the password is too weak, otherwise null.
export function passwordProblem(password, { email = '' } = {}) {
  if (typeof password !== 'string' || password.length < 10) return 'Use at least 10 characters.'
  if (password.length > 128) return 'Use 128 characters or fewer.'
  if (COMMON.has(password.toLowerCase())) return 'That password is too common.'
  if (/^(.)\1+$/.test(password)) return 'Use more than one repeated character.'
  const local = email.split('@')[0]?.toLowerCase()
  if (local && local.length >= 4 && password.toLowerCase().includes(local)) return 'Don’t include your email name in the password.'
  return null
}
