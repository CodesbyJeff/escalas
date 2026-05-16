import jwt, { type SignOptions } from 'jsonwebtoken';
import { env } from './env.js';

export interface AccessPayload { user_id: number; cpf: string }
export interface RefreshPayload { user_id: number }

const accessOpts: SignOptions = { expiresIn: env.JWT_EXPIRES_IN as SignOptions['expiresIn'] };
const refreshOpts: SignOptions = { expiresIn: env.JWT_REFRESH_EXPIRES_IN as SignOptions['expiresIn'] };

export function signAccess(payload: AccessPayload): string {
  return jwt.sign(payload, env.JWT_SECRET, accessOpts);
}

export function signRefresh(payload: RefreshPayload): string {
  return jwt.sign(payload, env.JWT_REFRESH_SECRET, refreshOpts);
}

export function verifyAccess(token: string): AccessPayload {
  return jwt.verify(token, env.JWT_SECRET) as AccessPayload;
}

export function verifyRefresh(token: string): RefreshPayload {
  return jwt.verify(token, env.JWT_REFRESH_SECRET) as RefreshPayload;
}
