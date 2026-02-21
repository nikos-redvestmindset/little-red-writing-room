# Little Red Writing Room: A Storybuilder's AI Companion

---

## Problem, Audience & Scope

### One-Sentence Problem Description

Fiction writers lack an interactive tool to externalize, interrogate, and stress-test their characters' psychology, settings, and story structure while actively developing a manuscript.

---

### Why This Is a Problem for the Specific User

**User:** Fiction writers — novelists, screenwriters, and narrative game designers — particularly those working in the early-to-mid stages of developing a character-driven story.

Writing fiction requires a writer to hold an enormous amount of cognitive load simultaneously: the psychology of multiple characters, the logic of the story's world, and the architecture of plot at both the scene level and the full story level. Frameworks like Story Grid's 5 Commandments (Inciting Incident, Turning Point, Crisis, Climax, Resolution) give writers a structural scaffold, but applying them scene-by-scene while also staying true to each character's voice and worldview is genuinely hard. Most writers rely on scattered notes, character sheets in spreadsheets, or outline documents — none of which are interactive or queryable. The result is characters who act out of voice, plot holes that only surface during revision, and hours lost to re-reading prior material just to answer the question: "Would this character actually do this?"

What's missing is an AI-powered companion that lives alongside the writer's story knowledge — one that can be queried in natural language, play a character in response to "what would PurpleFrog do if…?" questions, and ultimately simulate scenes turn-by-turn so the writer can explore their story before committing to the page. Phase 1 focuses on the most immediate pain point: the character interview, where a writer uploads their existing notes and writing and then "talks" to their characters to probe consistency, discover blind spots, and hear each character's voice before writing a new scene. Phase 2 will extend this into immersive scenario simulation where the writer can "play" a character and receive feedback on whether their choices align with their own written descriptions of that character.

---

### Evaluation Questions / Input-Output Pairs

The following question-answer pairs represent realistic user queries and expected system behaviors. Characters and scenarios are drawn from the uploaded short story on the [test dataset](./notebooks/sample_data).

| # | User Input | Expected Output |
|---|-----------|-----------------|
| 1 | "If PurpleFrog had to choose between reaching her brother and following OchraMags's evacuation order, what would she do and why?" | An in-character response grounded in PurpleFrog's established behavior: she defies authority, acts on instinct to protect her brother, and is willing to bite, steal a MODR pack, and risk a freefall to do it. Not a generic "she'd be torn" answer. |
| 2 | "How does PurpleFrog feel about the Underground?" | Retrieves her stated perspective from the story: she sees it as a rabbit hole, not the real world, and actively wants to return Overground. Her homesickness is concrete — silk kimonos, bare feet, green fields, a pet dog — not abstract. |
| 3 | "What is SnowRaven's greatest flaw as a character so far?" | Synthesizes evidence from the story: he freezes under threat (stood like an ice statue when the Worm took their parents), requires PurpleFrog to physically kick him into action, and yet is trusted by the colony as a capable squad leader — an irony the author should develop. |
| 4 | "Describe the colony's classroom setting." | Returns grounded details from the story: a giant terraformed tunnel, metal crates as desks, kids on MODRs, a big LED firefly screen tracking days since last Worm attack, firefly light strips across pipes and tents, a platform with a metal ladder, the Central Comms tower nearby. |
| 5 | "What is OchraMags's attitude toward PurpleFrog, and does it change across the scene?" | Traces the arc: starts as disciplinarian ("keep it quiet, newb"), escalates to physical restraint, then briefly softens ("SnowRaven is safe… you'll see him later"), then abandons her in frustration ("you wanna die? Then die") — a compressed but real emotional arc. |
| 6 | "Why does MyaxSerp resent SnowRaven?" | Retrieves the specific backstory: MyaxSerp's father was one of two rebels who didn't return from a mission on Day 720 — the same day PurpleFrog and SnowRaven were brought in. He blames SnowRaven. His father's body was recovered on Day 721 and MyaxSerp attacked SnowRaven that day. |
| 7 | "What would PurpleFrog do if she encountered a Worm alone?" | Synthesizes her character: she knows the rule (run, do a 180), she saw the Worm that took her parents, she's terrified but acts through fear rather than freezing. She would run — but probably also try to send a message or grab something useful on the way out. |
| 8 | "What is the Ytterbium Entangler and what does it mean for the story?" | Returns the story's own explanation: it's a mythic artifact the rebels have sought for centuries, discovered as an eyeball-shaped comms device lodged in a skull, which activates the L.Y.R.A. protocol and enables communication — and potentially travel — across time epochs. |
| 9 | "Is there a scene where PurpleFrog acts against her own stated values?" | Cross-references her values (protect her brother, return Overground, trust nobody) against her actions — flags that she leaves her mother's necklace behind with the skeleton at the end, a meaningful exception to her fierce protectiveness that the author may want to develop. |
| 10 | "What would be a strong Inciting Incident for a sequel scene where PurpleFrog makes first contact with someone in the past through the L.Y.R.A. protocol?" | Proposes a scene-level beat grounded in the story's world and the 5 Commandments framework: the inciting incident should disrupt PurpleFrog's plan (a quick fix in "a week, tops") by introducing a complication from the past contact — e.g., the person on the other end knows something about WormWood that reframes everything. |

