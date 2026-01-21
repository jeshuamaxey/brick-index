"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { ToyBrick } from "lucide-react"

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarRail,
} from "@/components/ui/sidebar"

const data = {
  navMain: [
    {
      title: "Resources",
      url: "/backend/resources",
      items: [
        {
          title: "Jobs",
          url: "/backend/resources/jobs",
        },
        {
          title: "Listings",
          url: "/backend/resources/listings",
        },
        {
          title: "API Usage",
          url: "/backend/resources/api-usage",
        },
        {
          title: "Catalog",
          url: "/backend/resources/catalog",
        },
        {
          title: "Datasets",
          url: "/backend/resources/datasets",
        },
        {
          title: "Publishing",
          url: "/backend/resources/publishing",
        },
      ],
    },
    {
      title: "Collection",
      url: "/backend/actions",
      items: [
        {
          title: "Capture",
          url: "/backend/actions/capture",
        },
        {
          title: "Enrich",
          url: "/backend/actions/enrich",
        },
      ],
    },
    {
      title: "Transform",
      url: "/backend/actions",
      items: [
        {
          title: "Materialize",
          url: "/backend/actions/materialize",
        },
        {
          title: "Sanitize",
          url: "/backend/actions/sanitize",
        },
        {
          title: "Reconcile",
          url: "/backend/actions/reconcile",
        },
      ],
    },
    {
      title: "Analyze",
      url: "/backend/actions",
      items: [
        {
          title: "Analyze",
          url: "/backend/actions/analyze",
        },
      ],
    },
  ],
}

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const pathname = usePathname()

  return (
    <Sidebar {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <Link href="/backend">
                <div className="bg-sidebar-primary text-sidebar-primary-foreground flex aspect-square size-8 items-center justify-center rounded-lg">
                  <ToyBrick className="size-4" />
                </div>
                <div className="flex flex-col gap-0.5 leading-none">
                  <span className="font-medium">Backend</span>
                </div>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarMenu>
            {data.navMain.map((item) => (
              <SidebarMenuItem key={item.title}>
                {item.items?.length ? (
                  <>
                    <SidebarMenuButton asChild isActive={pathname === item.url}>
                      <Link href={item.url} className="font-medium">
                        {item.title}
                      </Link>
                    </SidebarMenuButton>
                    <SidebarMenuSub>
                      {item.items.map((subItem) => (
                        <SidebarMenuSubItem key={subItem.title}>
                          <SidebarMenuSubButton asChild isActive={pathname === subItem.url}>
                            <Link href={subItem.url}>{subItem.title}</Link>
                          </SidebarMenuSubButton>
                        </SidebarMenuSubItem>
                      ))}
                    </SidebarMenuSub>
                  </>
                ) : (
                  <SidebarMenuButton asChild isActive={pathname === item.url}>
                    <Link href={item.url}>{item.title}</Link>
                  </SidebarMenuButton>
                )}
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>
      <SidebarRail />
    </Sidebar>
  )
}
