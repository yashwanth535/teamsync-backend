const crypto = require("crypto");

// Generate secure random token
const generateToken = (length = 32) => {
  return crypto.randomBytes(length).toString("hex");
};

// Validate email format
const isValidEmail = (email) => {
  const emailRegex = /^[\w-]+(\.[\w-]+)*@([\w-]+\.)+[a-zA-Z]{2,7}$/;
  return emailRegex.test(email);
};

// Validate password strength
const isStrongPassword = (password) => {
  const minLength = 8;
  const hasUpperCase = /[A-Z]/.test(password);
  const hasLowerCase = /[a-z]/.test(password);
  const hasNumbers = /\d/.test(password);
  const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password);

  return (
    password.length >= minLength &&
    hasUpperCase &&
    hasLowerCase &&
    hasNumbers &&
    hasSpecialChar
  );
};

// Sanitize user input
const sanitizeInput = (input) => {
  if (typeof input !== "string") return input;
  return input.trim().replace(/[<>]/g, "");
};

// Format error message
const formatErrorMessage = (error) => {
  if (error.name === "ValidationError") {
    return Object.values(error.errors)
      .map((err) => err.message)
      .join(", ");
  }
  return error.message || "An error occurred";
};

// Parse query parameters
const parseQueryParams = (query) => {
  const page = parseInt(query.page) || 1;
  const limit = parseInt(query.limit) || 10;
  const sort = query.sort || "-createdAt";

  return { page, limit, sort };
};

module.exports = {
  generateToken,
  isValidEmail,
  isStrongPassword,
  sanitizeInput,
  formatErrorMessage,
  parseQueryParams,
};
