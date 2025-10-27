const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const { User } = require("../models");

class AuthService {
  async login(email, password) {
    // For demo purposes, create a demo user if it doesn't exist
    let user = await User.findOne({ where: { email } });

    if (!user) {
      // Create demo user with hashed password
      const hashedPassword = await bcrypt.hash("demo123", 10);
      user = await User.create({
        email,
        password: hashedPassword,
      });
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      throw new Error("Invalid credentials");
    }

    // Generate JWT token
    const token = jwt.sign(
      { userId: user.id, email: user.email },
      process.env.JWT_SECRET || "demo-secret-key",
      { expiresIn: "24h" }
    );

    return {
      user: {
        id: user.id,
        email: user.email,
      },
      token,
    };
  }

  async register(email, password) {
    // Check if user already exists
    const existingUser = await User.findOne({ where: { email } });
    if (existingUser) {
      throw new Error("User already exists");
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create new user
    const user = await User.create({
      email,
      password: hashedPassword,
    });

    // Generate JWT token
    const token = jwt.sign(
      { userId: user.id, email: user.email },
      process.env.JWT_SECRET || "demo-secret-key",
      { expiresIn: "24h" }
    );

    return {
      user: {
        id: user.id,
        email: user.email,
      },
      token,
    };
  }

  async logout() {
    // In a real implementation, you might want to blacklist the token
    // For demo purposes, we'll just return success
    return { message: "Logged out successfully" };
  }
}

module.exports = new AuthService();
