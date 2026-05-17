import type { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { signAccess, signRefresh, verifyRefresh } from '../config/jwt.js';
import { sisbomClient } from '../integrations/sisbom/client.js';
import type { AuthUser, Role } from '@escalas/shared-types';
import type { LoginInput } from '@escalas/shared-schemas';
import { ForbiddenError, NotFoundError, UnauthorizedError } from '../utils/errors.js';

export interface AuthDeps {
  prisma: PrismaClient;
  sisbom: typeof sisbomClient;
}

export interface LoginResult {
  token: string;
  refresh_token: string;
  user: AuthUser;
}

interface UserWithRoles {
  id: number;
  cpf: string;
  matricula: string | null;
  nome: string;
  is_super_admin: boolean;
  roles: Array<{ role: string; lotacao_id: number | null }>;
}

function toAuthUser(user: UserWithRoles): AuthUser {
  return {
    id: user.id,
    cpf: user.cpf,
    matricula: user.matricula,
    nome: user.nome,
    is_super_admin: user.is_super_admin,
    roles: user.roles.map((r) => ({ role: r.role as Role, lotacao_id: r.lotacao_id })),
  };
}

function makeLoginResult(user: UserWithRoles): LoginResult {
  return {
    token: signAccess({ user_id: user.id, cpf: user.cpf }),
    refresh_token: signRefresh({ user_id: user.id }),
    user: toAuthUser(user),
  };
}

async function buildAuthUser(prisma: PrismaClient, opts: { id?: number; cpf?: string }): Promise<AuthUser> {
  const user = await prisma.user.findUnique({
    where: opts.id !== undefined ? { id: opts.id } : { cpf: opts.cpf! },
    include: { roles: true },
  });
  if (!user) throw new NotFoundError('Usuário não encontrado.');
  return toAuthUser(user);
}

export const authService = {
  async login(input: LoginInput, deps: AuthDeps): Promise<LoginResult> {
    const user = await deps.prisma.user.findUnique({
      where: { cpf: input.cpf },
      include: { roles: true },
    });

    // Modo local: senha_hash setado → bcrypt, sem SISBOM
    if (user?.senha_hash) {
      if (!user.ativo) throw new ForbiddenError('Usuário inativo.');
      const match = await bcrypt.compare(input.senha, user.senha_hash);
      if (!match) throw new UnauthorizedError('CPF ou senha inválidos.');
      return makeLoginResult(user);
    }

    // Modo SISBOM AD (fluxo atual)
    const ok = await deps.sisbom.loginAd(input.cpf, input.senha);
    if (!ok) throw new UnauthorizedError('CPF ou senha inválidos.');
    if (!user) throw new NotFoundError('Usuário ainda não sincronizado do SISBOM.');
    if (!user.ativo) throw new ForbiddenError('Usuário inativo.');
    return makeLoginResult(user);
  },

  async refresh(refresh_token: string, deps: AuthDeps): Promise<{ token: string }> {
    let payload;
    try {
      payload = verifyRefresh(refresh_token);
    } catch {
      throw new UnauthorizedError('Refresh token inválido.');
    }
    const user = await deps.prisma.user.findUnique({ where: { id: payload.user_id } });
    if (!user || !user.ativo) throw new UnauthorizedError('Usuário não encontrado ou inativo.');
    return { token: signAccess({ user_id: user.id, cpf: user.cpf }) };
  },

  async me(userId: number, deps: AuthDeps): Promise<AuthUser> {
    return buildAuthUser(deps.prisma, { id: userId });
  },
};
