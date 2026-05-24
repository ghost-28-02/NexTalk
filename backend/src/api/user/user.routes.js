/**
 * User routes — mounted at /api/v1/users
 *
 * Route map:
 *   GET    /me                       — own full profile
 *   PATCH  /me                       — update profile (displayName, bio, profileVisibility, socialLinks)
 *   PATCH  /me/username              — update username (3-day cooldown)
 *   PATCH  /me/settings              — update notification + privacy settings
 *   PATCH  /me/avatar                — upload / replace avatar
 *   GET    /search?q=&page=&limit=   — paginated user search
 *   GET    /by-username/:username    — public profile by username
 *   GET    /:userId/status           — online/offline status (respects privacy settings)
 *   GET    /:id                      — public profile by MongoDB id
 *
 *   /contacts/*                      → contact.routes.js (sub-router)
 */

const { Router } = require('express');
const controller = require('./user.controller');
const contactRoutes = require('./contact.routes');
const { protect } = require('../../core/middleware/auth.middleware');
const { validate } = require('../../core/middleware/validate.middleware');
const {
  updateProfileSchema,
  updateUsernameSchema,
  updateSettingsSchema,
} = require('./user.validation');

const router = Router();

// All user routes require authentication
router.use(protect);

// ─── Own profile ──────────────────────────────────────────────────────────────

router.get('/me', controller.getMe);
router.patch('/me', validate(updateProfileSchema), controller.updateProfile);
router.patch('/me/username', validate(updateUsernameSchema), controller.updateUsername);
router.patch('/me/settings', validate(updateSettingsSchema), controller.updateSettings);
router.patch('/me/avatar', controller.updateAvatar);

// ─── Discovery ────────────────────────────────────────────────────────────────

// Specific named paths BEFORE /:id to avoid param catch-all conflicts
router.get('/search',              controller.searchUsers);
router.get('/check-username',      controller.checkUsername);
router.get('/by-username/:username', controller.getByUsername);

// ─── Contacts sub-router ─────────────────────────────────────────────────────
// Mounted before /:id so /contacts/* doesn't get swallowed by the param route

router.use('/contacts', contactRoutes);

// ─── Other users ─────────────────────────────────────────────────────────────

router.get('/:userId/status', controller.getUserStatus);
router.get('/:id', controller.getUserById);

module.exports = router;
