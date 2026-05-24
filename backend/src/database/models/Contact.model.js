const mongoose = require('mongoose');

/**
 * Contact — bidirectional relationship between two users.
 *
 * Architecture: one document per pair (not two). The `requester` field
 * records who initiated the relationship; `recipient` is who received it.
 * This makes it cheap to check the relationship status between any two users
 * (single findOne with $or), and avoids the dual-document consistency problem.
 *
 * State machine:
 *   (none)  → pending   [requester sends request]
 *   pending → accepted  [recipient accepts]
 *   pending → rejected  [recipient rejects — can be re-sent later]
 *   *       → blocked   [either party blocks — blockedBy records who]
 *   blocked → (removed) [blocker unblocks — document deleted]
 *   accepted→ (removed) [either removes contact — document deleted]
 *
 * Query patterns (covered by indexes):
 *   "my contacts"          → status=accepted, requester=me OR recipient=me
 *   "pending I received"   → status=pending, recipient=me
 *   "pending I sent"       → status=pending, requester=me
 *   "is X my contact?"     → findBetweenUsers(me, X) + check status=accepted
 *   "users I blocked"      → status=blocked, blockedBy=me
 *   "am I blocked by X?"   → status=blocked, blockedBy=X, (me is requester/recipient)
 */

const CONTACT_STATUS = Object.freeze({
  PENDING: 'pending',
  ACCEPTED: 'accepted',
  REJECTED: 'rejected',
  BLOCKED: 'blocked',
});

const contactSchema = new mongoose.Schema(
  {
    requester: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    recipient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    status: {
      type: String,
      enum: Object.values(CONTACT_STATUS),
      default: CONTACT_STATUS.PENDING,
      index: true,
    },
    /**
     * Only set when status = 'blocked'. Records which party initiated the block
     * so only that party can unblock. The other party can't override a block.
     */
    blockedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    requestedAt: {
      type: Date,
      default: Date.now,
    },
    respondedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

// Prevents duplicate requests in either direction
contactSchema.index({ requester: 1, recipient: 1 }, { unique: true });

// "Pending requests I received" — most common inbox query
contactSchema.index({ recipient: 1, status: 1 });

// "Requests I sent" — for sent-request list
contactSchema.index({ requester: 1, status: 1 });

const Contact = mongoose.model('Contact', contactSchema);

module.exports = { Contact, CONTACT_STATUS };
