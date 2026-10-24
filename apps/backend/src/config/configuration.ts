import * as Joi from 'joi';

export const validationSchema = Joi.object({
  NODE_ENV: Joi.string().valid('development', 'production', 'test').default('development'),
  PORT: Joi.number().default(3001),
  DATABASE_URL: Joi.string().required(),
  JWT_SECRET: Joi.string().min(32).required(),
  JWT_EXPIRES_IN: Joi.string().default('12h'),
  FRONTEND_URL: Joi.string().default('http://localhost:3000'),
  ADJ_AUTO_APPROVE_LIMIT: Joi.number().integer().min(0).default(20),
  EXPIRY_WARNING_DAYS: Joi.number().integer().min(1).default(30),
});

export default () => ({
  port: parseInt(process.env.PORT ?? '3001', 10),
  database: { url: process.env.DATABASE_URL },
  jwt: {
    secret: process.env.JWT_SECRET,
    expiresIn: process.env.JWT_EXPIRES_IN ?? '12h',
  },
  frontendUrl: process.env.FRONTEND_URL ?? 'http://localhost:3000',
  inventory: {
    adjAutoApproveLimit: parseInt(process.env.ADJ_AUTO_APPROVE_LIMIT ?? '20', 10),
    expiryWarningDays: parseInt(process.env.EXPIRY_WARNING_DAYS ?? '30', 10),
  },
});
