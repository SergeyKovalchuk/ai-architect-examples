# Publishing as a standalone GitHub repository

The project is ready to live in its own repo under your GitHub profile. The GitHub API token in this environment cannot create new repositories, so one manual step is required.

## Option A — Create repo on GitHub, then push (recommended)

1. On GitHub, create a new **empty** public repository named `match-assistant` (no README, no license — this repo already has both).

2. From this directory:

```bash
git remote set-url origin https://github.com/SergeyKovalchuk/match-assistant.git
git push -u origin main
```

## Option B — Import from the export branch

An export branch with this exact content is available at:

`https://github.com/SergeyKovalchuk/ai-architect-examples/tree/cursor/match-assistant-standalone-5df1`

```bash
git clone -b cursor/match-assistant-standalone-5df1 \
  https://github.com/SergeyKovalchuk/ai-architect-examples.git match-assistant
cd match-assistant
git checkout -b main
git remote set-url origin https://github.com/SergeyKovalchuk/match-assistant.git
git push -u origin main
```

## Verify after publishing

```bash
npm install
npm test
npm run serve
```
