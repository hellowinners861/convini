import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  AuthoredContentSchema,
  ContentValidationError,
  CONTENT,
  TASK5_CONTENT,
  TASK5_CONTENT_TOTALS,
  TASK5_CONTENT_VERSION,
  TASK4_CONTENT,
  TASK4_CONTENT_TOTALS,
  TASK4_CONTENT_VERSION,
  Task5ContentSchema,
  getTask4Customer,
  getTask4DayPlan,
  getTask4Encounter,
  getTask4Item,
  validateTask4Content,
  validateTask5Content,
  parseTask5Content,
  getTask5NewsArticle,
  getTask5EndingRecord,
  getTask5GoldenRoute,
} from "../src/content";
import type {
  AuthoredContent,
  ConditionalNarrative,
  Task5Content,
} from "../src/content/types";

const reservedContentDirectories = [
  "src/content/config",
  "src/content/items",
  "src/content/customers",
  "src/content/dayPlans",
  "src/content/encounters",
  "src/content/pairs",
  "src/content/news",
  "src/content/endings",
] as const;

function cloneContent(): AuthoredContent {
  return structuredClone(TASK4_CONTENT);
}

function cloneTask5Content(): Task5Content {
  return structuredClone(TASK5_CONTENT);
}

function expectInvalid(input: unknown, message?: RegExp): void {
  if (message) {
    expect(() => validateTask4Content(input)).toThrow(message);
  } else {
    expect(() => validateTask4Content(input)).toThrow();
  }
}

function expectTask5Invalid(input: unknown, message?: RegExp): void {
  if (message) {
    expect(() => validateTask5Content(input)).toThrow(message);
  } else {
    expect(() => validateTask5Content(input)).toThrow();
  }
}

function firstConditionalNarrative(content: AuthoredContent): ConditionalNarrative {
  for (const encounter of content.encounters) {
    if (typeof encounter.intro !== "string") {
      return encounter.intro;
    }
  }
  throw new Error("canonical content has no conditional narrative");
}

