# Contributing to CoreWise-AI

Documentation changes follow: contributor branch -> GitHub pull request -> review -> `main`.
Each person uses a separate clone and branch. Do not share a working directory through OneDrive or other file synchronization while Git is managing it.

## Clone and open the vault

Install Git and Obsidian, then run:

```sh
git clone https://github.com/Abhish0030/CoreWise-AI.git
cd CoreWise-AI
git config user.name "Your Name"
git config user.email "your GitHub verified email"
git switch main
git pull --ff-only origin main
git switch -c obsidian/your-name-topic
```

In Obsidian, choose **Open folder as vault** and select `CoreWise-AI/obsidian`. It contains the documentation, original notes and attachments, and `.obsidian` settings. Run Git commands from the repository root `CoreWise-AI`; the Git repository still covers the complete application.
Start with [the project overview](00-Dashboard/Project-Overview.md.md) and [the documentation guide](DOCUMENTATION.md).
Existing names ending in `.md.md` are retained from the original vault; do not rename them without updating references.

## Edit, review, commit, and push

Before each editing session, run `git status`, then `git pull --ff-only` on your branch once it has an upstream.
Save notes under the appropriate `obsidian` subfolder. Keep attachments in that vault, and use relative Markdown links so GitHub and Obsidian both render them.
Preview changed notes and images in Obsidian and review the Git diff. Do not add credentials or confidential information: this repository is public.

```sh
git status
git diff
git add obsidian
git diff --cached --stat
git diff --cached
git commit -m "docs: explain the workload prediction workflow"
git push -u origin obsidian/your-name-topic
```

Stage only files you actually intend to contribute; the paths above are examples. Never force-push.
On GitHub, open **Pull requests -> New pull request**, set base to `main` and compare to your branch, describe the changes and link checks, and request review. Address review feedback with new commits to the same branch. A maintainer merges the approved PR.

To incorporate changes from `main`, first commit your work, then run:

```sh
git fetch origin
git merge origin/main
git push
```

## Install and configure Obsidian Git

Only activate automation after the initial migration push has been approved and completed, and after your own feature branch has an upstream. Do not enable it on `main`.

1. In Obsidian **Settings -> Community plugins**, enable community plugins if needed, select **Browse**, search for **Git** by **Vinzent**, and install it. Leave it disabled while configuring.
2. Close this vault. In PowerShell from the repository root, run:

   ```powershell
   New-Item -ItemType Directory -Force obsidian/.obsidian/plugins/obsidian-git | Out-Null
   Copy-Item obsidian/.obsidian/obsidian-git.example.json obsidian/.obsidian/plugins/obsidian-git/data.json
   ```

   For an existing plugin configuration, back up `data.json` first and merge these keys instead of replacing it. This migration's clone already has the configuration file prepared; contributors on new clones must copy the template.

3. Reopen the vault and enable **Git**. Verify the settings match the table below. Plugin `data.json` and binaries are local and ignored by Git.
4. Authenticate Git using your operating system's credential manager or GitHub CLI: `gh auth login --hostname github.com --git-protocol https --web`, then `gh auth setup-git`. Confirm `gh auth status`. A successful `git push -u origin YOUR_BRANCH` verifies write access. Never put tokens into notes, plugin settings, or remote URLs. Each contributor needs repository write permission or must use a fork and PR.

| Setting                                     | Value                                          |
| ------------------------------------------- | ---------------------------------------------- |
| Automatic commit-and-sync / backup interval | 10 minutes                                     |
| Separate commit and push intervals          | Off                                            |
| Push after backup (`disablePush`)           | Enabled (`false`)                              |
| Pull on startup                             | On                                             |
| Periodic automatic pull                     | Disabled (`0`)                                 |
| Separate automatic push interval            | Disabled (`0`; push occurs in commit-and-sync) |
| Pull before push                            | On                                             |
| Sync method                                 | Merge                                          |
| Commit after stopping file edits            | Off; use the fixed interval                    |
| Automatic message                           | `docs: automatic backup {{date}}`              |

The template uses the plugin's [published settings schema](https://github.com/Vinzent03/obsidian-git/blob/master/src/constants.ts). The plugin is not bundled or automatically enabled.

One contributor owns each branch. Timed commit-and-sync may commit all eligible changed files in the vault, including application files added later; disable automation during application development or when unrelated changes are present. Pause automatic sync before merging, resolving conflicts, rebasing, or switching branches, and during periods without approved publishing authorization. Startup pull uses the plugin's merge behavior; begin with a clean working tree and check its notifications before editing. Do not run a second synchronization tool or concurrent Git operations on the same clone.

## Resolve merge conflicts

Pause Obsidian Git automation. Run `git status` to find conflicted paths. Open each text file and resolve the `<<<<<<<`, `=======`, and `>>>>>>>` sections with the other author; keep the intended combined content and remove markers. For images, agree on one version or keep both with distinct names and repair references. Never concatenate binary files.

```sh
git diff --check
git add path/to/resolved-note.md
git commit
git push
```

Verify the resolved note and its links in Obsidian. If you cannot resolve a merge, preserve your edits in a separate backup before `git merge --abort` and ask the other author for help. Resume automation only after `git status` is clean and your branch is correct.

## Recommended repository protection

Maintainers should protect `main` in **Settings -> Rules -> Rulesets** (or branch protection): require pull requests, at least one approval, resolution of conversations, and renewed approval after material changes. Block force pushes and branch deletion; apply protection to maintainers where practical. Add required status checks once actual documentation checks exist. These are recommendations; this migration does not change GitHub administration settings.
