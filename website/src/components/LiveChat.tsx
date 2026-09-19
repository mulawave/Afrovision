"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import type { Socket } from "socket.io-client";
import { io } from "socket.io-client";
import Link from "next/link";
import { useAuth } from "@/lib/AuthContext";
import {
  API_BASE,
  getChatMessagesApi,
  getToken,
  type LiveChatMessage,
} from "@/lib/api";

const USER_COLORS = [
  "#F49617", "#F5C16C", "#FF4D6A", "#4DE0D0", "#A78BFA",
  "#60A5FA", "#F472B6", "#34D399", "#FBBF24", "#FB923C",
];

const BADGE_ICONS: Record<string, { label: string; bg: string }> = {
  mod: { label: "MOD", bg: "bg-green-500/80" },
  vip: { label: "VIP", bg: "bg-av-orange/80" },
  sub: { label: "SUB", bg: "bg-purple-500/80" },
};

interface LiveChatProps {
  channelId: string;
}

function getUserColor(name: string) {
  const hash = name.split("").reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return USER_COLORS[hash % USER_COLORS.length];
}

export function LiveChat({ channelId }: LiveChatProps) {
  const [messages, setMessages] = useState<LiveChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [viewerCount, setViewerCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const socketRef = useRef<Socket | null>(null);
  const { isAuthenticated } = useAuth();

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    let active = true;

    async function loadChat() {
      if (!isAuthenticated) {
        setMessages([]);
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setError(null);

      const historyRes = await getChatMessagesApi(channelId, 75);
      if (!active) return;

      if (!historyRes.ok || !("messages" in historyRes.data)) {
        setMessages([]);
        setError("Unable to load chat history right now.");
        setIsLoading(false);
        return;
      }

      setMessages(historyRes.data.messages);
      setIsLoading(false);

      const token = getToken();
      if (!token) {
        setError("Your session expired. Please sign in again.");
        return;
      }

      const socket = io(API_BASE, {
        transports: ["websocket", "polling"],
        autoConnect: false,
        auth: { token },
      });

      socketRef.current = socket;

      socket.on("connect", () => {
        if (!active) return;
        setIsConnected(true);
        setError(null);

        socket.emit("channel:join", { channelId, platform: "web" }, (response: { ok?: boolean; error?: string; viewer_count?: number }) => {
          if (!active) return;
          if (!response?.ok) {
            setError(response?.error || "Unable to join this chat.");
            return;
          }
          setViewerCount(response.viewer_count || 0);
        });
      });

      socket.on("disconnect", () => {
        if (!active) return;
        setIsConnected(false);
      });

      socket.on("connect_error", (socketError) => {
        if (!active) return;
        setIsConnected(false);
        setError(socketError.message || "Chat connection failed.");
      });

      socket.on("chat:message", (message: LiveChatMessage) => {
        if (!active) return;
        setMessages((prev) => {
          if (prev.some((item) => item.id === message.id)) {
            return prev;
          }
          return [...prev.slice(-99), message];
        });
      });

      socket.on("channel:viewer_count", (payload: { viewer_count?: number }) => {
        if (!active) return;
        setViewerCount(payload.viewer_count || 0);
      });

      socket.connect();
    }

    loadChat();

    return () => {
      active = false;
      const socket = socketRef.current;
      if (socket) {
        socket.emit("channel:leave", { channelId }, () => undefined);
        socket.disconnect();
        socketRef.current = null;
      }
    };
  }, [channelId, isAuthenticated]);

  const sendMessage = useCallback(() => {
    const text = input.trim();
    const socket = socketRef.current;
    if (!text || !socket) return;

    setIsSending(true);
    setError(null);
    socket.emit(
      "chat:send",
      { channelId, text },
      (response: { ok?: boolean; error?: string }) => {
        setIsSending(false);
        if (!response?.ok) {
          setError(response?.error || "Unable to send your message.");
          return;
        }

        setInput("");
        inputRef.current?.focus();
      }
    );
  }, [channelId, input]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div className="flex flex-col h-full rounded-xl bg-av-card border border-av-input-border/20 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-av-input-border/20 flex-shrink-0">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-av-white">Live Chat</h3>
          <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-500/15 text-[10px] font-medium text-green-400">
            <span className={`w-1.5 h-1.5 rounded-full ${isConnected ? "bg-green-400 animate-pulse" : "bg-av-hint"}`} />
            {isConnected ? "Connected" : "Reconnecting..."}
          </span>
        </div>
        <span className="text-[10px] text-av-light-orange font-mono">{viewerCount} watching · {messages.length} msgs</span>
      </div>

      {/* Messages area */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-3 py-2 space-y-1 min-h-0"
      >
        {isLoading ? (
          <div className="h-full flex items-center justify-center text-xs text-av-light-orange">
            Loading chat…
          </div>
        ) : messages.length === 0 ? (
          <div className="h-full flex items-center justify-center text-xs text-av-light-orange text-center px-6">
            Chat is live. Be the first viewer to say something.
          </div>
        ) : messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex items-start gap-1.5 py-1 px-2 rounded-lg text-[13px] leading-snug transition-colors hover:bg-av-input-fill/50 ${msg.is_own ? "bg-av-orange/5" : ""}`}
          >
            {/* Badge */}
            {msg.badge && (
              <span
                className={`flex-shrink-0 mt-0.5 px-1.5 py-0 rounded text-[9px] font-bold uppercase tracking-wider text-white ${BADGE_ICONS[msg.badge].bg}`}
              >
                {BADGE_ICONS[msg.badge].label}
              </span>
            )}
            {/* Username */}
            <span className="font-semibold flex-shrink-0" style={{ color: getUserColor(msg.sender_name) }}>
              {msg.sender_name}
            </span>
            {/* Message text */}
            <span className="text-av-light-orange break-words min-w-0">
              {msg.text}
            </span>
          </div>
        ))}
      </div>

      {/* Input area */}
      <div className="px-3 py-3 border-t border-av-input-border/20 flex-shrink-0">
        {error && (
          <p className="mb-2 rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-[11px] text-red-300">
            {error}
          </p>
        )}
        {isAuthenticated ? (
          <>
            <div className="flex gap-2">
              <input
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Send a message..."
                maxLength={200}
                className="flex-1 h-9 px-3 rounded-lg bg-av-input-fill border border-av-input-border/30 text-sm text-av-white placeholder:text-av-light-orange focus:outline-none focus:border-av-orange/50 transition-colors"
              />
              <button
                onClick={sendMessage}
                disabled={!input.trim() || isSending || !isConnected}
                className="h-9 px-4 rounded-lg bg-av-orange/20 text-xs font-semibold text-av-orange hover:bg-av-orange/30 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
              >
                {isSending ? "Sending..." : "Send"}
              </button>
            </div>
            <p className="text-[10px] text-av-light-orange mt-1.5 px-1">
              {input.length}/200 · Be respectful. Chat rules apply.
            </p>
          </>
        ) : (
          <Link
            href={`/login?redirect=${encodeURIComponent(typeof window !== "undefined" ? window.location.pathname : "/")}`}
            className="flex items-center justify-center gap-2 w-full h-10 rounded-lg bg-av-input-fill border border-av-input-border/30 text-sm text-av-light-orange hover:text-av-orange hover:border-av-orange/40 transition-all"
          >
            Sign in to chat
          </Link>
        )}
      </div>
    </div>
  );
}
