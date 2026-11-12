/**
 * labIpOnly middleware — blocks requests not originating from the authorized lab IP.
 * LAB_IP is stored in .env (supports comma-separated list for multiple labs).
 */
const labIpOnly = (req, res, next) => {
    const labIps = (process.env.LAB_IP || '*')
        .split(',')
        .map(ip => ip.trim());

    // Get real client IP (handles proxies/nginx)
    // req.ip honours Express's "trust proxy" setting (TRUST_PROXY_HOPS, default 1 = the hosting platform's load balancer),
    // so only addresses added by a trusted proxy count. The raw first X-Forwarded-For entry was taken before, which any
    // caller can set to a lab address.
    const clientIp = req.ip || req.socket?.remoteAddress || '';

    // Normalize IPv6 loopback
    const normalizedIp = clientIp.replace('::ffff:', '');

    const isAllowed = labIps.includes(normalizedIp) || labIps.includes('*');

    if (!isAllowed) {
        return res.status(403).json({
            msg: 'Access denied: This portal is restricted to authorized lab systems only.',
            yourIp: normalizedIp
        });
    }

    // Attach lab IP flag to request for use in scorecard logic
    req.isLabIp = true;
    req.clientIp = normalizedIp;
    next();
};

const detectLabIp = (req, res, next) => {
    const labIps = (process.env.LAB_IP || '127.0.0.1')
        .split(',')
        .map(ip => ip.trim());

    const clientIp = req.ip || req.socket?.remoteAddress || '';

    const normalizedIp = clientIp.replace('::ffff:', '');
    req.isLabIp = labIps.includes(normalizedIp);
    req.clientIp = normalizedIp;
    next();
};

module.exports = { labIpOnly, detectLabIp };
