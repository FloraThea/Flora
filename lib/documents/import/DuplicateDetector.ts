import { floraDb } from "@/lib/supabase/get-db";
import { loadTeacherProfileBundle } from "@/lib/profile/profile-service";
import type { FloraDocument } from "../types";

export class DuplicateDetector {
  async findDuplicates(input: {
    filename: string;
    fileSize: number;
    checksum?: string;
    teacherProfileId?: string;
  }): Promise<FloraDocument[]> {
    const baseName = input.filename.replace(/\.[^.]+$/, "").toLowerCase();

    let byNameQuery = (await floraDb())
      .from("documents")
      .select("*")
      .ilike("original_filename", `%${baseName}%`);

    if (input.teacherProfileId) {
      byNameQuery = byNameQuery.eq("teacher_profile_id", input.teacherProfileId);
    }

    const { data: byName } = await byNameQuery.limit(5);

    const candidates = (byName ?? []) as FloraDocument[];

    if (input.checksum) {
      let byChecksumQuery = (await floraDb())
        .from("documents")
        .select("*")
        .contains("metadata", { file_checksum: input.checksum });

      if (input.teacherProfileId) {
        byChecksumQuery = byChecksumQuery.eq("teacher_profile_id", input.teacherProfileId);
      }

      const { data: byChecksum } = await byChecksumQuery.limit(3);

      for (const row of (byChecksum ?? []) as FloraDocument[]) {
        if (!candidates.some((item) => item.id === row.id)) {
          candidates.push(row);
        }
      }
    }

    const exactSize = candidates.filter(
      (item) => Math.abs(item.file_size - input.fileSize) < 1024,
    );

    return exactSize.length > 0 ? exactSize : candidates.slice(0, 3);
  }
}

export const duplicateDetector = new DuplicateDetector();
