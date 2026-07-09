export type TheaResourceCompetence = {
  competence: string;
  code_bo: string;
  matiere: string;
  sous_matiere: string;
  niveau: string;
};

export type TheaResourceSection = {
  title: string;
  section_type: string;
  content_summary: string;
};

export type TheaResourceAnalysis = {
  title: string;
  document_type: string;
  cycle: string;
  niveau: string;
  matiere: string;
  sous_matiere: string;
  methode: string;
  auteur: string;
  editeur: string;
  annee: string;
  resume: string;
  tags: string[];
  competences: TheaResourceCompetence[];
  sections: TheaResourceSection[];
};

export function buildAnalyseResourcePrompt(text: string): string {
  return `
Tu es Théa, l'assistante pédagogique de Flora.

Analyse cette ressource pédagogique issue d'un document officiel ou pédagogique.

Réponds uniquement en JSON valide :

{
  "title": "",
  "document_type": "",
  "cycle": "",
  "niveau": "",
  "matiere": "",
  "sous_matiere": "",
  "methode": "",
  "auteur": "",
  "editeur": "",
  "annee": "",
  "resume": "",
  "tags": [],
  "competences": [
    {
      "competence": "",
      "code_bo": "",
      "matiere": "",
      "sous_matiere": "",
      "niveau": ""
    }
  ],
  "sections": [
    {
      "title": "",
      "section_type": "",
      "content_summary": ""
    }
  ]
}

Types de document possibles :
BO, guide du maître, manuel, album, séquence, séance, cahier journal, programmation, progression, ressource personnelle

Règles strictes :
- Ne jamais inventer une information absente du document.
- Si une information est inconnue, mets une chaîne vide.
- Les tags doivent être courts et réellement présents ou clairement déductibles du document.
- Les compétences doivent rester proches des formulations officielles si elles apparaissent dans le texte.
- Ne mets aucun texte avant ou après le JSON.

Document :
${text.slice(0, 12000)}
`;
}

export function parseTheaResourceAnalysis(raw: string): TheaResourceAnalysis {
  const cleaned = raw
    .replace(/```json/g, "")
    .replace(/```/g, "")
    .trim();

  const parsed = JSON.parse(cleaned) as Partial<TheaResourceAnalysis>;

  return {
    title: parsed.title ?? "",
    document_type: parsed.document_type ?? "",
    cycle: parsed.cycle ?? "",
    niveau: parsed.niveau ?? "",
    matiere: parsed.matiere ?? "",
    sous_matiere: parsed.sous_matiere ?? "",
    methode: parsed.methode ?? "",
    auteur: parsed.auteur ?? "",
    editeur: parsed.editeur ?? "",
    annee: parsed.annee ?? "",
    resume: parsed.resume ?? "",
    tags: Array.isArray(parsed.tags)
      ? parsed.tags.filter((tag): tag is string => typeof tag === "string")
      : [],
    competences: Array.isArray(parsed.competences)
      ? parsed.competences.map((item) => ({
          competence: item?.competence ?? "",
          code_bo: item?.code_bo ?? "",
          matiere: item?.matiere ?? "",
          sous_matiere: item?.sous_matiere ?? "",
          niveau: item?.niveau ?? "",
        }))
      : [],
    sections: Array.isArray(parsed.sections)
      ? parsed.sections.map((item) => ({
          title: item?.title ?? "",
          section_type: item?.section_type ?? "",
          content_summary: item?.content_summary ?? "",
        }))
      : [],
  };
}
