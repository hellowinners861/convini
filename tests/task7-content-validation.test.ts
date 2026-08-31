import { describe, expect, it } from "vitest";
import {
  TASK5_CONTENT,
  validateTask5Content,
} from "../src/content";
import {
  buildSemanticReferenceRegistry,
  buildTask5SemanticReferenceRegistry,
} from "../src/content/validation";
import type { ConditionalNarrative, Task5Content } from "../src/content/types";

function cloneTask5Content(): Task5Content {
  return structuredClone(TASK5_CONTENT);
}

function firstConditionalNarrative(content: Task5Content): ConditionalNarrative {
  for (const encounter of content.encounters) {
    if (typeof encounter.intro !== "string") {
      return encounter.intro;
    }
  }
  throw new Error("canonical content has no conditional narrative");
}

function firstProducedState(
  registry: ReturnType<typeof buildSemanticReferenceRegistry>,
): [string, string] {
  for (const customerId of registry.customerIds) {
    const state = registry.customerStates[customerId]?.[0];
    if (state) {
      return [customerId, state];
    }
  }
  throw new Error("canonical content has no produced customer state");
}

function newsIdForDay(
  registry: ReturnType<typeof buildSemanticReferenceRegistry>,
  day: number,
): string {
  const id = registry.newsIds.find((candidate) => registry.newsDays[candidate] === day);
  if (!id) {
    throw new Error(`canonical content has no news for day ${day}`);
  }
  return id;
}

function expectDeepFrozen(value: unknown, seen = new Set<object>()): void {
  if (typeof value !== "object" || value === null || seen.has(value)) {
    return;
  }
  seen.add(value);
  expect(Object.isFrozen(value)).toBe(true);
  for (const child of Object.values(value)) {
    expectDeepFrozen(child, seen);
  }
}

