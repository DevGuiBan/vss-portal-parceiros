// Cache mínimo em memória para chamadas às edge functions (sem dependências).
//
// - Deduplica requisições simultâneas com a mesma chave (uma só ida ao servidor).
// - Reaproveita a resposta enquanto estiver dentro do TTL.
// - `peek` devolve o último valor mesmo vencido, para a tela mostrar dados
//   antigos enquanto revalida (sem "piscar" skeleton a cada troca de filtro).
// - `invalidate(prefixo)` descarta entradas após uma escrita.

interface Entry<T> {
  value?: T;
  at: number;
  inflight?: Promise<T>;
}

const store = new Map<string, Entry<unknown>>();
const MAX_ENTRIES = 200;

export function cachedFetch<T>(key: string, ttlMs: number, fn: () => Promise<T>, opts: { force?: boolean } = {}): Promise<T> {
  const entry = store.get(key) as Entry<T> | undefined;
  if (entry?.inflight) return entry.inflight;
  if (!opts.force && entry && entry.value !== undefined && Date.now() - entry.at < ttlMs) {
    return Promise.resolve(entry.value);
  }

  const inflight = fn()
    .then((value) => {
      store.set(key, { value, at: Date.now() });
      prune();
      return value;
    })
    .catch((err) => {
      const cur = store.get(key) as Entry<T> | undefined;
      if (cur) store.set(key, { value: cur.value, at: cur.at });
      throw err;
    });

  store.set(key, { value: entry?.value, at: entry?.at ?? 0, inflight });
  return inflight;
}

export function peek<T>(key: string): T | undefined {
  return (store.get(key) as Entry<T> | undefined)?.value;
}

export function invalidate(prefix: string) {
  for (const k of store.keys()) if (k.startsWith(prefix)) store.delete(k);
}

export function clearCache() {
  store.clear();
}

function prune() {
  if (store.size <= MAX_ENTRIES) return;
  const oldest = [...store.entries()].sort((a, b) => a[1].at - b[1].at).slice(0, store.size - MAX_ENTRIES);
  for (const [k] of oldest) store.delete(k);
}
