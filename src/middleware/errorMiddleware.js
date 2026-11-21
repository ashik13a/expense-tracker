import { ZodError } from 'zod';
import { env } from '../config/env.js';
import { sendError } from '../utils/apiResponse.js';

export const notFoundHandler = (req, res) => {
  return sendError(res, {
    statusCode: 404,
    message: `Route not found: ${req.method} ${req.originalUrl}`,
  });
};

export const errorHandler = (err, _req, res, _next) => {
  if (err instanceof ZodError) {
    const errors = err.issues.map((issue) => ({
      field: issue.path.join('.'),
      message: issue.message,
    }));
    return sendError(res, {
      statusCode: 400,
      message: 'Validation failed',
      errors,
    });
  }

  if (err?.code === 11000) {
    const duplicateField = Object.keys(err.keyPattern || {})[0] || 'resource';
    return sendError(res, {
      statusCode: 409,
      message: `Duplicate value for ${duplicateField}`,
      errors: [{ field: duplicateField, message: 'Already exists' }],
    });
  }

  if (err?.name === 'CastError') {
    return sendError(res, {
      statusCode: 400,
      message: 'Invalid identifier format',
      errors: [{ field: err.path || 'id', message: 'Invalid ID' }],
    });
  }

  if (err?.name === 'ValidationError') {
    const errors = Object.values(err.errors || {}).map((item) => ({
      field: item.path,
      message: item.message,
    }));
    return sendError(res, {
      statusCode: 400,
      message: 'Validation failed',
      errors,
    });
  }

  if (err?.isOperational) {
    return sendError(res, {
      statusCode: err.statusCode,
      message: err.message,
      errors: err.errors || [],
    });
  }

  console.error('Unhandled server error:', err);
  return sendError(res, {
    statusCode: 500,
    message: env.nodeEnv === 'production' ? 'Internal server error' : err.message || 'Server error',
  });
};
