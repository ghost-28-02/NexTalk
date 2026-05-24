const messageService = require('./message.service');
const { toMessageDTO } = require('./message.dto');
const { ApiResponse } = require('../../core/response/api.response');
const { asyncHandler } = require('../../shared/utils/async-handler');

const getMessages = asyncHandler(async (req, res) => {
  const { messages, hasMore, nextCursor } = await messageService.getChatMessages(
    req.user._id,
    req.params.chatId,
    req.query
  );
  return ApiResponse.success(res, {
    messages: messages.map(toMessageDTO),
    hasMore,
    nextCursor: nextCursor?.toString() ?? null,
  });
});

const sendMessage = asyncHandler(async (req, res) => {
  const { content, replyTo } = req.body;
  const message = await messageService.sendMessage(req.user._id, req.params.chatId, { content, replyTo });
  return ApiResponse.created(res, toMessageDTO(message));
});

const sendMediaMessage = asyncHandler(async (req, res) => {
  const file = req.files?.file;
  if (!file) {
    const { AppError } = require('../../core/errors/AppError');
    throw AppError.badRequest('No file provided');
  }
  const message = await messageService.sendMediaMessage(req.user._id, req.params.chatId, file);
  return ApiResponse.created(res, toMessageDTO(message));
});

const deleteMessage = asyncHandler(async (req, res) => {
  await messageService.deleteMessage(req.user._id, req.params.messageId);
  return ApiResponse.noContent(res);
});

const addReaction = asyncHandler(async (req, res) => {
  const { emoji } = req.body;
  if (!emoji) {
    const { AppError } = require('../../core/errors/AppError');
    throw AppError.badRequest('Emoji is required');
  }
  const message = await messageService.addReaction(req.user._id, req.params.messageId, emoji);
  return ApiResponse.success(res, toMessageDTO(message));
});

const removeReaction = asyncHandler(async (req, res) => {
  const message = await messageService.removeReaction(req.user._id, req.params.messageId);
  return ApiResponse.success(res, toMessageDTO(message));
});

const editMessage = asyncHandler(async (req, res) => {
  const { content } = req.body;
  if (!content?.trim()) {
    const { AppError } = require('../../core/errors/AppError');
    throw AppError.badRequest('Content is required');
  }
  const message = await messageService.editMessage(req.user._id, req.params.messageId, { content });
  return ApiResponse.success(res, toMessageDTO(message));
});

module.exports = { getMessages, sendMessage, sendMediaMessage, editMessage, deleteMessage, addReaction, removeReaction };
