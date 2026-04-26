import { useCallback, useState, useEffect } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useChapter, useChapterNav } from "../hooks/useManga";
import { useAuth } from "../context/AuthContext";
import { mangaApi } from "../api/manga";
import LoadingSpinner from "../components/common/LoadingSpinner";
import CommentSection from "../components/manga/CommentSection";
import LazyImage from "../components/manga/LazyImage";
import ReaderTopBar from "../components/manga/ReaderTopBar";
import {
  ChevronLeft,
  ChevronRight,
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
  const { data: chapterOptions = [] } = useQuery({
    queryKey: ["reader-chapter-selector", mangaSlug],
    queryFn: async () => {
      const first = await mangaApi
        .chapters(mangaSlug, { page: 1, page_size: 200 })
        .then((r) => r.data);
      if (first.total_pages <= 1) return first.items;

      const remainingPages = Array.from(
        { length: first.total_pages - 1 },
        (_, idx) => idx + 2,
      );
      const rest = await Promise.all(
        remainingPages.map((page) =>
          mangaApi
            .chapters(mangaSlug, { page, page_size: 200 })
            .then((r) => r.data.items),
        ),
      );
      return [...first.items, ...rest.flat()];
    },
    enabled: !!mangaSlug,
  });

  const [imageWidth, setImageWidth] = useState("max-w-3xl");
  const [readerMode, setReaderMode] = useState(
    () => localStorage.getItem("readerMode") || "webtoon",
  );
  const [spreadIndex, setSpreadIndex] = useState(0);
  const [isSinglePageManga, setIsSinglePageManga] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [showReaderSettings, setShowReaderSettings] = useState(false);
  const [showComments, setShowComments] = useState(false);

  // Mark as read when loaded
  useEffect(() => {
    if (chapter && user) {
      mangaApi.markChapterRead(mangaSlug, chapterSlug).catch(() => {});
    }
  }, [chapter, user, mangaSlug, chapterSlug]);

  useEffect(() => {
    localStorage.setItem("readerMode", readerMode);
  }, [readerMode]);

  const scrollTop = () => window.scrollTo({ top: 0, behavior: "smooth" });

  const widthOptions = [
    { value: "max-w-xl", label: "Narrow" },
    { value: "max-w-3xl", label: "Medium" },
    { value: "max-w-5xl", label: "Wide" },
    { value: "max-w-full", label: "Full" },
  ];
  const readerModes = [
    { value: "webtoon", label: "Webtoon" },
    { value: "side-by-side", label: "Manga" },
  ];
  const pages = Array.isArray(chapter?.images_data) ? chapter.images_data : [];
  const mangaPageStep = isSinglePageManga ? 1 : 2;
  const canGoPreviousSpread = readerMode === "side-by-side" && spreadIndex > 0;
  const canGoNextSpread =
    readerMode === "side-by-side" && spreadIndex + mangaPageStep < pages.length;
  const visibleSpread = pages.slice(spreadIndex, spreadIndex + mangaPageStep);

  const goPreviousSpread = useCallback(() => {
    setSpreadIndex((current) => Math.max(0, current - mangaPageStep));
  }, [mangaPageStep]);

  const goNextSpread = useCallback(() => {
    setSpreadIndex((current) =>
      Math.min(Math.max(pages.length - 1, 0), current + mangaPageStep),
    );
  }, [mangaPageStep, pages.length]);

  useEffect(() => {
    setSpreadIndex(0);
    scrollTop();
    setShowReaderSettings(false);
  }, [chapterSlug]);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(max-width: 767px)");
    const updateSinglePageMode = () => setIsSinglePageManga(mediaQuery.matches);

    updateSinglePageMode();
    mediaQuery.addEventListener("change", updateSinglePageMode);
    return () => mediaQuery.removeEventListener("change", updateSinglePageMode);
  }, []);

  useEffect(() => {
    setSpreadIndex((current) =>
      Math.min(current, Math.max(pages.length - mangaPageStep, 0)),
    );
  }, [mangaPageStep, pages.length]);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () =>
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  const toggleFullscreen = async () => {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else {
        await document.documentElement.requestFullscreen();
      }
    } catch {
      // Browser rejected fullscreen, usually because the page is embedded.
    }
  };

  // Keyboard navigation
  useEffect(() => {
    const handler = (e) => {
      if (readerMode === "side-by-side") {
        if (e.key === "ArrowLeft") {
          if (canGoPreviousSpread) {
            goPreviousSpread();
          } else if (nav?.prev) {
            navigate(`/manga/${mangaSlug}/chapter/${nav.prev.slug}`);
          }
        } else if (e.key === "ArrowRight") {
          if (canGoNextSpread) {
            goNextSpread();
          } else if (nav?.next) {
            navigate(`/manga/${mangaSlug}/chapter/${nav.next.slug}`);
          }
        }
        return;
      }

      if (e.key === "ArrowLeft" && nav?.prev) {
        navigate(`/manga/${mangaSlug}/chapter/${nav.prev.slug}`);
      } else if (e.key === "ArrowRight" && nav?.next) {
        navigate(`/manga/${mangaSlug}/chapter/${nav.next.slug}`);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [
    canGoNextSpread,
    canGoPreviousSpread,
    mangaSlug,
    nav,
    navigate,
    goNextSpread,
    goPreviousSpread,
    readerMode,
  ]);

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
      <ReaderTopBar
        chapter={chapter}
        chapterOptions={chapterOptions}
        chapterSlug={chapterSlug}
        imageWidth={imageWidth}
        isFullscreen={isFullscreen}
        mangaSlug={mangaSlug}
        nav={nav}
        navigate={navigate}
        onChapterChange={scrollTop}
        onImageWidthChange={setImageWidth}
        onReaderModeChange={setReaderMode}
        onToggleFullscreen={toggleFullscreen}
        onToggleReaderSettings={() =>
          setShowReaderSettings((value) => !value)
        }
        readerMode={readerMode}
        readerModes={readerModes}
        showControls={showControls}
        showReaderSettings={showReaderSettings}
        widthOptions={widthOptions}
      />

      {/* ── Reader images ────────────────────────────────────────────────────── */}
      {/* Click area toggles the control bars; pb-28 leaves room above the fixed bottom bar */}
      <div
        className="pt-14 pb-28 cursor-pointer select-none"
        onClick={() => setShowControls((v) => !v)}
      >
        <div
          className={clsx(
            "mx-auto",
            readerMode === "side-by-side" ? "max-w-7xl px-2 md:px-4" : imageWidth,
          )}
        >
          {pages.length > 0 ? (
            readerMode === "side-by-side" ? (
              <div className="relative min-h-[calc(100vh-7rem)] flex items-center justify-center">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (canGoPreviousSpread) goPreviousSpread();
                  }}
                  disabled={!canGoPreviousSpread}
                  className={clsx(
                    "absolute inset-y-0 left-0 z-10 w-1/2 cursor-w-resize",
                    !canGoPreviousSpread && "cursor-default",
                  )}
                  aria-label="Previous pages"
                />
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (canGoNextSpread) goNextSpread();
                  }}
                  disabled={!canGoNextSpread}
                  className={clsx(
                    "absolute inset-y-0 right-0 z-10 w-1/2 cursor-e-resize",
                    !canGoNextSpread && "cursor-default",
                  )}
                  aria-label="Next pages"
                />

                <div className="relative z-0 grid w-full grid-cols-1 md:grid-cols-2 gap-2 md:gap-3 items-center">
                  {visibleSpread.map((src, idx) => (
                    <LazyImage
                      key={spreadIndex + idx}
                      src={src}
                      alt={`Page ${spreadIndex + idx + 1}`}
                      rootMargin="400px 0px"
                      aspectRatio="2/3"
                      className="max-h-[calc(100vh-8rem)] object-contain"
                    />
                  ))}
                </div>

                <div
                  className="absolute bottom-3 left-1/2 z-20 -translate-x-1/2 rounded bg-gray-900/80 px-3 py-1 text-xs text-gray-400"
                  onClick={(e) => e.stopPropagation()}
                >
                  Page {spreadIndex + 1}
                  {visibleSpread.length > 1
                    ? `-${spreadIndex + visibleSpread.length}`
                    : ""}{" "}
                  of {pages.length}
                </div>
              </div>
            ) : (
              pages.map((src, idx) => (
                <LazyImage
                  key={idx}
                  src={src}
                  alt={`Page ${idx + 1}`}
                  rootMargin="400px 0px"
                  aspectRatio="2/3"
                />
              ))
            )
          ) : (
            <div className="text-center py-32 text-gray-500">
              No images available for this chapter.
            </div>
          )}
        </div>
      </div>

      {/* ── Comment section (below images, outside click-toggle area) ──────── */}
      <div className="max-w-3xl mx-auto px-4 pb-32">
        {readerMode === "webtoon" && (
          <div className="mb-6 flex justify-center">
            {nav?.next ? (
              <Link
                to={`/manga/${mangaSlug}/chapter/${nav.next.slug}`}
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
