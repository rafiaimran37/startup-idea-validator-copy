function success(message, data = {}, meta = {}) {
  return {
    success: true,
    status: "running",
    message,
    data,
    meta,
    timestamp: new Date().toISOString(),
  };
}

function failure(message, details = null, meta = {}) {
  return {
    success: false,
    status: "error",
    error: message,
    details,
    meta,
    timestamp: new Date().toISOString(),
  };
}

module.exports = {
  success,
  failure,
};