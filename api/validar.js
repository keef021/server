let keys = global.keys || {}
global.keys = keys

export default function handler(req, res) {
    const key = req.query.key
    const agora = Date.now()

    if (keys[key] && agora - keys[key].createdAt <= 24*60*60*1000) {
        res.status(200).json({ valid: true })
    } else {
        res.status(200).json({ valid: false })
    }
}