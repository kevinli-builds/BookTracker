import React, { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
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

const Tab = createBottomTabNavigator();

interface AppUser {
  id: string;
  displayName: string | null;
  hasAccess: boolean;
}

export default function App() {
  const [user, setUser] = useState<AppUser | null>(null);

  useEffect(() => {
    (async () => {
      const id = await getUserId();
      const u = await upsertUser(id);
      setUser({ id, displayName: u?.displayName ?? null, hasAccess: !!u?.hasAccess });
    })();
  }, []);

  if (!user) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" />
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
          <Tab.Screen name="Home" options={{ title: 'Home' }}>
            {() => <HomeScreen userId={user.id} />}
          </Tab.Screen>
          <Tab.Screen name="Search" options={{ title: 'Log a Book' }}>
            {() => <SearchScreen userId={user.id} />}
          </Tab.Screen>
          <Tab.Screen name="Goals" options={{ title: 'Goals' }}>
            {() => <GoalsScreen userId={user.id} />}
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
