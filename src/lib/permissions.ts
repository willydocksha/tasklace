// shared (server + browser) rules for who may do what on a board

// roles, from most to least powerful; viewers can only look (and maybe comment)
export const ROLES = ["owner", "admin", "member", "viewer"] as const;
export type Role = (typeof ROLES)[number];
export const ROLE_LABEL: Record<Role, string> = { owner: "Owner", admin: "Admin", member: "Member", viewer: "Viewer" };
export const isAdminRole = (role: string | null | undefined) => role === "owner" || role === "admin";

// a team's policy for its plain members (owners and admins can always do everything)
export type TeamPolicy = {
  // create new boards inside the team
  createBoard: "admin" | "member";
  // create cards on the team's boards
  createCard: "admin" | "member";
  // edit, move and delete cards: everyone, only cards they made or are assigned to, or admins only
  editCard: "admin" | "own" | "member";
  // lists, labels and sprints
  manageBoard: "admin" | "member";
  // viewers may write comments
  viewerComment: boolean;
};

export const DEFAULT_POLICY: TeamPolicy = { createBoard: "admin", createCard: "member", editCard: "member", manageBoard: "member", viewerComment: true };

// read a stored policy, keeping only known values
export function policyOf(raw: unknown): TeamPolicy {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const pick = <T extends string>(v: unknown, ok: readonly T[], d: T) => (ok.includes(v as T) ? (v as T) : d);
  return {
    createBoard: pick(r.createBoard, ["admin", "member"], DEFAULT_POLICY.createBoard),
    createCard: pick(r.createCard, ["admin", "member"], DEFAULT_POLICY.createCard),
    editCard: pick(r.editCard, ["admin", "own", "member"], DEFAULT_POLICY.editCard),
    manageBoard: pick(r.manageBoard, ["admin", "member"], DEFAULT_POLICY.manageBoard),
    viewerComment: typeof r.viewerComment === "boolean" ? r.viewerComment : DEFAULT_POLICY.viewerComment,
  };
}

// what the current user may do on one board
export type Perms = {
  admin: boolean;
  createCard: boolean;
  editCard: "all" | "own" | "none";
  // lists, labels, sprints
  structure: boolean;
  comment: boolean;
};

const EDIT_RANK = { none: 0, own: 1, all: 2 } as const;

// combine every way a user reaches a board (direct membership, each team) into the most generous rights
export function permsFrom(rows: { role: string; permissions: unknown | null; team_id: string | null }[]): Perms {
  const p: Perms = { admin: false, createCard: false, editCard: "none", structure: false, comment: false };
  for (const r of rows) {
    // direct board members follow the default policy
    const pol = r.team_id ? policyOf(r.permissions) : { ...DEFAULT_POLICY, createCard: "member", editCard: "member", manageBoard: "member" };
    let one: Perms;
    if (isAdminRole(r.role)) one = { admin: true, createCard: true, editCard: "all", structure: true, comment: true };
    else if (r.role === "viewer") one = { admin: false, createCard: false, editCard: "none", structure: false, comment: pol.viewerComment };
    else
      one = {
        admin: false,
        createCard: pol.createCard === "member",
        editCard: pol.editCard === "member" ? "all" : pol.editCard === "own" ? "own" : "none",
        structure: pol.manageBoard === "member",
        comment: true,
      };
    p.admin ||= one.admin;
    p.createCard ||= one.createCard;
    p.structure ||= one.structure;
    p.comment ||= one.comment;
    if (EDIT_RANK[one.editCard] > EDIT_RANK[p.editCard]) p.editCard = one.editCard;
  }
  return p;
}

// "own" means the user created the card or is assigned to it
export function canEditCard(p: Perms, card: { created_by: string | null; assignees: string[] }, userId: string) {
  return p.editCard === "all" || (p.editCard === "own" && (card.created_by === userId || card.assignees.includes(userId)));
}

// may this team role create boards in the team
export const canCreateTeamBoard = (role: string, policy: TeamPolicy) => isAdminRole(role) || (role === "member" && policy.createBoard === "member");
