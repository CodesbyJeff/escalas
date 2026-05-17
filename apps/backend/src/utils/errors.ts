export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = 'HttpError';
  }
}

export class NotFoundError extends HttpError {
  constructor(message = 'Recurso não encontrado.') {
    super(404, message);
    this.name = 'NotFoundError';
  }
}

export class ForbiddenError extends HttpError {
  constructor(message = 'Sem permissão para essa ação.') {
    super(403, message);
    this.name = 'ForbiddenError';
  }
}

export class UnauthorizedError extends HttpError {
  constructor(message = 'Não autenticado.') {
    super(401, message);
    this.name = 'UnauthorizedError';
  }
}

export class ConflictError extends HttpError {
  constructor(message = 'Conflito de dados.') {
    super(409, message);
    this.name = 'ConflictError';
  }
}
