import CategoryRoute from './CategoryRoute.js';
import JobRoute from './JobRoute.js';
import UserRoute from './UserRoute.js';
import authRoutes from './authRoutes.js';
import JobApplicationRoute from './JobApplicationRoute.js';
import MessageRoute from './MessageRoute.js';
import paymentRoutes from './PaymentRoute.js';
import AlertRoute from './AlertRoute.js';
import NotificationRoute from './NotificationRoute.js';
import AdminRoute from './AdminRoute.js';
import SavedJobRoute from './SavedJobRoute.js';
import SupportRoute from './SupportRoute.js';
import ProfileRoute from './ProfileRoute.js';
import ReviewRoute from './ReviewRoute.js';

export const registerRoutes = (app) => {
    app.get('/', (req, res) => {
        res.json({ message: 'Backend server is running' });
    });

    app.get('/api/ready', (req, res) => {
        res.json({ status: 'ready' });
    });

    // Auth routes (includes login, register, logout)
    app.use('/api/auth', authRoutes);
    app.use('/api/auth', ProfileRoute);

    // Other routes
    app.use('/api/categories', CategoryRoute);
    app.use('/api/jobs', JobRoute);
    app.use('/api/users', UserRoute);
    app.use('/api', JobApplicationRoute);
    app.use('/api/messages', MessageRoute);
    app.use('/api/payment', paymentRoutes);
    app.use('/api/alerts', AlertRoute);
    app.use('/api/notifications', NotificationRoute);
    app.use('/api/admin', AdminRoute);
    app.use('/api/saved-jobs', SavedJobRoute);
    app.use('/api/support', SupportRoute);
    app.use('/api/reviews', ReviewRoute);
};
