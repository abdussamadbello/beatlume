import tiktoken


def count_tokens(text: str, model: str = "gpt-4o") -> int:
    """Count tokens for a given text. Falls back to cl100k_base."""
    try:
        enc = tiktoken.encoding_for_model(model)
    except KeyError:
        enc = tiktoken.get_encoding("cl100k_base")
    return len(enc.encode(text))


class TokenBudget:
    """Manage token budget allocation across context sections."""

    MODEL_LIMITS = {
        "fast": 16_000,
        "standard": 128_000,
        "powerful": 200_000,
    }

    def __init__(self, model_tier: str = "standard", output_reserve: int = 2000):
        self.total = self.MODEL_LIMITS.get(model_tier, 128_000)
        self.output_reserve = output_reserve
        self.system_prompt_tokens = 0

    def set_system_prompt_tokens(self, tokens: int):
        self.system_prompt_tokens = tokens

    @property
    def available(self) -> int:
        return self.total - self.output_reserve - self.system_prompt_tokens

    def allocate(self, sections: dict[str, float]) -> dict[str, int]:
        """Allocate available budget proportionally across named sections."""
        remaining = self.available
        return {k: int(remaining * v) for k, v in sections.items()}

    def truncate_to_budget(self, text: str, max_tokens: int, keep_end: bool = False) -> str:
        """Truncate text to fit within token budget. Smart sentence-boundary truncation."""
        tokens = count_tokens(text)
        if tokens <= max_tokens:
            return text

        # Rough char estimate: ~4 chars per token
        target_chars = max_tokens * 4
        if keep_end:
            truncated = text[-target_chars:]
            # Find first sentence boundary
            for sep in [". ", ".\n", "\n\n"]:
                idx = truncated.find(sep)
                if idx != -1 and idx < len(truncated) // 3:
                    truncated = truncated[idx + len(sep):]
                    break
            return "..." + truncated
        else:
            truncated = text[:target_chars]
            # Find last sentence boundary
            for sep in [". ", ".\n", "\n\n"]:
                idx = truncated.rfind(sep)
                if idx != -1 and idx > len(truncated) * 2 // 3:
                    truncated = truncated[:idx + 1]
                    break
            return truncated + "..."
