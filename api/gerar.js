import crypto from "crypto"
import { connectToMongo } from "./mongo.js"

export default async function handler(req,res){
    const { db } = await connectToMongo()
    const keysCollection = db.collection("keys")

    // Limpa keys expiradas
    const agora = new Date()
    await keysCollection.deleteMany({ createdAt: { $lt: new Date(agora - 24*60*60*1000) } })

    // Gera Key única
    const key = crypto.randomBytes(6).toString("hex").toUpperCase()
    await keysCollection.insertOne({ key, createdAt: new Date() })

    res.setHeader("Content-Type","text/html")
    res.status(200).send(`
        <h1>Sua Key:</h1>
        <h2>${key}</h2>
        <p>✅ Valida por 24 horas</p>
        <p>Copie e cole no script Roblox/Delta</p>
    `)
}
