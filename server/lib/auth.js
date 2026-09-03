import jwt from 'jsonwebtoken';
import Session from '../models/Session.js';
import User from '../models/User.js';
import { getJwtSecret } from './jwtSecret.js';

export const isAdminRole = (role = '') => {
    const normalized = String(role || '').toLowerCase();
    return normalized === 'admin' || normalized === 'superadmin';
};

export const getAuthContextFromRequest = async (req) => {
    let token = null;
    let isDownloadToken = false;
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
        token = authHeader.substring(7);
    }
    if (!token) {
        token = req.cookies?.token;
    }
    if (!token && req.query?.downloadToken) {
        token = String(req.query.downloadToken);
        isDownloadToken = true;
    }
    if (!token) {
        return null;
    }

    try {
        const decoded = jwt.verify(token, getJwtSecret());
        if (isDownloadToken) {
            if (decoded?.purpose !== 'upload-download' || decoded?.fileName !== req.params?.fileName) {
                return null;
            }
        }
        const userId = decoded?.userId || decoded?.id || decoded?._id;
        if (!userId) {
            return null;
        }

        const sessionId = decoded?.sessionId;
        if (sessionId) {
            const session = await Session.findById(sessionId).select('user active expiresAt');
            if (!session || !session.active) {
                return null;
            }
            if (String(session.user) !== String(userId)) {
                return null;
            }
            if (session.expiresAt && session.expiresAt.getTime() < Date.now()) {
                return null;
            }
        }

        // Read the role from the database rather than the token. UploadRoute
        // gates resumes and KYC documents on isAdminRole(authContext.role), and
        // a token minted before a demotion stays valid for its full 15-minute
        // TTL -- long enough to pull files the account should no longer see.
        const account = await User.findById(userId).select('role staffRole status');
        if (!account || account.status !== 'active') {
            return null;
        }

        return {
            id: String(userId),
            role: account.role,
            staffRole: account.staffRole ?? null,
        };
    } catch {
        return null;
    }
};
