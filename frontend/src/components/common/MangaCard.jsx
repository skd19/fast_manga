import { Link } from 'react-router-dom'
import { Star, BookOpen } from 'lucide-react'
import clsx from 'clsx'

const STATUS_CLASSES = {
  ongoing: 'badge-ongoing',
  completed: 'badge-completed',
  hiatus: 'badge-hiatus',
  cancelled: 'badge-cancelled',
}

export default function MangaCard({ manga }) {
  const statusClass = STATUS_CLASSES[manga.status] || 'badge bg-gray-700 text-gray-300'

  return (
    <Link
      to={`/manga/${manga.slug}`}
      className="group block card hover:border-manga-700 transition-all duration-200 hover:-translate-y-1 hover:shadow-lg hover:shadow-manga-900/20"
    >
      {/* Cover */}
      <div className="relative aspect-[2/3] overflow-hidden bg-gray-800">
        {manga.cover_image ? (
          <img
            src={manga.cover_image}
            alt={manga.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-600">
            <BookOpen size={48} />
          </div>
        )}

        {/* Status badge overlay */}
        <div className="absolute top-2 left-2">
          <span className={clsx('badge text-xs', statusClass)}>
            {manga.status}
          </span>
        </div>
      </div>

      {/* Info */}
      <div className="p-3">
        <h3 className="font-semibold text-sm text-gray-100 line-clamp-2 group-hover:text-manga-300 transition-colors">
          {manga.title}
        </h3>

        {manga.latest_chapter && (
          <p className="text-xs text-gray-500 mt-1">
            Ch. {Number(manga.latest_chapter.number)}
          </p>
        )}

        <div className="flex items-center justify-between mt-2">
          <div className="flex items-center gap-1 text-yellow-400 text-xs">
            <Star size={12} fill="currentColor" />
            <span>{manga.average_rating?.toFixed(1) || '—'}</span>
          </div>
          <span className="text-xs text-gray-600">
            {manga.rating_count} ratings
          </span>
        </div>
      </div>
    </Link>
  )
}
