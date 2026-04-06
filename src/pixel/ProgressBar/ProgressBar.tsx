import { Component, JSX, splitProps } from "solid-js";

import { cn } from "../cn";
import styles from "./ProgressBar.module.css";

type ProgressBarProps = MergeWithPriority<
  {
    /**
     * The progress of the progress bar. This should be a number between 0 and 1.
     */
    progress: number;
  },
  Omit<JSX.InputHTMLAttributes<HTMLDivElement>, "classList">
>;

export const ProgressBar: Component<ProgressBarProps> = (props) => {
  const [local, other] = splitProps(props, ["progress", "class"]);

  return (
    <div class={cn(styles.bar, local.class)} {...other}>
      <div class={styles.track} />
      <div
        class={styles.progress}
        style={{ width: `${local.progress * 100}%` }}
      />
    </div>
  );
};
