// Contrato real dos endpoints /external do SISBOM (api_sisbom/routes/external.js).

export interface MirrorRefResponse {
  ref: Record<string, string | null>;
  server_time: string;
}

export type SyncEventOp = 'create' | 'patch' | 'upsert' | 'delete' | 'remove';

export interface SyncEvent {
  id: string;
  op: SyncEventOp;
  entity: string;
  entity_id: string | null;
  at: string;
  data: Record<string, unknown> | null;
}

export interface EventsResponse {
  events: SyncEvent[];
  next_since: string;
  has_more: boolean;
  retention_days: number;
  is_stale: boolean;
}

export interface SnapshotResponse {
  entity: string;
  items: Record<string, unknown>[];
  skip: number;
  limit: number;
  has_more: boolean;
}

export interface LoginAdResponse {
  success: boolean;
}

export interface MapaForcaResponse {
  militares: Record<string, unknown>[];
  resumo: Record<string, unknown> | null;
}

export interface MapaGuarnicaoMembro {
  _id?: string;
  _militar?: string;
  str_funcao?: string | null;
  _patente?: number | null;
  bo_diaria?: boolean;
}

export interface MapaGuarnicaoDoc {
  _lotacao: string;
  atividade?: string | null;
  atividade_extra?: string | null;
  date_start?: string | null;
  time_start?: string | null;
  time_end?: string | null;
  guarnicao?: MapaGuarnicaoMembro[];
}
