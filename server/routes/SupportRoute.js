import { Router } from 'express';
import auth from '../middleware/auth.js';
import {
  listMySupportTickets,
  createSupportTicket,
  getSupportTicketById,
  replyToSupportTicket,
} from '../controllers/SupportController.js';

const router = Router();

router.get('/tickets', auth, listMySupportTickets);
router.post('/tickets', auth, createSupportTicket);
router.get('/tickets/:ticketId', auth, getSupportTicketById);
router.post('/tickets/:ticketId/replies', auth, replyToSupportTicket);

export default router;
