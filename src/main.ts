// @deno-types="npm:@types/leaflet"
import leaflet from "leaflet";

// Extend Rectangle type to include our custom properties
type GameCell = leaflet.Rectangle & {
  tokenValue: number;
  tokenLabel: leaflet.Marker;
};

// Cell identifier type - represents a grid cell as i,j coordinates
type CellId = {
  i: number;
  j: number;
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

// Map to store currently visible cells on screen by their cell ID key
const visibleCells = new Map<string, GameCell>();

// Helper function to create a unique key for a cell
function getCellKey(cellId: CellId): string {
  return `${cellId.i},${cellId.j}`;
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
  const tokenValue = Math.pow(
    2,
    Math.floor(luck([cellId.i, cellId.j, "value"].toString()) * 3),
  );

  const cell = leaflet.rectangle(cellBounds, {
    color: "#30363d",
    weight: 1,
    fillColor: getCellColor(distance),
    fillOpacity: 0.7,
    interactive: true, // Always interactive so clicks work from any distance
  }) as GameCell;

  const center = cellIdToCenterLatLng(cellId);
  const label = leaflet.divIcon({
    className: "token-label",
    html: `<div>${tokenValue}</div>`,
    iconSize: [20, 20],
    iconAnchor: [10, 10],
  });

  const _marker = leaflet.marker(center, {
    icon: label,
    interactive: false,
  }).addTo(map);

  cell.tokenValue = tokenValue;
  cell.tokenLabel = _marker;

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
    if (playerInventory === null) {
      playerInventory = cell.tokenValue;
      cell.tokenLabel.remove();
      cell.tokenValue = 0;
      cell.setStyle({ fillOpacity: 0.2 });
    } else if (playerInventory === cell.tokenValue) {
      const newValue = playerInventory * 2;
      playerInventory = null;
      cell.tokenValue = newValue;
      const center = cellIdToCenterLatLng(cellId);
      cell.tokenLabel.remove();
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
    cell.tokenLabel.remove();
    cell.remove();
    visibleCells.delete(cellKey);
  }
}

// Function to update the status display
function updateStatus() {
  if (playerInventory === null) {
    statusDiv.textContent = "No token in inventory";
  } else if (playerInventory >= TARGET_VALUE) {
    statusDiv.textContent =
      `🎉 You won! You have a token of value ${playerInventory}`;
  } else {
    statusDiv.textContent = `Holding token with value: ${playerInventory}`;
  }
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
