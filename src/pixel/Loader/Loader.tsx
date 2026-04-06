import { Component, JSX } from "solid-js";

import { cn } from "../cn";
import styles from "./Loader.module.css";

type Props = {
  class?: string;
  size?: "small" | "medium" | "large";
  style?: JSX.CSSProperties;
};

export const Loader: Component<Props> = (props) => {
  return (
    <div class={cn(styles.loader, props.class)} style={props.style}>
      <div class={cn(styles.dot, styles[props.size ?? "medium"])} />
      <div
        class={cn(styles.dot, styles.second, styles[props.size ?? "medium"])}
      />
      <div
        class={cn(styles.dot, styles.third, styles[props.size ?? "medium"])}
      />
    </div>
  );
};
