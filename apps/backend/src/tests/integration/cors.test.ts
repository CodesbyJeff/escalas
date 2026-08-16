import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { buildApp } from '../../app.js';

describe('CORS', () => {
  it('origem permitida recebe o header', async () => {
    const r = await request(buildApp()).get('/health').set('Origin', 'http://localhost:5173');
    expect(r.status).toBe(200);
    expect(r.headers['access-control-allow-origin']).toBe('http://localhost:5173');
  });

  it('origem estranha não recebe o header', async () => {
    const r = await request(buildApp()).get('/health').set('Origin', 'http://invasor.invalid');
    expect(r.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('requisição sem Origin continua atendida (mobile, curl, healthcheck)', async () => {
    const r = await request(buildApp()).get('/health');
    expect(r.status).toBe(200);
    expect(r.body.ok).toBe(true);
  });
});
