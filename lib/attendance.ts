import { supabase } from './supabase';
import { getEventByCode } from './events';
import { parseQRPayload } from './qr';

/* ------------------------------------------------------------------ */
/* Student: scan a QR code and record attendance                       */
/* ------------------------------------------------------------------ */

export type AttendanceRecord = {
  id: string;
  eventId: string;
  eventTitle: string;
  eventStart: string | null;
  scannedAt: string;
  status: 'present' | 'late' | 'excused' | 'absent';
};

export type RegisterResult = {
  success: boolean;
  message: string;
  eventTitle?: string;
};

export async function registerAttendance(
  rawPayload: string,
  studentId: string
): Promise<RegisterResult> {
  const parsed = parseQRPayload(rawPayload);
  if (!parsed.ok) {
    return { success: false, message: parsed.message };
  }
  const payload = parsed.payload;

  if (!studentId) {
    return { success: false, message: 'Sign in with a student account to record attendance.' };
  }

  let event;
  try {
    event = await getEventByCode(payload.event);
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Could not validate this event.',
    };
  }

  if (!event) {
    return { success: false, message: 'This event does not exist. Ask the teacher for a valid QR code.' };
  }
  if (event.status !== 'open') {
    return { success: false, message: 'Invalid QR code: this event is closed.' };
  }

  const now = Date.now();
  const start = event.start_time ? new Date(event.start_time).getTime() : null;
  const end = event.end_time ? new Date(event.end_time).getTime() : null;

  if (start !== null && now < start) {
    return { success: false, message: 'Invalid QR code: this event has not started yet.' };
  }
  if (end !== null && now >= end) {
    return { success: false, message: 'Invalid QR code: this event has already ended.' };
  }

  const { error: attError } = await supabase.from('attendance').insert([
    {
      student_id: studentId,
      event_id: event.id,
    },
  ]);

  if (attError) {
    if (attError.code === '23505') {
      return {
        success: false,
        message: 'Already registered for this event.',
        eventTitle: event.title,
      };
    }
    return { success: false, message: attError.message };
  }

  return { success: true, message: 'Attendance recorded!', eventTitle: event.title };
}

export async function getAttendanceHistory(
  studentId: string
): Promise<AttendanceRecord[]> {
  const { data, error } = await supabase
    .from('attendance')
    .select('id, scanned_at, status, events ( event_code, title, start_time )')
    .eq('student_id', studentId)
    .order('scanned_at', { ascending: false });

  if (error || !data) {
    if (error) throw new Error(error.message);
    return [];
  }

  return data.map((row: any) => ({
    id: row.id,
    eventId: row.events?.event_code ?? '',
    eventTitle: row.events?.title ?? '',
    eventStart: row.events?.start_time ?? null,
    scannedAt: row.scanned_at,
    status: row.status,
  }));
}

/* ------------------------------------------------------------------ */
/* Teacher: my events + who attended                                   */
/* ------------------------------------------------------------------ */

export type TeacherEventAttendance = {
  eventId: string;
  eventCode: string;
  title: string;
  startTime: string | null;
  endTime: string | null;
  eventStatus: 'open' | 'closed';
  attendeeCount: number;
  attendees: {
    studentId: string;
    scannedAt: string;
    status: 'present' | 'late' | 'excused' | 'absent';
  }[];
};

export type TeacherEventAttendanceDetail = {
  eventId: string;
  eventCode: string;
  title: string;
  startTime: string | null;
  endTime: string | null;
  eventStatus: 'open' | 'closed';
  attendeeCount: number;
  attendees: {
    studentId: string;
    studentName: string;
    avatarUrl: string | null;
    scannedAt: string;
    status: 'present' | 'late' | 'excused' | 'absent';
  }[];
  absentStudents: {
    studentId: string;
    studentName: string;
    avatarUrl: string | null;
  }[];
};

type EventStudentAttendanceRow = {
  student_id: string;
  full_name: string | null;
  avatar_url: string | null;
  scanned_at: string | null;
  attendance_status: 'present' | 'late' | 'excused' | 'absent' | null;
};

type PresentEventStudentAttendanceRow = EventStudentAttendanceRow & {
  scanned_at: string;
  attendance_status: 'present' | 'late' | 'excused' | 'absent';
};

export type TeacherEventSummary = {
  eventId: string;
  eventCode: string;
  title: string;
  attendeeCount: number;
};

export async function getTeacherEventAttendance(
  teacherId: string
): Promise<TeacherEventAttendance[]> {
  const { data: events, error: eventError } = await supabase
    .from('events')
    .select('id, event_code, title, start_time, end_time, status')
    .eq('created_by', teacherId)
    .order('created_at', { ascending: false });

  if (eventError) throw new Error(eventError.message);
  if (!events) return [];

  const eventIds = events.map((e: any) => e.id);
  if (eventIds.length === 0) return [];

  const { data: attendance, error: attError } = await supabase
    .from('attendance')
    .select('student_id, scanned_at, event_id, status')
    .in('event_id', eventIds)
    .order('scanned_at', { ascending: false });

  if (attError) throw new Error(attError.message);
  if (!attendance) return [];

  return events.map((e: any) => {
    const rows = attendance.filter((a: any) => a.event_id === e.id);
    return {
      eventId: e.id,
      eventCode: e.event_code,
      title: e.title,
      startTime: e.start_time,
      endTime: e.end_time,
      eventStatus: e.status,
      attendeeCount: rows.length,
      attendees: rows.map((a: any) => ({
        studentId: a.student_id,
        scannedAt: a.scanned_at,
        status: a.status,
      })),
    };
  });
}

export async function getTeacherEventAttendanceDetail(
  teacherId: string,
  eventId: string
): Promise<TeacherEventAttendanceDetail | null> {
  const { data: event, error: eventError } = await supabase
    .from('events')
    .select('id, event_code, title, start_time, end_time, status')
    .eq('id', eventId)
    .eq('created_by', teacherId)
    .maybeSingle();

  if (eventError) throw new Error(eventError.message);
  if (!event) return null;

  const { data: roster, error: rosterError } = await supabase.rpc(
    'get_event_student_attendance',
    { p_event_id: eventId }
  );
  if (rosterError) throw new Error(rosterError.message);

  const records = (roster ?? []) as EventStudentAttendanceRow[];
  const attendanceRecords = records.filter(
    (record): record is PresentEventStudentAttendanceRow =>
      record.scanned_at !== null && record.attendance_status !== null
  );
  const absentRecords = records.filter((record) => record.scanned_at === null);

  return {
    eventId: event.id,
    eventCode: event.event_code,
    title: event.title,
    startTime: event.start_time,
    endTime: event.end_time,
    eventStatus: event.status,
    attendeeCount: attendanceRecords.length,
    attendees: attendanceRecords.map((record) => ({
      studentId: record.student_id,
      studentName: record.full_name?.trim() || `Student …${record.student_id.slice(-8)}`,
      avatarUrl: record.avatar_url,
      scannedAt: record.scanned_at,
      status: record.attendance_status,
    })),
    absentStudents: absentRecords.map((record) => ({
      studentId: record.student_id,
      studentName: record.full_name?.trim() || `Student …${record.student_id.slice(-8)}`,
      avatarUrl: record.avatar_url,
    })),
  };
}

export async function getTeacherEventSummary(
  teacherId: string
): Promise<TeacherEventSummary[]> {
  const full = await getTeacherEventAttendance(teacherId);
  return full.map((e) => ({
    eventId: e.eventId,
    eventCode: e.eventCode,
    title: e.title,
    attendeeCount: e.attendeeCount,
  }));
}