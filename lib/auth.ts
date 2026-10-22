import { useSyncExternalStore } from 'react';
import * as Linking from 'expo-linking';
import { supabase } from './supabase';
import type { Session, User } from '@supabase/supabase-js';

type AuthState = {
  session: Session | null;
  user: User | null;
  loading: boolean;
  error: string | null;
};

let globalSession: Session | null = null;
let globalUser: User | null = null;
let globalLoading = true;
let listeners: Set<() => void> = new Set();
let snapshot: AuthState = { session: null, user: null, loading: true, error: null };

function notify() {
  listeners.forEach((l) => l());
}

export function setAuth(session: Session | null) {
  globalSession = session;
  globalUser = session?.user ?? null;
  globalLoading = false;
  snapshot = { session: globalSession, user: globalUser, loading: globalLoading, error: null };
  notify();
}

function setAuthError(message: string) {
  globalLoading = false;
  snapshot = { ...snapshot, loading: false, error: message };
  notify();
}

export function initializeAuth() {
  const {
    data: { subscription },
  } = supabase.auth.onAuthStateChange((_event, session) => {
    setAuth(session);
  });

  supabase.auth.getSession().then(({ data, error }) => {
    if (error) {
      setAuthError(error.message);
      return;
    }
    setAuth(data.session);
  }).catch((error: unknown) => {
    setAuthError(error instanceof Error ? error.message : 'Could not restore your session.');
  });

  return () => subscription.unsubscribe();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot(): AuthState {
  return snapshot;
}

export function useAuth(): AuthState {
  return useSyncExternalStore(subscribe, getSnapshot);
}

export type SignUpProfile = {
  full_name: string;
  role: 'student' | 'teacher';
};

export async function signUp(
  email: string,
  password: string,
  profile?: SignUpProfile
) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: profile ? { data: profile } : undefined,
  });
  if (!error && data.session) {
    setAuth(data.session);
  }
  return { data, error };
}

export async function signIn(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email: email.trim().toLowerCase(),
    password,
  });
  if (!error && data.session) {
    setAuth(data.session);
  }
  return { data, error };
}

export async function requestPasswordReset(email: string) {
  return supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
    redirectTo: Linking.createURL('reset-password'),
  });
}

export async function handlePasswordRecoveryUrl(url: string): Promise<boolean> {
  const [urlWithoutHash, hash = ''] = url.split('#', 2);
  const queryString = urlWithoutHash.split('?')[1] ?? '';
  const query = new URLSearchParams(queryString);
  const fragment = new URLSearchParams(hash);
  const getParameter = (name: string) => query.get(name) ?? fragment.get(name);
  const recoveryType = getParameter('type');
  const isResetPath = urlWithoutHash.includes('reset-password');

  if (recoveryType !== 'recovery' && !isResetPath) return false;

  const linkError = getParameter('error_description') ?? getParameter('error');
  if (linkError) throw new Error(linkError);

  const code = getParameter('code');
  const result = code
    ? await supabase.auth.exchangeCodeForSession(code)
    : await supabase.auth.setSession({
        access_token: getParameter('access_token') ?? '',
        refresh_token: getParameter('refresh_token') ?? '',
      });

  if (result.error) throw new Error(result.error.message);
  return true;
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (!error) setAuth(null);
  return { error: error?.message ?? null };
}