import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { mangaApi } from "../../api/manga";
import { useAuth } from "../../context/AuthContext";
import { formatDistanceToNow } from "../common/timeUtils";
import LoadingSpinner from "../common/LoadingSpinner";
import { MessageSquare, Send, ChevronDown, User } from "lucide-react";
import toast from "react-hot-toast";

const PAGE_SIZE = 20;

export default function CommentSection({ mangaSlug, chapterSlug }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [text, setText] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // ── Fetch comments ─────────────────────────────────────────────────────────
  const { data, isLoading, isError } = useQuery({
    queryKey: ["comments", mangaSlug, chapterSlug, page],
    queryFn: () =>
      mangaApi
        .listComments(mangaSlug, chapterSlug, { page, page_size: PAGE_SIZE })
        .then((r) => r.data),
    enabled: !!(mangaSlug && chapterSlug),
    keepPreviousData: true,
  });

  // ── Comment count (for the header badge) ──────────────────────────────────
  const { data: countData } = useQuery({
    queryKey: ["comment-count", mangaSlug, chapterSlug],
    queryFn: () =>
      mangaApi.commentCount(mangaSlug, chapterSlug).then((r) => r.data),
    enabled: !!(mangaSlug && chapterSlug),
  });

  // ── Post comment ───────────────────────────────────────────────────────────
  const postMutation = useMutation({
    mutationFn: (commentText) =>
      mangaApi.addComment(mangaSlug, chapterSlug, { text: commentText }),
    onSuccess: () => {
      setText("");
      setPage(1);
      qc.invalidateQueries({ queryKey: ["comments", mangaSlug, chapterSlug] });
      qc.invalidateQueries({
        queryKey: ["comment-count", mangaSlug, chapterSlug],
      });
      toast.success("Comment posted!");
    },
    onError: (err) => {
      toast.error(err.response?.data?.detail || "Failed to post comment");
    },
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    const trimmed = text.trim();
    if (!trimmed) return;
    if (trimmed.length > 1000) {
      toast.error("Comment must be 1000 characters or fewer");
      return;
    }
    setSubmitting(true);
    try {
      await postMutation.mutateAsync(trimmed);
    } finally {
      setSubmitting(false);
    }
  };

  const comments = data ?? [];
  const totalCount = countData?.count ?? comments.length;

  return (
    <section className="mt-10">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 mb-4">
        <MessageSquare size={20} className="text-manga-400" />
        <h2 className="text-lg font-semibold">
          Comments
          {totalCount > 0 && (
            <span className="ml-2 text-sm text-gray-500 font-normal">
              ({totalCount})
            </span>
          )}
        </h2>
      </div>

      {/* ── Post form ──────────────────────────────────────────────────────── */}
      <div className="card p-4 mb-6">
        <div className="flex items-start gap-3">
          {/* Avatar placeholder */}
          <div className="shrink-0 w-9 h-9 rounded-full bg-manga-800 flex items-center justify-center text-sm font-bold">
            {user ? (
              user.avatar ? (
                <img
                  src={user.avatar}
                  alt={user.username}
                  className="w-full h-full rounded-full object-cover"
                />
              ) : (
                user.username[0].toUpperCase()
              )
            ) : (
              <User size={16} className="text-gray-500" />
            )}
          </div>

          <form onSubmit={handleSubmit} className="flex-1 flex flex-col gap-2">
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={
                user
                  ? "Share your thoughts on this chapter…"
                  : "Post as Anonymous — login to show your name"
              }
              rows={3}
              maxLength={1000}
              className="input resize-none text-sm leading-relaxed"
            />
            <div className="flex items-center justify-between">
              <span
                className={`text-xs ${text.length > 900 ? "text-yellow-400" : "text-gray-600"}`}
              >
                {text.length}/1000
              </span>
              <button
                type="submit"
                disabled={submitting || !text.trim()}
                className="btn-primary text-sm px-4 py-1.5"
              >
                <Send size={14} />
                {submitting ? "Posting…" : user ? "Post" : "Post as Guest"}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* ── Comment list ───────────────────────────────────────────────────── */}
      {isLoading ? (
        <LoadingSpinner className="py-10" />
      ) : isError ? (
        <p className="text-center text-red-400 py-8 text-sm">
          Failed to load comments.
        </p>
      ) : comments.length === 0 ? (
        <div className="text-center py-12 text-gray-600">
          <MessageSquare size={36} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm">No comments yet. Be the first!</p>
        </div>
      ) : (
        <>
          <div className="space-y-px">
            {comments.map((c, idx) => (
              <CommentCard key={c.id} comment={c} isFirst={idx === 0} />
            ))}
          </div>

          {/* Load more */}
          {comments.length === PAGE_SIZE && (
            <div className="flex justify-center mt-4">
              <button
                onClick={() => setPage((p) => p + 1)}
                className="btn-ghost text-sm gap-2"
              >
                <ChevronDown size={16} /> Load more comments
              </button>
            </div>
          )}
        </>
      )}
    </section>
  );
}

function CommentCard({ comment, isFirst }) {
  return (
    <div
      className={`flex gap-3 px-4 py-4 hover:bg-gray-900/50 transition-colors ${
        !isFirst ? "border-t border-gray-800/60" : ""
      }`}
    >
      {/* Avatar */}
      <div className="shrink-0 w-8 h-8 rounded-full bg-manga-900 border border-manga-800 flex items-center justify-center text-xs font-bold text-manga-300">
        {comment.username && comment.username !== "Anonymous"
          ? comment.username[0].toUpperCase()
          : "?"}
      </div>

      {/* Body */}
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2 mb-1 flex-wrap">
          <span className="text-sm font-semibold text-gray-200">
            {comment.username || "Anonymous"}
          </span>
          <span className="text-xs text-gray-600">
            {formatDistanceToNow(comment.created_at)}
          </span>
        </div>
        <p className="text-sm text-gray-300 leading-relaxed whitespace-pre-wrap break-words">
          {comment.text}
        </p>
      </div>
    </div>
  );
}
