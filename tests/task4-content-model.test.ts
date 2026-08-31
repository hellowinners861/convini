import { describe, expect, it } from "vitest";
import { createInitialGameState } from "../src/domain";
import {
  AuthoredContentSchema,
  ConditionalNarrativeSchema,
  NarrativeVariantSchema,
} from "../src/content/schemas";
import { resolveNarrative, resolveNarrativeVariant } from "../src/content/narrative";
import type {
  AuthoredContent,
  AuthoredRecommendationPair,
  ConditionalNarrative,
} from "../src/content/types";

const always = { true: true } as const;

function copy(text: string) {
  return { result: text, readback: `${text} readback`, receipt: `${text} receipt` };
}

function makePair(id = "pair-gum"): AuthoredRecommendationPair {
  return {
    id,
    customerId: "taxi",
    requestedItemId: "coffee",
    recommendedItemId: "gum",
    conditions: always,
    priority: 5,
    mode: "append-base-sale",
    outcome: {
      id: `${id}-outcome`,
      effects: [{ kind: "add", target: "stability", amount: 1 }],
    },
  };
}

function makeContent(): AuthoredContent {
  return {
    contentVersion: "task4-authored-v2",
    items: [
      {
        id: "coffee",
        kind: "ordinary",
        name: "黒コーヒー",
        description: "苦い一杯。",
        price: 180,
      },
      {
        id: "gum",
        kind: "ordinary",
        name: "ミントガム",
        description: "眠気覚まし。",
        price: 120,
      },
      {
        id: "raw-rice-ball",
        kind: "abnormal",
        name: "生肉おにぎり",
        description: "赤い具材が見える限定品。",
        price: 260,
        axis: "undead",
        anomalyRole: "base",
      },
    ],
    customers: [
      { id: "taxi", name: "夜勤運転手", description: "時計を気にしている客。", role: "incidental" },
      { id: "anomaly-machine", name: "機械の客", description: "配送箱を抱えた客。", role: "major" },
      { id: "anomaly-cosmic", name: "宇宙の客", description: "空を見上げる客。", role: "major" },
      { id: "anomaly-spirit", name: "霊界の客", description: "写真を持つ客。", role: "major" },
      { id: "manager", name: "店長", description: "申し送りをする人。", role: "staff" },
    ],
    encounters: [
      {
        id: "encounter-1",
        customerId: "taxi",
        requestedItemId: "coffee",
        intro: "客はカウンターへ商品を置いた。",
        scan: {
          variants: [
            {
              id: "scan-ready",
              condition: { flag: { id: "scan-ready" } },
              priority: 10,
              text: "バーコードは一度で通った。",
            },
          ],
          fallback: "バーコードを読み取った。",
        },
        recommendationOptions: [
          {
            id: "option-gum",
            itemId: "gum",
            label: "ガム",
            description: "小袋のガム。",
            resultCopy: copy("ガムを添えた。"),
          },
        ],
        outcomes: {
          sell: { id: "outcome-sell", effects: [], copy: copy("商品を売った。") },
          refuse: { id: "outcome-refuse", effects: [], copy: copy("販売を断った。") },
          defaultRecommend: {
            id: "outcome-default-recommend",
            effects: [],
            copy: copy("ガムをおすすめした。"),
          },
        },
      },
    ],
    recommendationPairs: [makePair()],
    dayPlans: [
      {
        day: 1,
        revenueTarget: 500,
        slots: [
          {
            id: "slot-1",
            candidates: [{ encounterId: "encounter-1", conditions: always, priority: 1 }],
            fallbackEncounterId: "encounter-1",
          },
        ],
        presentation: {
          day: 1,
          briefing: {
            eyebrow: "DAY 1",
            heading: "いつもの夜",
            body: "店長から申し送りを受けた。",
            checklist: ["商品を確認する"],
          },
          shiftSummary: {
            heading: "勤務終了",
            body: "レシートを確認する。",
            nextAction: "ニュースを開く",
          },
        },
      },
    ],
    day5Convergence: {
      day: 5,
      finalQueueIndex: 5,
      successfulSaleAxisBonus: 2,
      refusalStabilityDelta: -2,
      refusalFlagId: "convergence_refused",
    },
  };
}

function cloneContent(): Record<string, unknown> {
  return structuredClone(makeContent()) as unknown as Record<string, unknown>;
}

