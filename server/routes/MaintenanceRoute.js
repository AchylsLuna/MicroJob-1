import { Router } from 'express';
import crypto from 'node:crypto';
import { runMaintenance } from '../services/maintenance.js';
const router = Router();
router.post('/', async (req, res) => {
  const expected = process.env.MAINTENANCE_SECRET;
  const received = String(req.get('authorization') || '').replace(/^Bearer /, '');
  if (!expected || !received || Buffer.byteLength(received) !== Buffer.byteLength(expected) || !crypto.timingSafeEqual(Buffer.from(received), Buffer.from(expected))) return res.sendStatus(401);
  try { return res.json(await runMaintenance()); }
  catch (error) { console.error('Maintenance failed:', error.message); return res.status(500).json({ message: 'Maintenance failed.' }); }
});
export default router;
