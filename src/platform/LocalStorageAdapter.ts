export class LocalStorageAdapter {
  constructor(private readonly namespace = "youtube-arena-playable") {}

  load<T>(key: string, fallback: T): T {
    try {
      const rawValue = window.localStorage.getItem(this.getKey(key));
      return rawValue ? (JSON.parse(rawValue) as T) : fallback;
    } catch {
      return fallback;
    }
  }

  save<T>(key: string, value: T): void {
    try {
      window.localStorage.setItem(this.getKey(key), JSON.stringify(value));
    } catch {
      // Storage can fail in private browsing or embedded environments.
    }
  }

  private getKey(key: string): string {
    return `${this.namespace}:${key}`;
  }
}