describe("Task 4 public catalog", () => {
  it("keeps the reserved content boundary intact", () => {
    for (const directory of reservedContentDirectories) {
      expect(existsSync(resolve(process.cwd(), directory))).toBe(true);
    }
  });

  it("exports the startup-validated canonical catalog, totals, and lookups", () => {
    expect(TASK4_CONTENT.contentVersion).toBe(TASK4_CONTENT_VERSION);
    expect(TASK4_CONTENT.items).toHaveLength(20);
    expect(TASK4_CONTENT.items.filter((item) => item.kind === "abnormal")).toHaveLength(12);
    expect(TASK4_CONTENT.items.filter((item) => item.kind === "ordinary")).toHaveLength(8);
    expect(TASK4_CONTENT.customers).toHaveLength(10);
    expect(TASK4_CONTENT.customers.filter((customer) => customer.role === "major")).toHaveLength(6);
    expect(TASK4_CONTENT.customers.filter((customer) => customer.role === "staff")).toHaveLength(1);
    expect(TASK4_CONTENT.customers.filter((customer) => customer.role === "incidental")).toHaveLength(3);
    expect(TASK4_CONTENT.encounters).toHaveLength(29);
    expect(TASK4_CONTENT.recommendationPairs).toHaveLength(11);
    expect(TASK4_CONTENT.dayPlans.map((plan) => plan.slots.length)).toEqual([5, 6, 6, 6, 6]);
    expect(TASK4_CONTENT.dayPlans.reduce((total, plan) => total + plan.slots.length, 0)).toBe(29);
    expect(TASK4_CONTENT.day5Convergence).toEqual({
      day: 5,
      finalQueueIndex: 5,
      successfulSaleAxisBonus: 2,
      refusalStabilityDelta: -2,
      refusalFlagId: "convergence_refused",
    });
    expect(TASK4_CONTENT_TOTALS).toEqual({
      items: 20,
      customers: 10,
      encounters: 29,
      recommendationPairs: 11,
      dayPlans: 5,
      slots: 29,
    });

    expect(getTask4Item("raw_meat_onigiri").id).toBe("raw_meat_onigiri");
    expect(getTask4Customer("hayakawa").id).toBe("hayakawa");
    expect(getTask4Encounter("d5_hotaru_final").id).toBe("d5_hotaru_final");
    expect(getTask4DayPlan(5).day).toBe(5);
  });

  it("rejects missing lookups with deterministic content errors", () => {
    for (const lookup of [
      () => getTask4Item("missing-item"),
      () => getTask4Customer("missing-customer"),
      () => getTask4Encounter("missing-encounter"),
      () => getTask4DayPlan(6 as never),
    ]) {
      expect(lookup).toThrow(ContentValidationError);
      expect(lookup).toThrow(/lookup failed: missing/);
    }
  });

  it("parses and semantically validates canonical content without mutation", () => {
    const beforeCatalog = structuredClone(TASK4_CONTENT);
    const fixture = cloneContent();
    const beforeFixture = structuredClone(fixture);

    expect(AuthoredContentSchema.parse(TASK4_CONTENT)).toEqual(TASK4_CONTENT);
    expect(validateTask4Content(fixture)).toEqual(TASK4_CONTENT);
    expect(fixture).toEqual(beforeFixture);
    expect(TASK4_CONTENT).toEqual(beforeCatalog);
  });

  it("keeps runtime ID uniqueness scoped by namespace", () => {
    const fixture = cloneContent();
    const narrative = firstConditionalNarrative(fixture);
    narrative.variants[0].id = fixture.encounters[0].outcomes.sell.id;

    // Outcome IDs and narrative variant IDs are distinct runtime namespaces;
    // variant IDs are required to be unique only within their own narrative.
    expect(() => validateTask4Content(fixture)).not.toThrow();
    expect(firstConditionalNarrative(validateTask4Content(fixture)).variants[0].id).toBe(
      fixture.encounters[0].outcomes.sell.id,
    );
  });

  it("rejects canonical count, day, slot, and fallback-assignment breaks", () => {
    const badSlotCount = cloneContent();
    badSlotCount.dayPlans[0].slots.pop();
    expectInvalid(badSlotCount, /day 1 must have exactly 5 slots/);

    const missingDay = cloneContent();
    missingDay.dayPlans = missingDay.dayPlans.filter((plan) => plan.day !== 4);
    expectInvalid(missingDay, /exactly 5 day plans|missing day plan 4/);

    const badTotal = cloneContent();
    badTotal.encounters.pop();
    expectInvalid(badTotal, /exactly 29 encounters|unknown fallback|missing fallback/);

    const repeatedFallback = cloneContent();
    repeatedFallback.dayPlans[0].slots[0].fallbackEncounterId =
      repeatedFallback.dayPlans[0].slots[1].fallbackEncounterId;
    expectInvalid(repeatedFallback, /assigned exactly once/);

    const unknownFallback = cloneContent();
    unknownFallback.dayPlans[0].slots[0].fallbackEncounterId = "missing-encounter";
    expectInvalid(unknownFallback, /unknown fallback encounter|missing fallback/);
  });

  it("rejects duplicate IDs and missing encounter/customer/item references", () => {
    const duplicateItem = cloneContent();
    duplicateItem.items[1].id = duplicateItem.items[0].id;
    expectInvalid(duplicateItem, /duplicate item id/);

    const duplicateOption = cloneContent();
    duplicateOption.encounters[0].recommendationOptions[0].id =
      duplicateOption.encounters[1].recommendationOptions[0].id;
    expectInvalid(duplicateOption, /duplicate recommendation option id/);

    const duplicateOutcome = cloneContent();
    duplicateOutcome.encounters[1].outcomes.sell.id =
      duplicateOutcome.encounters[0].outcomes.sell.id;
    expectInvalid(duplicateOutcome, /duplicate authored outcome id/);

    const duplicateSlot = cloneContent();
    duplicateSlot.dayPlans[1].slots[0].id = duplicateSlot.dayPlans[0].slots[0].id;
    expectInvalid(duplicateSlot, /duplicate encounter slot id/);

    const missingCustomer = cloneContent();
    missingCustomer.encounters[0].customerId = "missing-customer";
    expectInvalid(missingCustomer, /unknown customer|missing customer/);

    const missingRequestedItem = cloneContent();
    missingRequestedItem.encounters[0].requestedItemId = "missing-item";
    expectInvalid(missingRequestedItem, /unknown requested item|missing requested item/);

    const missingCandidate = cloneContent();
    missingCandidate.dayPlans[0].slots[0].candidates = [
      { encounterId: "missing-encounter", conditions: { true: true }, priority: 1 },
    ];
    expectInvalid(missingCandidate, /unknown candidate encounter|missing encounter/);
  });

  it("rejects malformed effects, copies, and pair outcome semantics", () => {
    const malformedEffect = cloneContent();
    malformedEffect.encounters[0].outcomes.sell.effects = [
      { kind: "add", target: "not-a-target", amount: 1 } as never,
    ];
    expectInvalid(malformedEffect);

    const missingCopy = cloneContent();
    delete (missingCopy.encounters[0].outcomes.sell.copy as unknown as Record<string, unknown>).receipt;
    expectInvalid(missingCopy);

    const duplicateStateEffect = cloneContent();
    duplicateStateEffect.recommendationPairs[0].outcome.effects.push({
      kind: "setCustomerState",
      customerId: "hayakawa",
      state: "another-state",
    });
    expectInvalid(duplicateStateEffect, /Multiple customer states|effective outcome/);
  });

  it("rejects ambiguous, missing, and extra recommendation pairs", () => {
    const ambiguous = cloneContent();
    ambiguous.recommendationPairs.push({
      ...ambiguous.recommendationPairs[0],
      id: "ambiguous-pair",
    });
    expectInvalid(ambiguous, /ambiguous|same-priority/);

    const missingPair = cloneContent();
    missingPair.recommendationPairs = missingPair.recommendationPairs.filter(
      (pair) => pair.recommendedItemId !== "mask",
    );
    expectInvalid(missingPair, /exactly one global recommendation pair|missing matching|received 0/);

    const extraPair = cloneContent();
    extraPair.recommendationPairs[0].recommendedItemId = "black_coffee";
    expectInvalid(extraPair, /must recommend an abnormal|no matching|ordinary recommendation/);
  });

  it("rejects wrong role and axis catalogs", () => {
    const wrongRole = cloneContent();
    wrongRole.customers.find((customer) => customer.id === "hayakawa")!.role = "incidental";
    expectInvalid(wrongRole, /major customers|axis-bearing major|non-major/);

    const wrongCustomerAxis = cloneContent();
    wrongCustomerAxis.customers.find((customer) => customer.id === "hayakawa")!.axis = "machine";
    expectInvalid(wrongCustomerAxis, /axis-bearing customer|crosses the customer's world axis/);

    const wrongItemAxis = cloneContent();
    const mask = wrongItemAxis.items.find((item) => item.id === "mask");
    if (mask?.kind === "abnormal") {
      mask.axis = "machine";
    }
    expectInvalid(wrongItemAxis, /undead coexist|crosses the customer's world axis/);
  });

  it("rejects bad Day 5 metadata and dynamic convergence", () => {
    const badMetadata = cloneContent();
    badMetadata.dayPlans[4].day5AnomalyOrder![0].slotId = "slot_d5_miyashita";
    expectInvalid(badMetadata, /anomaly|non-anomaly|customer does not match/);

    const wrongMetadataCustomer = cloneContent();
    wrongMetadataCustomer.dayPlans[4].day5AnomalyOrder![0].customerId = "ren";
    expectInvalid(wrongMetadataCustomer, /axis-bearing|axis does not match|customer does not match/);

    const badConvergence = cloneContent();
    badConvergence.day5Convergence.finalQueueIndex = 4;
    expectInvalid(badConvergence, /finalQueueIndex must be exactly 5/);

    const outOfRangeConvergence = cloneContent();
    outOfRangeConvergence.day5Convergence.finalQueueIndex = 6;
    expectInvalid(outOfRangeConvergence, /finalQueueIndex/);

    const staticConvergence = cloneContent() as AuthoredContent & {
      day5Convergence: AuthoredContent["day5Convergence"] & { finalSlotId?: string };
    };
    staticConvergence.day5Convergence.finalSlotId = "slot_d5_spirit";
    expectInvalid(staticConvergence);

    const nonDay5Metadata = cloneContent();
    nonDay5Metadata.dayPlans[0].day5AnomalyOrder = [];
    expectInvalid(nonDay5Metadata, /only valid on day 5|only day 5/);
  });

  it("rejects duplicate narrative variants within one narrative", () => {
    const duplicateVariant = cloneContent();
    const narrative = firstConditionalNarrative(duplicateVariant);
    narrative.variants[1].id = narrative.variants[0].id;
    expectInvalid(duplicateVariant, /duplicate narrative variant id/);
  });
});

describe("Task 5 aggregate catalog", () => {
  it("parses the startup-validated aggregate and exposes canonical totals and lookups", () => {
    expect(TASK5_CONTENT.contentVersion).toBe(TASK5_CONTENT_VERSION);
    expect(TASK5_CONTENT_VERSION).toBe("task5-authored-v1");
    expect(TASK5_CONTENT.news).toHaveLength(30);
    expect(TASK5_CONTENT.endingRecords).toHaveLength(5);
    expect(TASK5_CONTENT.goldenRoutes).toHaveLength(5);
    expect(TASK5_CONTENT_TOTALS).toEqual({
      items: 20,
      customers: 10,
      encounters: 29,
      recommendationPairs: 11,
      dayPlans: 5,
      slots: 29,
      news: 30,
      endingRecords: 5,
      goldenRoutes: 5,
    });
    expect(CONTENT).toBe(TASK5_CONTENT);
    expect(getTask5NewsArticle("news_d1_local_clock_fallback").id).toBe(
      "news_d1_local_clock_fallback",
    );
    expect(getTask5EndingRecord("inventory_mixup").id).toBe("inventory_mixup");
    expect(getTask5GoldenRoute("route_undead_runaway").expected.endingId).toBe(
      "undead_dawnless_city",
    );
  });

  it("strictly parses and semantically validates a detached clone without mutation", () => {
    const input = cloneTask5Content();
    const beforeInput = structuredClone(input);
    const beforeCatalog = structuredClone(TASK5_CONTENT);

    expect(Task5ContentSchema.parse(input)).toEqual(input);
    const parsed = parseTask5Content(input);
    expect(parsed).toEqual(TASK5_CONTENT);
    expect(parsed).not.toBe(input);
    expect(validateTask5Content(input)).toEqual(TASK5_CONTENT);
    expect(input).toEqual(beforeInput);
    expect(TASK5_CONTENT).toEqual(beforeCatalog);
  });

  it("retains exact Task 4 version rejection while accepting only the Task 5 version", () => {
    const wrongVersion = cloneTask5Content();
    wrongVersion.contentVersion = TASK4_CONTENT_VERSION;
    expectTask5Invalid(wrongVersion, /contentVersion must be task5-authored-v1/);
  });

  it("rejects aggregate counts, IDs, references, text, fallback/group, and effect mutations", () => {
    const badNewsCount = cloneTask5Content();
    badNewsCount.news.pop();
    expectTask5Invalid(badNewsCount, /exactly 30 news articles/);

    const duplicateNewsId = cloneTask5Content();
    duplicateNewsId.news[1].id = duplicateNewsId.news[0].id;
    expectTask5Invalid(duplicateNewsId, /duplicate news id|missing canonical news/);

    const missingCustomerReference = cloneTask5Content();
    missingCustomerReference.news[0].conditions = {
      customerState: { customerId: "missing-customer", state: "sealed" },
    };
    expectTask5Invalid(missingCustomerReference, /references missing customer/);

    const normalizedTextCollision = cloneTask5Content();
    normalizedTextCollision.news[0].notificationHeadline =
      `  ${normalizedTextCollision.news[0].headline}\t`;
    expectTask5Invalid(normalizedTextCollision, /notification must differ/);

    const badFallback = cloneTask5Content();
    badFallback.news.find((article) => article.id === "news_d1_direct_fallback")!.priority = -99;
    expectTask5Invalid(badFallback, /fallback news .*priority -100/);

    const badGroup = cloneTask5Content();
    badGroup.news.find((article) => article.id === "news_d5_trend_spirit")!.exclusiveGroup =
      "wrong_group";
    expectTask5Invalid(badGroup, /exclusive group|wrong members/);

    const badEffect = cloneTask5Content();
    badEffect.news[0].effectsOnRead = [
      { kind: "add", target: "world.undead", amount: 1 },
    ];
    expectTask5Invalid(badEffect, /read_|ending-relevant/);
  });

  it("rejects ending-record/rule and real-route mutations", () => {
    const badEndingCount = cloneTask5Content();
    badEndingCount.endingRecords.pop();
    expectTask5Invalid(badEndingCount, /exactly five ending records/);

    const badEndingTitle = cloneTask5Content();
    badEndingTitle.endingRecords[0].presentation.title = "別の結末";
    expectTask5Invalid(badEndingTitle, /wrong title/);

    const badRule = cloneTask5Content();
    badRule.endingRecords[0].rules[0].priority = 99;
    expectTask5Invalid(badRule, /priority 100|unexpected ending rule|canonical ending rule/);

    const badRouteReference = cloneTask5Content();
    badRouteReference.goldenRoutes[0].decisions[0].encounterId = "missing-encounter";
    expectTask5Invalid(badRouteReference, /references missing encounter|cover every canonical/);

    const badRouteOption = cloneTask5Content();
    badRouteOption.goldenRoutes[0].decisions[0].recommendedItemId = "missing-item";
    expectTask5Invalid(badRouteOption, /unavailable option/);

    const badRouteDuplicate = cloneTask5Content();
    badRouteDuplicate.goldenRoutes[0].decisions.push({
      ...badRouteDuplicate.goldenRoutes[0].decisions[0],
    });
    expectTask5Invalid(badRouteDuplicate);
  });
});
