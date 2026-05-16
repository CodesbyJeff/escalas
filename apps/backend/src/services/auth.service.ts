import type { PrismaClient } from '@prisma/client';
import { signAccess, signRefresh, verifyRefresh } from '../config/jwt.js';
import { sisbomClient } from '../integrations/sisbom/client.js';
import type { AuthUser, Role } from '@escalas/shared-types';
import type { LoginInput } from '@escalas/shared-schemas';

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export interface AuthDeps {
  prisma: PrismaClient;
  sisbom: typeof sisbomClient;
}

export interface LoginResult {
  token: string;
  refresh_token: string;
  user: AuthUser;
}

async function buildAuthUser(prisma: PrismaClient, userId: number): Promise<AuthUser> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { roles: true },
  });
  if (!user) throw new HttpError(404, 'Usuário não encontrado.');
  return {
    id: user.id,
    cpf: user.cpf,
    matricula: user.matricula,
    nome: user.nome,
    is_super_admin: user.is_super_admin,
    roles: user.roles.map((r) => ({ role: r.role as Role, lotacao_id: r.lotacao_id })),
  };
}

export const authService = {
  async login(input: LoginInput, deps: AuthDeps): Promise<LoginResult> {
    const ok = await deps.sisbom.loginAd(input.cpf, input.senha);
    if (!ok) throw new HttpError(401, 'CPF ou senha inválidos.');

    const user = await deps.prisma.user.findUnique({ where: { cpf: input.cpf } });
    if (!user) throw new HttpError(404, 'Usuário ainda não sincronizado do SISBOM.');
    if (!user.ativo) throw new HttpError(403, 'Usuário inativo.');

    const token = signAccess({ user_id: user.id, cpf: user.cpf });
    const refresh_token = signRefresh({ user_id: user.id });
    const authUser = await buildAuthUser(deps.prisma, user.id);
    return { token, refresh_token, user: authUser };
  },

  async refresh(refresh_token: string, deps: AuthDeps): Promise<{ token: string }> {
    let payload;
    try {
      payload = verifyRefresh(refresh_token);
    } catch {
      throw new HttpError(401, 'Refresh token inválido.');
    }
    const user = await deps.prisma.user.findUnique({ where: { id: payload.user_id } });
    if (!user || !user.ativo) throw new HttpError(401, 'Usuário não encontrado ou inativo.');
    return { token: signAccess({ user_id: user.id, cpf: user.cpf }) };
  },

  async me(userId: number, deps: AuthDeps): Promise<AuthUser> {
    return buildAuthUser(deps.prisma, userId);
  },
};
