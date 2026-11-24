import mongoose from 'mongoose'
import { env } from './env.js'

mongoose.set('strictQuery', true)
// fail fast instead of queueing queries forever when the database is down
mongoose.set('bufferCommands', false)

export async function connectDB() {
  await mongoose.connect(env.MONGODB_URI, { serverSelectionTimeoutMS: 8000 })
  console.log(`MongoDB connected (${mongoose.connection.name})`)
  if (mongoose.connection.name === 'test') console.warn('Warning: connected to the default "test" database. Put your database name in MONGODB_URI, e.g. ...mongodb.net/isaa?retryWrites=true')
}

export const disconnectDB = () => mongoose.disconnect()
export const dbState = () => (mongoose.connection.readyState === 1 ? 'connected' : 'disconnected')