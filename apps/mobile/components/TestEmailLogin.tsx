import { useEffect, useRef, useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet } from 'react-native';
import { testLoginEnabled } from '../lib/testLogin';

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
  const enabled = testLoginEnabled();
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
      <Text style={styles.label}>LOCAL TEST LOGIN — synthetic accounts only</Text>
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
        accessibilityLabel="Sign in to local test account"
        testID="test-sign-in"
        disabled={pending || !email.trim() || !password}
        onPress={() => void signIn()}
        style={styles.button}
      >
        <Text>{pending ? 'Signing in…' : 'Sign in to local test account'}</Text>
      </Pressable>
    </View>
  );
}
const styles = StyleSheet.create({
  panel: { padding: 10, gap: 8, backgroundColor: '#fff3cd', borderRadius: 12 },
  label: { color: '#553c00', fontSize: 12 },
  input: { backgroundColor: '#fff', color: '#111', padding: 10, borderRadius: 6 },
  button: { backgroundColor: '#f5ce65', padding: 12, borderRadius: 6, alignItems: 'center' },
});
