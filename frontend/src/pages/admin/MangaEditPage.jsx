import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, ImagePlus, Save } from "lucide-react";
import toast from "react-hot-toast";
import { mangaApi } from "../../api/manga";
import LoadingSpinner from "../../components/common/LoadingSpinner";

const STATUS_OPTIONS = ["ongoing", "completed", "hiatus", "cancelled", "not_yet_released"];

const emptyForm = {
  title: "",
  description: "",
  author: "",
  artist: "",
  status: "ongoing",
  anilist_id: "",
  sourcesText: "",
  categoryIds: [],
};

export default function MangaEditPage() {
  const { mangaId } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [form, setForm] = useState(emptyForm);
  const [coverFile, setCoverFile] = useState(null);

  const { data: manga, isLoading, isError } = useQuery({
    queryKey: ["staff-manga-detail", mangaId],
    queryFn: () => mangaApi.staffMangaDetail(mangaId).then((r) => r.data),
    enabled: !!mangaId,
  });

  const { data: categories = [] } = useQuery({
    queryKey: ["categories"],
    queryFn: () => mangaApi.categories().then((r) => r.data),
  });

  useEffect(() => {
    if (!manga) return;
    setForm({
      title: manga.title || "",
      description: manga.description || "",
      author: manga.author || "",
      artist: manga.artist || "",
      status: manga.status || "ongoing",
      anilist_id: manga.anilist_id ? String(manga.anilist_id) : "",
      sourcesText: JSON.stringify(manga.sources || [], null, 2),
      categoryIds: (manga.categories || []).map((category) => category.id),
    });
  }, [manga]);

  const updateMutation = useMutation({
    mutationFn: async () => {
      let sources;
      try {
        sources = form.sourcesText.trim() ? JSON.parse(form.sourcesText) : [];
      } catch {
        throw new Error("Sources must be valid JSON");
      }

      const payload = {
        title: form.title.trim(),
        description: form.description,
        author: form.author,
        artist: form.artist,
        status: form.status,
        anilist_id: form.anilist_id ? Number(form.anilist_id) : null,
        sources,
        category_ids: form.categoryIds,
      };

      const updated = await mangaApi.updateManga(mangaId, payload).then((r) => r.data);
      if (coverFile) await mangaApi.uploadMangaCover(mangaId, coverFile);
      return updated;
    },
    onSuccess: (updated) => {
      toast.success("Manga updated");
      qc.invalidateQueries({ queryKey: ["staff-manga-detail", mangaId] });
      qc.invalidateQueries({ queryKey: ["staff-manga-manage"] });
      qc.invalidateQueries({ queryKey: ["manga", "detail", updated.slug] });
      setCoverFile(null);
      navigate(`/staff/manga/${mangaId}/edit`, { replace: true });
    },
    onError: (e) => toast.error(e.response?.data?.detail || e.message || "Failed to update"),
  });

  const toggleCategory = (categoryId) => {
    setForm((current) => ({
      ...current,
      categoryIds: current.categoryIds.includes(categoryId)
        ? current.categoryIds.filter((id) => id !== categoryId)
        : [...current.categoryIds, categoryId],
    }));
  };

  if (isLoading) return <LoadingSpinner size="lg" className="py-24" />;

  if (isError || !manga) {
    return (
      <div className="text-center py-24">
        <p className="text-red-400 mb-4">Manga not found.</p>
        <Link to="/staff/manga" className="btn-secondary">Back to management</Link>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between gap-4 mb-6">
        <div>
          <Link to="/staff/manga" className="inline-flex items-center gap-1 text-sm text-manga-400 hover:text-manga-300 mb-2">
            <ArrowLeft size={14} /> Manga Management
          </Link>
          <h1 className="text-3xl font-bold">Edit Manga</h1>
        </div>
        <Link to={`/manga/${manga.slug}`} className="btn-secondary text-sm">View Manga</Link>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          updateMutation.mutate();
        }}
        className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-6"
      >
        <div className="space-y-4">
          <div className="card p-4">
            <div className="aspect-[2/3] rounded bg-gray-800 overflow-hidden mb-4">
              {manga.cover_image ? (
                <img src={manga.cover_image} alt={manga.title} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-gray-600">
                  <ImagePlus size={48} />
                </div>
              )}
            </div>
            <label className="btn-secondary w-full justify-center cursor-pointer text-sm">
              <ImagePlus size={16} /> Change Cover
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => setCoverFile(e.target.files?.[0] || null)}
              />
            </label>
            {coverFile && <p className="text-xs text-gray-500 mt-2 truncate">{coverFile.name}</p>}
          </div>
        </div>

        <div className="card p-5 space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <label className="block">
              <span className="block text-sm text-gray-400 mb-1">Title</span>
              <input
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                className="input"
                required
              />
            </label>
            <label className="block">
              <span className="block text-sm text-gray-400 mb-1">Status</span>
              <select
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value })}
                className="input"
              >
                {STATUS_OPTIONS.map((status) => (
                  <option key={status} value={status}>{status}</option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="block text-sm text-gray-400 mb-1">Author</span>
              <input value={form.author} onChange={(e) => setForm({ ...form, author: e.target.value })} className="input" />
            </label>
            <label className="block">
              <span className="block text-sm text-gray-400 mb-1">Artist</span>
              <input value={form.artist} onChange={(e) => setForm({ ...form, artist: e.target.value })} className="input" />
            </label>
            <label className="block">
              <span className="block text-sm text-gray-400 mb-1">AniList ID</span>
              <input
                type="number"
                min="1"
                value={form.anilist_id}
                onChange={(e) => setForm({ ...form, anilist_id: e.target.value })}
                className="input"
              />
            </label>
          </div>

          <label className="block">
            <span className="block text-sm text-gray-400 mb-1">Description</span>
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              className="input min-h-36 resize-y"
            />
          </label>

          <div>
            <p className="text-sm text-gray-400 mb-2">Categories</p>
            <div className="flex flex-wrap gap-2">
              {categories.map((category) => (
                <button
                  key={category.id}
                  type="button"
                  onClick={() => toggleCategory(category.id)}
                  className={`px-3 py-1 rounded text-xs transition-colors ${
                    form.categoryIds.includes(category.id)
                      ? "bg-manga-600 text-white"
                      : "bg-gray-800 text-gray-400 hover:bg-gray-700"
                  }`}
                >
                  {category.name}
                </button>
              ))}
            </div>
          </div>

          <label className="block">
            <span className="block text-sm text-gray-400 mb-1">Sources JSON</span>
            <textarea
              value={form.sourcesText}
              onChange={(e) => setForm({ ...form, sourcesText: e.target.value })}
              className="input min-h-32 resize-y font-mono text-xs"
              spellCheck="false"
            />
          </label>

          <div className="flex justify-end">
            <button type="submit" disabled={updateMutation.isPending} className="btn-primary">
              <Save size={16} /> {updateMutation.isPending ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
