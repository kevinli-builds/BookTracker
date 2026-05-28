import React, { useCallback, useEffect, useState } from 'react';
import {
  Image,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { UserStats, getStats, upsertUser } from '../api/client';

interface Props {
  userId: string;
  displayName: string | null;
  onNameChange: (name: string) => void;
}

export default function ProfileScreen({ userId, displayName, onNameChange }: Props) {
  const [stats, setStats] = useState<UserStats | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [editing, setEditing] = useState(false);
  const [nameDraft, setNameDraft] = useState(displayName ?? '');
  const [savingName, setSavingName] = useState(false);

  const load = useCallback(async () => {
    const s = await getStats(userId);
    setStats(s);
  }, [userId]);

  useEffect(() => { load(); }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const saveName = async () => {
    const trimmed = nameDraft.trim();
    if (!trimmed || savingName) return;
    setSavingName(true);
    try {
      await upsertUser(userId, trimmed);
      onNameChange(trimmed);
      setEditing(false);
    } finally {
      setSavingName(false);
    }
  };

  if (!stats) {
    return <View style={styles.center}><Text>Loading...</Text></View>;
  }

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <View style={styles.nameCard}>
        <Text style={styles.nameLabel}>Participant</Text>
        {editing ? (
          <View style={styles.nameEditRow}>
            <TextInput
              style={styles.nameInput}
              value={nameDraft}
              onChangeText={setNameDraft}
              autoFocus
              autoCapitalize="words"
              returnKeyType="done"
              onSubmitEditing={saveName}
            />
            <TouchableOpacity onPress={saveName} disabled={savingName}>
              <Text style={styles.nameAction}>{savingName ? '…' : 'Save'}</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.nameEditRow}>
            <Text style={styles.nameValue}>{displayName}</Text>
            <TouchableOpacity onPress={() => { setNameDraft(displayName ?? ''); setEditing(true); }}>
              <Text style={styles.nameAction}>Edit</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      <Text style={styles.heading}>Your Reading Stats</Text>

      <View style={styles.grid}>
        <BigStat label="Total Books" value={stats.totalBooks} />
        <BigStat label="Total Hours" value={stats.totalHours} />
        <BigStat label="Current Streak" value={`${stats.currentStreak} days`} />
        <BigStat label="Longest Streak" value={`${stats.longestStreak} days`} />
        <BigStat label="Goals Completed" value={stats.completedGoals} />
        <BigStat label="Active Goals" value={stats.activeGoals} />
      </View>

      {stats.topBooks.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Most Read Books</Text>
          {stats.topBooks.map((book, i) => (
            <View key={i} style={styles.bookRow}>
              {book.coverUrl ? (
                <Image source={{ uri: book.coverUrl }} style={styles.cover} />
              ) : (
                <View style={[styles.cover, styles.coverPlaceholder]} />
              )}
              <View style={styles.bookInfo}>
                <Text style={styles.bookTitle} numberOfLines={1}>{book.title}</Text>
                <Text style={styles.bookMeta}>{book.author}</Text>
                <Text style={styles.bookMeta}>{book.minutes} minutes read</Text>
              </View>
            </View>
          ))}
        </View>
      )}

      {stats.booksPerMonth.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Books Per Month</Text>
          {stats.booksPerMonth.map(({ month, count }) => (
            <View key={month} style={styles.monthRow}>
              <Text style={styles.monthLabel}>{month}</Text>
              <View style={styles.barTrack}>
                <View style={[styles.bar, { flex: count }]} />
                <View style={{ flex: Math.max(0, 10 - count) }} />
              </View>
              <Text style={styles.monthCount}>{count}</Text>
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

function BigStat({ label, value }: { label: string; value: string | number }) {
  return (
    <View style={styles.bigStat}>
      <Text style={styles.bigStatValue}>{value}</Text>
      <Text style={styles.bigStatLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  heading: { fontSize: 22, fontWeight: '800', marginBottom: 20 },
  nameCard: {
    backgroundColor: '#f0f0f7',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  nameLabel: { fontSize: 12, color: '#888', marginBottom: 4, fontWeight: '600' },
  nameEditRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  nameValue: { fontSize: 18, fontWeight: '700', flex: 1 },
  nameInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    padding: 8,
    fontSize: 16,
    backgroundColor: '#fff',
  },
  nameAction: { color: '#1a1a2e', fontWeight: '700', fontSize: 15 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 24 },
  bigStat: {
    width: '47%',
    backgroundColor: '#1a1a2e',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  bigStatValue: { color: '#fff', fontSize: 26, fontWeight: '800' },
  bigStatLabel: { color: '#aaa', fontSize: 12, marginTop: 4, textAlign: 'center' },
  section: { marginBottom: 24 },
  sectionTitle: { fontSize: 18, fontWeight: '700', marginBottom: 12 },
  bookRow: { flexDirection: 'row', gap: 12, marginBottom: 12, alignItems: 'center' },
  cover: { width: 44, height: 60, borderRadius: 4 },
  coverPlaceholder: { backgroundColor: '#ddd' },
  bookInfo: { flex: 1 },
  bookTitle: { fontSize: 14, fontWeight: '600' },
  bookMeta: { fontSize: 12, color: '#666', marginTop: 2 },
  monthRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  monthLabel: { width: 60, fontSize: 12, color: '#555' },
  barTrack: { flex: 1, flexDirection: 'row', height: 16, borderRadius: 4, overflow: 'hidden', backgroundColor: '#eee' },
  bar: { backgroundColor: '#1a1a2e', borderRadius: 4 },
  monthCount: { width: 24, fontSize: 12, color: '#555', textAlign: 'right' },
});
