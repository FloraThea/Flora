export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    if (process.env.NODE_ENV !== "production") {
      const { logStorageHealth } = await import("@/lib/storage/health");
      void logStorageHealth();
    }

    const { runAutoMigrationsOnStartup } = await import("@/lib/db/migrations");
    void runAutoMigrationsOnStartup();
  }
}
