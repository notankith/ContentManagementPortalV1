/*
Simple migration script to copy metadata from Supabase tables to MongoDB.
Usage:
  node scripts/migrate_supabase_to_mongo.js

Ensure environment variables are set: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, MONGODB_URI, MONGODB_DB (optional)
*/

const { createClient } = require('@supabase/supabase-js')
const { MongoClient } = require('mongodb')

async function run() {
  const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
  const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
  const MONGODB_URI = process.env.MONGODB_URI
  const MONGODB_DB = process.env.MONGODB_DB || 'content_portal'

  if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set to run migration')
    process.exit(1)
  }
  if (!MONGODB_URI) {
    console.error('MONGODB_URI must be set')
    process.exit(1)
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)
  const client = new MongoClient(MONGODB_URI)
  await client.connect()
  const db = client.db(MONGODB_DB)

  try {
    console.log('Migrating editors...')
    const { data: editors } = await supabase.from('editors').select('*')
    if (editors && editors.length) {
      // normalize timestamps
      const docs = editors.map((e) => ({ ...e, created_at: e.created_at ? new Date(e.created_at) : new Date() }))
      await db.collection('editors').insertMany(docs)
      console.log(`Inserted ${docs.length} editors`)
    }

    console.log('Migrating uploads...')
    const { data: uploads } = await supabase.from('uploads').select('*')
    if (uploads && uploads.length) {
      const docs = uploads.map((u) => ({ ...u, created_at: u.created_at ? new Date(u.created_at) : new Date() }))
      await db.collection('uploads').insertMany(docs)
      console.log(`Inserted ${docs.length} uploads`)
    }

    console.log('Migrating error_logs...')
    const { data: logs } = await supabase.from('error_logs').select('*')
    if (logs && logs.length) {
      const docs = logs.map((l) => ({ ...l, timestamp: l.timestamp ? new Date(l.timestamp) : new Date() }))
      await db.collection('error_logs').insertMany(docs)
      console.log(`Inserted ${docs.length} error_logs`)
    }

    console.log('Migration completed')
  } catch (err) {
    console.error('Migration error:', err)
  } finally {
    await client.close()
  }
}

run().catch((err) => {
  console.error(err)
  process.exit(1)
})
