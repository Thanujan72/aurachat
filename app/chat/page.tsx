"use client";
import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { Search, MoreVertical, User, Camera, Loader2 } from "lucide-react";

interface Profile {
  id: string;
  email: string;
  fullName: string;
  avatarUrl: string;
}

export default function ChatDashboard() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [users, setUsers] = useState<Profile[]>([]);

  // 🔥 Profile Settings States
  const [myProfile, setMyProfile] = useState<Profile | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [newName, setNewName] = useState("");
  const [newAvatar, setNewAvatar] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const dpInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const fetchSessionAndUsers = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        router.push("/login");
        return;
      }
      setCurrentUser(session.user);

      try {
        // Auto Sync & Fetch My Profile
        const syncRes = await fetch("/api/auth/sync", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: session.user.id,
            email: session.user.email,
          }),
        });

        if (syncRes.ok) {
          const syncData = await syncRes.json();
          setMyProfile(syncData.profile);
          setNewName(syncData.profile.fullName || "");
          setNewAvatar(syncData.profile.avatarUrl || "");
        }

        // Fetch other users
        const res = await fetch(`/api/users?userId=${session.user.id}`);
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data)) setUsers(data);
        }
      } catch (error) {
        console.error("Failed to fetch users", error);
      } finally {
        setLoading(false);
      }
    };

    fetchSessionAndUsers();
  }, [router]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  // 🔥 DP Upload (Cloudinary)
  const handleDpUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append("file", file);

    try {
      const uploadRes = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });
      const uploadData = await uploadRes.json();
      if (uploadData.url) setNewAvatar(uploadData.url); // Preview the new image
    } catch (error) {
      console.error("Upload failed", error);
    }
  };

  // 🔥 Save Profile to DB
  const handleSaveProfile = async () => {
    if (!myProfile) return;
    setIsSaving(true);
    try {
      const res = await fetch("/api/users/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: myProfile.id,
          fullName: newName,
          avatarUrl: newAvatar,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setMyProfile(data.profile);
        setShowSettings(false); // Modal-a close pannidum
      }
    } catch (error) {
      console.error("Failed to save profile", error);
    } finally {
      setIsSaving(false);
    }
  };

  if (loading)
    return (
      <div className="h-screen flex items-center justify-center bg-[#111b21] text-[#00a884]">
        Loading AuraChat...
      </div>
    );

  return (
    <div className="flex h-screen bg-[#111b21] text-gray-200 overflow-hidden font-sans relative">
      {/* 🔥 SETTINGS MODAL */}
      {showSettings && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center transition-opacity">
          <div className="bg-[#202c33] p-8 rounded-xl shadow-2xl w-[90%] max-w-sm flex flex-col items-center border border-gray-700">
            <h2 className="text-white text-xl font-semibold mb-6">
              Profile Settings
            </h2>

            {/* DP Upload UI */}
            <div
              className="relative group cursor-pointer w-32 h-32 rounded-full overflow-hidden mb-6 bg-[#2a3942] border-2 border-[#00a884] flex items-center justify-center"
              onClick={() => dpInputRef.current?.click()}
            >
              {newAvatar ? (
                <img
                  src={newAvatar}
                  alt="DP"
                  className="w-full h-full object-cover"
                />
              ) : (
                <User size={50} className="text-gray-400" />
              )}
              <div className="absolute inset-0 bg-black/60 hidden group-hover:flex items-center justify-center transition-all">
                <Camera size={28} className="text-white" />
              </div>
            </div>
            <input
              type="file"
              ref={dpInputRef}
              onChange={handleDpUpload}
              className="hidden"
              accept="image/*"
            />

            {/* Name Input UI */}
            <div className="w-full mb-8">
              <label className="text-[#00a884] text-xs font-semibold mb-2 block uppercase tracking-wider">
                Your Name
              </label>
              <input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Enter your display name"
                className="w-full bg-transparent text-white px-0 py-2 border-b-2 border-gray-600 focus:outline-none focus:border-[#00a884] transition-colors"
              />
            </div>

            {/* Action Buttons */}
            <div className="flex gap-4 w-full">
              <button
                onClick={() => setShowSettings(false)}
                className="flex-1 py-2.5 bg-transparent border border-gray-500 text-gray-300 rounded-lg hover:bg-gray-700 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveProfile}
                disabled={isSaving}
                className="flex-1 py-2.5 bg-[#00a884] text-white rounded-lg font-medium hover:bg-[#008f72] transition flex items-center justify-center gap-2"
              >
                {isSaving ? (
                  <Loader2 size={18} className="animate-spin" />
                ) : (
                  "Save"
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* LEFT SIDEBAR - CHAT LIST */}
      <div className="w-full md:w-1/3 border-r border-gray-800 flex flex-col bg-[#111b21]">
        {/* Sidebar Header */}
        <div className="h-16 bg-[#202c33] flex items-center justify-between px-4">
          {/* 🔥 Profile Click -> Opens Settings */}
          <div
            onClick={() => setShowSettings(true)}
            className="w-10 h-10 bg-gray-600 rounded-full flex items-center justify-center overflow-hidden cursor-pointer hover:opacity-80 transition"
            title="Profile Settings"
          >
            {myProfile?.avatarUrl ? (
              <img
                src={myProfile.avatarUrl}
                alt="My DP"
                className="w-full h-full object-cover"
              />
            ) : (
              <User size={24} className="text-gray-300" />
            )}
          </div>

          <div className="flex gap-4 text-gray-400">
            <button
              onClick={handleLogout}
              title="Logout"
              className="hover:text-white transition"
            >
              <MoreVertical size={20} />
            </button>
          </div>
        </div>

        {/* Search Bar */}
        <div className="p-3 bg-[#111b21]">
          <div className="flex items-center bg-[#202c33] rounded-lg px-3 py-2">
            <Search size={18} className="text-gray-400" />
            <input
              type="text"
              placeholder="Search users"
              className="bg-transparent border-none focus:outline-none ml-4 w-full text-sm text-white placeholder-gray-400"
            />
          </div>
        </div>

        {/* Dynamic Chat List (Real Users) */}
        <div className="flex-1 overflow-y-auto">
          {users.length === 0 ? (
            <p className="text-center text-gray-500 mt-10 text-sm">
              No other users found. Sign up with another account to chat!
            </p>
          ) : (
            users.map((user) => (
              <div
                key={user.id}
                onClick={() => router.push(`/chat/${user.id}`)}
                className="flex items-center px-4 py-3 hover:bg-[#202c33] cursor-pointer border-b border-gray-800 transition"
              >
                {/* 🔥 Friend-oda DP allathu Initial */}
                <div className="w-12 h-12 bg-[#00a884] rounded-full flex-shrink-0 flex items-center justify-center text-white font-bold text-lg uppercase overflow-hidden">
                  {user.avatarUrl ? (
                    <img
                      src={user.avatarUrl}
                      alt="DP"
                      className="w-full h-full object-cover"
                    />
                  ) : user.fullName ? (
                    user.fullName[0]
                  ) : (
                    user.email[0]
                  )}
                </div>
                <div className="ml-4 flex-1">
                  <h2 className="font-semibold text-white">
                    {user.fullName || user.email}
                  </h2>
                  <p className="text-sm text-gray-400 truncate">
                    Tap to start chat
                  </p>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* RIGHT SIDE - IDLE CHAT WINDOW */}
      <div className="hidden md:flex flex-1 flex-col relative bg-[#0b141a]">
        <div
          className="absolute inset-0 opacity-5 pointer-events-none"
          style={{
            backgroundImage:
              "url('https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d70fcded21.png')",
            backgroundSize: "contain",
          }}
        ></div>
        <div className="flex-1 flex items-center justify-center z-10">
          <div className="text-center">
            <h2 className="text-2xl text-gray-300 font-light mb-2">
              AuraChat for Web
            </h2>
            <p className="text-gray-500 text-sm">
              Select a user to start messaging.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
