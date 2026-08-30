import type { Condition, Effect, NewsArticle, WorldAxis } from "../../domain";

export function leadingAxisCondition(axis: WorldAxis): Condition {
  return {
    all: [
      { leadingAxis: { axis } },
      {
        numeric: {
          reference: "axisDifference",
          operator: "gt",
          value: 0,
        },
      },
    ],
  };
}

export function newsArticle(article: Omit<NewsArticle, "effectsOnRead">): NewsArticle {
  const effects: Effect[] = [{ kind: "setFlag", id: `read_${article.id}` }];

  if (article.role === "discrepancy" || article.role === "local") {
    effects.push({ kind: "add", target: "awareness", amount: 1 });
  }

  return { ...article, effectsOnRead: effects };
}
