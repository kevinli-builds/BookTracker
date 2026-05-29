import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

// Shown when a screen's data fails to load (e.g. no connection). Gives the
// participant a clear message + a way to try again instead of a blank screen.
export default function RetryView({ onRetry }: { onRetry: () => void }) {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>
        Couldn’t load your data. Check your internet connection and try again.
      </Text>
      <TouchableOpacity style={styles.btn} onPress={onRetry}>
        <Text style={styles.btnText}>Retry</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },
  text: { fontSize: 15, color: '#444', textAlign: 'center', lineHeight: 22, marginBottom: 16 },
  btn: { backgroundColor: '#1a1a2e', borderRadius: 10, paddingVertical: 12, paddingHorizontal: 28 },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});
