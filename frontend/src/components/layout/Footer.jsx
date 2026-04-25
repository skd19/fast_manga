import { Link } from 'react-router-dom'
import { BookOpen } from 'lucide-react'

export default function Footer() {
  return (
    <footer className="bg-gray-900 border-t border-gray-800 py-8 mt-auto">
      <div className="container mx-auto px-4 max-w-7xl">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <Link to="/" className="flex items-center gap-2 text-manga-400 font-bold">
            <BookOpen size={20} />
            FastManga
          </Link>
          <p className="text-gray-500 text-sm">
            © {new Date().getFullYear()} FastManga. Read manga for free.
          </p>
          <nav className="flex gap-4 text-sm text-gray-500">
            <Link to="/browse" className="hover:text-manga-400 transition-colors">Browse</Link>
            <Link to="/search" className="hover:text-manga-400 transition-colors">Search</Link>
          </nav>
        </div>
      </div>
    </footer>
  )
}
