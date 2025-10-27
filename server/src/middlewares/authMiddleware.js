const jwt = require("jsonwebtoken");

const authMiddleware = (req, res, next) => {
  try {
    const token = req.cookies.token;

    if (!token) {
      return res.status(401).json({
        error: "Access token is required",
      });
    }

    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET || "demo-secret-key"
    );
    req.user = decoded;
    next();
  } catch (error) {
    console.error("Auth middleware error:", error);
    res.status(401).json({
      error: "Invalid or expired token",
    });
  }
};

module.exports = authMiddleware;
