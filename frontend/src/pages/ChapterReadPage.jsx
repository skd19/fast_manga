import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { ArrowUp, ChevronLeft, ChevronRight } from "lucide-react";
import clsx from "clsx";
import { mangaApi } from "../api/manga";
import LoadingSpinner from "../components/common/LoadingSpinner";
import MangaPagedReader from "../components/manga/MangaPagedReader";
import ReaderCommentsPanel from "../components/manga/ReaderCommentsPanel";
import ReaderTopBar from "../components/manga/ReaderTopBar";
import WebtoonReader from "../components/manga/WebtoonReader";
import { useAuth } from "../context/AuthContext";
import { useChapter, useChapterNav } from "../hooks/useManga";

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
const AUTO_LOAD_DELAY = 4000;

const readStoredBoolean = (key, fallback = false) => {
  const value = localStorage.getItem(key);
  if (value === null) return fallback;
  return value === "true";
};

export default function ChapterReadPage() {
  const { mangaSlug, chapterSlug } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const { data: chapter, isLoading, isError } = useChapter(
    mangaSlug,
    chapterSlug,
  );
  const { data: nav } = useChapterNav(mangaSlug, chapterSlug);
  const { data: chapterOptions = [] } = useChapterOptions(mangaSlug);

  const [imageWidth, setImageWidth] = useState("max-w-3xl");
  const [readerMode, setReaderMode] = useState(
    () => localStorage.getItem("readerMode") || "webtoon",
  );
  const [autoLoadNextChapter, setAutoLoadNextChapter] = useState(() =>
    readStoredBoolean("autoLoadNextChapter"),
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
  const [loadingNextChapter, setLoadingNextChapter] = useState(false);
  const [autoLoadTriggerVisible, setAutoLoadTriggerVisible] = useState(false);

  const autoLoadTriggerRef = useRef(null);
  const autoLoadTimerRef = useRef(null);
  const autoLoadNextSlugRef = useRef(null);
  const loadingNextChapterRef = useRef(false);

  const pages = useMemo(
    () => (Array.isArray(chapter?.images_data) ? chapter.images_data : []),
    [chapter],
  );
  const mangaPageStep = mangaSpreadCount;
  const visibleSpread = pages.slice(spreadIndex, spreadIndex + mangaPageStep);
  const canGoPreviousSpread = readerMode === "side-by-side" && spreadIndex > 0;
  const canGoNextSpread =
    readerMode === "side-by-side" && spreadIndex + mangaPageStep < pages.length;

  const nextChapterPath = nav?.next
    ? `/manga/${mangaSlug}/chapter/${nav.next.slug}`
    : "";
  const previousChapterPath = nav?.prev
    ? `/manga/${mangaSlug}/chapter/${nav.prev.slug}`
    : "";

  const cancelAutoLoad = useCallback(() => {
    if (autoLoadTimerRef.current) {
      window.clearTimeout(autoLoadTimerRef.current);
      autoLoadTimerRef.current = null;
    }

    autoLoadNextSlugRef.current = null;
    loadingNextChapterRef.current = false;
    setLoadingNextChapter(false);
    toast.dismiss(NEXT_CHAPTER_TOAST_ID);
  }, []);

  const scrollTop = useCallback((behavior = "smooth") => {
    window.scrollTo({ top: 0, behavior });
  }, []);

  const goPreviousSpread = useCallback(() => {
    setSpreadIndex((current) => Math.max(0, current - mangaPageStep));
  }, [mangaPageStep]);

  const goNextSpread = useCallback(() => {
    setSpreadIndex((current) =>
      Math.min(Math.max(pages.length - 1, 0), current + mangaPageStep),
    );
  }, [mangaPageStep, pages.length]);

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

  useEffect(() => {
    if (chapter && user) {
      mangaApi.markChapterRead(mangaSlug, chapterSlug).catch(() => {});
    }
  }, [chapter, chapterSlug, mangaSlug, user]);

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

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () =>
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  useEffect(() => {
    setSpreadIndex(0);
    setShowReaderSettings(false);
    setAutoLoadTriggerVisible(false);
    cancelAutoLoad();
    scrollTop("auto");
  }, [cancelAutoLoad, chapterSlug, scrollTop]);

  useEffect(() => {
    setSpreadIndex((current) =>
      Math.min(current, Math.max(pages.length - mangaPageStep, 0)),
    );
  }, [mangaPageStep, pages.length]);

  useEffect(() => {
    if (readerMode !== "webtoon" || !autoLoadNextChapter || !nav?.next) {
      setAutoLoadTriggerVisible(false);
      return;
    }

    let frameId = 0;
    const updateTriggerVisibility = () => {
      if (frameId) return;

      frameId = window.requestAnimationFrame(() => {
        frameId = 0;
        const trigger = autoLoadTriggerRef.current;
        if (!trigger) {
          setAutoLoadTriggerVisible(false);
          return;
        }

        const rect = trigger.getBoundingClientRect();
        const viewportHeight =
          window.innerHeight || document.documentElement.clientHeight;
        const isVisible =
          rect.top <= viewportHeight * 0.85 && rect.bottom >= 0;
        setAutoLoadTriggerVisible(isVisible);
      });
    };

    updateTriggerVisibility();
    window.addEventListener("scroll", updateTriggerVisibility, {
      passive: true,
    });
    window.addEventListener("resize", updateTriggerVisibility);

    return () => {
      if (frameId) window.cancelAnimationFrame(frameId);
      window.removeEventListener("scroll", updateTriggerVisibility);
      window.removeEventListener("resize", updateTriggerVisibility);
      setAutoLoadTriggerVisible(false);
    };
  }, [autoLoadNextChapter, chapterSlug, nav?.next, readerMode]);

  useEffect(() => {
    if (
      readerMode !== "webtoon" ||
      !autoLoadNextChapter ||
      !autoLoadTriggerVisible ||
      !nav?.next
    ) {
      cancelAutoLoad();
      return;
    }

    if (
      loadingNextChapterRef.current ||
      autoLoadTimerRef.current ||
      autoLoadNextSlugRef.current === nav.next.slug
    ) {
      return;
    }

    autoLoadNextSlugRef.current = nav.next.slug;
    loadingNextChapterRef.current = true;
    setLoadingNextChapter(true);
    toast.loading("Loading next chapter...", { id: NEXT_CHAPTER_TOAST_ID });

    autoLoadTimerRef.current = window.setTimeout(() => {
      const targetSlug = autoLoadNextSlugRef.current;
      autoLoadTimerRef.current = null;
      autoLoadNextSlugRef.current = null;
      loadingNextChapterRef.current = false;
      setLoadingNextChapter(false);
      toast.dismiss(NEXT_CHAPTER_TOAST_ID);

      if (targetSlug) {
        navigate(`/manga/${mangaSlug}/chapter/${targetSlug}`, {
          replace: true,
        });
      }
    }, AUTO_LOAD_DELAY);
  }, [
    autoLoadNextChapter,
    autoLoadTriggerVisible,
    cancelAutoLoad,
    mangaSlug,
    nav?.next,
    navigate,
    readerMode,
  ]);

  useEffect(() => cancelAutoLoad, [cancelAutoLoad]);

  useEffect(() => {
    const handler = (event) => {
      if (readerMode === "side-by-side") {
        if (event.key === "ArrowLeft") {
          if (canGoPreviousSpread) {
            goPreviousSpread();
          } else if (previousChapterPath) {
            navigate(previousChapterPath);
          }
        } else if (event.key === "ArrowRight") {
          if (canGoNextSpread) {
            goNextSpread();
          } else if (nextChapterPath) {
            navigate(nextChapterPath);
          }
        }
        return;
      }

      if (event.key === "ArrowLeft" && previousChapterPath) {
        navigate(previousChapterPath);
      } else if (event.key === "ArrowRight" && nextChapterPath) {
        navigate(nextChapterPath);
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [
    canGoNextSpread,
    canGoPreviousSpread,
    goNextSpread,
    goPreviousSpread,
    navigate,
    nextChapterPath,
    previousChapterPath,
    readerMode,
  ]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (isError || !chapter) {
    return (
      <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center text-red-400 gap-4">
        <p>Chapter not found.</p>
        <Link to={`/manga/${mangaSlug}`} className="btn-secondary">
          Back to Manga
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950">
      <ReaderTopBar
        autoLoadNextChapter={autoLoadNextChapter}
        chapter={chapter}
        chapterOptions={chapterOptions}
        chapterSlug={chapterSlug}
        imageWidth={imageWidth}
        isFullscreen={isFullscreen}
        mangaSlug={mangaSlug}
        nav={nav}
        navigate={navigate}
        onAutoLoadNextChapterChange={setAutoLoadNextChapter}
        onChapterChange={() => scrollTop("auto")}
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

      <main
        className="pt-14 pb-28 cursor-pointer select-none"
        onClick={() => setShowControls((value) => !value)}
      >
        <div
          className={clsx(
            "mx-auto",
            readerMode === "side-by-side"
              ? "max-w-7xl px-2 md:px-4"
              : imageWidth,
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
                chapter={chapter}
                loadingNextChapter={autoLoadNextChapter && loadingNextChapter}
              />
            )
          ) : (
            <div className="text-center py-32 text-gray-500">
              No images available for this chapter.
            </div>
          )}
        </div>
      </main>

      {readerMode === "webtoon" && nav?.next && (
        <div
          key={`${chapterSlug}-auto-load-trigger`}
          ref={autoLoadTriggerRef}
          className="h-px w-full"
          aria-hidden="true"
        />
      )}

      <ReaderCommentsPanel
        activeEntry={{ chapter, nav }}
        chapterSlug={chapterSlug}
        mangaSlug={mangaSlug}
        onToggleComments={() => setShowComments((value) => !value)}
        readerMode={readerMode}
        showComments={showComments}
      />

      <BottomReaderBar
        mangaSlug={mangaSlug}
        nav={nav}
        onScrollTop={scrollTop}
        showControls={showControls}
      />
    </div>
  );
}

function useChapterOptions(mangaSlug) {
  return useQuery({
    queryKey: ["reader-chapter-selector", mangaSlug],
    queryFn: async () => {
      const first = await mangaApi
        .chapters(mangaSlug, { page: 1, page_size: 200 })
        .then((response) => response.data);
      if (first.total_pages <= 1) return first.items;

      const rest = await Promise.all(
        Array.from({ length: first.total_pages - 1 }, (_, idx) => idx + 2).map(
          (page) =>
            mangaApi
              .chapters(mangaSlug, { page, page_size: 200 })
              .then((response) => response.data.items),
        ),
      );

      return [...first.items, ...rest.flat()];
    },
    enabled: !!mangaSlug,
  });
}

function BottomReaderBar({ mangaSlug, nav, onScrollTop, showControls }) {
  return (
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

        <button onClick={onScrollTop} className="btn-ghost text-sm">
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
  );
}
