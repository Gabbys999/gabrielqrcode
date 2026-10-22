import { Tabs } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';

import { COLORS } from '@/constants/colors';
import { useRole } from '@/lib/role';

export default function TabLayout() {
  const { role } = useRole();

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: COLORS.primary,
        tabBarInactiveTintColor: COLORS.textSecondary,
        headerStyle: { backgroundColor: COLORS.background },
        headerShadowVisible: false,
        headerTintColor: COLORS.textPrimary,
        tabBarStyle: {
          backgroundColor: COLORS.card,
          borderTopColor: COLORS.border,
          borderTopWidth: 1,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'home-sharp' : 'home-outline'} color={color} size={24} />
          ),
        }}
      />
      <Tabs.Screen
        name="events"
        options={{
          title: 'Events',
          href: role === 'admin' ? null : undefined,
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'calendar' : 'calendar-outline'} color={color} size={24} />
          ),
        }}
      />
      <Tabs.Screen
        name="scan"
        options={{
          title: 'Scan',
          href: role === 'student' ? undefined : null,
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'qr-code' : 'qr-code-outline'} color={color} size={24} />
          ),
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          title: 'History',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'time' : 'time-outline'} color={color} size={24} />
          ),
        }}
      />
      <Tabs.Screen
        name="teacher"
        options={{
          title: 'Teacher',
          href: role === 'teacher' ? undefined : null,
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'clipboard' : 'clipboard-outline'} color={color} size={24} />
          ),
        }}
      />
      <Tabs.Screen
        name="manage-events"
        options={{
          title: 'Manage Events',
          href: null,
          headerShown: false,
        }}
      />
      <Tabs.Screen
        name="event-attendance"
        options={{
          title: 'Event Attendance',
          href: null,
          headerShown: false,
        }}
      />
      <Tabs.Screen
        name="admin"
        options={{
          title: 'Admin',
          href: role === 'admin' ? undefined : null,
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'shield-checkmark' : 'shield-checkmark-outline'} color={color} size={24} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'person' : 'person-outline'} color={color} size={24} />
          ),
        }}
      />
    </Tabs>
  );
}