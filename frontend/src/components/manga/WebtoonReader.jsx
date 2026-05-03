import LoadingSpinner from "../common/LoadingSpinner";
import LazyImage from "./LazyImage";

export default function WebtoonReader({ chapter, loadingNextChapter }) {
  const pages = Array.isArray(chapter?.images_data) ? chapter.images_data : [];

  return (
    <>
      {pages.map((src, idx) => (
        <LazyImage
          key={`${chapter.slug}-${idx}`}
          src={src}
          alt={`Page ${idx + 1}`}
          rootMargin="400px 0px"
          aspectRatio="2/3"
        />
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
