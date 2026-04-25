import { Link } from "react-router-dom";
import { useMangaList, useHistory } from "../hooks/useManga";
import MangaCard from "../components/common/MangaCard";
import LoadingSpinner from "../components/common/LoadingSpinner";
import { useAuth } from "../context/AuthContext";
import { TrendingUp, Clock, BookOpen, ArrowRight } from "lucide-react";

function Section({ title, icon: Icon, children, linkTo }) {
  return (
    <section className="mb-12">
      <div className="flex items-center justify-between mb-4">
        <h2 className="flex items-center gap-2 text-xl font-bold">
          <Icon size={20} className="text-manga-400" />
          {title}
        </h2>
        {linkTo && (
          <Link
            to={linkTo}
            className="flex items-center gap-1 text-sm text-manga-400 hover:text-manga-300 transition-colors"
          >
            View all <ArrowRight size={14} />
          </Link>
        )}
      </div>
      {children}
    </section>
  );
}

export default function HomePage() {
  const { user } = useAuth();

  const { data: latestData, isLoading: latestLoading } = useMangaList({
    sort: "updated_at",
    page: 1,
    page_size: 12,
  });

  const { data: topRatedData, isLoading: topLoading } = useMangaList({
    sort: "rating",
    page: 1,
    page_size: 6,
  });

  const { data: historyData } = useHistory(!!user);

  return (
    <div>
      {/* Hero */}
      <div className="relative rounded-2xl overflow-hidden bg-gradient-to-r from-manga-950 via-gray-900 to-gray-950 border border-manga-900 p-8 mb-12">
        <div className="max-w-2xl">
          <h1 className="text-4xl font-bold text-white mb-4">
            Read Manga <span className="text-manga-400">Free</span> Online
          </h1>
          <p className="text-gray-400 text-lg mb-6">
            Thousands of manga titles. Updated daily. No registration required
            to start reading.
          </p>
          <div className="flex gap-3">
            <Link to="/browse" className="btn-primary">
              <BookOpen size={18} /> Browse Manga
            </Link>
            <Link to="/search" className="btn-secondary">
              Explore
            </Link>
          </div>
        </div>
      </div>

      {/* Continue Reading (if user has history) */}
      {user && historyData?.length > 0 && (
        <Section title="Continue Reading" icon={Clock} linkTo="/profile">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {historyData.slice(0, 6).map((h) => (
              <div
                key={h.id}
                className="card p-3 hover:border-manga-700 transition-colors"
              >
                <p className="text-xs text-gray-400 truncate">
                  Manga #{h.manga_id}
                </p>
                <p className="text-xs text-manga-400 mt-1">
                  {h.last_read_chapter_id
                    ? `Ch. ${h.last_read_chapter_id}`
                    : "Not started"}
                </p>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* Latest Updated */}
      <Section title="Latest Updated" icon={Clock} linkTo="/browse">
        {latestLoading ? (
          <LoadingSpinner size="lg" className="py-12" />
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {latestData?.items?.map((manga) => (
              <MangaCard key={manga.id} manga={manga} />
            ))}
          </div>
        )}
      </Section>

      {/* Top Rated */}
      <Section title="Top Rated" icon={TrendingUp} linkTo="/browse?sort=rating">
        {topLoading ? (
          <LoadingSpinner size="lg" className="py-12" />
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-4">
            {topRatedData?.items?.map((manga) => (
              <MangaCard key={manga.id} manga={manga} />
            ))}
          </div>
        )}
      </Section>
    </div>
  );
}
