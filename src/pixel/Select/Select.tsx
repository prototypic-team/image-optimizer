import { type Component, splitProps } from "solid-js";
import { JSX } from "solid-js/jsx-runtime";

import { cn } from "../cn";
import { focusPropsNames, useFocus } from "../hooks/focusVisible";
import { Icon } from "../icons/Icons";
import styles from "./Select.module.css";

declare module "solid-js" {
  namespace JSX {
    interface IntrinsicElements {
      selectedcontent: JSX.HTMLAttributes<HTMLElement>;
    }
  }
}

export type SelectOption = {
  value: string;
  label: string;
};

type Props = MergeWithPriority<
  {
    options: SelectOption[];
    value?: string;
    onChange?: (value: string) => void;
  },
  Omit<JSX.SelectHTMLAttributes<HTMLSelectElement>, "onChange">
>;

export const Select: Component<Props> = (props) => {
  const [local, focus, rest] = splitProps(
    props,
    ["options", "value", "onChange", "class"],
    focusPropsNames
  );

  const { focusVisible, props: focusProps } = useFocus(focus);

  const handleChange = (e: Event) => {
    local.onChange?.((e.currentTarget as HTMLSelectElement).value);
  };

  return (
    <div class={cn(styles.container, local.class)}>
      <select
        {...rest}
        class={styles.select}
        data-focus-visible={focusVisible()}
        onChange={handleChange}
        {...focusProps}
      >
        {local.options.map((option) => (
          <option value={option.value} selected={option.value === local.value}>
            {option.label}
          </option>
        ))}
      </select>
      <Icon.ChevronDown class={styles.icon} />
    </div>
  );
};
