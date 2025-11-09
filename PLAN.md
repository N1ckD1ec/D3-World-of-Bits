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
- [ ] show token/value on each cell deterministically using `luck(seed)`
- [ ] allow clicking a nearby cell to pick up a token (max 1 in inventory)
- [ ] allow placing a held token onto an equal-value cell token to combine (double value)
- [ ] display inventory/status and a win message when held token >= target (e.g., 16)
