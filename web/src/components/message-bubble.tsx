import type { Message } from "@/types";
import { getAvatarById } from "@/lib/dummy-data";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

interface MessageBubbleProps {
  message: Message;
}

export function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.role === "user";
  const avatar = message.avatarId ? getAvatarById(message.avatarId) : null;

  return (
    <div
      className={cn(
        "flex gap-3 max-w-2xl",
        isUser ? "ml-auto flex-row-reverse" : "mr-auto"
      )}
    >
      {!isUser && (
        <Avatar className="h-8 w-8 shrink-0 rounded-sm">
          <AvatarFallback
            className="rounded-sm text-xs font-medium text-white"
            style={{ backgroundColor: avatar?.color ?? "#8B2E3B" }}
          >
            {avatar?.initials ?? "AI"}
          </AvatarFallback>
        </Avatar>
      )}

      <div className="space-y-2 min-w-0">
        <div
          className={cn(
            "px-4 py-3 text-sm leading-relaxed rounded-xl",
            isUser
              ? "bg-primary text-primary-foreground rounded-br-sm"
              : "bg-ai-bubble text-foreground rounded-bl-sm"
          )}
        >
          {message.content.split("\n\n").map((paragraph, i) => (
            <p key={i} className={i > 0 ? "mt-3" : ""}>
              {paragraph}
            </p>
          ))}
        </div>

        {message.citations && message.citations.length > 0 && (
          <div className="space-y-1 px-1">
            {message.citations.map((citation, i) => (
              <div
                key={i}
                className="text-xs text-muted-foreground border-l-2 border-primary/30 pl-3 py-1"
              >
                <span className="font-medium">{citation.sourceDocument}</span>
                <span className="block italic mt-0.5">
                  &ldquo;{citation.quote}&rdquo;
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
