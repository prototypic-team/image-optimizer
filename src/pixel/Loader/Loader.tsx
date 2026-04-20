import { Component, JSX } from "solid-js";

import { cn } from "../cn";
import styles from "./Loader.module.css";

type Props = {
  class?: string;
  style?: JSX.CSSProperties;
};

export const Loader: Component<Props> = (props) => {
  return (
    <div class={cn(styles.loader, props.class)} style={props.style}>
      <div class={styles.dot} />
      <div class={cn(styles.dot, styles.second)} />
      <div class={cn(styles.dot, styles.third)} />
    </div>
  );
};
