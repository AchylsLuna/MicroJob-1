const requireAdmin = (req, res, next) => {
  const role = req.user?.role;
  if (role === 'superadmin' || role === 'admin') {
    return next();
  }
  return res.status(403).json({ message: 'Admin access required.' });
};

export default requireAdmin;
