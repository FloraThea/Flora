"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  buildDynamicSubSubjectTabs,
  buildDynamicSubjectTabs,
  buildSubjectTabCounts,
  matchesSubSubjectTab,
  matchesSubjectTab,
  persistSubjectTab,
  persistSubSubjectTab,
  persistTabOrder,
  readStoredSubSubjectTab,
  readStoredTabOrder,
  resolveInitialSubjectTab,
  sortSubjectTabs,
  SUB_SUBJECT_ALL,
  type PedagogicalModuleKey,
  type SubjectNavItem,
} from "@/lib/pedagogical/subject-navigation";
import { SUBJECT_ALL, SUBJECT_NONE } from "@/lib/pedagogical/subjects";

export function useSubjectNavigation<T extends SubjectNavItem>(module: PedagogicalModuleKey, items: T[]) {
  const baseTabs = useMemo(() => buildDynamicSubjectTabs(items), [items]);
  const customOrder = useMemo(() => readStoredTabOrder(module), [module]);

  const tabs = useMemo(
    () => sortSubjectTabs(baseTabs, customOrder),
    [baseTabs, customOrder],
  );

  const counts = useMemo(() => buildSubjectTabCounts(items), [items]);

  const [activeSubjectTab, setActiveSubjectTabState] = useState(SUBJECT_ALL);
  const [activeSubSubjectTab, setActiveSubSubjectTabState] = useState(SUB_SUBJECT_ALL);
  const [tabOrder, setTabOrder] = useState<string[]>(customOrder);

  useEffect(() => {
    setActiveSubjectTabState(resolveInitialSubjectTab(module, tabs));
  }, [module, tabs.join("|")]);

  useEffect(() => {
    const storedSub = readStoredSubSubjectTab(module);
    const subTabs = buildDynamicSubSubjectTabs(items, activeSubjectTab);
    if (storedSub && subTabs.includes(storedSub)) {
      setActiveSubSubjectTabState(storedSub);
    } else {
      setActiveSubSubjectTabState(SUB_SUBJECT_ALL);
    }
  }, [module, activeSubjectTab, items]);

  const subSubjectTabs = useMemo(
    () => buildDynamicSubSubjectTabs(items, activeSubjectTab),
    [items, activeSubjectTab],
  );

  const filteredItems = useMemo(
    () =>
      items.filter(
        (item) =>
          matchesSubjectTab(item, activeSubjectTab) &&
          matchesSubSubjectTab(item, activeSubjectTab, activeSubSubjectTab),
      ),
    [items, activeSubjectTab, activeSubSubjectTab],
  );

  const setActiveSubjectTab = useCallback(
    (tab: string) => {
      setActiveSubjectTabState(tab);
      persistSubjectTab(module, tab);
      setActiveSubSubjectTabState(SUB_SUBJECT_ALL);
      persistSubSubjectTab(module, SUB_SUBJECT_ALL);
    },
    [module],
  );

  const setActiveSubSubjectTab = useCallback(
    (tab: string) => {
      setActiveSubSubjectTabState(tab);
      persistSubSubjectTab(module, tab);
    },
    [module],
  );

  const reorderTabs = useCallback(
    (nextOrder: string[]) => {
      setTabOrder(nextOrder);
      persistTabOrder(module, nextOrder);
    },
    [module],
  );

  const activeMatierePrefill =
    activeSubjectTab !== SUBJECT_ALL && activeSubjectTab !== SUBJECT_NONE
      ? activeSubjectTab
      : "";

  const activeSousMatierePrefill =
    activeSubSubjectTab !== SUB_SUBJECT_ALL ? activeSubSubjectTab : "";

  return {
    tabs,
    counts,
    subSubjectTabs,
    activeSubjectTab,
    activeSubSubjectTab,
    filteredItems,
    setActiveSubjectTab,
    setActiveSubSubjectTab,
    reorderTabs,
    tabOrder,
    activeMatierePrefill,
    activeSousMatierePrefill,
  };
}
