"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  MessageSquare,
  FileText,
  PanelLeftClose,
  PanelLeft,
} from "lucide-react";
import { useAppState } from "@/lib/app-state";
import { STORY_ENTITY_TYPES } from "@/lib/story-entities/registry";
import { StoryEntityAvatar } from "@/components/story-entity-avatar";
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
  ...STORY_ENTITY_TYPES.map((cfg) => ({
    href: cfg.href,
    label: cfg.plural,
    icon: cfg.icon,
  })),
  { href: "/content", label: "Content", icon: FileText },
];

interface AppSidebarProps {
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}

export function AppSidebar({ collapsed, onToggleCollapse }: AppSidebarProps) {
  const pathname = usePathname();
  const { chats, chatsLoading, characters } = useAppState();

  if (collapsed) {
    return (
      <div className="flex h-full flex-col items-center bg-sidebar py-3">
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
          {chatsLoading && chats.length === 0 ? (
            <p className="px-2 py-4 text-xs text-muted-foreground">
              Loading…
            </p>
          ) : chats.length === 0 ? (
            <p className="px-2 py-4 text-xs text-muted-foreground">
              No chats yet
            </p>
          ) : (
            chats.map((chat) => {
              const character = characters.find(
                (c) => c.id === chat.character_id
              );
              const isActive = pathname === `/chat/${chat.id}`;

              return (
                <Link
                  key={chat.id}
                  href={`/chat/${chat.id}`}
                  className={cn(
                    "flex items-center gap-2.5 px-2 py-2 text-sm transition-colors rounded-md",
                    isActive
                      ? "bg-sidebar-accent text-sidebar-accent-foreground"
                      : "text-sidebar-foreground hover:bg-sidebar-accent/60"
                  )}
                >
                  <StoryEntityAvatar
                    initials={character?.initials ?? "?"}
                    color={character?.color ?? "#8B2E3B"}
                    entityType="character"
                    size="sm"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate font-medium text-xs">
                        {chat.title ?? "Untitled"}
                      </span>
                      <span
                        className="text-[10px] text-muted-foreground shrink-0"
                        suppressHydrationWarning
                      >
                        {formatRelativeTime(chat.updated_at)}
                      </span>
                    </div>
                  </div>
                </Link>
              );
            })
          )}
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
