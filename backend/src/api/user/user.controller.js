const userService = require('./user.service');
const contactService = require('./contact.service');
const { toUserDTO, toUserPublicDTO, toUserSearchDTO } = require('./user.dto');
const {
  toContactDTO,
  toIncomingRequestDTO,
  toOutgoingRequestDTO,
  toRelationshipDTO,
} = require('./contact.dto');
const { ApiResponse } = require('../../core/response/api.response');
const { asyncHandler } = require('../../shared/utils/async-handler');
const { AppError } = require('../../core/errors/AppError');
const { parsePagination, buildPaginationMeta } = require('../../shared/utils/pagination');

// ─── Profile ─────────────────────────────────────────────────────────────────

const getMe = asyncHandler(async (req, res) => {
  const user = await userService.getProfile(req.user._id);
  return ApiResponse.success(res, toUserDTO(user));
});

const updateProfile = asyncHandler(async (req, res) => {
  const user = await userService.updateProfile(req.user._id, req.body);
  return ApiResponse.success(res, toUserDTO(user), 'Profile updated');
});

const updateUsername = asyncHandler(async (req, res) => {
  const user = await userService.updateUsername(req.user._id, req.body.username);
  return ApiResponse.success(res, toUserDTO(user), 'Username updated');
});

const updateSettings = asyncHandler(async (req, res) => {
  const user = await userService.updateSettings(req.user._id, req.body);
  return ApiResponse.success(res, toUserDTO(user), 'Settings updated');
});

const updateAvatar = asyncHandler(async (req, res) => {
  const file = req.files?.avatar;
  if (!file) {
    throw AppError.badRequest('No avatar file provided');
  }
  const user = await userService.updateAvatar(req.user._id, file);
  return ApiResponse.success(res, toUserDTO(user), 'Avatar updated');
});

// ─── Username check ───────────────────────────────────────────────────────────

/**
 * GET /users/check-username?username=xyz
 * Inline availability check used by the profile edit form (debounced on UI).
 * Returns { available: boolean, cooldownDaysLeft?: number }
 * Does NOT reveal whether the username belongs to the current user — the UI
 * handles the "that's already your username" case client-side.
 */
const checkUsername = asyncHandler(async (req, res) => {
  const { username } = req.query;
  if (!username || typeof username !== 'string' || username.trim().length < 2) {
    return ApiResponse.success(res, { available: false });
  }

  const existing = await userService.getUserByUsernameRaw(username.trim().toLowerCase());
  // If the username belongs to the current user it is still "available" to them
  const available = !existing || existing._id.toString() === req.user._id.toString();
  return ApiResponse.success(res, { available });
});

// ─── Lookup ───────────────────────────────────────────────────────────────────

/**
 * GET /users/:id
 * Look up a user by MongoDB ObjectId (e.g. from contact list, chat member list).
 */
const getUserById = asyncHandler(async (req, res) => {
  const user = await userService.getUserById(req.params.id);
  return ApiResponse.success(res, toUserPublicDTO(user));
});

/**
 * GET /users/by-username/:username
 * Public profile lookup by username. Enforces profileVisibility rules.
 */
const getByUsername = asyncHandler(async (req, res) => {
  const user = await userService.getByUsername(req.params.username, req.user._id);
  return ApiResponse.success(res, toUserPublicDTO(user));
});

/**
 * GET /users/search?q=...&page=1&limit=20
 * Paginated user search. Excludes self + blocked users.
 */
const searchUsers = asyncHandler(async (req, res) => {
  const { users, pagination } = await userService.searchUsers(
    req.query.q,
    req.user._id,
    req.query
  );
  return ApiResponse.success(res, {
    users: users.map(toUserSearchDTO),
    pagination,
  });
});

/**
 * GET /users/:userId/status
 * Online/offline status for a specific user. Reads presence adapter first.
 * Respects showOnlineStatus privacy setting.
 */
const getUserStatus = asyncHandler(async (req, res) => {
  const status = await userService.getUserStatus(req.params.userId, req.user._id);
  return ApiResponse.success(res, status);
});

// ─── Contacts ─────────────────────────────────────────────────────────────────

/**
 * POST /users/contacts/request
 * Body: { userId }
 * Send a contact request (or auto-accept if the other party already sent one).
 */
const sendRequest = asyncHandler(async (req, res) => {
  const contact = await contactService.sendRequest(req.user._id, req.body.userId);
  return ApiResponse.created(res, contact, 'Contact request sent');
});

/**
 * POST /users/contacts/accept
 * Body: { userId } — userId of the person who sent the request.
 */
const acceptRequest = asyncHandler(async (req, res) => {
  const contact = await contactService.acceptRequest(req.user._id, req.body.userId);
  return ApiResponse.success(res, contact, 'Contact request accepted');
});

/**
 * POST /users/contacts/reject
 * Body: { userId } — userId of the person who sent the request.
 */
const rejectRequest = asyncHandler(async (req, res) => {
  await contactService.rejectRequest(req.user._id, req.body.userId);
  return ApiResponse.noContent(res);
});

/**
 * DELETE /users/contacts/:userId
 * Remove an accepted contact. Either party can remove.
 */
const removeContact = asyncHandler(async (req, res) => {
  await contactService.removeContact(req.user._id, req.params.userId);
  return ApiResponse.noContent(res);
});

/**
 * GET /users/contacts
 * Paginated list of accepted contacts.
 * Query: page, limit
 */
const getContacts = asyncHandler(async (req, res) => {
  const { contacts, pagination } = await contactService.getContacts(
    req.user._id,
    req.query
  );
  return ApiResponse.success(res, {
    contacts: contacts.map(toContactDTO),
    pagination,
  });
});

/**
 * GET /users/contacts/pending
 * Incoming and outgoing pending contact requests.
 */
const getPendingRequests = asyncHandler(async (req, res) => {
  const { received, sent } = await contactService.getPendingRequests(req.user._id);
  return ApiResponse.success(res, {
    received: received.map(toIncomingRequestDTO),
    sent: sent.map(toOutgoingRequestDTO),
  });
});

/**
 * GET /users/contacts/relationship/:userId
 * Relationship status between the viewer and another user.
 * Used by the frontend to decide which action buttons to show.
 */
const getRelationship = asyncHandler(async (req, res) => {
  const relationship = await contactService.getRelationship(
    req.user._id,
    req.params.userId
  );
  return ApiResponse.success(res, toRelationshipDTO(relationship));
});

// ─── Block / Unblock ─────────────────────────────────────────────────────────

/**
 * POST /users/contacts/block
 * Body: { userId }
 * Block a user. Works from any relationship state.
 */
const blockUser = asyncHandler(async (req, res) => {
  await contactService.blockUser(req.user._id, req.body.userId);
  return ApiResponse.noContent(res);
});

/**
 * DELETE /users/contacts/block/:userId
 * Unblock a user. Only the person who blocked can unblock.
 */
const unblockUser = asyncHandler(async (req, res) => {
  await contactService.unblockUser(req.user._id, req.params.userId);
  return ApiResponse.noContent(res);
});

module.exports = {
  // Profile
  getMe,
  updateProfile,
  updateUsername,
  updateSettings,
  updateAvatar,
  // Lookup
  checkUsername,
  getUserById,
  getByUsername,
  searchUsers,
  getUserStatus,
  // Contacts
  sendRequest,
  acceptRequest,
  rejectRequest,
  removeContact,
  getContacts,
  getPendingRequests,
  getRelationship,
  blockUser,
  unblockUser,
};
