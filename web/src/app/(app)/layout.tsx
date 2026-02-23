"use client";

import { useState } from "react";
import { Menu } from "lucide-react";
import { AppSidebar } from "@/components/app-sidebar";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { AppStateProvider } from "@/lib/app-state";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <AppStateProvider>
      <div className="h-svh w-screen overflow-hidden">
        {/* Desktop sidebar */}
        <div
          className={cn(
            "hidden md:block fixed inset-y-0 left-0 z-30 border-r border-sidebar-border transition-[width] duration-200 ease-in-out",
            collapsed ? "w-14" : "w-72"
          )}
        >
          <AppSidebar
            collapsed={collapsed}
            onToggleCollapse={() => setCollapsed((c) => !c)}
          />
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

        {/* Main content */}
        <main
          className={cn(
            "h-full overflow-hidden transition-[margin] duration-200 ease-in-out",
            collapsed ? "md:ml-14" : "md:ml-72"
          )}
        >
          {children}
        </main>
      </div>
    </AppStateProvider>
  );
}
