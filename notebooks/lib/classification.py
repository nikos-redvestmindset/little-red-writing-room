from __future__ import annotations

import time
import warnings
from typing import Literal

from langchain_core.documents import Document
from langchain_core.prompts import ChatPromptTemplate
from pydantic import BaseModel, Field

warnings.filterwarnings("ignore", message="Pydantic serializer warnings", category=UserWarning)


class ChunkClassification(BaseModel):
    """Taxonomy metadata extracted from a single story chunk."""

    content_type: Literal[
        "dialogue",
        "action_reaction",
        "description",
        "internal_monologue",
    ]
    narrative_function: Literal[
        "worldbuilding",
        "character_reveal",
        "plot_event",
        "backstory",
        "thematic",
    ]
    characters_present: list[str] = Field(
        description="Canonical character names present in or referenced by this chunk.",
    )
    story_grid_tag: Literal[
        "inciting_incident",
        "turning_point",
        "crisis",
        "climax",
        "resolution",
        "none",
    ]
    external_references: list[str] = Field(
        description="Named characters or works not originating from the author's material.",
    )
    implied_gaps: list[str] = Field(
        description="What this chunk implies but does not define.",
    )


_CLASSIFICATION_SYSTEM = """\
You are a fiction analysis assistant. Given a chunk of story text and a list of \
known character names, classify the chunk according to the requested schema.

Resolve ambiguous pronouns and aliases against the known character list before \
populating characters_present.

Known characters: {known_characters}

Classification guide
--------------------
content_type — Choose the dominant mode of the passage:
  dialogue            : characters speaking to each other
  action_reaction     : a character acts; a character/environment visibly reacts within the same chunk
  description         : setting, atmosphere, or sensory detail without forward action
  internal_monologue  : a character's unspoken thoughts or feelings

narrative_function — Choose the primary narrative purpose (if multiple apply, pick the most dominant):
  worldbuilding    : establishes rules, setting, or history of the story world
  character_reveal : discloses something new about a character's identity, desire, or wound
  plot_event       : advances the external story question
  backstory        : recounts events that predate the current scene
  thematic         : foregrounds the story's central argument or moral premise

story_grid_tag — Apply Story Grid beat labels only when the chunk clearly represents that beat; default to "none":
  inciting_incident : disrupts the protagonist's equilibrium, forces engagement with the story problem
  turning_point     : a value shift occurs — the scene ends on an opposite charge from how it began
  crisis            : the protagonist faces a "best bad choice" or "irreconcilable goods" dilemma
  climax            : the protagonist's decisive action in response to the crisis
  resolution        : the new equilibrium after the climax is established
  none              : the chunk does not represent a complete story beat

external_references — List real-world people, published works, historical figures, or named cultural
  artifacts not created by the author. Leave empty if none.

implied_gaps — List story questions this chunk raises but does not answer: unexplained backstory,
  off-page events that are referenced, unresolved motivations, etc. Leave empty if none.
"""

_CLASSIFICATION_HUMAN = """\
Classify the following story chunk:

{chunk_text}
"""

_classification_prompt = ChatPromptTemplate.from_messages(
    [
        ("system", _CLASSIFICATION_SYSTEM),
        ("human", _CLASSIFICATION_HUMAN),
    ]
)


_MAX_RETRIES = 3


def _invoke_with_retry(chain, chars_str: str, text: str, verbose: bool) -> ChunkClassification:
    for attempt in range(_MAX_RETRIES):
        try:
            return chain.invoke({"known_characters": chars_str, "chunk_text": text})
        except Exception as exc:
            if "rate_limit" in str(exc).lower() and attempt < _MAX_RETRIES - 1:
                wait = 30 * (attempt + 1)
                if verbose:
                    print(f"  rate-limited, waiting {wait}s before retry...")
                time.sleep(wait)
            else:
                raise
    raise RuntimeError("unreachable")


def classify_chunks(
    chunks: list[Document],
    known_characters: list[str],
    llm,
    *,
    verbose: bool = False,
) -> list[Document]:
    """Run a structured-output LLM call per chunk and attach taxonomy metadata.

    Returns new Document objects whose ``metadata`` dicts contain the
    classification fields (suitable for use as Qdrant payload).
    """
    structured_llm = llm.with_structured_output(
        ChunkClassification, method="function_calling", strict=True
    )
    chain = _classification_prompt | structured_llm

    enriched: list[Document] = []
    chars_str = ", ".join(known_characters) if known_characters else "(none provided)"

    for i, chunk in enumerate(chunks):
        classification = _invoke_with_retry(chain, chars_str, chunk.page_content, verbose)
        new_meta = {
            **chunk.metadata,
            **classification.model_dump(),
        }
        enriched.append(
            Document(page_content=chunk.page_content, metadata=new_meta)
        )
        if verbose:
            print(
                f"[{i + 1}/{len(chunks)}] {classification.content_type} / "
                f"{classification.narrative_function} — "
                f"{classification.characters_present}"
            )
        time.sleep(0.3)

    return enriched
