import { useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Edit, ExternalLink, Search, Trash2 } from "lucide-react";
import toast from "react-hot-toast";
import { mangaApi } from "../../api/manga";
import LoadingSpinner from "../../components/common/LoadingSpinner";
import Pagination from "../../components/common/Pagination";

const PAGE_SIZE = 20;

export default function MangaManagePage() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [query, setQuery] = useState("");
  const [submittedQuery, setSubmittedQuery] = useState("");

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ["staff-manga-manage", submittedQuery, page],
    queryFn: () => {
      const params = { page, page_size: PAGE_SIZE };
      if (submittedQuery) return mangaApi.search({ ...params, q: submittedQuery }).then((r) => r.data);
      return mangaApi.list({ ...params, sort: "updated_at" }).then((r) => r.data);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (mangaId) => mangaApi.deleteManga(mangaId),
    onSuccess: () => {
      toast.success("Manga deleted");
      qc.invalidateQueries({ queryKey: ["staff-manga-manage"] });
      qc.invalidateQueries({ queryKey: ["manga", "list"] });
    },
    onError: (e) => toast.error(e.response?.data?.detail || "Failed to delete"),
  });

  const handleSearch = (e) => {
    e.preventDefault();
    setSubmittedQuery(query.trim());
    setPage(1);
  };

  const handleDelete = (manga) => {
    if (!window.confirm(`Delete "${manga.title}" and all chapters?`)) return;
    deleteMutation.mutate(manga.id);
  };

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-bold">Manga Management</h1>
          <p className="text-sm text-gray-500 mt-1">Edit metadata, covers, sources, and categories.</p>
        </div>
        <Link to="/staff/scrapers" className="btn-secondary text-sm">
          Scraper Dashboard
        </Link>
      </div>

      <form onSubmit={handleSearch} className="card p-4 mb-6">
        <div className="relative max-w-xl">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search manga by title or author"
            className="input pl-9 pr-24 text-sm"
          />
          <button type="submit" className="btn-primary absolute right-1 top-1/2 -translate-y-1/2 h-8 px-3 text-xs">
            Search
          </button>
        </div>
      </form>

      <div className="card overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-gray-800">
          <p className="text-sm text-gray-500">
            {isFetching ? "Loading..." : `${data?.total || 0} manga`}
          </p>
          {submittedQuery && (
            <button
              onClick={() => {
                setQuery("");
                setSubmittedQuery("");
                setPage(1);
              }}
              className="text-xs text-manga-400 hover:text-manga-300"
            >
              Clear search
            </button>
          )}
        </div>

        {isLoading ? (
          <LoadingSpinner className="py-12" />
        ) : data?.items?.length ? (
          <div className="divide-y divide-gray-800">
            {data.items.map((manga) => (
              <div key={manga.id} className="flex items-center gap-4 p-4">
                <div className="w-12 h-16 rounded bg-gray-800 overflow-hidden shrink-0">
                  {manga.cover_image && (
                    <img src={manga.cover_image} alt={manga.title} className="w-full h-full object-cover" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-sm truncate">{manga.title}</p>
                  <p className="text-xs text-gray-500 mt-1">
                    {manga.status} · {manga.latest_chapter ? `Latest Ch. ${Number(manga.latest_chapter.number)}` : "No chapters"}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Link to={`/manga/${manga.slug}`} className="btn-ghost p-2" title="View manga">
                    <ExternalLink size={16} />
                  </Link>
                  <Link to={`/staff/manga/${manga.id}/edit`} className="btn-ghost p-2 text-manga-400" title="Edit manga">
                    <Edit size={16} />
                  </Link>
                  <button
                    onClick={() => handleDelete(manga)}
                    disabled={deleteMutation.isPending}
                    className="btn-ghost p-2 text-red-400 hover:text-red-300"
                    title="Delete manga"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-center py-12 text-gray-500">No manga found.</p>
        )}
      </div>

      <Pagination page={page} totalPages={data?.total_pages || 1} onPageChange={setPage} />
    </div>
  );
}
