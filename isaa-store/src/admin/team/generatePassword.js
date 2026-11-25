// A readable one-time password: 12 letters and digits in three groups, no look-alikes (0/o, 1/l/i). Made with the browser's secure random source.
const ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789'
export function generatePassword() {
  const bytes = crypto.getRandomValues(new Uint8Array(12))
  const chars = [...bytes].map((b) => ALPHABET[b % ALPHABET.length])
  return [chars.slice(0, 4), chars.slice(4, 8), chars.slice(8)].map((g) => g.join('')).join('-')
}
