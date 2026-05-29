import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  GoalTemplate,
  UserGoal,
  abandonGoal,
  addSelfGoal,
  completeGoal,
  getGoalTemplates,
  getUserGoals,
  submitFeedback,
} from '../api/client';
import RetryView from '../components/RetryView';

interface Props {
  userId: string;
}

export default function GoalsScreen({ userId }: Props) {
  const [goals, setGoals] = useState<UserGoal[]>([]);
  const [templates, setTemplates] = useState<GoalTemplate[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [feedbackGoal, setFeedbackGoal] = useState<UserGoal | null>(null);
  const [feedbackText, setFeedbackText] = useState('');
  const [feedbackRating, setFeedbackRating] = useState('');

  const load = useCallback(async () => {
    try {
      const [g, t] = await Promise.all([getUserGoals(userId), getGoalTemplates()]);
      setGoals(g);
      setTemplates(t);
      setError(false);
      setLoaded(true);
    } catch {
      setError(true);
    }
  }, [userId]);

  useEffect(() => { load(); }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const handleComplete = (goal: UserGoal) => {
    Alert.alert('Complete goal?', `Mark "${goal.template.title}" as completed?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Complete',
        onPress: async () => {
          await completeGoal(goal.id);
          setFeedbackGoal(goal);
          load();
        },
      },
    ]);
  };

  const handleAbandon = (goal: UserGoal) => {
    Alert.alert('Abandon goal?', `Remove "${goal.template.title}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Abandon',
        style: 'destructive',
        onPress: async () => { await abandonGoal(goal.id); load(); },
      },
    ]);
  };

  const handleFeedbackSubmit = async () => {
    if (!feedbackGoal) return;
    await submitFeedback({
      userId,
      userGoalId: feedbackGoal.id,
      rating: feedbackRating ? parseInt(feedbackRating, 10) : undefined,
      text: feedbackText || undefined,
    });
    setFeedbackGoal(null);
    setFeedbackText('');
    setFeedbackRating('');
  };

  if (error && !loaded) {
    return <RetryView onRetry={load} />;
  }

  const active = goals.filter(g => g.status === 'active');
  const past = goals.filter(g => g.status !== 'active');

  const header = (
    <View>
      <View style={styles.headerRow}>
        <Text style={styles.sectionTitle}>Active Goals</Text>
        <TouchableOpacity style={styles.addBtn} onPress={() => setShowAdd(true)}>
          <Text style={styles.addBtnText}>+ Add goal</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <View style={{ flex: 1 }}>
      <FlatList
        data={active}
        keyExtractor={item => item.id}
        ListHeaderComponent={header}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        renderItem={({ item }) => (
          <GoalCard
            goal={item}
            onComplete={() => handleComplete(item)}
            onAbandon={() => handleAbandon(item)}
          />
        )}
        ListFooterComponent={
          past.length > 0 ? (
            <View>
              <Text style={[styles.sectionTitle, { marginTop: 24 }]}>Past Goals</Text>
              {past.map(g => (
                <GoalCard key={g.id} goal={g} />
              ))}
            </View>
          ) : null
        }
        ListEmptyComponent={
          <Text style={styles.empty}>No active goals. Tap "+ Add goal" to set one!</Text>
        }
        contentContainerStyle={styles.container}
      />

      {/* Add goal modal */}
      <Modal visible={showAdd} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>Choose a Goal</Text>
            {templates.length === 0 ? (
              <Text style={styles.empty}>No goal templates yet. Ask your provisioner to add some!</Text>
            ) : (
              templates.map(t => (
                <TouchableOpacity
                  key={t.id}
                  style={styles.templateRow}
                  onPress={async () => {
                    await addSelfGoal(userId, t.id);
                    setShowAdd(false);
                    load();
                  }}
                >
                  <Text style={styles.templateTitle}>{t.title}</Text>
                  <Text style={styles.templateDesc}>{t.description}</Text>
                </TouchableOpacity>
              ))
            )}
            <TouchableOpacity onPress={() => setShowAdd(false)}>
              <Text style={styles.cancel}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Feedback modal */}
      <Modal visible={!!feedbackGoal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>Goal Complete!</Text>
            <Text style={styles.modalSub}>How was "{feedbackGoal?.template.title}"?</Text>
            <TextInput
              style={styles.input}
              placeholder="Rating 1–5 (optional)"
              keyboardType="numeric"
              value={feedbackRating}
              onChangeText={setFeedbackRating}
            />
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Any comments? (optional)"
              multiline
              value={feedbackText}
              onChangeText={setFeedbackText}
            />
            <TouchableOpacity style={styles.logBtn} onPress={handleFeedbackSubmit}>
              <Text style={styles.logBtnText}>Submit Feedback</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setFeedbackGoal(null)}>
              <Text style={styles.cancel}>Skip</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function GoalCard({
  goal,
  onComplete,
  onAbandon,
}: {
  goal: UserGoal;
  onComplete?: () => void;
  onAbandon?: () => void;
}) {
  const statusColor = goal.status === 'completed' ? '#22c55e' : goal.status === 'abandoned' ? '#ef4444' : '#3b82f6';

  return (
    <View style={styles.goalCard}>
      <View style={styles.goalHeader}>
        <Text style={styles.goalTitle}>{goal.template.title}</Text>
        <View style={[styles.badge, { backgroundColor: statusColor }]}>
          <Text style={styles.badgeText}>{goal.status}</Text>
        </View>
      </View>
      <Text style={styles.goalDesc}>{goal.template.description}</Text>
      {goal.assignedBy === 'system' && (
        <Text style={styles.assignedTag}>Assigned by researcher</Text>
      )}
      {goal.deadline && (
        <Text style={styles.deadline}>Due {new Date(goal.deadline).toLocaleDateString()}</Text>
      )}
      {goal.status === 'active' && (
        <View style={styles.actions}>
          <TouchableOpacity style={styles.completeBtn} onPress={onComplete}>
            <Text style={styles.completeBtnText}>Mark Complete</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.abandonBtn} onPress={onAbandon}>
            <Text style={styles.abandonBtnText}>Abandon</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  sectionTitle: { fontSize: 18, fontWeight: '700' },
  addBtn: { backgroundColor: '#1a1a2e', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6 },
  addBtnText: { color: '#fff', fontWeight: '600', fontSize: 13 },
  goalCard: { backgroundColor: '#f8f8f8', borderRadius: 12, padding: 16, marginBottom: 12 },
  goalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  goalTitle: { flex: 1, fontSize: 15, fontWeight: '700', marginRight: 8 },
  badge: { borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2 },
  badgeText: { color: '#fff', fontSize: 11, fontWeight: '600' },
  goalDesc: { fontSize: 13, color: '#555', marginBottom: 8 },
  assignedTag: { fontSize: 11, color: '#9333ea', marginBottom: 4 },
  deadline: { fontSize: 12, color: '#888', marginBottom: 8 },
  actions: { flexDirection: 'row', gap: 8, marginTop: 4 },
  completeBtn: { flex: 1, backgroundColor: '#22c55e', borderRadius: 8, padding: 8, alignItems: 'center' },
  completeBtnText: { color: '#fff', fontWeight: '600', fontSize: 13 },
  abandonBtn: { backgroundColor: '#f0f0f0', borderRadius: 8, padding: 8, paddingHorizontal: 12 },
  abandonBtnText: { color: '#888', fontSize: 13 },
  empty: { textAlign: 'center', color: '#999', marginTop: 24 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modal: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24, paddingBottom: 40 },
  modalTitle: { fontSize: 20, fontWeight: '700', marginBottom: 4 },
  modalSub: { fontSize: 14, color: '#666', marginBottom: 16 },
  templateRow: { borderWidth: 1, borderColor: '#eee', borderRadius: 10, padding: 12, marginBottom: 10 },
  templateTitle: { fontSize: 15, fontWeight: '600' },
  templateDesc: { fontSize: 13, color: '#666', marginTop: 2 },
  input: { borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 10, marginBottom: 10, fontSize: 14 },
  textArea: { height: 80, textAlignVertical: 'top' },
  logBtn: { backgroundColor: '#1a1a2e', borderRadius: 10, padding: 14, alignItems: 'center', marginBottom: 10 },
  logBtnText: { color: '#fff', fontWeight: '700' },
  cancel: { textAlign: 'center', color: '#999', fontSize: 14 },
});
