import type { BoSectionDefinition } from "./bo-types";

/** Sections pour programmes BO EMC / EVAR (ex. éducation à la vie affective et relationnelle). */
export const BO_EVAR_SECTIONS: BoSectionDefinition[] = [
  {
    id: "evar_intro",
    label: "Principes et cadre EVAR",
    anchors: [
      "Principes, valeurs, finalités",
      "éducation à la vie affective",
      "éducation à la sexualité",
    ],
  },
  {
    id: "evar_organisation",
    label: "Organisation et mise en œuvre",
    anchors: ["Organisation et mise en œuvre", "Organisation du programme"],
  },
  {
    id: "evar_contenus",
    label: "Contenus et progressivité",
    anchors: [
      "Les contenus et les modalités",
      "Le programme repose sur trois principes",
      "trouver sa place dans la société",
    ],
  },
  {
    id: "evar_niveaux",
    label: "Programmation par niveau",
    anchors: ["CP ", "CE1 ", "CE2 ", "CM1 ", "CM2 ", "Connaître son corps"],
  },
];
