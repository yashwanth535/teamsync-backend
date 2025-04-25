const sanitizeInput = (input) => {
  if (typeof input !== "string") return input;
  return input
    .trim()
    .replace(/[<>]/g, "")
    .replace(/javascript:/gi, "")
    .replace(/on\w+=/gi, "");
};

const sanitizeBody = (req, res, next) => {
  if (req.body) {
    Object.keys(req.body).forEach((key) => {
      req.body[key] = sanitizeInput(req.body[key]);
    });
  }
  next();
};

module.exports = sanitizeBody;
