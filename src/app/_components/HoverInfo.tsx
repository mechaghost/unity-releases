"use client";

import * as HoverCard from "@radix-ui/react-hover-card";
import type { ReactNode } from "react";

/**
 * Rich hover popover primitive. Server-renderable parents pass arbitrary
 * JSX as `content` — links, badges, lists are all fair game. Radix
 * handles viewport-edge collision, focus accessibility, and the
 * open/close timing.
 *
 * Standard layout for the content card:
 *   - `title`    — single short string, bold
 *   - `body`     — JSX with the explanation; can include <code>, lists, links
 *   - `footer`   — optional secondary line (drilldown link, citation, formula)
 *
 * Callers can also pass `content` directly for fully-custom layouts.
 */
export function HoverInfo({
  children,
  content,
  title,
  body,
  footer,
  openDelay = 180,
  closeDelay = 80,
  side = "top",
  align = "center",
  asChild = false
}: {
  children: ReactNode;
  /** Fully-custom content. If provided, title/body/footer are ignored. */
  content?: ReactNode;
  title?: ReactNode;
  body?: ReactNode;
  footer?: ReactNode;
  openDelay?: number;
  closeDelay?: number;
  side?: "top" | "bottom" | "left" | "right";
  align?: "start" | "center" | "end";
  /**
   * When true, props are merged onto `children` directly (no wrapper
   * span). Useful when the trigger lives inside SVG (or anywhere a
   * `<span>` wrapper would be invalid). The single child must accept
   * event handlers and a ref.
   */
  asChild?: boolean;
}) {
  const trigger = asChild ? (
    <HoverCard.Trigger asChild>{children}</HoverCard.Trigger>
  ) : (
    <HoverCard.Trigger asChild>
      <span className="hover-info__trigger" tabIndex={0}>
        {children}
      </span>
    </HoverCard.Trigger>
  );
  return (
    <HoverCard.Root openDelay={openDelay} closeDelay={closeDelay}>
      {trigger}
      <HoverCard.Portal>
        <HoverCard.Content
          className="hover-info"
          side={side}
          align={align}
          sideOffset={8}
          collisionPadding={16}
        >
          {content ?? (
            <>
              {title ? <div className="hover-info__title">{title}</div> : null}
              {body ? <div className="hover-info__body">{body}</div> : null}
              {footer ? <div className="hover-info__footer">{footer}</div> : null}
            </>
          )}
          <HoverCard.Arrow className="hover-info__arrow" />
        </HoverCard.Content>
      </HoverCard.Portal>
    </HoverCard.Root>
  );
}
