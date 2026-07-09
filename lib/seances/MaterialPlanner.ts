import type { SeanceContext, SeanceMaterial } from "./types";

/**
 * Planifie le matériel à partir de la séquence, de la progression et des ressources.
 */
export class MaterialPlanner {
  plan(context: SeanceContext): SeanceMaterial {
    const sequence = context.sequencePayload.sequence;
    const row = context.progressionRow;

    const guides = sequence.resources.filter((item) => /guide/i.test(item));
    const albums = sequence.resources.filter((item) => /album/i.test(item));
    const manipulation = [
      ...row.materiel,
      ...sequence.materiel.filter((item) => /manipul|matériel|materiel/i.test(item)),
    ];
    const affichages = sequence.materiel.filter((item) => /affichage|poster|affiche/i.test(item));
    const fiches = sequence.resources.filter((item) => /fiche/i.test(item));
    const cartes = sequence.resources.filter((item) => /carte/i.test(item));
    const jeux = sequence.resources.filter((item) => /jeu/i.test(item));

    const autres = [
      ...sequence.materiel,
      ...sequence.resources,
    ].filter(
      (item) =>
        !guides.includes(item) &&
        !albums.includes(item) &&
        !manipulation.includes(item) &&
        !affichages.includes(item) &&
        !fiches.includes(item) &&
        !cartes.includes(item) &&
        !jeux.includes(item),
    );

    return {
      guides: unique(guides),
      albums: unique(albums),
      affichages: unique(affichages),
      manipulation: unique(manipulation),
      videoprojecteur: ["Vidéoprojecteur ou tableau numérique si ressource vidéo"],
      photocopies: fiches.length > 0 ? unique(fiches) : ["Photocopies si fiches distribuées"],
      fiches: unique(fiches),
      cartes: unique(cartes),
      jeux: unique(jeux),
      autres: unique(autres),
    };
  }
}

function unique(items: string[]): string[] {
  return [...new Set(items.filter(Boolean))];
}

export const materialPlanner = new MaterialPlanner();
