const { AppError } = require('../errors/AppError');

/**
 * Returns an Express middleware that validates req.body against a plain-object schema.
 * Schema is a map of field -> { required, type, minLength, maxLength, pattern, custom }.
 *
 * FUTURE: swap in Zod or Joi schema when team moves to TypeScript or when schema complexity grows.
 */
function validate(schema) {
  return (req, res, next) => {
    const errors = [];

    for (const [field, rules] of Object.entries(schema)) {
      const value = req.body[field];

      if (rules.required && (value === undefined || value === null || value === '')) {
        errors.push(`${field} is required`);
        continue;
      }

      if (value === undefined || value === null) continue;

      if (rules.type === 'email') {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(value)) errors.push(`${field} must be a valid email`);
      }

      if (rules.minLength && String(value).length < rules.minLength) {
        errors.push(`${field} must be at least ${rules.minLength} characters`);
      }

      if (rules.maxLength && String(value).length > rules.maxLength) {
        errors.push(`${field} must be at most ${rules.maxLength} characters`);
      }

      if (rules.pattern && !rules.pattern.test(value)) {
        errors.push(rules.patternMessage || `${field} has invalid format`);
      }

      if (rules.custom) {
        const customError = rules.custom(value, req.body);
        if (customError) errors.push(customError);
      }
    }

    if (errors.length > 0) {
      return next(AppError.badRequest(errors.join('; '), 'VALIDATION_ERROR'));
    }

    return next();
  };
}

module.exports = { validate };
