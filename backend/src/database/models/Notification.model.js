const mongoose = require('mongoose');

/**
 * Notification type values.
 * Use the same names as the frontend constants/app.js NOTIFICATION_TYPES
 * so the API response can be used directly without client-side mapping.
 *
 *   message          — new chat message
 *   call             — missed call
 *   mention          — user was @mentioned in a group
 *   contact_request  — someone sent a contact request
 *   contact_accepted — your contact request was accepted
 *   group_invite     — invited to a group chat
 *   system           — platform-level notice
 */
const NOTIFICATION_TYPES = Object.freeze({
  MESSAGE:          'message',
  CALL:             'call',
  MENTION:          'mention',
  CONTACT_REQUEST:  'contact_request',
  CONTACT_ACCEPTED: 'contact_accepted',
  GROUP_INVITE:     'group_invite',
  SYSTEM:           'system',
});

const notificationSchema = new mongoose.Schema(
  {
    recipient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    type: {
      type: String,
      enum: Object.values(NOTIFICATION_TYPES),
      required: true,
    },
    title: {
      type: String,
      required: true,
    },
    body: {
      type: String,
    },
    data: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    isRead: {
      type: Boolean,
      default: false,
      index: true,
    },
    readAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

notificationSchema.index({ recipient: 1, isRead: 1, createdAt: -1 });

const Notification = mongoose.model('Notification', notificationSchema);

module.exports = { Notification, NOTIFICATION_TYPES };
