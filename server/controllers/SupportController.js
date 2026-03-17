import SupportTicket from '../models/SupportTicket.js';
import User from '../models/User.js';
import { createNotification } from '../lib/notificationService.js';
import { sendError, sendSuccess } from '../lib/apiResponse.js';
import nodemailer from 'nodemailer';

const getUserId = (req) => req.user?.id || req.user?.userId || null;
const getRole = (req) => {
  const role = String(req.user?.role || '').toLowerCase();
  return role === 'admin' || role === 'superadmin' ? 'admin' : 'user';
};

const populateTicket = (query) =>
  query
    .populate('requester', 'firstName lastName email role status avatarUrl')
    .populate('messages.author', 'firstName lastName email role status');

const getEmailTransporter = () => {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 0);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !port || !user || !pass) return null;

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });
};

const getSupportAlertEmailList = () => {
  const configured = String(process.env.SUPPORT_ALERT_EMAILS || '')
    .split(',')
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
  return new Set(configured);
};

const isDeliverableEmail = (value) => {
  const email = String(value || '').trim().toLowerCase();
  if (!email) return false;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return false;
  const domain = email.split('@')[1] || '';
  // Skip local/dev-only domains that cause bounce emails in production SMTP.
  if (domain.endsWith('.local') || domain.endsWith('.invalid') || domain === 'localhost') return false;
  return true;
};

const findAdminRecipients = async () =>
  User.find({
    role: { $regex: /^(admin|superadmin)$/i },
    status: { $ne: 'deleted' },
  })
    .select('_id email firstName lastName role')
    .lean();

const notifyAdminsByEmail = async ({ ticket, requester, eventType = 'created' }) => {
  const transporter = getEmailTransporter();
  if (!transporter) return;

  const admins = await findAdminRecipients();
  const emailSet = getSupportAlertEmailList();
  admins.forEach((admin) => {
    if (admin?.email) emailSet.add(String(admin.email).toLowerCase().trim());
  });

  const recipients = Array.from(emailSet).filter(isDeliverableEmail);

  if (!recipients.length) return;

  const requesterName = `${requester?.firstName || ''} ${requester?.lastName || ''}`.trim() || requester?.email || 'User';
  const requesterRole = String(requester?.role || 'user').toLowerCase();
  const subjectPrefix = eventType === 'reply' ? 'Support ticket reply' : 'New support ticket';
  const mailSubject = `[MicroJobs] ${subjectPrefix}: ${ticket.subject}`;
  const from = process.env.SMTP_FROM || process.env.SMTP_USER;
  const ticketId = String(ticket._id || '');
  const appBase = process.env.ORIGIN || 'http://localhost:5173';
  const ticketUrl = `${String(appBase).replace(/\/$/, '')}/admin/support`;

  const text = [
    `${subjectPrefix}`,
    '',
    `Ticket ID: ${ticketId}`,
    `Subject: ${ticket.subject}`,
    `Category: ${ticket.category}`,
    `Priority: ${ticket.priority}`,
    `Status: ${ticket.status}`,
    `Submitted by: ${requesterName} (${requesterRole})`,
    `Requester email: ${requester?.email || 'N/A'}`,
    '',
    `Open in admin panel: ${ticketUrl}`,
  ].join('\n');

  await Promise.allSettled(
    recipients.map((to) => transporter.sendMail({ from, to, subject: mailSubject, text }))
  );
};

function shapeTicket(ticket) {
  if (!ticket) return null;
  const doc = ticket.toObject ? ticket.toObject() : ticket;
  return {
    ...doc,
    messageCount: Array.isArray(doc.messages) ? doc.messages.length : 0,
  };
}

export async function listSupportAgents(req, res) {
  try {
    const userId = getUserId(req);
    if (!userId) return sendError(res, 401, 'Authentication required.');

    const admins = await findAdminRecipients();
    const agents = admins.map((admin) => ({
      _id: String(admin._id),
      firstName: admin.firstName || '',
      lastName: admin.lastName || '',
      email: admin.email || '',
      role: String(admin.role || '').toLowerCase(),
      displayName:
        `${admin.firstName || ''} ${admin.lastName || ''}`.trim() ||
        admin.email ||
        'Support Admin',
    }));

    return sendSuccess(res, 200, 'Support agents retrieved.', agents, { agents });
  } catch (error) {
    console.error('List support agents error:', error);
    return sendError(res, 500, 'Failed to load support agents.');
  }
}

