import Database from "@replit/database";

const db = new Database();

export default async function handler(req,res){
    const key = req.query.key?.trim();
    if(!key) return res.status(400).json({ valid:false });

    const timestamp = await db.get(key);
    if(timestamp && (Date.now() - timestamp <= 24*60*60*1000)){
        res.status(200).json({ valid:true });
    } else {
        res.status(200).json({ valid:false });
    }
}
