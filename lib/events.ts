import { supabase } from './supabase';

export type EventStatus = 'open' | 'closed';

export type EventInput = {
  eventId: string;
  title: string;
  start: string;
  end: string;
  venue: string;
  description: string;
};

export type CloudEvent = {
  id: string;
  event_code: string;
  title: string;
  start_time: string | null;
  end_time: string | null;
  venue: string;
  description: string;
  status: EventStatus;
  created_by: string | null;
  created_at: string;
};

function errorMessage(error: { message: string } | null, fallback: string | null) {
  return error?.message ?? fallback;
}

export async function createEvent(
  event: EventInput
): Promise<{ error: string | null }> {
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError) return { error: authError.message };
  if (!user) return { error: 'Sign in before creating an event.' };

  const { error } = await supabase.from('events').insert({
    event_code: event.eventId,
    title: event.title,
    start_time: event.start || null,
    end_time: event.end || null,
    venue: event.venue,
    description: event.description,
    status: 'open',
    created_by: user.id,
  });

  return { error: errorMessage(error, 'Could not create event.') };
}

export async function updateEvent(
  eventRowId: string,
  event: Omit<EventInput, 'eventId'>
): Promise<{ error: string | null }> {
  const { data, error } = await supabase
    .from('events')
    .update({
      title: event.title,
      start_time: event.start || null,
      end_time: event.end || null,
      venue: event.venue,
      description: event.description,
    })
    .eq('id', eventRowId)
    .select('id')
    .maybeSingle();

  return {
    error: errorMessage(
      error,
      data ? null : 'No event was updated. Check that it exists and that you have permission.'
    ),
  };
}

export async function setEventStatus(
  eventRowId: string,
  status: EventStatus
): Promise<{ error: string | null }> {
  const { data, error } = await supabase
    .from('events')
    .update({ status })
    .eq('id', eventRowId)
    .select('id')
    .maybeSingle();

  return {
    error: errorMessage(
      error,
      data ? null : 'No event status was updated. Check that you have permission.'
    ),
  };
}

export async function getEventsByTeacher(teacherId: string): Promise<CloudEvent[]> {
  const { data, error } = await supabase
    .from('events')
    .select('*')
    .eq('created_by', teacherId)
    .order('created_at', { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []) as CloudEvent[];
}

export async function getAvailableEvents(): Promise<CloudEvent[]> {
  const { data, error } = await supabase
    .from('events')
    .select('*')
    .eq('status', 'open')
    .order('start_time', { ascending: true });

  if (error) throw new Error(error.message);
  const now = Date.now();
  return ((data ?? []) as CloudEvent[]).filter(
    (event) => !event.end_time || new Date(event.end_time).getTime() >= now
  );
}

export async function getEventByCode(code: string): Promise<CloudEvent | null> {
  const { data, error } = await supabase
    .from('events')
    .select('*')
    .eq('event_code', code)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data as CloudEvent | null;
}
