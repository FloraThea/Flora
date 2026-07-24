import type {
  DocumentTree,
  DocumentTreeNode,
  FaithfulExtractionResult,
} from "./types";
import {
  deduplicateModuleHeadings,
  detectMhmGuideProfile,
  normalizeDocumentLine,
  parseMhmModuleSummary,
  type ParsedHeading,
} from "./heading-parser";

function slug(value: string, index: number): string {
  return `${value.toLowerCase().replace(/[^\w]+/g, "-")}-${index}`;
}

function parseSeanceSpec(spec: string): number[] {
  const cleaned = spec.trim();
  const rangeMatch = cleaned.match(/(\d+)\s*[àa]\s*(\d+)/i);
  if (rangeMatch) {
    const start = Number.parseInt(rangeMatch[1] ?? "0", 10);
    const end = Number.parseInt(rangeMatch[2] ?? "0", 10);
    if (start && end && end >= start) {
      return Array.from({ length: end - start + 1 }, (_, index) => start + index);
    }
  }

  const etMatch = cleaned.match(/(\d+)\s*et\s*(\d+)/i);
  if (etMatch) {
    const first = Number.parseInt(etMatch[1] ?? "0", 10);
    const second = Number.parseInt(etMatch[2] ?? "0", 10);
    return [first, second].filter(Boolean);
  }

  const singleMatch = cleaned.match(/(\d+)/);
  if (singleMatch) return [Number.parseInt(singleMatch[1] ?? "1", 10)];

  return [1];
}

function parseBodyModuleLine(line: string): {
  moduleNumber: number;
  seanceNumbers: number[];
  label: string;
} | null {
  const normalized = normalizeDocumentLine(line);
  const match = normalized.match(/^(\d+)\s+S[ée]ances?\s+(.+)$/i);
  if (!match) return null;

  const moduleNumber = Number.parseInt(match[1] ?? "0", 10);
  const spec = (match[2] ?? "").trim();
  const seanceNumbers = parseSeanceSpec(spec);
  if (!moduleNumber || seanceNumbers.length === 0) return null;

  const label =
    seanceNumbers.length === 1
      ? `Séance ${seanceNumbers[0]}`
      : `Séances ${seanceNumbers[0]} à ${seanceNumbers[seanceNumbers.length - 1]}`;

  return { moduleNumber, seanceNumbers, label };
}

function findBodyStartIndex(lines: string[]): number {
  for (let index = 0; index < lines.length - 1; index += 1) {
    if (/^MODULE$/i.test(lines[index] ?? "")) {
      const next = parseBodyModuleLine(lines[index + 1] ?? "");
      if (next) return index;
    }
  }
  return -1;
}

function splitContentBySeanceHints(
  content: string,
  seanceNumbers: number[],
): Map<number, string> {
  const map = new Map<number, string>();
  if (seanceNumbers.length <= 1) {
    map.set(seanceNumbers[0] ?? 1, content);
    return map;
  }

  const lines = content.split("\n");
  let currentSeance = seanceNumbers[0] ?? 1;
  let buffer: string[] = [];
  const sharedPrefix: string[] = [];

  function flush() {
    const text = buffer.join("\n").trim();
    if (!text) return;
    const existing = map.get(currentSeance) ?? "";
    map.set(currentSeance, existing ? `${existing}\n${text}` : text);
    buffer = [];
  }

  for (const line of lines) {
    const hint = line.match(/^Pour la séance\s+(\d+)\s*:/i);
    if (hint) {
      flush();
      currentSeance = Number.parseInt(hint[1] ?? String(currentSeance), 10);
      buffer.push(line.replace(/^Pour la séance\s+\d+\s*:\s*/i, "").trim());
      continue;
    }

    if (map.size === 0 && !hint && seanceNumbers.length > 1) {
      sharedPrefix.push(line);
      continue;
    }

    buffer.push(line);
  }

  flush();

  if (map.size === 0) {
    const prefix = sharedPrefix.join("\n").trim();
    for (const seanceNumber of seanceNumbers) {
      map.set(seanceNumber, prefix ? `${prefix}\n${content}`.trim() : content);
    }
    return map;
  }

  const prefix = sharedPrefix.join("\n").trim();
  if (prefix) {
    for (const seanceNumber of seanceNumbers) {
      const existing = map.get(seanceNumber) ?? "";
      map.set(seanceNumber, existing ? `${prefix}\n${existing}`.trim() : prefix);
    }
  }

  for (const seanceNumber of seanceNumbers) {
    if (!map.has(seanceNumber)) {
      map.set(seanceNumber, prefix);
    }
  }

  return map;
}

