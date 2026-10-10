# KSP Maps

KSP-owned Old School RuneScape map/coordinate tooling for Microbot plugins.

## v0.1 goals

- Explv-compatible `centreX`, `centreY`, `centreZ`, `zoom` query parameters.
- WorldPoint-accurate mouse coordinates.
- Region ID + region-local coordinates.
- Two-corner rectangular area selection for KSP AIO Fighter.
- Plane 0-3 switching.
- Coordinate grid that remains usable when imagery is missing.
- KSP-hosted map tiles preferred, with Explv tiles used only as a compatibility fallback.

## Tile layout

KSP tiles use the same TMS layout currently consumed by the AIO Fighter map picker:

```text
tiles/<plane>/<zoom>/<x>/<tms-y>.png
```

Example:

```text
tiles/0/10/512/734.png
```

The web viewer first requests:

```text
https://raw.githubusercontent.com/KSPOG/kspmaps/main/tiles/<plane>/<zoom>/<x>/<y>.png
```

If that tile does not exist yet, it falls back to `Explv/osrs_map_tiles`. The coordinate grid and area-selection logic do not depend on either imagery source.

## Area links

The viewer accepts the same style of URL as Explv:

```text
?centreX=2915&centreY=3314&centreZ=0&zoom=7
```

Click two tiles to define an area. `Copy WorldArea` produces a RuneLite Java expression such as:

```java
new WorldArea(2915, 3314, 8, 6, 0)
```

## Projection

The browser currently uses the coordinate projection compatible with Explv's public map so existing fighter coordinates and links remain aligned. Projection constants are centralized in `app.js` until they are moved into a shared generator/Java module.

## Planned data collector

A RuneLite/Microbot collector will upload/dump coverage records for loaded scene tiles. The intended minimum record is:

```json
{
  "worldX": 2915,
  "worldY": 3314,
  "plane": 0,
  "regionId": 11571,
  "regionX": 35,
  "regionY": 50,
  "instanced": false
}
```

Future records can include collision flags, scene coordinates, instance-template coordinates, game objects, walls and other navigation metadata.

## Attribution

The KSP viewer is an independent implementation. Until KSP-generated map imagery is populated, missing KSP tiles fall back to the public `Explv/osrs_map_tiles` imagery and are attributed in the UI.
