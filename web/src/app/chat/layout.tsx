"use client";

import { useState } from "react";
import { PanelLeftClose, PanelLeft, Menu } from "lucide-react";
import { AppSidebar } from "@/components/app-sidebar";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export default function ChatLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="h-svh w-screen overflow-hidden">
      {/* Desktop sidebar — slides off-screen when collapsed */}
      <div
        className={cn(
          "hidden md:block fixed inset-y-0 left-0 z-30 w-72 border-r border-sidebar-border transition-transform duration-200 ease-in-out",
          collapsed && "-translate-x-full"
        )}
      >
        <AppSidebar />
      </div>

      {/* Collapse / expand toggle */}
      <div
        className={cn(
          "hidden md:block fixed top-3 z-40 transition-all duration-200 ease-in-out",
          collapsed ? "left-3" : "left-[296px]"
        )}
      >
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground hover:text-foreground"
              onClick={() => setCollapsed((c) => !c)}
            >
              {collapsed ? (
                <PanelLeft className="h-4 w-4" />
              ) : (
                <PanelLeftClose className="h-4 w-4" />
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent side="right" className="text-xs">
            {collapsed ? "Show sidebar" : "Hide sidebar"}
          </TooltipContent>
        </Tooltip>
      </div>

      {/* Mobile hamburger + sheet */}
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <div className="md:hidden fixed top-3 left-3 z-40">
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="h-9 w-9">
              <Menu className="h-5 w-5" />
            </Button>
          </SheetTrigger>
        </div>
        <SheetContent side="left" className="w-72 p-0">
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          <AppSidebar />
        </SheetContent>
      </Sheet>

      {/* Main content — shifts right when sidebar is open */}
      <main
        className={cn(
          "h-full overflow-hidden transition-[margin] duration-200 ease-in-out",
          collapsed ? "md:ml-0" : "md:ml-72"
        )}
      >
        {children}
      </main>
    </div>
  );
}
