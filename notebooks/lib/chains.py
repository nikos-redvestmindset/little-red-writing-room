from __future__ import annotations

from operator import itemgetter

from langchain_core.output_parsers import StrOutputParser
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.runnables import RunnablePassthrough

RAG_PROMPT_TEMPLATE = """\
You are a fiction writing assistant. Use the story context provided below to \
answer the writer's question. Ground every claim in the provided context — if \
the context does not contain enough information, say so rather than inventing \
details.

Question:
{question}

Context:
{context}
"""

_rag_prompt = ChatPromptTemplate.from_template(RAG_PROMPT_TEMPLATE)


def build_rag_chain(retriever, chat_model):
    """Return an LCEL chain that retrieves context and generates a response.

    Invoke with ``{"question": "..."}``; returns
    ``{"response": AIMessage, "context": [Document, ...]}``.
    """
    return (
        {
            "context": itemgetter("question") | retriever,
            "question": itemgetter("question"),
        }
        | RunnablePassthrough.assign(context=itemgetter("context"))
        | {
            "response": _rag_prompt | chat_model,
            "context": itemgetter("context"),
        }
    )
