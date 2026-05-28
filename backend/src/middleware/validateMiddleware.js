export const validate = (schema) => (req, res, next) => {
  const result = schema.safeParse(req.body);

  if (!result.success) {
    return res.status(400).json({
      message: 'Dados inválidos',
      errors: result.error.errors.map(e => ({
        field: e.path.join('.'),
        message: e.message
      }))
    });
  }

  req.body = result.data; // substitui pelo dado já validado e tipado
  next();
};