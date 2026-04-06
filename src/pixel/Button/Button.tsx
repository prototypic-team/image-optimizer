import { Component, JSX, Show, splitProps } from "solid-js";

import { cn } from "../cn";
import { focusPropsNames, useFocus } from "../hooks/focusVisible";
import { Loader } from "../Loader/Loader";
import styles from "./Button.module.css";

type ButtonProps = MergeWithPriority<
  {
    /**
     * Renders button in a loading state: disabled and with a loader
     * instead of the button text
     */
    loading?: boolean;

    /**
     * Visual style of the button
     */
    kind?: "default" | "primary" | "secondary";
  },
  Omit<JSX.ButtonHTMLAttributes<HTMLButtonElement>, "classList">
>;

export const Button: Component<ButtonProps> = (props) => {
  const [local, focus, other] = splitProps(
    props,
    ["kind", "children", "class", "disabled", "loading", "type"],
    focusPropsNames
  );

  const { focusVisible, props: focusProps } = useFocus(focus);
  return (
    <button
      class={cn(styles.button, styles[local.kind || "default"], local.class)}
      data-focus-visible={focusVisible()}
      disabled={local.disabled || local.loading}
      type={local.type || "button"}
      {...focusProps}
      {...other}
    >
      <span class={cn(styles.inner, local.loading && styles.hidden)}>
        {local.children}
      </span>
      <Show when={local.loading}>
        <Loader class={styles.loader} />
      </Show>
    </button>
  );
};
