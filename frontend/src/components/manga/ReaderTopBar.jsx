import { useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import {
  ChevronLeft,
  ChevronRight,
  Home,
  Maximize,
  Minimize,
  Settings2,
} from "lucide-react";
import clsx from "clsx";

export default function ReaderTopBar({
  autoLoadNextChapter,
  chapter,
  chapterOptions,
  chapterSlug,
  imageWidth,
  isFullscreen,
  mangaSpreadCount,
  mangaSlug,
  nav,
  navigate,
  onAutoLoadNextChapterChange,
  onChapterChange,
  onImageWidthChange,
  onMangaSpreadCountChange,
  onReaderModeChange,
  onToggleFullscreen,
  onToggleReaderSettings,
  readerMode,
  readerModes,
  showControls,
  showReaderSettings,
  widthOptions,
}) {
  const settingsContainerRef = useRef(null);

  useEffect(() => {
    if (!showReaderSettings) return;

    const handlePointerDown = (event) => {
      if (
        settingsContainerRef.current &&
        !settingsContainerRef.current.contains(event.target)
      ) {
        onToggleReaderSettings();
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("touchstart", handlePointerDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("touchstart", handlePointerDown);
    };
  }, [onToggleReaderSettings, showReaderSettings]);

  return (
    <div
      className={clsx(
        "fixed top-0 left-0 right-0 z-50 bg-gray-900/95 backdrop-blur border-b border-gray-800 transition-transform duration-300",
        showControls ? "translate-y-0" : "-translate-y-full",
      )}
    >
      <div className="container mx-auto px-4 max-w-7xl h-14 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <Link to={`/manga/${mangaSlug}`} className="btn-ghost p-2">
            <Home size={18} />
          </Link>
          <span className="text-sm text-gray-400 truncate">
            Chapter {Number(chapter.number)}
            {chapter.title && ` — ${chapter.title}`}
          </span>
        </div>

        <div
          ref={settingsContainerRef}
          className="flex items-center gap-2 shrink-0 relative"
        >
          <select
            value={chapterSlug}
            onChange={(e) => {
              onChapterChange();
              navigate(`/manga/${mangaSlug}/chapter/${e.target.value}`);
            }}
            className="input h-9 w-36 sm:w-48 text-xs py-1"
            title="Select chapter"
          >
            {chapterOptions.map((option) => (
              <option key={option.id} value={option.slug}>
                Ch. {Number(option.number)}
                {option.title ? ` - ${option.title}` : ""}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={onToggleReaderSettings}
            className="btn-ghost p-2"
            title="Reader settings"
          >
            <Settings2 size={18} />
          </button>

          {showReaderSettings && (
            <div
              className="absolute right-24 top-12 w-64 rounded-lg border border-gray-800 bg-gray-900 shadow-xl p-4"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="mb-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">
                  Reader Mode
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {readerModes.map((mode) => (
                    <button
                      key={mode.value}
                      type="button"
                      onClick={() => onReaderModeChange(mode.value)}
                      className={clsx(
                        "rounded px-3 py-2 text-xs transition-colors",
                        readerMode === mode.value
                          ? "bg-manga-600 text-white"
                          : "bg-gray-800 text-gray-400 hover:bg-gray-700",
                      )}
                    >
                      {mode.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">
                  Image Size
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {widthOptions.map((width) => (
                    <button
                      key={width.value}
                      type="button"
                      onClick={() => onImageWidthChange(width.value)}
                      className={clsx(
                        "rounded px-3 py-2 text-xs transition-colors",
                        imageWidth === width.value
                          ? "bg-manga-600 text-white"
                          : "bg-gray-800 text-gray-400 hover:bg-gray-700",
                      )}
                    >
                      {width.label}
                    </button>
                  ))}
                </div>
              </div>

              {readerMode === "side-by-side" && (
                <div className="mt-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">
                    Pages Per View
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    {[1, 2].map((count) => (
                      <button
                        key={count}
                        type="button"
                        onClick={() => onMangaSpreadCountChange(count)}
                        className={clsx(
                          "rounded px-3 py-2 text-xs transition-colors",
                          mangaSpreadCount === count
                            ? "bg-manga-600 text-white"
                            : "bg-gray-800 text-gray-400 hover:bg-gray-700",
                        )}
                      >
                        {count} Page{count > 1 ? "s" : ""}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {readerMode === "webtoon" && (
                <div className="mt-4">
                  <div className="flex items-center justify-between gap-3 rounded bg-gray-800 px-3 py-2">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                        Auto Load Next
                      </p>
                      <p className="text-[11px] text-gray-500 mt-1">
                        Append the next chapter when you reach the bottom.
                      </p>
                    </div>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={autoLoadNextChapter}
                      onClick={() =>
                        onAutoLoadNextChapterChange(!autoLoadNextChapter)
                      }
                      className={clsx(
                        "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-manga-500 focus:ring-offset-2 focus:ring-offset-gray-900",
                        autoLoadNextChapter ? "bg-manga-600" : "bg-gray-700",
                      )}
                    >
                      <span
                        className={clsx(
                          "pointer-events-none absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform",
                          autoLoadNextChapter
                            ? "translate-x-5"
                            : "translate-x-0",
                        )}
                      />
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          <button
            type="button"
            onClick={onToggleFullscreen}
            className="btn-ghost p-2"
            title={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
          >
            {isFullscreen ? <Minimize size={18} /> : <Maximize size={18} />}
          </button>

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
  );
}
