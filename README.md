# QR-ATT — School Event Attendance

QR-ATT is a mobile school-event attendance app built with Expo SDK 57, Expo
Router, React Native, and Supabase.

## User roles

- **Student:** manage a profile, browse open events, scan event QR codes, and
  view personal attendance history.
- **Teacher:** create and edit events, generate event QR codes, close/reopen
  events, and review attendance for their events.
- **Administrator:** manage profile names and roles, edit/close/delete events,
  review overall attendance and totals, correct attendance time/status, and
  remove invalid attendance records.

Admin roles are not available during public registration. Create and verify a
trusted account first, then promote it from the Supabase SQL Editor:

```sql
update public.profiles
set role = 'admin'
where email = 'trusted-admin@example.com';
```

The client intentionally does not delete Supabase Auth accounts: that
privileged operation requires a trusted server-side function and must not use a
service-role key in the app.

## Database setup

1. Open the project's Supabase SQL Editor.
2. Run all of `lib/supabase/schema.sql`. It creates or migrates the `profiles`,
   `events`, and `attendance` tables, the profile-photo storage bucket and
   policies, relationships, role/status constraints, helper functions,
   triggers, and Row Level Security policies.
3. In Supabase Auth settings, choose whether new accounts require email
   confirmation.
4. In Supabase Auth URL Configuration, allow the app's password-reset redirect
   URL (`qr-attendance://reset-password` for native builds, plus the URL used by
   your web deployment if applicable).
5. Register from the app using an email you control. Only Student and Teacher
   can be chosen publicly; new accounts default to Student in the database.
6. For the first administrator, run the role-promotion query above.

The database enforces unique event codes and one attendance row per student
per event. RLS limits profile access, event management to teachers/admins,
attendance inserts to the signed-in student for open events within their
scheduled time, and attendance corrections to admins.

## Core workflows

### Event and attendance

1. A teacher or administrator creates an event with a unique code, title,
   start/end time, venue, and description.
2. QR-ATT generates a QR payload containing the event code.
3. Students browse open events and scan the corresponding QR code.
4. The app looks up the event in Supabase and validates its status and
   scheduled time. A QR payload alone cannot create an event.
5. Supabase records attendance with a unique student/event relationship and
   `present` status. The app reports success, invalid QR, unknown/closed/not
   started/ended event, or duplicate attendance.
6. Students view their own history; teachers see records for their events;
   administrators see overall reports and can correct records.

### Event-driven examples

| Event | Handler/action | Result |
|---|---|---|
| Student presses Sign In | Validate fields and call Supabase Auth | Session opens or an error is shown |
| User requests a password reset | Send a Supabase Auth reset email to the registered address | The email link opens the app's new-password screen |
| Camera detects a QR code | Parse payload and load event from Supabase | Invalid, unavailable, or valid event result |
| Attendance insert is submitted | Check event window and insert the student/event row | Confirmation or duplicate/error feedback |
| Teacher saves an event | Validate fields and insert/update the event | Event list and generated QR refresh |
| Teacher closes an event | Update event status | Future scans are rejected |
| Admin changes a role | Update the profile under admin RLS | Role-based screens refresh |
| User signs out | Call Supabase Auth sign-out | Protected app tabs close |
| Screen regains focus | Reload records from Supabase | Current data or an explicit loading/error/empty state |

## Security and configuration

- Authentication and password handling are provided by Supabase Auth; the app
  does not store plaintext passwords.
- Sessions persist through Expo SecureStore and are restored when the app
  starts.
- Profile photos are stored in the public `profile-photos` bucket. Only each
  signed-in user can upload or replace files in their own user-ID folder.
- Public registration accepts only Student or Teacher. Database triggers and
  RLS prevent users from promoting themselves to Administrator.
- Never put a Supabase service-role key or other private credential in the app.
- Supply `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY` using
  local environment configuration and the relevant EAS build profile.

## Run locally

```powershell
npm install
npx expo start
```

Use `npx tsc --noEmit` for a TypeScript check and `npx expo-doctor` to check the
Expo project configuration.
