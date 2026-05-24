const mongoose = require('mongoose');

const DB_OPTIONS = {
  serverSelectionTimeoutMS: 5000,
  socketTimeoutMS: 45000,
};

async function connectDatabase() {
  try {
    const conn = await mongoose.connect(process.env.DATABASE_URL, DB_OPTIONS);
    console.log(`[DB] Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error('[DB] Connection failed:', error.message);
    process.exit(1);
  }
}

function disconnectDatabase() {
  return mongoose.connection.close();
}

mongoose.connection.on('disconnected', () => {
  console.warn('[DB] Disconnected');
});

module.exports = { connectDatabase, disconnectDatabase };
