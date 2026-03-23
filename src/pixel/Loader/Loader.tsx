import { Component, JSX } from "solid-js";

import { cn } from "../cn";
import styles from "./Loader.module.css";

type Props = {
  appearance?: "accent" | "default";
  class?: string;
  size?: "small" | "medium" | "large";
  style?: JSX.CSSProperties;
};

export const Loader: Component<Props> = (props) => {
  const className = () =>
    cn(styles[props.appearance ?? "default"], styles[props.size ?? "medium"]);

  return (
    <div class={cn(styles.loader, props.class)} style={props.style}>
      <div class={cn(styles.dot, className())} />
      <div class={cn(styles.dot, styles.second, className())} />
      <div class={cn(styles.dot, styles.third, className())} />
    </div>
  );
};
