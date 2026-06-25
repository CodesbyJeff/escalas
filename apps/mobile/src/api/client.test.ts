import { apiGet, ApiError } from './client';

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(async () => 'tok'),
  setItemAsync: jest.fn(async () => {}),
  deleteItemAsync: jest.fn(async () => {}),
}));

const okJson = (data: unknown) => ({ ok: true, status: 200, json: async () => ({ success: true, message: 'ok', data }) });

afterEach(() => jest.restoreAllMocks());

it('desembrulha data em sucesso', async () => {
  global.fetch = jest.fn(async () => okJson([{ vaga_id: 1 }]) as any) as any;
  const r = await apiGet<any[]>('/me/servicos');
  expect(r).toEqual([{ vaga_id: 1 }]);
});

it('lança ApiError com status em erro', async () => {
  global.fetch = jest.fn(async () => ({ ok: false, status: 422, json: async () => ({ success: false, message: 'ruim', data: null }) }) as any) as any;
  await expect(apiGet('/me/servicos')).rejects.toMatchObject({ status: 422, message: 'ruim' });
});