---

## Task 2 — Proposed Solution

### Features & User Experience

Little Red Writing Room is an AI storytelling companion for fiction writers, built entirely around the author's own writing. Rather than filling out structured forms or character sheets, the writer simply uploads the messy, organic notes they already have — scene drafts, story snippets, character description fragments, worldbuilding documents, setting notes — in whatever format they work in (Markdown or DOCX). The system becomes a conversational, queryable layer on top of that material, grounding every response in what the author has actually written rather than what the LLM imagines a character might be like.

The experience is designed around two phases, with Phase 1 being the focus of the initial prototype.

---

**Phase 1 — Character Interview Mode**

The writer uploads their existing files and the system indexes them automatically. From that point, they open a chat interface and interact with their story directly — asking questions like:

- *"What would PurpleFrog do if she found out OzzieHeron had been lying to her?"*
- *"Describe the Underground colony in the voice of someone who hates it."*
- *"What does SnowRaven's tendency to freeze under threat tell us about his arc?"*

The system responds in-character or analytically, depending on how the question is framed, and every response is cited back to the specific document it came from. If a question pushes beyond what the uploaded notes define — for example, asking about a character's childhood when no notes on that exist — the system flags the gap explicitly rather than inventing an answer, turning unanswerable questions into a useful signal for the writer: *here is where your story still needs development*.

The interface is intentionally minimal: a file upload panel on one side, a chat window on the other. No configuration required beyond uploading files.

---

**Phase 2 — Scenario Simulation Mode** *(for demo day)*

The writer seeds a scenario by selecting a setting and a cast of characters from their uploaded material. They then choose one character to play themselves, with the remaining characters controlled by the AI. The story unfolds turn-by-turn: the system narrates what happens, then pauses for the writer to type their character's next action. After each input, the system evaluates whether the action is consistent with that character's established profile as described in the writer's own notes, and surfaces a brief behavioral note — either confirming the action fits or flagging a divergence. Alternatively, the writer can hand control of their character to the AI and simply observe how it plays them, useful for discovering how the system interprets the character they've built.

Scenes in this mode are structured around Story Grid's 5 Commandments (Inciting Incident, Turning Point, Crisis, Climax, Resolution), so each simulated scene has a narrative shape rather than drifting into open-ended roleplay.

---

**Phase N - A Story Builder's Knowledge Base** (for turning into a sellable product)

The author drops notes and chat comments/modifications/ideas and those are aggregated over time into a knowledge base for their story world that then the author can navigate either visually or with Q&A. 

> For technical implementation details, stack choices, and infrastructure design, see [ARCHITECTURE.md](./ARCHITECTURE.md).