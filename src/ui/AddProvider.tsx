/*
 * This file is part of OpenTV Lite.
 * Copyright (C) 2026 The OpenTV Contributors
 * Licensed under the GNU General Public License v3.0 or later.
 */
import { useEffect, useRef, useState } from "preact/hooks";
import { APP } from "../config";
import type { LiveFormat, Source, SourceKind } from "../data/models";
import { newId } from "../data/settings";
import { credentialsFromUrl, normaliseUrl } from "../data/sourceUrl";
import { t } from "../i18n";
import { clampIndex, useKeys } from "../nav/keys";
import { exitApp } from "../platform";
import { addSource, messageOf } from "../state";
import { Logo } from "./icons";

type Field = "kind" | "name" | "server" | "username" | "password" | "playlist" | "epg" | "format" | "buttons";

const XTREAM_FIELDS: Field[] = ["kind", "server", "username", "password", "format", "name", "epg", "buttons"];
const M3U_FIELDS: Field[] = ["kind", "playlist", "name", "epg", "buttons"];

/**
 * Adding a provider. Fields are real `<input>`s so the TV's own on-screen keyboard (and a
 * paired USB/Bluetooth keyboard) works; OK opens the keyboard, ▲▼ move between fields.
 */
export function AddProvider(props: { onboarding: boolean; onDone(): void; onCancel(): void }) {
  const [kind, setKind] = useState<SourceKind>("xtream");
  const [format, setFormat] = useState<LiveFormat>("m3u8");
  const [values, setValues] = useState<Record<string, string>>({});
  const [focus, setFocus] = useState(1);
  const [button, setButton] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputs = useRef<Record<string, HTMLInputElement | null>>({});

  const fields = kind === "xtream" ? XTREAM_FIELDS : M3U_FIELDS;
  const field = fields[clampIndex(focus, fields.length)];

  useEffect(() => {
    // Keep keyboard focus off fields the remote is not on.
    const el = document.activeElement as HTMLElement | null;
    if (el && el.tagName === "INPUT" && el !== inputs.current[field]) el.blur();
  }, [field]);

  function update(name: string, value: string) {
    setValues((prev) => ({ ...prev, [name]: value }));
  }

  /**
   * A pasted full Xtream link carries the login; save the viewer typing it on a remote. Done
   * when the field is left, not per keystroke, so a half-typed link never fills in a fragment.
   */
  function onFieldDone(name: string) {
    if (name !== "server") return;
    setValues((prev) => {
      const creds = credentialsFromUrl(prev.server || "");
      if (!creds.username && !creds.password) return prev;
      return { ...prev, username: creds.username || prev.username, password: creds.password || prev.password };
    });
  }

  async function submit() {
    if (busy) return;
    const v = (k: string) => (values[k] || "").trim();
    if (kind === "xtream" && (!v("server") || !v("username") || !v("password"))) {
      setError(t("add_missing"));
      return;
    }
    if (kind === "m3u" && !v("playlist")) {
      setError(t("add_missing_m3u"));
      return;
    }
    const url = normaliseUrl(kind === "xtream" ? v("server") : v("playlist"), kind);
    const source: Source = {
      id: newId(),
      name: v("name") || hostOf(url) || "Provider",
      kind,
      url,
      username: kind === "xtream" ? v("username") : undefined,
      password: kind === "xtream" ? v("password") : undefined,
      epgUrl: v("epg") ? normaliseUrl(v("epg"), "m3u") : undefined,
      userAgent: APP.defaultUserAgent,
      liveFormat: format,
      lastSyncMillis: 0,
    };
    setBusy(true);
    setError(null);
    try {
      await addSource(source);
      props.onDone();
    } catch (e) {
      setError(messageOf(e));
    } finally {
      setBusy(false);
    }
  }

  function move(delta: number) {
    const el = document.activeElement as HTMLElement | null;
    if (el && el.tagName === "INPUT") el.blur();
    setFocus((i) => clampIndex(i + delta, fields.length));
  }

  useKeys((key) => {
    if (busy) return;
    const editing = document.activeElement && document.activeElement.tagName === "INPUT";
    if (key === "up") move(-1);
    else if (key === "down") move(1);
    else if (key === "back") {
      if (editing) (document.activeElement as HTMLElement).blur();
      else if (props.onboarding) exitApp();
      else props.onCancel();
    } else if (key === "ok") {
      if (editing) {
        (document.activeElement as HTMLElement).blur();
        move(1);
      } else if (field === "kind") setKind(kind === "xtream" ? "m3u" : "xtream");
      else if (field === "format") setFormat(format === "m3u8" ? "ts" : "m3u8");
      else if (field === "buttons") {
        if (button === 0) submit();
        else if (props.onboarding) exitApp();
        else props.onCancel();
      } else {
        const input = inputs.current[field];
        if (input) input.focus();
      }
    } else if (key === "left" || key === "right") {
      if (editing) return false; // let the caret move
      if (field === "kind") setKind(key === "left" ? "xtream" : "m3u");
      else if (field === "format") setFormat(key === "left" ? "m3u8" : "ts");
      else if (field === "buttons") setButton(key === "left" ? 0 : 1);
      else return false;
    } else return false;
  });

  function inputRow(name: Field, label: string, type: "text" | "url" | "password" = "text", hint?: string) {
    return (
      <div class={"form-row" + (field === name ? " focused" : "")} key={name}>
        <label class="form-label">{label}</label>
        <input
          ref={(el) => {
            inputs.current[name] = el;
          }}
          class="form-input"
          // Preact narrows `type` per accessibility role; all three values are valid inputs.
          type={type as "password"}
          value={values[name] || ""}
          onInput={(e) => update(name, (e.target as HTMLInputElement).value)}
          onBlur={() => onFieldDone(name)}
          autoComplete="off"
          spellcheck={false}
        />
        {hint && field === name && <div class="form-hint">{hint}</div>}
      </div>
    );
  }

  return (
    <div class="screen add">
      <div class="add-head">
        <Logo size={88} />
        <div>
          <h1 class="screen-title">{props.onboarding ? t("onboard_title") : t("add_title")}</h1>
          {props.onboarding && <p class="add-intro">{t("onboard_body")}</p>}
        </div>
      </div>

      <div class="form">
        <div class={"form-row" + (field === "kind" ? " focused" : "")}>
          <div class="segmented">
            <span class={kind === "xtream" ? "on" : ""}>{t("add_kind_xtream")}</span>
            <span class={kind === "m3u" ? "on" : ""}>{t("add_kind_m3u")}</span>
          </div>
        </div>

        {kind === "xtream" && inputRow("server", t("add_server"), "url", t("add_server_hint"))}
        {kind === "xtream" && inputRow("username", t("add_username"))}
        {kind === "xtream" && inputRow("password", t("add_password"), "password")}
        {kind === "xtream" && (
          <div class={"form-row" + (field === "format" ? " focused" : "")}>
            <label class="form-label">{t("add_format")}</label>
            <div class="segmented">
              <span class={format === "m3u8" ? "on" : ""}>{t("add_format_hls")}</span>
              <span class={format === "ts" ? "on" : ""}>{t("add_format_ts")}</span>
            </div>
          </div>
        )}
        {kind === "m3u" && inputRow("playlist", t("add_playlist"), "url")}
        {inputRow("name", t("add_name"))}
        {inputRow("epg", t("add_epg"), "url")}

        <div class="form-row buttons">
          <div class={"button primary" + (field === "buttons" && button === 0 ? " focused" : "")}>
            {busy ? t("add_connecting") : t("add_save")}
          </div>
          <div class={"button" + (field === "buttons" && button === 1 ? " focused" : "")}>{t("add_cancel")}</div>
        </div>
        {error && <div class="form-error">{error}</div>}
      </div>
    </div>
  );
}

function hostOf(url: string): string {
  const m = /^https?:\/\/([^/:?#]+)/i.exec(url);
  return m ? m[1] : "";
}
