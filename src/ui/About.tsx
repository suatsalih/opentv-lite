/*
 * This file is part of OpenTV Lite.
 * Copyright (C) 2026 The OpenTV Contributors
 * Licensed under the GNU General Public License v3.0 or later.
 */
import { APP } from "../config";
import { t } from "../i18n";
import { useKeys } from "../nav/keys";
import { Logo } from "./icons";
import { Qr } from "./Qr";

/** Licence, links and the donation route — the same content as OpenTV's About screen. */
export function About({ onBack }: { onBack(): void }) {
  useKeys((key) => {
    if (key === "back" || key === "ok" || key === "left") onBack();
    else return false;
  });

  return (
    <div class="screen about">
      <div class="about-head">
        <Logo size={96} />
        <div>
          <h1 class="screen-title">{t("about_title")}</h1>
          <div class="card-sub">{t("about_version", { version: APP.version })}</div>
        </div>
      </div>
      <p class="about-body">{t("about_body")}</p>

      <div class="about-columns">
        <section class="about-col">
          <h2 class="section-title">{t("about_support_title")}</h2>
          <p class="about-text">{t("about_support_body")}</p>
          <LinkLine label={t("about_donate_paypal")} value={APP.paypalEmail} />
          <div class="about-qr">
            <Qr text={APP.paypalUrl} size={300} />
            <div class="about-text">{t("about_scan_to_donate")}</div>
          </div>
        </section>
        <section class="about-col">
          <h2 class="section-title">{t("about_links_title")}</h2>
          <LinkLine label={t("about_licence")} value="GNU General Public License v3.0" />
          <LinkLine label={t("about_source")} value={APP.repo} />
          <LinkLine label={t("about_report_bug")} value={APP.issues} />
          <LinkLine label={t("about_android_app")} value={APP.installPage} />
        </section>
      </div>
    </div>
  );
}

function LinkLine({ label, value }: { label: string; value: string }) {
  return (
    <div class="link-line">
      <span class="link-label">{label}:</span> <span class="link-value">{value}</span>
    </div>
  );
}
