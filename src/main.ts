// @deno-types="npm:@types/leaflet"
import leaflet from "leaflet";

// Required stylesheets
import "leaflet/dist/leaflet.css";
import "./style.css";

// Fix missing marker images
import "./_leafletWorkaround.ts";

// Create the map container
const mapDiv = document.createElement("div");
mapDiv.id = "map";
document.body.append(mapDiv);

// Set up the map centered on the UCSC Science Hill area
const map = leaflet.map(mapDiv, {
  center: [36.997936938057016, -122.05703507501151],
  zoom: 19,
});

// Add the OpenStreetMap tile layer
leaflet
  .tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution:
      "'&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  })
  .addTo(map);
