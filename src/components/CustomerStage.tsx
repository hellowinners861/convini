import { useEffect, useState } from "react";
import { getCustomerPresentationAsset } from "../content/presentationAssets";
import styles from "./CustomerStage.module.css";

interface CustomerStageProps {
  customerId: string;
  name: string;
}

export function CustomerStage({ customerId, name }: CustomerStageProps) {
  const asset = getCustomerPresentationAsset(customerId);
  const assetSource = asset?.src;
  const [imageAvailable, setImageAvailable] = useState(Boolean(assetSource));

  useEffect(() => {
    setImageAvailable(Boolean(assetSource));
  }, [assetSource]);

  return (
    <figure className={styles.stage} aria-label={`${name}の来店者ビジュアル`}>
      <div className={styles.portrait}>
        {imageAvailable && assetSource ? (
          <img
            className={styles.image}
            src={assetSource}
            alt={asset?.alt ?? ""}
            onError={() => setImageAvailable(false)}
          />
        ) : (
          <div className={styles.fallback} aria-hidden="true">
            <span className={styles.halo} />
            <span className={styles.head} />
            <span className={styles.hair} />
            <span className={styles.shoulders} />
            <span className={styles.coat} />
            <span className={styles.badge} />
          </div>
        )}
      </div>
      <figcaption className={styles.caption}>
        <span className={styles.captionLabel}>来店者</span>
        <strong>接客中</strong>
      </figcaption>
    </figure>
  );
}
