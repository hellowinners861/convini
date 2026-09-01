import { useEffect, useRef, type PropsWithChildren, type ReactNode } from "react";
import styles from "./ScreenFrame.module.css";

interface ScreenFrameProps extends PropsWithChildren {
  eyebrow: string;
  heading: string;
  description?: string;
  toolbar?: ReactNode;
}

export function ScreenFrame({ eyebrow, heading, description, toolbar, children }: ScreenFrameProps) {
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    headingRef.current?.focus();
  }, [heading]);

  return (
    <main className={styles.shell}>
      <div className={styles.frame}>
        <header className={styles.header}>
          <div>
            <p className={styles.eyebrow}>{eyebrow}</p>
            <h1 ref={headingRef} tabIndex={-1} className={styles.heading}>
              {heading}
            </h1>
            {description ? <p className={styles.description}>{description}</p> : null}
          </div>
          {toolbar ? <div className={styles.toolbar}>{toolbar}</div> : null}
        </header>
        {children}
      </div>
    </main>
  );
}
