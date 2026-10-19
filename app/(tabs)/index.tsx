import { router } from 'expo-router';
import { ActivityIndicator, SafeAreaView, StyleSheet, Text, View } from 'react-native';

import AppButton from '@/components/AppButton';
import Header from '@/components/Header';
import { COLORS } from '@/constants/colors';
import { useRole } from '@/lib/role';

export default function Index() {
  const { role, loading } = useRole();

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.headerContainer}>
        <Header title="QR Attendance" />
      </View>

      <View style={styles.bodyContainer}>
        <Text style={styles.mainTitle}>
          {role === 'admin'
            ? 'Attendance Administration'
            : role === 'teacher'
              ? 'Manage School Events'
              : 'School Event Attendance'}
        </Text>
        <Text style={styles.subtitle}>
          {role === 'admin'
            ? 'Manage users, events, attendance records, and reports.'
            : role === 'teacher'
              ? 'Create and manage events, QR codes, and attendance summaries.'
              : 'Browse school events and scan QR codes to record your attendance.'}
        </Text>
      </View>

      <View style={styles.footerContainer}>
        {loading ? (
          <ActivityIndicator color={COLORS.primary} style={styles.loader} />
        ) : role === 'student' ? (
          <AppButton
            theme="primary"
            title="Scan QR Code"
            icon="qr-code-outline"
            onPress={() => router.push('/scan')}
          />
        ) : role === 'teacher' ? (
          <AppButton
            theme="primary"
            title="Manage Events"
            icon="clipboard-outline"
            onPress={() => router.push('/teacher')}
          />
        ) : role === 'admin' ? (
          <AppButton
            theme="primary"
            title="Open Admin Dashboard"
            icon="shield-checkmark-outline"
            onPress={() => router.push('/admin')}
          />
        ) : null}
        {role === 'student' && (
          <AppButton
            title="Available Events"
            icon="calendar-outline"
            onPress={() => router.push('/events')}
          />
        )}
        <AppButton
          title="Attendance History"
          icon="time-outline"
          onPress={() => router.push('/history')}
        />
        <AppButton
          title="Profile"
          icon="person-outline"
          onPress={() => router.push('/profile')}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  headerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  bodyContainer: { paddingHorizontal: 24, marginBottom: 24 },
  mainTitle: { fontSize: 22, fontWeight: '700', color: COLORS.textPrimary, marginBottom: 6 },
  subtitle: { fontSize: 15, lineHeight: 21, color: COLORS.textSecondary },
  footerContainer: { paddingHorizontal: 24, paddingBottom: 12, width: '100%' },
  loader: { marginBottom: 18 },
});