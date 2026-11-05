"use client";
import { AvatarCard, type Person } from "@/components/AvatarCard";
import { ROLE_LABEL, type Role } from "@/lib/permissions";
import { statusOf } from "@/lib/usePresence";
import { useBoard } from "./context";

// board member avatar with online dot and hover card; details come from the board's member list
export function MemberAvatar({ person, size, ring }: { person: Person; size?: number; ring?: boolean }) {
  const { data, presence } = useBoard();
  // people who left the board still render, just without email/role
  const m = data.members.find((x) => x.id === person.id);
  return (
    <AvatarCard
      person={person}
      size={size}
      ring={ring}
      info={{ email: m?.email, username: m?.username, role: m ? (ROLE_LABEL[m.role as Role] ?? m.role) : null, status: statusOf(presence, person.id) }}
    />
  );
}
