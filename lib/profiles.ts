import { supabase } from './supabase';

export type Role = 'student' | 'teacher' | 'admin';

export type Profile = {
  id: string;
  email: string;
  full_name: string | null;
  role: Role;
  avatar_url: string | null;
};

export async function getProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, email, full_name, role, avatar_url')
    .eq('id', userId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return null;

  return data as Profile;
}

export async function updateProfile(
  userId: string,
  updates: { full_name?: string; role?: Role; avatar_url?: string | null }
): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from('profiles')
    .update(updates)
    .eq('id', userId);

  return { error: error?.message ?? null };
}

export async function uploadProfilePhoto(
  userId: string,
  uri: string,
  mimeType: string | null
): Promise<string> {
  const response = await fetch(uri);
  if (!response.ok) throw new Error('Could not read the selected photo.');
  const imageData = await response.arrayBuffer();
  const extension =
    mimeType === 'image/png' ? 'png' : mimeType === 'image/webp' ? 'webp' : 'jpg';
  const contentType =
    extension === 'png' ? 'image/png' : extension === 'webp' ? 'image/webp' : 'image/jpeg';
  const path = `${userId}/avatar.${extension}`;

  const { error: uploadError } = await supabase.storage
    .from('profile-photos')
    .upload(path, imageData, { contentType, upsert: true, cacheControl: '3600' });

  if (uploadError) throw new Error(uploadError.message);

  const { data } = supabase.storage.from('profile-photos').getPublicUrl(path);
  return `${data.publicUrl}?updated=${Date.now()}`;
}