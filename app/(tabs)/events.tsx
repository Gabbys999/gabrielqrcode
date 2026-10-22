import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { COLORS } from '@/constants/colors';
import { getStudentEvents, type CloudEvent } from '@/lib/events';

export default function EventsScreen() {
  const [events, setEvents] = useState<CloudEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(Date.now());

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setEvents(await getStudentEvents());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load available events.');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  useFocusEffect(
    useCallback(() => {
      const updateTime = () => setCurrentTime(Date.now());
      let timer: ReturnType<typeof setTimeout>;

      const scheduleNextUpdate = () => {
        const now = Date.now();
        const nextTransition = events
          .flatMap((event) => [event.start_time, event.end_time])
          .filter((time): time is string => time !== null)
          .map((time) => new Date(time).getTime())
          .filter((time) => time > now)
          .sort((first, second) => first - second)[0];
        const delay = nextTransition ? nextTransition - now + 50 : 60_000;

        timer = setTimeout(() => {
          updateTime();
          scheduleNextUpdate();
        }, Math.min(delay, 60_000));
      };

      updateTime();
      scheduleNextUpdate();
      return () => clearTimeout(timer);
    }, [events])
  );

  const sortedEvents = [...events].sort(
    (first, second) =>
      getStatusOrder(first, currentTime) - getStatusOrder(second, currentTime)
  );

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Events</Text>
      <Text style={styles.subtitle}>Check each event's status and schedule.</Text>

      {loading ? <ActivityIndicator color={COLORS.primary} /> : null}
      {error ? (
        <View>
          <Text style={styles.error}>{error}</Text>
          <Pressable onPress={load} style={styles.retryButton}>
            <Text style={styles.retryText}>Try again</Text>
          </Pressable>
        </View>
      ) : null}
      {!loading && !error && events.length === 0 ? (
        <Text style={styles.empty}>There are no events right now.</Text>
      ) : null}

      {sortedEvents.map((event) => (
        <View key={event.id} style={styles.card}>
          <View style={styles.cardHeading}>
            <Text style={styles.eventTitle}>{event.title}</Text>
            <Text style={getStatusStyle(event, currentTime)}>
              {getEventStatus(event, currentTime)}
            </Text>
          </View>
          <Text style={styles.code}>{event.event_code}</Text>
          <Text style={styles.detail}>Date: {formatDate(event.start_time)}</Text>
          <Text style={styles.detail}>Ends: {formatDate(event.end_time)}</Text>
          {event.venue ? <Text style={styles.detail}>Venue: {event.venue}</Text> : null}
          {event.description ? <Text style={styles.description}>{event.description}</Text> : null}
        </View>
      ))}
    </ScrollView>
  );
}

function getEventStatus(event: CloudEvent, currentTime: number) {
  if (
    event.status === 'closed' ||
    (event.end_time !== null && new Date(event.end_time).getTime() <= currentTime)
  ) {
    return 'CLOSED';
  }
  if (event.start_time !== null && new Date(event.start_time).getTime() > currentTime) {
    return 'COMING SOON';
  }
  return 'OPEN';
}

function getStatusOrder(event: CloudEvent, currentTime: number) {
  const status = getEventStatus(event, currentTime);
  if (status === 'OPEN') return 0;
  if (status === 'COMING SOON') return 1;
  return 2;
}

function getStatusStyle(event: CloudEvent, currentTime: number) {
  const status = getEventStatus(event, currentTime);
  if (status === 'CLOSED') return styles.closedStatus;
  if (status === 'COMING SOON') return styles.comingSoonStatus;
  return styles.status;
}

function formatDate(value: string | null) {
  return value ? new Date(value).toLocaleString() : 'Not set';
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  content: { padding: 24, paddingBottom: 40 },
  title: { color: COLORS.textPrimary, fontSize: 22, fontWeight: '700' },
  subtitle: { color: COLORS.textSecondary, fontSize: 14, marginTop: 6, marginBottom: 18 },
  card: {
    backgroundColor: COLORS.card,
    borderColor: COLORS.border,
    borderWidth: 1,
    borderRadius: 10,
    padding: 16,
    marginBottom: 12,
  },
  cardHeading: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  eventTitle: { flex: 1, color: COLORS.textPrimary, fontSize: 17, fontWeight: '700' },
  status: {
    color: COLORS.success,
    backgroundColor: '#E8F5E9',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.5,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 7,
    marginLeft: 8,
  },
  closedStatus: {
    color: COLORS.danger,
    backgroundColor: '#FDECEA',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.5,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 7,
    marginLeft: 8,
  },
  comingSoonStatus: {
    color: '#8A5A00',
    backgroundColor: '#FFF3CD',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.5,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 7,
    marginLeft: 8,
  },
  code: { color: COLORS.primary, fontSize: 13, fontWeight: '600', marginTop: 5, marginBottom: 8 },
  detail: { color: COLORS.textSecondary, fontSize: 13, marginTop: 3 },
  description: { color: COLORS.textPrimary, fontSize: 14, lineHeight: 20, marginTop: 10 },
  empty: { color: COLORS.textSecondary, textAlign: 'center', marginTop: 32 },
  error: { color: COLORS.danger, marginVertical: 12 },
  retryButton: { backgroundColor: COLORS.primary, padding: 12, borderRadius: 8, alignSelf: 'flex-start' },
  retryText: { color: COLORS.textOnPrimary, fontWeight: '700' },
});
