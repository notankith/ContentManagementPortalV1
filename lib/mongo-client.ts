import { MongoClient, Db } from "mongodb"

const uri = process.env.MONGODB_URI
const dbName = process.env.MONGODB_DB || "content_portal"

if (!uri) {
  throw new Error("MONGODB_URI is not set in environment variables")
}

let cachedClient: MongoClient | null = null
let cachedDb: Db | null = null

export async function connectToDatabase() {
  if (cachedClient && cachedDb) {
    return { client: cachedClient, db: cachedDb }
  }

  const client = new MongoClient(uri)
  await client.connect()
  const db = client.db(dbName)

  cachedClient = client
  cachedDb = db

  return { client, db }
}

export async function getDb() {
  const { db } = await connectToDatabase()
  return db
}

export async function getClient() {
  const { client } = await connectToDatabase()
  return client
}

export default connectToDatabase
