export type Role = 'ESCALANTE' | 'MILITAR' | 'GESTOR';

export interface AuthUser {
  id: number;
  cpf: string;
  matricula: string | null;
  nome: string;
  is_super_admin: boolean;
  roles: Array<{ role: Role; lotacao_id: number | null }>;
}
