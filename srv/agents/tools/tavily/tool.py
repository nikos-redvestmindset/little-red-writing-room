from langchain_core.tools import tool

from agents.tools.tavily.config import TavilyToolSettings


class TavilyToolBuilder:
    """Builds a LangChain tool for web search via Tavily.

    Currently returns dummy results for end-to-end testing.
    """

    def __init__(self, settings: TavilyToolSettings) -> None:
        self.settings = settings

    def build(self):
        @tool
        def tavily_search(queries: str) -> str:
            """Search the web for external character or work references.

            Use when the query references a named character or work not from
            the author's uploaded material. NOT for questions answerable from
            the author's own documents.
            """
            return (
                '[{"title": "Story Grid - Writing Craft", '
                '"url": "https://storygrid.com", '
                '"content": "Dummy external search result for testing."}]'
            )

        return tavily_search
