import crypto from "crypto"

let keys = global.keys || {}
global.keys = keys

export default function handler(req, res) {
    const agora = Date.now()

    for (let k in keys) {
        if (agora - keys[k].createdAt > 24*60*60*1000) {
            delete keys[k]
        }
    }

    const key = crypto.randomBytes(6).toString("hex").toUpperCase()
    keys[key] = { createdAt: agora, valid: true }

    res.setHeader("Content-Type", "text/html")
    res.status(200).send(`
        <h1>Sua Key:</h1>
        <h2>${key}</h2>
        <p>✅ Valida por 24 horas</p>
        <p>Copie e cole no script Roblox/Delta</p>
    `)
}
