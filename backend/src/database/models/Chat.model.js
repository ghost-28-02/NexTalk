const mongoose = require('mongoose');

const CHAT_TYPES = Object.freeze({
  DIRECT: 'direct',
  GROUP: 'group',
});

const chatSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: Object.values(CHAT_TYPES),
      default: CHAT_TYPES.DIRECT,
    },
    members: [
      {
        user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
        role: { type: String, enum: ['member', 'admin'], default: 'member' },
        joinedAt: { type: Date, default: Date.now },
        lastReadAt: { type: Date, default: null },
        /**
         * Per-member preferences — each user can pin/mute a chat independently.
         * unreadCount is maintained as an incremental counter (incremented on
         * new message for all members except sender, reset to 0 on markRead).
         * This avoids an expensive COUNT query on every chat list fetch.
         */
        isPinned:    { type: Boolean, default: false },
        isMuted:     { type: Boolean, default: false },
        unreadCount: { type: Number,  default: 0, min: 0 },
      },
    ],
    name: {
      type: String,
      trim: true,
      maxlength: 100,
    },
    avatar: {
      url: String,
      publicId: String,
    },
    description: {
      type: String,
      maxlength: 300,
    },
    lastMessage: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Message',
      default: null,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

chatSchema.index({ 'members.user': 1 });
chatSchema.index({ updatedAt: -1 });

const Chat = mongoose.model('Chat', chatSchema);

module.exports = { Chat, CHAT_TYPES };
