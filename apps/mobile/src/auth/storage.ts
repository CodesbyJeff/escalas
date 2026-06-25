import * as SecureStore from 'expo-secure-store';
const TOKEN = 'escalas.token';
const REFRESH = 'escalas.refresh';
export const getToken = () => SecureStore.getItemAsync(TOKEN);
export const getRefreshToken = () => SecureStore.getItemAsync(REFRESH);
export const setToken = (t: string) => SecureStore.setItemAsync(TOKEN, t);
export const setTokens = async (t: string, r: string) => { await SecureStore.setItemAsync(TOKEN, t); await SecureStore.setItemAsync(REFRESH, r); };
export const clearTokens = async () => { await SecureStore.deleteItemAsync(TOKEN); await SecureStore.deleteItemAsync(REFRESH); };
