const checkRole = (roles) => (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
        return res.status(403).json({ msg: 'Access denied: Insufficient permissions' });
    }
    next();
};

module.exports = checkRole;
