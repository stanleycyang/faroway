import { useEffect, useRef, useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet } from 'react-native';
import { emailLoginEnabled, qaLoginEnabled } from '../lib/testLogin';

/** Uses real Auth and the normal session listener; contains no preset credentials. */
export function TestEmailLogin({
  onAuthenticated,
  active = true,
}: {
  onAuthenticated?: () => void;
  active?: boolean;
}) {
  const live = useRef(active);
  const busy = useRef(false);
  useEffect(() => {
    live.current = active;
    return () => {
      live.current = false;
    };
  }, [active]);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const enabled = emailLoginEnabled();
  const qa = qaLoginEnabled();
  const signInLabel = qa ? 'Sign in to QA account' : 'Sign in to local test account';
  if (!enabled) return null;
  const signIn = async () => {
    if (busy.current || !live.current) return;
    busy.current = true;
    setPending(true);
    setError('');
    try {
      const { supabase } = await import('../lib/supabase');
      const result = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (result.error) throw result.error;
      if (!live.current) return;
      setPassword('');
      onAuthenticated?.();
    } catch (cause) {
      if (!live.current) return;
      setError(cause instanceof Error ? cause.message : 'Test sign-in failed');
    } finally {
      busy.current = false;
      if (live.current) setPending(false);
    }
  };
  return (
    <View style={styles.panel} testID="test-email-login">
      <Text style={styles.label}>
        {qa ? 'Faroway QA · Staging account' : 'LOCAL TEST LOGIN — synthetic accounts only'}
      </Text>
      <TextInput
        style={styles.input}
        testID="test-email"
        accessibilityLabel="Test email"
        autoComplete="off"
        textContentType="none"
        autoCapitalize="none"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
        editable={!pending}
        placeholder="Test email"
      />
      <TextInput
        style={styles.input}
        testID="test-password"
        accessibilityLabel="Test password"
        autoComplete="off"
        textContentType="none"
        autoCapitalize="none"
        returnKeyType="done"
        onSubmitEditing={() => void signIn()}
        secureTextEntry
        value={password}
        onChangeText={setPassword}
        editable={!pending}
        placeholder="Test password"
      />
      {!!error && (
        <Text accessibilityRole="alert" style={styles.label}>
          {error}
        </Text>
      )}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={signInLabel}
        testID="test-sign-in"
        disabled={pending || !email.trim() || !password}
        onPress={() => void signIn()}
        style={[styles.button, (pending || !email.trim() || !password) && { opacity: 0.5 }]}
      >
        <Text style={{ color: '#fff', fontWeight: '600', fontSize: 16 }}>
          {pending ? 'Signing in…' : signInLabel}
        </Text>
      </Pressable>
    </View>
  );
}
const styles = StyleSheet.create({
  panel: { padding: 16, gap: 12, backgroundColor: '#EFF5F3', borderRadius: 16, width: '100%' },
  label: { color: '#53676C', fontSize: 13, lineHeight: 18 },
  input: {
    backgroundColor: '#fff',
    color: '#111',
    padding: 14,
    minHeight: 48,
    fontSize: 16,
    borderRadius: 10,
  },
  button: {
    backgroundColor: '#C03A31',
    minHeight: 48,
    padding: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
});