type BodyBlock = {
  moduleNumber: number;
  seanceNumbers: number[];
  label: string;
  content: string;
  lineIndex: number;
};

function parseBodyBlocks(lines: string[], bodyStart: number): BodyBlock[] {
  const blocks: BodyBlock[] = [];
  let index = bodyStart;
  let activeModule = 0;

  while (index < lines.length) {
    if (/^MODULE$/i.test(lines[index] ?? "")) {
      const parsed = parseBodyModuleLine(lines[index + 1] ?? "");
      if (parsed) {
        activeModule = parsed.moduleNumber;
        index += 2;
        const contentLines: string[] = [];

        while (index < lines.length && !/^MODULE$/i.test(lines[index] ?? "")) {
          const current = lines[index] ?? "";
          const standaloneSeance = current.match(/^S[ée]ance\s+(\d+)\s*$/i);
          if (standaloneSeance && contentLines.length > 0 && activeModule > 0) {
            blocks.push({
              moduleNumber: activeModule,
              seanceNumbers: [Number.parseInt(standaloneSeance[1] ?? "1", 10)],
              label: `Séance ${standaloneSeance[1]}`,
              content: contentLines.join("\n").trim(),
              lineIndex: index,
            });
            contentLines.length = 0;
            index += 1;
            continue;
          }

          contentLines.push(current);
          index += 1;
        }

        if (contentLines.length > 0 && parsed) {
          blocks.push({
            moduleNumber: parsed.moduleNumber,
            seanceNumbers: parsed.seanceNumbers,
            label: parsed.label,
            content: contentLines.join("\n").trim(),
            lineIndex: index,
          });
        }
        continue;
      }
    }

    index += 1;
  }

  return blocks.filter((block) => block.content.trim());
}

function flattenTree(
  node: DocumentTreeNode,
  parentTempId: string | undefined,
  entities: FaithfulExtractionResult["entities"],
  relations: FaithfulExtractionResult["relations"],
): void {
  const tempId = node.id;
  entities.push({
    tempId,
    entityType: node.type,
    label: node.label,
    content: node.content,
    sourceText: node.provenance.sourceText ?? node.content.slice(0, 500),
    confidence: Number(node.metadata?.confidence ?? 0.98),
    parentTempId,
    metadata: {
      ...node.metadata,
      sourcePath: node.provenance.sourcePath,
      moduleNumber: node.metadata?.moduleNumber,
      seanceNumber: node.metadata?.seanceNumber,
      sessionCount: node.metadata?.sessionCount,
    },
  });

  if (parentTempId) {
    relations.push({
      sourceTempId: parentTempId,
      targetTempId: tempId,
      relationType: "contient",
      confidence: 0.99,
    });
  }

  node.children.forEach((child) => flattenTree(child, tempId, entities, relations));
}

/**
 * Parseur dédié guides MHM : Introduction → Modules → Séances (contenu intégral).
 */
