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

// Initialize player state and game constants
const CLASSROOM_LOCATION = [36.997936938057016, -122.05703507501151] as [
  number,
  number,
];
const CELL_SIZE_DEGREES = 0.00008; // Smaller cell size
const GRID_SIZE = 10; // Grid size for possible locations
const INTERACTION_RANGE = 3; // How many cells away the player can interact with
const SPAWN_CHANCE = 0.2; // 20% chance for a cell to appear

// Function to convert latitude/longitude to cell coordinates
function latLngToCellId(lat: number, lng: number): CellId {
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
function createCellBounds(i: number, j: number) {
  const [centerLat, centerLng] = CLASSROOM_LOCATION;
  const cellLat = centerLat + (i * CELL_SIZE_DEGREES);
  const cellLng = centerLng + (j * CELL_SIZE_DEGREES);
  return leaflet.latLngBounds(
    [cellLat, cellLng], // Southwest corner
    [cellLat + CELL_SIZE_DEGREES, cellLng + CELL_SIZE_DEGREES], // Northeast corner
  );
}

// Function to check if a cell is within interaction range
function isInRange(i: number, j: number): boolean {
  return Math.abs(i) <= INTERACTION_RANGE && Math.abs(j) <= INTERACTION_RANGE;
}

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

// Draw scattered cells
for (let i = -GRID_SIZE; i <= GRID_SIZE; i++) {
  for (let j = -GRID_SIZE; j <= GRID_SIZE; j++) {
    const cellId: CellId = { i, j };
    if (luck([i, j, "spawn"].toString()) < SPAWN_CHANCE) {
      const cellBounds = cellIdToBounds(cellId);
      const distance = Math.max(Math.abs(i), Math.abs(j));
      const inRange = isInRange(i, j);
      const tokenValue = Math.pow(
        2,
        Math.floor(luck([i, j, "value"].toString()) * 3),
      );
      const cell = leaflet.rectangle(cellBounds, {
        color: "#30363d",
        weight: 1,
        fillColor: getCellColor(distance),
        fillOpacity: 0.7,
        interactive: inRange,
      }) as GameCell;
      // Use the new helper to get the cell center
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
      if (inRange) {
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
      }
      cell.addTo(map);
    }
  }
}

// Set initial game status
updateStatus();
