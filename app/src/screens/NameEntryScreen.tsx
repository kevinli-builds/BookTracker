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
import { upsertUser } from '../api/client';

interface Props {
  userId: string;
  onSaved: (name: string) => void;
}

export default function NameEntryScreen({ userId, onSaved }: Props) {
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);

  const save = async () => {
    const trimmed = name.trim();
    if (!trimmed || saving) return;
    setSaving(true);
    try {
      await upsertUser(userId, trimmed);
      onSaved(trimmed);
    } catch {
      setSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.inner}>
        <Text style={styles.title}>Welcome to BookTracker</Text>
        <Text style={styles.subtitle}>
          Enter your name or participant ID so the study can match your reading
          activity to your records.
        </Text>

        <TextInput
          style={styles.input}
          placeholder="Name or participant ID"
          value={name}
          onChangeText={setName}
          autoFocus
          autoCapitalize="words"
          returnKeyType="done"
          onSubmitEditing={save}
        />

        <TouchableOpacity
          style={[styles.button, (!name.trim() || saving) && styles.buttonDisabled]}
          onPress={save}
          disabled={!name.trim() || saving}
        >
          {saving ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Get Started</Text>
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
    fontSize: 16,
    marginBottom: 20,
  },
  button: {
    backgroundColor: '#1a1a2e',
    borderRadius: 10,
    padding: 16,
    alignItems: 'center',
  },
  buttonDisabled: { opacity: 0.4 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
