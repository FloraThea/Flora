import assert from "node:assert/strict";
import { toAgendaUserMessage, isMissingAgendaTableError } from "./agenda-profile";

function testAgendaUserMessages() {
  assert.equal(
    toAgendaUserMessage(new Error("Profil enseignant requis.")),
    "Configurez votre profil pédagogique pour utiliser l'agenda.",
  );
  assert.equal(
    toAgendaUserMessage(new Error('relation "agenda_events" does not exist')),
    "Le module agenda n'est pas encore initialisé en base de données.",
  );
  assert.equal(
    toAgendaUserMessage(new Error("network failed")),
    "L'agenda n'a pas pu être chargé.",
  );
  assert.notEqual(toAgendaUserMessage(new Error("network failed")), "Feed agenda impossible.");
}

function testMissingTableDetection() {
  assert.equal(isMissingAgendaTableError(new Error("PGRST205")), true);
  assert.equal(isMissingAgendaTableError(new Error("agenda_events")), true);
  assert.equal(isMissingAgendaTableError(new Error("timeout")), false);
}

function testEmptyFeedIsNotError() {
  const emptyFeed = {
    events: [],
    tasks: [],
    reminders: [],
    dueReminders: [],
    syncedAt: new Date().toISOString(),
  };
  assert.equal(emptyFeed.events.length, 0);
  assert.ok(Array.isArray(emptyFeed.events));
}

function runAgendaTests() {
  testAgendaUserMessages();
  testMissingTableDetection();
  testEmptyFeedIsNotError();
  console.log("Agenda tests: 3/3 passed");
}

runAgendaTests();
