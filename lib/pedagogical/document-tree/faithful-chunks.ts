import type { TextChunkDraft } from "@/lib/documents/types";
import type { DocumentTreeNode } from "./types";

function flattenNodes(node: DocumentTreeNode, path: string[] = []): TextChunkDraft[] {
  const currentPath = [...path, node.label];
  const chunks: TextChunkDraft[] = [];

  if (node.type !== "document" && node.content.trim()) {
    chunks.push({
      chunk_index: chunks.length,
      title: node.label,
      content: node.content,
      page_start: null,
      page_end: null,
      section_type: node.type,
      metadata: {
        hierarchy_path: currentPath,
        parser: "faithful-tree",
        moduleNumber: node.metadata?.moduleNumber,
        seanceNumber: node.metadata?.seanceNumber,
        sourcePath: node.provenance.sourcePath,
      },
    });
  }

  for (const child of node.children) {
    const childChunks = flattenNodes(child, currentPath);
    for (const chunk of childChunks) {
      chunks.push({
        ...chunk,
        chunk_index: chunks.length,
      });
    }
  }

  return chunks;
}

export function buildFaithfulChunksFromTree(root: DocumentTreeNode): TextChunkDraft[] {
  return flattenNodes(root);
}