export function parseMhmGuideStructure(input: {
  text: string;
  filename: string;
  documentId?: string;
  documentTitle?: string;
}): FaithfulExtractionResult | null {
  if (!detectMhmGuideProfile(input.text, input.filename)) return null;

  const rawLines = input.text.split(/\r?\n/);
  const lines = rawLines.map((line) => line.replace(/\u00a0/g, " ").trim());

  const tocModules: Array<ParsedHeading & { lineIndex: number }> = [];
  for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
    const summary = parseMhmModuleSummary(lines[lineIndex] ?? "");
    if (summary) {
      tocModules.push({ ...summary, lineIndex });
    }
  }

  const moduleSummaries = deduplicateModuleHeadings(tocModules);
  const bodyStart = findBodyStartIndex(lines);
  const documentTitle = input.documentTitle || input.filename;

  const root: DocumentTreeNode = {
    id: slug("document", 0),
    type: "document",
    label: documentTitle,
    content: "",
    order: 0,
    children: [],
    provenance: { documentId: input.documentId, documentTitle },
  };

  let nodeOrder = 0;
  const moduleNodes = new Map<number, DocumentTreeNode>();

  const introContent =
    bodyStart >= 0
      ? lines
          .slice(0, bodyStart)
          .filter(Boolean)
          .join("\n")
          .trim()
      : lines.filter(Boolean).join("\n").trim();

  if (introContent) {
    root.children.push({
      id: slug("introduction", nodeOrder++),
      type: "partie",
      label: "Introduction",
      content: introContent,
      order: nodeOrder,
      children: [],
      provenance: {
        documentId: input.documentId,
        documentTitle,
        sourcePath: "Introduction",
      },
      metadata: { confidence: 0.98, section: "introduction" },
    });
  }

  for (const summary of moduleSummaries) {
    const moduleNumber = summary.moduleNumber ?? 0;
    const moduleNode: DocumentTreeNode = {
      id: slug(`module-${moduleNumber}`, nodeOrder++),
      type: "module",
      label: `Module ${moduleNumber}`,
      content: "",
      order: nodeOrder,
      children: [],
      provenance: {
        documentId: input.documentId,
        documentTitle,
        sourcePath: `Module ${moduleNumber}`,
        sourceText: summary.label,
      },
      metadata: {
        confidence: 0.98,
        moduleNumber,
        sessionCount: summary.sessionCount,
      },
    };
    moduleNodes.set(moduleNumber, moduleNode);
    root.children.push(moduleNode);
  }

  if (bodyStart >= 0) {
    const bodyBlocks = parseBodyBlocks(lines, bodyStart);

    for (const block of bodyBlocks) {
      const moduleNode = moduleNodes.get(block.moduleNumber);
      if (!moduleNode) continue;

      const contentBySeance = splitContentBySeanceHints(block.content, block.seanceNumbers);

      for (const seanceNumber of block.seanceNumbers) {
        const seanceContent = contentBySeance.get(seanceNumber) ?? block.content;
        const firstLine = seanceContent.split("\n").find(Boolean) ?? "";
        const titleSuffix =
          firstLine.length <= 80 && !/^Calcul mental|^Apprentissage|^Organisation/i.test(firstLine)
            ? firstLine
            : "";

        moduleNode.children.push({
          id: slug(`module-${block.moduleNumber}-seance-${seanceNumber}-${block.lineIndex}`, nodeOrder++),
          type: "seance",
          label: titleSuffix
            ? `Séance ${seanceNumber} — ${titleSuffix}`
            : `Séance ${seanceNumber}`,
          content: seanceContent,
          order: nodeOrder,
          children: [],
          provenance: {
            documentId: input.documentId,
            documentTitle,
            sourcePath: `Module ${block.moduleNumber} > Séance ${seanceNumber}`,
            sourceText: block.label,
          },
          metadata: {
            confidence: 0.98,
            moduleNumber: block.moduleNumber,
            seanceNumber,
          },
        });
      }
    }
  }

  const tree: DocumentTree = {
    root,
    documentType: "guide du maître",
    hierarchyTemplate: ["partie", "module", "seance"],
    signals: ["mhm-guide-profile", "mhm-faithful-parser"],
    moduleCount: moduleSummaries.length,
    seanceCount: [...moduleNodes.values()].reduce((sum, node) => sum + node.children.length, 0),
  };

  const entities: FaithfulExtractionResult["entities"] = [];
  const relations: FaithfulExtractionResult["relations"] = [];
  flattenTree(root, undefined, entities, relations);

  return { tree, entities, relations };
}
