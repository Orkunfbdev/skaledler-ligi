const listeners = new Set();

async function call(url, body) {
  try {
    const response = await fetch(url, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body), credentials: 'same-origin',
    });
    let result;
    try {
      result = await response.json();
    } catch {
      return {
        data: null,
        error: { message: `Sunucu yanıt veremedi (${response.status}). Veritabanı bağlantısı veya kurulum bekleniyor.` }
      };
    }
    return response.ok ? { data: result.data ?? result.user ?? result.ok ?? null, error: null }
      : { data: null, error: { message: result.error || 'İşlem başarısız.' } };
  } catch (error) {
    return { data: null, error: { message: error.message } };
  }
}

class LocalQuery {
  constructor(table) {
    this.table = table;
    this.operation = 'select';
    this.filters = [];
  }
  select(columns) { this.columns = columns; return this; }
  eq(field, value) { this.filters.push([field, value]); return this; }
  order(field, options = {}) { this.sort = [field, options.ascending !== false]; return this; }
  single() { this.one = true; return this; }
  insert(value) { this.operation = 'insert'; this.value = value; return this; }
  update(value) { this.operation = 'update'; this.value = value; return this; }
  upsert(value) { this.operation = 'upsert'; this.value = value; return this; }
  delete() { this.operation = 'delete'; return this; }
  then(resolve, reject) {
    return call('/api/local/data', {
      table: this.table, operation: this.operation, filters: this.filters,
      sort: this.sort, one: this.one, value: this.value,
    }).then(resolve, reject);
  }
}

async function auth(action, details = {}) {
  const result = await call('/api/local/auth', { action, ...details });
  if (!result.error && (action === 'signin' || action === 'signout')) {
    const session = result.data ? { user: result.data } : null;
    listeners.forEach((listener) => listener(action.toUpperCase(), session));
  }
  return result;
}

export const localClient = {
  from: (table) => new LocalQuery(table),
  rpc: (name, parameters) => call('/api/local/rpc', { name, parameters }),
  auth: {
    async getSession() {
      try {
        const response = await fetch('/api/local/auth', { credentials: 'same-origin' });
        const { user } = await response.json();
        return { data: { session: user ? { user } : null } };
      } catch { return { data: { session: null } }; }
    },
    onAuthStateChange(listener) {
      listeners.add(listener);
      return { data: { subscription: { unsubscribe: () => listeners.delete(listener) } } };
    },
    signUp: ({ email, password, options }) => auth('signup', { email, password, username: options?.data?.username, adminCode: options?.data?.adminCode }),
    signInWithPassword: ({ email, password }) => auth('signin', { email, password }),
    signOut: () => auth('signout'),
  },
  storage: {
    from: () => ({
      upload: async (path, file) => {
        const form = new FormData();
        form.set('path', path);
        form.set('file', file);
        try {
          const response = await fetch('/api/local/avatar', { method: 'POST', body: form });
          const result = await response.json();
          return { data: response.ok ? result : null, error: response.ok ? null : { message: result.error } };
        } catch (error) { return { data: null, error: { message: error.message } }; }
      },
      getPublicUrl: (path) => ({ data: { publicUrl: `/api/local/avatar?user=${encodeURIComponent(path.slice(0, 36))}&v=${Date.now()}` } }),
    }),
  },
};
