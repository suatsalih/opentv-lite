/*
 * This file is part of OpenTV Lite.
 * Copyright (C) 2026 The OpenTV Contributors
 * Licensed under the GNU General Public License v3.0 or later.
 */
export const en = {
  nav_live: "Live TV",
  nav_settings: "Settings",

  cat_favourites: "★ Favourites",
  cat_all: "All channels",
  cat_uncategorised: "Other",

  guide_no_info: "No guide information",
  guide_next: "Next {time} {title}",
  guide_watch: "Watch",
  guide_loading: "Loading channels…",
  guide_empty_favourites: "No favourites yet. Highlight a channel and press the yellow button to add one.",
  guide_empty: "No channels in this category.",
  guide_refreshing: "Updating the guide…",

  player_loading: "Tuning…",
  player_hint: "▲▼ change channel · OK info · Back guide",

  onboard_title: "Welcome to OpenTV Lite",
  onboard_body:
    "A free, open-source IPTV player. Add the details your provider sent you. OpenTV Lite supplies no channels of its own.",
  add_title: "Add a provider",
  add_kind_xtream: "Xtream Codes login",
  add_kind_m3u: "M3U playlist link",
  add_name: "Name (optional)",
  add_server: "Server address",
  add_server_hint: "e.g. http://example.com:8080 — or paste the whole link your provider sent",
  add_username: "Username",
  add_password: "Password",
  add_playlist: "Playlist URL",
  add_epg: "Guide (XMLTV) URL — optional",
  add_format: "Live stream format",
  add_format_hls: "HLS (recommended)",
  add_format_ts: "MPEG-TS",
  add_type_hint: "Press OK to type",
  add_save: "Connect",
  add_cancel: "Cancel",
  add_connecting: "Connecting to your provider…",
  add_missing: "Fill in the server address, username and password.",
  add_missing_m3u: "Fill in the playlist URL.",

  settings_title: "Settings",
  settings_providers: "Providers",
  settings_add_provider: "Add a provider",
  settings_refresh: "Refresh channels and guide",
  settings_remove: "Remove",
  settings_remove_confirm: "Press OK again to remove {name}",
  settings_channels: "{count} channels",
  settings_never_synced: "Not loaded yet",
  settings_about: "About",

  about_title: "About OpenTV Lite",
  about_body:
    "OpenTV Lite is the big-screen edition of OpenTV for Samsung and LG TVs. It is free and open source under the GNU GPL v3 — anyone can read the code, build it and keep it alive.",
  about_support_title: "Support the project",
  about_support_body:
    "OpenTV is free and always will be — nothing is gated. If it's useful and you'd like to chip in, a one-off tip keeps the updates coming. Entirely optional, and genuinely appreciated.",
  about_donate_paypal: "Donate via PayPal",
  about_scan_to_donate: "Scan to donate",
  about_links_title: "Licence & links",
  about_licence: "Licence",
  about_source: "Source code",
  about_report_bug: "Report a bug / request a feature",
  about_android_app: "Android TV & Fire TV app",
  about_version: "Version {version}",

  exit_confirm: "Press Back again to exit",
  error_title: "Something went wrong",
  back: "Back",
};

export type Strings = typeof en;
