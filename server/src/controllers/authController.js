const authService = require("../services/authService");

class AuthController {
  async login(req, res) {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        return res.status(400).json({
          error: "Email and password are required",
        });
      }

      const result = await authService.login(email, password);

      // Set JWT token in cookie
      res.cookie("token", result.token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        maxAge: 24 * 60 * 60 * 1000, // 24 hours
      });

      res.json({
        message: "Login successful",
        user: result.user,
      });
    } catch (error) {
      console.error("Login error:", error);
      res.status(401).json({
        error: error.message || "Login failed",
      });
    }
  }

  async register(req, res) {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        return res.status(400).json({
          error: "Email and password are required",
        });
      }

      const result = await authService.register(email, password);

      // Set JWT token in cookie
      res.cookie("token", result.token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        maxAge: 24 * 60 * 60 * 1000, // 24 hours
      });

      res.status(201).json({
        message: "Registration successful",
        user: result.user,
      });
    } catch (error) {
      console.error("Registration error:", error);
      res.status(400).json({
        error: error.message || "Registration failed",
      });
    }
  }

  async logout(req, res) {
    try {
      const result = await authService.logout();

      // Clear the JWT cookie
      res.clearCookie("token");

      res.json(result);
    } catch (error) {
      console.error("Logout error:", error);
      res.status(500).json({
        error: "Logout failed",
      });
    }
  }
}

module.exports = new AuthController();
