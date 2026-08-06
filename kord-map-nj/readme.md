
This is very crude, made only for the interim period before the main sites update

# Contributing

## Repository Structure

```text
/
├── index.html          
├── /icons/
└── /maps/              
    └── /map-name/      
        ├── map-name.svg   # Vector map (layer IDs: floor-0, floor-1)
        ├── mapdata.json   # Icon and floor configuration
        └── map-name-points.json # Saved markers

```

## Adding a New Map 

You can get clean map SVG's from https://github.com/the-hideout/tarkov-dev-svg-maps/

1. Create a new folder: `/maps/[map-name]/`. Use lowercase letters.
2. Rename SVG as `[map-name].svg`. Edit map layers so they're by floor using IDs `floor-0` (ground layer), `floor-1`, etc.
3. Create `mapdata.json` in the map's folder:
```json
{
  "icons": [
    "document-name" // What documents spawn on the map. You can find the names in /icons/
  ],
  "floors": [
    "0",
    "1"
  ],
  "mapScale": [
	"1.0", //how small and
	"7.0"  //how big icons can get
  ]
}

```


4. Add a button to the `<div class="map-grid">` in `index.html`:
```html
<div class="map-card" onclick="initMap('map-name')">Map Name</div>

```

## Updating Markers

1. Run the app and use the UI to add or move markers.
2. Click **Export** in the sidebar.
3. Replace the existing `[map-name]-points.json` file in the repository with the downloaded file.



## Acknowledgements and Licensing

* The vector map assets (SVGs) used in this project were created by [Shebuka](https://github.com/the-hideout/tarkov-dev-svg-maps/). 
* These assets are licensed under the [Creative Commons Attribution-NonCommercial-ShareAlike 4.0 International License](https://creativecommons.org/licenses/by-nc-sa/4.0/). 
