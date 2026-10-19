import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { COLORS } from '@/constants/colors';
import { getAvailableEvents, type CloudEvent } from '@/lib/events';

export default function EventsScreen() {
  const [events, setEvents] = useState<CloudEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setEvents(await getAvailableEvents());
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

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Available Events</Text>
      <Text style={styles.subtitle}>Open events that are accepting attendance.</Text>

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
        <Text style={styles.empty}>There are no open events right now.</Text>
      ) : null}

      {events.map((event) => (
        <View key={event.id} style={styles.card}>
          <View style={styles.cardHeading}>
            <Text style={styles.eventTitle}>{event.title}</Text>
            <Text style={styles.status}>OPEN</Text>
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
  status: { color: COLORS.success, fontSize: 11, fontWeight: '700', marginLeft: 8 },
  code: { color: COLORS.primary, fontSize: 13, fontWeight: '600', marginTop: 5, marginBottom: 8 },
  detail: { color: COLORS.textSecondary, fontSize: 13, marginTop: 3 },
  description: { color: COLORS.textPrimary, fontSize: 14, lineHeight: 20, marginTop: 10 },
  empty: { color: COLORS.textSecondary, textAlign: 'center', marginTop: 32 },
  error: { color: COLORS.danger, marginVertical: 12 },
  retryButton: { backgroundColor: COLORS.primary, padding: 12, borderRadius: 8, alignSelf: 'flex-start' },
  retryText: { color: COLORS.textOnPrimary, fontWeight: '700' },
});
