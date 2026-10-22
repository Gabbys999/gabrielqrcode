import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import QRCode from 'react-native-qrcode-svg';
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { COLORS } from '@/constants/colors';
import {
  deleteManagedEvent,
  setManagedEventStatus,
  updateManagedEvent,
} from '@/lib/admin';
import { useAuth } from '@/lib/auth';
import { buildQRPayload } from '@/lib/qr';
import {
  getAllEvents,
  getEventsByTeacher,
  setEventStatus,
  updateEvent,
  type CloudEvent,
} from '@/lib/events';
import { useRole } from '@/lib/role';

export default function ManageEventsScreen() {
  const { eventId: routeEventId, returnTo } = useLocalSearchParams<{
    eventId?: string;
    returnTo?: string;
  }>();
  const router = useRouter();
  const { user } = useAuth();
  const { role, loading: roleLoading } = useRole();
  const [events, setEvents] = useState<CloudEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [viewingQrId, setViewingQrId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [venue, setVenue] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [description, setDescription] = useState('');

  useEffect(() => {
    setSelectedEventId(typeof routeEventId === 'string' ? routeEventId : null);
  }, [routeEventId]);

  const loadEvents = useCallback(async () => {
    if (!user || (role !== 'admin' && role !== 'teacher')) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      setEvents(role === 'admin' ? await getAllEvents() : await getEventsByTeacher(user.id));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Could not load events.');
    } finally {
      setLoading(false);
    }
  }, [role, user]);

  useFocusEffect(
    useCallback(() => {
      loadEvents();
    }, [loadEvents])
  );

  const startEditing = (event: CloudEvent) => {
    setEditingId(event.id);
    setTitle(event.title);
    setVenue(event.venue);
    setStartTime(event.start_time ?? '');
    setEndTime(event.end_time ?? '');
    setDescription(event.description);
    setError(null);
  };

  const cancelEditing = () => {
    setEditingId(null);
    setTitle('');
    setVenue('');
    setStartTime('');
    setEndTime('');
    setDescription('');
  };

  const saveEvent = async (event: CloudEvent) => {
    const start = Date.parse(startTime);
    const end = Date.parse(endTime);
    if (!title.trim() || !venue.trim() || !description.trim()) {
      setError('Title, venue, and description are required.');
      return;
    }
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
      setError('Enter valid start and end times. End time must be after start time.');
      return;
    }

    setSavingId(event.id);
    setError(null);
    try {
      if (role === 'admin') {
        await updateManagedEvent(event.id, {
          title: title.trim(),
          venue: venue.trim(),
          start_time: new Date(start).toISOString(),
          end_time: new Date(end).toISOString(),
          description: description.trim(),
        });
      } else {
        const result = await updateEvent(event.id, {
          title: title.trim(),
          venue: venue.trim(),
          start: new Date(start).toISOString(),
          end: new Date(end).toISOString(),
          description: description.trim(),
        });
        if (result.error) throw new Error(result.error);
      }
      cancelEditing();
      await loadEvents();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Could not save event changes.');
    } finally {
      setSavingId(null);
    }
  };

  const toggleStatus = async (event: CloudEvent) => {
    setSavingId(event.id);
    setError(null);
    try {
      if (role === 'admin') {
        await setManagedEventStatus(event.id, event.status === 'open' ? 'closed' : 'open');
      } else {
        const result = await setEventStatus(
          event.id,
          event.status === 'open' ? 'closed' : 'open'
        );
        if (result.error) throw new Error(result.error);
      }
      await loadEvents();
    } catch (statusError) {
      setError(statusError instanceof Error ? statusError.message : 'Could not update event status.');
    } finally {
      setSavingId(null);
    }
  };

  const deleteEvent = async (event: CloudEvent) => {
    setSavingId(event.id);
    setError(null);
    try {
      await deleteManagedEvent(event.id);
      if (editingId === event.id) cancelEditing();
      if (selectedEventId === event.id) {
        setSelectedEventId(null);
        setViewingQrId(null);
      }
      await loadEvents();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'Could not delete event.');
    } finally {
      setSavingId(null);
    }
  };

  const confirmDelete = (event: CloudEvent) => {
    const message = `This will also remove attendance records for "${event.title}".`;
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined' && window.confirm(`Delete event?\n\n${message}`)) {
        void deleteEvent(event);
      }
      return;
    }

    Alert.alert('Delete event?', message, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => void deleteEvent(event),
      },
    ]);
  };

  if (roleLoading || loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={COLORS.primary} />
        <Text style={styles.muted}>Loading events...</Text>
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
      <ActionButton
        title="Back"
        disabled={!!savingId}
        onPress={() =>
          router.replace(
            role === 'admin' && returnTo === 'admin'
              ? '/(tabs)/admin'
              : '/(tabs)/teacher'
          )
        }
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {events.length === 0 ? <Text style={styles.muted}>No events found.</Text> : null}

      {selectedEventId ? (
        (() => {
          const event = events.find((item) => item.id === selectedEventId);
          if (!event) return null;
          return (
            <View>
              <View style={styles.eventDetailsCard}>
                {editingId === event.id ? (
                  <TextInput
                    style={styles.input}
                    value={title}
                    onChangeText={setTitle}
                    placeholder="Event title"
                    placeholderTextColor={COLORS.textSecondary}
                  />
                ) : (
                  <Text style={styles.eventTitle}>{event.title}</Text>
                )}
                <Text style={styles.code}>{event.event_code} · {event.status.toUpperCase()}</Text>
                {editingId === event.id ? (
                  <>
                    <TextInput style={styles.input} value={venue} onChangeText={setVenue} placeholder="Venue" placeholderTextColor={COLORS.textSecondary} />
                    <TextInput style={styles.input} value={startTime} onChangeText={setStartTime} placeholder="Start time in ISO format" placeholderTextColor={COLORS.textSecondary} autoCapitalize="none" />
                    <TextInput style={styles.input} value={endTime} onChangeText={setEndTime} placeholder="End time in ISO format" placeholderTextColor={COLORS.textSecondary} autoCapitalize="none" />
                    <TextInput style={[styles.input, styles.multiline]} value={description} onChangeText={setDescription} placeholder="Description" placeholderTextColor={COLORS.textSecondary} multiline />
                    <View style={styles.actions}>
                      <ActionButton title="Save Changes" disabled={savingId === event.id} onPress={() => saveEvent(event)} />
                      <ActionButton title="Cancel" disabled={savingId === event.id} onPress={cancelEditing} />
                    </View>
                  </>
                ) : (
                  <>
                    <Text style={styles.detail}>Venue: {event.venue}</Text>
                    <Text style={styles.detail}>{event.description}</Text>
                    {viewingQrId === event.id ? (
                      <View style={styles.qrContainer}>
                        <Text style={styles.qrTitle}>Scan this QR code for attendance:</Text>
                        <QRCode
                          value={buildQRPayload({
                            eventId: event.event_code,
                            title: event.title,
                            start: event.start_time ?? undefined,
                            end: event.end_time ?? undefined,
                          })}
                          size={220}
                        />
                      </View>
                    ) : null}
                    <View style={styles.actions}>
                      <ActionButton title="Edit" disabled={!!savingId} onPress={() => startEditing(event)} />
                      <ActionButton
                        title={viewingQrId === event.id ? 'Hide QR' : 'View QR'}
                        disabled={!!savingId}
                        onPress={() =>
                          setViewingQrId((currentId) => (currentId === event.id ? null : event.id))
                        }
                      />
                      <ActionButton
                        title={event.status === 'open' ? 'Close Event' : 'Reopen Event'}
                        disabled={!!savingId}
                        onPress={() => toggleStatus(event)}
                      />
                      {role === 'admin' ? (
                        <ActionButton title="Delete Event" danger disabled={!!savingId} onPress={() => confirmDelete(event)} />
                      ) : null}
                    </View>
                  </>
                )}
              </View>
            </View>
          );
        })()
      ) : (
        events.map((event) => (
          <Pressable
            key={event.id}
            accessibilityRole="button"
            style={({ pressed }) => [styles.eventTitleRow, pressed && styles.pressed]}
            onPress={() => {
              setSelectedEventId(event.id);
              setError(null);
            }}
          >
            <View style={styles.eventTitleContent}>
              <Text style={styles.eventTitle}>{event.title}</Text>
              <Text style={styles.eventCodeStatus}>
                {event.event_code} · {event.status.toUpperCase()}
              </Text>
            </View>
          </Pressable>
        ))
      )}
    </ScrollView>
  );
}

