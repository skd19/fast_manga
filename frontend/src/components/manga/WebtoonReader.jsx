import LoadingSpinner from "../common/LoadingSpinner";
import LazyImage from "./LazyImage";

export default function WebtoonReader({
  chapterSectionRefs,
  loadedChapterEntries,
  loadingNextChapter,
}) {
  return (
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
                {entry.chapter.title ? ` — ${entry.chapter.title}` : ""}
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

      <div className="py-8 text-center text-xs text-gray-600">
        {loadingNextChapter ? (
          <div className="flex flex-col items-center gap-3">
            <LoadingSpinner size="sm" />
            <span>Loading next chapter...</span>
          </div>
        ) : null}
      </div>
    </>
  );
}
