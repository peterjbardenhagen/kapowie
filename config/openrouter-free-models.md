# OpenRouter — Best Free Models (June 2026)

**Last Updated:** 2026-06-26
**Source:** https://openrouter.ai/models?fmt=table&order=top-weekly

---

## Quick Reference

| Model | Context | Max Tokens | Best For | Quality |
|-------|---------|------------|----------|---------|
| `poolside/laguna-m.1:free` | 131K | 8K | General, coding | ★★★★☆ |
| `google/gemini-2.0-flash-001` | 1M | 8K | General, reasoning | ★★★★★ |
| `google/gemini-2.5-flash` | 1M | 8K | General, vision, long context | ★★★★★ |
| `anthropic/claude-3.5-sonnet` | 200K | 8K | Coding, reasoning | ★★★★★ |
| `anthropic/claude-3-haiku` | 200K | 4K | Fast, cheap tasks | ★★★★☆ |
| `openai/gpt-4o-mini` | 128K | 16K | General, coding | ★★★★☆ |
| `openai/gpt-4o` | 128K | 16K | Complex reasoning | ★★★★★ |
| `deepseek/deepseek-chat` | 64K | 8K | Coding, reasoning | ★★★★☆ |
| `deepseek/deepseek-r1` | 64K | 8K | Reasoning, math | ★★★★★ |
| `qwen/qwen-2.5-72b-instruct` | 32K | 8K | General, multilingual | ★★★★☆ |
| `qwen/qwen-2.5-coder-32b` | 32K | 8K | Coding specialist | ★★★★★ |
| `meta-llama/llama-3.1-405b` | 128K | 8K | General, long context | ★★★★☆ |
| `meta-llama/llama-3.1-70b` | 128K | 4K | General purpose | ★★★★☆ |
| `meta-llama/llama-3.1-8b` | 128K | 4K | Fast, lightweight | ★★★☆☆ |
| `mistralai/mistral-7b-instruct` | 32K | 4K | Fast, cheap | ★★★☆☆ |
| `mistralai/mixtral-8x7b` | 32K | 4K | MoE, good quality | ★★★★☆ |
| `nousresearch/hermes-3-llama-3.1-405b` | 128K | 8K | Hermes-tuned, general | ★★★★★ |
| `nousresearch/hermes-3-llama-3.1-70b` | 128K | 4K | Hermes-tuned, fast | ★★★★☆ |

---

## Detailed Breakdown

### Tier 1 — Best Overall (Use These First)

#### `google/gemini-2.5-flash`
- **Context:** 1,048,576 tokens (1M)
- **Max Output:** 8,192 tokens
- **Best For:** General tasks, long documents, vision, reasoning
- **Notes:** Excellent quality, very long context, fast. Best free model for most tasks.
- **Quality:** ★★★★★

#### `google/gemini-2.0-flash-001`
- **Context:** 1,048,576 tokens (1M)
- **Max Output:** 8,192 tokens
- **Best For:** General tasks, reasoning
- **Notes:** Slightly older but still excellent. Very reliable.
- **Quality:** ★★★★★

#### `anthropic/claude-3.5-sonnet`
- **Context:** 200,000 tokens
- **Max Output:** 8,192 tokens
- **Best For:** Coding, complex reasoning, analysis
- **Notes:** Best coding model available for free. Excellent instruction following.
- **Quality:** ★★★★★

#### `nousresearch/hermes-3-llama-3.1-405b`
- **Context:** 128,000 tokens
- **Max Output:** 8,192 tokens
- **Best For:** General tasks, Hermes-tuned behavior
- **Notes:** Specifically fine-tuned for Hermes Agent. Excellent tool use.
- **Quality:** ★★★★★

---

### Tier 2 — Great Quality (Good Fallbacks)

#### `openai/gpt-4o-mini`
- **Context:** 128,000 tokens
- **Max Output:** 16,384 tokens
- **Best For:** General tasks, coding, long outputs
- **Notes:** Fast, good quality, large output limit. Great all-rounder.
- **Quality:** ★★★★☆

#### `deepseek/deepseek-r1`
- **Context:** 64,000 tokens
- **Max Output:** 8,192 tokens
- **Best For:** Reasoning, math, logic problems
- **Notes:** Excellent reasoning capabilities. Competitive with o1.
- **Quality:** ★★★★★

#### `deepseek/deepseek-chat`
- **Context:** 64,000 tokens
- **Max Output:** 8,192 tokens
- **Best For:** General chat, coding
- **Notes:** Good quality, fast. Great for everyday tasks.
- **Quality:** ★★★★☆

