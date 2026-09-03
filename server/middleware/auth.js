import jwt from "jsonwebtoken";
import Session from '../models/Session.js';
import User from '../models/User.js';
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

        const sessionId = decoded?.sessionId;
        if (!sessionId) {
            return res.status(401).json({ message: 'Active session required.' });
        }
        {
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

        const authoritativeUser = await User.findById(tokenUserId).select('role staffRole status');
        if (!authoritativeUser || authoritativeUser.status !== 'active') {
            await Session.updateOne(
                { _id: sessionId, active: true },
                { $set: { active: false, endedAt: new Date() } },
            );
            return res.status(401).json({ message: 'Account is not active.' });
        }

        req.user = {
            ...decoded,
            id: tokenUserId,
            userId: tokenUserId,
            sessionId,
            // Both of these come from the database, not the token, and are set
            // after the spread so a forged claim can never override them. The
            // admin permission matrix reads staffRole (see lib/adminPermissions.js);
            // when it was missing here, every admin fell through to the
            // admin_team fallback and staff sub-roles went unenforced.
            role: authoritativeUser.role,
            staffRole: authoritativeUser.staffRole ?? null,
        };
        next();
    } catch (error) {
        res.status(401).json({ message: "Invalid or expired token." });
    }
}

export default verifyToken;
