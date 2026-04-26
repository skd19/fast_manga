import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useBookmarks } from "../hooks/useManga";
import LoadingSpinner from "../components/common/LoadingSpinner";
import { Bookmark, BookOpen } from "lucide-react";
import { formatDistanceToNow } from "../components/common/timeUtils";

export default function BookmarksPage() {
  const { user } = useAuth();
  const { data: bookmarks = [], isLoading } = useBookmarks(!!user);

  if (isLoading) return <LoadingSpinner size="lg" className="py-32" />;

  return (
    <div>
      <h1 className="flex items-center gap-2 text-3xl font-bold mb-8">
        <Bookmark className="text-manga-400" /> My Bookmarks
      </h1>

      {bookmarks.length === 0 ? (
        <div className="text-center py-32 text-gray-500">
          <Bookmark size={48} className="mx-auto mb-4 opacity-30" />
          <p>No bookmarks yet. Start reading and save your favorite manga!</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {bookmarks.map((bm) => (
            <BookmarkedMangaCard key={bm.id} bookmark={bm} />
          ))}
        </div>
      )}
    </div>
  );
}

function BookmarkedMangaCard({ bookmark }) {
  return (
    <Link
      to={bookmark.manga_slug ? `/manga/${bookmark.manga_slug}` : "/bookmarks"}
      className="card overflow-hidden hover:border-manga-700 transition-all duration-200 hover:-translate-y-1"
    >
      <div className="aspect-[2/3] bg-gray-800 flex items-center justify-center overflow-hidden">
        {bookmark.manga_cover_image ? (
          <img
            src={bookmark.manga_cover_image}
            alt={bookmark.manga_title || `Manga #${bookmark.manga_id}`}
            className="w-full h-full object-cover"
          />
        ) : (
          <BookOpen size={36} className="text-gray-600" />
        )}
      </div>
      <div className="p-3">
        <p className="text-sm font-medium text-gray-100 line-clamp-2">
          {bookmark.manga_title || `Manga #${bookmark.manga_id}`}
        </p>
        <p className="text-xs text-gray-500 mt-2">
          Bookmarked {formatDistanceToNow(bookmark.created_at)}
        </p>
      </div>
    </Link>
  );
}
