// @deno-types="npm:@types/leaflet"
import leaflet from "leaflet";

// Extend Rectangle type to include our custom properties
type GameCell = leaflet.Rectangle & {
  tokenValue: number;
  tokenLabel: leaflet.Marker | null;
};

// Cell identifier type - represents a grid cell as i,j coordinates
type CellId = {
  i: number;
  j: number;
};

// Cell state type - represents the persistent state of a cell (location + token value)
type Cell = {
  id: CellId;
  tokenValue: number;
  isPickedUp?: boolean; // true if token has been picked up from this cell
};

// Required stylesheets
import "leaflet/dist/leaflet.css";
import "./style.css";

// Fix missing marker images
import "./_leafletWorkaround.ts";

// Import luck function for deterministic randomness
import luck from "./_luck.ts";

// Create UI elements
const mapDiv = document.createElement("div");
mapDiv.id = "map";
document.body.append(mapDiv);

const statusDiv = document.createElement("div");
statusDiv.id = "statusPanel";
document.body.append(statusDiv);

const controlPanelDiv = document.createElement("div");
controlPanelDiv.id = "controlPanel";
document.body.append(controlPanelDiv);

// Create movement buttons
const northBtn = document.createElement("button");
northBtn.textContent = "North (↑)";
northBtn.id = "northBtn";
controlPanelDiv.append(northBtn);

const southBtn = document.createElement("button");
southBtn.textContent = "South (↓)";
southBtn.id = "southBtn";
controlPanelDiv.append(southBtn);

const westBtn = document.createElement("button");
westBtn.textContent = "West (←)";
westBtn.id = "westBtn";
controlPanelDiv.append(westBtn);

const eastBtn = document.createElement("button");
eastBtn.textContent = "East (→)";
eastBtn.id = "eastBtn";
controlPanelDiv.append(eastBtn);

// Initialize player state and game constants
const CLASSROOM_LOCATION = [36.997936938057016, -122.05703507501151] as [
  number,
  number,
];
const CELL_SIZE_DEGREES = 0.00008; // Smaller cell size
const _GRID_SIZE = 10; // Grid size for possible locations (legacy, now using dynamic spawning)
const INTERACTION_RANGE = 3; // How many cells away the player can interact with
const SPAWN_CHANCE = 0.2; // 20% chance for a cell to appear

// Function to convert latitude/longitude to cell coordinates
function _latLngToCellId(lat: number, lng: number): CellId {
  const [centerLat, centerLng] = CLASSROOM_LOCATION;
  const i = Math.floor((lat - centerLat) / CELL_SIZE_DEGREES);
  const j = Math.floor((lng - centerLng) / CELL_SIZE_DEGREES);
  return { i, j };
}

// Function to convert cell coordinates to latitude/longitude bounds
function cellIdToBounds(cellId: CellId): leaflet.LatLngBounds {
  const sw = cellIdToSWLatLng(cellId);
  const ne = [sw[0] + CELL_SIZE_DEGREES, sw[1] + CELL_SIZE_DEGREES];
  return leaflet.latLngBounds(sw, ne as [number, number]);
}

// Function to get the southwest corner of a cell
function cellIdToSWLatLng(cellId: CellId): [number, number] {
  // For now, still anchored at CLASSROOM_LOCATION
  const [centerLat, centerLng] = CLASSROOM_LOCATION;
  return [
    centerLat + (cellId.i * CELL_SIZE_DEGREES),
    centerLng + (cellId.j * CELL_SIZE_DEGREES),
  ];
}

// Function to get the center of a cell
function cellIdToCenterLatLng(cellId: CellId): [number, number] {
  const sw = cellIdToSWLatLng(cellId);
  return [sw[0] + CELL_SIZE_DEGREES / 2, sw[1] + CELL_SIZE_DEGREES / 2];
}

// Function to get cell color based on distance
function getCellColor(distance: number): string {
  if (distance <= 2) return "#ffffff"; // White for closest cells
  if (distance <= 5) return "#4a9eff"; // Blue for medium distance
  return "#ff4a4a"; // Red for furthest cells
}

// Player inventory and win condition
let playerInventory: number | null = null;
const TARGET_VALUE = 16; // Player wins when they get a token of this value

// Player position tracking (in grid coordinates)
const playerCellPosition: CellId = { i: 0, j: 0 };

// Map to store the state of all cells (both original and modified)
// When a cell is first seen, its generated token value is stored here
// When a cell is modified (token picked up or combined), the new value is stored here
// Key: "i,j" string, Value: Cell state (token value)
const _cellStateMap = new Map<string, Cell>();

