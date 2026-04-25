import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../context/AuthContext";
import { mangaApi } from "../api/manga";
import { authApi } from "../api/auth";
import { useNotifications, useHistory } from "../hooks/useManga";
import toast from "react-hot-toast";
import { User, Bell, Clock, Key, Camera } from "lucide-react";
import LoadingSpinner from "../components/common/LoadingSpinner";
import { Link } from "react-router-dom";

function TabButton({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
        active
          ? "bg-manga-600 text-white"
          : "text-gray-400 hover:text-white hover:bg-gray-800"
      }`}
    >
      {children}
    </button>
  );
}

export default function ProfilePage() {
  const { user, refetchUser } = useAuth();
  const qc = useQueryClient();
  const [tab, setTab] = useState("profile");
  const [profileForm, setProfileForm] = useState({
    email: user?.email || "",
    bio: user?.bio || "",
  });
  const [pwForm, setPwForm] = useState({
    current_password: "",
    new_password: "",
    confirm: "",
  });

  const { data: notifications = [], isLoading: notifsLoading } =
    useNotifications(!!user);
  const { data: history = [] } = useHistory(!!user);

  const updateProfileMutation = useMutation({
    mutationFn: (data) => mangaApi.updateProfile(data),
    onSuccess: () => {
      toast.success("Profile updated!");
      refetchUser();
    },
    onError: (e) => toast.error(e.response?.data?.detail || "Update failed"),
  });

  const markReadMutation = useMutation({
    mutationFn: (id) => mangaApi.markNotifRead(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications"] }),
  });

  const markAllReadMutation = useMutation({
    mutationFn: () => mangaApi.markAllNotifsRead(),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications"] }),
  });

  const avatarMutation = useMutation({
    mutationFn: (file) => mangaApi.uploadAvatar(file),
    onSuccess: () => {
      toast.success("Avatar updated!");
      refetchUser();
    },
    onError: () => toast.error("Upload failed"),
  });

  if (!user) return <LoadingSpinner size="lg" className="py-32" />;

  return (
    <div className="max-w-4xl mx-auto">
      {/* Profile header */}
      <div className="card p-6 mb-6 flex items-center gap-6">
        <div className="relative">
          <div className="w-20 h-20 rounded-full bg-manga-800 flex items-center justify-center text-2xl font-bold overflow-hidden">
            {user.avatar ? (
              <img
                src={user.avatar}
                alt={user.username}
                className="w-full h-full object-cover"
              />
            ) : (
              user.username[0].toUpperCase()
            )}
          </div>
          <label className="absolute bottom-0 right-0 w-7 h-7 bg-manga-600 rounded-full flex items-center justify-center cursor-pointer hover:bg-manga-500 transition-colors">
            <Camera size={12} />
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) =>
                e.target.files[0] && avatarMutation.mutate(e.target.files[0])
              }
            />
          </label>
        </div>
        <div>
          <h1 className="text-2xl font-bold">{user.username}</h1>
          <p className="text-gray-500 text-sm">{user.email}</p>
          {user.bio && <p className="text-gray-400 text-sm mt-1">{user.bio}</p>}
          {user.is_staff && (
            <Link
              to="/staff/scrapers"
              className="text-xs text-manga-400 hover:underline mt-1 block"
            >
              Staff Dashboard →
            </Link>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6">
        <TabButton active={tab === "profile"} onClick={() => setTab("profile")}>
          <span className="flex items-center gap-1">
            <User size={14} /> Profile
          </span>
        </TabButton>
        <TabButton
          active={tab === "notifications"}
          onClick={() => setTab("notifications")}
        >
          <span className="flex items-center gap-1">
            <Bell size={14} /> Notifications
            {notifications.filter((n) => !n.is_read).length > 0 && (
              <span className="ml-1 w-4 h-4 bg-manga-500 text-white text-xs rounded-full flex items-center justify-center">
                {notifications.filter((n) => !n.is_read).length}
              </span>
            )}
          </span>
        </TabButton>
        <TabButton active={tab === "history"} onClick={() => setTab("history")}>
          <span className="flex items-center gap-1">
            <Clock size={14} /> History
          </span>
        </TabButton>
        <TabButton
          active={tab === "security"}
          onClick={() => setTab("security")}
        >
          <span className="flex items-center gap-1">
            <Key size={14} /> Security
          </span>
        </TabButton>
      </div>

      {/* Tab content */}
      {tab === "profile" && (
        <div className="card p-6">
          <h2 className="text-lg font-semibold mb-4">Edit Profile</h2>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              updateProfileMutation.mutate(profileForm);
            }}
            className="space-y-4 max-w-md"
          >
            <div>
              <label className="block text-sm text-gray-400 mb-1">Email</label>
              <input
                type="email"
                value={profileForm.email}
                onChange={(e) =>
                  setProfileForm({ ...profileForm, email: e.target.value })
                }
                className="input"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Bio</label>
              <textarea
                value={profileForm.bio}
                onChange={(e) =>
                  setProfileForm({ ...profileForm, bio: e.target.value })
                }
                className="input min-h-[80px] resize-y"
                placeholder="Tell us about yourself..."
              />
            </div>
            <button
              type="submit"
              disabled={updateProfileMutation.isPending}
              className="btn-primary"
            >
              {updateProfileMutation.isPending ? "Saving..." : "Save Changes"}
            </button>
          </form>
        </div>
      )}

      {tab === "notifications" && (
        <div className="card">
          <div className="flex items-center justify-between p-4 border-b border-gray-800">
            <h2 className="font-semibold">Notifications</h2>
            {notifications.some((n) => !n.is_read) && (
              <button
                onClick={() => markAllReadMutation.mutate()}
                className="text-xs text-manga-400 hover:underline"
              >
                Mark all read
              </button>
            )}
          </div>
          {notifsLoading ? (
            <LoadingSpinner className="py-8" />
          ) : notifications.length === 0 ? (
            <p className="text-center py-8 text-gray-500">No notifications</p>
          ) : (
            <div className="divide-y divide-gray-800">
              {notifications.map((n) => (
                <div
                  key={n.id}
                  className={`flex items-start justify-between p-4 gap-4 ${n.is_read ? "opacity-60" : ""}`}
                >
                  <p className="text-sm">{n.message}</p>
                  {!n.is_read && (
                    <button
                      onClick={() => markReadMutation.mutate(n.id)}
                      className="text-xs text-manga-400 shrink-0 hover:underline"
                    >
                      Mark read
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === "history" && (
        <div className="card">
          <div className="p-4 border-b border-gray-800">
            <h2 className="font-semibold">Reading History</h2>
          </div>
          {history.length === 0 ? (
            <p className="text-center py-8 text-gray-500">
              No reading history yet
            </p>
          ) : (
            <div className="divide-y divide-gray-800">
              {history.map((h) => (
                <div
                  key={h.id}
                  className="flex items-center justify-between p-4"
                >
                  <div>
                    <p className="text-sm font-medium">Manga #{h.manga_id}</p>
                    <p className="text-xs text-gray-500">
                      {h.last_read_chapter_id
                        ? `Last: Ch. ${h.last_read_chapter_id}`
                        : "Started"}
                    </p>
                  </div>
                  <span className="text-xs text-gray-600">
                    {new Date(h.last_read_at).toLocaleDateString()}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === "security" && (
        <div className="card p-6">
          <h2 className="text-lg font-semibold mb-4">Change Password</h2>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              if (pwForm.new_password !== pwForm.confirm) {
                toast.error("Passwords do not match");
                return;
              }
              try {
                await authApi.changePassword({
                  current_password: pwForm.current_password,
                  new_password: pwForm.new_password,
                });
                toast.success("Password changed!");
                setPwForm({
                  current_password: "",
                  new_password: "",
                  confirm: "",
                });
              } catch (err) {
                toast.error(
                  err.response?.data?.detail || "Failed to change password",
                );
              }
            }}
            className="space-y-4 max-w-md"
          >
            <div>
              <label className="block text-sm text-gray-400 mb-1">
                Current Password
              </label>
              <input
                type="password"
                value={pwForm.current_password}
                onChange={(e) =>
                  setPwForm({ ...pwForm, current_password: e.target.value })
                }
                className="input"
                required
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">
                New Password
              </label>
              <input
                type="password"
                value={pwForm.new_password}
                onChange={(e) =>
                  setPwForm({ ...pwForm, new_password: e.target.value })
                }
                className="input"
                required
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">
                Confirm New Password
              </label>
              <input
                type="password"
                value={pwForm.confirm}
                onChange={(e) =>
                  setPwForm({ ...pwForm, confirm: e.target.value })
                }
                className="input"
                required
              />
            </div>
            <button type="submit" className="btn-primary">
              Change Password
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
