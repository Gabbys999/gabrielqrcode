import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { COLORS } from '@/constants/colors';
import {
  correctAttendanceTime,
  deleteAttendanceRecord,
  deleteManagedEvent,
  getAdminDashboardData,
  setManagedEventStatus,
  updateManagedEvent,
  updateAttendanceStatus,
  updateManagedProfile,
  type AdminDashboardData,
} from '@/lib/admin';
import { useAuth } from '@/lib/auth';
import type { Role } from '@/lib/profiles';
import { useRole } from '@/lib/role';

const ROLE_OPTIONS: Role[] = ['student', 'teacher', 'admin'];
const ATTENDANCE_STATUSES = ['present', 'late', 'excused', 'absent'] as const;

export default function AdminScreen() {
  const { user } = useAuth();
  const { role, loading: roleLoading, error: roleError } = useRole();
  const [dashboard, setDashboard] = useState<AdminDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [userNames, setUserNames] = useState<Record<string, string>>({});
  const [eventTitles, setEventTitles] = useState<Record<string, string>>({});
  const [eventStarts, setEventStarts] = useState<Record<string, string>>({});
  const [eventEnds, setEventEnds] = useState<Record<string, string>>({});
  const [eventVenues, setEventVenues] = useState<Record<string, string>>({});
  const [eventDescriptions, setEventDescriptions] = useState<Record<string, string>>({});
  const [attendanceTimes, setAttendanceTimes] = useState<Record<string, string>>({});

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
      setEventTitles(Object.fromEntries(data.events.map((event) => [event.id, event.title])));
      setEventStarts(
        Object.fromEntries(data.events.map((event) => [event.id, event.start_time ?? '']))
      );
      setEventEnds(Object.fromEntries(data.events.map((event) => [event.id, event.end_time ?? ''])));
      setEventVenues(Object.fromEntries(data.events.map((event) => [event.id, event.venue])));
      setEventDescriptions(
        Object.fromEntries(data.events.map((event) => [event.id, event.description]))
      );
      setAttendanceTimes(
        Object.fromEntries(
          data.attendance.map((record) => [record.id, new Date(record.scanned_at).toISOString()])
        )
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

  const nameById = new Map(dashboard.profiles.map((profile) => [profile.id, profile.full_name || profile.email]));
  const eventById = new Map(dashboard.events.map((event) => [event.id, event]));

  const confirmDeleteEvent = (eventId: string, title: string) => {
    Alert.alert('Delete event?', `This will also remove attendance for "${title}".`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => perform(eventId, () => deleteManagedEvent(eventId)),
      },
    ]);
  };

  const confirmDeleteAttendance = (id: string) => {
    Alert.alert('Delete attendance record?', 'This action cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => perform(id, () => deleteAttendanceRecord(id)),
      },
    ]);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Administrator Dashboard</Text>
      <Text style={styles.muted}>Manage users, events, attendance, and system records.</Text>
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
      <Text style={styles.reportTitle}>Attendance status report</Text>
      <View style={styles.summaryRow}>
        <SummaryCard label="Present" value={dashboard.totals.attendanceByStatus.present} />
        <SummaryCard label="Late" value={dashboard.totals.attendanceByStatus.late} />
      </View>
      <View style={styles.summaryRow}>
        <SummaryCard label="Excused" value={dashboard.totals.attendanceByStatus.excused} />
        <SummaryCard label="Absent" value={dashboard.totals.attendanceByStatus.absent} />
      </View>
      <Text style={styles.note}>Lists below show the latest 100 records in each category.</Text>

      <Section title="Manage users">
        {dashboard.profiles.map((profile) => (
          <View key={profile.id} style={styles.card}>
            <Text style={styles.muted}>{profile.email}</Text>
            <Text style={styles.smallMuted}>{profile.id}</Text>
            <TextInput
              value={userNames[profile.id] ?? ''}
              onChangeText={(value) =>
                setUserNames((current) => ({ ...current, [profile.id]: value }))
              }
              style={styles.input}
              placeholder="Full name"
              placeholderTextColor={COLORS.textSecondary}
            />
            <ActionButton
              title="Save name"
              disabled={savingId === profile.id || !(userNames[profile.id] ?? '').trim()}
              onPress={() =>
                perform(profile.id, () =>
                  updateManagedProfile(profile.id, {
                    full_name: (userNames[profile.id] ?? '').trim(),
                  })
                )
              }
            />
            {profile.id === user?.id ? (
              <Text style={styles.note}>Your own administrator role cannot be changed here.</Text>
            ) : (
              <View style={styles.chipRow}>
                {ROLE_OPTIONS.map((option) => (
                  <Pressable
                    key={option}
                    disabled={savingId === profile.id || profile.role === option}
                    onPress={() => perform(profile.id, () => updateManagedProfile(profile.id, { role: option }))}
                    style={[styles.roleChip, profile.role === option && styles.roleChipSelected]}
                  >
                    <Text style={[styles.roleChipText, profile.role === option && styles.roleChipTextSelected]}>
                      {option === 'admin' ? 'Admin' : option === 'teacher' ? 'Teacher' : 'Student'}
                    </Text>
                  </Pressable>
                ))}
              </View>
            )}
          </View>
        ))}
      </Section>

      <Section title="Manage events">
        {dashboard.events.length === 0 ? <Text style={styles.muted}>No events found.</Text> : null}
        {dashboard.events.map((event) => (
          <View key={event.id} style={styles.card}>
            <Text style={styles.muted}>{event.event_code}</Text>
            <TextInput
              value={eventTitles[event.id] ?? event.title}
              onChangeText={(value) => setEventTitles((current) => ({ ...current, [event.id]: value }))}
              style={styles.input}
              placeholder="Event title"
              placeholderTextColor={COLORS.textSecondary}
            />
            <TextInput
              value={eventVenues[event.id] ?? event.venue}
              onChangeText={(value) => setEventVenues((current) => ({ ...current, [event.id]: value }))}
              style={styles.input}
              placeholder="Venue"
              placeholderTextColor={COLORS.textSecondary}
            />
            <TextInput
              value={eventStarts[event.id] ?? ''}
              onChangeText={(value) => setEventStarts((current) => ({ ...current, [event.id]: value }))}
              style={styles.input}
              placeholder="Start time in ISO format"
              placeholderTextColor={COLORS.textSecondary}
              autoCapitalize="none"
            />
            <TextInput
              value={eventEnds[event.id] ?? ''}
              onChangeText={(value) => setEventEnds((current) => ({ ...current, [event.id]: value }))}
              style={styles.input}
              placeholder="End time in ISO format"
              placeholderTextColor={COLORS.textSecondary}
              autoCapitalize="none"
            />
            <TextInput
              value={eventDescriptions[event.id] ?? event.description}
              onChangeText={(value) =>
                setEventDescriptions((current) => ({ ...current, [event.id]: value }))
              }
              style={[styles.input, styles.multilineInput]}
              placeholder="Description"
              placeholderTextColor={COLORS.textSecondary}
              multiline
            />
            <Text style={styles.note}>Status: {event.status.toUpperCase()}</Text>
            <View style={styles.actionRow}>
              <ActionButton
                title="Save event details"
                disabled={
                  savingId === event.id ||
                  !(eventTitles[event.id] ?? '').trim() ||
                  !(eventVenues[event.id] ?? '').trim() ||
                  !(eventDescriptions[event.id] ?? '').trim() ||
                  !Number.isFinite(Date.parse(eventStarts[event.id] ?? '')) ||
                  !Number.isFinite(Date.parse(eventEnds[event.id] ?? '')) ||
                  Date.parse(eventEnds[event.id] ?? '') <= Date.parse(eventStarts[event.id] ?? '')
                }
                onPress={() =>
                  perform(event.id, () =>
                    updateManagedEvent(event.id, {
                      title: (eventTitles[event.id] ?? '').trim(),
                      start_time: new Date(eventStarts[event.id]).toISOString(),
                      end_time: new Date(eventEnds[event.id]).toISOString(),
                      venue: (eventVenues[event.id] ?? '').trim(),
                      description: (eventDescriptions[event.id] ?? '').trim(),
                    })
                  )
                }
              />
              <ActionButton
                title={event.status === 'open' ? 'Close event' : 'Reopen event'}
                disabled={savingId === event.id}
                onPress={() =>
                  perform(event.id, () =>
                    setManagedEventStatus(event.id, event.status === 'open' ? 'closed' : 'open')
                  )
                }
              />
              <ActionButton
                title="Delete event"
                danger
                disabled={savingId === event.id}
                onPress={() => confirmDeleteEvent(event.id, event.title)}
              />
            </View>
          </View>
        ))}
      </Section>

      <Section title="Overall attendance and corrections">
        {dashboard.attendance.length === 0 ? <Text style={styles.muted}>No attendance records found.</Text> : null}
        {dashboard.attendance.map((record) => {
          const event = eventById.get(record.event_id);
          return (
            <View key={record.id} style={styles.card}>
              <Text style={styles.itemTitle}>{event?.title ?? 'Event removed'}</Text>
              <Text style={styles.muted}>{nameById.get(record.student_id) ?? record.student_id}</Text>
              <TextInput
                value={attendanceTimes[record.id] ?? ''}
                onChangeText={(value) =>
                  setAttendanceTimes((current) => ({ ...current, [record.id]: value }))
                }
                style={styles.input}
                autoCapitalize="none"
                placeholder="Attendance time in ISO format"
                placeholderTextColor={COLORS.textSecondary}
              />
              <Text style={styles.note}>Enter a date/time such as 2026-10-20T08:30:00+08:00.</Text>
              <Text style={styles.note}>Attendance status: {record.status.toUpperCase()}</Text>
              <View style={styles.chipRow}>
                {ATTENDANCE_STATUSES.map((status) => (
                  <Pressable
                    key={status}
                    disabled={savingId === record.id || record.status === status}
                    onPress={() => perform(record.id, () => updateAttendanceStatus(record.id, status))}
                    style={[styles.roleChip, record.status === status && styles.roleChipSelected]}
                  >
                    <Text style={[styles.roleChipText, record.status === status && styles.roleChipTextSelected]}>
                      {status}
                    </Text>
                  </Pressable>
                ))}
              </View>
              <View style={styles.actionRow}>
                <ActionButton
                  title="Correct time"
                  disabled={savingId === record.id || !Number.isFinite(Date.parse(attendanceTimes[record.id] ?? ''))}
                  onPress={() =>
                    perform(record.id, () =>
                      correctAttendanceTime(record.id, new Date(attendanceTimes[record.id]).toISOString())
                    )
                  }
                />
                <ActionButton
                  title="Delete record"
                  danger
                  disabled={savingId === record.id}
                  onPress={() => confirmDeleteAttendance(record.id)}
                />
              </View>
            </View>
          );
        })}
      </Section>
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
  note: { color: COLORS.textSecondary, fontSize: 12, marginTop: 6 },
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
  reportTitle: { color: COLORS.textPrimary, fontSize: 16, fontWeight: '700', marginTop: 20 },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: COLORS.textPrimary, marginBottom: 10 },
  card: {
    backgroundColor: COLORS.card,
    borderColor: COLORS.border,
    borderWidth: 1,
    borderRadius: 10,
    padding: 14,
    marginBottom: 10,
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
  actionRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginTop: 10 },
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
