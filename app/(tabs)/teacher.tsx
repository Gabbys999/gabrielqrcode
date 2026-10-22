import Ionicons from '@expo/vector-icons/Ionicons';
import DateTimePicker, {
  type DateTimePickerEvent,
} from '@react-native-community/datetimepicker';
import { useFocusEffect, useRouter } from 'expo-router';
import { useState } from 'react';
import { useCallback } from 'react';
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import AppButton from '@/components/AppButton';
import { COLORS } from '@/constants/colors';
import {
  createEvent,
  getAllEvents,
  getEventsByTeacher,
  updateEvent,
  type CloudEvent,
} from '@/lib/events';
import { useAuth } from '@/lib/auth';
import { useRole } from '@/lib/role';

function toLocalISO(date: Date) {
  return date.toISOString();
}

function formatDateTime(date: Date) {
  const pad = (n: number) => String(n).padStart(2, '0');
  const month = date.toLocaleString('en-US', { month: 'short' });
  return `${month} ${pad(date.getDate())}, ${date.getFullYear()} at ${pad(
    date.getHours()
  )}:${pad(date.getMinutes())}`;
}

const QUICK_END_OPTIONS = [
  { label: '+30 min', ms: 30 * 60 * 1000 },
  ...Array.from({ length: 8 }, (_, index) => {
    const hours = index + 1;
    return {
      label: `+${hours} ${hours === 1 ? 'hour' : 'hours'}`,
      ms: hours * 60 * 60 * 1000,
    };
  }),
];

type EditTarget = 'start' | 'end';