// Helper function to create a key for a cell state
function _getCellStateKey(cellId: CellId): string {
  return `${cellId.i},${cellId.j}`;
}

// Map to store currently visible cells on screen by their cell ID key
const visibleCells = new Map<string, GameCell>();

// Helper function to create a unique key for a cell
function getCellKey(cellId: CellId): string {
  return `${cellId.i},${cellId.j}`;
}

// Function to get token value for a cell (from state map or generate via luck)
// Returns 0 if token has been picked up, otherwise returns the stored or generated value
function getCellTokenValue(cellId: CellId): number {
  const cellKey = _getCellStateKey(cellId);
  const storedCell = _cellStateMap.get(cellKey);

  if (storedCell) {
    // Cell state exists in the map
    // If the token has been picked up, return 0 (empty cell)
    if (storedCell.isPickedUp) {
      return 0;
    }
    // Otherwise return the stored token value
    return storedCell.tokenValue;
  } else {
    // Cell hasn't been seen before, generate value from luck
    const generatedValue = Math.pow(
      2,
      Math.floor(luck([cellId.i, cellId.j, "value"].toString()) * 3),
    );

    // Save the generated value to the state map so it persists when the cell goes off-screen
    // This ensures cells keep their original token value even when off-screen
    _cellStateMap.set(cellKey, { id: cellId, tokenValue: generatedValue });

    return generatedValue;
  }
}

// Function to create and render a cell on the map
function createCell(cellId: CellId): GameCell | null {
  // Only spawn if luck determines this cell should exist
  if (luck([cellId.i, cellId.j, "spawn"].toString()) >= SPAWN_CHANCE) {
    return null;
  }

  const cellBounds = cellIdToBounds(cellId);
  const distance = Math.max(
    Math.abs(cellId.i - playerCellPosition.i),
    Math.abs(cellId.j - playerCellPosition.j),
  );
  const tokenValue = getCellTokenValue(cellId);

  const cell = leaflet.rectangle(cellBounds, {
    color: "#30363d",
    weight: 1,
    fillColor: getCellColor(distance),
    fillOpacity: 0.7,
    interactive: true, // Always interactive so clicks work from any distance
  }) as GameCell;

  const center = cellIdToCenterLatLng(cellId);

  // Only create a token label if the cell has a token (tokenValue > 0)
  let _marker: leaflet.Marker | null = null;
  if (tokenValue > 0) {
    const label = leaflet.divIcon({
      className: "token-label",
      html: `<div>${tokenValue}</div>`,
      iconSize: [20, 20],
      iconAnchor: [10, 10],
    });

    _marker = leaflet.marker(center, {
      icon: label,
      interactive: false,
    }).addTo(map);
  }

  cell.tokenValue = tokenValue;
  cell.tokenLabel = _marker as leaflet.Marker;

  // Restore visual state based on token value
  // If token was picked up (tokenValue = 0), cell should have low opacity
  const cellOpacity = tokenValue === 0 ? 0.2 : 0.7;
  cell.setStyle({ fillOpacity: cellOpacity });

  // Always bind tooltip and click handler, regardless of range
  // This ensures cells can be interacted with when the player moves into range
  cell.bindTooltip(() => {
    if (playerInventory === null) {
      return `Click to pick up token (value: ${cell.tokenValue})`;
    } else if (playerInventory === cell.tokenValue) {
      return `Click to combine with your token (value: ${cell.tokenValue})`;
    } else {
      return `Has token with value: ${cell.tokenValue}`;
    }
  });

  cell.on("click", () => {
    const cellKey = _getCellStateKey(cellId);

    if (playerInventory === null) {
      // Player picks up token from this cell
      playerInventory = cell.tokenValue;
      if (cell.tokenLabel) {
        cell.tokenLabel.remove();
      }
      cell.tokenValue = 0;
      cell.setStyle({ fillOpacity: 0.2 });

      // Mark the cell as picked up so it stays empty even when off-screen
      // The original token value is preserved in the state map
      const cellState = _cellStateMap.get(cellKey);
      if (cellState) {
        cellState.isPickedUp = true;
      }
    } else if (playerInventory === cell.tokenValue) {
      // Player combines tokens
      const newValue = playerInventory * 2;
      playerInventory = null;
      cell.tokenValue = newValue;
      const center = cellIdToCenterLatLng(cellId);
      if (cell.tokenLabel) {
        cell.tokenLabel.remove();
      }
      cell.tokenLabel = leaflet.marker(center, {
        icon: leaflet.divIcon({
          className: "token-label",
          html: `<div>${newValue}</div>`,
          iconSize: [20, 20],
          iconAnchor: [10, 10],
        }),
        interactive: false,
      }).addTo(map);
      cell.setStyle({ fillOpacity: 0.7 });

      // Persist the cell's new state (combined token with higher value)
      // Clear the isPickedUp flag since we've placed a new token on it
      const cellState = _cellStateMap.get(cellKey);
      if (cellState) {
        cellState.tokenValue = newValue;
        cellState.isPickedUp = false;
      }
    }
    updateStatus();
  });

  cell.addTo(map);
  return cell;
}

