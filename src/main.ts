// @deno-types="npm:@types/leaflet"
import leaflet from "leaflet";

// Required stylesheets
import "leaflet/dist/leaflet.css";
import "./style.css";

// Fix missing marker images
import "./_leafletWorkaround.ts";

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
const CELL_SIZE_DEGREES = 0.0001; // Size of each cell in degrees
const _playerInventory: number | null = null; // Prefixed with _ until we use it

// Function to create cell bounds from center point
function createCellBounds(centerLat: number, centerLng: number) {
  const halfSize = CELL_SIZE_DEGREES / 2;
  return leaflet.latLngBounds(
    [centerLat - halfSize, centerLng - halfSize], // Southwest corner
    [centerLat + halfSize, centerLng + halfSize], // Northeast corner
  );
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

// Draw a cell centered at the classroom location
const [lat, lng] = CLASSROOM_LOCATION;
const cellBounds = createCellBounds(lat, lng);
const cell = leaflet.rectangle(cellBounds, {
  color: "#30363d", // Dark gray border
  weight: 2, // Border width
  fillColor: "#ffffff", // White fill
  fillOpacity: 0.5, // Semi-transparent
});
cell.addTo(map);

// Set initial status
statusDiv.textContent = "No token in inventory";
