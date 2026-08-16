import { describe, it, expect } from 'vitest';
import { parseEnv } from '../../config/env.js';

const base = {
  DATABASE_URL: 'postgresql://u:p@localhost:5432/db?schema=public',
  JWT_SECRET: 'segredo-de-teste-16-chars',
  JWT_REFRESH_SECRET: 'outro-segredo-de-teste-16',
  SISBOM_AUTH_URL: 'https://sisbom.invalid/api/login-ad',
  SISBOM_EXTERNAL_BASE_URL: 'https://sisbom.invalid/external',
  SISBOM_API_KEY: 'chave-de-teste',
};

describe('parseEnv — ALLOWED_ORIGINS', () => {
  it('produção sem ALLOWED_ORIGINS não sobe, e o erro nomeia a variável', () => {
    expect(() => parseEnv({ ...base, NODE_ENV: 'production' })).toThrow(/ALLOWED_ORIGINS/);
  });

  it('produção com ALLOWED_ORIGINS vazia também não sobe', () => {
    expect(() => parseEnv({ ...base, NODE_ENV: 'production', ALLOWED_ORIGINS: '  ,  ' })).toThrow(
      /ALLOWED_ORIGINS/,
    );
  });

  it('produção com a lista preenchida sobe e quebra a lista', () => {
    const env = parseEnv({
      ...base,
      NODE_ENV: 'production',
      ALLOWED_ORIGINS: 'https://escalas.cbm.rn.gov.br, https://admin.cbm.rn.gov.br ',
    });
    expect(env.origins).toEqual(['https://escalas.cbm.rn.gov.br', 'https://admin.cbm.rn.gov.br']);
  });

  it('fora de produção, sem a env, usa o default de dev', () => {
    const env = parseEnv({ ...base, NODE_ENV: 'development' });
    expect(env.origins).toEqual(['http://localhost:5173', 'http://localhost:4173']);
  });

  it('fora de produção, a env explícita vence o default', () => {
    const env = parseEnv({ ...base, NODE_ENV: 'test', ALLOWED_ORIGINS: 'http://outro:1234' });
    expect(env.origins).toEqual(['http://outro:1234']);
  });
});
