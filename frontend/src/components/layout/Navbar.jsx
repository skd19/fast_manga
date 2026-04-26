import { useEffect, useState } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "../../context/AuthContext";
import { useNotifications } from "../../hooks/useManga";
import { mangaApi } from "../../api/manga";
import {
  BookOpen,
  Search,
  Bell,
  User,
  LogOut,
  Menu,
  X,
  Bookmark,
  ChevronDown,
  Shield,
} from "lucide-react";
import clsx from "clsx";

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);

  const { data: notifs = [] } = useNotifications(!!user);
  const unread = notifs.filter((n) => !n.is_read).length;
  const trimmedSearch = searchQuery.trim();
  const canLiveSearch = trimmedSearch.length > 3;
  const showLiveSearch = searchOpen && canLiveSearch;

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearch(trimmedSearch);
    }, 300);

    return () => window.clearTimeout(timer);
  }, [trimmedSearch]);

  const { data: liveSearchData, isFetching: liveSearchFetching } = useQuery({
    queryKey: ["navbar-search", debouncedSearch],
    queryFn: () =>
      mangaApi
        .search({ q: debouncedSearch, page: 1, page_size: 6 })
        .then((r) => r.data),
    enabled: debouncedSearch.length > 3,
  });

  const handleSearch = (e) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
      setSearchQuery("");
      setSearchOpen(false);
      setMenuOpen(false);
    }
  };

  const handleSearchChange = (e) => {
    setSearchQuery(e.target.value);
    setSearchOpen(true);
  };

  const handleResultClick = () => {
    setSearchQuery("");
    setSearchOpen(false);
    setMenuOpen(false);
  };

  const handleLogout = () => {
    logout();
    navigate("/");
  };

  const renderLiveSearch = () => {
    if (!showLiveSearch) return null;

    const items = liveSearchData?.items || [];

    return (
      <div
        className="absolute left-0 right-0 top-full mt-2 card overflow-hidden shadow-xl z-50"
        onMouseDown={(e) => e.preventDefault()}
      >
        {liveSearchFetching && debouncedSearch !== trimmedSearch ? (
          <p className="px-4 py-3 text-sm text-gray-500">Searching...</p>
        ) : items.length > 0 ? (
          <>
            <div className="max-h-80 overflow-y-auto divide-y divide-gray-800">
              {items.map((manga) => (
                <Link
                  key={manga.id}
                  to={`/manga/${manga.slug}`}
                  onClick={handleResultClick}
                  className="flex items-center gap-3 px-3 py-2 hover:bg-gray-800/70 transition-colors"
                >
                  <div className="w-10 h-14 rounded overflow-hidden bg-gray-800 shrink-0 flex items-center justify-center text-gray-600">
                    {manga.cover_image ? (
                      <img
                        src={manga.cover_image}
                        alt={manga.title}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <BookOpen size={18} />
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-100 truncate">
                      {manga.title}
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {manga.latest_chapter
                        ? `Latest: Ch. ${Number(manga.latest_chapter.number)}`
                        : manga.status}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
            <button
              type="submit"
              className="w-full px-4 py-2 text-sm text-manga-400 hover:bg-gray-800/70 transition-colors"
            >
              View all results
            </button>
          </>
        ) : (
          <p className="px-4 py-3 text-sm text-gray-500">No results found</p>
        )}
      </div>
    );
  };

  return (
    <header className="bg-gray-900 border-b border-gray-800 sticky top-0 z-50">
      <div className="container mx-auto px-4 max-w-7xl">
        <div className="flex items-center justify-between h-16 gap-4">
          {/* Logo */}
          <Link
            to="/"
            className="flex items-center gap-2 text-manga-400 font-bold text-xl shrink-0"
          >
            <BookOpen size={24} />
            <span className="hidden sm:block">FastManga</span>
          </Link>

          {/* Search */}
          <form
            onSubmit={handleSearch}
            className="flex-1 max-w-md hidden md:flex"
          >
            <div className="relative w-full">
              <Search
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500"
              />
              <input
                type="search"
                placeholder="Search manga..."
                value={searchQuery}
                onChange={handleSearchChange}
                onFocus={() => setSearchOpen(true)}
                className="input pl-9 text-sm"
              />
              {renderLiveSearch()}
            </div>
          </form>

          {/* Nav links */}
          <nav className="hidden md:flex items-center gap-1">
            <NavLink
              to="/browse"
              className={({ isActive }) =>
                clsx("btn-ghost text-sm", isActive && "text-white bg-gray-800")
              }
            >
              Browse
            </NavLink>

            {user ? (
              <>
                {/* Notifications */}
                <Link to="/profile" className="relative btn-ghost">
                  <Bell size={18} />
                  {unread > 0 && (
                    <span className="absolute top-1 right-1 w-4 h-4 bg-manga-500 text-white text-xs flex items-center justify-center rounded-full">
                      {unread}
                    </span>
                  )}
                </Link>

                {/* Bookmarks */}
                <Link to="/bookmarks" className="btn-ghost">
                  <Bookmark size={18} />
                </Link>

                {/* User menu */}
                <div className="relative">
                  <button
                    onClick={() => setUserMenuOpen((v) => !v)}
                    className="flex items-center gap-2 btn-ghost"
                  >
                    {user.avatar ? (
                      <img
                        src={user.avatar}
                        alt={user.username}
                        className="w-7 h-7 rounded-full object-cover"
                      />
                    ) : (
                      <div className="w-7 h-7 rounded-full bg-manga-700 flex items-center justify-center text-xs font-bold">
                        {user.username[0].toUpperCase()}
                      </div>
                    )}
                    <span className="text-sm">{user.username}</span>
                    <ChevronDown size={14} />
                  </button>

                  {userMenuOpen && (
                    <div className="absolute right-0 mt-2 w-48 card shadow-xl py-1 z-50">
                      <Link
                        to="/profile"
                        className="flex items-center gap-2 px-4 py-2 text-sm hover:bg-gray-800"
                        onClick={() => setUserMenuOpen(false)}
                      >
                        <User size={14} /> My Profile
                      </Link>
                      <Link
                        to="/bookmarks"
                        className="flex items-center gap-2 px-4 py-2 text-sm hover:bg-gray-800"
                        onClick={() => setUserMenuOpen(false)}
                      >
                        <Bookmark size={14} /> Bookmarks
                      </Link>
                      {(user.is_staff || user.is_superuser) && (
                        <>
                          <Link
                            to="/staff/manga"
                            className="flex items-center gap-2 px-4 py-2 text-sm hover:bg-gray-800 text-manga-400"
                            onClick={() => setUserMenuOpen(false)}
                          >
                            <Shield size={14} /> Manga Admin
                          </Link>
                          <Link
                            to="/staff/scrapers"
                            className="flex items-center gap-2 px-4 py-2 text-sm hover:bg-gray-800 text-manga-400"
                            onClick={() => setUserMenuOpen(false)}
                          >
                            <Shield size={14} /> Scraper Admin
                          </Link>
                        </>
                      )}
                      <hr className="border-gray-700 my-1" />
                      <button
                        onClick={handleLogout}
                        className="flex w-full items-center gap-2 px-4 py-2 text-sm hover:bg-gray-800 text-red-400"
                      >
                        <LogOut size={14} /> Logout
                      </button>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <>
                <Link to="/login" className="btn-ghost text-sm">
                  Login
                </Link>
                <Link to="/register" className="btn-primary text-sm">
                  Register
                </Link>
              </>
            )}
          </nav>

          {/* Mobile menu button */}
          <button
            className="md:hidden btn-ghost"
            onClick={() => setMenuOpen((v) => !v)}
          >
            {menuOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>

        {/* Mobile dropdown */}
        {menuOpen && (
          <div className="md:hidden border-t border-gray-800 py-4 space-y-2">
            <form onSubmit={handleSearch} className="mb-3">
              <div className="relative">
                <Search
                  size={16}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500"
                />
                <input
                  type="search"
                  placeholder="Search manga..."
                  value={searchQuery}
                  onChange={handleSearchChange}
                  onFocus={() => setSearchOpen(true)}
                  className="input pl-9 text-sm"
                />
                {renderLiveSearch()}
              </div>
            </form>
            <Link
              to="/browse"
              className="block py-2 hover:text-manga-400"
              onClick={() => setMenuOpen(false)}
            >
              Browse
            </Link>
            {user ? (
              <>
                <Link
                  to="/profile"
                  className="block py-2 hover:text-manga-400"
                  onClick={() => setMenuOpen(false)}
                >
                  Profile
                </Link>
                <Link
                  to="/bookmarks"
                  className="block py-2 hover:text-manga-400"
                  onClick={() => setMenuOpen(false)}
                >
                  Bookmarks
                </Link>
                {(user.is_staff || user.is_superuser) && (
                  <>
                    <Link
                      to="/staff/manga"
                      className="block py-2 text-manga-400"
                      onClick={() => setMenuOpen(false)}
                    >
                      Manga Admin
                    </Link>
                    <Link
                      to="/staff/scrapers"
                      className="block py-2 text-manga-400"
                      onClick={() => setMenuOpen(false)}
                    >
                      Scraper Admin
                    </Link>
                  </>
                )}
                <button
                  onClick={handleLogout}
                  className="block py-2 text-red-400"
                >
                  Logout
                </button>
              </>
            ) : (
              <>
                <Link
                  to="/login"
                  className="block py-2 hover:text-manga-400"
                  onClick={() => setMenuOpen(false)}
                >
                  Login
                </Link>
                <Link
                  to="/register"
                  className="block py-2 hover:text-manga-400"
                  onClick={() => setMenuOpen(false)}
                >
                  Register
                </Link>
              </>
            )}
          </div>
        )}
      </div>
    </header>
  );
}
