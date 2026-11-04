import { gemoji } from "gemoji";

// shortcode name -> unicode emoji (github/slack style names)
const BY_NAME = new Map<string, string>();
for (const e of gemoji) for (const n of e.names) BY_NAME.set(n, e.emoji);

// slack often uses the unicode description as the name ("thinking face" -> thinking_face)
for (const e of gemoji) {
  const n = e.description.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
  if (n && !BY_NAME.has(n)) BY_NAME.set(n, e.emoji);
}

// slack-only aliases that neither gemoji names nor descriptions cover
const ALIASES: Record<string, string> = {
  thumbsup_all: "👍", simple_smile: "🙂",
  large_green_circle: "🟢", large_yellow_circle: "🟡", large_orange_circle: "🟠", large_purple_circle: "🟣",
  large_brown_circle: "🟤", large_green_square: "🟩", large_yellow_square: "🟨", large_red_square: "🟥",
  large_orange_square: "🟧", large_blue_square: "🟦", large_purple_square: "🟪",
};

// :name: optionally followed by a slack skin tone like :skin-tone-2:
const SHORTCODE = /:([a-z0-9_+-]+):(?::skin-tone-[2-6]:)?/gi;

// same names with "_" and "-" removed, so star-struck / face_palm match star_struck / facepalm
const squash = (n: string) => n.replace(/[_-]/g, "");
const BY_SQUASHED = new Map<string, string>();
for (const [n, e] of [...Object.entries(ALIASES), ...BY_NAME]) if (!BY_SQUASHED.has(squash(n))) BY_SQUASHED.set(squash(n), e);
// slack names that are spelled differently, not just punctuated differently
const EXTRA: Record<string, string> = { hugging_face: "🤗", grinning_face_with_star_eyes: "🤩" };

// look a shortcode name up: exact, slack alias, then punctuation-insensitive
function lookup(name: string) {
  const n = name.toLowerCase();
  return BY_NAME.get(n) ?? ALIASES[n] ?? EXTRA[n] ?? BY_SQUASHED.get(squash(n));
}

// replace known shortcodes in plain text; unknown ones (custom slack emoji) stay as-is
function decodePlain(s: string) {
  return s.replace(SHORTCODE, (m, name: string) => lookup(name) ?? m);
}

// decode :emoji: shortcodes in markdown, leaving fenced and inline code untouched
export function decodeEmoji(md: string) {
  if (!md.includes(":")) return md;
  return md
    .split(/(```[\s\S]*?```|`[^`\n]*`)/g)
    .map((part, i) => (i % 2 ? part : decodePlain(part)))
    .join("");
}
