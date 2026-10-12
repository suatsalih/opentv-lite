/*
 * This file is part of OpenTV Lite.
 * Copyright (C) 2026 The OpenTV Contributors
 * Licensed under the GNU General Public License v3.0 or later.
 */
import { useEffect, useState } from "preact/hooks";
import { t } from "../i18n";
import { clampIndex, useKeys } from "../nav/keys";
import { stopPlayback } from "../player/session";
import { refreshSource, removeSource, useAppData } from "../state";
import type { Screen } from "./App";
import { IconAdd, IconDelete, IconInfo, IconRefresh } from "./icons";
import { Rail, RAIL_ITEMS } from "./Rail";

type Action = "refresh" | "remove";
const ACTIONS: Action[] = ["refresh", "remove"];

export function Settings({ onNavigate }: { onNavigate(screen: Screen): void }) {
  const data = useAppData();
  const [zone, setZone] = useState<"rail" | "list">("list");
  const [railIndex, setRailIndex] = useState(1);
  const [focus, setFocus] = useState(0);
  const [action, setAction] = useState(0);
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null);

  // Rows: each provider, then "Add a provider", then "About".
  const count = data.sources.length + 2;
  const addIndex = data.sources.length;
  const aboutIndex = data.sources.length + 1;

  // Settings has no preview window, so nothing should keep playing behind it.
  useEffect(() => stopPlayback(), []);

  useKeys((key) => {
    if (zone === "rail") {
      if (key === "up") setRailIndex((i) => clampIndex(i - 1, RAIL_ITEMS.length));
      else if (key === "down") setRailIndex((i) => clampIndex(i + 1, RAIL_ITEMS.length));
      else if (key === "right") setZone("list");
      else if (key === "back") onNavigate("live");
      else if (key === "ok") {
        const target = RAIL_ITEMS[railIndex].id;
        if (target === "settings") setZone("list");
        else onNavigate(target);
      }
      return;
    }
    if (key === "up") {
      setFocus((i) => clampIndex(i - 1, count));
      setConfirmRemove(null);
    } else if (key === "down") {
      setFocus((i) => clampIndex(i + 1, count));
      setConfirmRemove(null);
    } else if (key === "left") {
      if (focus < addIndex && action > 0) setAction(action - 1);
      else {
        setRailIndex(1);
        setZone("rail");
      }
    } else if (key === "right") {
      if (focus < addIndex) setAction(clampIndex(action + 1, ACTIONS.length));
    } else if (key === "back") onNavigate("live");
    else if (key === "ok") {
      if (focus === addIndex) onNavigate("add");
      else if (focus === aboutIndex) onNavigate("about");
      else {
        const source = data.sources[focus];
        if (!source) return;
        if (ACTIONS[action] === "refresh") refreshSource(source.id).catch(() => undefined);
        else if (confirmRemove === source.id) {
          removeSource(source.id);
          setConfirmRemove(null);
          setAction(0);
          setFocus((i) => clampIndex(i, count - 1));
        } else setConfirmRemove(source.id);
      }
    } else return false;
  });

  return (
    <div class="screen settings">
      <Rail current="settings" focusIndex={zone === "rail" ? railIndex : null} />
      <section class="settings-body">
        <h1 class="screen-title">{t("settings_title")}</h1>
        <h2 class="section-title">{t("settings_providers")}</h2>
        {data.sources.map((s, i) => {
          const catalog = data.catalogs[s.id];
          const status = data.loading[s.id]
            ? t("add_connecting")
            : data.errors[s.id]
              ? data.errors[s.id]
              : catalog
                ? t("settings_channels", { count: catalog.channels.length })
                : t("settings_never_synced");
          const rowFocused = zone === "list" && focus === i;
          return (
            <div key={s.id} class={"card provider" + (rowFocused ? " row-focused" : "")}>
              <div class="provider-text">
                <div class="card-title">{s.name}</div>
                <div class={"card-sub" + (data.errors[s.id] ? " error" : "")}>
                  {s.kind === "xtream" ? "Xtream Codes" : "M3U"} · {status}
                </div>
                {confirmRemove === s.id && <div class="card-sub warn">{t("settings_remove_confirm", { name: s.name })}</div>}
              </div>
              <div class={"pill" + (rowFocused && action === 0 ? " focused" : "")}>
                <IconRefresh size={36} /> {t("settings_refresh")}
              </div>
              <div class={"pill danger" + (rowFocused && action === 1 ? " focused" : "")}>
                <IconDelete size={36} /> {t("settings_remove")}
              </div>
            </div>
          );
        })}
        <div class={"card action" + (zone === "list" && focus === addIndex ? " focused" : "")}>
          <IconAdd size={44} />
          <span class="card-title">{t("settings_add_provider")}</span>
        </div>
        <div class={"card action" + (zone === "list" && focus === aboutIndex ? " focused" : "")}>
          <IconInfo size={44} />
          <span class="card-title">{t("settings_about")}</span>
        </div>
      </section>
    </div>
  );
}
