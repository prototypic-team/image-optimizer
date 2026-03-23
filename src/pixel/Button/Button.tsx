import { Component, JSX, splitProps } from "solid-js";

import { cn } from "../cn";
import { Loader } from "../Loader/Loader";
import styles from "./Button.module.css";

type ButtonProps = MergeWithPriority<
  {
    loading?: boolean;
    kind?: "default" | "primary";
  },
  Omit<JSX.ButtonHTMLAttributes<HTMLButtonElement>, "classList">
>;

export const Button: Component<ButtonProps> = (props) => {
  const [local, other] = splitProps(props, [
    "kind",
    "children",
    "class",
    "disabled",
    "loading",
    "type",
  ]);

  return (
    <button
      class={cn(styles.button, styles[local.kind ?? "default"], local.class)}
      disabled={local.disabled ?? local.loading}
      type={local.type ?? "button"}
      {...other}
    >
      <span class={cn(styles.inner, local.loading && styles.hidden)}>
        {local.children}
      </span>
      {local.loading && <Loader class={styles.loader} />}
    </button>
  );
};
