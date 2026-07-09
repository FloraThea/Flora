import type { PedagogicalEvent, PedagogicalEventType } from "./types";

export type EventHandler = (event: PedagogicalEvent) => Promise<void>;

/**
 * Bus d'événements interne — léger, sans dépendance externe.
 * Chaque événement déclenche les handlers enregistrés de façon séquentielle.
 */
export class PedagogicalEventBus {
  private handlers = new Map<PedagogicalEventType | "*", EventHandler[]>();

  on(type: PedagogicalEventType | "*", handler: EventHandler): void {
    const list = this.handlers.get(type) ?? [];
    list.push(handler);
    this.handlers.set(type, list);
  }

  async emit(event: PedagogicalEvent): Promise<void> {
    const specific = this.handlers.get(event.type) ?? [];
    const global = this.handlers.get("*") ?? [];

    for (const handler of [...specific, ...global]) {
      await handler(event);
    }
  }
}

export const pedagogicalEventBus = new PedagogicalEventBus();
