const validate = (schema) => (req, res, next) => {
  let inner = schema;
  while (inner && inner._def && inner._def.schema) {
    inner = inner._def.schema;
  }
  const hasSections = inner && inner.shape && (inner.shape.body || inner.shape.query || inner.shape.params);
  const target = hasSections
    ? { body: req.body, query: req.query, params: req.params }
    : req.body;

  const result = schema.safeParse(target);
  if (!result.success) {
    const issues = result.error.issues || result.error.errors || [];
    const errors = issues.map((iss) => ({
      field: iss.path.join('.'),
      message: iss.message,
    }));
    return res.status(400).json({
      message: errors[0]?.message || 'Validation failed.',
      errors,
    });
  }

  if (hasSections) {
    if (result.data.body) req.body = result.data.body;
    if (result.data.query) req.query = result.data.query;
    if (result.data.params) req.params = result.data.params;
  } else {
    req.body = result.data;
  }

  next();
};

module.exports = validate;
