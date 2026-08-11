import {
  Activity,
  BarChart3,
  Bot,
  FileText,
  LayoutDashboard,
  Mailbox,
  Megaphone,
  Settings,
  Users,
  Workflow,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  title: string;
  href: string;
  icon: LucideIcon;
  /** Which build phase implements this section (shown in placeholder pages). */
  phase?: string;
}

/** Primary navigation — the 10 sections of the app. */
export const NAV_ITEMS: NavItem[] = [
  { title: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { title: "Campaigns", href: "/campaigns", icon: Megaphone, phase: "Phase 3" },
  { title: "Leads", href: "/leads", icon: Users, phase: "Phase 3" },
  { title: "Mailboxes", href: "/mailboxes", icon: Mailbox, phase: "Phase 2" },
  { title: "Sequences", href: "/sequences", icon: Workflow, phase: "Phase 5" },
  { title: "Templates", href: "/templates", icon: FileText, phase: "Phase 3" },
  { title: "AI Replies", href: "/ai-replies", icon: Bot, phase: "Phase 6" },
  { title: "Analytics", href: "/analytics", icon: BarChart3, phase: "Phase 7" },
  { title: "Activity", href: "/activity", icon: Activity, phase: "Phase 7" },
  { title: "Settings", href: "/settings", icon: Settings },
];