export function TeacherEventTools({ embedded = false }: { embedded?: boolean }) {
  const [title, setTitle] = useState('');
  const [eventId, setEventId] = useState('');
  const [venue, setVenue] = useState('');
  const [description, setDescription] = useState('');
  const [editingEventId, setEditingEventId] = useState<string | null>(null);
  const [events, setEvents] = useState<CloudEvent[]>([]);
  const [eventsLoading, setEventsLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [startDate, setStartDate] = useState(() => new Date());
  const [endDate, setEndDate] = useState(
    () => new Date(Date.now() + 60 * 60 * 1000)
  );
  const [editTarget, setEditTarget] = useState<EditTarget | null>(null);
  const [editingPart, setEditingPart] = useState<'date' | 'time'>('date');
  const [message, setMessage] = useState<string | null>(null);

  const { role, loading: roleLoading, error: roleError } = useRole();
  const { user } = useAuth();
  const router = useRouter();

  const loadEvents = useCallback(async () => {
    if (!user) return;
    setEventsLoading(true);
    try {
      setEvents(role === 'admin' ? await getAllEvents() : await getEventsByTeacher(user.id));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not load your events.');
    } finally {
      setEventsLoading(false);
    }
  }, [role, user]);

  useFocusEffect(
    useCallback(() => {
      loadEvents();
    }, [loadEvents])
  );

  const isAndroid = Platform.OS === 'android';

  const openPicker = (target: EditTarget) => {
    setMessage(null);
    setEditTarget(target);
    setEditingPart('date');
  };

  const onPickerChange = (
    event: DateTimePickerEvent,
    selected?: Date
  ) => {
    if (!editTarget) return;
    if (event.type === 'dismissed' || !selected) {
      setEditTarget(null);
      setEditingPart('date');
      return;
    }

    const current = editTarget === 'start' ? startDate : endDate;
    const next = new Date(current);
    next.setFullYear(selected.getFullYear(), selected.getMonth(), selected.getDate());
    next.setHours(selected.getHours(), selected.getMinutes(), 0, 0);

    if (editTarget === 'start') setStartDate(next);
    else setEndDate(next);

    if (isAndroid && editingPart === 'date') {
      setEditingPart('time');
    } else {
      setEditTarget(null);
      setEditingPart('date');
    }
  };

  const handleQuickEnd = (ms: number) => {
    setMessage(null);
    setEndDate(new Date(startDate.getTime() + ms));
  };

  const clearForm = () => {
    setTitle('');
    setEventId('');
    setVenue('');
    setDescription('');
    setEditingEventId(null);
  };

  const handleSaveEvent = async () => {
    const event = {
      eventId: eventId.trim(),
      title: title.trim(),
      start: toLocalISO(startDate),
      end: toLocalISO(endDate),
      venue: venue.trim(),
      description: description.trim(),
    };

    if (!event.title || (!editingEventId && !event.eventId)) {
      setMessage('Event title and code are required.');
      return;
    }

    if (!event.venue || !event.description) {
      setMessage('Venue and description are required.');
      return;
    }

    if (endDate.getTime() <= startDate.getTime()) {
      setMessage('End time must be after start time.');
      return;
    }

    setSaving(true);
    setMessage(null);
    try {
      let error: string | null;
      if (editingEventId) {
        ({ error } = await updateEvent(editingEventId, event));
      } else {
        const result = await createEvent(event);
        error = result.error;
        if (result.eventCode) {
          setEventId(result.eventCode);
        }
      }
      if (error) {
        setMessage(`Could not save the event: ${error}`);
        return;
      }
      setMessage(
        editingEventId
          ? 'Event updated.'
          : 'Event saved. View its QR in Manage Your Events.'
      );
      await loadEvents();
      setEditingEventId(null);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not save the event.');
    } finally {
      setSaving(false);
    }
  };

    if (roleLoading) {
    return (
      <View style={styles.centered}>
        <Text style={styles.subtitle}>Checking your account...</Text>
      </View>
    );
  }

  if (role !== 'teacher' && role !== 'admin') {
    return (
      <View style={styles.centered}>
        <Ionicons name="lock-closed-outline" size={48} color={COLORS.textSecondary} />
        <Text style={styles.lockTitle}>Teachers Only</Text>
        <Text style={styles.lockText}>
          {roleError ?? 'Only teacher and administrator accounts can create events.'}
        </Text>
      </View>
    );
  }

  const eventToolsContent = (
    <>
      <Text style={styles.title}>{editingEventId ? 'Edit Event' : 'Create Event QR'}</Text>
      <Text style={styles.subtitle}>
        Fill in the event details, then scan the generated QR with the Scan tab.
      </Text>

      <Text style={styles.label}>Event Title</Text>
      <TextInput
        style={styles.input}
        value={title}
        onChangeText={setTitle}
        placeholder="e.g. Founders Day Assembly"
        placeholderTextColor={COLORS.textSecondary}
      />

      <Text style={styles.label}>Event Code</Text>
      <TextInput
        style={styles.input}
        value={eventId}
        onChangeText={setEventId}
        placeholder="e.g. EVT-2026-0002"
        placeholderTextColor={COLORS.textSecondary}
        autoCapitalize="characters"
        editable={!editingEventId && !saving}
      />

      <Text style={styles.label}>Venue</Text>
      <TextInput
        style={styles.input}
        value={venue}
        onChangeText={setVenue}
        placeholder="e.g. School Gymnasium"
        placeholderTextColor={COLORS.textSecondary}
        editable={!saving}
      />

      <Text style={styles.label}>Description</Text>
      <TextInput
        style={[styles.input, styles.multilineInput]}
        value={description}
        onChangeText={setDescription}
        placeholder="Event details"
        placeholderTextColor={COLORS.textSecondary}
        multiline
        editable={!saving}
      />

      <Text style={styles.label}>Starts</Text>
      <PickerField
        value={formatDateTime(startDate)}
        icon="sunny-outline"
        onPress={() => openPicker('start')}
      />

      <Text style={styles.label}>Ends</Text>
      <PickerField
        value={formatDateTime(endDate)}
        icon="moon-outline"
        onPress={() => openPicker('end')}
      />
      <View style={styles.chipRow}>
        {QUICK_END_OPTIONS.map((option) => (
          <Pressable
            key={option.label}
            style={styles.chip}
            onPress={() => handleQuickEnd(option.ms)}
          >
            <Text style={styles.chipText}>{option.label}</Text>
          </Pressable>
        ))}
      </View>
      <Text style={styles.hint}>Tap a chip to set the end time from start.</Text>

      {message && <Text style={styles.message}>{message}</Text>}

      <AppButton
        theme="primary"
        title={saving ? 'Saving...' : editingEventId ? 'Save Changes' : 'Create Event'}
        icon={editingEventId ? 'save-outline' : 'add-circle-outline'}
        onPress={handleSaveEvent}
        disabled={saving}
      />
      {editingEventId ? (
        <AppButton title="Cancel Edit" icon="close-outline" onPress={clearForm} disabled={saving} />
      ) : null}

      {editTarget && (
        <View style={styles.pickerContainer}>
          <DateTimePicker
            value={editTarget === 'start' ? startDate : endDate}
            mode={isAndroid ? editingPart : 'datetime'}
            display={isAndroid ? 'default' : 'spinner'}
            onChange={onPickerChange}
          />
        </View>
      )}

      <View style={styles.eventsSection}>
        <Text style={styles.title}>Manage Your Events</Text>
        {eventsLoading ? <Text style={styles.subtitle}>Loading events...</Text> : null}
        {!eventsLoading && events.length === 0 ? (
          <Text style={styles.subtitle}>No events found.</Text>
        ) : null}
        {events.map((event) => (
          <Pressable
            key={event.id}
            style={({ pressed }) => [styles.eventTitleCard, pressed && styles.pickerFieldPressed]}
            onPress={() =>
              router.push({
                pathname: '/(tabs)/manage-events',
                params: {
                  eventId: event.id,
                  ...(embedded ? { returnTo: 'admin' } : {}),
                },
              })
            }
          >
            <Text style={styles.eventTitleText}>{event.title}</Text>
            <Ionicons name="chevron-forward" size={20} color={COLORS.primary} />
          </Pressable>
        ))}
      </View>
    </>
  );

  return embedded ? (
    <View style={styles.embeddedCard}>
      <View style={styles.embeddedContent}>{eventToolsContent}</View>
    </View>
  ) : (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      {eventToolsContent}
    </ScrollView>
  );
}

export default function TeacherScreen() {
  return <TeacherEventTools />;
}

type PickerFieldProps = {
  value: string;
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
};

function PickerField({ value, icon, onPress }: PickerFieldProps) {
  return (
    <Pressable
      style={({ pressed }) => [styles.pickerField, pressed && styles.pickerFieldPressed]}
      onPress={onPress}
    >
      <Ionicons name={icon} size={20} color={COLORS.primary} />
      <Text style={styles.pickerValue}>{value}</Text>
      <Ionicons name="calendar-outline" size={18} color={COLORS.textSecondary} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  content: {
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 40,
  },
  embeddedCard: {
    backgroundColor: COLORS.card,
    borderColor: COLORS.border,
    borderWidth: 1,
    borderRadius: 12,
    padding: 20,
    marginTop: 24,
    marginBottom: 12,
  },
  embeddedContent: { paddingTop: 4, paddingBottom: 12 },
  title: {
    fontSize: 20,
    fontWeight: '600',
    color: COLORS.textPrimary,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: COLORS.textSecondary,
    lineHeight: 20,
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textPrimary,
    marginBottom: 6,
    marginTop: 10,
  },
  input: {
    backgroundColor: COLORS.card,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: COLORS.textPrimary,
  },
  multilineInput: { minHeight: 88, textAlignVertical: 'top' },
  pickerField: {
    backgroundColor: COLORS.card,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 14,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
  },
  pickerFieldPressed: {
    backgroundColor: COLORS.surface,
  },
  pickerValue: {
    flex: 1,
    fontSize: 15,
    fontWeight: '500',
    color: COLORS.textPrimary,
    marginHorizontal: 10,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 8,
  },
  chip: {
    backgroundColor: COLORS.surface,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 7,
    marginRight: 8,
    marginBottom: 8,
  },
  chipText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.primary,
  },
  hint: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 6,
  },
  pickerContainer: {
    marginTop: 12,
    alignItems: 'center',
  },
  message: {
    fontSize: 14,
    color: COLORS.primary,
    textAlign: 'center',
    marginTop: 12,
  },
  eventsSection: { marginTop: 28 },
  eventTitleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 16,
    marginTop: 10,
  },
  eventTitleText: {
    flex: 1,
    color: COLORS.textPrimary,
    fontSize: 16,
    fontWeight: '600',
  },
  centered: {
    flex: 1,
    backgroundColor: COLORS.background,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  lockTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginTop: 12,
    marginBottom: 6,
  },
  lockText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
});
