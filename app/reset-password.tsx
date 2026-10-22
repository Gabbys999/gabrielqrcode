import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableWithoutFeedback,
  View,
  Linking,
} from 'react-native';
import { Link, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import AppButton from '@/components/AppButton';
import Header from '@/components/Header';
import { COLORS } from '@/constants/colors';
import { handlePasswordRecoveryUrl } from '@/lib/auth';
import { supabase } from '@/lib/supabase';

export default function ResetPasswordScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [checkingLink, setCheckingLink] = useState(true);
  const [recoveryReady, setRecoveryReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let active = true;

    const processUrl = async (url: string) => {
      setCheckingLink(true);
      setError(null);
      try {
        const handled = await handlePasswordRecoveryUrl(url);
        if (active && handled) setRecoveryReady(true);
      } catch (err) {
        if (active) {
          setRecoveryReady(false);
          setError(err instanceof Error ? err.message : 'This reset link is invalid or expired.');
        }
      } finally {
        if (active) setCheckingLink(false);
      }
    };

    Linking.getInitialURL()
      .then((url) => {
        if (url) {
          void processUrl(url);
        } else if (active) {
          setCheckingLink(false);
        }
      })
      .catch((err: unknown) => {
        if (active) {
          setError(err instanceof Error ? err.message : 'Could not read the reset link.');
          setCheckingLink(false);
        }
      });

    const subscription = Linking.addEventListener('url', ({ url }) => {
      void processUrl(url);
    });

    return () => {
      active = false;
      subscription.remove();
    };
  }, []);

  const handleSubmit = async () => {
    setError(null);
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) {
        setError(updateError.message);
      } else {
        router.replace('/(tabs)');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update your password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.headerContainer}>
              <Header title="QR Attendance" />
            </View>

            <Text style={styles.title}>Reset Password</Text>
            {checkingLink ? (
              <ActivityIndicator size="large" color={COLORS.primary} />
            ) : recoveryReady ? (
              <View style={styles.form}>
                <Text style={styles.subtitle}>Choose a new password for your account.</Text>
                <Text style={styles.label}>New Password</Text>
                <TextInput
                  style={styles.input}
                  value={password}
                  onChangeText={setPassword}
                  placeholder="Password"
                  placeholderTextColor={COLORS.textSecondary}
                  secureTextEntry
                  autoCapitalize="none"
                  editable={!loading}
                />
                <Text style={styles.label}>Confirm Password</Text>
                <TextInput
                  style={styles.input}
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  placeholder="Enter your new password again"
                  placeholderTextColor={COLORS.textSecondary}
                  secureTextEntry
                  autoCapitalize="none"
                  editable={!loading}
                />
                {error ? <Text style={styles.error}>{error}</Text> : null}
                <View style={styles.action}>
                  {loading ? (
                    <ActivityIndicator size="large" color={COLORS.primary} />
                  ) : (
                    <AppButton
                      theme="primary"
                      title="Update Password"
                      icon="checkmark-outline"
                      onPress={handleSubmit}
                    />
                  )}
                </View>
              </View>
            ) : (
              <View>
                <Text style={styles.subtitle}>
                  {error ?? 'Open the password reset link from your email to choose a new password.'}
                </Text>
                <Link href="/forgot-password" style={styles.link}>
                  Request a new reset link
                </Link>
              </View>
            )}
          </ScrollView>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingBottom: 40,
  },
  headerContainer: {
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 21,
    color: COLORS.textSecondary,
    marginBottom: 24,
  },
  form: {
    marginBottom: 24,
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
    fontSize: 16,
    color: COLORS.textPrimary,
  },
  error: {
    fontSize: 14,
    color: COLORS.danger,
    marginTop: 12,
  },
  action: {
    marginTop: 18,
  },
  link: {
    fontSize: 14,
    color: COLORS.primary,
    textAlign: 'center',
    fontWeight: '600',
  },
});
