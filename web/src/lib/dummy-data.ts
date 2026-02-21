import type { Avatar, Thread, Message } from "@/types";

export const avatars: Avatar[] = [
  {
    id: "purplefrog",
    name: "PurpleFrog",
    description:
      "Fierce, impulsive, protective of her brother. Defies authority and acts on instinct.",
    initials: "PF",
    color: "#7C3AED",
  },
  {
    id: "snowraven",
    name: "SnowRaven",
    description:
      "PurpleFrog's brother. Capable squad leader who freezes under direct threat.",
    initials: "SR",
    color: "#64748B",
  },
  {
    id: "ochramags",
    name: "OchraMags",
    description:
      "Disciplinarian squad leader. Tough exterior with occasional flashes of empathy.",
    initials: "OM",
    color: "#D97706",
  },
  {
    id: "myaxserp",
    name: "MyaxSerp",
    description:
      "Carries resentment toward SnowRaven over his father's death. Volatile and grieving.",
    initials: "MS",
    color: "#DC2626",
  },
];

export const threads: Thread[] = [
  {
    id: "thread-1",
    title: "PurpleFrog's motivations",
    avatarId: "purplefrog",
    lastMessageAt: "2026-02-21T14:30:00Z",
    preview:
      "If PurpleFrog had to choose between reaching her brother and following orders…",
  },
  {
    id: "thread-2",
    title: "Underground colony worldbuilding",
    avatarId: "purplefrog",
    lastMessageAt: "2026-02-21T12:15:00Z",
    preview: "How does PurpleFrog feel about the Underground?",
  },
  {
    id: "thread-3",
    title: "SnowRaven character analysis",
    avatarId: "snowraven",
    lastMessageAt: "2026-02-20T18:45:00Z",
    preview: "What is SnowRaven's greatest flaw as a character so far?",
  },
  {
    id: "thread-4",
    title: "OchraMags emotional arc",
    avatarId: "ochramags",
    lastMessageAt: "2026-02-20T10:00:00Z",
    preview:
      "What is OchraMags's attitude toward PurpleFrog, and does it change?",
  },
  {
    id: "thread-5",
    title: "MyaxSerp backstory exploration",
    avatarId: "myaxserp",
    lastMessageAt: "2026-02-19T16:30:00Z",
    preview: "Why does MyaxSerp resent SnowRaven?",
  },
];

export const messagesByThread: Record<string, Message[]> = {
  "thread-1": [
    {
      id: "msg-1",
      threadId: "thread-1",
      role: "user",
      content:
        "If PurpleFrog had to choose between reaching her brother and following OchraMags's evacuation order, what would she do and why?",
      createdAt: "2026-02-21T14:28:00Z",
    },
    {
      id: "msg-2",
      threadId: "thread-1",
      role: "assistant",
      content:
        "PurpleFrog would defy OchraMags without hesitation. Every instinct in her — and everything she's done in the story so far — points to this. She bit a guard to escape restraint, stole a MODR pack, and hurled herself into a freefall through the colony's vertical shafts, all to get to SnowRaven.\n\nShe doesn't weigh authority against safety. She acts. The evacuation order would register as noise — background static compared to the signal of her brother being somewhere she can't see him.\n\nThe interesting question for you as the author isn't *whether* she'd do it, but what it costs her this time.",
      avatarId: "purplefrog",
      citations: [
        {
          sourceDocument: "purplefrog-finds-her-brother.md",
          quote:
            "She bit down on his wrist until she tasted iron, grabbed the MODR pack from his belt, and ran.",
        },
        {
          sourceDocument: "purplefrog-story-notes.md",
          quote:
            "PurpleFrog's core drive: protect SnowRaven at any cost. Authority is an obstacle, never a guide.",
        },
      ],
      createdAt: "2026-02-21T14:30:00Z",
    },
  ],
  "thread-2": [
    {
      id: "msg-3",
      threadId: "thread-2",
      role: "user",
      content: "How does PurpleFrog feel about the Underground?",
      createdAt: "2026-02-21T12:10:00Z",
    },
    {
      id: "msg-4",
      threadId: "thread-2",
      role: "assistant",
      content:
        "She sees it as a rabbit hole — not the real world. The Underground is temporary in her mind, a place she's enduring rather than inhabiting. Her homesickness is strikingly concrete: she doesn't miss abstract things like 'freedom' or 'the sky.' She misses silk kimonos, walking barefoot through green fields, and her pet dog.\n\nThis specificity is what makes her feel real as a character. She's not performing sadness about displacement — she's remembering textures and warmth.",
      avatarId: "purplefrog",
      citations: [
        {
          sourceDocument: "purplefrog-finds-her-brother.md",
          quote:
            "This isn't the real world. It's a rabbit hole, and I'm going to claw my way back out.",
        },
      ],
      createdAt: "2026-02-21T12:15:00Z",
    },
  ],
  "thread-3": [
    {
      id: "msg-5",
      threadId: "thread-3",
      role: "user",
      content: "What is SnowRaven's greatest flaw as a character so far?",
      createdAt: "2026-02-20T18:40:00Z",
    },
    {
      id: "msg-6",
      threadId: "thread-3",
      role: "assistant",
      content:
        "He freezes. When it matters most — when the Worm took their parents — SnowRaven stood like an ice statue. PurpleFrog had to physically kick him into action.\n\nThe irony is rich: the colony trusts him as a capable squad leader. He's organized, reliable, and calm under routine pressure. But under genuine threat — the kind that touches something personal — he locks up. This is a flaw with real narrative potential because it creates a gap between who the colony thinks he is and who he actually is under pressure.\n\nThe question for you: does he grow past this, or does it define a crisis moment where someone gets hurt because he froze again?",
      avatarId: "snowraven",
      citations: [
        {
          sourceDocument: "purplefrog-finds-her-brother.md",
          quote:
            "SnowRaven stood there, rigid as an ice sculpture, while the Worm dragged their mother into the dark.",
        },
      ],
      createdAt: "2026-02-20T18:45:00Z",
    },
  ],
};

export function getThreadMessages(threadId: string): Message[] {
  return messagesByThread[threadId] ?? [];
}

export function getAvatarById(id: string): Avatar | undefined {
  return avatars.find((a) => a.id === id);
}
