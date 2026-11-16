#!/usr/bin/env node
'use strict';

/*
 * Opt-in native-browser evidence for openseadragon#2899.
 * Start the dev server with "npm run dev", then run this script.
 * It saves actual Chromium screenshots and per-frame tile opacity traces.
 * The fixture uses the project's existing PatternTileSource demonstration.
 * WebGL fallback, an incomplete transition, or missing cached tiles fail closed.
 */

const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const puppeteer = require('puppeteer');

const baseUrl = (process.env.OSD_BASE_URL || 'http://localhost:8000').replace(/\/$/, '');
const outputDir = path.resolve(process.env.OSD_EVIDENCE_DIR || 'test-output/alwaysblend-reverse-zoom');
const drawers = ['canvas', 'html', 'webgl'];
const scenarios = ['cached', 'uncached'];
const blendTimeMs = 1500;

function pause(ms) {
    return new Promise(function(resolve) {
        setTimeout(resolve, ms);
    });
}

async function capture(page, drawer, scenario, phase) {
    // The read uses the real TiledImage draw path; no synthetic pixel or opacity values.
    await page.evaluate(function() {
        window.__blendEvidence.getViewer().forceRedraw();
    });
    await pause(75);

    const data = await page.evaluate(function() {
        const evidence = window.__blendEvidence;
        const viewer = evidence.getViewer();
        const image = viewer.world.getItemAt(0);
        const tiles = image.getTilesToDraw().map(function(info) {
            return {
                level: info.level,
                loaded: info.tile.loaded,
                opacity: info.tile.opacity
            };
        });
        return {
            wallTime: Date.now(),
            drawer: viewer.drawer.getType(),
            zoom: viewer.viewport.getZoom(true),
            preferredLevel: image._alwaysBlendLevel,
            outgoingLevel: image._alwaysBlendOutgoingLevel,
            outgoingStartOpacity: image._alwaysBlendOutgoingOpacity,
            outgoingTiles: tiles.filter(function(tile) {
                return tile.level === image._alwaysBlendOutgoingLevel;
            }),
            preferredTiles: tiles.filter(function(tile) {
                return tile.level === image._alwaysBlendLevel;
            }),
            fullyLoaded: image.getFullyLoaded(),
            downloads: evidence.downloads.slice()
        };
    });

    assert.equal(data.drawer, drawer, 'requested renderer must not silently fall back');
    const file = drawer + '-' + scenario + '-' + phase + '.png';
    const element = await page.$('#sandbox-viewer');
    assert.ok(element, 'the actual viewer is present');
    await element.screenshot({ path: path.join(outputDir, file) });
    return Object.assign({ screenshot: file, phase: phase }, data);
}

