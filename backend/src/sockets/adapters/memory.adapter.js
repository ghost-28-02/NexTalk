/**
 * MemoryAdapter — in-process presence and room tracking.
 *
 * This is the ACTIVE adapter for single-server deployments.
 * All state lives in Maps in this process — zero external dependencies.
 *
 * FUTURE [Redis adapter swap]:
 *   Replace this file's usage in socket.manager.js with redis.adapter.js.
 *   The interface contract (same method names and signatures) is identical,
 *   so socket handlers need zero changes — only the adapter import changes.
 *
 * Interface contract:
 *   addUserSocket(userId, socketId)
 *   removeUserSocket(userId, socketId) → boolean (true = user fully offline)
 *   getUserSockets(userId) → string[]
 *   isUserOnline(userId) → boolean
 *   getOnlineUsers() → string[]
 *   setUserData(userId, data)
 *   getUserData(userId) → object | null
 */

// userId → Set<socketId>  (one user can have multiple tabs/devices)
const userSockets = new Map();

// userId → { status, lastSeenAt, ... }
const userData = new Map();

function addUserSocket(userId, socketId) {
  const uid = userId.toString();
  if (!userSockets.has(uid)) userSockets.set(uid, new Set());
  userSockets.get(uid).add(socketId);
}

function removeUserSocket(userId, socketId) {
  const uid = userId.toString();
  const sockets = userSockets.get(uid);
  if (!sockets) return true;

  sockets.delete(socketId);

  if (sockets.size === 0) {
    userSockets.delete(uid);
    userData.delete(uid);
    return true; // user is now fully offline
  }
  return false;
}

function getUserSockets(userId) {
  return [...(userSockets.get(userId.toString()) || [])];
}

function isUserOnline(userId) {
  const sockets = userSockets.get(userId.toString());
  return !!(sockets && sockets.size > 0);
}

function getOnlineUsers() {
  return [...userSockets.keys()];
}

function setUserData(userId, data) {
  userData.set(userId.toString(), { ...getUserData(userId), ...data });
}

function getUserData(userId) {
  return userData.get(userId.toString()) || null;
}

module.exports = {
  addUserSocket,
  removeUserSocket,
  getUserSockets,
  isUserOnline,
  getOnlineUsers,
  setUserData,
  getUserData,
};
