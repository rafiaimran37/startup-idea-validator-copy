const jwt = require("jsonwebtoken");

function getTokenFromHeader(req) {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    return authHeader.slice(7).trim();
  }

  // This fallback helps during quick testing with custom headers.
  const token = req.headers["x-auth-token"];
  return typeof token === "string" ? token.trim() : "";
}

function authenticateToken(req, res, next) {
  const token = getTokenFromHeader(req);

  if (!token) {
    return res.status(401).json({ error: "Access denied. No token provided." });
  }

  try {
    const secret = process.env.JWT_SECRET;
    if (!secret) {
      return res.status(500).json({ error: "JWT_SECRET is not configured." });
    }

    const decoded = jwt.verify(token, secret);
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ error: "Invalid or expired token." });
  }
}

module.exports = {
  authenticateToken,
};