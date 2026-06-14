const mongoose = require('mongoose');

/**
 * CallLog — persistent record of a 1:1 call (WhatsApp-style history).
 *
 * ONE document per call, written once when the call reaches a terminal state
 * (answered+ended, declined, or never answered). The call.handler tracks live
 * timing in memory and persists here on END / REJECT / disconnect.
 *
 * Direction (incoming vs outgoing) is NOT stored — it's relative to whoever is
 * viewing the log. The service computes it per request from caller/callee.
 *
 * Status values:
 *   answered  — callee picked up; `duration` is the talk time in seconds
 *   declined  — callee actively rejected the call
 *   missed    — rang but was never answered (caller cancelled, timeout,
 *               callee offline/busy, or a mid-ring disconnect)
 */
const CALL_LOG_STATUS = Object.freeze({
  ANSWERED: 'answered',
  DECLINED: 'declined',
  MISSED:   'missed',
});

const CALL_LOG_TYPES = Object.freeze({
  AUDIO: 'audio',
  VIDEO: 'video',
});

const callLogSchema = new mongoose.Schema(
  {
    // The client-generated UUID for the call — unique so a double END can't
    // create duplicate rows (finalize is idempotent on this key).
    callId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    caller: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    callee: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    callType: {
      type: String,
      enum: Object.values(CALL_LOG_TYPES),
      required: true,
    },
    status: {
      type: String,
      enum: Object.values(CALL_LOG_STATUS),
      required: true,
    },
    // Direct chat this call belonged to — used to open the conversation from
    // the history list. Optional (a call can be placed without it).
    chatId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Chat',
      default: null,
    },
    startedAt: {
      type: Date,
      required: true,
    },
    answeredAt: {
      type: Date,
      default: null,
    },
    endedAt: {
      type: Date,
      default: null,
    },
    // Talk time in seconds (0 unless answered).
    duration: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
);

// History query: "all calls involving me, newest first" is served by these two
// single-field indexes (caller, callee) above plus the createdAt sort.
callLogSchema.index({ createdAt: -1 });

const CallLog = mongoose.model('CallLog', callLogSchema);

module.exports = { CallLog, CALL_LOG_STATUS, CALL_LOG_TYPES };
