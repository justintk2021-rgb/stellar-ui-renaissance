export const queryKeys = {
  trades: {
    all: ['trades'] as const,
    list: (userId: string, accountId: string | null, brokerAccountId: string | null) =>
      ['trades', 'list', userId, accountId, brokerAccountId] as const,
    detail: (tradeId: string) => ['trades', 'detail', tradeId] as const,
  },
  accounts: {
    all: ['accounts'] as const,
    list: (userId: string) => ['accounts', 'list', userId] as const,
  },
  notebook: {
    all: ['notebook'] as const,
    list: (userId: string) => ['notebook', 'list', userId] as const,
  },
  settings: {
    all: ['settings'] as const,
    user: (userId: string) => ['settings', userId] as const,
  },
  checklists: {
    all: ['checklists'] as const,
    list: (userId: string) => ['checklists', 'list', userId] as const,
  },
  broker: {
    connections: (userId: string) => ['broker', 'connections', userId] as const,
    positions: (connectionId: string) => ['broker', 'positions', connectionId] as const,
    orders: (connectionId: string) => ['broker', 'orders', connectionId] as const,
    history: (connectionId: string) => ['broker', 'history', connectionId] as const,
    accounts: (connectionId: string) => ['broker', 'accounts', connectionId] as const,
    summary: (connectionId: string) => ['broker', 'summary', connectionId] as const,
  },
};
