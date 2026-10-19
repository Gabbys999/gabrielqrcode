import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';

import { useAuth } from './auth';
import { getProfile, type Role } from './profiles';

export function useRole(): { role: Role | null; loading: boolean; error: string | null } {
  const { user } = useAuth();
  const [role, setRole] = useState<Role | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      let active = true;

      if (!user) {
        setRole(null);
        setError(null);
        setLoading(false);
        return () => {
          active = false;
        };
      }

      setLoading(true);
      setError(null);
      getProfile(user.id)
        .then((profile) => {
          if (!active) return;
          setRole(profile?.role ?? 'student');
          setLoading(false);
        })
        .catch((err: unknown) => {
          if (!active) return;
          setRole(null);
          setError(err instanceof Error ? err.message : 'Could not load your account role.');
          setLoading(false);
        });

      return () => {
        active = false;
      };
    }, [user])
  );

  return { role, loading, error };
}