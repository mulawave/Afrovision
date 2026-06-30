const crypto = require('crypto');
const { getFirestore } = require('../utils/firestore');

const COLLECTION = 'wave_comments';
const REACTIONS_COLLECTION = 'wave_comment_reactions';
const BANS_COLLECTION = 'wave_comment_bans';
const MAX_LENGTH = 500;

async function addComment(waveId, userId, displayName, avatarUrl, text, parentCommentId = null) {
  if (!text || !text.trim()) throw new Error('Comment text is required');
  // Sanitise: strip HTML tags, enforce length
  const clean = text.replace(/<[^>]*>/g, '').trim().slice(0, MAX_LENGTH);

  const db = getFirestore();
  const id = crypto.randomUUID();
  const comment = {
    id,
    wave_id: waveId,
    user_id: userId,
    display_name: displayName || 'Viewer',
    avatar_url: avatarUrl || null,
    text: clean,
    created_at: Date.now(),
    reply_count: 0,
    reaction_count: 0,
  };

  if (parentCommentId) {
    comment.parent_comment_id = parentCommentId;
  }

  await db.collection(COLLECTION).doc(id).set(comment);

  // Increment parent's reply_count if this is a reply
  if (parentCommentId) {
    const parentDoc = await db.collection(COLLECTION).doc(parentCommentId).get();
    if (parentDoc.exists) {
      const parentData = parentDoc.data();
      await db.collection(COLLECTION).doc(parentCommentId).update({
        reply_count: (parentData.reply_count || 0) + 1,
      });
    }
  }

  return comment;
}

async function getComments(waveId, limit = 50) {
  const db = getFirestore();
  const snapshot = await db.collection(COLLECTION)
    .where('wave_id', '==', waveId)
    .orderBy('created_at', 'asc')
    .limit(limit)
    .get();
  return snapshot.docs.map((doc) => ({ ...doc.data(), id: doc.id }));
}

async function getReplies(parentCommentId, limit = 50) {
  const db = getFirestore();
  const snapshot = await db.collection(COLLECTION)
    .where('parent_comment_id', '==', parentCommentId)
    .orderBy('created_at', 'asc')
    .limit(limit)
    .get();
  return snapshot.docs.map((doc) => ({ ...doc.data(), id: doc.id }));
}

async function findComment(commentId) {
  const db = getFirestore();
  const doc = await db.collection(COLLECTION).doc(commentId).get();
  if (!doc.exists) return null;
  return { ...doc.data(), id: doc.id };
}

async function deleteComment(commentId) {
  const db = getFirestore();
  const commentDoc = await db.collection(COLLECTION).doc(commentId).get();
  if (!commentDoc.exists) return;

  const commentData = commentDoc.data();
  const parentCommentId = commentData.parent_comment_id;

  // Delete any reactions for this comment
  const reactionsSnap = await db.collection(REACTIONS_COLLECTION)
    .where('comment_id', '==', commentId)
    .get();
  const batch = db.batch();
  reactionsSnap.docs.forEach((doc) => batch.delete(doc.ref));
  await batch.commit();

  // Decrement parent's reply_count if this was a reply
  if (parentCommentId) {
    const parentDoc = await db.collection(COLLECTION).doc(parentCommentId).get();
    if (parentDoc.exists) {
      const parentData = parentDoc.data();
      const newCount = Math.max(0, (parentData.reply_count || 0) - 1);
      await db.collection(COLLECTION).doc(parentCommentId).update({
        reply_count: newCount,
      });
    }
  }

  await db.collection(COLLECTION).doc(commentId).delete();
}

async function updateComment(commentId, text) {
  const MAX_LEN = 500;
  const clean = text.replace(/<[^>]*>/g, '').trim().slice(0, MAX_LEN);
  const db = getFirestore();
  await db.collection(COLLECTION).doc(commentId).update({ text: clean });
  const doc = await db.collection(COLLECTION).doc(commentId).get();
  return { ...doc.data(), id: doc.id };
}

async function toggleReaction(commentId, userId) {
  const db = getFirestore();
  const reactionId = `${commentId}_${userId}`;
  const reactionRef = db.collection(REACTIONS_COLLECTION).doc(reactionId);
  const reactionDoc = await reactionRef.get();

  if (reactionDoc.exists) {
    // Remove reaction
    await reactionRef.delete();
    const commentDoc = await db.collection(COLLECTION).doc(commentId).get();
    if (commentDoc.exists) {
      const currentCount = commentDoc.data().reaction_count || 0;
      await db.collection(COLLECTION).doc(commentId).update({
        reaction_count: Math.max(0, currentCount - 1),
      });
    }
    return { reacted: false };
  }

  // Add reaction
  await reactionRef.set({
    comment_id: commentId,
    user_id: userId,
    created_at: Date.now(),
  });
  const commentDoc = await db.collection(COLLECTION).doc(commentId).get();
  if (commentDoc.exists) {
    const currentCount = commentDoc.data().reaction_count || 0;
    await db.collection(COLLECTION).doc(commentId).update({
      reaction_count: currentCount + 1,
    });
  }
  return { reacted: true };
}

async function hasReacted(commentId, userId) {
  const db = getFirestore();
  const reactionId = `${commentId}_${userId}`;
  const doc = await db.collection(REACTIONS_COLLECTION).doc(reactionId).get();
  return doc.exists;
}

// ─── Commenter bans (per channel) ──────────────────────────────────────────
// A ban prevents a user from commenting on any wave of a given channel until
// the channel owner revokes it. Keyed by `${channelId}_${userId}`.

function banDocId(channelId, userId) {
  return `${channelId}_${userId}`;
}

async function banCommenter(channelId, userId, bannedBy) {
  const db = getFirestore();
  const id = banDocId(channelId, userId);
  await db.collection(BANS_COLLECTION).doc(id).set({
    channel_id: channelId,
    user_id: userId,
    banned_by: bannedBy || null,
    created_at: Date.now(),
  });
  return { channel_id: channelId, user_id: userId, banned: true };
}

async function unbanCommenter(channelId, userId) {
  const db = getFirestore();
  const id = banDocId(channelId, userId);
  await db.collection(BANS_COLLECTION).doc(id).delete();
  return { channel_id: channelId, user_id: userId, banned: false };
}

async function isCommenterBanned(channelId, userId) {
  if (!channelId || !userId) return false;
  const db = getFirestore();
  const doc = await db.collection(BANS_COLLECTION).doc(banDocId(channelId, userId)).get();
  return doc.exists;
}

/// Returns a Set of user ids banned from commenting on the given channel.
async function getBannedUserIds(channelId) {
  if (!channelId) return new Set();
  const db = getFirestore();
  const snapshot = await db.collection(BANS_COLLECTION)
    .where('channel_id', '==', channelId)
    .get();
  return new Set(snapshot.docs.map((doc) => doc.data().user_id));
}

module.exports = {
  addComment,
  getComments,
  getReplies,
  findComment,
  deleteComment,
  updateComment,
  toggleReaction,
  hasReacted,
  banCommenter,
  unbanCommenter,
  isCommenterBanned,
  getBannedUserIds,
};
