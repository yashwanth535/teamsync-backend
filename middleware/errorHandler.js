const errorHandler = (err, req, res, next) => {
  const error = {
    success: false,
    message: "An error occurred",
    status: err.status || 500,
  };

  if (process.env.NODE_ENV === "development") {
    error.details = err.message;
    error.stack = err.stack;
  }

  if (err.name === "ValidationError") {
    error.status = 400;
    error.message = Object.values(err.errors)
      .map((e) => e.message)
      .join(", ");
  }

  if (err.code === 11000) {
    error.status = 409;
    error.message = "Duplicate entry found";
  }

  res.status(error.status).json(error);
};

module.exports = errorHandler;
