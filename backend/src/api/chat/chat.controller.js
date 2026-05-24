const chatService = require('./chat.service');
const { toChatDTO } = require('./chat.dto');
const { ApiResponse } = require('../../core/response/api.response');
const { asyncHandler } = require('../../shared/utils/async-handler');

const getMyChats = asyncHandler(async (req, res) => {
  const { chats, pagination } = await chatService.getUserChats(req.user._id, req.query);
  return ApiResponse.paginated(res, chats.map((c) => toChatDTO(c, req.user._id)), pagination);
});

const getChatById = asyncHandler(async (req, res) => {
  const chat = await chatService.getChatById(req.params.id, req.user._id);
  return ApiResponse.success(res, toChatDTO(chat, req.user._id));
});

const getOrCreateDirect = asyncHandler(async (req, res) => {
  const { userId } = req.body;
  const { chat, isNew } = await chatService.getOrCreateDirectChat(req.user._id, userId);
  return isNew
    ? ApiResponse.created(res, toChatDTO(chat, req.user._id))
    : ApiResponse.success(res, toChatDTO(chat, req.user._id));
});

const createGroup = asyncHandler(async (req, res) => {
  const { name, memberIds, description } = req.body;
  const chat = await chatService.createGroupChat(req.user._id, { name, memberIds, description });
  return ApiResponse.created(res, toChatDTO(chat, req.user._id), 'Group created');
});

const markRead = asyncHandler(async (req, res) => {
  await chatService.markRead(req.params.id, req.user._id);
  return ApiResponse.noContent(res);
});

const leaveChat = asyncHandler(async (req, res) => {
  await chatService.leaveChat(req.params.id, req.user._id);
  return ApiResponse.success(res, null, 'Left the chat');
});

module.exports = { getMyChats, getChatById, getOrCreateDirect, createGroup, markRead, leaveChat };