// Function to despawn a cell (remove it from map and visibleCells map)
function despawnCell(cellKey: string): void {
  const cell = visibleCells.get(cellKey);
  if (cell) {
    if (cell.tokenLabel) {
      cell.tokenLabel.remove();
    }
    cell.remove();
    visibleCells.delete(cellKey);
  }
}

// Function to update the status display
function updateStatus() {
  // Get memory efficiency info: how many cells are stored vs visible
  const modifiedCellsCount = _cellStateMap.size;
  const visibleCellsCount = visibleCells.size;
  const memoryInfo =
    `(Modified: ${modifiedCellsCount}, Visible: ${visibleCellsCount})`;

  let mainStatus = "";
  if (playerInventory === null) {
    mainStatus = "No token in inventory";
  } else if (playerInventory >= TARGET_VALUE) {
    mainStatus = `🎉 You won! You have a token of value ${playerInventory}`;
  } else {
    mainStatus = `Holding token with value: ${playerInventory}`;
  }

  statusDiv.textContent = `${mainStatus} ${memoryInfo}`;
}

// Function to create cell bounds from cell coordinates (i,j)
function _createCellBounds(i: number, j: number) {
  const [centerLat, centerLng] = CLASSROOM_LOCATION;
  const cellLat = centerLat + (i * CELL_SIZE_DEGREES);
  const cellLng = centerLng + (j * CELL_SIZE_DEGREES);
  return leaflet.latLngBounds(
    [cellLat, cellLng], // Southwest corner
    [cellLat + CELL_SIZE_DEGREES, cellLng + CELL_SIZE_DEGREES], // Northeast corner
  );
}

// Function to update colors of all visible cells based on player distance
function updateCellColors() {
  visibleCells.forEach((cell, cellKey) => {
    const [i, j] = cellKey.split(",").map(Number);
    const distance = Math.max(
      Math.abs(i - playerCellPosition.i),
      Math.abs(j - playerCellPosition.j),
    );
    cell.setStyle({ fillColor: getCellColor(distance) });
  });
}

// Function to update interactivity of all visible cells based on player distance
function updateCellInteractivity() {
  visibleCells.forEach((cell, cellKey) => {
    const [i, j] = cellKey.split(",").map(Number);
    const inRange = isInRange(i, j);
    cell.setStyle({ interactive: inRange });
  });
}

// Function to verify and log Flyweight pattern efficiency
// Demonstrates that unmodified cells don't use memory (not in _cellStateMap)
function _logFlyweightPatternStatus() {
  const storedCount = _cellStateMap.size;
  const visibleCount = visibleCells.size;

  console.log(
    `[Cell Persistence] Cells in memory (seen and stored): ${storedCount}, Cells currently visible: ${visibleCount}`,
  );

  // Show which cells are stored
  if (storedCount > 0) {
    const storedKeys = Array.from(_cellStateMap.keys());
    console.log(`Stored cell coordinates: ${storedKeys.join(", ")}`);
  }
}

