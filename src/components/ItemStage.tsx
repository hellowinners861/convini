import { useEffect, useState } from "react";
import { getItemPresentationAsset } from "../content/presentationAssets";
import styles from "./ItemStage.module.css";

interface ItemStageProps {
  itemId: string;
  name: string;
  description: string;
  price: number;
}

export function ItemStage({ itemId, name, description, price }: ItemStageProps) {
  const asset = getItemPresentationAsset(itemId);
  const assetSource = asset?.src;
  const [imageAvailable, setImageAvailable] = useState(Boolean(assetSource));

  useEffect(() => {
    setImageAvailable(Boolean(assetSource));
  }, [assetSource]);

  return (
    <figure className={styles.stage} aria-label={`商品 ${name}`}>
      <div className={styles.productArt}>
        {imageAvailable && assetSource ? (
          <img
            className={styles.image}
            src={assetSource}
            alt={asset?.alt ?? ""}
            onError={() => setImageAvailable(false)}
          />
        ) : (
          <div className={styles.fallback} aria-hidden="true">
            <span className={styles.glow} />
            <span className={styles.package}>
              <span className={styles.packageTop} />
              <span className={styles.packageBand} />
              <span className={styles.packageMark} />
              <span className={styles.packageBarcode} />
            </span>
          </div>
        )}
      </div>
      <figcaption className={styles.caption}>
        <div>
          <span className={styles.captionLabel}>商品スロット</span>
          <strong>{name}</strong>
          <p>{description}</p>
        </div>
        <span className={styles.price}>{price}円</span>
      </figcaption>
    </figure>
  );
}