describe("Task 4 authored content contracts", () => {
  it("parses a valid assembled shape with a top-level domain recommendation pair", () => {
    const result = AuthoredContentSchema.safeParse(makeContent());

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.recommendationPairs).toHaveLength(1);
      expect(result.data.recommendationPairs[0].outcome).toEqual({
        id: "pair-gum-outcome",
        effects: [{ kind: "add", target: "stability", amount: 1 }],
      });
      expect(result.data.items[2]).toMatchObject({
        kind: "abnormal",
        axis: "undead",
        anomalyRole: "base",
      });
      expect(result.data.dayPlans[0].revenueTarget).toBe(500);
      expect(result.data.day5Convergence).toEqual({
        day: 5,
        finalQueueIndex: 5,
        successfulSaleAxisBonus: 2,
        refusalStabilityDelta: -2,
        refusalFlagId: "convergence_refused",
      });
    }

    const pairCopy = cloneContent();
    const pairCopyList = pairCopy.recommendationPairs as Array<Record<string, unknown>>;
    const pairOutcome = pairCopyList[0].outcome as Record<string, unknown>;
    pairOutcome.copy = copy("pair prose must remain local");
    expect(AuthoredContentSchema.safeParse(pairCopy).success).toBe(false);
  });

  it("requires all encounter outcomes, complete copy, and at least one option", () => {
    const missingOutcome = cloneContent();
    const encounters = missingOutcome.encounters as Array<Record<string, unknown>>;
    const outcomes = encounters[0].outcomes as Record<string, unknown>;
    delete outcomes.refuse;
    expect(AuthoredContentSchema.safeParse(missingOutcome).success).toBe(false);

    const missingCopy = cloneContent();
    const missingCopyEncounters = missingCopy.encounters as Array<Record<string, unknown>>;
    const missingCopyOutcomes = missingCopyEncounters[0].outcomes as Record<string, unknown>;
    const sell = missingCopyOutcomes.sell as Record<string, unknown>;
    const sellCopy = sell.copy as Record<string, unknown>;
    delete sellCopy.receipt;
    expect(AuthoredContentSchema.safeParse(missingCopy).success).toBe(false);

    const emptyOptions = cloneContent();
    const emptyOptionEncounters = emptyOptions.encounters as Array<Record<string, unknown>>;
    emptyOptionEncounters[0].recommendationOptions = [];
    expect(AuthoredContentSchema.safeParse(emptyOptions).success).toBe(false);
  });

  it("keeps recommendation pairs top-level and validates references and ambiguity", () => {
    const embeddedPair = cloneContent();
    const embeddedEncounters = embeddedPair.encounters as Array<Record<string, unknown>>;
    embeddedEncounters[0].recommendationPairs = [makePair()];
    expect(AuthoredContentSchema.safeParse(embeddedPair).success).toBe(false);

    const unknownReference = cloneContent();
    const unknownPairs = unknownReference.recommendationPairs as Array<Record<string, unknown>>;
    unknownPairs[0].recommendedItemId = "missing-item";
    expect(AuthoredContentSchema.safeParse(unknownReference).success).toBe(false);

    const missingMatchingOption = cloneContent();
    const missingOptionPairs = missingMatchingOption.recommendationPairs as Array<Record<string, unknown>>;
    missingOptionPairs[0].recommendedItemId = "raw-rice-ball";
    expect(AuthoredContentSchema.safeParse(missingMatchingOption).success).toBe(false);

    const ambiguous = cloneContent();
    const ambiguousPairs = ambiguous.recommendationPairs as Array<Record<string, unknown>>;
    ambiguousPairs.push({ ...ambiguousPairs[0], id: "pair-gum-duplicate-triple" });
    expect(AuthoredContentSchema.safeParse(ambiguous).success).toBe(false);
  });

  it("rejects invalid item classifications, missing customer roles, and day-plan invariants", () => {
    const ordinaryWithAxis = cloneContent();
    const ordinaryItems = ordinaryWithAxis.items as Array<Record<string, unknown>>;
    ordinaryItems[0].axis = "undead";
    expect(AuthoredContentSchema.safeParse(ordinaryWithAxis).success).toBe(false);

    const abnormalWithoutAxis = cloneContent();
    const abnormalItems = abnormalWithoutAxis.items as Array<Record<string, unknown>>;
    delete abnormalItems[2].axis;
    expect(AuthoredContentSchema.safeParse(abnormalWithoutAxis).success).toBe(false);

    const abnormalWithInvalidRole = cloneContent();
    const invalidRoleItems = abnormalWithInvalidRole.items as Array<Record<string, unknown>>;
    invalidRoleItems[2].anomalyRole = "ordinary";
    expect(AuthoredContentSchema.safeParse(abnormalWithInvalidRole).success).toBe(false);

    const missingCustomerRole = cloneContent();
    const customers = missingCustomerRole.customers as Array<Record<string, unknown>>;
    delete customers[0].role;
    expect(AuthoredContentSchema.safeParse(missingCustomerRole).success).toBe(false);

    const mismatchedPresentation = cloneContent();
    const mismatchedPlans = mismatchedPresentation.dayPlans as Array<Record<string, unknown>>;
    const presentation = mismatchedPlans[0].presentation as Record<string, unknown>;
    presentation.day = 2;
    expect(AuthoredContentSchema.safeParse(mismatchedPresentation).success).toBe(false);

    const invalidRevenueTarget = cloneContent();
    const invalidRevenuePlans = invalidRevenueTarget.dayPlans as Array<Record<string, unknown>>;
    invalidRevenuePlans[0].revenueTarget = -1;
    expect(AuthoredContentSchema.safeParse(invalidRevenueTarget).success).toBe(false);
  });

  it("requires non-empty briefing checklists and closed authored data", () => {
    const emptyChecklist = cloneContent();
    const plans = emptyChecklist.dayPlans as Array<Record<string, unknown>>;
    const emptyBriefingPresentation = plans[0].presentation as Record<string, unknown>;
    const briefing = emptyBriefingPresentation.briefing as Record<string, unknown>;
    briefing.checklist = [];
    expect(AuthoredContentSchema.safeParse(emptyChecklist).success).toBe(false);

    const unknownField = cloneContent();
    const items = unknownField.items as Array<Record<string, unknown>>;
    items[0].arbitraryPath = "state.world.machine";
    expect(AuthoredContentSchema.safeParse(unknownField).success).toBe(false);

    expect(
      NarrativeVariantSchema.safeParse({
        id: "bad-condition",
        condition: { numeric: { reference: "state.hidden", operator: "eq", value: 1 } },
        priority: 1,
        text: "not valid",
      }).success,
    ).toBe(false);
    expect(
      ConditionalNarrativeSchema.safeParse({ variants: [], fallback: "ok", extra: true }).success,
    ).toBe(false);
  });

  it("uses dynamic Day 5 convergence metadata without static final references", () => {
    const oldStaticFields = cloneContent();
    const oldStaticConvergence = oldStaticFields.day5Convergence as Record<string, unknown>;
    oldStaticConvergence.anomalyOrder = [];
    oldStaticConvergence.finalSlotId = "slot-1";
    oldStaticConvergence.finalEncounterId = "encounter-1";
    expect(AuthoredContentSchema.safeParse(oldStaticFields).success).toBe(false);

    const negativeIndex = cloneContent();
    const negativeConvergence = negativeIndex.day5Convergence as Record<string, unknown>;
    negativeConvergence.finalQueueIndex = -1;
    expect(AuthoredContentSchema.safeParse(negativeIndex).success).toBe(false);

    const fractionalIndex = cloneContent();
    const fractionalConvergence = fractionalIndex.day5Convergence as Record<string, unknown>;
    fractionalConvergence.finalQueueIndex = 1.5;
    expect(AuthoredContentSchema.safeParse(fractionalIndex).success).toBe(false);

    const blankFlag = cloneContent();
    const blankFlagConvergence = blankFlag.day5Convergence as Record<string, unknown>;
    blankFlagConvergence.refusalFlagId = "   ";
    expect(AuthoredContentSchema.safeParse(blankFlag).success).toBe(false);
  });

  it("resolves applicable variants by priority, stable ID, and required fallback", () => {
    const narrative: ConditionalNarrative = {
      variants: [
        { id: "z-last", condition: always, priority: 5, text: "z" },
        { id: "a-first", condition: always, priority: 5, text: "a" },
        { id: "high", condition: { flag: { id: "ready" } }, priority: 10, text: "high" },
      ],
      fallback: "fallback",
    };
    const state = createInitialGameState({ runId: "task4-test", contentVersion: "task4" });

    expect(resolveNarrative(narrative, state)).toBe("a");
    expect(resolveNarrative(narrative, { ...state, flags: ["ready"] })).toBe("high");
    expect(
      resolveNarrativeVariant(
        {
          variants: [
            { id: "never", condition: { flag: { id: "missing" } }, priority: 100, text: "never" },
          ],
          fallback: "fallback",
        },
        state,
      ).text,
    ).toBe("fallback");
  });
});
