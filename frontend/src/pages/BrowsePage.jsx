import { useSearchParams } from "react-router-dom";
import { useMangaList, useCategories } from "../hooks/useManga";
import MangaCard from "../components/common/MangaCard";
import Pagination from "../components/common/Pagination";
import LoadingSpinner from "../components/common/LoadingSpinner";
import { Filter, SortAsc } from "lucide-react";

const STATUS_OPTIONS = [
  { value: "", label: "All Statuses" },
  { value: "ongoing", label: "Ongoing" },
  { value: "completed", label: "Completed" },
  { value: "hiatus", label: "Hiatus" },
  { value: "cancelled", label: "Cancelled" },
];

const SORT_OPTIONS = [
  { value: "updated_at", label: "Latest Updated" },
  { value: "rating", label: "Top Rated" },
  { value: "title", label: "Title A–Z" },
];

export default function BrowsePage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const page = parseInt(searchParams.get("page") || "1");
  const status = searchParams.get("status") || "";
  const category = searchParams.get("category") || "";
  const sort = searchParams.get("sort") || "updated_at";

  const { data: categoriesData } = useCategories();
  const { data, isLoading, isError } = useMangaList({
    page,
    page_size: 24,
    status,
    category,
    sort,
  });

  const setParam = (key, value) => {
    const next = new URLSearchParams(searchParams);
    if (value) next.set(key, value);
    else next.delete(key);
    if (key !== "page") next.set("page", "1");
    setSearchParams(next);
  };

  return (
    <div>
      <h1 className="text-3xl font-bold mb-6">Browse Manga</h1>

      {/* Filters */}
      <div className="card p-4 mb-6 flex flex-wrap gap-4 items-center">
        <div className="flex items-center gap-2 text-gray-400">
          <Filter size={16} /> Filters:
        </div>

        <select
          value={status}
          onChange={(e) => setParam("status", e.target.value)}
          className="input w-auto text-sm"
        >
          {STATUS_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>

        <select
          value={category}
          onChange={(e) => setParam("category", e.target.value)}
          className="input w-auto text-sm"
        >
          <option value="">All Categories</option>
          {categoriesData?.map((c) => (
            <option key={c.id} value={c.slug}>
              {c.name}
            </option>
          ))}
        </select>

        <div className="flex items-center gap-2 ml-auto">
          <SortAsc size={16} className="text-gray-400" />
          <select
            value={sort}
            onChange={(e) => setParam("sort", e.target.value)}
            className="input w-auto text-sm"
          >
            {SORT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Results */}
      {isLoading ? (
        <LoadingSpinner size="lg" className="py-24" />
      ) : isError ? (
        <div className="text-center py-24 text-red-400">
          Failed to load manga. Please try again.
        </div>
      ) : (
        <>
          <p className="text-sm text-gray-500 mb-4">{data.total} results</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {data.items.map((manga) => (
              <MangaCard key={manga.id} manga={manga} />
            ))}
          </div>
          <Pagination
            page={data.page}
            totalPages={data.total_pages}
            onPageChange={(p) => setParam("page", String(p))}
          />
        </>
      )}
    </div>
  );
}
