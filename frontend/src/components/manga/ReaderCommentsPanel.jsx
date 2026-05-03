import { Link } from "react-router-dom";
import { ChevronRight, MessageSquare } from "lucide-react";
import CommentSection from "./CommentSection";

export default function ReaderCommentsPanel({
  activeEntry,
  mangaSlug,
  chapterSlug,
  readerMode,
  showComments,
  onToggleComments,
}) {
  return (
    <div className="max-w-3xl mx-auto px-4 pb-32">
      {readerMode === "webtoon" && (
        <div className="mb-6 flex justify-center">
          {activeEntry.nav?.next ? (
            <Link
              to={`/manga/${mangaSlug}/chapter/${activeEntry.nav.next.slug}`}
              className="btn-primary"
            >
              Next Chapter <ChevronRight size={16} />
            </Link>
          ) : (
            <Link to={`/manga/${mangaSlug}`} className="btn-secondary">
              Back to Manga
            </Link>
          )}
        </div>
      )}

      <button
        onClick={onToggleComments}
        className="w-full flex items-center justify-between card px-5 py-3 hover:bg-gray-800/60 transition-colors mb-1"
      >
        <span className="flex items-center gap-2 text-sm font-medium text-gray-300">
          <MessageSquare size={16} className="text-manga-400" />
          Comments
        </span>
        <span className="text-xs text-gray-500">
          {showComments ? "Hide" : "Show"}
        </span>
      </button>

      {showComments && (
        <div className="card px-4">
          <CommentSection mangaSlug={mangaSlug} chapterSlug={chapterSlug} />
        </div>
      )}
    </div>
  );
}
