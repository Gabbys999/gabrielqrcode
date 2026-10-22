import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { COLORS } from '@/constants/colors';
import {
  getAdminEventAttendanceDetail,
  type AdminEventAttendanceDetail,
} from '@/lib/admin';
import {
  getTeacherEventAttendanceDetail,
  type TeacherEventAttendanceDetail,
} from '@/lib/attendance';
import { useAuth } from '@/lib/auth';
import { getAdminHistoryStatus } from '@/lib/events';
import { useRole } from '@/lib/role';

type EventAttendanceDetail = AdminEventAttendanceDetail | TeacherEventAttendanceDetail;

export default function EventAttendanceScreen() {
  const { eventId } = useLocalSearchParams<{ eventId?: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const { role, loading: roleLoading } = useRole();
  const [event, setEvent] = useState<EventAttendanceDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (showLoading = true) => {
    const teacherId = user?.id;
    if ((role !== 'admin' && role !== 'teacher') || !eventId) {
      setLoading(false);
      return;
    }
    if (role === 'teacher' && !teacherId) {
      setLoading(false);
      return;
    }
    if (showLoading) setLoading(true);
    setError(null);
    try {
      const result = role === 'admin'
        ? await getAdminEventAttendanceDetail(eventId)
        : teacherId
          ? await getTeacherEventAttendanceDetail(teacherId, eventId)
          : null;
      if (!result) throw new Error('This event could not be found.');
      setEvent(result);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Could not load event attendees.');
    } finally {
      if (showLoading) setLoading(false);
    }
  }, [eventId, role, user]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  useFocusEffect(
    useCallback(() => {
      if ((role !== 'admin' && role !== 'teacher') || !eventId) return;

      const timer = setInterval(() => {
        void load(false);
      }, 60_000);

      return () => clearInterval(timer);
    }, [eventId, load, role])
  );

  if (roleLoading || loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={COLORS.primary} />
        <Text style={styles.muted}>Loading event attendees...</Text>
      </View>
    );
  }

  if (role !== 'admin' && role !== 'teacher') {
    return (
      <View style={styles.centered}>
        <Text style={styles.title}>Teacher or administrator access required.</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Pressable
        accessibilityRole="button"
        onPress={() => router.replace('/(tabs)/history')}
        style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}
      >
        <Text style={styles.backText}>
          ‹  {role === 'admin' ? 'Back to All Event Attendance' : 'Back to Event Attendance'}
        </Text>
      </Pressable>

      {error ? (
        <View>
          <Text style={styles.error}>{error}</Text>
          <Pressable onPress={() => load()} style={styles.retryButton}>
            <Text style={styles.retryText}>Try again</Text>
          </Pressable>
        </View>
      ) : event ? (
        <View style={styles.eventCard}>
          <View style={styles.eventHeader}>
            <Text style={styles.title}>{event.title}</Text>
            <Text style={styles.meta}>{event.eventCode}</Text>
            {event.startTime ? <Text style={styles.meta}>{formatDate(event.startTime)}</Text> : null}
            {role === 'admin' ? (
              <Text
                style={[
                  styles.eventStatus,
                  event.eventStatus === 'closed'
                    ? styles.eventStatusDONE
                    : event.startTime && new Date(event.startTime).getTime() > Date.now()
                      ? styles.eventStatusCOMINGSOON
                      : styles.eventStatusNEW,
                ]}
              >
                {getAdminHistoryStatus(event.eventStatus, event.startTime)}
              </Text>
            ) : null}
            <Text style={styles.attendeeCount}>
              {event.attendeeCount} {event.attendeeCount === 1 ? 'student' : 'students'} attended
            </Text>
          </View>

          {event.attendees.length === 0 ? (
            <Text style={styles.empty}>No students have scanned this event QR code yet.</Text>
          ) : (
            event.attendees.map((attendee, index) => (
              <View
                key={`${attendee.studentId}-${attendee.scannedAt}`}
                style={[styles.attendeeRow, index === 0 && styles.firstAttendeeRow]}
              >
                <View style={styles.attendeeNumber}>
                  <Text style={styles.attendeeNumberText}>{index + 1}</Text>
                </View>
                <View style={styles.avatar}>
                  {'avatarUrl' in attendee && attendee.avatarUrl ? (
                    <Image
                      source={{ uri: attendee.avatarUrl }}
                      style={styles.avatarImage}
                      contentFit="cover"
                    />
                  ) : (
                    <Ionicons name="person" size={20} color={COLORS.textSecondary} />
                  )}
                </View>
                <View style={styles.attendeeInfo}>
                  <Text style={styles.studentName}>{attendee.studentName}</Text>
                  <Text style={styles.meta}>{formatDate(attendee.scannedAt)}</Text>
                  <View style={styles.attendanceStatusRow}>
                    <Text style={styles.status}>Status:</Text>
                    <Text
                      style={[
                        styles.attendanceStatusBadge,
                        getAttendeeStatusStyle(
                          getAttendeeStatus(attendee.status, event.startTime, attendee.scannedAt)
                        ),
                      ]}
                    >
                      {getAttendeeStatus(attendee.status, event.startTime, attendee.scannedAt)}
                    </Text>
                  </View>
                </View>
              </View>
            ))
          )}

          {(event.eventStatus === 'closed' ||
            (!!event.endTime && new Date(event.endTime).getTime() <= Date.now())) ? (
            <View style={styles.absentSection}>
              <Text style={styles.absentTitle}>Absent ({event.absentStudents.length})</Text>
              {event.absentStudents.length === 0 ? (
                <Text style={styles.empty}>All students scanned this event.</Text>
              ) : (
                event.absentStudents.map((student) => (
                  <View key={student.studentId} style={styles.attendeeRow}>
                    <View style={styles.avatar}>
                      {student.avatarUrl ? (
                        <Image
                          source={{ uri: student.avatarUrl }}
                          style={styles.avatarImage}
                          contentFit="cover"
                        />
                      ) : (
                        <Ionicons name="person" size={20} color={COLORS.textSecondary} />
                      )}
                    </View>
                    <View style={styles.attendeeInfo}>
                      <Text style={styles.studentName}>{student.studentName}</Text>
                      <View style={styles.attendanceStatusRow}>
                        <Text style={styles.status}>Status:</Text>
                        <Text style={[styles.attendanceStatusBadge, styles.absentStatus]}>
                          ABSENT
                        </Text>
                      </View>
                    </View>
                  </View>
                ))
              )}
            </View>
          ) : null}

        </View>
      ) : null}
    </ScrollView>
  );
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString();
}

