"use client";

import { useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { PenLine, Upload } from "lucide-react";
import { threads } from "@/lib/dummy-data";
import { getAvatarById } from "@/lib/dummy-data";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { UserMenu } from "@/components/user-menu";

export function AppSidebar() {
  const pathname = usePathname();
  const fileInputRef = useRef<HTMLInputElement>(null);

  function formatRelativeTime(dateStr: string) {
    const diff = Date.now() - new Date(dateStr).getTime();
    const hours = Math.floor(diff / 3600000);
    if (hours < 1) return "Just now";
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days === 1) return "Yesterday";
    return `${days}d ago`;
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files?.length) return;
    console.log(
      "Files selected for upload:",
      Array.from(files).map((f) => f.name)
    );
  }

  return (
    <div className="flex h-full flex-col bg-sidebar">
      <div className="p-4">
        <Link href="/chat" className="block">
          <h1 className="text-base font-light italic tracking-tight text-sidebar-foreground">
            Little Red Writing Room
          </h1>
        </Link>
      </div>

      <div className="px-3 space-y-1.5">
        <Button
          asChild
          variant="outline"
          className="w-full justify-start gap-2 h-9 text-sm font-normal bg-sidebar border-sidebar-border hover:bg-sidebar-accent"
        >
          <Link href="/chat">
            <PenLine className="h-4 w-4" />
            New chat
          </Link>
        </Button>

        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".md,.docx,.txt"
          onChange={handleFileChange}
          className="hidden"
        />
        <Button
          variant="ghost"
          onClick={() => fileInputRef.current?.click()}
          className="w-full justify-start gap-2 h-9 text-sm font-normal text-muted-foreground hover:text-sidebar-foreground hover:bg-sidebar-accent"
        >
          <Upload className="h-4 w-4" />
          Upload files
        </Button>
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
                  "flex items-start gap-2.5 px-2 py-2 text-sm transition-colors rounded-sm",
                  isActive
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-sidebar-foreground hover:bg-sidebar-accent/60"
                )}
              >
                <div
                  className="mt-0.5 h-5 w-5 shrink-0 rounded-sm flex items-center justify-center text-[10px] font-medium text-white"
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