function ActionButton({
  title,
  danger = false,
  disabled,
  onPress,
}: {
  title: string;
  danger?: boolean;
  disabled: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={[styles.actionButton, danger && styles.dangerButton, disabled && styles.disabled]}
    >
      <Text style={[styles.actionText, danger && styles.dangerText]}>{title}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  content: { paddingHorizontal: 24, paddingTop: 24, paddingBottom: 40 },
  centered: {
    flex: 1,
    backgroundColor: COLORS.background,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  title: { fontSize: 22, fontWeight: '700', color: COLORS.textPrimary, marginBottom: 8 },
  muted: { fontSize: 14, color: COLORS.textSecondary, marginBottom: 12 },
  error: { fontSize: 14, color: COLORS.danger, marginBottom: 12 },
  eventTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 16,
    marginTop: 10,
  },
  eventDetailsCard: {
    backgroundColor: COLORS.card,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 16,
    marginTop: 12,
    alignItems: 'stretch',
  },
  eventTitleContent: { flex: 1 },
  pressed: { opacity: 0.65 },
  code: {
    width: '100%',
    fontSize: 12,
    color: COLORS.textSecondary,
    textAlign: 'left',
    marginTop: 5,
    marginBottom: 8,
  },
  eventTitle: {
    width: '100%',
    fontSize: 17,
    fontWeight: '700',
    color: COLORS.textPrimary,
    lineHeight: 23,
    textAlign: 'left',
  },
  eventCodeStatus: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 5,
    textAlign: 'left',
  },
  detail: {
    width: '100%',
    fontSize: 14,
    color: COLORS.textSecondary,
    lineHeight: 20,
    textAlign: 'left',
    marginTop: 6,
  },
  qrContainer: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 16,
    marginTop: 14,
    gap: 12,
  },
  qrTitle: {
    color: COLORS.textPrimary,
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  input: {
    backgroundColor: COLORS.background,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: COLORS.textPrimary,
    marginTop: 8,
  },
  multiline: { minHeight: 72, textAlignVertical: 'top' },
  actions: {
    width: '100%',
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: 8,
    marginTop: 14,
  },
  actionButton: {
    flex: 1,
    minWidth: 90,
    minHeight: 40,
    backgroundColor: COLORS.surface,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionText: { color: COLORS.primary, fontWeight: '700' },
  dangerButton: { backgroundColor: COLORS.danger + '18' },
  dangerText: { color: COLORS.danger },
  disabled: { opacity: 0.5 },
});
