from unittest.mock import MagicMock, patch

import pytest

from agents.session.service import AvatarSessionService, _chunk_text, _sse_frame


def test_sse_frame_format():
    frame = _sse_frame("token", {"text": "hello"})
    assert frame == 'event: token\ndata: {"text": "hello"}\n\n'


def test_sse_frame_done():
    frame = _sse_frame("done", {"chat_id": "abc-123"})
    assert "event: done" in frame
    assert '"chat_id": "abc-123"' in frame


def test_chunk_text_splits_words():
    text = "one two three four five"
    chunks = _chunk_text(text, chunk_size=2)
    assert chunks == ["one two ", "three four ", "five"]


def test_chunk_text_single_chunk():
    text = "short"
    chunks = _chunk_text(text, chunk_size=20)
    assert chunks == ["short"]


@pytest.mark.asyncio
async def test_stream_yields_correct_events():
    mock_supervisor = MagicMock()
    mock_graph = MagicMock()

    async def fake_ainvoke(input_data, **kwargs):
        return {
            "response_text": "Hello world test response",
            "citations": [{"source": "test.md", "chunk_index": 0}],
            "gap_flags": [],
            "narrative_state_delta": {},
        }

    mock_graph.ainvoke = fake_ainvoke
    mock_supervisor.compile.return_value = mock_graph

    with patch("agents.session.service.create_client") as mock_create:
        mock_supabase = MagicMock()
        mock_create.return_value = mock_supabase

        table = MagicMock()
        table.select.return_value = table
        table.eq.return_value = table
        table.order.return_value = table
        table.limit.return_value = table
        table.maybe_single.return_value = table
        table.insert.return_value = table
        table.upsert.return_value = table

        result_empty = MagicMock()
        result_empty.data = []
        table.execute.return_value = result_empty

        mock_supabase.table.return_value = table

        service = AvatarSessionService(
            supervisor_builder=mock_supervisor,
            supabase_url="https://test.supabase.co",
            supabase_service_key="test-key",
        )

    events = []
    async for frame in service.stream(
        chat_id="test-chat",
        user_id="test-user",
        character_id="purplefrog",
        message="Hello",
    ):
        events.append(frame)

    event_types = [e.split("\n")[0] for e in events]
    assert any("event: token" in e for e in event_types)
    assert any("event: citation" in e for e in event_types)
    assert any("event: done" in e for e in event_types)

    done_frame = [e for e in events if "event: done" in e]
    assert len(done_frame) == 1
    assert "test-chat" in done_frame[0]
