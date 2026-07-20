import { NextResponse } from "next/server";
import { exportPedagogicalYear } from "@/lib/pedagogical/intelligence/export-service";
import type { PedagogicalExportFormat } from "@/lib/pedagogical/intelligence/types";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      format?: PedagogicalExportFormat;
      scope?: "matiere" | "year";
      matiere?: string;
    };

    if (!body.format || !body.scope) {
      return NextResponse.json({ error: "format et scope requis." }, { status: 400 });
    }

    const output = await exportPedagogicalYear({
      format: body.format,
      scope: body.scope,
      matiere: body.matiere,
    });

    return new NextResponse(new Uint8Array(output.buffer), {
      headers: {
        "Content-Type": output.mimeType,
        "Content-Disposition": `attachment; filename="${output.fileName}"`,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Export impossible." },
      { status: 500 },
    );
  }
}
