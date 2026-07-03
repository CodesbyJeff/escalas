// Um usuário é "seed de teste" quando não veio do SISBOM (sem sisbom_id) e não
// é super-admin (os 3 super-admins locais — TEN PETER/VIEIRA/Admin — são preservados
// para não perder login/testes). Ver docs/superpowers/specs/2026-07-03-fundacao-dados-reais-design.md.
export function ehUsuarioSeedTeste(u: { sisbom_id: string | null; is_super_admin: boolean }): boolean {
  return u.sisbom_id == null && !u.is_super_admin;
}
