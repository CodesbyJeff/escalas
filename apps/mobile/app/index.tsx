import { View, Text } from 'react-native';
import type { AuthUser } from '@escalas/shared-types';

// Type check only — AuthUser from @escalas/shared-types resolves via tsconfig paths
type _Check = AuthUser;

export default function Index() {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
      <Text>Escalas CBMRN — Mobile (placeholder)</Text>
    </View>
  );
}
