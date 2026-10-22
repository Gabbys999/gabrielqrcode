import Ionicons from '@expo/vector-icons/Ionicons';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { COLORS } from '@/constants/colors';
import {
  getAdminDashboardData,
  updateManagedProfile,
  type AdminDashboardData,
} from '@/lib/admin';
import { useAuth } from '@/lib/auth';
import type { Role } from '@/lib/profiles';
import { useRole } from '@/lib/role';
import { TeacherEventTools } from './teacher';

const ROLE_OPTIONS: Role[] = ['student', 'teacher'];

export default function AdminScreen() {
  const { user } = useAuth();
  const { role, loading: roleLoading, error: roleError } = useRole();
  const [dashboard, setDashboard] = useState<AdminDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [userNames, setUserNames] = useState<Record<string, string>>({});
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null);
  const [expandedUserGroups, setExpandedUserGroups] = useState<Record<Role, boolean>>({
    admin: false,
    teacher: false,
    student: false,
  });

  const load = useCallback(async () => {
    if (!user || role !== 'admin') {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await getAdminDashboardData();
      setDashboard(data);
      setUserNames(
        Object.fromEntries(data.profiles.map((profile) => [profile.id, profile.full_name ?? '']))
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load administrator records.');
    } finally {
      setLoading(false);
    }
  }, [role, user]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const perform = async (id: string, action: () => Promise<void>) => {
    setSavingId(id);
    setError(null);
    try {
      await action();
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The change could not be saved.');
    } finally {
      setSavingId(null);
    }
  };

  if (roleLoading || loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={COLORS.primary} />
        <Text style={styles.muted}>Loading administrator records...</Text>
      </View>
    );
  }

  if (role !== 'admin') {
    return (
      <View style={styles.centered}>
        <Text style={styles.title}>{roleError ?? 'Administrator access required'}</Text>
      </View>
    );
  }

  if (!dashboard) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Administrator</Text>
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <Pressable style={styles.actionButton} onPress={load}>
          <Text style={styles.actionText}>Try again</Text>
        </Pressable>
      </View>
    );
  }

  const managedProfiles = dashboard.profiles.filter((profile) => profile.role !== 'admin');
  const teacherProfiles = managedProfiles.filter((profile) => profile.role === 'teacher');
  const studentProfiles = managedProfiles.filter((profile) => profile.role === 'student');
  const selectedProfile = managedProfiles.find((profile) => profile.id === selectedProfileId);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Administrator Dashboard</Text>
      <Text style={styles.muted}>Manage users, attendance, and system records.</Text>
      {error ? <Text style={styles.error}>{error}</Text> : null}

      <View style={styles.summaryRow}>
        <SummaryCard label="Users" value={dashboard.totals.users} />
        <SummaryCard label="Events" value={dashboard.totals.events} />
        <SummaryCard label="Attendance" value={dashboard.totals.attendance} />
      </View>
      <View style={styles.summaryRow}>
        <SummaryCard label="Open events" value={dashboard.totals.openEvents} />
        <SummaryCard label="Closed events" value={dashboard.totals.closedEvents} />
      </View>
      <Section title="Manage users">
        {selectedProfile ? (
          <>
            <Pressable
              accessibilityRole="button"
              disabled={!!savingId}
              onPress={() => setSelectedProfileId(null)}
              style={styles.backButton}
            >
              <Ionicons name="arrow-back" size={18} color={COLORS.primary} />
              <Text style={styles.backText}>Back</Text>
            </Pressable>
            <Text style={styles.selectedUserName}>
              {selectedProfile.full_name || selectedProfile.email}
            </Text>
            <View style={styles.card}>
              <Text style={styles.muted}>{selectedProfile.email}</Text>
              <Text style={styles.smallMuted}>{selectedProfile.id}</Text>
              <TextInput
                value={userNames[selectedProfile.id] ?? ''}
                onChangeText={(value) =>
                  setUserNames((current) => ({ ...current, [selectedProfile.id]: value }))
                }
                style={styles.input}
                placeholder="Full name"
                placeholderTextColor={COLORS.textSecondary}
              />
              <ActionButton
                title="Save name"
                disabled={
                  savingId === selectedProfile.id ||
                  !(userNames[selectedProfile.id] ?? '').trim()
                }
                onPress={() =>
                  perform(selectedProfile.id, () =>
                    updateManagedProfile(selectedProfile.id, {
                      full_name: (userNames[selectedProfile.id] ?? '').trim(),
                    })
                  )
                }
              />
              <View style={styles.chipRow}>
                {ROLE_OPTIONS.map((option) => (
                  <Pressable
                    key={option}
                    disabled={savingId === selectedProfile.id || selectedProfile.role === option}
                    onPress={() =>
                      perform(selectedProfile.id, () =>
                        updateManagedProfile(selectedProfile.id, { role: option })
                      )
                    }
                    style={[
                      styles.roleChip,
                      selectedProfile.role === option && styles.roleChipSelected,
                    ]}
                  >
                    <Text
                      style={[
                        styles.roleChipText,
                        selectedProfile.role === option && styles.roleChipTextSelected,
                      ]}
                    >
                      {option === 'teacher' ? 'Teacher' : 'Student'}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>
          </>
        ) : (
          <>
            {[
              { title: 'Teachers', role: 'teacher' as const, profiles: teacherProfiles },
              { title: 'Students', role: 'student' as const, profiles: studentProfiles },
            ].map(({ title, role: groupRole, profiles }) => {
              const expanded = expandedUserGroups[groupRole];
              return (
                <View key={groupRole} style={styles.userGroup}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityState={{ expanded }}
                    onPress={() =>
                      setExpandedUserGroups((current) => ({
                        ...current,
                        [groupRole]: !current[groupRole],
                      }))
                    }
                    style={({ pressed }) => [
                      styles.userGroupHeader,
                      pressed && styles.userRowPressed,
                    ]}
                  >
                    <Text style={styles.userGroupTitle}>
                      {title} ({profiles.length})
                    </Text>
                    <Ionicons
                      name={expanded ? 'chevron-up' : 'chevron-down'}
                      size={20}
                      color={COLORS.textSecondary}
                    />
                  </Pressable>
                  {expanded ? (
                    <View style={styles.userGroupContent}>
                      {profiles.length === 0 ? (
                        <Text style={styles.muted}>No {title.toLowerCase()} found.</Text>
                      ) : (
                        profiles.map((profile, index) => (
                          <Pressable
                            key={profile.id}
                            accessibilityRole="button"
                            style={({ pressed }) => [
                              styles.groupUserRow,
                              index < profiles.length - 1 && styles.groupUserRowBorder,
                              pressed && styles.userRowPressed,
                            ]}
                            onPress={() => setSelectedProfileId(profile.id)}
                          >
                            <View style={styles.userAvatar}>
                              {profile.avatar_url ? (
                                <Image
                                  source={{ uri: profile.avatar_url }}
                                  style={styles.userAvatarImage}
                                />
                              ) : (
                                <Ionicons name="person" size={20} color={COLORS.textSecondary} />
                              )}
                            </View>
                            <Text style={styles.userRowText} numberOfLines={1}>
                              {profile.full_name || profile.email}
                            </Text>
                          </Pressable>
                        ))
                      )}
                    </View>
                  ) : null}
                </View>
              );
            })}
          </>
        )}
      </Section>
      <TeacherEventTools embedded />

    </ScrollView>
  );
}

function SummaryCard({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.summaryCard}>
      <Text style={styles.summaryValue}>{value}</Text>
      <Text style={styles.summaryLabel}>{label}</Text>
    </View>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

function ActionButton({
  title,
  onPress,
  disabled,
  danger = false,
}: {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  danger?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={[styles.actionButton, danger && styles.dangerButton, disabled && styles.disabledButton]}
    >
      <Text style={styles.actionText}>{title}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  content: { padding: 20, paddingBottom: 40 },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    backgroundColor: COLORS.background,
    padding: 24,
  },
  title: { fontSize: 22, fontWeight: '700', color: COLORS.textPrimary, marginBottom: 8 },
  muted: { fontSize: 14, color: COLORS.textSecondary, marginBottom: 6 },
  smallMuted: { color: COLORS.textSecondary, fontSize: 11, marginTop: 4 },
  error: { color: COLORS.danger, marginVertical: 10 },
  summaryRow: { flexDirection: 'row', gap: 8, marginTop: 16 },
  summaryCard: {
    flex: 1,
    backgroundColor: COLORS.card,
    borderColor: COLORS.border,
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    alignItems: 'center',
  },
  summaryValue: { fontSize: 22, fontWeight: '700', color: COLORS.primary },
  summaryLabel: { fontSize: 12, color: COLORS.textSecondary, marginTop: 4 },
  section: { marginTop: 24 },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: COLORS.textPrimary, marginBottom: 10 },
  card: {
    backgroundColor: COLORS.card,
    borderColor: COLORS.border,
    borderWidth: 1,
    borderRadius: 10,
    padding: 14,
    marginBottom: 10,
  },
  userGroup: {
    backgroundColor: COLORS.card,
    borderColor: COLORS.border,
    borderWidth: 1,
    borderRadius: 10,
    overflow: 'hidden',
    marginBottom: 10,
  },
  userGroupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
  },
  userGroupTitle: {
    color: COLORS.textPrimary,
    fontSize: 16,
    fontWeight: '700',
  },
  userGroupContent: { paddingHorizontal: 14 },
  groupUserRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
  },
  groupUserRowBorder: { borderBottomColor: COLORS.border, borderBottomWidth: 1 },
  userAvatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: COLORS.background,
    borderColor: COLORS.border,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  userAvatarImage: { width: '100%', height: '100%' },
  userRowPressed: { opacity: 0.65 },
  userRowText: { color: COLORS.textPrimary, fontSize: 15, fontWeight: '600' },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingVertical: 6,
  },
  backText: { color: COLORS.primary, fontSize: 15, fontWeight: '600', marginLeft: 5 },
  selectedUserName: {
    color: COLORS.textPrimary,
    fontSize: 17,
    fontWeight: '700',
    marginTop: 12,
    marginBottom: 8,
  },
  itemTitle: { color: COLORS.textPrimary, fontSize: 15, fontWeight: '600', marginBottom: 4 },
  chipRow: { flexDirection: 'row', gap: 8, marginTop: 12 },
  roleChip: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  roleChipSelected: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  roleChipText: { color: COLORS.textSecondary, fontSize: 12, fontWeight: '600' },
  roleChipTextSelected: { color: COLORS.textOnPrimary },
  input: {
    borderColor: COLORS.border,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 9,
    color: COLORS.textPrimary,
    marginTop: 8,
  },
  multilineInput: { minHeight: 76, textAlignVertical: 'top' },
  actionButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  dangerButton: { backgroundColor: COLORS.danger },
  disabledButton: { opacity: 0.5 },
  actionText: { color: COLORS.textOnPrimary, fontSize: 12, fontWeight: '700' },
});
