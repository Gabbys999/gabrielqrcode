import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import { COLORS } from '@/constants/colors';
import { getAdminEventAttendance, type AdminEventAttendance } from '@/lib/admin';
import { getTeacherEventAttendance, type TeacherEventAttendance } from '@/lib/attendance';
import { useAuth } from '@/lib/auth';
import { getAttendanceHistory, type AttendanceRecord } from '@/lib/attendance';
import { getAdminHistoryStatus } from '@/lib/events';
import { getProfile, type Role } from '@/lib/profiles';

export default function HistoryScreen() {
  const router = useRouter();
  const { user } = useAuth();

  const [role, setRole] = useState<Role | null>(null);
  const [studentRecords, setStudentRecords] = useState<AttendanceRecord[]>([]);
  const [teacherEvents, setTeacherEvents] = useState<TeacherEventAttendance[]>([]);
  const [adminEvents, setAdminEvents] = useState<AdminEventAttendance[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const profile = await getProfile(user.id);
      const currentRole: Role = profile?.role ?? 'student';
      setRole(currentRole);

      if (currentRole === 'admin') {
        const events = await getAdminEventAttendance();
        setAdminEvents(events);
        setTeacherEvents([]);
        setStudentRecords([]);
      } else if (currentRole === 'teacher') {
        const events = await getTeacherEventAttendance(user.id);
        setTeacherEvents(events);
        setAdminEvents([]);
        setStudentRecords([]);
      } else {
        const records = await getAttendanceHistory(user.id);
        setStudentRecords(records);
        setTeacherEvents([]);
        setAdminEvents([]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load attendance history.');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  useFocusEffect(
    useCallback(() => {
      if (role !== 'admin') return;

      const timer = setInterval(() => {
        getAdminEventAttendance()
          .then(setAdminEvents)
          .catch((err: unknown) => {
            setError(err instanceof Error ? err.message : 'Could not refresh event attendance.');
          });
      }, 60_000);

      return () => clearInterval(timer);
    }, [role])
  );

  if (loading) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Attendance History</Text>
        <Text style={styles.subtitle}>Loading records...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Attendance History</Text>
        <Text style={styles.subtitle}>{error}</Text>
        <Pressable style={styles.retryButton} onPress={load}>
          <Text style={styles.retryText}>Try again</Text>
        </Pressable>
      </View>
    );
  }

  if (role === 'admin' || role === 'teacher') {
    const isAdmin = role === 'admin';
    const title = isAdmin ? 'All Event Attendance' : 'Event Attendance';
    const sortedAdminEvents = [...adminEvents].sort((first, second) => {
      const order = { NEW: 0, 'COMING SOON': 1, DONE: 2 };
      return (
        order[getAdminHistoryStatus(first.eventStatus, first.startTime)] -
        order[getAdminHistoryStatus(second.eventStatus, second.startTime)]
      );
    });
    const emptyMessage = isAdmin
      ? 'No events found.'
      : "You haven't created any events yet. Use the Teacher tab to create one.";

    return (
      <View style={styles.container}>
        <Text style={styles.title}>{title}</Text>

        {isAdmin ? (
          <>
            {adminEvents.length === 0 ? (
              <Text style={styles.subtitle}>{emptyMessage}</Text>
            ) : (
              <FlatList
                data={sortedAdminEvents}
                keyExtractor={(item) => item.eventId}
                contentContainerStyle={styles.list}
                renderItem={({ item }) => {
                const status = getAdminHistoryStatus(item.eventStatus, item.startTime);
                const statusStyle =
                  status === 'DONE'
                    ? styles.eventStatusDONE
                    : status === 'NEW'
                      ? styles.eventStatusNEW
                      : styles.eventStatusCOMINGSOON;
                return (
                  <Pressable
                    accessibilityRole="button"
                    style={({ pressed }) => [
                      styles.card,
                      styles.adminCard,
                      pressed && styles.cardPressed,
                    ]}
                    onPress={() =>
                      router.push({
                        pathname: '/(tabs)/event-attendance',
                        params: { eventId: item.eventId },
                      })
                    }
                  >
                    <View style={styles.cardHeaderText}>
                      <Text style={styles.eventTitle}>{item.title}</Text>
                      <Text style={styles.eventMeta}>{item.eventCode}</Text>
                      {item.startTime ? (
                        <Text style={styles.eventMeta}>{formatDate(item.startTime)}</Text>
                      ) : null}
                    </View>
                    <View style={styles.attendanceHeaderEnd}>
                      <View style={styles.adminBadgeRow}>
                        <Text style={[styles.eventStatus, statusStyle]}>{status}</Text>
                        <View style={styles.countBadge}>
                          <Text style={styles.countText}>{item.attendeeCount}</Text>
                        </View>
                      </View>
                      <Text style={styles.expandHint}>View attendees</Text>
                    </View>
                  </Pressable>
                );
                }}
              />
            )}
          </>
        ) : teacherEvents.length === 0 ? (
          <Text style={styles.subtitle}>{emptyMessage}</Text>
        ) : (
          <FlatList
            data={[...teacherEvents].sort(
              (first, second) =>
                Number(
                  first.eventStatus === 'closed' ||
                    (!!first.endTime && new Date(first.endTime).getTime() <= Date.now())
                ) -
                Number(
                  second.eventStatus === 'closed' ||
                    (!!second.endTime && new Date(second.endTime).getTime() <= Date.now())
                )
            )}
            keyExtractor={(item) => item.eventId}
            contentContainerStyle={styles.list}
            renderItem={({ item }) => (
              <Pressable
                accessibilityRole="button"
                style={({ pressed }) => [
                  styles.card,
                  styles.adminCard,
                  pressed && styles.cardPressed,
                ]}
                onPress={() =>
                  router.push({
                    pathname: '/(tabs)/event-attendance',
                    params: { eventId: item.eventId },
                  })
                }
              >
                <View style={styles.cardHeaderText}>
                  <Text style={styles.eventTitle}>{item.title}</Text>
                  <Text style={styles.eventMeta}>{item.eventCode}</Text>
                  {item.startTime ? (
                    <Text style={styles.eventMeta}>{formatDate(item.startTime)}</Text>
                  ) : null}
                </View>
                <View style={styles.attendanceHeaderEnd}>
                  <View style={styles.adminBadgeRow}>
                    {(item.eventStatus === 'closed' ||
                      (!!item.endTime && new Date(item.endTime).getTime() <= Date.now())) ? (
                      <Text style={[styles.eventStatus, styles.eventStatusDONE]}>DONE</Text>
                    ) : null}
                    <View style={styles.countBadge}>
                      <Text style={styles.countText}>{item.attendeeCount}</Text>
                    </View>
                  </View>
                  <Text style={styles.expandHint}>View attendees</Text>
                </View>
              </Pressable>
            )}
          />
        )}
      </View>
    );
  }

  /* -------------------------- Student view -------------------------- */
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Attendance History</Text>

      {studentRecords.length === 0 ? (
        <Text style={styles.subtitle}>
          No records yet. Scan a QR code to register your attendance.
        </Text>
      ) : (
        <FlatList
          data={studentRecords}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => {
            const status = getStudentAttendanceStatus(item);
            const statusStyle =
              status === 'LATE'
                ? styles.studentLateStatus
                : status === 'ABSENT'
                  ? styles.studentAbsentStatus
                  : status === 'EXCUSED'
                    ? styles.studentExcusedStatus
                    : styles.studentPresentStatus;
            return (
              <View style={styles.card}>
                <Text style={styles.eventTitle}>{item.eventTitle}</Text>
                <Text style={styles.eventMeta}>{item.eventId}</Text>
                <Text style={styles.eventMeta}>{formatDate(item.scannedAt)}</Text>
                <View style={styles.studentStatusRow}>
                  <Text style={styles.eventMeta}>Status:</Text>
                  <Text style={[styles.studentStatusBadge, statusStyle]}>{status}</Text>
                </View>
              </View>
            );
          }}
        />
      )}
    </View>
  );
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString();
}