export async function listMySupportTickets(req, res) {
  try {
    const userId = getUserId(req);
    if (!userId) return sendError(res, 401, 'Authentication required.');

    const tickets = await populateTicket(
      SupportTicket.find({ requester: userId }).sort({ updatedAt: -1 })
    );

    const items = tickets.map(shapeTicket);
    return sendSuccess(res, 200, 'Support tickets retrieved.', items, { tickets: items });
  } catch (error) {
    console.error('List my support tickets error:', error);
    return sendError(res, 500, 'Failed to load support tickets.');
  }
}

export async function createSupportTicket(req, res) {
  try {
    const userId = getUserId(req);
    if (!userId) return sendError(res, 401, 'Authentication required.');

    const { subject, category = 'general', priority = 'medium', message } = req.body || {};
    if (!subject || !String(subject).trim()) return sendError(res, 400, 'subject is required.');
    if (!message || !String(message).trim()) return sendError(res, 400, 'message is required.');

    const ticket = await SupportTicket.create({
      requester: userId,
      subject: String(subject).trim(),
      category: String(category || 'general').trim() || 'general',
      priority: ['low', 'medium', 'high', 'urgent'].includes(priority) ? priority : 'medium',
      messages: [
        {
          author: userId,
          actorRole: 'user',
          body: String(message).trim(),
        },
      ],
      lastMessageAt: new Date(),
    });

    const populated = await populateTicket(SupportTicket.findById(ticket._id));

    const admins = await findAdminRecipients();
    await Promise.all(
      admins.map((admin) =>
        createNotification({
          userId: admin._id,
          type: 'support',
          title: 'New support ticket',
          message: `Support ticket "${ticket.subject}" was submitted.`,
          entityType: 'support_ticket',
          entityId: ticket._id,
          actor: userId,
          push: true,
          socketPayload: { ticketId: String(ticket._id), subject: ticket.subject, status: ticket.status },
        })
      )
    );

    await notifyAdminsByEmail({
      ticket,
      requester: populated?.requester,
      eventType: 'created',
    });

    return sendSuccess(res, 201, 'Support ticket created.', shapeTicket(populated), {
      ticket: shapeTicket(populated),
    });
  } catch (error) {
    console.error('Create support ticket error:', error);
    return sendError(res, 500, 'Failed to create support ticket.');
  }
}

export async function getSupportTicketById(req, res) {
  try {
    const userId = getUserId(req);
    const actorRole = getRole(req);
    const { ticketId } = req.params;
    if (!userId) return sendError(res, 401, 'Authentication required.');

    const filter = actorRole === 'admin' ? { _id: ticketId } : { _id: ticketId, requester: userId };
    const ticket = await populateTicket(SupportTicket.findOne(filter));
    if (!ticket) return sendError(res, 404, 'Support ticket not found.');

    return sendSuccess(res, 200, 'Support ticket retrieved.', shapeTicket(ticket), { ticket: shapeTicket(ticket) });
  } catch (error) {
    console.error('Get support ticket error:', error);
    return sendError(res, 500, 'Failed to load support ticket.');
  }
}

export async function replyToSupportTicket(req, res) {
  try {
    const userId = getUserId(req);
    const actorRole = getRole(req);
    const { ticketId } = req.params;
    const { message } = req.body || {};
    if (!userId) return sendError(res, 401, 'Authentication required.');
    if (!message || !String(message).trim()) return sendError(res, 400, 'message is required.');

    const filter = actorRole === 'admin' ? { _id: ticketId } : { _id: ticketId, requester: userId };
    const ticket = await SupportTicket.findOne(filter);
    if (!ticket) return sendError(res, 404, 'Support ticket not found.');
    if (ticket.status === 'closed') return sendError(res, 400, 'Closed tickets cannot be updated.');

    ticket.messages.push({
      author: userId,
      actorRole,
      body: String(message).trim(),
      createdAt: new Date(),
    });
    ticket.lastMessageAt = new Date();
    if (actorRole === 'admin') {
      ticket.status = 'waiting_user';
      ticket.lastAdminReplyAt = new Date();
    } else if (ticket.status === 'waiting_user') {
      ticket.status = 'in_progress';
    }
    await ticket.save();

    const populated = await populateTicket(SupportTicket.findById(ticket._id));

    if (actorRole === 'admin') {
      await createNotification({
        userId: ticket.requester,
        type: 'support',
        title: 'Support replied',
        message: `There is a new reply on ticket "${ticket.subject}".`,
        entityType: 'support_ticket',
        entityId: ticket._id,
        actor: userId,
        push: true,
        socketPayload: { ticketId: String(ticket._id), subject: ticket.subject, status: ticket.status },
      });
    } else {
      const admins = await findAdminRecipients();
      await Promise.all(
        admins.map((admin) =>
          createNotification({
            userId: admin._id,
            type: 'support',
            title: 'Support ticket updated',
            message: `Ticket "${ticket.subject}" has a new user reply.`,
            entityType: 'support_ticket',
            entityId: ticket._id,
            actor: userId,
            push: true,
            socketPayload: { ticketId: String(ticket._id), subject: ticket.subject, status: ticket.status },
          })
        )
      );

      await notifyAdminsByEmail({
        ticket,
        requester: populated?.requester,
        eventType: 'reply',
      });
    }

    return sendSuccess(res, 200, 'Support ticket updated.', shapeTicket(populated), { ticket: shapeTicket(populated) });
  } catch (error) {
    console.error('Reply to support ticket error:', error);
    return sendError(res, 500, 'Failed to update support ticket.');
  }
}

