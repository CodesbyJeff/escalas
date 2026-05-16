import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./src/tests/setup.ts'],
    testTimeout: 10000,
    // Todos os testes integration compartilham o mesmo schema PostgreSQL
    // (escalas_test) e fazem resetDb() em beforeEach. Rodar arquivos em paralelo
    // gera race conditions (um arquivo limpa a base enquanto outro está no meio
    // de um teste). Forçamos execução serial por arquivo.
    fileParallelism: false,
  },
});
