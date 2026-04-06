const ChatService = require('./chat.service');

async function getMessages(req, res) {
  try {
    const result = await ChatService.listMessages({
      uid: req.userId,
      channelId: req.params.channelId,
      limit: req.query.limit,
    });

    if (!result.ok) {
      return res.status(result.status).json({ error: result.error, code: result.code });
    }

    return res.json({ messages: result.messages });
  } catch (error) {
    console.error('[Chat] getMessages error:', error.message);
    return res.status(500).json({ error: 'Failed to load chat history' });
  }
}

module.exports = {
  getMessages,
};