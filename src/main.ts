// @deno-types="npm:@types/leaflet"
import leaflet from "leaflet";

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

// Function to get cell color based on distance
function getCellColor(distance: number): string {
  if (distance <= 2) return "#ffffff"; // White for closest cells
  if (distance <= 5) return "#4a9eff"; // Blue for medium distance
  return "#ff4a4a"; // Red for furthest cells
}

const _playerInventory: number | null = null; // Prefixed with _ until we use it

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
    // Use luck function to deterministically decide if this cell should appear
    if (luck([i, j, "spawn"].toString()) < SPAWN_CHANCE) {
      const cellBounds = createCellBounds(i, j);
      const distance = Math.max(Math.abs(i), Math.abs(j)); // Calculate distance from center
      const inRange = isInRange(i, j);

      const cell = leaflet.rectangle(cellBounds, {
        color: "#30363d", // Dark gray border
        weight: 1, // Thinner border for smaller cells
        fillColor: getCellColor(distance),
        fillOpacity: 0.7, // Slightly more opaque
        interactive: inRange, // Only cells in range can be clicked
      });

      if (inRange) {
        cell.bindTooltip(`Cell (${i}, ${j})`);
      }

      cell.addTo(map);
    }
  }
}

// Set initial status
statusDiv.textContent = "No token in inventory";