#### `qwen/qwen-2.5-coder-32b`
- **Context:** 32,000 tokens
- **Max Output:** 8,192 tokens
- **Best For:** Coding specialist
- **Notes:** Excellent for code generation and debugging.
- **Quality:** ★★★★★

#### `meta-llama/llama-3.1-405b`
- **Context:** 128,000 tokens
- **Max Output:** 8,192 tokens
- **Best For:** General tasks, long context
- **Notes:** Largest open model. Good for complex tasks.
- **Quality:** ★★★★☆

---

### Tier 3 — Fast & Lightweight

#### `poolside/laguna-m.1:free`
- **Context:** 131,072 tokens
- **Max Output:** 8,192 tokens
- **Best For:** General tasks, coding
- **Notes:** Good quality free model. Reliable fallback.
- **Quality:** ★★★★☆

#### `meta-llama/llama-3.1-70b`
- **Context:** 128,000 tokens
- **Max Output:** 4,096 tokens
- **Best For:** General purpose
- **Notes:** Fast, good quality. Great for quick tasks.
- **Quality:** ★★★★☆

#### `meta-llama/llama-3.1-8b`
- **Context:** 128,000 tokens
- **Max Output:** 4,096 tokens
- **Best For:** Fast, lightweight tasks
- **Notes:** Very fast, decent quality. Good for simple queries.
- **Quality:** ★★★☆☆

#### `anthropic/claude-3-haiku`
- **Context:** 200,000 tokens
- **Max Output:** 4,096 tokens
- **Best For:** Fast, cheap tasks
- **Notes:** Quick responses, lower quality than Sonnet.
- **Quality:** ★★★★☆

#### `mistralai/mistral-7b-instruct`
- **Context:** 32,000 tokens
- **Max Output:** 4,096 tokens
- **Best For:** Fast, cheap
- **Notes:** Very fast, acceptable quality for simple tasks.
- **Quality:** ★★★☆☆

---

## Recommended Configurations

### For Coding Tasks

```yaml
providers:
  openrouter:
    default_model: anthropic/claude-3.5-sonnet
    models:
      - anthropic/claude-3.5-sonnet
      - qwen/qwen-2.5-coder-32b
      - deepseek/deepseek-chat
      - openai/gpt-4o-mini
```

### For General Tasks

```yaml
providers:
  openrouter:
    default_model: google/gemini-2.5-flash
    models:
      - google/gemini-2.5-flash
      - google/gemini-2.0-flash-001
      - anthropic/claude-3.5-sonnet
      - openai/gpt-4o-mini
```

### For Reasoning Tasks

```yaml
providers:
  openrouter:
    default_model: deepseek/deepseek-r1
    models:
      - deepseek/deepseek-r1
      - google/gemini-2.5-flash
      - anthropic/claude-3.5-sonnet
      - nousresearch/hermes-3-llama-3.1-405b
```

### For Vision Tasks

```yaml
providers:
  openrouter:
    default_model: google/gemini-2.5-flash
    models:
      - google/gemini-2.5-flash
      - anthropic/claude-3.5-sonnet
      - openai/gpt-4o
```

---

## Model Selection Strategy

### Priority Order (Fallback Chain)

1. **Primary:** `google/gemini-2.5-flash` — Best overall free model
2. **Coding:** `anthropic/claude-3.5-sonnet` — Best for code
3. **Reasoning:** `deepseek/deepseek-r1` — Best for logic/math
4. **Fast:** `openai/gpt-4o-mini` — Quick responses
5. **Lightweight:** `meta-llama/llama-3.1-8b` — Low resource usage

### When to Use Each Model

| Task Type | Recommended Model | Why |
|-----------|------------------|-----|
| Code generation | `claude-3.5-sonnet` | Best instruction following |
| Code review | `deepseek-r1` | Strong reasoning |
| General chat | `gemini-2.5-flash` | Natural, helpful |
| Long documents | `gemini-2.5-flash` | 1M context |
| Math/logic | `deepseek-r1` | Specialized reasoning |
| Vision | `gemini-2.5-flash` | Multimodal |
| Quick answers | `gpt-4o-mini` | Fast, good enough |
| Tool use | `hermes-3-405b` | Hermes-tuned |

---

## Notes

- **Free models** may have rate limits (typically 20-50 requests/minute)
- **Context length** affects cost and speed — use shorter contexts when possible
- **Model availability** changes frequently — check OpenRouter for latest
- **Quality ratings** are subjective and based on community feedback
- **Paid models** (not listed here) offer higher rate limits and priority

---

*For the latest model list, visit: https://openrouter.ai/models*
