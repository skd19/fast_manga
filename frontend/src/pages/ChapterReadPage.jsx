import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useChapter, useChapterNav } from "../hooks/useManga";
import { useAuth } from "../context/AuthContext";
import toast from "react-hot-toast";
import { mangaApi } from "../api/manga";
import LoadingSpinner from "../components/common/LoadingSpinner";
import MangaPagedReader from "../components/manga/MangaPagedReader";
import ReaderCommentsPanel from "../components/manga/ReaderCommentsPanel";
import ReaderTopBar from "../components/manga/ReaderTopBar";
import WebtoonReader from "../components/manga/WebtoonReader";
import { ChevronLeft, ChevronRight, ArrowUp } from "lucide-react";
import clsx from "clsx";

const WIDTH_OPTIONS = [
  { value: "max-w-xl", label: "Narrow" },
  { value: "max-w-3xl", label: "Medium" },
  { value: "max-w-5xl", label: "Wide" },
  { value: "max-w-full", label: "Full" },
];

const READER_MODES = [
  { value: "webtoon", label: "Webtoon" },
  { value: "side-by-side", label: "Manga" },
];

const NEXT_CHAPTER_TOAST_ID = "reader-next-chapter";

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
  const autoLoadTimeoutRef = useRef(null);
  const autoLoadToastIdRef = useRef(null);
  const autoLoadRequestIdRef = useRef(0);
  const readerModeRef = useRef(readerMode);
  const autoLoadNextChapterRef = useRef(autoLoadNextChapter);
  const loadingNextChapterRef = useRef(loadingNextChapter);
  const loadedChapterEntriesRef = useRef(loadedChapterEntries);

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
    readerModeRef.current = readerMode;
  }, [readerMode]);

  useEffect(() => {
    localStorage.setItem(
      "autoLoadNextChapter",
      autoLoadNextChapter ? "true" : "false",
    );
  }, [autoLoadNextChapter]);

  useEffect(() => {
    autoLoadNextChapterRef.current = autoLoadNextChapter;
  }, [autoLoadNextChapter]);

  useEffect(() => {
    localStorage.setItem("mangaSpreadCount", String(mangaSpreadCount));
  }, [mangaSpreadCount]);

  useEffect(() => {
    loadingNextChapterRef.current = loadingNextChapter;
  }, [loadingNextChapter]);

  useEffect(() => {
    loadedChapterEntriesRef.current = loadedChapterEntries;
  }, [loadedChapterEntries]);

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

  const cancelAutoLoadNextChapter = useCallback(() => {
    autoLoadRequestIdRef.current += 1;

    if (autoLoadTimeoutRef.current) {
      window.clearTimeout(autoLoadTimeoutRef.current);
      autoLoadTimeoutRef.current = null;
    }

    if (autoLoadToastIdRef.current) {
      toast.dismiss(autoLoadToastIdRef.current);
      autoLoadToastIdRef.current = null;
    }

    loadingNextChapterRef.current = false;
    setLoadingNextChapter(false);
  }, []);

  const startAutoLoadNextChapter = useCallback(() => {
    if (
      readerModeRef.current !== "webtoon" ||
      !autoLoadNextChapterRef.current ||
      loadingNextChapterRef.current ||
      autoLoadTimeoutRef.current ||
      loadedChapterEntriesRef.current.length === 0
    ) {
      return;
    }

    const currentEntry =
      loadedChapterEntriesRef.current[loadedChapterEntriesRef.current.length - 1];
    const nextSlug = currentEntry.nav?.next?.slug;
    if (
      !nextSlug ||
      loadedChapterEntriesRef.current.some((entry) => entry.slug === nextSlug)
    ) {
      return;
    }

    const requestId = autoLoadRequestIdRef.current + 1;
    autoLoadRequestIdRef.current = requestId;
    loadingNextChapterRef.current = true;
    setLoadingNextChapter(true);
    autoLoadToastIdRef.current = toast.loading("Loading next chapter...", {
      id: NEXT_CHAPTER_TOAST_ID,
    });

    autoLoadTimeoutRef.current = window.setTimeout(async () => {
      autoLoadTimeoutRef.current = null;

      try {
        const nextEntry = await loadChapterBundle(nextSlug);
        if (autoLoadRequestIdRef.current !== requestId) {
          return;
        }

        pendingSnapChapterSlugRef.current = nextSlug;
        setLoadedChapterEntries([nextEntry]);
        autoNavigatingRef.current = true;
        navigate(`/manga/${mangaSlug}/chapter/${nextSlug}`, { replace: true });

        if (autoLoadToastIdRef.current) {
          toast.dismiss(autoLoadToastIdRef.current);
          autoLoadToastIdRef.current = null;
        }
      } catch {
        if (autoLoadRequestIdRef.current === requestId) {
          toast.error("Failed to load next chapter", {
            id: autoLoadToastIdRef.current ?? NEXT_CHAPTER_TOAST_ID,
          });
          autoLoadToastIdRef.current = null;
        }
      } finally {
        if (autoLoadRequestIdRef.current === requestId) {
          loadingNextChapterRef.current = false;
          setLoadingNextChapter(false);
        }
      }
    }, 4000);
  }, [loadChapterBundle, mangaSlug, navigate]);

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
          startAutoLoadNextChapter();
        } else {
          cancelAutoLoadNextChapter();
        }
      },
      { threshold: 0.2 },
    );

    observer.observe(commentsSectionRef.current);
    return () => {
      observer.disconnect();
      cancelAutoLoadNextChapter();
    };
  }, [
    autoLoadNextChapter,
    cancelAutoLoadNextChapter,
    readerMode,
    startAutoLoadNextChapter,
  ]);

  useEffect(
    () => () => {
      cancelAutoLoadNextChapter();
    },
    [cancelAutoLoadNextChapter],
  );

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
        readerModes={READER_MODES}
        showControls={showControls}
        showReaderSettings={showReaderSettings}
        widthOptions={WIDTH_OPTIONS}
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
              <MangaPagedReader
                canGoNextSpread={canGoNextSpread}
                canGoPreviousSpread={canGoPreviousSpread}
                goNextSpread={goNextSpread}
                goPreviousSpread={goPreviousSpread}
                mangaSpreadCount={mangaSpreadCount}
                spreadIndex={spreadIndex}
                totalPages={pages.length}
                visibleSpread={visibleSpread}
              />
            ) : (
              <WebtoonReader
                chapterSectionRefs={chapterSectionRefs}
                loadedChapterEntries={loadedChapterEntries}
                loadingNextChapter={autoLoadNextChapter && loadingNextChapter}
              />
            )
          ) : (
            <div className="text-center py-32 text-gray-500">
              No images available for this chapter.
            </div>
          )}
        </div>
      </div>

      {/* ── Comment section (below images, outside click-toggle area) ──────── */}
      <ReaderCommentsPanel
        activeEntry={activeEntry}
        chapterSlug={chapterSlug}
        commentsSectionRef={commentsSectionRef}
        mangaSlug={mangaSlug}
        onToggleComments={() => setShowComments((value) => !value)}
        readerMode={readerMode}
        showComments={showComments}
      />

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
