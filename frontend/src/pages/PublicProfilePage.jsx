import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { mangaApi } from "../api/manga";
import LoadingSpinner from "../components/common/LoadingSpinner";

export default function PublicProfilePage() {
  const { username } = useParams();

  const {
    data: profile,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["public-profile", username],
    queryFn: () => mangaApi.publicProfile(username).then((r) => r.data),
    enabled: !!username,
  });

  if (isLoading) return <LoadingSpinner size="lg" className="py-32" />;
  if (isError || !profile)
    return (
      <div className="text-center py-32 text-red-400">User not found.</div>
    );

  return (
    <div className="max-w-2xl mx-auto">
      <div className="card p-8 text-center">
        <div className="w-24 h-24 rounded-full bg-manga-800 flex items-center justify-center text-3xl font-bold mx-auto mb-4 overflow-hidden">
          {profile.avatar ? (
            <img
              src={profile.avatar}
              alt={profile.username}
              className="w-full h-full object-cover"
            />
          ) : (
            profile.username[0].toUpperCase()
          )}
        </div>
        <h1 className="text-2xl font-bold mb-2">{profile.username}</h1>
        {profile.bio && (
          <p className="text-gray-400 text-sm mb-4">{profile.bio}</p>
        )}
        <p className="text-xs text-gray-600">
          Member since {new Date(profile.created_at).toLocaleDateString()}
        </p>
      </div>
    </div>
  );
}
