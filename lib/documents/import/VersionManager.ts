import { floraDb } from "@/lib/supabase/get-db";

export class VersionManager {
  async createVersion(
    documentId: string,
    input: { storagePath: string; fileSize: number; originalFilename: string },
  ): Promise<number> {
    const { data: latest } = await (await floraDb())
      .from("document_versions")
      .select("version_number")
      .eq("document_id", documentId)
      .order("version_number", { ascending: false })
      .limit(1)
      .maybeSingle();

    const versionNumber = (latest?.version_number ?? 0) + 1;

    await (await floraDb()).from("document_versions").insert({
      document_id: documentId,
      version_number: versionNumber,
      storage_path: input.storagePath,
      file_size: input.fileSize,
      original_filename: input.originalFilename,
      metadata: { created_by: "import_v2" },
    });

    return versionNumber;
  }

  async listVersions(documentId: string) {
    const { data } = await (await floraDb())
      .from("document_versions")
      .select("*")
      .eq("document_id", documentId)
      .order("version_number", { ascending: false });

    return data ?? [];
  }

  async restoreVersion(documentId: string, versionNumber: number): Promise<void> {
    const { data: version } = await (await floraDb())
      .from("document_versions")
      .select("*")
      .eq("document_id", documentId)
      .eq("version_number", versionNumber)
      .maybeSingle();

    if (!version) throw new Error("Version introuvable.");

    await (await floraDb())
      .from("documents")
      .update({
        storage_path: version.storage_path,
        file_size: version.file_size,
        original_filename: version.original_filename,
        status: "uploaded",
        metadata: {
          restored_from_version: versionNumber,
          restored_at: new Date().toISOString(),
        },
      })
      .eq("id", documentId);
  }
}

export const versionManager = new VersionManager();
