from __future__ import annotations

import copy
import time

import pandas as pd
from ragas import RunConfig, evaluate
from ragas.dataset_schema import EvaluationDataset
from ragas.metrics import (
    ContextEntityRecall,
    FactualCorrectness,
    Faithfulness,
    LLMContextRecall,
    ResponseRelevancy,
)

DEFAULT_METRICS = [
    LLMContextRecall(),
    Faithfulness(),
    FactualCorrectness(),
    ResponseRelevancy(),
    ContextEntityRecall(),
]


def evaluate_chain(
    chain,
    dataset,
    evaluator_llm,
    metrics=None,
    *,
    sleep_between: float = 2.0,
    timeout: int = 360,
):
    """Run *chain* over every row in a RAGAS *dataset* and return evaluation results.

    Parameters
    ----------
    chain : Runnable
        An LCEL chain that accepts ``{"question": str}`` and returns
        ``{"response": AIMessage, "context": [Document, ...]}``.
    dataset : ragas TestsetSample collection
        The RAGAS-generated test dataset (from ``TestsetGenerator.generate_with_langchain_docs``).
    evaluator_llm : LangchainLLMWrapper
        Wrapped LLM used by RAGAS to judge answers.
    metrics : list | None
        RAGAS metrics to compute. Defaults to recall, faithfulness,
        factual correctness, relevancy, and entity recall.
    sleep_between : float
        Seconds to sleep between chain invocations to avoid rate limits.
    timeout : int
        RAGAS RunConfig timeout in seconds.
    """
    if metrics is None:
        metrics = DEFAULT_METRICS

    test_dataset = copy.deepcopy(dataset)
    for test_row in test_dataset:
        response = chain.invoke({"question": test_row.eval_sample.user_input})
        test_row.eval_sample.response = response["response"].content
        test_row.eval_sample.retrieved_contexts = [
            ctx.page_content for ctx in response["context"]
        ]
        time.sleep(sleep_between)

    evaluation_dataset = EvaluationDataset.from_pandas(test_dataset.to_pandas())
    return evaluate(
        evaluation_dataset,
        metrics=metrics,
        llm=evaluator_llm,
        run_config=RunConfig(timeout=timeout),
    )


def compare_results(
    results: dict[str, object],
) -> pd.DataFrame:
    """Build a side-by-side comparison DataFrame from a ``{name: ragas_result}`` dict.

    Returns a DataFrame with one column per pipeline and a ``delta`` column
    (last pipeline minus first pipeline).
    """
    frames = {}
    for name, result in results.items():
        scores_df = pd.DataFrame(result.scores)
        frames[name] = scores_df.mean()

    comparison = pd.DataFrame(frames).round(3)
    names = list(results.keys())
    if len(names) == 2:
        comparison["delta"] = (comparison[names[1]] - comparison[names[0]]).round(3)
        comparison["pct_change"] = ((comparison[names[1]] - comparison[names[0]]) / comparison[names[0]] * 100).round(1)
    return comparison
