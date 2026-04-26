import client from './client'

export const mangaApi = {
  // Manga listing & search
  list: (params) => client.get('/manga/', { params }),
  search: (params) => client.get('/manga/search', { params }),
  categories: () => client.get('/manga/categories'),
  detail: (slug) => client.get(`/manga/${slug}`),
  chapters: (slug, params) => client.get(`/manga/${slug}/chapters`, { params }),
  recommendations: (slug) => client.get(`/manga/${slug}/recommendations`),

  // Chapter
  readChapter: (mangaSlug, chapterSlug) =>
    client.get(`/manga/${mangaSlug}/chapter/${chapterSlug}`),
  chapterNav: (mangaSlug, chapterSlug) =>
    client.get(`/manga/${mangaSlug}/chapter/${chapterSlug}/nav`),
  markChapterRead: (mangaSlug, chapterSlug) =>
    client.post(`/manga/${mangaSlug}/chapter/${chapterSlug}/mark-read`),

  // Comments
  listComments: (mangaSlug, chapterSlug, params) =>
    client.get(`/manga/${mangaSlug}/chapter/${chapterSlug}/comments`, { params }),
  addComment: (mangaSlug, chapterSlug, data) =>
    client.post(`/manga/${mangaSlug}/chapter/${chapterSlug}/comments`, data),
  commentCount: (mangaSlug, chapterSlug) =>
    client.get(`/manga/${mangaSlug}/chapter/${chapterSlug}/comment-count`),

  // Ratings
  rate: (mangaSlug, score) => client.post(`/manga/${mangaSlug}/rating`, { score }),
  myRating: (mangaSlug) => client.get(`/manga/${mangaSlug}/rating/me`),

  // Bookmarks
  bookmarks: () => client.get('/bookmarks/'),
  addBookmark: (mangaSlug) => client.post(`/bookmarks/${mangaSlug}`),
  removeBookmark: (mangaSlug) => client.delete(`/bookmarks/${mangaSlug}`),

  // Notifications
  notifications: () => client.get('/notifications/'),
  markNotifRead: (id) => client.post(`/notifications/${id}/read`),
  markAllNotifsRead: () => client.post('/notifications/read-all'),

  // History
  history: () => client.get('/history/'),
  readChapters: (mangaId) => client.get('/history/read-chapters', { params: { manga_id: mangaId } }),

  // Users
  myProfile: () => client.get('/users/profile'),
  updateProfile: (data) => client.put('/users/profile', data),
  uploadAvatar: (file) => {
    const fd = new FormData()
    fd.append('file', file)
    return client.post('/users/profile/avatar', fd, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
  },
  publicProfile: (username) => client.get(`/users/${username}`),

  // Staff / Scraper
  scraperDashboard: (params) => client.get('/staff/scrapers/', { params }),
  scraperAddManga: (data) => client.post('/staff/scrapers/add', data),
  scraperStart: (mangaId) => client.post(`/staff/scrapers/start/${mangaId}`),
  scraperRetry: (mangaId) => client.post(`/staff/scrapers/retry/${mangaId}`),
  scraperErrors: (params) => client.get('/staff/scrapers/errors', { params }),
  scraperMangaRows: (mangaId) => client.get(`/staff/scrapers/${mangaId}/rows`),

  // Admin: manga management
  createManga: (data) => client.post('/manga/', data),
  staffMangaDetail: (mangaId) => client.get(`/manga/staff/${mangaId}`),
  updateManga: (mangaId, data) => client.put(`/manga/${mangaId}`, data),
  deleteManga: (mangaId) => client.delete(`/manga/${mangaId}`),
  uploadMangaCover: (mangaId, file) => {
    const fd = new FormData()
    fd.append('file', file)
    return client.post(`/manga/${mangaId}/cover`, fd, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
  },
}
