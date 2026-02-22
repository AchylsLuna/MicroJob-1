import jwt from "jsonwebtoken";
import Session from '../models/Session.js';
import { getJwtSecret } from '../lib/jwtSecret.js';

const verifyToken = async (req, res, next) => {
    // Check for token in Authorization header or cookies
    let token = req.cookies?.token;

    if (!token) {
        const authHeader = req.headers.authorization;
        if (authHeader && authHeader.startsWith('Bearer ')) {
            token = authHeader.substring(7);
        }
    }

    if (!token) {
        return res.status(401).json({ message: "Authentication required." });
    }

    try {
        const decoded = jwt.verify(token, getJwtSecret());
        // verify there's an active session for this sessionId and it's not expired
        try {
            let sessionId = decoded.sessionId;
            // Determine user id from token (support legacy tokens that used `id`)
            const tokenUserId = decoded.userId || decoded.id || decoded._id;

            // If token lacks sessionId (legacy token), create a session automatically
            if (!sessionId) {
                try {
                    if (!tokenUserId) {
                        // cannot create session without a user id
                        console.warn('Legacy token missing user id, cannot create session');
                        return res.status(401).json({ message: 'Session creation failed. Please login again.' });
                    }
                    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
                    const newSess = await Session.create({
                        user: tokenUserId,
                        userAgent: req.get('User-Agent') || '',
                        ip: req.headers['x-forwarded-for'] || req.socket.remoteAddress || '',
                        token,
                        active: true,
                        expiresAt,
                    });
                    sessionId = newSess._id.toString();
                    // attach sessionId and canonical userId back into decoded so downstream can use them
                    decoded.sessionId = sessionId;
                    decoded.userId = tokenUserId;
                } catch (createErr) {
                    console.warn('Failed to create session for legacy token', createErr);
                    return res.status(401).json({ message: 'Session creation failed. Please login again.' });
                }
            }

            const sess = await Session.findById(sessionId);
            if (!sess || !sess.active) {
                return res.status(401).json({ message: 'Session invalid or ended. Please login again.' });
            }
            if (sess.expiresAt && sess.expiresAt.getTime() < Date.now()) {
                // mark session ended
                sess.active = false;
                sess.endedAt = new Date();
                await sess.save();
                return res.status(401).json({ message: 'Session expired. Please login again.' });
            }
        } catch (sessErr) {
            console.warn('Session check failed', sessErr);
            return res.status(401).json({ message: 'Session validation failed.' });
        }

        req.user = decoded;
        next();
    } catch (error) {
        res.status(401).json({ message: "Invalid or expired token." });
    }
}

export default verifyToken;
