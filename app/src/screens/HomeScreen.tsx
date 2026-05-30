import React, { useCallback, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  FlatList,
  Image,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { getLogs, getStats, ReadingLog, UserStats } from '../api/client';
import RetryView from '../components/RetryView';

interface Props {
  userId: string;
}

export default function HomeScreen({ userId }: Props) {
  const [stats, setStats] = useState<UserStats | null>(null);
  const [logs, setLogs] = useState<ReadingLog[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    try {
      const [s, l] = await Promise.all([getStats(userId), getLogs(userId)]);
      setStats(s);
      setLogs(l);
      setError(false);
    } catch {
      setError(true);
    }
  }, [userId]);

  // Refetch every time the tab regains focus (tabs stay mounted, so a plain
  // mount effect would show stale data after logging a book on another tab).
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  if (error && !stats) {
    return <RetryView onRetry={load} />;
  }

  const header = (
    <View>
      {stats && (
        <View style={styles.statsRow}>
          <StatCard label="Books" value={stats.totalBooks} />
          <StatCard label="Hours" value={stats.totalHours} />
          <StatCard label="Streak" value={`${stats.currentStreak}d`} />
          <StatCard label="Goals" value={stats.completedGoals} />
        </View>
      )}
      <Text style={styles.sectionTitle}>Recent Reading</Text>
    </View>
  );

  return (
    <FlatList
      data={logs}
      keyExtractor={item => item.id}
      ListHeaderComponent={header}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      renderItem={({ item }) => <LogRow log={item} />}
      ListEmptyComponent={
        <Text style={styles.empty}>No reading logged yet. Search for a book to get started!</Text>
      }
      contentContainerStyle={styles.container}
    />
  );
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <View style={styles.card}>
      <Text style={styles.cardValue}>{value}</Text>
      <Text style={styles.cardLabel}>{label}</Text>
    </View>
  );
}

function LogRow({ log }: { log: ReadingLog }) {
  const date = new Date(log.loggedAt).toLocaleDateString();
  return (
    <View style={styles.logRow}>
      {log.coverUrl ? (
        <Image source={{ uri: log.coverUrl }} style={styles.cover} />
      ) : (
        <View style={[styles.cover, styles.coverPlaceholder]} />
      )}
      <View style={styles.logInfo}>
        <Text style={styles.logTitle} numberOfLines={1}>{log.title}</Text>
        <Text style={styles.logMeta}>{log.author}</Text>
        <Text style={styles.logMeta}>
          {log.minutesRead > 0 ? `${log.minutesRead} min` : 'Logged'} · {date}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16 },
  statsRow: { flexDirection: 'row', gap: 8, marginBottom: 24 },
  card: {
    flex: 1,
    backgroundColor: '#1a1a2e',
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
  },
  cardValue: { color: '#fff', fontSize: 20, fontWeight: '700' },
  cardLabel: { color: '#aaa', fontSize: 11, marginTop: 2 },
  sectionTitle: { fontSize: 18, fontWeight: '700', marginBottom: 12 },
  logRow: { flexDirection: 'row', gap: 12, marginBottom: 16, alignItems: 'center' },
  cover: { width: 48, height: 64, borderRadius: 4 },
  coverPlaceholder: { backgroundColor: '#ddd' },
  logInfo: { flex: 1 },
  logTitle: { fontSize: 15, fontWeight: '600' },
  logMeta: { fontSize: 13, color: '#666', marginTop: 2 },
  empty: { textAlign: 'center', color: '#999', marginTop: 40 },
});
