# CoreWise-AI documentation

GitHub repository: <https://github.com/Abhish0030/CoreWise-AI>

Open the repository root as an Obsidian vault. The shared `.obsidian` directory contains the original app, appearance, core-plugin, and graph settings. Workspace layouts remain local and are ignored. Documentation is maintained collaboratively through branches and reviewed pull requests.

```text
CoreWise-AI/
|-- README.md
|-- LICENSE
|-- CONTRIBUTING.md
|-- DOCUMENTATION.md
|-- .gitignore
|-- .obsidian/
|   |-- app.json
|   |-- appearance.json
|   |-- core-plugins.json
|   |-- graph.json
|   `-- obsidian-git.example.json
`-- docs/
    |-- 00-Dashboard/
    |-- 01-Research/
    |-- 02-COA-Concepts/
    |-- 03-Mathematics/
    |-- 04-Machine-Learning/
    |-- 05-Agentic-AI/
    |-- 06-System-Architecture/
    |-- 07-Implementation/
    |-- MIGRATION-LINK-AUDIT.md
    `-- original PNG attachments
```

| Folder | Contents |
| --- | --- |
| `00-Dashboard` | Project overview and navigation |
| `01-Research` | Papers, literature review, and research gaps |
| `02-COA-Concepts` | CPU/GPU architecture, memory, parallelism, and Amdahl's law |
| `03-Mathematics` | Execution time, speedup, throughput, and performance metrics |
| `04-Machine-Learning` | Data, features, algorithms, training, and evaluation |
| `05-Agentic-AI` | Agent design, recommendations, and LangGraph workflow |
| `06-System-Architecture` | Overall architecture, frontend, backend, and API design |
| `07-Implementation` | Team tasks, roadmap, and frontend mockups |

Start at [Project Overview](docs/00-Dashboard/Project-Overview.md.md). For clone commands, Obsidian Git installation, authentication, branch usage, automation safeguards, conflict resolution, and pull requests, see [CONTRIBUTING.md](CONTRIBUTING.md).

## Migration and link policy

The import contains 31 original Markdown notes and 9 original PNG attachments. The original vault is retained separately and backed up outside this repository. Existing `README.md`, `LICENSE`, history, and branches are preserved.

Original filenames, including `.md.md`, are retained to avoid an unnecessary rename migration. Resolvable wiki links and image embeds were converted to relative Markdown links with URL-encoded paths; note content and code fences were otherwise preserved. This makes links usable in both GitHub and Obsidian. All attachments keep their original bytes and names under `docs`.

The [migration link audit](docs/MIGRATION-LINK-AUDIT.md) lists 82 pre-existing unresolved references to 11 absent note targets. These are documentation gaps requiring an author decision; the import does not create empty placeholder notes or guess equivalent topics. Bare wiki references to those absent targets remain unresolved. The audit verifies file targets, not external website availability or every heading anchor.

For future notes, use standard relative Markdown links, keep attachments in this documentation tree, and preview changes before committing. Example from an implementation note: `![Mockup](../Landing%20Page%402x.png)`. When moving or renaming a note, update inbound references and review the diff.

## Contribution workflow

1. Pull `main`, create your own `docs/name-topic` branch, and edit in Obsidian.
2. Review the changed files and check links, images, and secrets before committing.
3. Push your branch and open a pull request targeting `main`.
4. A teammate reviews and a maintainer merges. Contributors then fetch and merge updated `main` into their branches.

Obsidian Git can commit and push every 10 minutes on an individual contributor branch after activation. Startup pull is enabled, periodic pull is disabled, and pull-before-push uses merges. Conflicts require human resolution. The prepared settings do nothing until the plugin is installed and enabled; do not activate it before initial push approval.
