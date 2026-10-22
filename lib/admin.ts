import { supabase } from './supabase';
import type { Role } from './profiles';

export type AdminProfile = {
  id: string;
  email: string;
  full_name: string | null;
  role: Role;
  avatar_url: string | null;
  created_at: string;
};

export type AdminAttendance = {
  status: 'present' | 'late' | 'excused' | 'absent';
};

export type AdminEventAttendance = {
  eventId: string;
  eventCode: string;
  title: string;
  startTime: string | null;
  eventStatus: 'open' | 'closed';
  attendeeCount: number;
  attendees: {
    studentId: string;
    studentName: string;
    avatarUrl: string | null;
    scannedAt: string;
    status: AdminAttendance['status'];
  }[];
};

export type AdminEventAttendanceDetail = AdminEventAttendance & {
  endTime: string | null;
  absentStudents: {
    studentId: string;
    studentName: string;
    avatarUrl: string | null;
  }[];
};

export type AdminDashboardData = {
  profiles: AdminProfile[];
  totals: {
    users: number;
    events: number;
    attendance: number;
    openEvents: number;
    closedEvents: number;
  };
};

function throwOnError(error: { message: string } | null) {
  if (error) throw new Error(error.message);
}

export async function closeExpiredAdminEvents() {
  const { error } = await supabase
    .from('events')
    .update({ status: 'closed' })
    .eq('status', 'open')
    .lte('end_time', new Date().toISOString());
  throwOnError(error);
}

export async function getAdminEventAttendance(): Promise<AdminEventAttendance[]> {
  await closeExpiredAdminEvents();
  const [events, attendance] = await Promise.all([
    getAllAdminEvents(),
    getAllAdminAttendance(),
  ]);
  if (events.length === 0) return [];

  const studentIds = [...new Set(attendance.map((record) => record.student_id))];
  const profiles = new Map<string, { name: string; avatarUrl: string | null }>();
  const profileBatchSize = 100;
  for (let offset = 0; offset < studentIds.length; offset += profileBatchSize) {
    const ids = studentIds.slice(offset, offset + profileBatchSize);
    const { data, error } = await supabase
      .from('profiles')
      .select('id, full_name, email, avatar_url')
      .in('id', ids);
    throwOnError(error);
    for (const profile of data ?? []) {
      profiles.set(profile.id, {
        name: profile.full_name?.trim() || profile.email,
        avatarUrl: profile.avatar_url,
      });
    }
  }

  const attendanceByEvent = new Map<string, typeof attendance>();
  for (const record of attendance) {
    const rows = attendanceByEvent.get(record.event_id) ?? [];
    rows.push(record);
    attendanceByEvent.set(record.event_id, rows);
  }

  return events.map((event) => {
    const attendees = attendanceByEvent.get(event.id) ?? [];
    return {
      eventId: event.id,
      eventCode: event.event_code,
      title: event.title,
      startTime: event.start_time,
      eventStatus: event.status,
      attendeeCount: attendees.length,
      attendees: attendees.map((record) => ({
        studentId: record.student_id,
        studentName: profiles.get(record.student_id)?.name ?? record.student_id,
        avatarUrl: profiles.get(record.student_id)?.avatarUrl ?? null,
        scannedAt: record.scanned_at,
        status: record.status,
      })),
    };
  });
}

export async function getAdminEventAttendanceDetail(
  eventId: string
): Promise<AdminEventAttendanceDetail | null> {
  await closeExpiredAdminEvents();
  const [{ data: event, error: eventError }, attendance] = await Promise.all([
    supabase
      .from('events')
      .select('id, event_code, title, start_time, end_time, status')
      .eq('id', eventId)
      .maybeSingle(),
    getAttendanceForEvent(eventId),
  ]);
  throwOnError(eventError);
  if (!event) return null;

  const studentIds = [...new Set(attendance.map((record) => record.student_id))];
  const profiles = await getAdminStudentProfiles();
  const profilesById = new Map(profiles.map((profile) => [profile.id, profile]));

  return {
    eventId: event.id,
    eventCode: event.event_code,
    title: event.title,
    startTime: event.start_time,
    endTime: event.end_time,
    eventStatus: event.status,
    attendeeCount: attendance.length,
    attendees: attendance.map((record) => ({
      studentId: record.student_id,
      studentName: profilesById.get(record.student_id)?.name ?? record.student_id,
      avatarUrl: profilesById.get(record.student_id)?.avatarUrl ?? null,
      scannedAt: record.scanned_at,
      status: record.status,
    })),
    absentStudents: profiles
      .filter((profile) => !studentIds.includes(profile.id))
      .map((profile) => ({
        studentId: profile.id,
        studentName: profile.name,
        avatarUrl: profile.avatarUrl,
      })),
  };
}

