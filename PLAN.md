# D3: {game title goes here}

# Game Design Vision

{a few-sentence description of the game mechanics}

# Technologies

- TypeScript for most game code, little to no explicit HTML, and all CSS collected in common `style.css` file
- Deno and Vite for building
- GitHub Actions + GitHub Pages for deployment automation

# Assignments

## D3.a: Core mechanics (token collection and crafting)

Key technical challenge: Can you assemble a map-based user interface using the Leaflet mapping framework?
Key gameplay challenge: Can players collect and craft tokens from nearby locations to finally make one of sufficiently high value?

### Steps

- [x] copy `src/main.ts` to `reference.ts` for future reference
- [x] delete everything in `src/main.ts`
- [x] put a basic Leaflet map on the screen
- [x] add the player marker at the classroom location
- [x] draw one rectangular grid cell on the map
- [x] draw a grid of nearby/spread cells using loops
- [x] show token/value on each cell deterministically using `luck(seed)`
- [x] allow clicking a nearby cell to pick up a token (max 1 in inventory)
- [x] allow placing a held token onto an equal-value cell token to combine (double value)

## D3.b: Dynamic map and player movement

Key technical challenge: Can you implement dynamic cell spawning/despawning as the player moves around the map?
Key gameplay challenge: Can players navigate the map to find and combine tokens strategically?

### Steps

- [x] create a data type (CellId) to represent grid cells as i,j pairs
- [x] create functions to convert lat/lng to cell coordinates and vice versa
- [x] add movement buttons to move player one grid step
- [x] track player's current cell position separately from marker position
- [x] implement map moveend event listener to detect when map finishes moving
- [x] dynamically spawn and despawn cells based on visible area
- [x] display inventory/status and a win message when held token >= target (e.g., 16)
- [x] cells forget their state when despawned (memoryless behavior)
- [x] cells change color when player moves closer or further away
- [x] cells become interactive only when player is close enough to pick up token

## D3.c: Object persistence

Key technical challenge: Can you implement efficient memory management using the Flyweight pattern and cell state persistence using the Memento pattern?
Key gameplay challenge: Can players experience persistent cell state as they navigate the map?

### Steps

- [x] create a Cell data type to model cell state (coordinates + token value) separately from visual representation
- [x] create a Map<CellId, Cell> to store the state of all cells (modified and unmodified)
- [x] refactor to rebuild cell visuals from the state Map on each map movement
- [x] implement state persistence: when a cell is modified (token picked up or combined), update the state Map
- [ ] implement state restoration: when a cell comes back into view, restore its state from the Map
- [ ] cells with unmodified state (not in the Map) don't use memory until modified
- [ ] test that cell states persist when scrolling off-screen and returning
