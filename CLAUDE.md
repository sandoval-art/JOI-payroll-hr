## graphify

This project has a graphify knowledge graph at graphify-out/.

Obsidian vault: graphify-out/obsidian/ — open in Obsidian (Cmd+G for graph view) to visually explore the codebase. To rebuild: `graphify build . --obsidian` from the project root.

Rules:
- Before answering architecture or codebase questions, read graphify-out/GRAPH_REPORT.md for god nodes and community structure
- If graphify-out/wiki/index.md exists, navigate it instead of reading raw files
- For cross-module "how does X relate to Y" questions, prefer `graphify query "<question>"`, `graphify path "<A>" "<B>"`, or `graphify explain "<concept>"` over grep — these traverse the graph's EXTRACTED + INFERRED edges instead of scanning files
- After modifying code files in this session, run `graphify update .` to keep the graph current (AST-only, no API cost)
