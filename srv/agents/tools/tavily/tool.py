import logging

from langchain_tavily import TavilySearch

from agents.tools.tavily.config import TavilyToolSettings

logger = logging.getLogger(__name__)


class TavilyToolBuilder:
    """Builds a LangChain tool for web search via Tavily."""

    def __init__(self, settings: TavilyToolSettings) -> None:
        self.settings = settings

    def build(self) -> TavilySearch:
        tool = TavilySearch(
            name="tavily_search",
            max_results=self.settings.max_results,
            search_depth=self.settings.search_depth,
            include_answer=True,
            tavily_api_key=self.settings.api_key,
            description=(
                "Search the web for writing craft guidance, narrative "
                "frameworks, and external references.\n\n"
                "Use this tool when the writer asks about established "
                "storytelling techniques, frameworks, or external works "
                "that are not part of their uploaded manuscripts. This "
                "searches the public web -- NOT the author's own story "
                "documents.\n\n"
                "When to use:\n"
                "- Story Grid methodology, obligatory scenes, five "
                "commandments of storytelling\n"
                "- Hero's Journey / monomyth stages and archetypes\n"
                "- Character development frameworks: want vs. need, wound "
                "and ghost, character arc types\n"
                "- Plot structure models: Save the Cat, Snowflake Method, "
                "three-act / four-act structure\n"
                "- Genre conventions and obligatory scenes\n"
                "- Worldbuilding techniques: magic system design, "
                "Sanderson's Laws, conlang basics\n"
                "- Named external authors, books, or published characters "
                "the writer references\n"
                "- General writing craft: POV, narrative distance, scene "
                "vs. sequel, tension and subtext\n\n"
                "When NOT to use:\n"
                "- Questions about the writer's own characters, scenes, "
                "or world (use retrieval_search)\n"
                "- Questions the writer is answering about their own "
                "creative intent\n"
                "- Factual questions already answered by the writer's "
                "uploaded notes"
            ),
        )
        return tool
