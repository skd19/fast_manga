import { useState, useEffect } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { useChapter, useChapterNav } from "../hooks/useManga";
import { useAuth } from "../context/AuthContext";
import { mangaApi } from "../api/manga";
import LoadingSpinner from "../components/common/LoadingSpinner";
import CommentSection from "../components/manga/CommentSection";
import LazyImage from "../components/manga/LazyImage";
import {
  ChevronLeft,
  ChevronRight,
  Home,
  ArrowUp,
  MessageSquare,
} from "lucide-react";
import clsx from "clsx";

export default function ChapterReadPage() {
  const { mangaSlug, chapterSlug } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();

  const {
    data: chapter,
    isLoading,
    isError,
  } = useChapter(mangaSlug, chapterSlug);
  const { data: nav } = useChapterNav(mangaSlug, chapterSlug);

  const [imageWidth, setImageWidth] = useState("max-w-3xl");
  const [showControls, setShowControls] = useState(true);
  const [showComments, setShowComments] = useState(false);

  // Mark as read when loaded
  useEffect(() => {
    if (chapter && user) {
      mangaApi.markChapterRead(mangaSlug, chapterSlug).catch(() => {});
    }
  }, [chapter, user, mangaSlug, chapterSlug]);

  // Keyboard navigation
  useEffect(() => {
    const handler = (e) => {
      if (e.key === "ArrowLeft" && nav?.prev) {
        navigate(`/manga/${mangaSlug}/chapter/${nav.prev.slug}`);
      } else if (e.key === "ArrowRight" && nav?.next) {
        navigate(`/manga/${mangaSlug}/chapter/${nav.next.slug}`);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [nav, navigate, mangaSlug]);

  const scrollTop = () => window.scrollTo({ top: 0, behavior: "smooth" });

  const widthOptions = [
    { value: "max-w-xl", label: "Narrow" },
    { value: "max-w-3xl", label: "Medium" },
    { value: "max-w-5xl", label: "Wide" },
    { value: "max-w-full", label: "Full" },
  ];

  if (isLoading)
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );

  if (isError || !chapter)
    return (
      <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center text-red-400 gap-4">
        <p>Chapter not found.</p>
        <Link to={`/manga/${mangaSlug}`} className="btn-secondary">
          Back to Manga
        </Link>
      </div>
    );

  return (
    <div className="min-h-screen bg-gray-950">
      {/* ── Fixed top bar ───────────────────────────────────────────────────── */}
      <div
        className={clsx(
          "fixed top-0 left-0 right-0 z-50 bg-gray-900/95 backdrop-blur border-b border-gray-800 transition-transform duration-300",
          showControls ? "translate-y-0" : "-translate-y-full",
        )}
      >
        <div className="container mx-auto px-4 max-w-7xl h-14 flex items-center justify-between gap-4">
          {/* Left: home + title */}
          <div className="flex items-center gap-2 min-w-0">
            <Link to={`/manga/${mangaSlug}`} className="btn-ghost p-2">
              <Home size={18} />
            </Link>
            <span className="text-sm text-gray-400 truncate">
              Chapter {Number(chapter.number)}
              {chapter.title && ` — ${chapter.title}`}
            </span>
          </div>

          {/* Right: width + nav */}
          <div className="flex items-center gap-2">
            {widthOptions.map((w) => (
              <button
                key={w.value}
                onClick={() => setImageWidth(w.value)}
                className={clsx(
                  "text-xs px-2 py-1 rounded transition-colors hidden sm:block",
                  imageWidth === w.value
                    ? "bg-manga-600 text-white"
                    : "bg-gray-800 text-gray-400 hover:bg-gray-700",
                )}
              >
                {w.label}
              </button>
            ))}

            {nav?.prev ? (
              <Link
                to={`/manga/${mangaSlug}/chapter/${nav.prev.slug}`}
                className="btn-ghost p-2"
              >
                <ChevronLeft size={18} />
              </Link>
            ) : (
              <button disabled className="btn-ghost p-2 opacity-30">
                <ChevronLeft size={18} />
              </button>
            )}

            {nav?.next ? (
              <Link
                to={`/manga/${mangaSlug}/chapter/${nav.next.slug}`}
                className="btn-ghost p-2"
              >
                <ChevronRight size={18} />
              </Link>
            ) : (
              <button disabled className="btn-ghost p-2 opacity-30">
                <ChevronRight size={18} />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── Reader images ────────────────────────────────────────────────────── */}
      {/* Click area toggles the control bars; pb-28 leaves room above the fixed bottom bar */}
      <div
        className="pt-14 pb-28 cursor-pointer select-none"
        onClick={() => setShowControls((v) => !v)}
      >
        <div className={clsx("mx-auto", imageWidth)}>
          {Array.isArray(chapter.images_data) &&
          chapter.images_data.length > 0 ? (
            chapter.images_data.map((src, idx) => (
              <LazyImage
                key={idx}
                src={src}
                alt={`Page ${idx + 1}`}
                rootMargin="400px 0px"
                aspectRatio="2/3"
              />
            ))
          ) : (
            <div className="text-center py-32 text-gray-500">
              No images available for this chapter.
            </div>
          )}
        </div>
      </div>

      {/* ── Comment section (below images, outside click-toggle area) ──────── */}
      <div className="max-w-3xl mx-auto px-4 pb-32">
        {/* Toggle button */}
        <button
          onClick={() => setShowComments((v) => !v)}
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

      {/* ── Fixed bottom bar ─────────────────────────────────────────────────── */}
      <div
        className={clsx(
          "fixed bottom-0 left-0 right-0 z-50 bg-gray-900/95 backdrop-blur border-t border-gray-800 transition-transform duration-300",
          showControls ? "translate-y-0" : "translate-y-full",
        )}
      >
        <div className="container mx-auto px-4 max-w-7xl h-14 flex items-center justify-between">
          {nav?.prev ? (
            <Link
              to={`/manga/${mangaSlug}/chapter/${nav.prev.slug}`}
              className="btn-secondary text-sm"
            >
              <ChevronLeft size={16} /> Ch. {Number(nav.prev.number)}
            </Link>
          ) : (
            <div />
          )}

          <button onClick={scrollTop} className="btn-ghost text-sm">
            <ArrowUp size={16} /> Top
          </button>

          {nav?.next ? (
            <Link
              to={`/manga/${mangaSlug}/chapter/${nav.next.slug}`}
              className="btn-primary text-sm"
            >
              Ch. {Number(nav.next.number)} <ChevronRight size={16} />
            </Link>
          ) : (
            <Link to={`/manga/${mangaSlug}`} className="btn-secondary text-sm">
              Back to Manga
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
