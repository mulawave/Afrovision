const ComicComment = require('./comic.comment.model');
const User = require('../users/user.model');

// ─── GET /comic/:issueId/comments ───────────────────────────────────────────
async function getComments(req, res) {
  try {
    const comments = await ComicComment.getComments(req.params.issueId);

    // Enrich with viewer's reaction status if authenticated
    const enriched = await Promise.all(
      comments.map(async (c) => {
        let viewerHasReacted = false;
        if (req.userId) {
          viewerHasReacted = await ComicComment.hasReacted(c.id, req.userId);
        }
        return {
          ...c,
          viewer_has_reacted: viewerHasReacted,
          viewer_is_author: req.userId && c.user_id === req.userId,
        };
      })
    );

    res.json(enriched);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// ─── POST /comic/:issueId/comments ──────────────────────────────────────────
async function postComment(req, res) {
  try {
    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const { text, parent_comment_id: parentCommentId } = req.body;
    if (!text || !text.trim()) return res.status(400).json({ error: 'text is required' });

    // Validate parent comment exists if this is a reply
    if (parentCommentId) {
      const parent = await ComicComment.findComment(parentCommentId);
      if (!parent || parent.issue_id !== req.params.issueId) {
        return res.status(400).json({ error: 'Invalid parent comment' });
      }
    }

    const comment = await ComicComment.addComment(
      req.params.issueId,
      req.userId,
      user.name || 'Viewer',
      user.avatar_url || null,
      text,
      parentCommentId || null
    );

    res.status(201).json(comment);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// ─── PATCH /comic/:issueId/comments/:commentId ──────────────────────────────
async function editComment(req, res) {
  try {
    const comment = await ComicComment.findComment(req.params.commentId);
    if (!comment) return res.status(404).json({ error: 'Comment not found' });

    // Only the author or an admin can edit
    if (comment.user_id !== req.userId && req.userRole !== 'admin') {
      return res.status(403).json({ error: 'Not authorized to edit this comment' });
    }

    const { text } = req.body;
    if (!text || !text.trim()) return res.status(400).json({ error: 'text is required' });

    const updated = await ComicComment.updateComment(comment.id, text);
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// ─── DELETE /comic/:issueId/comments/:commentId ─────────────────────────────
async function deleteComment(req, res) {
  try {
    const comment = await ComicComment.findComment(req.params.commentId);
    if (!comment) return res.status(404).json({ error: 'Comment not found' });

    // Only the author or an admin can delete
    if (comment.user_id !== req.userId && req.userRole !== 'admin') {
      return res.status(403).json({ error: 'Not authorized to delete this comment' });
    }

    await ComicComment.deleteComment(comment.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// ─── POST /comic/:issueId/comments/:commentId/reaction ──────────────────────
async function toggleCommentReaction(req, res) {
  try {
    const comment = await ComicComment.findComment(req.params.commentId);
    if (!comment) return res.status(404).json({ error: 'Comment not found' });
    const result = await ComicComment.toggleReaction(comment.id, req.userId);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

module.exports = {
  getComments,
  postComment,
  editComment,
  deleteComment,
  toggleCommentReaction,
};
