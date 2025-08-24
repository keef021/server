import Database from "@replit/database";
import crypto from "crypto";

const db = new Database();

export default async function handler(req,res){
    // Limpar Keys antigas
    const allKeys = await db.list();
    const agora = Date.now();
    for(const key of allKeys){
        const timestamp = await db.get(key);
        if(agora - timestamp > 24*60*60*1000){
            await db.delete(key);
        }
    }

    // Criar Key nova
    const key = crypto.randomBytes(6).toString("hex").toUpperCase();
    await db.set(key, agora);

    res.setHeader("Content-Type","text/html");
    res.status(200).send(`
        <h1>Sua Key:</h1>
        <h2>${key}</h2>
        <p>✅ Valida por 24 horas</p>
        <p>Copie e cole no script</p>
    `);
}
