// Import this FIRST in every integration test: it puts the app in test mode (rate limits off, quiet logs, cheap password hashing)
// before any source file reads the environment, even when a test file is started on its own with `node --test file`.
process.env.NODE_ENV = 'test'
process.env.NODE_TEST_CONTEXT ??= 'child-v8'
process.env.CLIENT_ORIGIN = 'http://localhost:5173'
process.env.CONTACT_TO = 'shop@isaa.test'
process.env.LOW_STOCK_AT = '5'
