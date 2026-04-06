import { createSignal, JSX } from "solid-js";

interface UseFocusVisibleProps<T extends HTMLElement> {
  onBlur?: JSX.FocusEventHandlerUnion<T, FocusEvent>;
  onFocus?: JSX.FocusEventHandlerUnion<T, FocusEvent>;
  onPointerDown?: JSX.EventHandlerUnion<T, FocusEvent>;
  onPointerUp?: JSX.EventHandlerUnion<T, FocusEvent>;
}

export const focusPropsNames = ["onBlur", "onFocus"] as const;

let wasControlKeyPressed = false;
export const setWasControlKeyPressed = (value: boolean) => {
  wasControlKeyPressed = value;
};
const controlElements = new Set(["a", "button", "input", "select", "textarea"]);

export const handleKeyDown = (event: KeyboardEvent) => {
  switch (event.key) {
    case "Tab":
      wasControlKeyPressed = true;
      return;

    case `Enter`:
    case ` `:
      wasControlKeyPressed = controlElements.has(
        document.activeElement?.tagName?.toLowerCase() ?? ""
      );
      return;

    case "Escape":
      return;

    default:
      wasControlKeyPressed = false;
      return;
  }
};

export const useFocus = <T extends HTMLElement>(
  props?: UseFocusVisibleProps<T>
) => {
  const [focused, setFocused] = createSignal(false);
  const [focusVisible, setFocusVisible] = createSignal(false);

  const onBlur: JSX.FocusEventHandlerUnion<T, FocusEvent> = (event) => {
    if (!document.hasFocus() && focusVisible()) {
      wasControlKeyPressed = true;
    }
    setFocusVisible(false);
    setFocused(false);

    if (typeof props?.onBlur === "function") {
      props.onBlur(event);
    }
  };
  const onFocus: JSX.FocusEventHandlerUnion<T, FocusEvent> = (event) => {
    setFocused(true);
    setFocusVisible(wasControlKeyPressed);
    wasControlKeyPressed = false;

    if (typeof props?.onFocus === "function") {
      props.onFocus(event);
    }
  };

  return {
    focused,
    focusVisible,
    props: {
      onBlur,
      onFocus,
    },
  };
};