function getStudentAttendanceStatus(
  record: AttendanceRecord
): 'PRESENT' | 'LATE' | 'EXCUSED' | 'ABSENT' {
  if (record.status === 'excused') return 'EXCUSED';
  if (record.status === 'absent') return 'ABSENT';

  if (
    record.eventStart &&
    new Date(record.scannedAt).getTime() >
      new Date(record.eventStart).getTime() + 60 * 60 * 1000
  ) {
    return 'LATE';
  }

  return 'PRESENT';
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    paddingHorizontal: 24,
    paddingTop: 24,
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    color: COLORS.textPrimary,
    marginBottom: 16,
  },
  subtitle: {
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    marginTop: 32,
  },
  list: {
    paddingBottom: 24,
  },
  card: {
    backgroundColor: COLORS.card,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 16,
    marginBottom: 12,
  },
  cardPressed: { opacity: 0.7 },
  adminCard: { flexDirection: 'row', alignItems: 'center' },
  cardHeaderText: { flex: 1, paddingRight: 12 },
  eventTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.textPrimary,
    marginBottom: 4,
  },
  eventMeta: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  studentStatusRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 },
  studentStatusBadge: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.5,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 6,
  },
  studentPresentStatus: { color: COLORS.success, backgroundColor: '#E8F5E9' },
  studentLateStatus: { color: '#8A5A00', backgroundColor: '#FFF3CD' },
  studentAbsentStatus: { color: COLORS.danger, backgroundColor: '#FDECEA' },
  studentExcusedStatus: { color: COLORS.textSecondary, backgroundColor: COLORS.surface },
  countBadge: {
    minWidth: 36,
    height: 36,
    borderRadius: 18,
    paddingHorizontal: 8,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  countText: { color: COLORS.textOnPrimary, fontSize: 15, fontWeight: '700' },
  attendanceHeaderEnd: { alignItems: 'center', gap: 4 },
  adminBadgeRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  expandHint: { color: COLORS.primary, fontSize: 11, fontWeight: '600' },
  eventStatus: {
    alignSelf: 'center',
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 1,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    marginTop: 0,
  },
  eventStatusDONE: { color: COLORS.danger, backgroundColor: '#FDECEA' },
  eventStatusNEW: { color: COLORS.success, backgroundColor: '#E8F5E9' },
  eventStatusCOMINGSOON: { color: '#8A5A00', backgroundColor: '#FFF3CD' },
  retryButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 8,
    padding: 12,
    alignSelf: 'center',
    marginTop: 16,
  },
  retryText: { color: COLORS.textOnPrimary, fontWeight: '700' },
});