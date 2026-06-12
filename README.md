# YouTube Arena Playable

A step-by-step YouTube Playables-style top-down arena game built with TypeScript, Phaser 3, and Vite.

## Current Milestone

Current build includes optional WebSocket multiplayer test mode:

- Vite + Phaser + TypeScript scaffold
- Boot, menu, how-to-play, upgrades, match placeholder, and results placeholder scenes
- YouTube Playables-safe bridge wrapper
- Local storage-backed progress data for coins and permanent upgrades
- Responsive browser canvas
- Controllable top-down player in the match scene
- WASD and arrow-key movement
- Mouse aiming with a visible reticle
- Arena bounds that keep the player inside the playable area
- Weapon definitions for pistol, SMG, shotgun, and rifle
- Active pistol with finite ammo
- Left-click shooting with bullet travel and range expiry
- Weapon/ammo HUD in the match scene
- Enemy combat targets with shield and health
- Bullet collision against targets
- Shield-first damage, health damage, death feedback, and hit numbers
- Score and kill tracking in the match HUD
- Weapon pickups for SMG, shotgun, and rifle
- Per-weapon ammo tracking
- Press `E` near a weapon to pick it up
- Press `1` through `4` to switch collected weapons
- Each weapon uses its own fire rate, range, spread, pellets, and ammo capacity
- Targets carry simple loadouts
- Eliminated targets drop their weapon with remaining ammo
- Eliminated targets also drop armor shards and coin shards
- Press `E` near dropped loot to collect it
- Loot collection updates match score and loot HUD values
- Player health and shield stats are now tracked in the match
- Health and shield bars are shown in the HUD
- Upgrade levels modestly increase match health and shield
- Shield, ammo, and combo recharge pickups are available in the arena
- Armor shards now restore shield when collected
- Ammo recharge restores the active weapon without making ammo infinite
- Rival targets now move as basic bots
- Bots maintain rough combat range from the player
- Bots fire their loadout weapons with limited ammo
- Bot bullets damage the player shield first, then health
- The player can now be eliminated
- Bots now evaluate simple objectives each frame
- Low-health or low-shield bots flee or seek recharge
- Low-ammo bots seek weapon or ammo pickups
- Bots can collect weapon pickups, recharge pickups, and dropped loot
- Pickups are removed from the arena when bots collect them, creating resource competition
- Matches now end on player elimination or all bots eliminated
- Final score includes earned gameplay score, eligible survival bonus, and win bonus
- Score converts into saved coins after each match
- Progress saves total matches, total wins, best score, and coin balance
- Results screen shows score, rewards, combat stats, and progress
- Results screen links to play again, upgrades, or menu
- A visible safe zone now appears over the arena
- Safe zone shrinks through timed phases
- HUD shows safe-zone radius and shrink timing
- Player takes shield-first damage outside the zone
- Bots take damage outside the zone
- Bots bias movement toward the safe center when outside or near the zone edge
- Matches now start with a short countdown before combat, bots, timer, and zone damage activate
- Player can still move, aim, and collect nearby supplies during the countdown
- Safe-zone timing has been slowed for a fairer early match
- Bot fire rate and damage have been softened to reduce sudden eliminations
- Starting weapon ammo, weapon pickups, and recharge pickups have been tuned upward
- Player damage now uses damage text and sound feedback without camera shake
- Lightweight Web Audio sound effects now run without external audio files
- Shared UI buttons play click feedback
- Match countdown, match start, shooting, empty ammo, hits, eliminations, pickups, recharge, weapon switching, zone damage, victory, and defeat now have sound cues
- Match HUD includes `M: Sound On/Off` for muting audio
- Sound mute preference is stored locally when available
- On-screen touch controls are now available in the match scene
- Left virtual stick controls movement
- Touch fire button shoots with aim assist
- Touch `E` button collects nearby pickups and loot
- Touch `>` button cycles through collected weapons
- Touch-control pointers no longer interfere with mouse aiming or shooting
- How To Play now documents the touch controls
- Match HUD now includes a pause button
- `P` and `Esc` toggle pause during a match
- Pause overlay supports resume, restart, and menu actions
- Gameplay systems stop advancing while paused, including bots, bullets, countdown, match timer, safe zone, and damage ticks
- Resume shifts gameplay timestamps forward by the paused duration so cooldowns and zone timing do not jump
- Browser tab visibility and window blur now pause the match
- Playables bridge pause/resume callbacks are connected to match pause/resume
- Active touch inputs are cleared when pausing so virtual buttons cannot remain stuck
- First-time players now get a compact in-match tutorial guide
- Tutorial steps react to real actions: move, shoot, collect, switch weapons, and learn the safe zone
- Tutorial can be skipped from the guide panel
- Tutorial completion is saved with progress so it does not repeat every match
- If the match ends before the tutorial is completed or skipped, the guide can appear again next match
- How To Play now mentions the first-match guide
- Safe-zone timing and final radius were tuned for fairer mobile play
- Outside-zone player damage is slightly more decisive, while bots still take steady zone damage
- Bot fire pressure and damage multiplier were tuned for a cleaner late match
- Damage, kill, survival, win, weapon-pickup, and coin conversion values now use named balance constants
- Score-to-coin conversion is faster so short matches still feed the upgrade loop
- Health and shield upgrades now provide stronger per-level gains
- Ammo Efficiency now affects real gameplay with a scaling ammo-preserve chance
- Upgrade descriptions and costs were updated to match the tuned economy
- Menu screen now opens with a code-drawn arena hero scene instead of a plain preview card
- Home graphics include animated safe-zone rings, rival/player silhouettes, loot, bullet tracers, and richer accent lighting
- Main navigation was rearranged so Play is the clear primary action, with How To Play and Upgrades beneath it
- Computer players can now fire with `Space` or left click; aiming stays controlled by the mouse cursor
- Support pickups now include health packs as well as ammo, shield, and combo supply packs
- Support pickups appear at random match intervals, with low health, shield, or ammo increasing the chance of the relevant item
- Bots can also evaluate and collect the new support pickups, keeping resource pressure active
- Rival bots now target the nearest living opponent instead of always targeting the player
- Bot-fired bullets can damage and eliminate other rivals
- Rival eliminations caused by other rivals drop loot and can still end the match in victory when you are the last survivor
- Match arena now has a layered battlefield floor, tile grid, colored pads, and stronger boundary lighting
- Safe-zone graphics now pulse with layered blue and red rings for clearer pressure
- Player and rival sprites now have stronger outlines, glow, and visual accents
- Bullets use clean projectile visuals without decorative sparkle trails
- Weapons, loot, health, shield, ammo, and supply pickups now glow and float to draw attention
- Pickup bursts use clean rings, while muzzle flashes stay simple
- Player and rivals are now rendered as top-down tanks instead of circular characters
- Tank chassis rotates toward movement direction while turrets aim independently
- Tank tread details animate while moving so movement reads clearly
- Bullet visuals were simplified again so tank silhouettes, movement, and aiming are the focus
- Health, shield, ammo, and supply absorption now uses a clean pulse instead of sparkle lines
- Low-survival bots no longer flee directly into arena walls when already near an edge
- Bot tank movement now detects boundary stalls and nudges the bot back into playable space
- Match HUD text was moved inward, shortened, and wrapped so weapon, ammo, score, and zone text stay inside the visible canvas
- Random support pickups now spawn inside the current safe zone instead of anywhere in the arena
- Pickups that fall outside the shrinking safe zone are cleaned up, with late-game support pickups maintained inside the circle
- Bot tanks now track recent movement and recover toward a safe-zone point if they appear stuck
- Destroyed tanks now play a heavier blast sound
- Camera shake on player hits and zone damage has been removed
- How To Play was redesigned with compact controls, match goals, and a tank arena preview
- Home preview now uses animated top-down tanks instead of labeled circles
- Menu preview labels such as `YOU`, `R1`, `R2`, and `R3` were removed
- Preview tanks now patrol and fire looping projectiles for a more active first screen
- Game branding now uses `Arena Zone` and `Survive the Zone` wording on visible screens
- Extra menu preview captions were removed so the hero area looks cleaner
- Shared UI buttons now use layered glow, gradient fills, border highlights, and hover/press feedback
- Home preview bullets now spawn, travel, and disappear instead of waiting visibly at the muzzle
- The home arena frame and outer hero panel now use more of the available window area
- Menu buttons were resized and given stronger game-style side accents, bevels, and smaller dynamic text
- Home menu buttons were reduced again so they take less vertical space
- Button colors now match the dark panel and cyan outline style of the game window
- Button text no longer uses blur-prone stroke, shadow, or hover scaling
- Health Boost, Shield Boost, and Ammo Efficiency no longer stop at level 5
- Each upgrade purchase increases that upgrade by +1 level
- Upgrade costs now start at 100 coins and increase by 10 coins per current level
- Upgrade rows now show only the current level, such as `Level 3`
- Health Boost now adds +1 max health per level
- Shield Boost now adds +1 max shield per level
- Ammo Efficiency now uses a no-cap scaling curve so higher levels keep improving ammo preservation
- The Upgrades header now shows coins only; the old overall player level display was removed
- Home title, subtitle, preview panel, and menu buttons were spaced so the subtitle remains visible
- Match HUD now shows only the active weapon and its current ammo instead of listing every weapon slot
- Match HUD combat details now sit in a single top row with compact health and shield bars
- Rival bots now spread around unique safe-zone positions instead of all pathing to the exact center
- Rival bots also separate from nearby rivals when they cluster during late-zone combat
- Play and Play Again now enter a Battle Lobby before starting the arena
- The normal lobby waits for up to 8 total tanks or a 30-second timer, whichever completes first
- Bot entrants remain the default fallback for the YouTube-safe/static build
- Match startup now receives the lobby player count and can spawn up to 7 rivals for an 8-player arena
- Lobby slots now show tank-style player cards instead of plain text entries
- The lobby now shows clearer full/late-start status messages while players join
- The arena starts with a clear `3`, `2`, `1`, `Battle Begin` countdown before live combat begins
- The lobby explains that the match starts when either condition is satisfied
- Match results now include a battle-royale standings table
- The Results screen shows position, player name, score, and coins earned for each tank
- The old detailed kills, damage, shard, match-total, and saved-coins message was removed from the visible result panel
- Rival score records now track bot damage, eliminations, pickups, loot coins, and survival time
- Standings now sort by final score so higher-scoring tanks appear above lower-scoring tanks
- Passive survival alone no longer awards score or coins when the player is eliminated without earning gameplay score
- Survival bonus for the player now applies only after earning gameplay score or winning the match
- Damage score is now `damage * 1.2`
- Rival eliminations now award `50` score
- Weapon pickups now award `10` score
- Armor shard collection now awards `shards * 5` score
- Coin shard collection now awards `shards * 2` score
- Recharge pickups now award restored health + restored shield + restored ammo
- Survival bonus is now `1` point per survived second when eligible
- Last survivor bonus is now `50`
- Coins earned now use `floor(final score / 15) + coin shards`
- How To Play now uses a more game-like full-screen layout instead of a static card view
- The instruction panel now has compact control and match sections with stronger visual grouping
- The arena preview now includes animated tanks, pulsing zone rings, moving projectiles, glowing supplies, and tread/turret motion
- A compact match-flow strip shows the core loop from drop-in to last tank standing
- Results now label the standings as `Score Rank`/`RANK` so a victory screen is not confused with survival placement when an eliminated rival has a higher score
- Match touch controls now appear automatically only on coarse-pointer/mobile devices so desktop play keeps the arena clear
- Desktop testing can force touch controls with `?touch=1` when needed
- How To Play now documents Space or left-click firing with mouse aiming
- Optional multiplayer test mode starts when the URL includes `?mp=1` or `?mp=ws://host:port`
- Multiplayer mode connects to a small WebSocket server for shared lobby, live movement, live firing, health, eliminations, and standings
- If multiplayer is requested but the server is unavailable, the game falls back to the normal bot lobby
- Multiplayer waits for at least 2 real socket players before launching so one player does not get an instant one-player victory

YouTube Playables packaging comes in the next milestones.

## Setup

```bash
npm install
```

## Run Locally

```bash
npm run dev
```

Open the local URL printed by Vite.

For phone testing on the same Wi-Fi, run the LAN dev server instead:

```bash
npm run dev:lan
```

Then open `http://YOUR_PC_LAN_IP:5173/` on the phone.

## Optional Multiplayer Test

Terminal 1:

```bash
npm run dev
```

Terminal 2:

```bash
npm run multiplayer
```

Then open:

```text
http://127.0.0.1:5173/?mp=1
```

For phone testing on the same Wi-Fi, use:

```bash
npm run dev:lan
npm run multiplayer
```

Then open this on each device:

```text
http://YOUR_PC_LAN_IP:5173/?mp=ws://YOUR_PC_LAN_IP:8787
```

GitHub Pages is static hosting, so it cannot run the multiplayer server. For internet sharing, the frontend must point to a deployed secure WebSocket backend using `?mp=wss://YOUR_SERVER`.

## Build

```bash
npm run build
```

The production build is generated in `dist/`.

## YouTube Playables Notes

The project is structured so the YouTube Playables SDK can be added through `PlayablesBridge` without coupling gameplay code directly to the global SDK object.
