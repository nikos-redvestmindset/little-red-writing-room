"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  MessageSquare,
  Users,
  FileText,
  PanelLeftClose,
  PanelLeft,
} from "lucide-react";
import { threads, getAvatarById } from "@/lib/dummy-data";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { UserMenu } from "@/components/user-menu";

const NAV_ITEMS = [
  { href: "/chat", label: "Chats", icon: MessageSquare },
  { href: "/characters", label: "Characters", icon: Users },
  { href: "/content", label: "Content", icon: FileText },
] as const;

interface AppSidebarProps {
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}

export function AppSidebar({ collapsed, onToggleCollapse }: AppSidebarProps) {
  const pathname = usePathname();

  if (collapsed) {
    return (
      <div className="flex h-full flex-col items-center bg-sidebar py-3">
        {/* Expand button */}
        {onToggleCollapse && (
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={onToggleCollapse}
                className="mb-3 flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:text-sidebar-foreground hover:bg-sidebar-accent/60 transition-colors"
              >
                <PanelLeft className="h-4 w-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="right" className="text-xs">
              Expand sidebar
            </TooltipContent>
          </Tooltip>
        )}

        {/* Icon-only nav */}
        <div className="space-y-1">
          {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
            const isActive =
              pathname === href || pathname.startsWith(href + "/");
            return (
              <Tooltip key={href}>
                <TooltipTrigger asChild>
                  <Link
                    href={href}
                    className={cn(
                      "flex h-9 w-9 items-center justify-center rounded-md transition-colors",
                      isActive
                        ? "bg-sidebar-accent text-sidebar-accent-foreground"
                        : "text-muted-foreground hover:text-sidebar-foreground hover:bg-sidebar-accent/60"
                    )}
                  >
                    <Icon className="h-4 w-4" />
                  </Link>
                </TooltipTrigger>
                <TooltipContent side="right" className="text-xs">
                  {label}
                </TooltipContent>
              </Tooltip>
            );
          })}
        </div>

        <div className="flex-1" />

        <UserMenu email="writer@example.com" name="Story Writer" collapsed />
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col bg-sidebar">
      <div className="p-4 flex items-center justify-between">
        <Link href="/chat" className="block">
          <h1 className="text-base font-light italic tracking-tight text-sidebar-foreground">
            Little Red Writing Room
          </h1>
        </Link>
        {onToggleCollapse && (
          <button
            onClick={onToggleCollapse}
            className="hidden md:flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:text-sidebar-foreground hover:bg-sidebar-accent/60 transition-colors"
          >
            <PanelLeftClose className="h-4 w-4" />
          </button>
        )}
      </div>

      <div className="px-3 space-y-1">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const isActive = pathname === href || pathname.startsWith(href + "/");
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-2.5 px-3 py-2 text-sm font-medium rounded-md transition-colors",
                isActive
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-muted-foreground hover:text-sidebar-foreground hover:bg-sidebar-accent/60"
              )}
            >
              <Icon className="h-4 w-4" />
              {label}
            </Link>
          );
        })}
      </div>

      <Separator className="my-3 bg-sidebar-border" />

      <div className="px-3 pb-1">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          Recent
        </span>
      </div>

      <ScrollArea className="flex-1 px-1">
        <div className="space-y-0.5 px-2">
          {threads.map((thread) => {
            const avatar = getAvatarById(thread.avatarId);
            const isActive = pathname === `/chat/${thread.id}`;

            return (
              <Link
                key={thread.id}
                href={`/chat/${thread.id}`}
                className={cn(
                  "flex items-start gap-2.5 px-2 py-2 text-sm transition-colors rounded-md",
                  isActive
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-sidebar-foreground hover:bg-sidebar-accent/60"
                )}
              >
                <div
                  className="mt-0.5 h-5 w-5 shrink-0 rounded-md flex items-center justify-center text-[10px] font-medium text-white"
                  style={{ backgroundColor: avatar?.color ?? "#8B2E3B" }}
                >
                  {avatar?.initials ?? "?"}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate font-medium text-xs">
                      {thread.title}
                    </span>
                    <span className="text-[10px] text-muted-foreground shrink-0">
                      {formatRelativeTime(thread.lastMessageAt)}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                    {thread.preview}
                  </p>
                </div>
              </Link>
            );
          })}
        </div>
      </ScrollArea>

      <Separator className="bg-sidebar-border" />

      <div className="p-3">
        <UserMenu email="writer@example.com" name="Story Writer" />
      </div>
    </div>
  );
}

function formatRelativeTime(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const hours = Math.floor(diff / 3600000);
  if (hours < 1) return "Just now";
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "Yesterday";
  return `${days}d ago`;
}
