"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { useAuth } from "@/lib/AuthContext";
import {
  editComicCommentApi,
  deleteComicCommentApi,
} from "@/lib/api";

// ─── localStorage persistence for comic comments ──────────────────────────────
// Comments are keyed per issue so issue #1's comments never mix with issue #2's.

function comicStorageKey(issueId: number): string {
  return `afrovision_comic_comments_${issueId}`;
}

function loadStoredComments(issueId: number): Comment[] | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(comicStorageKey(issueId));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
} 

function saveStoredComments(issueId: number, comments: Comment[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(comicStorageKey(issueId), JSON.stringify(comments));
  } catch {
    // Ignore quota errors etc.
  }
}

interface ComicPage {
  src: string;
  alt: string;
}

interface ComicIssue {
  id: number;
  title: string;
  subtitle: string;
  releaseDate: string;
  coverImage: string;
  description: string;
  synopsis: string;
  cover: string;
  pages: ComicPage[];
  back: string;
  pdf: string;
  credits: string[];
}

interface Comment {
  id: string;
  issueId: number;
  user: string;
  avatar: string;
  avatarUrl: string | null;
  content: string;
  createdAt: string;
  likes: number;
  likedByUser: boolean;
  replies: Reply[];
  isEdited?: boolean;
  user_id?: string;
  parentCommentId?: string;
  updatedAt?: number;
}

interface Reply {
  id: string;
  commentId: string;
  user: string;
  avatar: string;
  avatarUrl: string | null;
  content: string;
  createdAt: string;
  likes: number;
  likedByUser: boolean;
}

// --- ADD NEW ISSUES AT THE TOP. Top = newest = Current Issue ---
// Only Regular edition is exposed here. Extended/Collector stay offline.

const COMIC_ISSUES: ComicIssue[] = [
/**{
    id: 2,
    title: "AIONIS - THE AWAKENING",
    subtitle: "Issue #2: The Awakening",
    releaseDate: "November 2026",
    coverImage: "https://storage.googleapis.com/afrovision-media/comics/aionis-issue-02/regular/cover.png",
    description: "The void screams back. Aionis speaks for the first time — and something else listens.",
    synopsis: "After asking WHAT AM I?, Aionis learns to shape the void. But creation has a cost.",
    cover: "https://storage.googleapis.com/afrovision-media/comics/aionis-issue-02/regular/cover.png",
    pages: [
      { src: "https://storage.googleapis.com/afrovision-media/comics/aionis-issue-02/regular/page-01.png", alt: "Page 01" },
      { src: "https://storage.googleapis.com/afrovision-media/comics/aionis-issue-02/regular/page-02.png", alt: "Page 02" },
      { src: "https://storage.googleapis.com/afrovision-media/comics/aionis-issue-02/regular/page-03.png", alt: "Page 03" },
      { src: "https://storage.googleapis.com/afrovision-media/comics/aionis-issue-02/regular/page-04.png", alt: "Page 04" },
      { src: "https://storage.googleapis.com/afrovision-media/comics/aionis-issue-02/regular/page-05.png", alt: "Page 05" },
      { src: "https://storage.googleapis.com/afrovision-media/comics/aionis-issue-02/regular/page-06.png", alt: "Page 06" },
    ],
    back: "https://storage.googleapis.com/afrovision-media/comics/aionis-issue-02/regular/back.png",
    pdf: "https://storage.googleapis.com/afrovision-media/comics/aionis-issue-02/regular/Aionis-Issue-02-Regular.pdf",
    credits: [
      "Created by Richard Obroh Jr",
      "Art By Richard Obroh",
      "Contributing Artist: Vistoria Kanma Richard",
      "Story By Richard Obroh",
      "Composition By Meta AI",
      "Created For Afrovision Digital Tv",
      "Based on the Legend of AIONIS Cinematic Universe - Created By Richard Obroh Jr",
    ],
  }, **/
  {
    id: 1,
    title: "AIONIS - THE ORIGIN",
    subtitle: "Issue #1: The Origin",
    releaseDate: "July 2026",
    coverImage: "https://storage.googleapis.com/afrovision-media/comics/aionis-issue-01/regular/cover.png",
    description: "In the beginning, there was nothing—no matter, no light, no time. Only an infinite void.",
    synopsis: "Until a pull erupted. Until light refused to die. The first question was asked: WHAT AM I? And so AIONIS was born.",
    cover: "https://storage.googleapis.com/afrovision-media/comics/aionis-issue-01/regular/cover.png",
    pages: [
      { src: "https://storage.googleapis.com/afrovision-media/comics/aionis-issue-01/regular/page-01.png", alt: "Page 01 - The Empty" },
      { src: "https://storage.googleapis.com/afrovision-media/comics/aionis-issue-01/regular/page-02.png", alt: "Page 02 - The Void" },
      { src: "https://storage.googleapis.com/afrovision-media/comics/aionis-issue-01/regular/page-03.png", alt: "Page 03 - The Pull" },
      { src: "https://storage.googleapis.com/afrovision-media/comics/aionis-issue-01/regular/page-04.png", alt: "Page 04 - Awareness" },
      { src: "https://storage.googleapis.com/afrovision-media/comics/aionis-issue-01/regular/page-05.png", alt: "Page 05 - Sentience" },
      { src: "https://storage.googleapis.com/afrovision-media/comics/aionis-issue-01/regular/page-06.png", alt: "Page 06 - Dual Nature" },
      { src: "https://storage.googleapis.com/afrovision-media/comics/aionis-issue-01/regular/page-07.png", alt: "Page 07 - WHAT AM I?" },
    ],
    back: "https://storage.googleapis.com/afrovision-media/comics/aionis-issue-01/regular/back.png",
    pdf: "https://storage.googleapis.com/afrovision-media/comics/aionis-issue-01/regular/Aionis-Issue-01-Regular.pdf",
    credits: [
      "Created by Richard Obroh Jr",
      "Art By Richard Obroh",
      "Contributing Artist: Vistoria Kanma Richard",
      "Story By Richard Obroh",
      "Composition By Meta AI",
      "Created For Afrovision Digital Tv",
      "Based on the Legend of AIONIS Cinematic Universe - Created By Richard Obroh",
    ],
  },
];

