import { floraDb } from "@/lib/supabase/get-db";
import { chunkManager } from "@/lib/knowledge/ChunkManager";
import { resourceParser } from "@/lib/knowledge/ResourceParser";
import { runKnowledgePipeline } from "@/lib/knowledge/pipeline";
import { analyseResourceWithThea } from "@/lib/thea/analyseResource";
import type { TextChunkDraft } from "../types";
import { chunkDocumentText } from "../chunk-text";

export class SegmentBuilder {
  buildSegments(
    text: string,
    context: {
      filename: string;
      documentType: string;
      discipline: string;
      niveau: string;
      methode: string;
      analysis: Awaited<ReturnType<typeof analyseResourceWithThea>>;
    },
  ): TextChunkDraft[] {
    const parsed = resourceParser.parse(
      text,
      context.filename,
      context.analysis.document_type || context.documentType,
    );
    const smart = chunkManager.buildSmartChunks(text, parsed);
    if (smart.length > 0) {
      return smart.map((chunk) => ({
        ...chunk,
        metadata: {
          ...chunk.metadata,
          discipline: context.discipline,
          niveau: context.niveau,
          methode: context.methode,
          chapter: chunk.title,
        },
      }));
    }
    return chunkDocumentText(text);
  }

  async persistSegments(documentId: string, segments: TextChunkDraft[]): Promise<void> {
    await (await floraDb()).from("document_segments").delete().eq("document_id", documentId);
    if (segments.length === 0) return;

    await (await floraDb()).from("document_segments").insert(
      segments.map((segment) => ({
        document_id: documentId,
        segment_index: segment.chunk_index,
        title: segment.title,
        content: segment.content,
        page_start: segment.page_start,
        page_end: segment.page_end,
        section_type: segment.section_type,
        chapter: String(segment.metadata.chapter ?? segment.title),
        discipline: String(segment.metadata.discipline ?? ""),
        niveau: String(segment.metadata.niveau ?? ""),
        methode: String(segment.metadata.methode ?? ""),
        metadata: segment.metadata,
      })),
    );
  }
}

export const segmentBuilder = new SegmentBuilder();

export class VectorIndexer {
  async analyzeWithThea(text: string) {
    return analyseResourceWithThea(text);
  }

  async indexDocument(input: {
    documentId: string;
    text: string;
    filename: string;
    analysis: Awaited<ReturnType<typeof analyseResourceWithThea>>;
    metadata: Record<string, unknown>;
  }): Promise<void> {
    await runKnowledgePipeline({
      documentId: input.documentId,
      text: input.text,
      filename: input.filename,
      analysis: input.analysis,
      existingMetadata: input.metadata,
    });
  }
}

export const vectorIndexer = new VectorIndexer();
