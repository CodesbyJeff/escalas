export interface MirrorRefResponse {
  users: string;
  lotacoes: string;
  [k: string]: string;
}

export type EventType = 'new' | 'upd' | 'del';

export interface SyncEvent {
  entity: string;
  type: EventType;
  data: Record<string, unknown>;
  timestamp: string;
}

export interface EventsResponse {
  events: SyncEvent[];
  next_cursor: string | null;
  has_more: boolean;
}

export interface LoginAdResponse {
  success: boolean;
}
