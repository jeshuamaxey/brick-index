import { AppSidebar } from "@/components/app-sidebar"
import { Separator } from "@/components/ui/separator"
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar"
import { BreadcrumbNav } from "./components/breadcrumb-nav"
import { UserMenu } from "./components/user-menu"
import { requirePermission } from "@/lib/auth/auth-helpers"
import { redirect } from "next/navigation"

export default async function BackendLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // Check authentication and permission server-side
  try {
    await requirePermission('backend.access');
  } catch (error) {
    // If permission check fails, redirect to sign in
    // Middleware should have caught this, but this is a double-check
    redirect('/auth/signin?error=permission_denied');
  }

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <header className="flex h-16 shrink-0 items-center gap-2 border-b border-foreground/10 bg-background">
          <div className="flex items-center gap-2 px-3 flex-1">
            <SidebarTrigger />
            <Separator orientation="vertical" className="mr-2 h-4" />
            <BreadcrumbNav />
          </div>
          <div className="px-3">
            <UserMenu />
          </div>
        </header>
        <div className="flex flex-col h-[calc(100vh-4rem)] overflow-y-auto">
          {children}
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}

