const { Router } = require('express');
const { authenticateToken, optionalAuth } = require('../utils/jwt');
const ctrl = require('./comic.comment.controller');

const router = Router();

// ─── Comments ────────────────────────────────────────────────────────────────
router.get('/:issueId/comments', optionalAuth, ctrl.getComments);
router.post('/:issueId/comments', authenticateToken, ctrl.postComment);
router.patch('/:issueId/comments/:commentId', authenticateToken, ctrl.editComment);
router.delete('/:issueId/comments/:commentId', authenticateToken, ctrl.deleteComment);
router.post('/:issueId/comments/:commentId/reaction', authenticateToken, ctrl.toggleCommentReaction);

module.exports = router;
