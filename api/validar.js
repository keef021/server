import { connectToMongo } from "./mongo.js"

export default async function handler(req,res){
    const key = req.query.key?.trim()
    if(!key) return res.status(400).json({ valid:false })

    const { db } = await connectToMongo()
    const keysCollection = db.collection("keys")

    const agora = new Date()
    const keyData = await keysCollection.findOne({ key })

    if(keyData && (agora - keyData.createdAt) <= 24*60*60*1000){
        res.status(200).json({ valid:true })
    } else {
        res.status(200).json({ valid:false })
    }
}
