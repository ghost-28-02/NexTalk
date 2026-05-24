/**
 * RedisAdapter — PLACEHOLDER for multi-instance horizontal scaling.
 *
 * STATUS: Not implemented. All methods throw until Redis is wired.
 *
 * HOW TO ACTIVATE (future):
 *   1. npm install ioredis @socket.io/redis-adapter
 *   2. Create src/config/redis.config.js with pub/sub client setup
 *   3. In socket.manager.js, call:
 *        const { createAdapter } = require('@socket.io/redis-adapter');
 *        io.adapter(createAdapter(pubClient, subClient));
 *   4. Replace memory.adapter.js import in socket.manager.js with this file.
 *   5. Implement each method below using Redis HSET/SMEMBERS/SREM/etc.
 *
 * Key design: use Redis SETS per user for socket IDs, HASH for metadata.
 *   SADD   user:sockets:{userId} {socketId}
 *   SREM   user:sockets:{userId} {socketId}
 *   SMEMBERS user:sockets:{userId}
 *   HSET   user:data:{userId} field value
 *
 * All keys should have a TTL (e.g., 24h) as a safety net against orphaned entries.
 *
 * Interface contract: identical to memory.adapter.js — all method names and
 * signatures match so socket handlers need zero changes on the swap.
 */

function notImplemented(method) {
  throw new Error(`RedisAdapter.${method} is not implemented yet. Use memory.adapter.js for now.`);
}

function addUserSocket(userId, socketId) { notImplemented('addUserSocket'); }
function removeUserSocket(userId, socketId) { notImplemented('removeUserSocket'); }
function getUserSockets(userId) { notImplemented('getUserSockets'); }
function isUserOnline(userId) { notImplemented('isUserOnline'); }
function getOnlineUsers() { notImplemented('getOnlineUsers'); }
function setUserData(userId, data) { notImplemented('setUserData'); }
function getUserData(userId) { notImplemented('getUserData'); }

module.exports = {
  addUserSocket,
  removeUserSocket,
  getUserSockets,
  isUserOnline,
  getOnlineUsers,
  setUserData,
  getUserData,
};
