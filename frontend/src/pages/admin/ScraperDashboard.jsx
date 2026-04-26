import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { mangaApi } from "../../api/manga";
import LoadingSpinner from "../../components/common/LoadingSpinner";
import Pagination from "../../components/common/Pagination";
import toast from "react-hot-toast";
import {
  Shield,
  Plus,
  Play,
  RefreshCw,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  CheckCircle,
} from "lucide-react";

const SCRAPER_OPTIONS = [
  { value: "mangabuddy", label: "MangaBuddy" },
  { value: "manhuafast", label: "ManhuaFast" },
  { value: "toonclash", label: "ToonClash" },
  { value: "weebcentral", label: "WeebCentral" },
];

function AddMangaForm({ onSuccess }) {
  const [form, setForm] = useState({
    manga_url: "",
    scraper_name: "mangabuddy",
    anilist_id: "",
  });
  const mutation = useMutation({
    mutationFn: (payload) => mangaApi.scraperAddManga(payload),
    onSuccess: (response) => {
      toast.success("Scrape task queued!");
      setForm((current) => ({
        ...current,
        manga_url: "",
        anilist_id: "",
      }));
      onSuccess?.(response.data?.manga);
    },
    onError: (e) => toast.error(e.response?.data?.detail || "Failed"),
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    const payload = {
      manga_url: form.manga_url,
      scraper_name: form.scraper_name,
      ...(form.anilist_id ? { anilist_id: parseInt(form.anilist_id, 10) } : {}),
    };
    mutation.mutate(payload);
  };

  return (
    <form onSubmit={handleSubmit} className="card p-4 mb-6 flex flex-col gap-3">
      <div className="flex flex-col sm:flex-row gap-3">
        <input
          value={form.manga_url}
          onChange={(e) => setForm({ ...form, manga_url: e.target.value })}
          className="input flex-1 text-sm"
          placeholder="https://mangabuddy.com/manga-slug"
          required
        />
        <select
          value={form.scraper_name}
          onChange={(e) => setForm({ ...form, scraper_name: e.target.value })}
          className="input w-40 text-sm"
        >
          {SCRAPER_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>
      <div className="flex flex-col sm:flex-row gap-3 items-center">
        <div className="flex-1 flex items-center gap-2">
          <input
            type="number"
            value={form.anilist_id}
            onChange={(e) => setForm({ ...form, anilist_id: e.target.value })}
            className="input w-48 text-sm"
            placeholder="AniList ID"
            min="1"
            required
          />
          <span className="text-xs text-gray-500 md:whitespace-nowrap">
            Creates manga from AniList metadata if it is not in DB
          </span>
        </div>
        <button
          type="submit"
          disabled={mutation.isPending}
          className="btn-primary whitespace-nowrap"
        >
          <Plus size={16} /> Add Manga
        </button>
      </div>
    </form>
  );
}

function MangaRow({ manga }) {
  const [expanded, setExpanded] = useState(false);
  const qc = useQueryClient();

  const { data: rows, isLoading: rowsLoading } = useQuery({
    queryKey: ["scraper-rows", manga.id],
    queryFn: () => mangaApi.scraperMangaRows(manga.id).then((r) => r.data),
    enabled: expanded,
  });

  const startMutation = useMutation({
    mutationFn: () => mangaApi.scraperStart(manga.id),
    onSuccess: () => toast.success(`Scrape started for ${manga.title}`),
    onError: (e) => toast.error(e.response?.data?.detail || "Failed to start"),
  });

  const retryMutation = useMutation({
    mutationFn: () => mangaApi.scraperRetry(manga.id),
    onSuccess: () => {
      toast.success("Retry tasks queued");
      qc.invalidateQueries({ queryKey: ["scraper-rows", manga.id] });
    },
    onError: (e) => toast.error(e.response?.data?.detail || "Failed to retry"),
  });

  return (
    <div className="card mb-2 overflow-hidden">
      <div className="flex items-center justify-between p-4">
        <div className="flex-1 min-w-0">
          <p className="font-medium text-sm truncate">{manga.title}</p>
          <p className="text-xs text-gray-500 mt-0.5">
            {manga.status} •{" "}
            {manga.latest_chapter
              ? `Latest: Ch. ${Number(manga.latest_chapter.number)}`
              : "No chapters"}
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0 ml-4">
          <button
            onClick={() => startMutation.mutate()}
            disabled={startMutation.isPending}
            className="btn-ghost p-2 text-green-400 hover:text-green-300"
            title="Start scrape"
          >
            <Play size={16} />
          </button>
          <button
            onClick={() => retryMutation.mutate()}
            disabled={retryMutation.isPending}
            className="btn-ghost p-2 text-yellow-400 hover:text-yellow-300"
            title="Retry errors"
          >
            <RefreshCw size={16} />
          </button>
          <button
            onClick={() => setExpanded((v) => !v)}
            className="btn-ghost p-2"
            title="Show rows"
          >
            {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-gray-800 p-4 bg-gray-950/50">
          {rowsLoading ? (
            <LoadingSpinner size="sm" className="py-4" />
          ) : (
            <>
              {/* Chapters */}
              {rows?.chapters?.length > 0 && (
                <div className="mb-4">
                  <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">
                    Chapters ({rows.chapters.length})
                  </h4>
                  <div className="max-h-40 overflow-y-auto space-y-1">
                    {rows.chapters.map((ch) => (
                      <div
                        key={ch.id}
                        className="flex items-center justify-between text-xs py-1"
                      >
                        <span className="text-gray-300">
                          Ch. {Number(ch.number)} {ch.title}
                        </span>
                        <span className="text-gray-600">
                          {ch.image_count} images
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Errors */}
              {rows?.errors?.length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold text-red-500 uppercase mb-2">
                    Errors ({rows.errors.length})
                  </h4>
                  <div className="space-y-2">
                    {rows.errors.map((err) => (
                      <div
                        key={err.id}
                        className="bg-red-950/30 border border-red-900/50 rounded p-2 text-xs"
                      >
                        <p className="text-red-300 truncate">
                          {err.chapter_url}
                        </p>
                        <p className="text-red-400 mt-1">{err.error_message}</p>
                        <p className="text-gray-600 mt-1">
                          Retries: {err.retry_count}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {rows?.chapters?.length === 0 && rows?.errors?.length === 0 && (
                <p className="text-xs text-gray-500 text-center py-4">
                  No data yet
                </p>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

function ErrorsTab() {
  const { data: errors = [], isLoading } = useQuery({
    queryKey: ["scraper-errors"],
    queryFn: () =>
      mangaApi.scraperErrors({ resolved: false }).then((r) => r.data),
  });

  if (isLoading) return <LoadingSpinner className="py-8" />;

  return (
    <div>
      <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
        <AlertTriangle size={18} className="text-red-400" /> Unresolved Errors (
        {errors.length})
      </h3>
      {errors.length === 0 ? (
        <div className="text-center py-8 text-green-400 flex flex-col items-center gap-2">
          <CheckCircle size={32} />
          <p>No unresolved errors</p>
        </div>
      ) : (
        <div className="space-y-3">
          {errors.map((err) => (
            <div key={err.id} className="card p-4 border-red-900/50">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-red-300 truncate">
                    {err.chapter_url}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    Manga #{err.manga_id} • {err.scraper_name}
                  </p>
                  <p className="text-xs text-red-400 mt-1">
                    {err.error_message}
                  </p>
                </div>
                <div className="text-right shrink-0 text-xs text-gray-600">
                  <p>Retries: {err.retry_count}</p>
                  <p>{new Date(err.last_failed_at).toLocaleDateString()}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function ScraperDashboard() {
  const [tab, setTab] = useState("manga");
  const [page, setPage] = useState(1);
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["scraper-dashboard", page],
    queryFn: () =>
      mangaApi.scraperDashboard({ page, page_size: 20 }).then((r) => r.data),
  });

  return (
    <div>
      <h1 className="flex items-center gap-2 text-3xl font-bold mb-6">
        <Shield className="text-manga-400" /> Scraper Dashboard
      </h1>

      {/* Add manga form */}
      <AddMangaForm
        onSuccess={(manga) => {
          setTab("manga");
          setPage(1);
          if (manga) {
            qc.setQueryData(["scraper-dashboard", 1], (old) => {
              if (!old) return old;
              const exists = old.items?.some((item) => item.id === manga.id);
              const items = exists
                ? old.items.map((item) => (item.id === manga.id ? manga : item))
                : [manga, ...(old.items || [])].slice(0, old.page_size || 20);

              return {
                ...old,
                items,
                total: exists ? old.total : old.total + 1,
                total_pages: Math.max(
                  1,
                  Math.ceil(
                    (exists ? old.total : old.total + 1) / (old.page_size || 20)
                  )
                ),
              };
            });
          }
          qc.invalidateQueries({ queryKey: ["scraper-dashboard"] });
        }}
      />

      {/* Tabs */}
      <div className="flex gap-2 mb-6">
        <button
          onClick={() => setTab("manga")}
          className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${tab === "manga"
              ? "bg-manga-600 text-white"
              : "text-gray-400 hover:bg-gray-800"
            }`}
        >
          Manga List
        </button>
        <button
          onClick={() => setTab("errors")}
          className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${tab === "errors"
              ? "bg-red-700 text-white"
              : "text-gray-400 hover:bg-gray-800"
            }`}
        >
          <span className="flex items-center gap-1">
            <AlertTriangle size={14} /> Errors
          </span>
        </button>
      </div>

      {tab === "manga" && (
        <>
          {isLoading ? (
            <LoadingSpinner size="lg" className="py-16" />
          ) : (
            <>
              <p className="text-sm text-gray-500 mb-4">
                {data?.total} manga tracked
              </p>
              {data?.items?.map((manga) => (
                <MangaRow key={manga.id} manga={manga} />
              ))}
              <Pagination
                page={page}
                totalPages={data?.total_pages || 1}
                onPageChange={setPage}
              />
            </>
          )}
        </>
      )}

      {tab === "errors" && <ErrorsTab />}
    </div>
  );
}
