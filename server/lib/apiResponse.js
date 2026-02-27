const isRecord = (value) => Boolean(value && typeof value === 'object' && !Array.isArray(value));

export function sendSuccess(res, statusCode, message, data = null, extra = {}) {
  const payload = {
    success: true,
    message,
    data,
  };

  if (isRecord(extra)) {
    const dataRecord = isRecord(data) ? data : null;

    for (const [key, value] of Object.entries(extra)) {
      if (key === 'success' || key === 'message' || key === 'data') continue;
      if (Object.is(value, data)) continue;
      if (dataRecord && key in dataRecord && Object.is(value, dataRecord[key])) continue;
      payload[key] = value;
    }
  }

  return res.status(statusCode).json(payload);
}

export function sendError(res, statusCode, message, extra = {}) {
  return res.status(statusCode).json({
    success: false,
    message,
    ...extra,
  });
}
