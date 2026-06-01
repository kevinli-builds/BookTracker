import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { getUserId } from './src/lib/userId';
import { upsertUser } from './src/api/client';
import HomeScreen from './src/screens/HomeScreen';
import SearchScreen from './src/screens/SearchScreen';
import GoalsScreen from './src/screens/GoalsScreen';
import ProfileScreen from './src/screens/ProfileScreen';
import NameEntryScreen from './src/screens/NameEntryScreen';
import InviteCodeScreen from './src/screens/InviteCodeScreen';
import CheckinScreen from './src/screens/CheckinScreen';

const Tab = createBottomTabNavigator();

interface AppUser {
  id: string;
  displayName: string | null;
  hasAccess: boolean;
  hideTracking: boolean;
}

export default function App() {
  const [user, setUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const loadUser = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const id = await getUserId();
      const u = await upsertUser(id);
      setUser({ id, displayName: u?.displayName ?? null, hasAccess: !!u?.hasAccess, hideTracking: !!u?.hideTracking });
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadUser(); }, [loadUser]);

  if (loading) {
    return (
      <View style={appStyles.center}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (error || !user) {
    return (
      <View style={appStyles.center}>
        <Text style={appStyles.errorText}>
          Couldn’t connect to BookTracker. Check your internet connection and try again.
        </Text>
        <TouchableOpacity style={appStyles.retryBtn} onPress={loadUser}>
          <Text style={appStyles.retryText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!user.hasAccess) {
    return (
      <SafeAreaProvider>
        <InviteCodeScreen
          userId={user.id}
          onRedeemed={name =>
            setUser({ ...user, hasAccess: true, displayName: name ?? user.displayName })
          }
        />
      </SafeAreaProvider>
    );
  }

  if (!user.displayName) {
    return (
      <SafeAreaProvider>
        <NameEntryScreen
          userId={user.id}
          onSaved={name => setUser({ ...user, displayName: name })}
        />
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <NavigationContainer>
        <Tab.Navigator screenOptions={{ headerShown: true }}>
          {/* Tracking features (Home stats, book logging, goals) are hidden for
              study groups the researcher configured as check-in-only. */}
          {!user.hideTracking && (
            <>
              <Tab.Screen name="Home" options={{ title: 'Home' }}>
                {() => <HomeScreen userId={user.id} />}
              </Tab.Screen>
              <Tab.Screen name="Search" options={{ title: 'Log a Book' }}>
                {() => <SearchScreen userId={user.id} />}
              </Tab.Screen>
              <Tab.Screen name="Goals" options={{ title: 'Goals' }}>
                {() => <GoalsScreen userId={user.id} />}
              </Tab.Screen>
            </>
          )}
          <Tab.Screen name="Check-in" options={{ title: 'Check-in' }}>
            {() => <CheckinScreen userId={user.id} />}
          </Tab.Screen>
          <Tab.Screen name="Profile" options={{ title: 'Profile' }}>
            {() => (
              <ProfileScreen
                userId={user.id}
                displayName={user.displayName}
                onNameChange={name => setUser({ ...user, displayName: name })}
              />
            )}
          </Tab.Screen>
        </Tab.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}

const appStyles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' },
  errorText: { fontSize: 16, color: '#444', textAlign: 'center', paddingHorizontal: 32, marginBottom: 16, lineHeight: 22 },
  retryBtn: { backgroundColor: '#1a1a2e', borderRadius: 10, paddingVertical: 12, paddingHorizontal: 28 },
  retryText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});
