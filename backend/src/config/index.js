const { appConfig, validateEnv } = require('./app.config');
const { connectDatabase, disconnectDatabase } = require('./database.config');
const { connectCloudinary } = require('./cloudinary.config');
const { jwtConfig } = require('./jwt.config');
const { emailConfig, validateEmailEnv } = require('./email.config');

module.exports = {
  appConfig,
  validateEnv,
  connectDatabase,
  disconnectDatabase,
  connectCloudinary,
  jwtConfig,
  emailConfig,
  validateEmailEnv,
};
