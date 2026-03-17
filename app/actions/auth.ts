"use server";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export async function signUp(formData: FormData) {
  const supabase = createClient();
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;

  const { error } = await supabase.auth.signUp({ email, password });
  if (error) return { error: error.message };
  return { success: true };
}

export async function signUpFieldMember(formData: FormData) {
  const supabase = createClient();
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;
  const inviteCode = (formData.get("invite_code") as string)?.trim().toUpperCase();

  if (!inviteCode || inviteCode.length !== 6) {
    return { error: "Enter the 6-character invite code from your employer." };
  }

  // Validate invite code exists before creating account
  const { data: company } = await supabase
    .from("companies")
    .select("id")
    .eq("invite_code", inviteCode)
    .maybeSingle();

  if (!company) {
    return { error: "Invalid invite code. Ask your employer to share their code from Settings → Team." };
  }

  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { invite_code: inviteCode, role: "field_member" } },
  });
  if (error) return { error: error.message };
  return { success: true };
}

export async function signIn(formData: FormData) {
  const supabase = createClient();
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;

  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { error: error.message };
  redirect("/jobs");
}

export async function signOut() {
  const supabase = createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

export async function updateEmail(
  formData: FormData
): Promise<{ success?: boolean; message?: string; error?: string }> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const email = (formData.get("email") as string)?.trim().toLowerCase();
  if (!email || !email.includes("@")) return { error: "Enter a valid email address" };
  if (email === user.email) return { error: "That is already your current email" };

  const { error } = await supabase.auth.updateUser({ email });
  if (error) return { error: error.message };
  return { success: true, message: "Check your new email address for a confirmation link." };
}

export async function updatePassword(
  formData: FormData
): Promise<{ success?: boolean; message?: string; error?: string }> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const password = formData.get("password") as string;
  const confirm = formData.get("confirm") as string;

  if (!password || password.length < 8)
    return { error: "Password must be at least 8 characters" };
  if (password !== confirm) return { error: "Passwords do not match" };

  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { error: error.message };
  return { success: true, message: "Password updated." };
}
