// @deno-types="npm:@types/leaflet"
import leaflet from "leaflet";

// Extend Rectangle type to include our custom properties
type GameCell = leaflet.Rectangle & {
  tokenValue: number;
  tokenLabel: leaflet.Marker;
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
    // Use luck function to deterministically decide if this cell should appear
    if (luck([i, j, "spawn"].toString()) < SPAWN_CHANCE) {
      const cellBounds = createCellBounds(i, j);
      const distance = Math.max(Math.abs(i), Math.abs(j)); // Calculate distance from center
      const inRange = isInRange(i, j);

      // Generate a deterministic token value for this cell (1, 2, or 4)
      const tokenValue = Math.pow(
        2,
        Math.floor(luck([i, j, "value"].toString()) * 3),
      );

      const cell = leaflet.rectangle(cellBounds, {
        color: "#30363d", // Dark gray border
        weight: 1, // Thinner border for smaller cells
        fillColor: getCellColor(distance),
        fillOpacity: 0.7, // Slightly more opaque
        interactive: inRange, // Only cells in range can be clicked
      }) as GameCell;

      // Create a permanent label showing the token value
      const center = cellBounds.getCenter();
      const label = leaflet.divIcon({
        className: "token-label",
        html: `<div>${tokenValue}</div>`,
        iconSize: [20, 20],
        iconAnchor: [10, 10],
      });

      const _marker = leaflet.marker(center, {
        icon: label,
        interactive: false, // Make sure clicks go through to the cell
      }).addTo(map);

      // Store the token value and label marker in cell's properties for later access
      cell.tokenValue = tokenValue;
      cell.tokenLabel = _marker;

      if (inRange) {
        // Show appropriate tooltip based on current state
        cell.bindTooltip(() => {
          if (playerInventory === null) {
            return `Click to pick up token (value: ${cell.tokenValue})`;
          } else if (playerInventory === cell.tokenValue) {
            return `Click to combine with your token (value: ${cell.tokenValue})`;
          } else {
            return `Has token with value: ${cell.tokenValue}`;
          }
        });

        // Handle clicks on the cell
        cell.on("click", () => {
          if (playerInventory === null) {
            // Pick up the token
            playerInventory = cell.tokenValue;
            cell.tokenLabel.remove(); // Remove the token label
            cell.tokenValue = 0; // Mark cell as empty
            cell.setStyle({ fillOpacity: 0.2 }); // Make cell look empty
          } else if (playerInventory === cell.tokenValue) {
            // Combine tokens
            const newValue = playerInventory * 2;
            playerInventory = null;
            cell.tokenValue = newValue;
            // Update the label
            const center = cell.getBounds().getCenter();
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
            cell.setStyle({ fillOpacity: 0.7 }); // Restore cell appearance
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
