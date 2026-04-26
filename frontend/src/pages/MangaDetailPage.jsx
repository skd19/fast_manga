import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import CommentSection from "../components/manga/CommentSection";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import {
  useMangaDetail,
  useChapters,
  useMyRating,
  useToggleBookmark,
  useBookmarks,
} from "../hooks/useManga";
import { useAuth } from "../context/AuthContext";
import { mangaApi } from "../api/manga";
import LoadingSpinner from "../components/common/LoadingSpinner";
import ChapterList from "../components/manga/ChapterList";
import StarRating from "../components/common/StarRating";

import {
  BookOpen,
  Bookmark,
  BookmarkCheck,
  Star,
  User,
  Tag,
} from "lucide-react";
import clsx from "clsx";

const STATUS_LABELS = {
  ongoing: { label: "Ongoing", cls: "badge-ongoing" },
  completed: { label: "Completed", cls: "badge-completed" },
  hiatus: { label: "Hiatus", cls: "badge-hiatus" },
  cancelled: { label: "Cancelled", cls: "badge-cancelled" },
};

export default function MangaDetailPage() {
  const { slug } = useParams();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [chapterPage, setChapterPage] = useState(1);
  const [loadedChapters, setLoadedChapters] = useState([]);

  const { data: manga, isLoading, isError } = useMangaDetail(slug);
  const {
    data: chaptersData,
    isLoading: chaptersLoading,
    isFetching: chaptersFetching,
  } = useChapters(slug, {
    page: chapterPage,
    page_size: 100,
  });
  const { data: myRatingData } = useMyRating(user ? slug : null);
  const { data: bookmarks = [] } = useBookmarks(!!user);
  const { add: addBm, remove: removeBm } = useToggleBookmark(slug);

  const isBookmarked = bookmarks.some((b) => b.manga_id === manga?.id);
  const hasMoreChapters =
    chaptersData?.total != null && loadedChapters.length < chaptersData.total;

  useEffect(() => {
    setChapterPage(1);
    setLoadedChapters([]);
  }, [slug]);

  useEffect(() => {
    if (!chaptersData?.items) return;

    setLoadedChapters((current) => {
      if (chaptersData.page === 1) return chaptersData.items;

      const existingIds = new Set(current.map((chapter) => chapter.id));
      const nextItems = chaptersData.items.filter(
        (chapter) => !existingIds.has(chapter.id)
      );
      return [...current, ...nextItems];
    });
  }, [chaptersData]);

  const rateMutation = useMutation({
    mutationFn: (score) => mangaApi.rate(slug, score),
    onSuccess: () => {
      toast.success("Rating saved!");
      qc.invalidateQueries({ queryKey: ["manga", "detail", slug] });
      qc.invalidateQueries({ queryKey: ["rating", slug] });
    },
    onError: () => toast.error("Failed to rate"),
  });

  const toggleBookmark = () => {
    if (!user) {
      toast.error("Login to bookmark");
      return;
    }
    if (isBookmarked) {
      removeBm.mutate(undefined, {
        onSuccess: () => toast.success("Bookmark removed"),
      });
    } else {
      addBm.mutate(undefined, {
        onSuccess: () => toast.success("Bookmarked!"),
      });
    }
  };

  if (isLoading) return <LoadingSpinner size="lg" className="py-32" />;
  if (isError || !manga)
    return (
      <div className="text-center py-32 text-red-400">Manga not found.</div>
    );

  const statusInfo = STATUS_LABELS[manga.status] || {
    label: manga.status,
    cls: "badge bg-gray-700 text-gray-300",
  };

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col md:flex-row gap-8 mb-8">
        {/* Cover */}
        <div className="shrink-0 w-48 md:w-56 mx-auto md:mx-0">
          <div className="aspect-[2/3] rounded-xl overflow-hidden bg-gray-800 shadow-2xl">
            {manga.cover_image ? (
              <img
                src={manga.cover_image}
                alt={manga.title}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-gray-600">
                <BookOpen size={64} />
              </div>
            )}
          </div>
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <h1 className="text-3xl font-bold text-white mb-2">{manga.title}</h1>

          <div className="flex flex-wrap items-center gap-3 mb-4">
            <span className={clsx("badge", statusInfo.cls)}>
              {statusInfo.label}
            </span>
            <div className="flex items-center gap-1 text-yellow-400">
              <Star size={14} fill="currentColor" />
              <span className="text-sm font-medium">
                {manga.average_rating?.toFixed(1)}
              </span>
              <span className="text-gray-500 text-xs">
                ({manga.rating_count})
              </span>
            </div>
          </div>

          {/* Meta */}
          <div className="space-y-2 mb-4 text-sm text-gray-400">
            {manga.author && (
              <div className="flex items-center gap-2">
                <User size={14} />{" "}
                <span>
                  Author: <span className="text-gray-200">{manga.author}</span>
                </span>
              </div>
            )}
            {manga.artist && manga.artist !== manga.author && (
              <div className="flex items-center gap-2">
                <User size={14} />{" "}
                <span>
                  Artist: <span className="text-gray-200">{manga.artist}</span>
                </span>
              </div>
            )}
            {manga.categories?.length > 0 && (
              <div className="flex items-center gap-2 flex-wrap">
                <Tag size={14} />
                {manga.categories.map((cat) => (
                  <Link
                    key={cat.id}
                    to={`/browse?category=${cat.slug}`}
                    className="badge bg-gray-800 text-gray-300 hover:bg-manga-900 hover:text-manga-300 transition-colors"
                  >
                    {cat.name}
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* Description */}
          {manga.description && (
            <p className="text-gray-400 text-sm leading-relaxed mb-4 line-clamp-4">
              {manga.description}
            </p>
          )}

          {/* Actions */}
          <div className="flex flex-wrap gap-3 mb-6">
            {manga.first_chapter && (
              <Link
                to={`/manga/${manga.slug}/chapter/${manga.first_chapter.slug}`}
                className="btn-primary"
              >
                <BookOpen size={16} /> Start Reading
              </Link>
            )}
            {manga.latest_chapter &&
              manga.latest_chapter.id !== manga.first_chapter?.id && (
                <Link
                  to={`/manga/${manga.slug}/chapter/${manga.latest_chapter.slug}`}
                  className="btn-secondary"
                >
                  Latest Chapter
                </Link>
              )}
            <button
              onClick={toggleBookmark}
              className={clsx("btn-ghost", isBookmarked && "text-manga-400")}
            >
              {isBookmarked ? (
                <BookmarkCheck size={18} />
              ) : (
                <Bookmark size={18} />
              )}
              {isBookmarked ? "Bookmarked" : "Bookmark"}
            </button>
          </div>

          {/* Rating */}
          {user && (
            <div className="flex items-center gap-3">
              <span className="text-sm text-gray-500">Your rating:</span>
              <StarRating
                value={myRatingData?.score || 0}
                onChange={(score) => rateMutation.mutate(score)}
              />
            </div>
          )}
        </div>
      </div>

      {/* Chapter List */}
      {(chaptersData || loadedChapters.length > 0) && (
        <div className="mb-8">
          <ChapterList chapters={loadedChapters} mangaSlug={manga.slug} />
          {hasMoreChapters && (
            <div className="flex justify-center mt-4">
              <button
                type="button"
                onClick={() => setChapterPage((page) => page + 1)}
                disabled={chaptersFetching}
                className="btn-secondary"
              >
                {chaptersFetching ? "Loading..." : "Load more"}
              </button>
            </div>
          )}
        </div>
      )}

      {chaptersLoading && loadedChapters.length === 0 && (
        <LoadingSpinner size="sm" className="py-8" />
      )}

      {/* Comments — shown for the latest chapter */}
      {manga.latest_chapter && (
        <div className="card px-4 mb-8">
          <CommentSection
            mangaSlug={manga.slug}
            chapterSlug={manga.latest_chapter.slug}
          />
        </div>
      )}
    </div>
  );
}
