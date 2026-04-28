import type { LucideIcon } from "lucide-react";
import {
  Bookmark,
  BookmarkCheck,
  BriefcaseBusiness,
  CalendarDays,
  Home,
  MapPin,
  MessageSquare,
  MonitorPlay,
  Send,
  Trophy,
  Users,
} from "lucide-react";

export type MemberNavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  matches?: string[];
};

export const memberNav: MemberNavItem[] = [
  { label: "Feed", icon: Home, href: "/dashboard", matches: ["/dashboard"] },
  { label: "Members Network", icon: Users, href: "/members", matches: ["/members", "/online"] },
  { label: "Messages", icon: MessageSquare, href: "/messages", matches: ["/messages"] },
  { label: "Events", icon: CalendarDays, href: "/events", matches: ["/events"] },
  { label: "Interviews", icon: MessageSquare, href: "/interviews", matches: ["/interviews"] },
  { label: "Membership", icon: BookmarkCheck, href: "/membership", matches: ["/membership"] },
  { label: "Team", icon: Users, href: "/team", matches: ["/team"] },
  { label: "Partners", icon: BriefcaseBusiness, href: "/partners", matches: ["/partners"] },
  { label: "Contact", icon: Send, href: "/contact", matches: ["/contact"] },
  { label: "Live Matches", icon: MonitorPlay, href: "/matches", matches: ["/matches"] },
  { label: "Business Hub", icon: BriefcaseBusiness, href: "/business", matches: ["/business"] },
  { label: "Leaderboard", icon: Trophy, href: "/leaderboard", matches: ["/leaderboard"] },
  { label: "Lounge Locations", icon: MapPin, href: "/lounges", matches: ["/lounges", "/lounge"] },
  { label: "Saved", icon: Bookmark, href: "/saved", matches: ["/saved"] },
];

export function isMemberNavActive(pathname: string, item: MemberNavItem) {
  const matches = item.matches?.length ? item.matches : [item.href];
  return matches.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}
