import { MongoClient } from "mongodb"

let cachedClient = global.mongoClient
let cachedDb = global.mongoDb

export async function connectToMongo() {
    if (cachedClient && cachedDb) return { client: cachedClient, db: cachedDb }

    const uri = process.env.MONGO_URI // sua URI do MongoDB Atlas
    const client = new MongoClient(uri)
    await client.connect()
    const db = client.db("keysystem")
    cachedClient = client
    cachedDb = db
    global.mongoClient = client
    global.mongoDb = db
    return { client, db }
}
