import jwt from "jsonwebtoken";

const verifyToken = (req, res, next) => {
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
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'dev-secret');
        req.user = decoded;
        if (req.user?.userId && !req.user?.id) {
            req.user.id = req.user.userId;
        }
        next();
    } catch (error) {
        res.status(401).json({ message: "Invalid or expired token." });
    }
}

export default verifyToken;