export default function ComicPage() {
  const [activeTab, setActiveTab] = useState<"current" | "all">("current");
  const [isReading, setIsReading] = useState(false);
  const [selectedIssueId, setSelectedIssueId] = useState<number>(COMIC_ISSUES[0].id);
  const currentIssue = COMIC_ISSUES[0];
  const [currentPage, setCurrentPage] = useState(0);
  const [zoom, setZoom] = useState(1);
  const readerRef = useRef<HTMLDivElement>(null);
  const touchStartX = useRef<number | null>(null);

  // --- Comment system: per-issue isolation ---
  // commentsByIssue maps issueId -> its own array of comments.
  // Issue #1's comments never mix with issue #2's comments.
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const [commentsByIssue, setCommentsByIssue] = useState<Record<number, Comment[]>>({});
  const [commentInput, setCommentInput] = useState("");

  const generateId = useCallback(() => `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`, []);

  // Load persisted comments for the current issue, falling back to demo seed data.
  // commentsByIssue is intentionally NOT a dependency here to avoid an infinite
  // render loop: setCommentsByIssue creates a new object reference each call,
  // which would re-trigger this effect forever when localStorage has data.
  useEffect(() => {
    const stored = loadStoredComments(currentIssue.id);
    if (stored) {
      setCommentsByIssue((prev) => ({ ...prev, [currentIssue.id]: stored }));
      return;
    }
    setCommentsByIssue((prev) => {
      if (prev[currentIssue.id]) return prev;
      return {
        ...prev,
        [currentIssue.id]: [
          {
            id: generateId(),
            issueId: currentIssue.id,
            user: "Alex Rivera",
            avatar: "AR",
            avatarUrl: null,
            content: "This origin story is incredible. The way Aionis questions existence really hit deep.",
            createdAt: "2 hours ago",
            likes: 12,
            likedByUser: false,
            replies: [
              {
                id: generateId(),
                commentId: "",
                user: "Samira K.",
                avatar: "SK",
                avatarUrl: null,
                content: "Absolutely! The art on page 7 is stunning.",
                createdAt: "1 hour ago",
                likes: 5,
                likedByUser: false,
              },
            ],
          },
          {
            id: generateId(),
            issueId: currentIssue.id,
            user: "Jordan Miles",
            avatar: "JM",
            avatarUrl: null,
            content: "Can't wait for issue #2. The ending left me with so many questions.",
            createdAt: "5 hours ago",
            likes: 8,
            likedByUser: true,
            replies: [],
          },
        ],
      };
    });
  }, [currentIssue.id, generateId]);

  const addComment = useCallback(() => {
    if (!commentInput.trim()) return;
    if (!user) return;
    const newComment: Comment = {
      id: generateId(),
      issueId: currentIssue.id,
      user: user.name || user.email,
      avatar: (user.name || user.email).split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2),
      avatarUrl: user.avatar_url || null,
      content: commentInput.trim(),
      createdAt: "Just now",
      likes: 0,
      likedByUser: false,
      replies: [],
      user_id: user.id,
    };

    setCommentsByIssue((prev) => ({
      ...prev,
      [currentIssue.id]: [newComment, ...(prev[currentIssue.id] || [])],
    }));
    saveStoredComments(currentIssue.id, [
      newComment,
      ...((commentsByIssue[currentIssue.id] || []) as Comment[]),
    ]);
    setCommentInput("");
  }, [commentInput, user, generateId, currentIssue.id, commentsByIssue]);

  const toggleCommentLike = useCallback((commentId: string) => {
    setCommentsByIssue((prev) => {
      const current = prev[currentIssue.id] || [];
      const updated = current.map((c) => {
        if (c.id !== commentId) return c;
        return {
          ...c,
          likedByUser: !c.likedByUser,
          likes: c.likedByUser ? c.likes - 1 : c.likes + 1,
        };
      });
      saveStoredComments(currentIssue.id, updated);
      return { ...prev, [currentIssue.id]: updated };
    });
  }, [currentIssue.id]);

  const toggleReplyLike = useCallback((commentId: string, replyId: string) => {
    setCommentsByIssue((prev) => {
      const current = prev[currentIssue.id] || [];
      const updated = current.map((c) => {
        if (c.id !== commentId) return c;
        return {
          ...c,
          replies: c.replies.map((r) => {
            if (r.id !== replyId) return r;
            return {
              ...r,
              likedByUser: !r.likedByUser,
              likes: r.likedByUser ? r.likes - 1 : r.likes + 1,
            };
          }),
        };
      });
      saveStoredComments(currentIssue.id, updated);
      return { ...prev, [currentIssue.id]: updated };
    });
  }, [currentIssue.id]);

  const activeIssue = COMIC_ISSUES.find((i) => i.id === selectedIssueId) || COMIC_ISSUES[0];

  const allReaderPages = [
    { src: activeIssue.cover, alt: "Cover" },
    ...activeIssue.pages,
    { src: activeIssue.back, alt: "Back Cover" },
  ];

  const openReader = (issueId: number) => {
    setSelectedIssueId(issueId);
    setCurrentPage(0);
    setZoom(1);
    setIsReading(true);
  };

  const goNext = useCallback(() => {
    setCurrentPage((p) => Math.min(p + 1, allReaderPages.length - 1));
    setZoom(1);
  }, [allReaderPages.length]);

  const goPrev = useCallback(() => {
    setCurrentPage((p) => Math.max(p - 1, 0));
    setZoom(1);
  }, []);

  useEffect(() => {
    if (!isReading) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") goNext();
      if (e.key === "ArrowLeft") goPrev();
      if (e.key === "Escape") setIsReading(false);
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [isReading, goNext, goPrev]);

  function ReplyItem({ reply, onLike }: { reply: Reply; onLike: () => void }) {
    return (
      <div className="bg-zinc-900/30 border border-zinc-800/50 rounded-lg p-3 mb-2">
        <div className="flex gap-2">
          <div className="w-6 h-6 rounded-full overflow-hidden shrink-0">
            {reply.avatarUrl ? (
              <img src={reply.avatarUrl} alt={reply.user} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-zinc-700 flex items-center justify-center text-[10px] font-bold text-white">
                {reply.avatar}
              </div>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1 mb-1">
              <span className="text-xs font-semibold text-white">{reply.user}</span>
              <span className="text-[10px] text-gray-500">{reply.createdAt}</span>
            </div>
            <p className="text-sm text-gray-300 leading-relaxed mb-2">{reply.content}</p>
            <div className="flex items-center gap-3 text-[11px]">
              <button
                onClick={onLike}
                className={`flex items-center gap-1 ${reply.likedByUser ? "text-blue-400" : "text-gray-500 hover:text-white"}`}
              >
                <span className={reply.likedByUser ? "text-blue-400" : "text-gray-400"}>👍</span>
                <span className={reply.likedByUser ? "text-blue-400 font-medium" : "text-gray-500"}>{reply.likes}</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  function CommentItem({
    comment,
    onLike,
    onAddReply,
  }: {
    comment: Comment;
    onLike: () => void;
    onAddReply: (text: string) => void;
  }) {
    const [showReplyForm, setShowReplyForm] = useState(false);
    const [replyText, setReplyText] = useState("");
    const { user } = useAuth();
    const canEdit = user?.id === comment.user_id || user?.role === "admin";
    const canDelete = user?.id === comment.user_id || user?.role === "admin";
    const [isEditing, setIsEditing] = useState(false);
    const [editText, setEditText] = useState(comment.content);
    const [deletePending, setDeletePending] = useState(false);
    // Save edited comment via API
    const saveEdit = async (newText: string) => {
      if (!newText.trim()) return;
      setIsEditing(false);
      setDeletePending(false);
      const res = await editComicCommentApi(comment.issueId, comment.id, newText);
      if (res.ok) {
        setCommentsByIssue((prev) => {
          const current = prev[currentIssue.id] || [];
          const updated = current.map((c) => {
            if (c.id !== comment.id) return c;
            return { ...c, content: newText, isEdited: true, updatedAt: Date.now() };
          });
          saveStoredComments(currentIssue.id, updated);
          return { ...prev, [currentIssue.id]: updated };
        });
      }
    };

    // Delete comment via API
    const deleteCommentApi = async () => {
      setDeletePending(true);
      const res = await deleteComicCommentApi(comment.issueId, comment.id);
      if (res.ok) {
        setCommentsByIssue((prev) => {
          const current = prev[currentIssue.id] || [];
          const updated = current.filter((c) => c.id !== comment.id);
          saveStoredComments(currentIssue.id, updated);
          return { ...prev, [currentIssue.id]: updated };
        });
      }
      setDeletePending(false);
    };


    return (
      <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4 mb-4 hover:border-zinc-700 transition-all">
        <div className="flex gap-3">
          <div className="w-8 h-8 rounded-full overflow-hidden shrink-0">
            {comment.avatarUrl ? (
              <img src={comment.avatarUrl} alt={comment.user} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-blue-600 flex items-center justify-center text-xs font-bold text-white">
                {comment.avatar}
              </div>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-sm font-semibold text-white">{comment.user}</span>
              <span className="text-xs text-gray-500">{comment.createdAt}</span>
            </div>
            <p className="text-sm text-gray-300 leading-relaxed mb-3">{comment.content}</p>
            <div className="flex items-center gap-4 text-xs">
              <button
                onClick={onLike}
                className={`flex items-center gap-1 px-2 py-1 rounded-md transition-all ${
                  comment.likedByUser
                    ? "bg-blue-600/20 text-blue-400 border border-blue-600/30"
                    : "text-gray-500 hover:text-white hover:bg-zinc-800"
                }`}
              >
                <span className={comment.likedByUser ? "text-blue-400" : "text-gray-400"}>
                  👍
                </span>
                <span className={comment.likedByUser ? "text-blue-400 font-medium" : "text-gray-500"}>
                  {comment.likes}
                </span>
              </button>
              <button
                onClick={() => setShowReplyForm(!showReplyForm)}
                className="text-gray-400 hover:text-white hover:underline transition"
              >
                Reply
              </button>
              {canEdit && (
                <button
                  onClick={() => setIsEditing(true)}
                  className="text-gray-400 hover:text-white hover:underline transition"
                >
                  Edit
                </button>
              )}
              {canDelete && (
                <button
                  onClick={deleteCommentApi} disabled={deletePending}
                  className="text-red-400 hover:text-white hover:underline transition"
                >
                  Delete
                </button>
              )}
            </div>
          </div>
        </div>

        {showReplyForm && (
          <div className="mt-4 pl-12 space-y-2">
            <div className="flex gap-2">
              <input
                type="text"
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                className="flex-1 bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
                placeholder="Write a reply..."
              />
              <button
                onClick={() => {
                  if (!replyText.trim()) return;
                  onAddReply(replyText.trim());
                  setReplyText("");
                  setShowReplyForm(false);
                }}
                className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-sm text-white rounded-lg transition-all"
              >
                Post
              </button>
            </div>
          </div>
        )}
        {isEditing && (
          <div className="mt-4 pl-12 space-y-2">
            <div className="flex gap-2">
              <textarea
                value={editText}
                onChange={(e) => setEditText(e.target.value)}
                className="flex-1 bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 resize-none min-h-20"
                rows={3}
                placeholder="Edit comment..."
              />
              <button
                onClick={() => saveEdit(editText)}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={!editText.trim() || deletePending}
              >
                Save
              </button>
              <button
                onClick={() => setIsEditing(false)}
                className="ml-2 px-3 py-2 bg-zinc-800 hover:bg-zinc-700 text-sm text-white rounded-lg transition-all"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {deletePending && (
          <div className="mt-4 pl-12 text-red-400 text-sm"> deleting…</div>
        )}

        <div className="mt-4 pl-12 space-y-1">
          {comment.replies.map((reply) => (
            <ReplyItem
              key={reply.id}
              reply={reply}
              onLike={() => toggleReplyLike(comment.id, reply.id)}
            />
          ))}
        </div>
      </div>
    );
  }

  function CommentSection() {
    const issueComments = commentsByIssue[currentIssue.id] || [];
    const displayName = user?.name || user?.email || "You";
    const userAvatar = (user?.name || user?.email || "").split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);

    if (authLoading) {
      return (
        <section className="mt-12 bg-zinc-900/60 border border-zinc-800 rounded-2xl p-6 md:p-8 shadow-xl">
          <p className="text-gray-400 text-sm text-center py-8">Loading...</p>
        </section>
      );
    }

    if (!isAuthenticated) {
      return (
        <section className="mt-12 bg-zinc-900/60 border border-zinc-800 rounded-2xl p-6 md:p-8 shadow-xl">
          <div className="text-center py-12">
            <h3 className="text-lg font-bold text-white mb-2">🔒 Sign in to comment</h3>
            <p className="text-gray-400 text-sm mb-6">
              Log in to join the discussion on this issue. Your comments, likes, and replies are tied to your account.
            </p>
            <a
              href="/login"
              className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl transition-all"
            >
              Log in
            </a>
          </div>
        </section>
      );
    }

    return (
      <section className="mt-12 bg-zinc-900/60 border border-zinc-800 rounded-2xl p-6 md:p-8 shadow-xl">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              💬 Community Discussion
            </h2>
            <p className="text-sm text-gray-400 mt-1">
              {issueComments.length} comment{issueComments.length !== 1 ? "s" : ""}
            </p>
          </div>
        </div>

        <div className="mb-6">
          <div className="flex gap-3">
            <div className="w-8 h-8 rounded-full overflow-hidden shrink-0">
              {user?.avatar_url ? (
                <img src={user.avatar_url} alt={displayName} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full bg-blue-600 flex items-center justify-center text-xs font-bold text-white">
                  {userAvatar}
                </div>
              )}
            </div>
            <div className="flex-1">
              <input
                type="text"
                value={commentInput}
                onChange={(e) => setCommentInput(e.target.value)}
                className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
                placeholder="Add a public comment..."
              />
            </div>
            <button
              onClick={() => addComment()}
              disabled={!commentInput.trim()}
              className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              Post
            </button>
          </div>
        </div>

        <div className="space-y-0">
          {issueComments.length === 0 ? (
            <p className="text-gray-500 text-sm text-center py-8">
              No comments yet. Be the first to share your thoughts!
            </p>
          ) : (
            issueComments.map((comment) => (
              <CommentItem
                key={comment.id}
                comment={comment}
                onLike={() => toggleCommentLike(comment.id)}
                onAddReply={(text) => {
                  if (!user) return;
                  const newReply: Reply = {
                    id: generateId(),
                    commentId: comment.id,
                    user: user.name || user.email,
                    avatar: (user.name || user.email).split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2),
                    avatarUrl: user.avatar_url || null,
                    content: text,
                    createdAt: "Just now",
                    likes: 0,
                    likedByUser: false,
                  };
                  setCommentsByIssue((prev) => {
                    const current = prev[currentIssue.id] || [];
                    const updated = current.map((c) => {
                      if (c.id !== comment.id) return c;
                      return { ...c, replies: [...c.replies, newReply] };
                    });
                    saveStoredComments(currentIssue.id, updated);
                    return { ...prev, [currentIssue.id]: updated };
                  });
                }}
              />
            ))
          )}
        </div>
      </section>
    );
  }

  return (
    <div className="min-h-screen bg-[#070A14] text-white">
      <div className="container mx-auto px-4 py-12 max-w-6xl">
        <header className="mb-10 text-center border-b border-zinc-800 pb-6">
          <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl bg-gradient-to-r from-amber-200 to-blue-300 bg-clip-text text-transparent">
            ACU Comics
          </h1>
          <p className="mt-3 text-lg text-gray-400">The AIONIS Cinematic Universe • Afrovision Digital TV</p>
          <div className="flex justify-center space-x-4 mt-8">
            <button
              onClick={() => setActiveTab("current")}
              className={`px-6 py-2.5 rounded-full font-medium transition-all ${
                activeTab === "current" ? "bg-blue-600 text-white shadow-lg" : "bg-zinc-800 text-gray-300 hover:bg-zinc-700"
              }`}
            >
              📖 Current Issue
            </button>
            <button
              onClick={() => setActiveTab("all")}
              className={`px-6 py-2.5 rounded-full font-medium transition-all ${
                activeTab === "all" ? "bg-blue-600 text-white shadow-lg" : "bg-zinc-800 text-gray-300 hover:bg-zinc-700"
              }`}
            >
              📚 All Issues ({COMIC_ISSUES.length})
            </button>
          </div>
        </header>

        <main>
          {activeTab === "current" && !isReading && (
            <>
              <div className="bg-zinc-900 rounded-2xl border border-zinc-800 p-6 md:p-10 shadow-2xl">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-center">
                <img src={currentIssue.cover} alt={currentIssue.title} className="rounded-lg shadow-2xl w-full mx-auto" />
                <div className="md:col-span-2 space-y-4">
                  <div className="inline-flex gap-2">
                    <span className="px-3 py-1 text-xs font-semibold uppercase tracking-wider text-amber-300 bg-amber-900/30 rounded-full">Latest Release</span>
                    <span className="px-3 py-1 text-xs font-semibold uppercase tracking-wider text-blue-300 bg-blue-900/30 rounded-full">Issue #{currentIssue.id} • Regular Edition</span>
                  </div>
                  <h2 className="text-3xl font-bold">{currentIssue.title}</h2>
                  <p className="text-sm text-gray-500">{currentIssue.releaseDate}</p>
                  <p className="text-gray-300 text-lg leading-relaxed">{currentIssue.description}</p>
                  <p className="text-gray-400 italic">{currentIssue.synopsis}</p>
                  <div className="flex gap-3 pt-4 flex-wrap">
                    <button onClick={() => openReader(currentIssue.id)} className="px-8 py-3 bg-blue-600 rounded-lg font-semibold hover:bg-blue-700 transition">Read Online</button>
                    <a href={currentIssue.pdf} download className="px-6 py-3 border border-zinc-700 rounded-lg hover:bg-zinc-800 transition">Download PDF</a>
                  </div>
                  <div className="pt-4 text-xs text-gray-500 space-y-1">
                    {currentIssue.credits.map((c) => (
                      <div key={c} className={c.includes("Afrovision") ? "text-amber-300 font-semibold" : ""}>{c}</div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <CommentSection />
            </>
          )}

          {isReading && (
            <div
              ref={readerRef}
              className="fixed inset-0 z-50 bg-[#05070f] flex flex-col"
              onTouchStart={(e) => (touchStartX.current = e.touches[0].clientX)}
              onTouchEnd={(e) => {
                if (touchStartX.current === null) return;
                const diff = e.changedTouches[0].clientX - touchStartX.current;
                if (diff > 80) goPrev();
                if (diff < -80) goNext();
                touchStartX.current = null;
              }}
            >
              <div className="flex items-center justify-between px-4 md:px-6 py-3 border-b border-zinc-800 bg-zinc-900/80 backdrop-blur">
                <div className="flex items-center gap-3">
                  <button onClick={() => setIsReading(false)} className="px-3 py-1.5 bg-zinc-800 rounded-md hover:bg-zinc-700 text-sm">← Back</button>
                  <span className="font-bold text-sm md:text-base truncate md:max-w-none">{activeIssue.title}</span>
                  <span className="hidden md:inline text-xs text-gray-500">Page {currentPage + 1} / {allReaderPages.length}</span>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => setZoom((z) => Math.max(0.6, z - 0.2))} className="w-8 h-8 bg-zinc-800 rounded-md">−</button>
                  <button onClick={() => setZoom((z) => Math.min(2, z + 0.2))} className="w-8 h-8 bg-zinc-800 rounded-md">+</button>
                  <button onClick={() => readerRef.current && (!document.fullscreenElement ? readerRef.current.requestFullscreen() : document.exitFullscreen())} className="w-8 h-8 bg-zinc-800 rounded-md">⛶</button>
                  <a href={activeIssue.pdf} download className="hidden md:block px-3 py-1.5 bg-blue-600 rounded-md text-xs font-medium">PDF</a>
                </div>
              </div>

              <div className="flex-1 relative flex items-center justify-center overflow-hidden bg-[radial-gradient(ellipse_at_center,_#1a2340_0%,_#070A14_70%)] p-4">
                <button onClick={goPrev} disabled={currentPage === 0} className="absolute left-2 md:left-6 z-10 w-10 h-10 bg-zinc-900/80 border border-zinc-700 rounded-full flex items-center justify-center disabled:opacity-20">‹</button>
                <div className="max-w-full md:max-w-4xl max-h-full flex items-center justify-center">
                  <img src={allReaderPages[currentPage].src} alt={allReaderPages[currentPage].alt} style={{ transform: `scale(${zoom})` }} className="max-w-full max-h-full object-contain rounded-lg shadow-2xl transition-transform duration-200" />
                </div>
                <button onClick={goNext} disabled={currentPage === allReaderPages.length - 1} className="absolute right-2 md:right-6 z-10 w-10 h-10 bg-zinc-900/80 border border-zinc-700 rounded-full flex items-center justify-center disabled:opacity-20">›</button>
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-zinc-900/80 px-4 py-1.5 rounded-full text-xs border border-zinc-800">
                  {currentPage === 0 ? "COVER" : currentPage === allReaderPages.length - 1 ? "BACK COVER" : `PAGE ${String(currentPage).padStart(2, "0")}`} • {allReaderPages[currentPage].alt}
                </div>
              </div>

              <div className="border-t border-zinc-800 bg-zinc-900/90 p-3 overflow-x-auto">
                <div className="flex gap-2 justify-start mx-auto max-w-6xl">
                  {allReaderPages.map((p, idx) => (
                    <button key={idx} onClick={() => setCurrentPage(idx)} className={`flex-shrink-0 w-14 h-20 rounded-md overflow-hidden border-2 transition-all ${idx === currentPage ? "border-blue-500 scale-105" : "border-zinc-700 opacity-60 hover:opacity-100"}`}>
                      <img src={p.src} alt={p.alt} className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeTab === "all" && !isReading && (
            <div className="space-y-6">
              <h2 className="text-2xl font-bold text-white">Archive Directory • {COMIC_ISSUES.length} Issues</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
                {COMIC_ISSUES.map((issue) => (
                  <div key={issue.id} className="group bg-zinc-900 rounded-xl border border-zinc-800 overflow-hidden hover:border-zinc-700 transition">
                    <div className="relative bg-zinc-800 aspect-[2/3]">
                      <img src={issue.cover} alt={issue.title} className="w-full h-full object-cover group-hover:scale-105 transition duration-300" />
                      {issue.id === COMIC_ISSUES[0].id && <div className="absolute top-3 left-3 px-2 py-1 bg-blue-600 text-white text- font-bold rounded-full">LATEST</div>}
                    </div>
                    <div className="p-5 space-y-2">
                      <h3 className="font-bold text-lg text-white group-hover:text-blue-400">{issue.title}</h3>
                      <p className="text-xs text-gray-500">{issue.releaseDate} • Regular Edition</p>
                      <p className="text-sm text-gray-400 line-clamp-2">{issue.description}</p>
                      <button onClick={() => openReader(issue.id)} className="mt-3 w-full py-2 bg-blue-600 text-white text-sm font-semibold rounded-md hover:bg-blue-700">Read Online</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
