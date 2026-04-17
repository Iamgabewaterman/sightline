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
      Promise.all([
        supabase.from("profiles").select("display_name, avatar_path").eq("id", user.id).maybeSingle(),
        supabase.from("business_profiles").select("owner_name").eq("user_id", user.id).maybeSingle(),
      ]).then(([{ data: profile }, { data: bp }]) => {
        const name =
          profile?.display_name ||
          bp?.owner_name ||
          user.email?.split("@")[0] ||
          "Me";
        setDisplayName(name);
        if (profile?.avatar_path) setAvatarPath(profile.avatar_path);
      });
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!userId) return null;

  async function handleSaved(path: string) {
    setAvatarPath(path);
    const result = await updateProfileAvatar(path);
    if (result.error) throw new Error(result.error);
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
