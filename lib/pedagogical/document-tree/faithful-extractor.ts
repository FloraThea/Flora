import { resourceParser } from "@/lib/knowledge/ResourceParser";
import {
  deduplicateModuleHeadings,
  detectMhmGuideProfile,
  normalizeDocumentLine,
  parseDocumentHeading,
  type ParsedHeading,
} from "./heading-parser";
import { parseMhmGuideStructure } from "./mhm-guide-parser";
import type {
  DocumentTree,
  DocumentTreeNode,
  DocumentTreeNodeType,
  FaithfulExtractionResult,
} from "./types";

type HeadingMatch = ParsedHeading & {
  lineIndex: number;
};

function slug(value: string, index: number): string {
  return `${value.toLowerCase().replace(/[^\w]+/g, "-")}-${index}`;
}

function headingLevel(type: DocumentTreeNodeType): number {
  const levels: Partial<Record<DocumentTreeNodeType, number>> = {
    document: 0,
    partie: 1,
    chapitre: 2,
    module: 3,
    sequence: 3,
    unite: 3,
    seance: 4,
    activite: 5,
    objectif: 5,
    competence: 5,
    materiel: 5,
    ressource: 5,
  };
  return levels[type] ?? 3;
}

function countNodes(nodes: DocumentTreeNode[], type: DocumentTreeNodeType): number {
  let count = 0;
  for (const node of nodes) {
    if (node.type === type) count += 1;
    count += countNodes(node.children, type);
  }
  return count;
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
    confidence: Number(node.metadata?.confidence ?? 0.95),
    parentTempId,
    metadata: {
      ...node.metadata,
      sourcePath: node.provenance.sourcePath,
      pageStart: node.provenance.pageStart,
      pageEnd: node.provenance.pageEnd,
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
      confidence: 0.98,
    });
  }

  node.children.forEach((child) => flattenTree(child, tempId, entities, relations));
}

function extractContentBetweenHeadings(
  rawLines: string[],
  startLine: number,
  endLine: number,
  isMhmGuide: boolean,
): string {
  return rawLines
    .slice(startLine + 1, endLine)
    .map(normalizeDocumentLine)
    .filter((line) => {
      if (!line) return false;
      return !parseDocumentHeading(line, { isMhmGuide, allowGenericModules: !isMhmGuide });
    })
    .join("\n")
    .trim();
}

function buildTreeFromHeadings(input: {
  headings: HeadingMatch[];
  rawLines: string[];
  isMhmGuide: boolean;
  documentId?: string;
  documentTitle: string;
}): DocumentTreeNode {
  const root: DocumentTreeNode = {
    id: slug("document", 0),
    type: "document",
    label: input.documentTitle,
    content: "",
    order: 0,
    children: [],
    provenance: {
      documentId: input.documentId,
      documentTitle: input.documentTitle,
    },
  };

  const stack: DocumentTreeNode[] = [root];
  let nodeOrder = 0;

  for (let index = 0; index < input.headings.length; index += 1) {
    const heading = input.headings[index]!;
    const nextLine = input.headings[index + 1]?.lineIndex ?? input.rawLines.length;
    const content = extractContentBetweenHeadings(
      input.rawLines,
      heading.lineIndex,
      nextLine,
      input.isMhmGuide,
    );

    const node: DocumentTreeNode = {
      id: slug(`${heading.type}-${heading.label}-${heading.lineIndex}`, nodeOrder++),
      type: heading.type,
      label: heading.label,
      content,
      order: nodeOrder,
      children: [],
      provenance: {
        documentId: input.documentId,
        documentTitle: input.documentTitle,
        sourceText: heading.label,
        sourcePath: [...stack.slice(1), { label: heading.label } as DocumentTreeNode]
          .map((item) => item.label)
          .join(" > "),
      },
      metadata: {
        confidence: heading.confidence,
        moduleNumber: heading.moduleNumber,
        seanceNumber: heading.seanceNumber,
        sessionCount: heading.sessionCount,
        lineIndex: heading.lineIndex,
      },
    };

    while (stack.length > 1) {
      const parent = stack[stack.length - 1];
      if (!parent) break;
      if (headingLevel(parent.type) < heading.level) break;
      stack.pop();
    }

    const parent = stack[stack.length - 1] ?? root;
    parent.children.push(node);
    stack.push(node);
  }

  return root;
}

/**
 * Extraction déterministe fidèle au document — sans réorganisation IA.
 */
export function extractFaithfulDocumentTree(input: {
  text: string;
  filename: string;
  documentType?: string;
  documentId?: string;
  documentTitle?: string;
}): FaithfulExtractionResult {
  const mhmResult = parseMhmGuideStructure(input);
  if (mhmResult) return mhmResult;

  const parsed = resourceParser.parse(
    input.text,
    input.filename,
    input.documentType ?? "",
  );

  const isMhmGuide = detectMhmGuideProfile(input.text, input.filename);
  const rawLines = input.text.split(/\r?\n/);
  const detected: HeadingMatch[] = [];

  for (let lineIndex = 0; lineIndex < rawLines.length; lineIndex += 1) {
    const normalized = normalizeDocumentLine(rawLines[lineIndex] ?? "");
    if (!normalized) continue;

    const heading = parseDocumentHeading(normalized, {
      isMhmGuide,
      allowGenericModules: !isMhmGuide,
    });

    if (!heading) continue;

    detected.push({
      ...heading,
      lineIndex,
    });
  }

  let headings = detected;

  if (isMhmGuide) {
    const moduleHeadings = deduplicateModuleHeadings(
      detected.filter((item) => item.type === "module") as Array<ParsedHeading & { lineIndex: number }>,
    );
    const seanceHeadings = detected.filter((item) => item.type === "seance");
    headings = [...moduleHeadings, ...seanceHeadings].sort((left, right) => left.lineIndex - right.lineIndex);
  }

  const root = buildTreeFromHeadings({
    headings,
    rawLines,
    isMhmGuide,
    documentId: input.documentId,
    documentTitle: input.documentTitle || input.filename,
  });

  const tree: DocumentTree = {
    root,
    documentType: parsed.documentType,
    hierarchyTemplate: parsed.hierarchyTemplate,
    signals: [...parsed.signals, ...(isMhmGuide ? ["mhm-guide-profile"] : [])],
    moduleCount: countNodes(root.children, "module"),
    seanceCount: countNodes(root.children, "seance"),
  };

  const entities: FaithfulExtractionResult["entities"] = [];
  const relations: FaithfulExtractionResult["relations"] = [];
  flattenTree(root, undefined, entities, relations);

  return { tree, entities, relations };
}

export function hasFaithfulStructure(result: FaithfulExtractionResult): boolean {
  return result.tree.moduleCount >= 2 || result.tree.seanceCount >= 3;
}
