import { useState, useRef, useEffect, useCallback } from "react";
import { ChevronRight } from "lucide-react";
import type { Message, Citation } from "@/types";
import { useAppState } from "@/lib/app-state";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

const COLLAPSED_LINES = 2;

function CitationEntry({ citation }: { citation: Citation }) {
  const [expanded, setExpanded] = useState(false);
  const [clamped, setClamped] = useState(false);
  const quoteRef = useRef<HTMLSpanElement>(null);

  const checkClamp = useCallback(() => {
    const el = quoteRef.current;
    if (el) setClamped(el.scrollHeight > el.clientHeight + 1);
  }, []);

  useEffect(() => {
    checkClamp();
  }, [checkClamp, citation.quote]);

  return (
    <div className="text-xs text-muted-foreground border-l-2 border-primary/30 pl-3 py-1">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex items-center gap-1 font-medium hover:text-foreground transition-colors text-left"
      >
        <ChevronRight
          className={cn(
            "h-3 w-3 shrink-0 transition-transform duration-200",
            expanded && "rotate-90"
          )}
        />
        {citation.sourceDocument}
      </button>
      <span
        ref={quoteRef}
        className={cn(
          "block italic mt-0.5",
          !expanded && `line-clamp-[${COLLAPSED_LINES}]`
        )}
        style={
          !expanded
            ? {
                WebkitLineClamp: COLLAPSED_LINES,
                display: "-webkit-box",
                WebkitBoxOrient: "vertical",
                overflow: "hidden",
              }
            : undefined
        }
      >
        &ldquo;{citation.quote}&rdquo;
      </span>
      {clamped && !expanded && (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="text-primary/70 hover:text-primary mt-0.5 text-[10px] font-medium"
        >
          Show more
        </button>
      )}
    </div>
  );
}

interface MessageBubbleProps {
  message: Message;
}

export function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.role === "user";
  const { characters } = useAppState();
  const avatar = message.avatarId
    ? characters.find((c) => c.id === message.avatarId) ?? null
    : null;

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
              <CitationEntry key={i} citation={citation} />
            ))}
          </div>
        )}

        {message.gapFlags && message.gapFlags.length > 0 && (
          <div className="space-y-1 px-1">
            {message.gapFlags.map((gap, i) => (
              <div
                key={i}
                className="text-xs text-amber-700 dark:text-amber-400 border-l-2 border-amber-400/50 pl-3 py-1"
              >
                <span className="font-medium">Gap: {gap.attribute}</span>
                <span className="block mt-0.5">{gap.suggestion}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