describe("Task 7 semantic reference registry and validation", () => {
  it("builds canonical totals in stable order, freezes deeply, and does not mutate input", () => {
    const before = structuredClone(TASK5_CONTENT);
    const first = buildSemanticReferenceRegistry(TASK5_CONTENT);
    const second = buildSemanticReferenceRegistry(TASK5_CONTENT);

    expect(first).toEqual(second);
    expect(first.customerIds).toHaveLength(10);
    expect(first.goldenRouteIds).toHaveLength(5);
    expect(Object.keys(first.encounterDays)).toHaveLength(29);
    expect(first.newsIds).toHaveLength(30);
    expect(first.days[1]).toHaveLength(5);
    expect(first.days[2]).toHaveLength(6);
    expect(first.days[3]).toHaveLength(6);
    expect(first.days[4]).toHaveLength(6);
    expect(first.days[5]).toHaveLength(6);
    expect(first.flags).toEqual([...first.flags].sort());
    expect(first.customerIds).toEqual([...first.customerIds].sort());
    expect(first.goldenRouteIds).toEqual([...first.goldenRouteIds].sort());
    expect(first.newsIds).toEqual([...first.newsIds].sort());
    expectDeepFrozen(first);
    expect(TASK5_CONTENT).toEqual(before);
  });

  it("accepts the canonical aggregate and exposes the intended registry builders", () => {
    expect(() => validateTask5Content(cloneTask5Content())).not.toThrow();
    const generic = buildSemanticReferenceRegistry(TASK5_CONTENT);
    const task5 = buildTask5SemanticReferenceRegistry(TASK5_CONTENT);
    expect(task5).toEqual(generic);
    expect(task5.producedFlags).toBe(task5.flags);
    expect(task5.statesByCustomer).toBe(task5.customerStates);
    expect(task5.encounterDayById).toBe(task5.encounterDays);
    expect(task5.newsDayById).toBe(task5.newsDays);
  });

  it("rejects an unproducible flag nested in authored narrative conditions", () => {
    const input = cloneTask5Content();
    const narrative = firstConditionalNarrative(input);
    narrative.variants[0].condition = {
      all: [{ not: { flag: { id: "task7_missing_flag" } } }],
    };

    expect(() => validateTask5Content(input)).toThrow(/unproducible flag task7_missing_flag/);
  });

  it("rejects wrong-customer and unproducible states while accepting canonical state provenance", () => {
    const registry = buildSemanticReferenceRegistry(TASK5_CONTENT);
    const [customerId, state] = firstProducedState(registry);
    const wrongCustomer = cloneTask5Content();
    firstConditionalNarrative(wrongCustomer).variants[0].condition = {
      customerState: { customerId: "task7_missing_customer", state },
    };
    expect(() => validateTask5Content(wrongCustomer)).toThrow(/missing customer/);

    const wrongState = cloneTask5Content();
    firstConditionalNarrative(wrongState).variants[0].condition = {
      customerState: { customerId, state: "task7_missing_state" },
    };
    expect(() => validateTask5Content(wrongState)).toThrow(/unproducible customer state/);
    expect(registry.customerStates[customerId]).toContain(state);
    expect(() => validateTask5Content(TASK5_CONTENT)).not.toThrow();
  });

  it("rejects a day-plan candidate whose encounter belongs to another fallback day", () => {
    const input = cloneTask5Content();
    const registry = buildSemanticReferenceRegistry(input);
    const foreignEncounterId = Object.entries(registry.encounterDays).find(
      ([, day]) => day === 2,
    )?.[0];
    if (!foreignEncounterId) {
      throw new Error("canonical content has no Day 2 encounter");
    }
    input.dayPlans.find((plan) => plan.day === 1)!.slots[0].candidates.push({
      encounterId: foreignEncounterId,
      conditions: { true: true },
      priority: 999,
    });

    expect(() => validateTask5Content(input)).toThrow(/owned by day 2, not day 1/);
  });

  it("rejects same-day and future seenNews/readNews references in day-aware locations", () => {
    const input = cloneTask5Content();
    const registry = buildSemanticReferenceRegistry(input);
    const article = input.news.find((candidate) => candidate.day === 2 && !candidate.isFallback)!;
    article.conditions = {
      all: [
        { seenNews: { id: newsIdForDay(registry, 2) } },
        { readNews: { id: newsIdForDay(registry, 3) } },
      ],
    };

    expect(() => validateTask5Content(input)).toThrow(/may reference only earlier-day news/);
  });

  it("accepts earlier-day news in day-aware content and Day 5 news in ending presentation", () => {
    const input = cloneTask5Content();
    const registry = buildSemanticReferenceRegistry(input);
    const article = input.news.find((candidate) => candidate.day === 3 && !candidate.isFallback)!;
    article.conditions = {
      all: [
        { seenNews: { id: newsIdForDay(registry, 1), present: false } },
        article.conditions,
      ],
    };
    input.endingRecords[0].presentation.lead = {
      variants: [
        {
          id: "task7_day5_ending_reference",
          condition: { readNews: { id: newsIdForDay(registry, 5) } },
          priority: 1,
          text: "Day 5 reference",
        },
      ],
      fallback: "Ending reference",
    };

    expect(() => validateTask5Content(input)).not.toThrow();
  });

  it("covers pair, news, convergence-refusal provenance and stable day-slot ownership", () => {
    const content = TASK5_CONTENT;
    const registry = buildSemanticReferenceRegistry(content);
    const pairEffects = content.recommendationPairs.flatMap((pair) => pair.outcome.effects);
    const news = content.news[0];

    expect(pairEffects.length).toBeGreaterThan(0);
    for (const pairEffect of pairEffects) {
      if (pairEffect.kind === "setFlag") {
        expect(registry.flags).toContain(pairEffect.id);
      }
      if (pairEffect.kind === "setCustomerState") {
        expect(registry.customerStates[pairEffect.customerId]).toContain(pairEffect.state);
      }
    }
    expect(registry.flags).toContain(`read_${news.id}`);
    expect(registry.flags).toContain(content.day5Convergence.refusalFlagId);
    for (const plan of content.dayPlans) {
      expect(registry.days[plan.day]).toEqual(plan.slots.map((slot) => slot.id).sort());
      for (const slot of plan.slots) {
        expect(registry.slots[slot.id].day).toBe(plan.day);
        expect(registry.slots[slot.id].fallbackEncounterId).toBe(slot.fallbackEncounterId);
        expect(registry.slots[slot.id].candidateEncounterIds).toEqual(
          slot.candidates.map((candidate) => candidate.encounterId).sort(),
        );
      }
    }
  });
});
