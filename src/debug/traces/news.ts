import { NEWS_SLOTS } from "../../domain/constants";
import type { NewsRole, NewsSlot } from "../../domain/constants";
import type { GameState, NewsArticle, NewsSelection } from "../../domain/types";
import { selectNewsForDay } from "../../engine/news";
import { selectBestByPriorityThenId, sortByPriorityThenId } from "../../engine/selection";
import { traceCondition } from "./conditions";
import type {
  NewsCandidateTrace,
  NewsSlotTrace,
  NewsTrace,
  NewsTraceExclusionCode,
} from "../contracts";

function freeze<T extends object>(value: T): Readonly<T> {
  return Object.freeze(value);
}

function allowedRolesForSlot(day: GameState["day"], slot: NewsSlot): readonly NewsRole[] {
  if (day === 1 && slot === "discrepancy") {
    return ["discrepancy", "local"];
  }
  return [slot];
}

function hasExclusiveConflict(article: NewsArticle, selected: NewsArticle[]): boolean {
  return Boolean(
    article.exclusiveGroup &&
      selected.some((candidate) => candidate.exclusiveGroup === article.exclusiveGroup),
  );
}

function conditionTraceFor(
  article: NewsArticle,
  state: GameState,
  traces: Map<NewsArticle, ReturnType<typeof traceCondition>>,
): ReturnType<typeof traceCondition> {
  const existing = traces.get(article);
  if (existing) {
    return existing;
  }

  const trace = traceCondition(article.conditions, state);
  traces.set(article, trace);
  return trace;
}

function selectTraceArticle(
  day: GameState["day"],
  slot: NewsSlot,
  orderedArticles: NewsArticle[],
  dayStartState: GameState,
  selectedArticles: NewsArticle[],
  conditionTraces: Map<NewsArticle, ReturnType<typeof traceCondition>>,
): NewsArticle | undefined {
  const allowedRoles = allowedRolesForSlot(day, slot);
  const candidates = orderedArticles.filter(
    (article) =>
      article.day === day &&
      allowedRoles.includes(article.role) &&
      !dayStartState.seenNews.includes(article.id) &&
      !selectedArticles.some((selected) => selected.id === article.id) &&
      !hasExclusiveConflict(article, selectedArticles) &&
      conditionTraceFor(article, dayStartState, conditionTraces).result,
  );

  return selectBestByPriorityThenId(candidates);
}

function exclusionFor(
  article: NewsArticle,
  day: GameState["day"],
  allowedRoles: readonly NewsRole[],
  dayStartState: GameState,
  selectedArticles: NewsArticle[],
  conditionTrace: ReturnType<typeof traceCondition>,
  selected: boolean,
): NewsTraceExclusionCode | null {
  if (article.day !== day) {
    return "wrong-day";
  }
  if (!allowedRoles.includes(article.role)) {
    return "role-not-allowed";
  }
  if (dayStartState.seenNews.includes(article.id)) {
    return "already-seen";
  }
  if (selectedArticles.some((candidate) => candidate.id === article.id)) {
    return "already-selected";
  }
  if (hasExclusiveConflict(article, selectedArticles)) {
    return "exclusive-conflict";
  }
  if (!conditionTrace.result) {
    return "condition-failed";
  }
  return selected ? null : "lower-priority";
}

export function traceNewsSelection(
  day: GameState["day"],
  articles: NewsArticle[],
  dayStartState: GameState,
): NewsTrace {
  const selections = selectNewsForDay(day, articles, dayStartState);
  const orderedArticles = sortByPriorityThenId(articles);
  const conditionTraces = new Map<NewsArticle, ReturnType<typeof traceCondition>>();
  const selectedArticles: NewsArticle[] = [];
  const slots: NewsSlotTrace[] = [];

  for (const slot of NEWS_SLOTS) {
    const allowedRoles = allowedRolesForSlot(day, slot);
    const selectedId = selections.find((selection) => selection.slot === slot)!.newsId;
    const selectedArticle = selectTraceArticle(
      day,
      slot,
      orderedArticles,
      dayStartState,
      selectedArticles,
      conditionTraces,
    );
    const selectedCandidate =
      selectedArticle?.id === selectedId
        ? selectedArticle
        : orderedArticles.find(
            (article) =>
              article.id === selectedId &&
              article.day === day &&
              allowedRoles.includes(article.role),
          );

    const candidates: NewsCandidateTrace[] = orderedArticles.map((article) => {
      const conditionTrace = conditionTraceFor(article, dayStartState, conditionTraces);
      const isSelected = article === selectedCandidate;
      const exclusionCode = exclusionFor(
        article,
        day,
        allowedRoles,
        dayStartState,
        selectedArticles,
        conditionTrace,
        isSelected,
      );
      const eligibility = exclusionCode === null || exclusionCode === "lower-priority";

      return freeze({
        id: article.id,
        role: article.role,
        priority: article.priority,
        conditionTrace,
        eligibility,
        selected: isSelected,
        exclusionCode,
      });
    });

    slots.push(
      freeze({
        slot,
        allowedRoles: freeze([...allowedRoles]),
        selectedId,
        candidates: freeze(candidates),
      }),
    );

    if (selectedCandidate) {
      selectedArticles.push(selectedCandidate);
    }
  }

  const frozenSelections = freeze(
    selections.map((selection: NewsSelection) => freeze({ ...selection })),
  );

  return freeze({
    day,
    selections: frozenSelections,
    slots: freeze(slots),
  });
}

export const traceNewsForDay = traceNewsSelection;
export const traceNewsSelectionForDay = traceNewsSelection;
