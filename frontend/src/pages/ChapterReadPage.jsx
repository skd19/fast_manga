import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useChapter, useChapterNav } from "../hooks/useManga";
import { useAuth } from "../context/AuthContext";
import toast from "react-hot-toast";
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
  const [autoLoadNextChapter, setAutoLoadNextChapter] = useState(
    () => localStorage.getItem("autoLoadNextChapter") === "true",
  );
  const [mangaSpreadCount, setMangaSpreadCount] = useState(() => {
    const saved = Number(localStorage.getItem("mangaSpreadCount"));
    return saved === 1 || saved === 2 ? saved : 1;
  });
  const [spreadIndex, setSpreadIndex] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [showReaderSettings, setShowReaderSettings] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [loadedChapterEntries, setLoadedChapterEntries] = useState([]);
  const [loadingNextChapter, setLoadingNextChapter] = useState(false);
  const autoNavigatingRef = useRef(false);
  const pendingSnapChapterSlugRef = useRef(null);
  const chapterSectionRefs = useRef({});
  const commentsSectionRef = useRef(null);

  // Mark as read when loaded
  useEffect(() => {
    if (chapter && user) {
      mangaApi.markChapterRead(mangaSlug, chapterSlug).catch(() => {});
    }
  }, [chapter, user, mangaSlug, chapterSlug]);

  useEffect(() => {
    localStorage.setItem("readerMode", readerMode);
  }, [readerMode]);

  useEffect(() => {
    localStorage.setItem(
      "autoLoadNextChapter",
      autoLoadNextChapter ? "true" : "false",
    );
  }, [autoLoadNextChapter]);

  useEffect(() => {
    localStorage.setItem("mangaSpreadCount", String(mangaSpreadCount));
  }, [mangaSpreadCount]);

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
  const mangaPageStep = mangaSpreadCount;
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

  const loadChapterBundle = useCallback(
    async (slug) => {
      const [chapterData, navData] = await Promise.all([
        mangaApi.readChapter(mangaSlug, slug).then((response) => response.data),
        mangaApi.chapterNav(mangaSlug, slug).then((response) => response.data),
      ]);

      if (user) {
        mangaApi.markChapterRead(mangaSlug, slug).catch(() => {});
      }

      return { slug, chapter: chapterData, nav: navData };
    },
    [mangaSlug, user],
  );

  const scrollTop = useCallback(
    (behavior = "smooth") => {
      if (readerMode === "webtoon") {
        const activeSlug =
          loadedChapterEntries.length > 0
            ? loadedChapterEntries[loadedChapterEntries.length - 1].slug
            : chapterSlug;
        const activeChapterSection = chapterSectionRefs.current[activeSlug];

        if (activeChapterSection) {
          window.scrollTo({
            top: Math.max(activeChapterSection.offsetTop - 64, 0),
            behavior,
          });
          return;
        }
      }

      window.scrollTo({ top: 0, behavior });
    },
    [chapterSlug, loadedChapterEntries, readerMode],
  );

  useEffect(() => {
    setSpreadIndex(0);
    if (!autoNavigatingRef.current) {
      scrollTop("auto");
    }
    setShowReaderSettings(false);
    setLoadingNextChapter(false);
  }, [chapterSlug, scrollTop]);

  useEffect(() => {
    setSpreadIndex((current) =>
      Math.min(current, Math.max(pages.length - mangaPageStep, 0)),
    );
  }, [mangaPageStep, pages.length]);

  useEffect(() => {
    if (!chapter || !nav) return;

    if (autoNavigatingRef.current) {
      autoNavigatingRef.current = false;
      setLoadedChapterEntries((current) =>
        current.map((entry) =>
          entry.slug === chapterSlug ? { slug: chapterSlug, chapter, nav } : entry,
        ),
      );
      return;
    }

    setLoadedChapterEntries([{ slug: chapterSlug, chapter, nav }]);
    setLoadingNextChapter(false);
  }, [chapter, nav, chapterSlug]);

  useEffect(() => {
    const pendingSlug = pendingSnapChapterSlugRef.current;
    if (!pendingSlug) return;

    const targetSection = chapterSectionRefs.current[pendingSlug];
    if (!targetSection) return;

    pendingSnapChapterSlugRef.current = null;
    window.requestAnimationFrame(() => {
      window.scrollTo({
        top: Math.max(targetSection.offsetTop - 64, 0),
        behavior: "smooth",
      });
    });
  }, [loadedChapterEntries]);

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

  const handleAutoLoadNextChapter = useCallback(async () => {
    if (
      readerMode !== "webtoon" ||
      !autoLoadNextChapter ||
      loadingNextChapter ||
      loadedChapterEntries.length === 0
    ) {
      return;
    }

    const currentEntry = loadedChapterEntries[loadedChapterEntries.length - 1];
    const nextSlug = currentEntry.nav?.next?.slug;
    if (!nextSlug || loadedChapterEntries.some((entry) => entry.slug === nextSlug)) {
      return;
    }

    setLoadingNextChapter(true);
    const toastId = toast.loading("Loading next chapter...");
    try {
      const [nextEntry] = await Promise.all([
        loadChapterBundle(nextSlug),
        new Promise((resolve) => window.setTimeout(resolve, 4000)),
      ]);
      pendingSnapChapterSlugRef.current = nextSlug;
      setLoadedChapterEntries((current) => [...current, nextEntry]);
      autoNavigatingRef.current = true;
      navigate(`/manga/${mangaSlug}/chapter/${nextSlug}`, { replace: true });
      toast.dismiss(toastId);
    } catch (error) {
      toast.error("Failed to load next chapter", { id: toastId });
      throw error;
    } finally {
      setLoadingNextChapter(false);
    }
  }, [
    autoLoadNextChapter,
    loadChapterBundle,
    loadedChapterEntries,
    loadingNextChapter,
    mangaSlug,
    navigate,
    readerMode,
  ]);

  useEffect(() => {
    if (
      readerMode !== "webtoon" ||
      !autoLoadNextChapter ||
      !commentsSectionRef.current
    ) {
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          handleAutoLoadNextChapter();
        }
      },
      { rootMargin: "250px 0px" },
    );

    observer.observe(commentsSectionRef.current);
    return () => observer.disconnect();
  }, [autoLoadNextChapter, handleAutoLoadNextChapter, readerMode]);

  const activeEntry =
    readerMode === "webtoon" && loadedChapterEntries.length > 0
      ? loadedChapterEntries[loadedChapterEntries.length - 1]
      : { chapter, nav };

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
        autoLoadNextChapter={autoLoadNextChapter}
        chapter={activeEntry.chapter}
        chapterOptions={chapterOptions}
        chapterSlug={chapterSlug}
        imageWidth={imageWidth}
        isFullscreen={isFullscreen}
        mangaSlug={mangaSlug}
        nav={activeEntry.nav}
        navigate={navigate}
        onAutoLoadNextChapterChange={setAutoLoadNextChapter}
        onChapterChange={scrollTop}
        onImageWidthChange={setImageWidth}
        onMangaSpreadCountChange={setMangaSpreadCount}
        onReaderModeChange={setReaderMode}
        onToggleFullscreen={toggleFullscreen}
        onToggleReaderSettings={() =>
          setShowReaderSettings((value) => !value)
        }
        mangaSpreadCount={mangaSpreadCount}
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

                <div
                  className={clsx(
                    "relative z-0 grid w-full gap-2 md:gap-3 items-center",
                    mangaSpreadCount === 2 ? "grid-cols-2" : "grid-cols-1",
                  )}
                >
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
              <>
                {loadedChapterEntries.map((entry, chapterIndex) => (
                  <div
                    key={entry.slug}
                    ref={(node) => {
                      if (node) {
                        chapterSectionRefs.current[entry.slug] = node;
                      } else {
                        delete chapterSectionRefs.current[entry.slug];
                      }
                    }}
                  >
                    {chapterIndex > 0 && (
                      <div className="mx-auto max-w-3xl px-4 py-8 text-center">
                        <p className="text-xs uppercase tracking-[0.2em] text-gray-500 mb-2">
                          Next Chapter
                        </p>
                        <p className="text-sm text-gray-300">
                          Chapter {Number(entry.chapter.number)}
                          {entry.chapter.title
                            ? ` — ${entry.chapter.title}`
                            : ""}
                        </p>
                      </div>
                    )}
                    {entry.chapter.images_data.map((src, idx) => (
                      <LazyImage
                        key={`${entry.slug}-${idx}`}
                        src={src}
                        alt={`Page ${idx + 1}`}
                        rootMargin="400px 0px"
                        aspectRatio="2/3"
                      />
                    ))}
                  </div>
                ))}
                {autoLoadNextChapter && (
                  <div className="py-8 text-center text-xs text-gray-600">
                    {loadingNextChapter ? (
                      <div className="flex flex-col items-center gap-3">
                        <LoadingSpinner size="sm" />
                        <span>Loading next chapter...</span>
                      </div>
                    ) : (
                      ""
                    )}
                  </div>
                )}
              </>
            )
          ) : (
            <div className="text-center py-32 text-gray-500">
              No images available for this chapter.
            </div>
          )}
        </div>
      </div>

      {/* ── Comment section (below images, outside click-toggle area) ──────── */}
      <div ref={commentsSectionRef} className="max-w-3xl mx-auto px-4 pb-32">
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
