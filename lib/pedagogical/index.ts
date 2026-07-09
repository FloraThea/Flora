export { PedagogicalEngine, pedagogicalEngine } from "./PedagogicalEngine";
export { pedagogicalEventBus } from "./events";
export * from "./types";
export { detectPedagogicalConflicts } from "./conflict-detector";
export { recalculateHourVolumes, recalculatePedagogicalStats } from "./hours-calculator";
export { logPedagogicalChange, listPedagogicalChanges, revertPedagogicalChange } from "./change-history";
