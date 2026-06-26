// apps/mobile/app/(tabs)/_layout.tsx
import { Tabs } from 'expo-router';
export default function TabsLayout() {
  return (
    <Tabs screenOptions={{ tabBarActiveTintColor: '#b3001b' }}>
      <Tabs.Screen name="index" options={{ title: 'Início' }} />
      <Tabs.Screen name="calendario" options={{ title: 'Calendário' }} />
    </Tabs>
  );
}