async function oneCase(browser, drawer, scenario) {
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', function(error) { errors.push(error.message); });
    await page.setViewport({ width: 1400, height: 1000, deviceScaleFactor: 1 });

    const url = baseUrl +
        '/test/demo/tile-blend-time-demo.html?reverseZoomEvidence=1&drawer=' + drawer +
        '&sandboxAlwaysBlend=true&sandboxBlendTime=1.5&sandboxLayered=false&sync=false';

    try {
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
        await page.waitForFunction(function() {
            const evidence = window.__blendEvidence;
            const viewer = evidence && evidence.getViewer();
            return viewer && viewer.world && viewer.world.getItemCount() === 1 &&
                viewer.world.getItemAt(0)._alwaysBlendLevel !== null;
        }, { timeout: 30000 });
        await page.waitForFunction(function() {
            return window.__blendEvidence.getViewer().world.getItemAt(0).getFullyLoaded();
        }, { timeout: 30000 });

        const home = await page.evaluate(function() {
            const viewer = window.__blendEvidence.getViewer();
            const image = viewer.world.getItemAt(0);
            return {
                zoom: viewer.viewport.getZoom(true),
                level: image._alwaysBlendLevel,
                drawer: viewer.drawer.getType()
            };
        });
        assert.equal(home.drawer, drawer, 'browser must use the explicitly requested drawer');
        assert.ok(Number.isInteger(home.level), 'the home preferred level is known');

        await page.evaluate(function(args) {
            const evidence = window.__blendEvidence;
            evidence.startLevel = args.level;
            evidence.delayHighTiles = args.uncached;
            const viewer = evidence.getViewer();
            viewer.viewport.zoomTo(args.zoom * 4, null, true);
            viewer.forceRedraw();
        }, { level: home.level, zoom: home.zoom, uncached: scenario === 'uncached' });

        await page.waitForFunction(function(level) {
            const image = window.__blendEvidence.getViewer().world.getItemAt(0);
            return image._alwaysBlendLevel > level;
        }, { timeout: 15000 }, home.level);

        if (scenario === 'cached') {
            await page.waitForFunction(function() {
                const image = window.__blendEvidence.getViewer().world.getItemAt(0);
                return image.getFullyLoaded() && image.getTilesToDraw().some(function(info) {
                    return info.level === image._alwaysBlendLevel;
                });
            }, { timeout: 30000 });
            await pause(blendTimeMs + 150);
        } else {
            // The opt-in demo delays above-home downloads by three seconds.
            // We reverse immediately, before any of those tiles finish.
            await pause(75);
        }

        const high = await capture(page, drawer, scenario, 'high');
        assert.ok(high.preferredLevel > home.level, 'zoom-in selected a higher pyramid level');
        if (scenario === 'cached') {
            assert.ok(high.preferredTiles.length > 0, 'cached case has real high-level pixels');
        } else {
            assert.equal(high.preferredTiles.length, 0, 'uncached high-level tiles are still pending');
        }

        await page.evaluate(function(zoom) {
            const viewer = window.__blendEvidence.getViewer();
            viewer.viewport.zoomTo(zoom, null, true);
            viewer.forceRedraw();
        }, home.zoom);

        await page.waitForFunction(function(level) {
            const image = window.__blendEvidence.getViewer().world.getItemAt(0);
            return image._alwaysBlendLevel === level &&
                Number.isInteger(image._alwaysBlendOutgoingLevel);
        }, { timeout: 15000 }, home.level);

        const frames = [];
        frames.push(await capture(page, drawer, scenario, 'out-0'));
        await pause(350);
        frames.push(await capture(page, drawer, scenario, 'out-350'));
        await pause(450);
        frames.push(await capture(page, drawer, scenario, 'out-800'));
        await pause(900);
        frames.push(await capture(page, drawer, scenario, 'out-settled'));

        assert.equal(frames[0].preferredLevel, home.level, 'zoom-out selects the original level');
        assert.ok(frames[0].preferredTiles.length > 0, 'lower-level backdrop is available');
        assert.equal(frames[frames.length - 1].outgoingLevel, null,
            'outgoing higher level is removed after blendTime');
        assert.ok(frames[frames.length - 1].preferredTiles.some(function(tile) {
            return tile.opacity === 1;
        }), 'the final preferred level is fully opaque');

        if (scenario === 'cached') {
            assert.ok(frames[0].outgoingTiles.length > 0,
                'previously cached high-level pixels are visible at reverse-zoom start');
            assert.ok(frames[1].outgoingTiles.length > 0,
                'outgoing high-level pixels persist into the fade');
            assert.ok(frames[1].outgoingTiles[0].opacity < frames[0].outgoingTiles[0].opacity,
                'outgoing tile opacity decreases over time');
            assert.ok(frames[2].outgoingTiles[0].opacity < frames[1].outgoingTiles[0].opacity,
                'outgoing tile opacity decreases monotonically');
        } else {
            assert.equal(frames[0].outgoingTiles.length, 0,
                'uncached outgoing high level does not invent a rendered tile');
        }

        assert.deepEqual(errors, [], 'no page JavaScript exceptions');
        return { drawer: drawer, scenario: scenario, url: url, home: home, high: high, frames: frames };
    } finally {
        await page.close();
    }
}

async function main() {
    await fs.mkdir(outputDir, { recursive: true });
    const browser = await puppeteer.launch({
        headless: 'new',
        args: ['--no-sandbox', '--disable-dev-shm-usage']
    });
    const records = [];
    try {
        for (const drawer of drawers) {
            for (const scenario of scenarios) {
                records.push(await oneCase(browser, drawer, scenario));
            }
        }
    } finally {
        await browser.close();
        await fs.writeFile(path.join(outputDir, 'manifest.json'), JSON.stringify({
            source: 'OpenSeadragon native browser/PatternTileSource',
            blendTimeMs: blendTimeMs,
            cases: records
        }, null, 2) + '\n');
    }
    console.log('Saved ' + records.length + ' native browser cases to ' + outputDir);
}

main().catch(function(error) {
    console.error(error);
    process.exitCode = 1;
});
