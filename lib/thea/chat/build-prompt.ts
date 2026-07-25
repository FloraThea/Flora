import type { TeacherProfileBundle } from "@/lib/profile/types";
import { buildTheaInstructionBlock } from "@/lib/profile/profile-context";
import type { TheaAskRequest } from "./types";

function formatHistory(
  history: Array<{ role: "user" | "assistant"; content: string }> | undefined,
): string {
  if (!history?.length) return "";
  return history
    .slice(-8)
    .map((entry) => `${entry.role === "user" ? "Enseignant" : "Théa"} : ${entry.content}`)
    .join("\n\n");
}

export function buildTheaChatPrompt(
  input: TheaAskRequest,
  bundle: TeacherProfileBundle | null,
): string {
  const profileBlock = bundle
    ? buildTheaInstructionBlock(bundle)
    : "Profil enseignant non configuré — répondre de façon générale et inviter à compléter le profil sur /profil.";

  const historyBlock = formatHistory(input.history);

  if (input.mode === "create_seance") {
    const ctx = input.createContext;
    return `
Tu es Théa, l'assistante pédagogique de Flora.
L'enseignant demande EXPLICITEMENT la création d'une séance (mode génération IA sur demande).

${profileBlock}

Contexte de création :
- Matière : ${ctx?.matiere || "non précisée"}
- Niveau : ${ctx?.niveau || bundle?.profile.levels.join(", ") || "non précisé"}
- Objectif : ${ctx?.objectif || input.message}
- Durée visée : ${ctx?.dureeMinutes ?? 45} minutes
- Consignes : ${ctx?.consignes || input.message}

Produis une proposition de séance structurée en français :
1. Titre
2. Compétence visée
3. Objectif
4. Matériel
5. Déroulement (phases avec durées)
6. Différenciation (si pertinent)
7. Évaluation formative

Ne pas inventer de données déjà importées dans Flora. Proposer un contenu pédagogique original adapté au profil.
`.trim();
  }

  if (input.mode === "create_sequence") {
    const ctx = input.createContext;
    return `
Tu es Théa, l'assistante pédagogique de Flora.
L'enseignant demande EXPLICITEMENT la création d'une séquence (mode génération IA sur demande).

${profileBlock}

Contexte de création :
- Matière : ${ctx?.matiere || "non précisée"}
- Niveau : ${ctx?.niveau || bundle?.profile.levels.join(", ") || "non précisé"}
- Thème / objectifs : ${ctx?.objectif || input.message}
- Nombre de séances visé : ${ctx?.sessionCount ?? 4}
- Consignes : ${ctx?.consignes || input.message}

Produis une proposition de séquence structurée en français :
1. Titre de la séquence
2. Compétences et objectifs
3. Prérequis
4. Plan séance par séance (titre + objectif + durée)
5. Matériel global
6. Évaluation finale

Adapter au profil enseignant. Contenu original, pas une copie de documents importés.
`.trim();
  }

  return `
Tu es Théa, l'assistante pédagogique de Flora.
Tu aides l'enseignant à préparer sa classe : programmation, progressions, séances, cahier journal, emploi du temps.

${profileBlock}

Règles :
- Répondre en français, de façon claire et professionnelle.
- Pour les contenus déjà importés (progressions MHM, guides, etc.), rappeler que Flora les restitue fidèlement sans les réécrire.
- La génération IA de séances/séquences n'est proposée que si l'enseignant le demande explicitement (onglet Créer).
- Ne pas inventer de données sur la classe si elles ne figurent pas dans le profil.

${historyBlock ? `Historique récent :\n${historyBlock}\n\n` : ""}Question de l'enseignant :
${input.message}
`.trim();
}
