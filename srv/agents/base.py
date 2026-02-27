from abc import ABC, abstractmethod
from typing import final

from langgraph.graph.state import CompiledStateGraph


class AgentBuilder(ABC):
    """Base class for all agent builders.

    Subclasses implement _build() to define the graph.
    Consumers call compile() which is sealed and cached.
    """

    _compiled: CompiledStateGraph | None = None

    def __init_subclass__(cls, **kwargs):
        super().__init_subclass__(**kwargs)
        if "compile" in cls.__dict__:
            raise TypeError(
                f"{cls.__name__} must not override compile(). Implement _build() instead."
            )

    @final
    def compile(self) -> CompiledStateGraph:
        if self._compiled is None:
            self._compiled = self._build()
        return self._compiled

    @abstractmethod
    def _build(self) -> CompiledStateGraph:
        ...
