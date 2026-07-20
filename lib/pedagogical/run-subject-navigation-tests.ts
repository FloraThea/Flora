import assert from "node:assert/strict";
import {
  buildDynamicSubjectTabs,
  buildDynamicSubSubjectTabs,
  buildSubjectTabCounts,
  matchesSubSubjectTab,
  sortSubjectKeys,
  SUB_SUBJECT_ALL,
} from "./subject-navigation";
import { SUBJECT_ALL, SUBJECT_NONE } from "./subjects";

function testDynamicTabsAndCounts() {
  const items = [
    { matiere: "Français", sous_matiere: "Conjugaison" },
    { matiere: "Français", sous_matiere: "Grammaire" },
    { matiere: "Mathématiques", sous_matiere: "Géométrie" },
  ];

  const tabs = buildDynamicSubjectTabs(items);
  assert.ok(tabs.includes(SUBJECT_ALL));
  assert.ok(tabs.includes("Français"));
  assert.ok(tabs.includes("Mathématiques"));
  assert.equal(tabs.includes(SUBJECT_NONE), false);

  const counts = buildSubjectTabCounts(items);
  assert.equal(counts[SUBJECT_ALL], 3);
  assert.equal(counts.Français, 2);
  assert.equal(counts.Mathématiques, 1);
}

function testSubSubjectTabsOnlyWhenPresent() {
  const items = [
    { matiere: "Français", sous_matiere: "Conjugaison" },
    { matiere: "Français", sous_matiere: "Grammaire" },
  ];

  const subTabs = buildDynamicSubSubjectTabs(items, "Français");
  assert.ok(subTabs.includes(SUB_SUBJECT_ALL));
  assert.ok(subTabs.includes("Conjugaison"));
  assert.ok(subTabs.includes("Grammaire"));
  assert.equal(subTabs.includes("Orthographe"), false);
}

function testSubjectOrderStable() {
  const ordered = sortSubjectKeys(["EMC", "Français", "Histoire", "Mathématiques"]);
  assert.deepEqual(ordered.slice(0, 2), ["Français", "Mathématiques"]);
}

function testSubSubjectFilter() {
  const items = [{ matiere: "Français", sous_matiere: "Conjugaison" }];
  assert.equal(
    matchesSubSubjectTab(items[0]!, "Français", "Conjugaison"),
    true,
  );
  assert.equal(
    matchesSubSubjectTab(items[0]!, "Français", "Grammaire"),
    false,
  );
}

function runSubjectNavigationTests() {
  testDynamicTabsAndCounts();
  testSubSubjectTabsOnlyWhenPresent();
  testSubjectOrderStable();
  testSubSubjectFilter();
  console.log("Subject navigation tests: 4/4 passed");
}

runSubjectNavigationTests();
