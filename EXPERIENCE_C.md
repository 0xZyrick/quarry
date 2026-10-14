# QUARRY — Experience C product alignment

## Entry paths (both natural)
1. Mosaic → project history → live (optional) → Follow → return on change
2. Creator profile → several projects → Follow one

## Five core objects

| # | Object | Implementation |
|---|--------|----------------|
| 01 | **Work Discovery** | `NarrativeMosaic` — cards with Intent/goal, not bare rooms |
| 02 | **Creator** | `CreatorJourney` + `GET /api/creators/[handle]` — identity + project stories |
| 03 | **Project Journey** | `Project` + `JourneyNode` + `ProjectWorkspace` / `JourneyRail` |
| 04 | **Work Session** | `WorkSession` model + `POST /api/sessions` + live link via Launch + `LiveSessionContext` |
| 05 | **Participation** | Follow, structured contributions, creator contact via cockpit |

## Launch Portal (redesigned)
Starts with **what to share**, not room type:
1. Start or update a project  
2. Work live (optional project link)  
3. Share a quick discovery  

Then: which project · lightweight context · public/private.

## Context triad (lightweight)
On Project and WorkSession:
- **Goal** (`intentStatement` / `goal`) — required when starting a project  
- **Current state** (`currentState`) — optional  
- **Next step** (`nextStep`) — optional  

No long form before the creator can work.

## Spectator experiences

| Entry | UI |
|-------|-----|
| Short clip | `ClipSpectator` — clip + goal + next steps (project / creator / follow). **No** milestone ladder. |
| Project | `ProjectWorkspace` — Goal / Now / Next + chronological journey |
| Live session | Existing room + `LiveSessionContext` strip (context without project-manager overload) |
| Private Work Room | `visibility: PRIVATE` — never listed on public Mosaic/sessions API |

## Permissions
- Public discovery endpoints filter `visibility: PUBLIC` only  
- Private sessions: quiet room + no Mosaic indexing  

## Run
```bash
npm install && cp .env.example .env
npx prisma generate && npx prisma migrate deploy
npm run dev
```
