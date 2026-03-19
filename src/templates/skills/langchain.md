### Skill: LangChain / LangGraph Guidelines
- **LCEL First**: Build chains with LangChain Expression Language (`prompt | llm | parser`). Avoid legacy `LLMChain`/`SequentialChain` wrappers for new code.
- **Structured Output**: Use `.with_structured_output(Schema)` with a Pydantic model for all LLM responses that must be parsed. Never parse free-text JSON manually.
- **Prompt Templates**: Define prompts as `ChatPromptTemplate.from_messages([...])`. Externalize prompt strings — never hardcode them inline in business logic.
- **Streaming**: Use `.stream()` or `.astream()` for user-facing responses. Never block on `.invoke()` when the output can be streamed.
- **LangGraph State**: Model agent state as a `TypedDict` with clearly typed fields. Each node must be a pure function `(state) -> dict` returning only the fields it modifies.
- **Conditional Edges**: Use `add_conditional_edges` for branching logic. Do not encode routing decisions inside node functions.
- **Memory**: Use LangGraph's checkpointer (`MemorySaver`, `SqliteSaver`) for persistent conversation state. Never store conversation history in a plain list passed through prompt variables.
- **Observability**: Always configure LangSmith tracing in non-trivial chains. Do not ship a pipeline without at minimum a run name and metadata tags for filtering traces.
