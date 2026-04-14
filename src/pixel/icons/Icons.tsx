import { type Component, type JSX, splitProps } from "solid-js";

import { cn } from "../cn";
import styles from "./Icons.module.css";

export type IconSvgProps = Omit<
  JSX.SvgSVGAttributes<SVGSVGElement>,
  "children"
>;

const DownloadIcon: Component<IconSvgProps> = (props) => {
  const [local, rest] = splitProps(props, ["class"]);
  return (
    <svg
      class={cn(styles.svg, local.class)}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden={true}
      {...rest}
    >
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" x2="12" y1="15" y2="3" />
    </svg>
  );
};

const ChevronDownIcon: Component<IconSvgProps> = (props) => {
  const [local, rest] = splitProps(props, ["class"]);
  return (
    <svg
      class={cn(styles.svg, local.class)}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden={true}
      {...rest}
    >
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
};

export const Icon = {
  ChevronDown: ChevronDownIcon,
  Download: DownloadIcon,
};