async function getAdminStudentProfiles() {
  const pageSize = 1000;
  const profiles: { id: string; name: string; avatarUrl: string | null }[] = [];

  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, full_name, email, avatar_url')
      .eq('role', 'student')
      .order('created_at', { ascending: true })
      .range(offset, offset + pageSize - 1);
    throwOnError(error);

    const page = data ?? [];
    profiles.push(
      ...page.map((profile) => ({
        id: profile.id,
        name: profile.full_name?.trim() || profile.email,
        avatarUrl: profile.avatar_url,
      }))
    );
    if (page.length < pageSize) return profiles;
  }
}

async function getAttendanceForEvent(eventId: string) {
  const pageSize = 1000;
  const records: {
    student_id: string;
    scanned_at: string;
    status: AdminAttendance['status'];
  }[] = [];
  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await supabase
      .from('attendance')
      .select('student_id, scanned_at, status')
      .eq('event_id', eventId)
      .order('scanned_at', { ascending: true })
      .range(offset, offset + pageSize - 1);
    throwOnError(error);
    const page = (data ?? []) as typeof records;
    records.push(...page);
    if (page.length < pageSize) return records;
  }
}

async function getAllAdminEvents() {
  const pageSize = 1000;
  const events: {
    id: string;
    event_code: string;
    title: string;
    start_time: string | null;
    status: 'open' | 'closed';
  }[] = [];
  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await supabase
      .from('events')
      .select('id, event_code, title, start_time, status')
      .order('created_at', { ascending: false })
      .range(offset, offset + pageSize - 1);
    throwOnError(error);
    const page = data ?? [];
    events.push(...page);
    if (page.length < pageSize) return events;
  }
}

async function getAllAdminAttendance() {
  const pageSize = 1000;
  const records: {
    student_id: string;
    event_id: string;
    scanned_at: string;
    status: AdminAttendance['status'];
  }[] = [];
  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await supabase
      .from('attendance')
      .select('student_id, event_id, scanned_at, status')
      .order('scanned_at', { ascending: false })
      .range(offset, offset + pageSize - 1);
    throwOnError(error);
    const page = (data ?? []) as typeof records;
    records.push(...page);
    if (page.length < pageSize) return records;
  }
}

async function getAllAdminProfiles(): Promise<AdminProfile[]> {
  const pageSize = 1000;
  const profiles: AdminProfile[] = [];
  let offset = 0;

  while (true) {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, email, full_name, role, avatar_url, created_at')
      .order('created_at', { ascending: false })
      .range(offset, offset + pageSize - 1);

    throwOnError(error);
    const page = (data ?? []) as AdminProfile[];
    profiles.push(...page);
    if (page.length < pageSize) return profiles;
    offset += pageSize;
  }
}

export async function getAdminDashboardData(): Promise<AdminDashboardData> {
  const [
    profiles,
    userCount,
    eventCount,
    attendanceCount,
    openEventCount,
    closedEventCount,
  ] = await Promise.all([
    getAllAdminProfiles(),
    supabase.from('profiles').select('id', { count: 'exact', head: true }),
    supabase.from('events').select('id', { count: 'exact', head: true }),
    supabase.from('attendance').select('id', { count: 'exact', head: true }),
    supabase.from('events').select('id', { count: 'exact', head: true }).eq('status', 'open'),
    supabase.from('events').select('id', { count: 'exact', head: true }).eq('status', 'closed'),
  ]);

  throwOnError(userCount.error);
  throwOnError(eventCount.error);
  throwOnError(attendanceCount.error);
  throwOnError(openEventCount.error);
  throwOnError(closedEventCount.error);

  return {
    profiles,
    totals: {
      users: userCount.count ?? 0,
      events: eventCount.count ?? 0,
      attendance: attendanceCount.count ?? 0,
      openEvents: openEventCount.count ?? 0,
      closedEvents: closedEventCount.count ?? 0,
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
