import clsx from "clsx";
import LazyImage from "./LazyImage";

export default function MangaPagedReader({
  canGoNextSpread,
  canGoPreviousSpread,
  goNextSpread,
  goPreviousSpread,
  mangaSpreadCount,
  spreadIndex,
  visibleSpread,
  totalPages,
}) {
  return (
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
        {visibleSpread.length > 1 ? `-${spreadIndex + visibleSpread.length}` : ""}{" "}
        of {totalPages}
      </div>
    </div>
  );
}
