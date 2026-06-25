export const ROLES = ['ESCALANTE', 'MILITAR', 'GESTOR', 'FISCAL'] as const;
export type Role = (typeof ROLES)[number];

export interface AuthUser {
  id: number;
  cpf: string;
  matricula: string | null;
  nome: string;
  is_super_admin: boolean;
  roles: Array<{ role: Role; lotacao_id: number | null }>;
}
