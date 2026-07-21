export function buildBoSectionPrompt(input: {
  sectionLabel: string;
  sectionPart?: string;
  cycle: string;
  matiere: string;
  text: string;
}) {
  const partLabel = input.sectionPart ? ` (partie ${input.sectionPart})` : "";
  const isEmc =
    input.matiere === "EMC" ||
    /vie affective|EVAR|éducation à la sexualité/i.test(input.sectionLabel + input.text.slice(0, 400));

  const elementTypes = isEmc
    ? `- objectifs pédagogiques et thématiques (competenceType: "competence")
- contenus par niveau CP–CM2 (competenceType: "connaissance")
- principes, valeurs, organisation (competenceType: "progressivite")
- exemples de situations / modalités (competenceType: "exemple")`
    : `- attendus de fin de cycle (competenceType: "attendu")
- compétences travaillées (competenceType: "competence")
- connaissances et compétences associées (competenceType: "connaissance")
- exemples de situations / activités (competenceType: "exemple")
- repères de progressivité (competenceType: "progressivite")`;

  const documentLabel = isEmc
    ? "programme officiel d'éducation à la vie affective et relationnelle (EVAR/EMC)"
    : "Bulletin officiel";

  return `
Tu es Théa, l'assistante pédagogique de Flora.

Analyse EXHAUSTIVEMENT cette section du ${documentLabel} :
- Section : ${input.sectionLabel}${partLabel}
- Cycle : ${input.cycle || "non précisé"}
- Matière : ${input.matiere || "Français"}

Extrais TOUS les éléments pédagogiques présents, sans en inventer :
${elementTypes}

Pour chaque élément, conserve les formulations officielles et indique le niveau (CP, CE1, CE2, CM1, CM2…) quand il est identifiable.

Réponds UNIQUEMENT en JSON valide :

{
  "items": [
    {
      "cycle": "",
      "niveau": "",
      "matiere": "",
      "domaine": "",
      "sousDomaine": "",
      "competenceType": "",
      "competence": "",
      "sousCompetence": "",
      "sourceExcerpt": "",
      "code": ""
    }
  ]
}

Règles :
- Ne mets aucun texte avant ou après le JSON.
- Chaque tiret, puce ou ligne distincte du BO doit devenir UN item séparé dans items. Ne fusionne jamais plusieurs tirets.
- competence = formulation officielle exacte, sans reformulation ni résumé.
- sourceExcerpt = extrait court du texte source (max 240 caractères).
- Ne fusionne pas plusieurs compétences en une seule entrée.
- Si le niveau n'est pas explicite, laisse niveau vide.
- matiere = "${input.matiere || "Français"}" sauf indication contraire dans le texte.

Texte de la section :
${input.text}
`;
}
