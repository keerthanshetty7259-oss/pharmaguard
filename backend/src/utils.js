// Error with an HTTP status that the error handler in server.js turns into a JSON response.
function httpError(status, message, extra = {}) {
  const err = new Error(message);
  err.status = status;
  err.extra = extra;
  return err;
}

// Wrap async route handlers so thrown errors reach the error handler.
const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

const SEVERITY_ORDER = { major: 0, moderate: 1, minor: 2, unknown: 3 };
const severityRank = (s) => SEVERITY_ORDER[String(s || '').toLowerCase()] ?? 3;

module.exports = { httpError, asyncHandler, severityRank };
