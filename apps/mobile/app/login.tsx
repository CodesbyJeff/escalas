import { useState } from 'react';
import { View, Text, TextInput, Pressable, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import { useAuth } from '../src/auth/AuthContext';

export default function Login() {
  const { login } = useAuth();
  const [cpf, setCpf] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const onEntrar = async () => {
    setErro(null); setBusy(true);
    try { await login(cpf, senha); router.replace('/(tabs)'); }
    catch (e) { setErro((e as Error).message); }
    finally { setBusy(false); }
  };
  return (
    <View style={{ flex: 1, justifyContent: 'center', padding: 24, gap: 12 }}>
      <Text style={{ fontSize: 22, fontWeight: '700', textAlign: 'center', color: '#b3001b' }}>ESCALAS CBMRN</Text>
      {erro && <Text style={{ color: 'red' }}>{erro}</Text>}
      <TextInput placeholder="CPF" keyboardType="number-pad" value={cpf} onChangeText={setCpf} style={{ borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 12 }} />
      <TextInput placeholder="Senha" secureTextEntry value={senha} onChangeText={setSenha} style={{ borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 12 }} />
      <Pressable onPress={onEntrar} disabled={busy} style={{ backgroundColor: '#b3001b', padding: 14, borderRadius: 8, alignItems: 'center' }}>
        {busy ? <ActivityIndicator color="#fff" /> : <Text style={{ color: '#fff', fontWeight: '700' }}>ENTRAR</Text>}
      </Pressable>
    </View>
  );
}
