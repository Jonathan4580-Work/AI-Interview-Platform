import { Bell } from "lucide-react";

import { Button } from "@/components/ui/button";

interface NotificationButtonProps {
  unreadCount?: number;
}

function NotificationButton({ unreadCount = 0 }: NotificationButtonProps) {
  const hasUnread = unreadCount > 0;

  return (
    <Button
      variant="quiet"
      size="icon"
      className="relative"
      aria-label={
        hasUnread ? `${String(unreadCount)} unread notifications` : "No unread notifications"
      }
    >
      <Bell aria-hidden="true" />
      {hasUnread ? (
        <span className="absolute mt-[-1.1rem] ml-3 grid min-w-4 place-items-center rounded-full bg-destructive px-1 text-[10px] font-semibold text-destructive-foreground">
          {unreadCount > 9 ? "9+" : unreadCount}
        </span>
      ) : null}
    </Button>
  );
}

export { NotificationButton };
