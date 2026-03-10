import jwt from "jsonwebtoken";
import Session from '../models/Session.js';
import { getJwtSecret } from '../lib/jwtSecret.js';

const verifyToken = async (req, res, next) => {
    // Prefer Authorization bearer token to avoid stale cookie overriding a fresh session token.
    let token = null;
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
        token = authHeader.substring(7);
    }

    if (!token) {
        token = req.cookies?.token;
    }

    if (!token) {
        return res.status(401).json({ message: "Authentication required." });
    }

    try {
        const decoded = jwt.verify(token, getJwtSecret());
        const tokenUserId = decoded?.userId || decoded?.id || decoded?._id;

        if (!tokenUserId) {
            return res.status(401).json({ message: "Invalid token payload." });
        }

        let sessionId = decoded?.sessionId;
        // Legacy OTP tokens may not contain sessionId; allow them without session enforcement.
        // New login tokens include sessionId and continue through strict session validation.
        if (sessionId) {
            try {
                const sess = await Session.findById(sessionId);
                if (!sess || !sess.active) {
                    return res.status(401).json({ message: 'Session invalid or ended. Please login again.' });
                }
                if (String(sess.user) !== String(tokenUserId)) {
                    return res.status(401).json({ message: 'Session does not match token user.' });
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
        }

        req.user = {
            ...decoded,
            id: tokenUserId,
            userId: tokenUserId,
            sessionId,
        };
        next();
    } catch (error) {
        res.status(401).json({ message: "Invalid or expired token." });
    }
}

export default verifyToken;
