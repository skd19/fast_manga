import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { useSearch } from "../hooks/useManga";
import MangaCard from "../components/common/MangaCard";
import Pagination from "../components/common/Pagination";
import LoadingSpinner from "../components/common/LoadingSpinner";
import { Search, X } from "lucide-react";

export default function SearchPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [inputValue, setInputValue] = useState(searchParams.get("q") || "");
  const q = searchParams.get("q") || "";
  const page = parseInt(searchParams.get("page") || "1");

  const { data, isLoading, isFetching } = useSearch(q, page);

  // Sync input when URL changes externally (e.g. from Navbar)
  useEffect(() => {
    setInputValue(searchParams.get("q") || "");
  }, [searchParams]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (inputValue.trim()) {
      setSearchParams({ q: inputValue.trim(), page: "1" });
    }
  };

  const clearSearch = () => {
    setInputValue("");
    setSearchParams({});
  };

  return (
    <div>
      <h1 className="text-3xl font-bold mb-6">Search Manga</h1>

      {/* Search box */}
      <form onSubmit={handleSubmit} className="mb-8">
        <div className="relative max-w-xl">
          <Search
            size={18}
            className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500"
          />
          <input
            type="search"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="Search by title or author..."
            className="input pl-11 pr-10 text-base"
            autoFocus
          />
          {inputValue && (
            <button
              type="button"
              onClick={clearSearch}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
            >
              <X size={16} />
            </button>
          )}
        </div>
      </form>

      {/* Results */}
      {!q ? (
        <div className="text-center py-24 text-gray-500">
          <Search size={48} className="mx-auto mb-4 opacity-30" />
          <p>Enter a title or author name to search</p>
        </div>
      ) : isLoading ? (
        <LoadingSpinner size="lg" className="py-24" />
      ) : data?.items?.length === 0 ? (
        <div className="text-center py-24 text-gray-500">
          <p>
            No results found for{" "}
            <strong className="text-gray-300">&quot;{q}&quot;</strong>
          </p>
        </div>
      ) : (
        <>
          <p className="text-sm text-gray-500 mb-4">
            {isFetching ? "Searching..." : `${data.total} results for "${q}"`}
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {data.items.map((manga) => (
              <MangaCard key={manga.id} manga={manga} />
            ))}
          </div>
          <Pagination
            page={data.page}
            totalPages={data.total_pages}
            onPageChange={(p) => setSearchParams({ q, page: String(p) })}
          />
        </>
      )}
    </div>
  );
}
