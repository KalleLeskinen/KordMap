# KordMap

A simple map editor for Tarkov. Runs on Next.js

## Getting Started

Install dependencies and start the dev server:

```bash
npm install
npm run dev
```

Open the app in your browser at `http://localhost:3000`.

## Contributing

### Repository structure

```text
/public
  /icons/                 # marker icons used in the editor
  /maps/
    /customs/
      mapdata.json
      mapdata-points.json
      customs.svg
    /factory/
      mapdata.json
      factory-points.json
      factory.svg
/app                      # Next.js front-end application
/components               # shared UI components
/app/api                  # API endpoints for auth, map loading, and uploads
```

### Adding a new map

1. Add a new folder under `public/maps/[map-name]/`.
2. Place your map SVG file in that folder. Name it `[map-name].svg`.
3. Make sure the SVG floor layers use IDs like `floor-0`, `floor-1`, etc.
4. Add `mapdata.json` in the same folder with the map config:

```json
{
  "icons": [
    "document-name"
  ],
  "floors": [
    "0",
    "1"
  ],
  "mapScale": [
    1,
    7
  ]
}
```

5. Register the new map in `app/page.tsx` inside the map selection list:

```ts
{['customs', 'factory', 'new-map-name'].map(mapName => (
  ...
))}
```

6. Optionally add a corresponding `new-map-name-points.json` file for marker data.

### Using the local editor

Local editor mode is for manual contributions for those who do not have remote editor access

1. Open the sidebar and choose **Use Local Editor**.
2. Select a map and switch to **Mark Points** or **Move Points** mode.
3. Add, edit, or move markers as needed.
4. Click **Export** to download the updated JSON file.
5. If you want to reload a previously exported file, use the **Load** button in the sidebar and select the JSON file.

> Local mode does not persist changes remotely. Use export/load to transfer marker updates manually.

### Updating marker data

1. Run the app.
2. Select a map and enter editor mode:
   - Use **Editor Login** if the app has remote auth configured.
   - Or choose **Use Local Editor** to work without remote storage.
3. Add, edit, or move markers in the UI.
4. Click **Export** in the sidebar to download the JSON file.
5. Replace the existing `[map-name]-points.json` file in `public/maps/[map-name]/` with the exported file.

### Contributing via pull request

1. Fork the repository and create a new branch for your changes.
2. map files are under `public/maps/[map-name]/`.
3. If you updated marker data, export the JSON like above and include the updated file in your branch.
4. Open a pull request against the main repository.
    In the PR description, include:
      - the map name
      - changes made


## Acknowledgements

* Vector map assets from [Shebuka](https://github.com/the-hideout/tarkov-dev-svg-maps/).
* Licensed under [CC BY-NC-SA 4.0](https://creativecommons.org/licenses/by-nc-sa/4.0/).
