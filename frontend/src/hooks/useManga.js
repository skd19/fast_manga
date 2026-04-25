import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { mangaApi } from "../api/manga";

export function useMangaList(params) {
  return useQuery({
    queryKey: ["manga", "list", params],
    queryFn: () => mangaApi.list(params).then((r) => r.data),
  });
}

export function useMangaDetail(slug) {
  return useQuery({
    queryKey: ["manga", "detail", slug],
    queryFn: () => mangaApi.detail(slug).then((r) => r.data),
    enabled: !!slug,
  });
}

export function useChapters(slug, params) {
  return useQuery({
    queryKey: ["manga", "chapters", slug, params],
    queryFn: () => mangaApi.chapters(slug, params).then((r) => r.data),
    enabled: !!slug,
  });
}

export function useChapter(mangaSlug, chapterSlug) {
  return useQuery({
    queryKey: ["chapter", mangaSlug, chapterSlug],
    queryFn: () =>
      mangaApi.readChapter(mangaSlug, chapterSlug).then((r) => r.data),
    enabled: !!(mangaSlug && chapterSlug),
  });
}

export function useChapterNav(mangaSlug, chapterSlug) {
  return useQuery({
    queryKey: ["chapter-nav", mangaSlug, chapterSlug],
    queryFn: () =>
      mangaApi.chapterNav(mangaSlug, chapterSlug).then((r) => r.data),
    enabled: !!(mangaSlug && chapterSlug),
  });
}

export function useBookmarks(authenticated = false) {
  return useQuery({
    queryKey: ["bookmarks"],
    queryFn: () => mangaApi.bookmarks().then((r) => r.data),
    enabled: authenticated,
  });
}

export function useToggleBookmark(mangaSlug) {
  const qc = useQueryClient();
  const add = useMutation({
    mutationFn: () => mangaApi.addBookmark(mangaSlug),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["bookmarks"] }),
  });
  const remove = useMutation({
    mutationFn: () => mangaApi.removeBookmark(mangaSlug),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["bookmarks"] }),
  });
  return { add, remove };
}

export function useMyRating(mangaSlug) {
  return useQuery({
    queryKey: ["rating", mangaSlug],
    queryFn: () => mangaApi.myRating(mangaSlug).then((r) => r.data),
    enabled: !!mangaSlug,
  });
}

export function useNotifications(authenticated = false) {
  return useQuery({
    queryKey: ["notifications"],
    queryFn: () => mangaApi.notifications().then((r) => r.data),
    enabled: authenticated,
    refetchInterval: authenticated ? 60_000 : false, // only poll when logged in
  });
}

export function useSearch(q, page = 1) {
  return useQuery({
    queryKey: ["search", q, page],
    queryFn: () => mangaApi.search({ q, page }).then((r) => r.data),
    enabled: q.length > 0,
  });
}

export function useCategories() {
  return useQuery({
    queryKey: ["categories"],
    queryFn: () => mangaApi.categories().then((r) => r.data),
    staleTime: Infinity,
  });
}

export function useHistory(authenticated = false) {
  return useQuery({
    queryKey: ["history"],
    queryFn: () => mangaApi.history().then((r) => r.data),
    enabled: authenticated,
  });
}
