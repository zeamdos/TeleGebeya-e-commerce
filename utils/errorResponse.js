function sendError(res, statusCode, error, fallbackMessage) {
  const isProd = process.env.NODE_ENV === 'production';
  console.error(fallbackMessage, error);
  res.status(statusCode).json({
    message: isProd ? fallbackMessage : (error?.message || fallbackMessage)
  });
}
module.exports = { sendError };