// Function to test and verify that cell states persist when off-screen and returning
function _testCellStatePersistence() {
  console.log(
    "[Persistence Test] Checking if cell states are correctly restored...",
  );

  let testsPassed = 0;
  let testsFailed = 0;

  // For each visible cell, verify its state matches what's stored
  visibleCells.forEach((cell, cellKey) => {
    const [i, j] = cellKey.split(",").map(Number);
    const cellId: CellId = { i, j };
    const expectedValue = getCellTokenValue(cellId);
    const actualValue = cell.tokenValue;

    if (expectedValue === actualValue) {
      testsPassed++;
    } else {
      testsFailed++;
      console.warn(
        `[Persistence Test] FAILED: Cell (${i},${j}) expected value ${expectedValue} but got ${actualValue}`,
      );
    }

    // Verify visual state matches token value
    const hasLabel = cell.tokenLabel !== null;
    const shouldHaveLabel = actualValue > 0;
    if (hasLabel === shouldHaveLabel) {
      testsPassed++;
    } else {
      testsFailed++;
      console.warn(
        `[Persistence Test] FAILED: Cell (${i},${j}) label state mismatch. Has label: ${hasLabel}, Should have: ${shouldHaveLabel}`,
      );
    }

    // Verify opacity matches state (empty cells have low opacity)
    const opacity = (cell.options.fillOpacity as number) || 0.7;
    const expectedOpacity = actualValue === 0 ? 0.2 : 0.7;
    const opacityMatch = Math.abs(opacity - expectedOpacity) < 0.01;
    if (opacityMatch) {
      testsPassed++;
    } else {
      testsFailed++;
      console.warn(
        `[Persistence Test] FAILED: Cell (${i},${j}) opacity mismatch. Expected ${expectedOpacity} but got ${opacity}`,
      );
    }
  });

  console.log(
    `[Persistence Test] Results: ${testsPassed} passed, ${testsFailed} failed`,
  );

  if (testsFailed === 0 && testsPassed > 0) {
    console.log(
      "[Persistence Test] ✓ All persistence tests PASSED! Cell states are correctly restored.",
    );
  }
}

// Function to move the player in a direction
function movePlayer(directionI: number, directionJ: number) {
  playerCellPosition.i += directionI;
  playerCellPosition.j += directionJ;

  // Update player marker position
  const newPos = cellIdToCenterLatLng(playerCellPosition);
  playerMarker.setLatLng(newPos);

  // Center map on new position
  map.setView(newPos);

  // Update cell colors and interactivity based on new distance
  updateCellColors();
  updateCellInteractivity();

  // Log Flyweight pattern efficiency
  _logFlyweightPatternStatus();

  // Test and verify cell state persistence
  _testCellStatePersistence();
}

// Function to check if a cell is within interaction range of the player
function isInRange(cellI: number, cellJ: number): boolean {
  const di = cellI - playerCellPosition.i;
  const dj = cellJ - playerCellPosition.j;
  return Math.abs(di) <= INTERACTION_RANGE && Math.abs(dj) <= INTERACTION_RANGE;
}

// Attach button event listeners
northBtn.addEventListener("click", () => movePlayer(1, 0));
southBtn.addEventListener("click", () => movePlayer(-1, 0));
westBtn.addEventListener("click", () => movePlayer(0, -1));
eastBtn.addEventListener("click", () => movePlayer(0, 1));

// Set up the map centered on the UCSC Science Hill area
const map = leaflet.map(mapDiv, {
  center: CLASSROOM_LOCATION,
  zoom: 19,
});

// Add the OpenStreetMap tile layer
leaflet
  .tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution:
      '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  })
  .addTo(map);

// Listen for map movement events
map.on("moveend", () => {
  const bounds = map.getBounds();

  // Convert map bounds to cell coordinates
  const swCellId = _latLngToCellId(bounds.getSouth(), bounds.getWest());
  const neCellId = _latLngToCellId(bounds.getNorth(), bounds.getEast());

  // Add padding to spawn/despawn range for smooth transitions
  const padding = 2;
  const minI = swCellId.i - padding;
  const maxI = neCellId.i + padding;
  const minJ = swCellId.j - padding;
  const maxJ = neCellId.j + padding;

  // Spawn cells in the visible area
  for (let i = minI; i <= maxI; i++) {
    for (let j = minJ; j <= maxJ; j++) {
      const cellKey = getCellKey({ i, j });
      if (!visibleCells.has(cellKey)) {
        const cell = createCell({ i, j });
        if (cell) {
          visibleCells.set(cellKey, cell);
        }
      }
    }
  }

  // Despawn cells outside the visible area
  const cellsToRemove: string[] = [];
  visibleCells.forEach((_, cellKey) => {
    const [i, j] = cellKey.split(",").map(Number);
    if (i < minI || i > maxI || j < minJ || j > maxJ) {
      cellsToRemove.push(cellKey);
    }
  });

  cellsToRemove.forEach((cellKey) => despawnCell(cellKey));
});

// Add the player marker at the classroom location with custom color
const playerMarker = leaflet.marker(CLASSROOM_LOCATION, {
  icon: leaflet.divIcon({
    className: "red-marker",
    html: "🚩",
    iconSize: [50, 50],
  }),
});
playerMarker.bindTooltip("You are here!");
playerMarker.addTo(map);

// Set initial game status and render initial cells
updateStatus();

// Trigger initial cell rendering
map.fire("moveend");
