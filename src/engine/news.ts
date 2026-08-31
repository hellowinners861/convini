import { NEWS_ROLES, NEWS_SELECTION_COUNT, NEWS_SLOTS } from "../domain/constants";
import type {
  GameState,
  NewsArticle,
  NewsReadResult,
  NewsSelection,
} from "../domain/types";
import type { NewsSlot } from "../domain/constants";
import { evaluateCondition } from "./conditions";
import { applyEffects } from "./effects";
import { selectBestByPriorityThenId } from "./selection";
import { validateNewsCatalog, ContentValidationError } from "./validation";

function allowedRolesForSlot(day: GameState["day"], slot: NewsSlot): readonly string[] {
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

export function selectNewsForDay(
  day: GameState["day"],
  articles: NewsArticle[],
  dayStartState: GameState,
): NewsSelection[] {
  validateNewsCatalog(articles, [day]);
  const selectedArticles: NewsArticle[] = [];
  const selections: NewsSelection[] = [];

  for (const slot of NEWS_SLOTS) {
    const allowedRoles = allowedRolesForSlot(day, slot);
    const candidates = articles.filter(
      (article) =>
        article.day === day &&
        allowedRoles.includes(article.role) &&
        !dayStartState.seenNews.includes(article.id) &&
        !selectedArticles.some((selected) => selected.id === article.id) &&
        !hasExclusiveConflict(article, selectedArticles) &&
        evaluateCondition(article.conditions, dayStartState),
    );
    const selected = selectBestByPriorityThenId(candidates);

    if (!selected) {
      throw new ContentValidationError("Unable to fill news slot", [`day ${day} slot ${slot}`]);
    }

    selectedArticles.push(selected);
    selections.push({ day, slot, newsId: selected.id });
  }

  return selections;
}

export function commitNewsSelections(
  state: GameState,
  selections: NewsSelection[],
): GameState {
  if (selections.length !== NEWS_SELECTION_COUNT) {
    throw new ContentValidationError("News selection must contain three slots", [
      `received ${selections.length}`,
    ]);
  }

  const selectedSlots = new Set<NewsSlot>();
  const selectedIds = new Set<string>();
  for (const selection of selections) {
    if (selection.day !== state.day) {
      throw new ContentValidationError("News selection day mismatch", [selection.newsId]);
    }
    if (selectedSlots.has(selection.slot) || selectedIds.has(selection.newsId)) {
      throw new ContentValidationError("Duplicate news selection", [selection.newsId]);
    }
    selectedSlots.add(selection.slot);
    selectedIds.add(selection.newsId);
    if (state.seenNews.includes(selection.newsId)) {
      throw new ContentValidationError("News was already seen", [selection.newsId]);
    }
  }

  if (selectedSlots.size !== NEWS_SELECTION_COUNT || NEWS_SLOTS.some((slot) => !selectedSlots.has(slot))) {
    throw new ContentValidationError("News selection must contain direct, trend and discrepancy", [
      ...selectedSlots,
    ]);
  }

  if (state.newsSelections.some((selection) => selection.day === state.day)) {
    throw new ContentValidationError("News selections for this day are already committed", [
      `day ${state.day}`,
    ]);
  }

  return {
    ...state,
    seenNews: [...state.seenNews, ...selectedIds],
    newsSelections: [
      ...state.newsSelections,
      ...selections.map((selection) => ({ ...selection })),
    ],
  };
}

export function getCommittedNewsSelections(state: GameState): NewsSelection[] {
  return state.newsSelections
    .filter((selection) => selection.day === state.day)
    .map((selection) => ({ ...selection }));
}

export function isNewsArticleSelected(state: GameState, article: NewsArticle): boolean {
  return (
    article.day === state.day &&
    getCommittedNewsSelections(state).some((selection) => selection.newsId === article.id)
  );
}

export function canAdvanceAfterNews(state: GameState): boolean {
  const selections = getCommittedNewsSelections(state);
  if (selections.length !== NEWS_SELECTION_COUNT) {
    return false;
  }

  const selectedSlots = new Set(selections.map((selection) => selection.slot));
  const selectedIds = new Set(selections.map((selection) => selection.newsId));
  if (
    selectedSlots.size !== NEWS_SELECTION_COUNT ||
    selectedIds.size !== NEWS_SELECTION_COUNT ||
    NEWS_SLOTS.some((slot) => !selectedSlots.has(slot))
  ) {
    return false;
  }

  return selections.every((selection) => state.readNews.includes(selection.newsId));
}

export function assertNewsProgressionAllowed(state: GameState): void {
  if (!canAdvanceAfterNews(state)) {
    const unreadCount = getCommittedNewsSelections(state).filter(
      (selection) => !state.readNews.includes(selection.newsId),
    ).length;
    throw new ContentValidationError("News progression requires all three selected articles", [
      `unread ${unreadCount}`,
    ]);
  }
}

export function readNewsArticle(state: GameState, article: NewsArticle): NewsReadResult {
  if (!isNewsArticleSelected(state, article)) {
    throw new ContentValidationError("News article was not selected for this day", [article.id]);
  }

  if (state.readNews.includes(article.id)) {
    return { state, applied: false };
  }

  const next = applyEffects(state, article.effectsOnRead);
  return {
    state: {
      ...next,
      readNews: [...next.readNews, article.id],
    },
    applied: true,
  };
}

export { NEWS_ROLES };
