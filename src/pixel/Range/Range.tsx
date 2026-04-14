import { Component, createMemo, splitProps } from "solid-js";
import { JSX } from "solid-js/jsx-runtime";

import { cn } from "../cn";
import styles from "./Range.module.css";

type Props = MergeWithPriority<
  {
    value?: number;
    onChange?: (value: number) => void;
    onInput?: (value: number) => void;
  },
  Omit<JSX.InputHTMLAttributes<HTMLInputElement>, "type">
>;

export const Range: Component<Props> = (props) => {
  const [local, other] = splitProps(props, ["onChange", "onInput"]);
  const percent = createMemo(() => {
    const base =
      parseFloat(props.max?.toString() ?? "100") -
      parseFloat(props.min?.toString() ?? "0");
    const normalizedValue =
      (props.value ?? 0) - parseFloat(props.min?.toString() ?? "0");

    return Math.round((normalizedValue / base) * 100);
  });

  const onChange = (e: Event) => {
    const value = (e.currentTarget as HTMLInputElement).value;
    local.onChange?.(Number(value));
  };

  const onInput = (e: Event) => {
    const value = (e.currentTarget as HTMLInputElement).value;
    local.onInput?.(Number(value));
  };

  return (
    <div
      class={cn(styles.container, props.class)}
      style={{ "--value-percent": `${percent()}%` }}
    >
      <input
        {...other}
        type="range"
        class={styles.range}
        onChange={onChange}
        onInput={onInput}
      />
    </div>
  );
};
