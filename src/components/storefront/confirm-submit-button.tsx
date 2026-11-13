"use client";

import type { ButtonHTMLAttributes } from "react";

export function ConfirmSubmitButton({
  message,
  onClick,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { message: string }) {
  return (
    <button
      {...props}
      onClick={(event) => {
        onClick?.(event);
        if (!event.defaultPrevented && !window.confirm(message)) {
          event.preventDefault();
        }
      }}
    />
  );
}