function getAttendeeStatus(
  status: string,
  eventStart: string | null,
  scannedAt: string
) {
  if (status === 'excused' || status === 'absent') return status.toUpperCase();

  if (
    eventStart &&
    new Date(scannedAt).getTime() > new Date(eventStart).getTime() + 60 * 60 * 1000
  ) {
    return 'LATE';
  }

  return 'PRESENT';
}

function getAttendeeStatusStyle(status: string) {
  if (status === 'LATE') return styles.lateStatus;
  if (status === 'ABSENT') return styles.absentStatus;
  if (status === 'EXCUSED') return styles.excusedStatus;
  return styles.presentStatus;
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
  title: { color: COLORS.textPrimary, fontSize: 20, fontWeight: '700' },
  muted: { color: COLORS.textSecondary, fontSize: 14 },
  meta: { color: COLORS.textSecondary, fontSize: 13, marginTop: 4 },
  eventStatus: {
    alignSelf: 'flex-start',
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: 1,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    marginTop: 8,
  },
  eventStatusDONE: { color: COLORS.danger, backgroundColor: '#FDECEA' },
  eventStatusNEW: { color: COLORS.success, backgroundColor: '#E8F5E9' },
  eventStatusCOMINGSOON: { color: '#8A5A00', backgroundColor: '#FFF3CD' },
  backButton: { alignSelf: 'flex-start', paddingVertical: 8, marginBottom: 10 },
  backText: { color: COLORS.primary, fontSize: 15, fontWeight: '600' },
  pressed: { opacity: 0.65 },
  eventCard: {
    backgroundColor: COLORS.card,
    borderColor: COLORS.border,
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
  },
  eventHeader: { paddingBottom: 14 },
  attendeeCount: {
    color: COLORS.primary,
    fontSize: 14,
    fontWeight: '700',
    marginTop: 10,
  },
  absentSection: { marginTop: 16 },
  absentTitle: {
    color: COLORS.danger,
    fontSize: 17,
    fontWeight: '700',
    paddingTop: 14,
    borderTopColor: COLORS.border,
    borderTopWidth: 1,
  },
  attendeeRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderTopColor: COLORS.border,
    borderTopWidth: 1,
    paddingVertical: 14,
    gap: 12,
  },
  firstAttendeeRow: { borderTopWidth: 1 },
  attendeeNumber: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.surface,
  },
  attendeeNumberText: { color: COLORS.primary, fontSize: 13, fontWeight: '700' },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.surface,
    overflow: 'hidden',
  },
  avatarImage: { width: '100%', height: '100%' },
  attendeeInfo: { flex: 1 },
  studentName: { color: COLORS.textPrimary, fontSize: 15, fontWeight: '600' },
  status: { color: COLORS.textSecondary, fontSize: 12, marginTop: 4 },
  attendanceStatusRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  attendanceStatusBadge: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 5,
    overflow: 'hidden',
  },
  presentStatus: { color: '#18723A', backgroundColor: '#E8F5E9' },
  lateStatus: { color: '#8A5A00', backgroundColor: '#FFF3CD' },
  absentStatus: { color: COLORS.danger, backgroundColor: '#FDECEA' },
  excusedStatus: { color: COLORS.textSecondary, backgroundColor: COLORS.surface },
  empty: { borderTopColor: COLORS.border, borderTopWidth: 1, paddingTop: 14, color: COLORS.textSecondary },
  error: { color: COLORS.danger, fontSize: 14, marginVertical: 12 },
  retryButton: {
    alignSelf: 'flex-start',
    backgroundColor: COLORS.primary,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  retryText: { color: COLORS.textOnPrimary, fontWeight: '700' },
});
