"use client";

import { useMutation, useQuery } from "convex/react";
import Link from "next/link";
import { useState } from "react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { CardSkeletonList, EmptyState } from "@/components/app-state";
import { useDashboardAuth } from "@/components/dashboard-auth";
import { Card, SectionHeader, emptyStateClass } from "@/components/ui";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BellIcon, CheckIcon, ChevronDownIcon, ChevronRightIcon } from "lucide-react";
import { toast } from "sonner";
import { friendlyErrorMessage } from "@/lib/errors";

type NotificationDisplay = {
  title: string;
  summary: string;
  details: Array<{ label: string; value: string }>;
  allocation?: string;
  availabilityWarnings?: string;
  bookingNotice?: string;
};

function sentenceCase(value: string) {
  return value
    .replace(/[_-]/g, " ")
    .replace(/\w\S*/g, (word) => word[0].toUpperCase() + word.slice(1).toLowerCase());
}

function parseNotification(message: string, title?: string | undefined): NotificationDisplay {
  const parts = message.split("|").map((part) => part.trim()).filter(Boolean);
  const keyedParts = parts
    .map((part) => {
      const separatorIndex = part.indexOf(":");
      if (separatorIndex === -1) return null;

      return {
        label: part.slice(0, separatorIndex).trim(),
        value: part.slice(separatorIndex + 1).trim(),
      };
    })
    .filter((part): part is { label: string; value: string } => part !== null);

  const valueFor = (label: string) =>
    keyedParts.find((part) => part.label.toLowerCase() === label.toLowerCase())?.value;

  const sessionName = valueFor("New pending request");
  const when = valueFor("When");
  const allocation = valueFor("Allocation");
  const availabilityWarnings = valueFor("Availability warnings");
  const bookingNotice = valueFor("Booking notice");

  if (keyedParts.length > 1 || sessionName) {
    return {
      title: title ?? "New Pending Request",
      summary: sessionName
        ? when
          ? `${sessionName} · ${when}`
          : sessionName
        : message,
      details: keyedParts.map((part) => ({
        label: sentenceCase(part.label),
        value: part.value,
      })),
      allocation,
      availabilityWarnings,
      bookingNotice,
    };
  }

  return {
    title: title ?? "Notification",
    summary: message,
    details: [{ label: "Message", value: message }],
  };
}

export function NotificationsList() {
  const auth = useDashboardAuth();
  const tenantSlug = auth.tenantSlug;
  const [filter, setFilter] = useState<"unseen" | "all">("unseen");
  const notifications = useQuery(api.notifications.listByTenantSlug, {
    tenantSlug,
    auth,
    filter,
  });
  const unseenCount = useQuery(api.notifications.unseenCountByTenantSlug, {
    tenantSlug,
    auth,
  });
  const markSeen = useMutation(api.notifications.markSeen);
  const markAllSeen = useMutation(api.notifications.markAllSeen);
  const unseenLabel = `${unseenCount ?? 0} unseen`;
  const isLoading = notifications === undefined;

  async function onMarkAllSeen() {
    try {
      await markAllSeen({ tenantSlug, auth });
      toast.success("Notifications marked as seen.");
    } catch (error) {
      toast.error(friendlyErrorMessage(error, "Could not mark notifications as seen."));
    }
  }

  async function onMarkSeen(notificationId: Id<"notifications">) {
    try {
      await markSeen({ tenantSlug, auth, notificationId });
      toast.success("Notification marked as seen.");
    } catch (error) {
      toast.error(friendlyErrorMessage(error, "Could not mark this notification as seen."));
    }
  }

  return (
    <>
      <SectionHeader
        title="Notifications"
        eyebrow={unseenLabel}
        action={
          <Button
            variant="outline"
            onClick={() => void onMarkAllSeen()}
            disabled={!unseenCount || unseenCount === undefined}
          >
            <CheckIcon className="size-4" />
            Mark all seen
          </Button>
        }
      />
      <Tabs
        value={filter}
        onValueChange={(value) => setFilter(value as "unseen" | "all")}
        className="gap-4"
      >
        <TabsList>
          <TabsTrigger value="unseen">Unseen</TabsTrigger>
          <TabsTrigger value="all">All</TabsTrigger>
        </TabsList>
        <TabsContent value={filter}>
          <Card className="space-y-3">
        {isLoading ? (
          <CardSkeletonList rows={3} />
        ) : notifications.length > 0 ? notifications.map((item) => {
          const display = parseNotification(item.message, item.title);
          const hasWarnings =
            display.availabilityWarnings &&
            display.availabilityWarnings.toLowerCase() !== "none";
          const hasNoticeIssue =
            display.bookingNotice &&
            display.bookingNotice.toLowerCase() !== "clear";

          return (
            <article
              key={item._id}
              className="rounded-xl border border-border bg-background/60 p-4"
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="font-semibold text-foreground">
                      {display.title}
                    </h2>
                    {!item.seen ? <Badge>Unseen</Badge> : <Badge variant="outline">Seen</Badge>}
                    {display.allocation ? (
                      <Badge variant="secondary">{display.allocation}</Badge>
                    ) : null}
                    {display.availabilityWarnings ? (
                      <Badge variant={hasWarnings ? "destructive" : "outline"}>
                        {hasWarnings
                          ? `${display.availabilityWarnings} warning${
                              display.availabilityWarnings === "1" ? "" : "s"
                            }`
                          : "No warnings"}
                      </Badge>
                    ) : null}
                    {display.bookingNotice ? (
                      <Badge variant={hasNoticeIssue ? "destructive" : "outline"}>
                        {hasNoticeIssue ? "Notice issue" : "Notice clear"}
                      </Badge>
                    ) : null}
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">{display.summary}</p>
                  <p className="mt-2 text-xs text-muted-foreground">
                    {new Date(item.createdAt).toLocaleString()}
                  </p>
                </div>
                <div className="flex shrink-0 flex-wrap items-center gap-2">
                  {item.requestId ? (
                    <Button
                      variant="outline"
                      size="sm"
                      nativeButton={false}
                      render={<Link href={`/dashboard/requests/${item.requestId}`} />}
                    >
                      View request
                      <ChevronRightIcon className="size-4" />
                    </Button>
                  ) : null}
                  {!item.seen ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        void onMarkSeen(item._id)
                      }
                    >
                      <CheckIcon className="size-4" />
                      Mark seen
                    </Button>
                  ) : null}
                </div>
              </div>

              <details className="group mt-3 border-t border-border pt-3">
                <summary className="flex w-fit cursor-pointer list-none items-center gap-1 text-sm font-medium text-foreground hover:text-primary">
                  Details
                  <ChevronDownIcon className="size-4 transition-transform group-open:rotate-180" />
                </summary>
                <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-[10rem_1fr]">
                  {display.details.map((detail) => (
                    <div key={`${item._id}-${detail.label}`} className="contents">
                      <dt className="text-muted-foreground">{detail.label}</dt>
                      <dd className="min-w-0 break-words text-foreground">{detail.value}</dd>
                    </div>
                  ))}
                </dl>
              </details>
            </article>
          );
        }) : (
          <EmptyState
            icon={BellIcon}
            title={filter === "unseen" ? "All caught up" : "No notifications yet"}
            message={
              filter === "unseen"
                ? "New booking activity that needs attention will appear here."
                : "Notifications are created when booking requests or workflow changes need visibility."
            }
            action={{ label: "Review requests", href: "/dashboard/requests" }}
            className={emptyStateClass}
          />
        )}
          </Card>
        </TabsContent>
      </Tabs>
    </>
  );
}
