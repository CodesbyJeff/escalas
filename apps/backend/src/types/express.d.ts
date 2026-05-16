// Augmenta o tipo Request do Express com o usuário autenticado anexado pelo authMiddleware.
// Mantém-se como augmentação ambient pura (sem import top-level) para que o efeito seja
// global em todos os módulos que tipam Request via express ou express-serve-static-core.

declare global {
  namespace Express {
    interface Request {
      user?: { id: number; cpf: string; is_super_admin: boolean };
    }
  }
}

export {};
