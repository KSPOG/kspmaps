# KSP Maps

KSP-owned Old School RuneScape map and coordinate tooling for Microbot plugins.

## Current capabilities

- Explv-compatible `centreX`, `centreY`, `centreZ`, `zoom` query parameters.
- Arbitrary `WorldPoint` navigation, including high-Y dungeon/underground coordinates such as `3118,9837,0`.
- WorldPoint-accurate mouse coordinates.
- Region ID + region-local coordinates.
- Two-corner rectangular area selection for KSP AIO Fighter.
- Plane 0-3 switching independent of world X/Y.
- Coordinate grid that remains usable when all imagery is missing.
- KSP RuneLite region imagery preferred over legacy map tiles.
- KSP TMS tiles retained as a secondary KSP source.
- Explv imagery used only as the final compatibility fallback.

## RuneLite region imagery

KSP Maps renders the current OSRS cache into individual 64x64-world-tile region images:

```text
data/regions/<plane>/<regionId>.png
```

RuneLite's map dumper renders at four pixels per game tile, so a KSP region PNG is 256x256 pixels. `data/regions/manifest.json` records each region's base X/Y and the planes for which imagery exists.

There is deliberately no overworld-only Y filter. High-Y regions are generated exactly like ordinary regions, so caves, dungeons and other underground coordinate spaces are included when present in the cache.

The automatic `Refresh OSRS Region Maps` workflow fetches the latest Old School cache and validated map keys from OpenRS2, renders the regions through current RuneLite cache code, verifies that high-Y coverage exists, and commits changed region imagery back to this repository. It also runs weekly and can be started manually.

For a local Windows refresh, see [`generator/README.md`](generator/README.md).

## Imagery priority

The web viewer and KSP AIO Fighter use the same priority:

```text
KSP RuneLite region image
        ↓ missing
KSP TMS map tile
        ↓ missing
Explv compatibility tile
        ↓ missing
coordinate/region grid remains usable
```

This means missing imagery never prevents an attack area from being selected.

## Legacy TMS tile layout

KSP TMS tiles use:

```text
tiles/<plane>/<zoom>/<x>/<tms-y>.png
```

They remain supported for compatibility and future full-world tile-pyramid generation, but newly generated RuneLite region images are the preferred way to fill missing areas quickly.

## Area links

The viewer accepts the same style of URL as Explv:

```text
?centreX=2915&centreY=3314&centreZ=0&zoom=7
```

Dungeon example:

```text
?centreX=3118&centreY=9837&centreZ=0&zoom=10
```

Click two tiles to define an area. `Copy WorldArea` produces a RuneLite Java expression such as:

```java
new WorldArea(2915, 3314, 8, 6, 0)
```

## Projection

The browser and AIO Fighter use the coordinate projection compatible with Explv's public map so existing fighter coordinates and links remain aligned. RuneLite region images are placed directly using each region's world-coordinate base.

## Future data layers

The same region model can later carry Microbot/RuneLite observations for collision, scene coordinates, instance-template mappings, game objects, walls, transports, NPCs and other navigation metadata. Map imagery and coordinate selection do not depend on those future layers.

## Attribution

KSP Maps is an independent map/coordinate implementation. RuneLite cache APIs are used by the region generator. Until KSP coverage is complete, missing KSP imagery may fall back to the public `Explv/osrs_map_tiles` imagery and is identified as fallback content in the UI.
