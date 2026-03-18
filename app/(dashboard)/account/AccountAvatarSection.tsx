"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import AvatarUpload from "@/components/AvatarUpload";
import { updateProfileAvatar } from "@/app/actions/avatar";

export default function AccountAvatarSection() {
  const supabase = createClient();
  const [userId, setUserId] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState("Me");
  const [avatarPath, setAvatarPath] = useState<string | null>(null);
  const [email, setEmail] = useState("");

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      setUserId(user.id);
      setEmail(user.email ?? "");
      supabase
        .from("profiles")
        .select("display_name, avatar_path")
        .eq("id", user.id)
        .maybeSingle()
        .then(({ data }) => {
          if (data?.display_name) setDisplayName(data.display_name);
          if (data?.avatar_path) setAvatarPath(data.avatar_path);
        });
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!userId) return null;

  async function handleSaved(path: string) {
    setAvatarPath(path);
    await updateProfileAvatar(path);
  }

  return (
    <div className="flex items-center gap-4 bg-[#1A1A1A] border border-[#2a2a2a] rounded-xl px-5 py-4">
      <AvatarUpload
        name={displayName}
        currentAvatarPath={avatarPath}
        storagePath={`users/${userId}`}
        onSaved={handleSaved}
        size={72}
      />
      <div className="min-w-0">
        <p className="text-white font-semibold text-base truncate">{displayName}</p>
        <p className="text-gray-500 text-sm truncate">{email}</p>
        <p className="text-gray-600 text-xs mt-1">Tap photo to change</p>
      </div>
    </div>
  );
}
