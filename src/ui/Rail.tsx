/*
 * This file is part of OpenTV Lite.
 * Copyright (C) 2026 The OpenTV Contributors
 * Licensed under the GNU General Public License v3.0 or later.
 */
import { t } from "../i18n";
import { IconLiveTv, IconSettings, Logo } from "./icons";

export type RailTarget = "live" | "settings";

export const RAIL_ITEMS: { id: RailTarget; label: () => string; Icon: typeof IconLiveTv }[] = [
  { id: "live", label: () => t("nav_live"), Icon: IconLiveTv },
  { id: "settings", label: () => t("nav_settings"), Icon: IconSettings },
];

/** The narrow icon rail on the left of every main screen, as in OpenTV. */
export function Rail({ current, focusIndex }: { current: RailTarget; focusIndex: number | null }) {
  return (
    <nav class="rail">
      <div class="rail-logo">
        <Logo size={64} />
      </div>
      {RAIL_ITEMS.map((item, i) => (
        <div
          key={item.id}
          class={
            "rail-item" + (item.id === current ? " current" : "") + (focusIndex === i ? " focused" : "")
          }
          aria-label={item.label()}
        >
          <item.Icon size={52} />
        </div>
      ))}
      {focusIndex !== null && <div class="rail-label">{RAIL_ITEMS[focusIndex].label()}</div>}
    </nav>
  );
}
