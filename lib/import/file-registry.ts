/** Conserve les objets File hors du state React (imports multi-fichiers). */
export class ImportFileRegistry {
  private readonly files = new Map<string, File>();

  set(clientId: string, file: File): void {
    this.files.set(clientId, file);
  }

  get(clientId: string): File | undefined {
    return this.files.get(clientId);
  }

  delete(clientId: string): void {
    this.files.delete(clientId);
  }

  has(clientId: string): boolean {
    return this.files.has(clientId);
  }

  count(): number {
    return this.files.size;
  }
}
