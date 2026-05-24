/**
 * Contact routes — mounted at /api/v1/users/contacts
 *
 * All routes require authentication (protect middleware applied in user.routes.js
 * via router.use(protect) before this sub-router is mounted).
 *
 * Route map:
 *   GET    /                       — list accepted contacts (paginated)
 *   GET    /pending                — inbox + outbox pending requests
 *   GET    /relationship/:userId   — relationship status with another user
 *   POST   /request                — send a contact request
 *   POST   /accept                 — accept an incoming request
 *   POST   /reject                 — reject an incoming request
 *   DELETE /:userId                — remove an accepted contact
 *   POST   /block                  — block a user
 *   DELETE /block/:userId          — unblock a user
 */

const { Router } = require('express');
const controller = require('./user.controller');
const { validate } = require('../../core/middleware/validate.middleware');
const { contactRequestSchema, contactActionSchema } = require('./user.validation');

const router = Router();

// ─── Read ─────────────────────────────────────────────────────────────────────

router.get('/', controller.getContacts);
router.get('/pending', controller.getPendingRequests);
router.get('/relationship/:userId', controller.getRelationship);

// ─── Request lifecycle ────────────────────────────────────────────────────────

router.post('/request', validate(contactRequestSchema), controller.sendRequest);
router.post('/accept', validate(contactActionSchema), controller.acceptRequest);
router.post('/reject', validate(contactActionSchema), controller.rejectRequest);
router.delete('/:userId', controller.removeContact);

// ─── Block ────────────────────────────────────────────────────────────────────

router.post('/block', validate(contactActionSchema), controller.blockUser);
router.delete('/block/:userId', controller.unblockUser);

module.exports = router;