export async function listAdminSupportTickets(req, res) {
  try {
    const { status, priority, search } = req.query || {};
    const filter = {};
    if (status) filter.status = status;
    if (priority) filter.priority = priority;

    let tickets = await populateTicket(SupportTicket.find(filter).sort({ updatedAt: -1 }));
    if (search) {
      const query = String(search).trim().toLowerCase();
      tickets = tickets.filter((ticket) => {
        const subject = String(ticket.subject || '').toLowerCase();
        const requesterName = `${ticket.requester?.firstName || ''} ${ticket.requester?.lastName || ''}`.toLowerCase();
        const requesterEmail = String(ticket.requester?.email || '').toLowerCase();
        return subject.includes(query) || requesterName.includes(query) || requesterEmail.includes(query);
      });
    }

    const items = tickets.map(shapeTicket);
    return sendSuccess(res, 200, 'Admin support tickets retrieved.', items, { tickets: items });
  } catch (error) {
    console.error('List admin support tickets error:', error);
    return sendError(res, 500, 'Failed to load support tickets.');
  }
}

export async function updateAdminSupportTicket(req, res) {
  try {
    const { ticketId } = req.params;
    const { status, priority, reviewNotes } = req.body || {};
    const ticket = await SupportTicket.findById(ticketId);
    if (!ticket) return sendError(res, 404, 'Support ticket not found.');

    if (status) {
      const allowedStatuses = ['open', 'in_progress', 'waiting_user', 'resolved', 'closed'];
      if (!allowedStatuses.includes(status)) return sendError(res, 400, 'Invalid support status.');
      ticket.status = status;
      if (status === 'resolved') ticket.resolvedAt = new Date();
      if (status === 'closed') ticket.closedAt = new Date();
    }
    if (priority) {
      const allowedPriorities = ['low', 'medium', 'high', 'urgent'];
      if (!allowedPriorities.includes(priority)) return sendError(res, 400, 'Invalid support priority.');
      ticket.priority = priority;
    }
    if (reviewNotes !== undefined) {
      ticket.messages.push({
        author: req.user.id,
        actorRole: 'admin',
        body: String(reviewNotes || '').trim() || 'Ticket updated by admin.',
        createdAt: new Date(),
      });
      ticket.lastMessageAt = new Date();
      ticket.lastAdminReplyAt = new Date();
    }

    await ticket.save();
    const populated = await populateTicket(SupportTicket.findById(ticket._id));

    await createNotification({
      userId: ticket.requester,
      type: 'support',
      title: 'Support ticket updated',
      message: `Your support ticket "${ticket.subject}" is now ${ticket.status.replace(/_/g, ' ')}.`,
      entityType: 'support_ticket',
      entityId: ticket._id,
      actor: req.user.id,
      push: true,
      socketPayload: { ticketId: String(ticket._id), subject: ticket.subject, status: ticket.status },
    });

    return sendSuccess(res, 200, 'Support ticket updated.', shapeTicket(populated), { ticket: shapeTicket(populated) });
  } catch (error) {
    console.error('Update admin support ticket error:', error);
    return sendError(res, 500, 'Failed to update support ticket.');
  }
}
