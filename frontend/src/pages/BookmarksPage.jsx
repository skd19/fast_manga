import { useAuth } from "../context/AuthContext";
import { useBookmarks } from "../hooks/useManga";
import LoadingSpinner from "../components/common/LoadingSpinner";
import { Bookmark } from "lucide-react";

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
            <BookmarkedMangaCard key={bm.id} mangaId={bm.manga_id} />
          ))}
        </div>
      )}
    </div>
  );
}

function BookmarkedMangaCard({ mangaId }) {
  return (
    <div className="card p-4 flex flex-col items-center justify-center gap-2 min-h-[120px]">
      <Bookmark size={24} className="text-manga-400" />
      <p className="text-xs text-gray-500">Manga #{mangaId}</p>
    </div>
  );
}
