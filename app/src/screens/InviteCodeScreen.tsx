import React, { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { redeemInvite } from '../api/client';

interface Props {
  userId: string;
  onRedeemed: (displayName: string | null) => void;
}

export default function InviteCodeScreen({ userId, onRedeemed }: Props) {
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const submit = async () => {
    const trimmed = code.trim().toUpperCase();
    if (!trimmed || loading) return;
    setLoading(true);
    setError('');
    try {
      const result = await redeemInvite(userId, trimmed);
      onRedeemed(result.displayName);
    } catch (e: any) {
      setError(e?.response?.data?.error ?? 'Could not verify code. Check your connection.');
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.inner}>
        <Text style={styles.title}>Enter your invite code</Text>
        <Text style={styles.subtitle}>
          This study is invite-only. Enter the code provided by the researcher to
          get started.
        </Text>

        <TextInput
          style={styles.input}
          placeholder="e.g. BK4X9Q"
          value={code}
          onChangeText={t => { setCode(t); setError(''); }}
          autoFocus
          autoCapitalize="characters"
          autoCorrect={false}
          returnKeyType="done"
          onSubmitEditing={submit}
        />

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <TouchableOpacity
          style={[styles.button, (!code.trim() || loading) && styles.buttonDisabled]}
          onPress={submit}
          disabled={!code.trim() || loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Continue</Text>
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  inner: { flex: 1, justifyContent: 'center', padding: 24 },
  title: { fontSize: 26, fontWeight: '800', marginBottom: 12 },
  subtitle: { fontSize: 15, color: '#666', lineHeight: 22, marginBottom: 28 },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 10,
    padding: 14,
    fontSize: 18,
    letterSpacing: 2,
    textAlign: 'center',
    marginBottom: 16,
  },
  error: { color: '#e74c3c', fontSize: 14, marginBottom: 16 },
  button: {
    backgroundColor: '#1a1a2e',
    borderRadius: 10,
    padding: 16,
    alignItems: 'center',
  },
  buttonDisabled: { opacity: 0.4 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
