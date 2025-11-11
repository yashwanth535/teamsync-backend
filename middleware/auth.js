import jwt from "jsonwebtoken";
import User from "../models/User.js";

export default async (req, res, next) => {
  try {
    // Get token from header
    const token = req.header("x-auth-token");
    console.log("Auth middleware - Token received:", token ? "Present" : "Missing");

    // Check if no token
    if (!token) {
      return res.status(401).json({ message: "No token, authorization denied" });
    }

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    console.log("Auth middleware - Token decoded:", decoded);

    // Get user from token
    const userId = decoded.user?.id || decoded.id;
    console.log("Auth middleware - Looking for user with ID:", userId);

    const user = await User.findById(userId)
      .select("-password")
      .populate({
        path: "teams",
        select: "name description",
      });

    if (!user) {
      console.log("Auth middleware - User not found");
      return res.status(401).json({ message: "Token is not valid" });
    }

    // Ensure teams is an array
    if (!Array.isArray(user.teams)) {
      user.teams = [];
    }

    console.log("Auth middleware - User found:", user.id, "Teams:", user.teams.length);
    req.user = user;
    next();
  } catch (err) {
    console.error("Auth middleware error:", err);
    res.status(401).json({ message: "Token is not valid" });
  }
};
