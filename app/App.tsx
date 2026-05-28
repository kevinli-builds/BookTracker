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

const Tab = createBottomTabNavigator();

export default function App() {
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const id = await getUserId();
      await upsertUser(id);
      setUserId(id);
    })();
  }, []);

  if (!userId) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <NavigationContainer>
        <Tab.Navigator screenOptions={{ headerShown: true }}>
          <Tab.Screen name="Home" options={{ title: 'Home' }}>
            {() => <HomeScreen userId={userId} />}
          </Tab.Screen>
          <Tab.Screen name="Search" options={{ title: 'Log a Book' }}>
            {() => <SearchScreen userId={userId} />}
          </Tab.Screen>
          <Tab.Screen name="Goals" options={{ title: 'Goals' }}>
            {() => <GoalsScreen userId={userId} />}
          </Tab.Screen>
          <Tab.Screen name="Profile" options={{ title: 'Profile' }}>
            {() => <ProfileScreen userId={userId} />}
          </Tab.Screen>
        </Tab.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}
