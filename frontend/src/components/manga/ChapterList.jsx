import { Link } from 'react-router-dom'
import { CheckCircle, ChevronDown, ChevronUp } from 'lucide-react'
import { useState } from 'react'
import { formatDistanceToNow } from '../common/timeUtils'

export default function ChapterList({ chapters = [], mangaSlug, readChapterIds = [] }) {
  const [expanded, setExpanded] = useState(true)

  return (
    <div className="card">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center justify-between p-4 hover:bg-gray-800/50 transition-colors"
      >
        <h2 className="text-lg font-semibold">Chapters ({chapters.length})</h2>
        {expanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
      </button>

      {expanded && (
        <div className="divide-y divide-gray-800 max-h-96 overflow-y-auto">
          {chapters.map((ch) => {
            const isRead = readChapterIds.includes(ch.id)
            return (
              <Link
                key={ch.id}
                to={`/manga/${mangaSlug}/chapter/${ch.slug}`}
                className="flex items-center justify-between px-4 py-3 hover:bg-gray-800/50 transition-colors group"
              >
                <div className="flex items-center gap-3">
                  {isRead && <CheckCircle size={14} className="text-manga-500 shrink-0" />}
                  <span className={`text-sm ${isRead ? 'text-gray-500' : 'text-gray-200 group-hover:text-manga-300'}`}>
                    Chapter {Number(ch.number)}
                    {ch.title && <span className="text-gray-500 ml-2">— {ch.title}</span>}
                  </span>
                </div>
                <span className="text-xs text-gray-600">{formatDistanceToNow(ch.created_at)}</span>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
