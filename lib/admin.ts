import { supabase } from './supabase';
import type { Role } from './profiles';

export type AdminProfile = {
  id: string;
  email: string;
  full_name: string | null;
  role: Role;
  created_at: string;
};

export type AdminEvent = {
  id: string;
  event_code: string;
  title: string;
  start_time: string | null;
  end_time: string | null;
  venue: string;
  description: string;
  status: 'open' | 'closed';
  created_at: string;
};

export type AdminAttendance = {
  id: string;
  student_id: string;
  event_id: string;
  scanned_at: string;
  status: 'present' | 'late' | 'excused' | 'absent';
};

export type AdminDashboardData = {
  profiles: AdminProfile[];
  events: AdminEvent[];
  attendance: AdminAttendance[];
  totals: {
    users: number;
    events: number;
    attendance: number;
    openEvents: number;
    closedEvents: number;
    attendanceByStatus: Record<AdminAttendance['status'], number>;
  };
};

function throwOnError(error: { message: string } | null) {
  if (error) throw new Error(error.message);
}

export async function getAdminDashboardData(): Promise<AdminDashboardData> {
  const [
    profilesResult,
    eventsResult,
    attendanceResult,
    userCount,
    eventCount,
    attendanceCount,
    openEventCount,
    closedEventCount,
    presentCount,
    lateCount,
    excusedCount,
    absentCount,
  ] = await Promise.all([
      supabase
        .from('profiles')
        .select('id, email, full_name, role, created_at')
        .order('created_at', { ascending: false })
        .limit(100),
      supabase
        .from('events')
        .select('id, event_code, title, start_time, end_time, venue, description, status, created_at')
        .order('created_at', { ascending: false })
        .limit(100),
      supabase
        .from('attendance')
        .select('id, student_id, event_id, scanned_at, status')
        .order('scanned_at', { ascending: false })
        .limit(100),
      supabase.from('profiles').select('id', { count: 'exact', head: true }),
      supabase.from('events').select('id', { count: 'exact', head: true }),
      supabase.from('attendance').select('id', { count: 'exact', head: true }),
      supabase.from('events').select('id', { count: 'exact', head: true }).eq('status', 'open'),
      supabase.from('events').select('id', { count: 'exact', head: true }).eq('status', 'closed'),
      supabase.from('attendance').select('id', { count: 'exact', head: true }).eq('status', 'present'),
      supabase.from('attendance').select('id', { count: 'exact', head: true }).eq('status', 'late'),
      supabase.from('attendance').select('id', { count: 'exact', head: true }).eq('status', 'excused'),
      supabase.from('attendance').select('id', { count: 'exact', head: true }).eq('status', 'absent'),
    ]);

  throwOnError(profilesResult.error);
  throwOnError(eventsResult.error);
  throwOnError(attendanceResult.error);
  throwOnError(userCount.error);
  throwOnError(eventCount.error);
  throwOnError(attendanceCount.error);
  throwOnError(openEventCount.error);
  throwOnError(closedEventCount.error);
  throwOnError(presentCount.error);
  throwOnError(lateCount.error);
  throwOnError(excusedCount.error);
  throwOnError(absentCount.error);

  return {
    profiles: (profilesResult.data ?? []) as AdminProfile[],
    events: (eventsResult.data ?? []) as AdminEvent[],
    attendance: (attendanceResult.data ?? []) as AdminAttendance[],
    totals: {
      users: userCount.count ?? 0,
      events: eventCount.count ?? 0,
      attendance: attendanceCount.count ?? 0,
      openEvents: openEventCount.count ?? 0,
      closedEvents: closedEventCount.count ?? 0,
      attendanceByStatus: {
        present: presentCount.count ?? 0,
        late: lateCount.count ?? 0,
        excused: excusedCount.count ?? 0,
        absent: absentCount.count ?? 0,
      },
    },
  };
}

export async function updateManagedProfile(
  userId: string,
  updates: { full_name?: string; role?: Role }
) {
  const { data, error } = await supabase
    .from('profiles')
    .update(updates)
    .eq('id', userId)
    .select('id')
    .maybeSingle();
  throwOnError(error);
  if (!data) throw new Error('No profile was updated. Check your administrator access.');
}

export async function updateManagedEvent(
  eventId: string,
  updates: {
    title: string;
    start_time: string;
    end_time: string;
    venue: string;
    description: string;
  }
) {
  const { data, error } = await supabase
    .from('events')
    .update(updates)
    .eq('id', eventId)
    .select('id')
    .maybeSingle();
  throwOnError(error);
  if (!data) throw new Error('No event was updated. Check your administrator access.');
}

export async function setManagedEventStatus(eventId: string, status: 'open' | 'closed') {
  const { data, error } = await supabase
    .from('events')
    .update({ status })
    .eq('id', eventId)
    .select('id')
    .maybeSingle();
  throwOnError(error);
  if (!data) throw new Error('No event status was updated. Check your administrator access.');
}

export async function deleteManagedEvent(eventId: string) {
  const { data, error } = await supabase
    .from('events')
    .delete()
    .eq('id', eventId)
    .select('id')
    .maybeSingle();
  throwOnError(error);
  if (!data) throw new Error('No event was deleted. Check your administrator access.');
}

export async function correctAttendanceTime(attendanceId: string, scannedAt: string) {
  const { data, error } = await supabase
    .from('attendance')
    .update({ scanned_at: scannedAt })
    .eq('id', attendanceId)
    .select('id')
    .maybeSingle();
  throwOnError(error);
  if (!data) throw new Error('No attendance record was updated. Check your administrator access.');
}

export async function updateAttendanceStatus(
  attendanceId: string,
  status: AdminAttendance['status']
) {
  const { data, error } = await supabase
    .from('attendance')
    .update({ status })
    .eq('id', attendanceId)
    .select('id')
    .maybeSingle();
  throwOnError(error);
  if (!data) throw new Error('No attendance record was updated. Check your administrator access.');
}

export async function deleteAttendanceRecord(attendanceId: string) {
  const { data, error } = await supabase
    .from('attendance')
    .delete()
    .eq('id', attendanceId)
    .select('id')
    .maybeSingle();
  throwOnError(error);
  if (!data) throw new Error('No attendance record was deleted. Check your administrator access.');
}
