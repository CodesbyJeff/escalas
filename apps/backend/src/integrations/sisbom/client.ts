import axios, { type AxiosInstance } from 'axios';
import { env } from '../../config/env.js';
import type { EventsResponse, LoginAdResponse, MirrorRefResponse, SnapshotResponse } from './types.js';

class SisbomClient {
  private external: AxiosInstance;
  private auth: AxiosInstance;

  constructor() {
    this.external = axios.create({
      baseURL: env.SISBOM_EXTERNAL_BASE_URL,
      timeout: 10000,
      headers: { 'x-api-key': env.SISBOM_API_KEY },
    });
    this.auth = axios.create({
      baseURL: env.SISBOM_AUTH_URL.replace(/\/api\/login-ad$/, ''),
      timeout: 10000,
    });
  }

  async loginAd(cpf: string, password: string): Promise<boolean> {
    try {
      const res = await this.auth.post<LoginAdResponse>('/api/login-ad', {
        str_cpf: cpf,
        password,
      });
      return res.status >= 200 && res.status < 300;
    } catch (err) {
      if (axios.isAxiosError(err) && err.response && err.response.status >= 400 && err.response.status < 500) {
        return false;
      }
      throw err;
    }
  }

  async getMirrorRef(): Promise<MirrorRefResponse> {
    const res = await this.external.get<MirrorRefResponse>('/mirror-ref');
    return res.data;
  }

  async getEvents(params: { since: string; entities: string; limit?: number }): Promise<EventsResponse> {
    const res = await this.external.get<EventsResponse>('/events', {
      params: { since: params.since, entities: params.entities, limit: params.limit ?? 500 },
    });
    return res.data;
  }

  async getSnapshot(params: { entity: string; skip?: number; limit?: number }): Promise<SnapshotResponse> {
    const res = await this.external.get<SnapshotResponse>('/snapshot', {
      params: { entity: params.entity, skip: params.skip ?? 0, limit: params.limit ?? 500 },
    });
    return res.data;
  }
}

export const sisbomClient = new SisbomClient();
