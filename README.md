# jtoo - jump tournament obs overlay

https://jtoo.mmarc.net/

<img width="1920" height="1080" alt="matchoverlay" src="https://github.com/user-attachments/assets/be6796c3-9912-42fb-87ae-ab476e86d028" />

_discord overlay, chat overlay, and gameplay not included_

<details>
        <summary>Preview</summary>
        <img width="768" height="939" alt="image" src="https://github.com/user-attachments/assets/58bbdca2-3c80-4ed2-99ed-060292821261" />
        <img width="1594" height="900" alt="image" src="https://github.com/user-attachments/assets/1ab24d2b-2601-4445-aed4-f6ceb801839f" />
        <img width="1594" height="896" alt="image" src="https://github.com/user-attachments/assets/8ba34cfd-0ee5-4a72-b0b2-ee38ff7d9166" />
        <img width="1594" height="900" alt="image" src="https://github.com/user-attachments/assets/fab27d43-7cfc-4c34-b14d-430b67bb5692" />
        <img width="1595" height="900" alt="image" src="https://github.com/user-attachments/assets/fe2707f5-9bf0-43f3-82fd-f58825060c84" />
        <img width="1586" height="900" alt="image" src="https://github.com/user-attachments/assets/8d7f4ee5-b3a1-4c95-9ae9-5601a26b9abd" />
</details>

## usage

1. navigate to `Docks -> Custom Browser Docks`
2. add [https://jtoo.mmarc.net/controls](https://jtoo.mmarc.net/controls)
3. navigate to `Sources -> Add Source -> Browser`
4. add the following urls with a width of 1920 and height of 1080, disable custom css
   - [https://jtoo.mmarc.net/overlay](https://jtoo.mmarc.net/overlay) - the main overlay, switch between scenes (match, leaderboard, etc.) from the controls dock
   - [https://jtoo.mmarc.net/mini-leaderboard](https://jtoo.mmarc.net/mini-leaderboard) - optional standalone mini leaderboard

that's all! you can access overlay controls in `Docks`

## contributing

contributions are welcome! here's how to get a local copy running and find your way around.

### prerequisites

- [node.js](https://nodejs.org/) 22 or newer
- a [steam web api key](https://steamcommunity.com/dev/apikey) (used to fetch player names and avatars)
- optional: a KSN / Jump Fortress websocket token
  - used for live timer, checkpoint, and progress data. these aren't public, so DM mmarc (`@itsmmarc`) or Kingstripes (`@kingstripes`) on discord to request one. most ui work doesn't need them
- optional: a [JF Relay](https://github.com/jump-fortress/jf-relay-plugin) websocket token
  - syncs the ingame spectator clients with the player selection on the controls dock (i.e. selecting a player on the controls dock automatically spectates that player ingame). not needed for any ui work
- optional: automatic obs scene switching
  - if you enable obs websocket (`Tools -> WebSocket Server Settings`) and enter its details in the controls dock, jtoo will switch obs to the scene with the same name as the selected overlay scene (e.g. `DualPovMatchScene`).

### setup

1. fork the repo and clone your fork
2. install dependencies

   ```sh
   npm install
   ```

3. create a `.env` file in the project root with your steam key. if you plan to run the app through wrangler (cloudflare's local runtime), put the same line in `.dev.vars` too. both files are gitignored

   ```sh
   STEAM_API_KEY=your_key_here
   ```

4. start the dev server

   ```sh
   npm run dev
   ```

5. open `http://localhost:5173/controls` and `http://localhost:5173/overlay` in the **same browser**. the two pages share state through `localStorage`, so changes in controls show up on the overlay straight away. paste websocket tokens into the controls page if you have them

### scripts

| command           | what it does                                  |
| ----------------- | --------------------------------------------- |
| `npm run dev`     | start the vite dev server with hot reload     |
| `npm run build`   | production build (cloudflare adapter)         |
| `npm run preview` | preview the production build locally          |
| `npm run check`   | type-check with `svelte-check`                |
| `npm run lint`    | check formatting (prettier) and lint (eslint) |
| `npm run format`  | auto-format everything with prettier          |

run `npm run format`, `npm run lint` and `npm run check` before opening a pull request. if you use vscode, install the recommended extensions (svelte, prettier, eslint, tailwind) when prompted.

### project tour

built with [sveltekit](https://svelte.dev/docs/kit) (svelte 5 runes), [tailwind css v4](https://tailwindcss.com/) with [catppuccin](https://catppuccin.com/), and deployed to cloudflare.

```
src/
├── routes/
│   ├── controls/          # obs dock ui for controlling the overlay
│   ├── overlay/           # browser source; renders the active scene (selected in controls dock)
│   ├── mini-leaderboard/  # standalone mini leaderboard browser source
│   └── api/               # server endpoints that proxy steam / tempus plaza (keeps the api key server-side)
└── lib/
    ├── scenes/            # full-screen overlay scenes (DualPovMatchScene, LeaderboardScene, ...)
    ├── components/        # ui pieces: controls/, match/, maps/, util/
    ├── websockets/        # console live feeds, ksn pick & bans, jf relay, and obs websocket clients
    ├── api/               # client wrappers for steam, tempus2, tempus plaza
    ├── console-pools.svelte.ts  # imports the event's players and maps from console pools
    ├── storage.svelte.ts  # persisted app state: settings, overlay, items, pool
    └── types.svelte.ts    # shared types, including the list of overlay scenes
```

**how state flows:** `storage.svelte.ts` exports `settings`, `overlay`, and `items` as `PersistentState` objects backed by `localStorage`. the controls page writes to them and the overlay reads from them. in obs, every browser source/dock on the same domain shares that storage, which is how the dock drives the overlay without a backend.

**where race and tournament data comes from:** the console. each page opens its own server-sent event streams (`/live/race`, `/live/tournament/:id`) with the obs token, so timers, leaderboards, rounds and standings are whatever the console publishes. the event's players and maps are imported on startup from a console player pool and map pool (set under items in the controls). brackets are made on their own in the controls, from those players.

**adding a new scene:**

1. create `src/lib/scenes/YourScene.svelte`
2. add `'YourScene'` to `OverlayScenes` in `src/lib/types.svelte.ts`
3. register it in `sceneComponents` in `src/routes/overlay/+page.svelte`

it will then appear in the scene picker in controls. scenes listed in `BrokenOverlayScenes` are hidden from the picker. these were not updated with the last large refactor since the event didn't need them, but they need to be updated soon

### pull requests

1. branch off `dev` (e.g. `feat/my-feature` or `fix/some-bug`)
2. commit your changes and push to your fork
3. open a pull request **into `dev`**, not `main`. `main` is what's live on jtoo.mmarc.net

include screenshots for visual changes. it makes review a lot faster.

## deployment

```sh
npm run build
```

builds with `@sveltejs/adapter-cloudflare`. the production site needs `STEAM_API_KEY` set as an environment variable/secret in cloudflare.
