import { useState } from 'react';
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
} from 'react-native';
import { Link } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import AppButton from '@/components/AppButton';
import Header from '@/components/Header';
import { COLORS } from '@/constants/colors';
import { requestPasswordReset } from '@/lib/auth';

export default function ForgotPasswordScreen() {
  const insets = useSafeAreaInsets();
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    setError(null);
    if (!email.trim()) {
      setError('Enter your email address.');
      return;
    }

    setLoading(true);
    try {
      const { error: resetError } = await requestPasswordReset(email);
      if (resetError) {
        setError(resetError.message);
      } else {
        setSent(true);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send the reset email.');
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

            <Text style={styles.title}>Forgot Password?</Text>
            <Text style={styles.subtitle}>
              {sent
                ? `If an account exists for ${email.trim()}, you will receive an email with a password reset link.`
                : 'Enter the email address linked to your account and we will send you a reset link.'}
            </Text>

            {!sent ? (
              <View style={styles.form}>
                <Text style={styles.label}>Email</Text>
                <TextInput
                  style={styles.input}
                  value={email}
                  onChangeText={setEmail}
                  placeholder="your.email@school.edu"
                  placeholderTextColor={COLORS.textSecondary}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  autoComplete="email"
                  editable={!loading}
                />
                {error ? <Text style={styles.error}>{error}</Text> : null}

                <View style={styles.action}>
                  {loading ? (
                    <ActivityIndicator size="large" color={COLORS.primary} />
                  ) : (
                    <AppButton
                      theme="primary"
                      title="Send Reset Link"
                      icon="mail-outline"
                      onPress={handleSubmit}
                    />
                  )}
                </View>
              </View>
            ) : null}

            <Link href="/login" style={styles.link}>
              Back to Sign In
            </Link>
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
    marginBottom: 4,
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
