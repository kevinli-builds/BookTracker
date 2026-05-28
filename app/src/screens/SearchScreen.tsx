import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Modal,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { BookResult, logBook, searchBooks } from '../api/client';

interface Props {
  userId: string;
}

export default function SearchScreen({ userId }: Props) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<BookResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<BookResult | null>(null);
  const [minutes, setMinutes] = useState('');
  const [logging, setLogging] = useState(false);

  const search = async () => {
    if (!query.trim()) return;
    setLoading(true);
    try {
      const res = await searchBooks(query.trim());
      setResults(res);
    } catch {
      Alert.alert('Error', 'Search failed. Try again.');
    } finally {
      setLoading(false);
    }
  };

  const confirmLog = async () => {
    if (!selected) return;
    setLogging(true);
    try {
      await logBook({
        userId,
        googleBooksId: selected.id,
        title: selected.title,
        author: selected.author,
        coverUrl: selected.coverUrl,
        minutesRead: minutes ? parseInt(minutes, 10) : 0,
      });
      Alert.alert('Logged!', `"${selected.title}" added to your reading log.`);
      setSelected(null);
      setMinutes('');
    } catch {
      Alert.alert('Error', 'Could not log book. Try again.');
    } finally {
      setLogging(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.searchRow}>
        <TextInput
          style={styles.input}
          placeholder="Search by title or author..."
          value={query}
          onChangeText={setQuery}
          onSubmitEditing={search}
          returnKeyType="search"
        />
        <TouchableOpacity style={styles.searchBtn} onPress={search}>
          <Text style={styles.searchBtnText}>Search</Text>
        </TouchableOpacity>
      </View>

      {loading && <ActivityIndicator style={{ marginTop: 24 }} />}

      <FlatList
        data={results}
        keyExtractor={item => item.id}
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.result} onPress={() => setSelected(item)}>
            {item.coverUrl ? (
              <Image source={{ uri: item.coverUrl }} style={styles.cover} />
            ) : (
              <View style={[styles.cover, styles.coverPlaceholder]} />
            )}
            <View style={styles.info}>
              <Text style={styles.title} numberOfLines={2}>{item.title}</Text>
              <Text style={styles.author}>{item.author}</Text>
              {item.pageCount && <Text style={styles.meta}>{item.pageCount} pages</Text>}
            </View>
          </TouchableOpacity>
        )}
      />

      <Modal visible={!!selected} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle} numberOfLines={2}>{selected?.title}</Text>
            <Text style={styles.modalAuthor}>{selected?.author}</Text>
            <Text style={styles.modalLabel}>How many minutes did you read? (optional)</Text>
            <TextInput
              style={styles.minutesInput}
              placeholder="e.g. 30"
              keyboardType="numeric"
              value={minutes}
              onChangeText={setMinutes}
            />
            <TouchableOpacity
              style={styles.logBtn}
              onPress={confirmLog}
              disabled={logging}
            >
              {logging
                ? <ActivityIndicator color="#fff" />
                : <Text style={styles.logBtnText}>Log this book</Text>}
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setSelected(null)}>
              <Text style={styles.cancel}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  searchRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 15,
  },
  searchBtn: {
    backgroundColor: '#1a1a2e',
    borderRadius: 8,
    paddingHorizontal: 16,
    justifyContent: 'center',
  },
  searchBtnText: { color: '#fff', fontWeight: '600' },
  result: { flexDirection: 'row', gap: 12, marginBottom: 16, alignItems: 'flex-start' },
  cover: { width: 52, height: 72, borderRadius: 4 },
  coverPlaceholder: { backgroundColor: '#ddd' },
  info: { flex: 1 },
  title: { fontSize: 15, fontWeight: '600' },
  author: { fontSize: 13, color: '#555', marginTop: 2 },
  meta: { fontSize: 12, color: '#999', marginTop: 2 },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modal: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 24,
    paddingBottom: 40,
  },
  modalTitle: { fontSize: 18, fontWeight: '700', marginBottom: 4 },
  modalAuthor: { fontSize: 14, color: '#666', marginBottom: 20 },
  modalLabel: { fontSize: 14, marginBottom: 8 },
  minutesInput: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 15,
    marginBottom: 16,
  },
  logBtn: {
    backgroundColor: '#1a1a2e',
    borderRadius: 10,
    padding: 14,
    alignItems: 'center',
    marginBottom: 12,
  },
  logBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  cancel: { textAlign: 'center', color: '#999', fontSize: 14 },
});
