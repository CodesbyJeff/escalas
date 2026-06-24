const TOKEN = 'escalas.token';
const REFRESH = 'escalas.refresh';

export const getToken = () => localStorage.getItem(TOKEN);
export const getRefreshToken = () => localStorage.getItem(REFRESH);
export const setToken = (t: string) => localStorage.setItem(TOKEN, t);
export const setTokens = (t: string, r: string) => {
  localStorage.setItem(TOKEN, t);
  localStorage.setItem(REFRESH, r);
};
export const clearTokens = () => {
  localStorage.removeItem(TOKEN);
  localStorage.removeItem(REFRESH);
};
