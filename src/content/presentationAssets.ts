export interface PresentationAsset {
  readonly src?: string;
  readonly alt?: string;
  readonly accent?: string;
}

/**
 * Presentation-only asset slots. Content IDs remain the sole lookup key so a
 * later image can be added without changing any screen layout.
 */
export const CUSTOMER_PRESENTATION_ASSETS: Readonly<Record<string, PresentationAsset>> =
  Object.freeze({});

export const ITEM_PRESENTATION_ASSETS: Readonly<Record<string, PresentationAsset>> =
  Object.freeze({});

export function getCustomerPresentationAsset(contentId: string): PresentationAsset | undefined {
  return CUSTOMER_PRESENTATION_ASSETS[contentId];
}

export function getItemPresentationAsset(contentId: string): PresentationAsset | undefined {
  return ITEM_PRESENTATION_ASSETS[contentId];
}
