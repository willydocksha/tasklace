// trello board export (json) -> the slim shape the import api accepts.
// shared by the browser (to shrink the upload) and the server (to validate it).

export type TrelloExport = {
  name: string;
  desc: string;
  background: string | null;
  lists: { id: string; name: string; pos: number; closed: boolean }[];
  labels: { id: string; name: string; color: string | null }[];
  cards: {
    id: string;
    idShort: number;
    name: string;
    desc: string;
    idList: string;
    idLabels: string[];
    idMembers: string[];
    idChecklists: string[];
    pos: number;
    closed: boolean;
    due: string | null;
    start: string | null;
    attachments: { name: string; url: string }[];
  }[];
  checklists: { id: string; name: string; pos: number; checkItems: { name: string; state: string; pos: number }[] }[];
  members: { id: string; fullName: string; username: string }[];
  comments: { idCard: string; text: string; author: string; date: string }[];
};

/* eslint-disable @typescript-eslint/no-explicit-any */
// keep only the fields tasklace uses; throws if it does not look like a trello export
export function slimTrello(raw: any): TrelloExport {
  if (!raw || typeof raw !== "object" || !Array.isArray(raw.lists) || !Array.isArray(raw.cards))
    throw new Error("File ini bukan export JSON board Trello");
  const s = (v: unknown) => (typeof v === "string" ? v : "");
  const arr = (v: unknown): any[] => (Array.isArray(v) ? v : []);
  return {
    name: s(raw.name) || "Board dari Trello",
    desc: s(raw.desc),
    background: typeof raw.prefs?.background === "string" ? raw.prefs.background : null,
    lists: arr(raw.lists).map((l) => ({ id: s(l.id), name: s(l.name), pos: Number(l.pos) || 0, closed: !!l.closed })),
    labels: arr(raw.labels).map((l) => ({ id: s(l.id), name: s(l.name), color: typeof l.color === "string" ? l.color : null })),
    cards: arr(raw.cards).map((c) => ({
      id: s(c.id),
      idShort: Number(c.idShort) || 0,
      name: s(c.name),
      desc: s(c.desc),
      idList: s(c.idList),
      idLabels: arr(c.idLabels).map(s),
      idMembers: arr(c.idMembers).map(s),
      idChecklists: arr(c.idChecklists).map(s),
      pos: Number(c.pos) || 0,
      closed: !!c.closed,
      due: typeof c.due === "string" ? c.due : null,
      start: typeof c.start === "string" ? c.start : null,
      attachments: arr(c.attachments).map((a) => ({ name: s(a.name), url: s(a.url) })).filter((a) => a.url),
    })),
    checklists: arr(raw.checklists).map((cl) => ({
      id: s(cl.id),
      name: s(cl.name),
      pos: Number(cl.pos) || 0,
      checkItems: arr(cl.checkItems).map((i) => ({ name: s(i.name), state: s(i.state), pos: Number(i.pos) || 0 })),
    })),
    members: arr(raw.members).map((m) => ({ id: s(m.id), fullName: s(m.fullName), username: s(m.username) })),
    comments: arr(raw.actions)
      .filter((a) => a?.type === "commentCard" && a.data?.card?.id)
      .map((a) => ({ idCard: s(a.data.card.id), text: s(a.data.text), author: s(a.memberCreator?.fullName), date: s(a.date) })),
  };
}
/* eslint-enable @typescript-eslint/no-explicit-any */

// trello label color names -> hex (trello's own palette)
export const TRELLO_LABEL_COLORS: Record<string, string> = {
  green: "#4bce97", yellow: "#f5cd47", orange: "#fea362", red: "#f87168", purple: "#9f8fef",
  blue: "#579dff", sky: "#6cc3e0", lime: "#94c748", pink: "#e774bb", black: "#8590a2",
  green_dark: "#1f845a", yellow_dark: "#946f00", orange_dark: "#c25100", red_dark: "#c9372c", purple_dark: "#6e5dc6",
  blue_dark: "#0c66e4", sky_dark: "#227d9b", lime_dark: "#5b7f24", pink_dark: "#ae4787", black_dark: "#626f86",
  green_light: "#baf3db", yellow_light: "#f8e6a0", orange_light: "#fedec8", red_light: "#ffd5d2", purple_light: "#dfd8fd",
  blue_light: "#cce0ff", sky_light: "#c6edfb", lime_light: "#d3f1a7", pink_light: "#fdd0ec", black_light: "#dcdfe4",
};

// trello background color names -> tasklace board colors
export const TRELLO_BOARD_COLORS: Record<string, string> = {
  blue: "blue", orange: "orange", green: "green", red: "red", purple: "purple",
  pink: "pink", lime: "forest", sky: "ocean", grey: "slate",
};
