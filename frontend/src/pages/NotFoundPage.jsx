import { Link } from "react-router-dom";
import { BookOpen, Home } from "lucide-react";

export default function NotFoundPage() {
  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center text-center">
      <BookOpen size={80} className="text-gray-700 mb-6" />
      <h1 className="text-6xl font-bold text-gray-700 mb-2">404</h1>
      <p className="text-xl text-gray-500 mb-2">Page Not Found</p>
      <p className="text-gray-600 mb-8">
        The page you&apos;re looking for doesn&apos;t exist or has been moved.
      </p>
      <Link to="/" className="btn-primary">
        <Home size={18} /> Go Home
      </Link>
    </div>
  );
}
