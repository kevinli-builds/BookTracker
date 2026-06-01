import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { SurveyStatus, getSurveyStatus, submitSurvey } from '../api/client';
import RetryView from '../components/RetryView';

interface Props {
  userId: string;
}

export default function CheckinScreen({ userId }: Props) {
  const [status, setStatus] = useState<SurveyStatus | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [error, setError] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [justSubmitted, setJustSubmitted] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const s = await getSurveyStatus(userId);
      setStatus(s);
      setError(false);
    } catch {
      setError(true);
    }
  }, [userId]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const setAnswer = (id: string, value: string) => setAnswers(a => ({ ...a, [id]: value }));

  const submit = async () => {
    if (!status || submitting) return;
    setSubmitError('');
    // Build the answers payload: numbers as numbers, ratings as numbers, text as string.
    const payload: Record<string, number | string> = {};
    for (const q of status.questions) {
      const raw = (answers[q.id] ?? '').trim();
      if (raw === '') continue;
      payload[q.id] = q.type === 'text' ? raw : Number(raw);
    }
    const missing = status.questions.filter(q => q.required && (answers[q.id] ?? '').trim() === '');
    if (missing.length > 0) { setSubmitError('Please answer the required questions (marked *).'); return; }

    setSubmitting(true);
    try {
      await submitSurvey(userId, payload);
      setAnswers({});
      setJustSubmitted(true);
      await load();
    } catch (e: any) {
      setSubmitError(e?.response?.data?.error ?? 'Could not submit. Check your connection and try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (error && !status) return <RetryView onRetry={load} />;
  if (!status) {
    return <View style={styles.center}><ActivityIndicator size="large" /></View>;
  }

  // No survey configured by the researcher yet.
  if (status.questions.length === 0) {
    return (
      <View style={styles.center}>
        <Text style={styles.emptyTitle}>No check-in yet</Text>
        <Text style={styles.emptyText}>There’s no check-in survey set up right now. Check back later.</Text>
      </View>
    );
  }

  // Not due — show confirmation + when the next one opens.
  if (!status.due) {
    const next = status.nextDueAt ? new Date(status.nextDueAt) : null;
    return (
      <ScrollView
        contentContainerStyle={styles.center}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <Text style={styles.emptyTitle}>{justSubmitted ? 'Thanks for checking in! ✓' : 'You’re all caught up ✓'}</Text>
        <Text style={styles.emptyText}>
          {next
            ? `Your next check-in opens ${next.toLocaleDateString()}.`
            : 'Your next check-in will open soon.'}
        </Text>
      </ScrollView>
    );
  }

  // Due — render the dynamic form.
  return (
    <ScrollView
      contentContainerStyle={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <Text style={styles.title}>Reading Check-in</Text>
      <Text style={styles.subtitle}>A quick check-in about your reading. Thanks for helping the study!</Text>

      {status.questions.map(q => (
        <View key={q.id} style={styles.field}>
          <Text style={styles.label}>{q.prompt}{q.required ? ' *' : ''}</Text>
          {q.type === 'text' ? (
            <TextInput
              style={[styles.input, styles.textArea]}
              value={answers[q.id] ?? ''}
              onChangeText={t => setAnswer(q.id, t)}
              multiline
              placeholder="Your answer (optional)"
            />
          ) : q.type === 'rating' ? (
            <View style={styles.ratingRow}>
              {[1, 2, 3, 4, 5].map(n => {
                const selected = Number(answers[q.id]) >= n;
                return (
                  <TouchableOpacity key={n} onPress={() => setAnswer(q.id, String(n))}>
                    <Text style={[styles.star, selected && styles.starOn]}>★</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          ) : (
            <TextInput
              style={styles.input}
              value={answers[q.id] ?? ''}
              onChangeText={t => setAnswer(q.id, t.replace(/[^0-9]/g, ''))}
              keyboardType="numeric"
              placeholder="0"
            />
          )}
        </View>
      ))}

      {submitError ? <Text style={styles.error}>{submitError}</Text> : null}

      <TouchableOpacity style={[styles.submitBtn, submitting && styles.btnDisabled]} onPress={submit} disabled={submitting}>
        {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitText}>Submit check-in</Text>}
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, paddingBottom: 40 },
  center: { flexGrow: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },
  title: { fontSize: 22, fontWeight: '800', marginBottom: 4 },
  subtitle: { fontSize: 14, color: '#666', marginBottom: 20, lineHeight: 20 },
  field: { marginBottom: 18 },
  label: { fontSize: 15, fontWeight: '600', marginBottom: 8 },
  input: { borderWidth: 1, borderColor: '#ddd', borderRadius: 10, padding: 12, fontSize: 16 },
  textArea: { height: 90, textAlignVertical: 'top' },
  ratingRow: { flexDirection: 'row', gap: 6 },
  star: { fontSize: 36, color: '#ddd' },
  starOn: { color: '#f59e0b' },
  error: { color: '#e74c3c', fontSize: 14, marginBottom: 12 },
  submitBtn: { backgroundColor: '#1a1a2e', borderRadius: 12, padding: 16, alignItems: 'center', marginTop: 8 },
  btnDisabled: { opacity: 0.5 },
  submitText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  emptyTitle: { fontSize: 20, fontWeight: '800', marginBottom: 8, textAlign: 'center' },
  emptyText: { fontSize: 15, color: '#666', textAlign: 'center', lineHeight: 22 },
});
