/**
 * Message DTO — shapes message documents for API and socket responses.
 *
 * senderId:
 *   Frontend mock uses `senderId` (plain string ID) for conditional rendering
 *   (e.g., "did I send this message?"). Backend additionally returns the full
 *   `sender` object for rich display (avatar, name). Both are included.
 *
 * avatar:
 *   Normalized to a URL string — no {url, publicId} object in the response.
 */

function toMessageDTO(message) {
  const sender = message.sender;

  // Resolve senderId whether sender is populated (object) or just an ObjectId
  const senderId = sender?._id?.toString() ?? sender?.toString() ?? null;

  return {
    id:       message._id,
    chat:     message.chat,
    senderId,                           // plain string — matches mock message.senderId
    sender: sender?._id               // populated sender object (rich display)
      ? {
          id:          sender._id,
          username:    sender.username,
          name:        sender.displayName || sender.username,
          displayName: sender.displayName,
          avatar:      sender.avatar?.url ?? sender.avatar ?? null,
        }
      : null,
    type:      message.type,
    content:   message.isDeleted ? null : message.content,
    media:     message.isDeleted ? null : (message.media || null),
    replyTo:   message.replyTo  || null,
    reactions: message.reactions || [],
    status:    message.status,
    isDeleted: message.isDeleted,
    createdAt: message.createdAt,
    updatedAt: message.updatedAt,
  };
}

module.exports = { toMessageDTO };
