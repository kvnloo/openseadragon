/* global QUnit, $, Util, testLog */

(function() {
    let viewer;

    const precision = 0.000000001;

    QUnit.module('TiledImage', {
        beforeEach: function() {
            $('<div id="example"></div>').appendTo("#qunit-fixture");

            testLog.reset();

            // eslint-disable-next-line new-cap
            viewer = OpenSeadragon({
                id: 'example',
                prefixUrl: '/build/openseadragon/images/',
                springStiffness: 100, // Faster animation = faster tests
                drawer: 'canvas', // always use canvas drawer for these tests
            });
        },
        afterEach: function() {
            if (viewer){
                viewer.destroy();
            }

            viewer = null;
        }
    });

    // ----------
    const checkBounds = function(assert, image, expected, message) {
        const bounds = image.getBounds();
        assert.equal(bounds.x, expected.x, message + ' x');
        assert.equal(bounds.y, expected.y, message + ' y');
        assert.equal(bounds.width, expected.width, message + ' width');
        assert.equal(bounds.height, expected.height, message + ' height');
    };

    // ----------
    QUnit.test('metrics', function(assert) {
        const done = assert.async();
        let handlerCount = 0;

        viewer.addHandler('open', function(event) {
            const image = viewer.world.getItemAt(0);
            const contentSize = image.getContentSize();
            const sizeInWindowCoords = image.getSizeInWindowCoordinates();
            assert.equal(contentSize.x, 500, 'contentSize.x');
            assert.equal(contentSize.y, 2000, 'contentSize.y');
            assert.equal(sizeInWindowCoords.x, 125, 'sizeInWindowCoords.x');
            assert.equal(sizeInWindowCoords.y, 500, 'sizeInWindowCoords.y');

            checkBounds(assert, image, new OpenSeadragon.Rect(5, 6, 10, 40), 'initial bounds');

            const scale = image.getContentSize().x / image.getBounds().width;
            const viewportPoint = new OpenSeadragon.Point(10, 11);
            const imagePoint = viewportPoint.minus(image.getBounds().getTopLeft()).times(scale);

            assert.propEqual(image.viewportToImageCoordinates(viewportPoint), imagePoint, 'viewportToImageCoordinates');
            assert.propEqual(image.imageToViewportCoordinates(imagePoint), viewportPoint, 'imageToViewportCoordinates');

            const viewportRect = new OpenSeadragon.Rect(viewportPoint.x, viewportPoint.y, 6, 7);
            const imageRect = new OpenSeadragon.Rect(imagePoint.x, imagePoint.y,
                viewportRect.width * scale, viewportRect.height * scale);

            assert.propEqual(image.viewportToImageRectangle(viewportRect), imageRect, 'viewportToImageRectangle');
            assert.propEqual(image.imageToViewportRectangle(imageRect), viewportRect, 'imageToViewportRectangle');

            image.addHandler('bounds-change', function boundsChangeHandler(event) {
                image.removeHandler('bounds-change', boundsChangeHandler);
                handlerCount++;
            });

            image.setPosition(new OpenSeadragon.Point(7, 8));
            checkBounds(assert, image, new OpenSeadragon.Rect(7, 8, 10, 40), 'bounds after position');

            image.setWidth(5);
            checkBounds(assert, image, new OpenSeadragon.Rect(7, 8, 5, 20), 'bounds after width');

            image.setHeight(4);
            checkBounds(assert, image, new OpenSeadragon.Rect(7, 8, 1, 4), 'bounds after width');

            viewer.addHandler('zoom', function zoomHandler(event) {
                const sizeInWindowCoords = image.getSizeInWindowCoordinates();
                viewer.removeHandler('zoom', zoomHandler);
                handlerCount++;
                assert.equal(sizeInWindowCoords.x, 4000, 'sizeInWindowCoords.x after zoom');
                assert.equal(sizeInWindowCoords.y, 16000, 'sizeInWindowCoords.y after zoom');
            });

            viewer.viewport.zoomTo(8, null, true);

            assert.equal(handlerCount, 2, 'correct number of handlers called');

            done();
        });

        viewer.open({
            tileSource: '/test/data/tall.dzi',
            x: 5,
            y: 6,
            width: 10
        });
    });

    // ----------
    QUnit.test('animation', function(assert) {
        const done = assert.async();
        viewer.addHandler("open", function() {
            const image = viewer.world.getItemAt(0);
            assert.propEqual(image.getBounds(), new OpenSeadragon.Rect(0, 0, 1, 1), 'target bounds on open');
            assert.propEqual(image.getBounds(true), new OpenSeadragon.Rect(0, 0, 1, 1), 'current bounds on open');

            image.setPosition(new OpenSeadragon.Point(1, 2));
            assert.propEqual(image.getBounds(), new OpenSeadragon.Rect(1, 2, 1, 1), 'target bounds after position');
            assert.propEqual(image.getBounds(true), new OpenSeadragon.Rect(0, 0, 1, 1), 'current bounds after position');

            image.setWidth(3);
            assert.propEqual(image.getBounds(), new OpenSeadragon.Rect(1, 2, 3, 3), 'target bounds after width');
            assert.propEqual(image.getBounds(true), new OpenSeadragon.Rect(0, 0, 1, 1), 'current bounds after width');

            viewer.addHandler('animation-finish', function animationHandler() {
                viewer.removeHandler('animation-finish', animationHandler);
                Util.assertRectangleEquals(assert,  new OpenSeadragon.Rect(1, 2, 3, 3), image.getBounds(), precision, 'target bounds after animation');
                Util.assertRectangleEquals(assert,  new OpenSeadragon.Rect(1, 2, 3, 3), image.getBounds(true), precision, 'target bounds after animation');
                done();
            });
        });

        viewer.open('/test/data/testpattern.dzi');
    });

    // ----------
    QUnit.test('update', function(assert) {
        const done = assert.async();
        let handlerCount = 0;
        const expectedHandlers = 4;

        viewer.addHandler('open', function(event) {
            const image = viewer.world.getItemAt(0);
            assert.equal(image.needsDraw(), true, 'needs draw after open');

            viewer.addHandler('update-level', function updateLevelHandler(event) {
                viewer.removeHandler('update-level', updateLevelHandler);
                handlerCount++;
                assert.equal(event.eventSource, viewer, 'sender of update-level event was viewer');
                assert.equal(event.tiledImage, image, 'tiledImage of update-level event is correct');
                assert.ok('havedrawn' in event, 'update-level event includes havedrawn');
                assert.ok('level' in event, 'update-level event includes level');
                assert.ok('opacity' in event, 'update-level event includes opacity');
                assert.ok('visibility' in event, 'update-level event includes visibility');
                assert.ok('topleft' in event, 'update-level event includes topleft');
                assert.ok('bottomright' in event, 'update-level event includes bottomright');
                assert.ok('currenttime' in event, 'update-level event includes currenttime');
                assert.ok('best' in event, 'update-level event includes best');
            });

            viewer.addHandler('update-tile', function updateTileHandler(event) {
                viewer.removeHandler('update-tile', updateTileHandler);
                handlerCount++;
                assert.equal(event.eventSource, viewer, 'sender of update-tile event was viewer');
                assert.equal(event.tiledImage, image, 'tiledImage of update-level event is correct');
                assert.ok(event.tile, 'update-tile event includes tile');
            });


            viewer.addHandler('tile-drawing', function tileDrawingHandler(event) {
                viewer.removeHandler('tile-drawing', tileDrawingHandler);
                handlerCount++;
                assert.equal(event.eventSource, viewer, 'sender of tile-drawing event was viewer');
                assert.equal(event.tiledImage, image, 'tiledImage of update-level event is correct');
                assert.ok(event.tile, 'tile-drawing event includes a tile');
                assert.ok(event.context, 'tile-drawing event includes a context');
                assert.ok(event.rendered, 'tile-drawing event includes a rendered');
            });



            viewer.addHandler('tiled-image-drawn', function tileDrawnHandler(event) {
                viewer.removeHandler('tiled-image-drawn', tileDrawnHandler);
                handlerCount++;
                assert.equal(event.eventSource, viewer, 'sender of tiled-image-drawn event was viewer');
                assert.equal(event.tiledImage, image, 'tiledImage of update-level event is correct');
                assert.ok(event.tiles, 'tiled-image-drawn event includes tiles');

                assert.equal(handlerCount, expectedHandlers, 'correct number of handlers called');
                done();
            });

            viewer.drawer.draw( [ image ] );
        });

        viewer.open('/test/data/testpattern.dzi');
    });

    // ----------
    QUnit.test('reset', function(assert) {
        const done = assert.async();
        viewer.addHandler('tiled-image-drawn', function updateHandler() {
            viewer.removeHandler('tiled-image-drawn', updateHandler);
            assert.ok(viewer.tileCache.numTilesLoaded() > 0, 'we have tiles after tiled-image-drawn');
            viewer.world.getItemAt(0).reset();
            assert.equal(viewer.tileCache.numTilesLoaded(), 0, 'no tiles after reset');

            viewer.addHandler('tiled-image-drawn', function updateHandler2() {
                viewer.removeHandler('tiled-image-drawn', updateHandler2);

                setTimeout(() => {
                    assert.ok(viewer.tileCache.numTilesLoaded() > 0, 'more tiles load');
                    viewer.world.getItemAt(0).destroy();
                    assert.equal(viewer.tileCache.numTilesLoaded(), 0, 'no tiles after destroy');
                    done();
                }, 20);
            });
        });

        assert.equal(viewer.tileCache.numTilesLoaded(), 0, 'no tiles at start');

        viewer.open('/test/data/testpattern.dzi');
    });

    // ----------
    QUnit.test('clip', function(assert) {
        const done = assert.async();
        const clip = new OpenSeadragon.Rect(100, 100, 800, 800);

        viewer.addHandler('open', function() {
            const image = viewer.world.getItemAt(0);
            assert.propEqual(image.getClip(), clip, 'image has correct clip');

            image.setClip(null);
            assert.equal(image.getClip(), null, 'clip is cleared');

            image.setClip(clip);
            assert.propEqual(image.getClip(), clip, 'clip is set correctly');

            Util.spyOnce(viewer.drawer, '_setClip', function(rect) {
                const homeBounds = viewer.viewport.getHomeBounds();
                const canvasClip = viewer.drawer
                    .viewportToDrawerRectangle(homeBounds);
                const precision = 0.00000001;
                Util.assertRectangleEquals(assert, rect, canvasClip, precision,
                    'clipping should be ' + canvasClip);
                done();
            });
        });

        viewer.open({
            tileSource: '/test/data/testpattern.dzi',
            clip: clip
        });
    });

    // ----------
    QUnit.test('tile load rate boost decays once per frame, not once per level', function(assert) {
        const done = assert.async();

        viewer.addHandler('open', function() {
            const image = viewer.world.getItemAt(0);
            const steady = image.maxTilesPerFrame;

            // _updateLevel runs once per pyramid level, so decaying there collapsed the whole boost within a
            // single frame and the boost never actually did anything.
            image._boostTileLoadingRate();
            const boosted = image._currentMaxTilesPerFrame;
            assert.equal(boosted, steady * 10, 'Boost raises the per-frame allowance tenfold.');

            image._updateLevelsForViewport();
            assert.equal(image._currentMaxTilesPerFrame, Math.ceil(boosted / 2),
                'One frame halves the allowance exactly once, whatever the level count.');

            // And it must bottom out at the configured steady-state value rather than decaying to nothing.
            for (let i = 0; i < 20; i++) {
                image._updateLevelsForViewport();
            }
            assert.equal(image._currentMaxTilesPerFrame, steady,
                'The allowance decays down to maxTilesPerFrame and stops there.');

            done();
        });

        viewer.open({
            tileSource: '/test/data/testpattern.dzi'
        });
    });

    // ----------
    QUnit.test('tile load rate is re-boosted whenever tiles become needed', function(assert) {
        const done = assert.async();

        viewer.addHandler('open', function() {
            const image = viewer.world.getItemAt(0);

            // Settle the allowance at its steady-state value.
            image._setFullyLoaded(true);
            for (let i = 0; i < 20; i++) {
                image._updateLevelsForViewport();
            }
            assert.equal(image._currentMaxTilesPerFrame, image.maxTilesPerFrame, 'Allowance starts settled.');

            // Discovering that the view is incomplete - what a pan or zoom does - must refill fast rather than
            // trickle at the steady-state rate. Before this, only reset() ever re-armed the boost.
            image._setFullyLoaded(false);
            assert.equal(image._currentMaxTilesPerFrame, image.maxTilesPerFrame * 10,
                'Becoming not-fully-loaded re-boosts the per-frame allowance.');

            done();
        });

        viewer.open({
            tileSource: '/test/data/testpattern.dzi'
        });
    });

    // ----------
    QUnit.test('clip-change event', function(assert) {
        const done = assert.async();
        assert.expect(0);
        const clip = new OpenSeadragon.Rect(100, 100, 800, 800);

        viewer.addHandler('open', function() {
            const image = viewer.world.getItemAt(0);
            image.addOnceHandler('clip-change', function() {
                image.addOnceHandler('clip-change', function() {
                    done();
                });
                image.setClip(clip);
            });
            image.setClip(null);
        });

        viewer.open({
            tileSource: '/test/data/testpattern.dzi'
        });
    });

    // ----------
    QUnit.test('getClipBounds', function(assert) {
        const done = assert.async();
        const clip = new OpenSeadragon.Rect(100, 200, 800, 500);

        viewer.addHandler('open', function() {
            let image = viewer.world.getItemAt(0);
            let bounds = image.getClippedBounds();
            let expectedBounds = new OpenSeadragon.Rect(1.2, 1.4, 1.6, 1);
            assert.propEqual(bounds, expectedBounds,
                'getClipBounds should take clipping into account.');

            image = viewer.world.getItemAt(1);
            bounds = image.getClippedBounds();
            expectedBounds = new OpenSeadragon.Rect(1, 2, 2, 2);
            assert.propEqual(bounds, expectedBounds,
                'getClipBounds should work when no clipping set.');

            done();
        });

        viewer.open([{
            tileSource: '/test/data/testpattern.dzi',
            clip: clip,
            x: 1,
            y: 1,
            width: 2
        }, {
            tileSource: '/test/data/testpattern.dzi',
            x: 1,
            y: 2,
            width: 2
        }]);
    });

    // ----------
    QUnit.test('opacity', function(assert) {
        const done = assert.async();
        function testDefaultOpacity() {
            viewer.removeHandler('open', testDefaultOpacity);
            const image = viewer.world.getItemAt(0);
            assert.strictEqual(image.getOpacity(), 0.5, 'image has default opacity');

            image.setOpacity(1);
            assert.strictEqual(image.getOpacity(), 1, 'opacity is set correctly');

            viewer.addHandler('open', testTileSourceOpacity);
            viewer.open({
                tileSource: '/test/data/testpattern.dzi',
                opacity: 0.25
            });
        }

        function testTileSourceOpacity() {
            viewer.removeHandler('open', testTileSourceOpacity);
            const image = viewer.world.getItemAt(0);
            assert.strictEqual(image.getOpacity(), 0.25, 'image has correct opacity');

            image.setOpacity(0);
            assert.strictEqual(image.getOpacity(), 0, 'opacity is set correctly');

            done();
        }

        viewer.addHandler('open', testDefaultOpacity);

        viewer.opacity = 0.5;
        viewer.open({
            tileSource: '/test/data/testpattern.dzi',
        });
    });

    // ----------
    QUnit.test('alwaysBlend resolves a cached level after the view stops', function(assert) {
        // Both levels are already cached; their original load fades finished long ago.
        const image = Object.create(OpenSeadragon.TiledImage.prototype);
        image.alwaysBlend = true;
        image.blendTime = 1;
        image._alwaysBlendLevel = 10;
        image._alwaysBlendStart = 1000;
        image._tilesToDraw = [];
        image.coverage = {};
        image._setCoverage = function() {};
        image._providesCoverage = function() { return false; };
        image.getDrawArea = function() { return true; };

        const lower = { loaded: true, blendStart: 100, opacity: 1, x: 0, y: 0 };
        const upper = { loaded: true, blendStart: 100, opacity: 1, x: 0, y: 0 };
        const tiles = [
            { tile: lower, level: 9, levelOpacity: 1 },
            { tile: upper, level: 10, levelOpacity: 0.5 }
        ];
        const originalNow = OpenSeadragon.now;
        let currentTime = 1500;
        OpenSeadragon.now = function() { return currentTime; };
        try {
            image._updateTilesInViewport(tiles);
            assert.strictEqual(upper.opacity, 0.5, 'cached upper tile halfway through its new fade');
            assert.strictEqual(image._isBlending, true, 'level timer keeps the stopped view drawing');

            currentTime = 2000;
            image._updateTilesInViewport(tiles);
            assert.strictEqual(upper.opacity, 1, 'upper level resolves fully after one second');
            assert.strictEqual(lower.opacity, 1, 'lower level stays opaque as a backdrop');
            assert.strictEqual(image._isBlending, false, 'no ongoing redraw after fade completes');

            currentTime = 3000;
            image._updateTilesInViewport(tiles);
            assert.strictEqual(upper.opacity, 1, 'stopped view never returns to fractional opacity');
        } finally {
            OpenSeadragon.now = originalNow;
        }
    });

    // ----------
    QUnit.test('alwaysBlend timer resets only when the preferred level changes', function(assert) {
        const image = Object.create(OpenSeadragon.TiledImage.prototype);
        image.alwaysBlend = true;
        image.blendTime = 1;
        image.minPixelRatio = 0.5;
        image.savedCutOffLevel = 0;
        image.immediateRender = false;
        image.loadDestinationTilesOnAnimation = false;
        image._scaleSpring = { current: { value: 1 } };
        image.source = {
            minLevel: 0,
            maxLevel: 2,
            getPixelRatio: function(level) {
                const ratio = Math.pow(2, -level);
                return new OpenSeadragon.Point(ratio, ratio);
            }
        };
        image.viewport = {
            deltaPixelsFromPointsNoRotate: function(point) { return point; }
        };
        image.getDrawArea = function() { return {}; };
        image._getCachedArray = function() { return []; };
        image._lastDrawn = [];
        image._tilesToDraw = [];
        image.maxTilesPerFrame = 1;
        image._currentMaxTilesPerFrame = 1;
        image.viewer = { world: { ensureTilesUpToDate: function() {} } };
        image._providesCoverage = function() { return true; };
        let levels = [];
        image._updateLevel = function(level, opacity, visibility, drawArea, loadArea) {
            levels.push({ level: level, opacity: opacity, loadArea: loadArea });
            return { tilesToDraw: [], bestLoadTileCandidates: [] };
        };

        const originalNow = OpenSeadragon.now;
        let currentTime = 1000;
        OpenSeadragon.now = function() { return currentTime; };
        try {
            image._updateLevelsForViewport();
            assert.deepEqual(levels.map(function(info) { return info.level; }), [1, 0],
                'new upper level retains its lower-level backing');
            assert.strictEqual(levels[0].opacity, 0, 'level 1 starts transparent');

            currentTime = 1500;
            levels = [];
            image._updateLevelsForViewport();
            assert.strictEqual(levels[0].opacity, 0.5, 'halfway through the one-second level fade');

            currentTime = 2000;
            levels = [];
            image._updateLevelsForViewport();
            assert.deepEqual(levels.map(function(info) { return info.level; }), [1],
                'opaque upper level no longer needs lower-level backing');
            assert.strictEqual(levels[0].opacity, 1, 'level 1 is fully opaque at rest');

            currentTime = 2200;
            image._scaleSpring.current.value = 2;
            levels = [];
            image._updateLevelsForViewport();
            assert.deepEqual(levels.map(function(info) { return info.level; }), [2, 1],
                'zoom selects level 2 and retains the lower one');
            assert.strictEqual(levels[0].opacity, 0, 'level 2 starts a new fade');

            currentTime = 2700;
            levels = [];
            image._updateLevelsForViewport();
            assert.strictEqual(levels[0].opacity, 0.5, 'same level does not restart its timer');

            currentTime = 2800;
            image._scaleSpring.current.value = 1;
            levels = [];
            image._updateLevelsForViewport();
            assert.deepEqual(levels.map(function(info) { return info.level; }), [1, 2],
                'zoom-out retains outgoing cached level 2 over new level 1');
            assert.strictEqual(levels[0].opacity, 1, 'incoming lower level is already opaque');
            assert.strictEqual(levels[1].opacity, 0.6, 'outgoing level starts at previous fade opacity');
            assert.strictEqual(levels[1].loadArea, null, 'outgoing cached tiles must not be downloaded');

            currentTime = 3300;
            levels = [];
            image._updateLevelsForViewport();
            assert.strictEqual(levels[1].opacity, 0.3, 'outgoing level fades out halfway through');

            currentTime = 3800;
            levels = [];
            image._updateLevelsForViewport();
            assert.deepEqual(levels.map(function(info) { return info.level; }), [1],
                'expired outgoing level is no longer selected');
        } finally {
            OpenSeadragon.now = originalNow;
        }
    });

    // ----------
    QUnit.test('alwaysBlend zoom-out redraws and retains lower coverage until fade-out ends', function(assert) {
        const image = Object.create(OpenSeadragon.TiledImage.prototype);
        image.alwaysBlend = true;
        image.blendTime = 1;
        image._alwaysBlendLevel = 1;
        image._alwaysBlendStart = 2800;
        image._alwaysBlendOutgoingLevel = 2;
        image._alwaysBlendOutgoingOpacity = 0.6;
        image._tilesToDraw = [];
        image.coverage = {};
        image._setCoverage = function() {};
        image._providesCoverage = function() { return true; };
        image.getDrawArea = function() { return true; };

        const lower = { loaded: true, blendStart: 100, x: 0, y: 0 };
        const upper = { loaded: true, blendStart: 100, x: 0, y: 0 };
        const tiles = [
            { tile: lower, level: 1 },
            { tile: upper, level: 2 }
        ];
        image._tilesToDraw[1] = [tiles[0]];
        image._tilesToDraw[2] = [tiles[1]];

        const originalNow = OpenSeadragon.now;
        let currentTime = 2800;
        OpenSeadragon.now = function() { return currentTime; };
        try {
            image._updateTilesInViewport(tiles);
            assert.strictEqual(lower.opacity, 1, 'new lower level remains fully opaque');
            assert.strictEqual(upper.opacity, 0.6, 'outgoing cached level preserves its starting opacity');
            assert.strictEqual(image._isBlending, true, 'fade-out requests redraw even at full opacity');
            assert.ok(image._tilesToDraw[1], 'outgoing level never prunes the lower backdrop');

            currentTime = 3300;
            image._updateTilesInViewport(tiles);
            assert.strictEqual(upper.opacity, 0.3, 'outgoing upper level fades down to 30 percent');
            assert.strictEqual(lower.opacity, 1, 'new lower level still covers the view');

            currentTime = 3800;
            image._updateTilesInViewport(tiles);
            assert.strictEqual(upper.opacity, 0, 'outgoing tile finishes fully transparent');
            assert.strictEqual(image._tilesToDraw[2], undefined, 'finished outgoing tiles are removed');
            assert.strictEqual(image._alwaysBlendOutgoingLevel, null, 'outgoing transition state clears');
            assert.ok(image._tilesToDraw[1], 'new preferred level remains available');
        } finally {
            OpenSeadragon.now = originalNow;
        }
    });

    // ----------
    QUnit.test('alwaysBlend uncached zoom-out keeps the opaque lower level without loading outgoing tiles', function(assert) {
        // A selected high-resolution level can be pending its first download when zooming back out.
        // The outgoing pass must not request or draw nonexistent high-level tiles.
        const image = Object.create(OpenSeadragon.TiledImage.prototype);
        image.alwaysBlend = true;
        image.blendTime = 1;
        image.minPixelRatio = 0.5;
        image.savedCutOffLevel = 0;
        image.immediateRender = false;
        image.loadDestinationTilesOnAnimation = false;
        image._alwaysBlendLevel = 2;
        image._alwaysBlendStart = 1000;
        image._alwaysBlendOutgoingLevel = null;
        image._alwaysBlendOutgoingOpacity = 1;
        image._scaleSpring = { current: { value: 1 } };
        image.source = {
            minLevel: 0,
            maxLevel: 2,
            getPixelRatio: function(level) {
                return new OpenSeadragon.Point(Math.pow(2, -level), Math.pow(2, -level));
            }
        };
        image.viewport = {
            deltaPixelsFromPointsNoRotate: function(point) { return point; }
        };
        image.viewer = { world: { ensureTilesUpToDate: function() {} } };
        image.getDrawArea = function() { return {}; };
        image._getCachedArray = function() { return []; };
        image._lastDrawn = [];
        image._tilesToDraw = [];
        image.coverage = {};
        image._setCoverage = function() {};
        image._providesCoverage = function() { return true; };
        image.maxTilesPerFrame = 1;
        image._currentMaxTilesPerFrame = 1;

        const lower = { loaded: true, blendStart: 100, x: 0, y: 0 };
        const calls = [];
        image._updateLevel = function(level, opacity, visibility, drawArea, loadArea) {
            calls.push({ level: level, opacity: opacity, loadArea: loadArea });
            return {
                tilesToDraw: level === 1 ? [{ tile: lower, level: 1 }] : [],
                bestLoadTileCandidates: []
            };
        };

        const originalNow = OpenSeadragon.now;
        let currentTime = 1500;
        OpenSeadragon.now = function() { return currentTime; };
        try {
            image._updateLevelsForViewport();
            assert.deepEqual(calls.map(function(info) { return info.level; }), [1, 2],
                'the new lower level is drawn before the uncached outgoing level is considered');
            assert.strictEqual(calls[0].opacity, 1, 'lower level starts fully opaque');
            assert.strictEqual(calls[1].opacity, 0.5, 'outgoing level retains its half-faded start');
            assert.strictEqual(calls[1].loadArea, null, 'no new request area for uncached outgoing tiles');
            assert.strictEqual(image.getTilesToDraw().length, 1, 'only the cached lower tile draws');
            assert.strictEqual(lower.opacity, 1, 'lower tile covers the view rather than fading out');

            currentTime = 2000;
            calls.length = 0;
            image._updateLevelsForViewport();
            assert.strictEqual(calls[1].opacity, 0.25, 'outgoing level would be one-quarter opaque halfway through');
            assert.strictEqual(calls[1].loadArea, null, 'outgoing level remains download-free');
            assert.strictEqual(image.getTilesToDraw().length, 1, 'no uncached upper tile enters the drawn set');

            currentTime = 2500;
            calls.length = 0;
            image._updateLevelsForViewport();
            const remaining = image.getTilesToDraw();
            assert.deepEqual(calls.map(function(info) { return info.level; }), [1],
                'outgoing level is no longer selected at the one-second endpoint');
            assert.strictEqual(image._alwaysBlendOutgoingLevel, null, 'outgoing state clears');
            assert.strictEqual(remaining.length, 1, 'lower tile remains visible');
            assert.strictEqual(remaining[0].tile, lower, 'the loaded lower tile is retained');
        } finally {
            OpenSeadragon.now = originalNow;
        }
    });

    // ----------
    QUnit.test('rotation', function(assert) {
        const done = assert.async();
        function testDefaultRotation() {
            const image = viewer.world.getItemAt(0);
            assert.strictEqual(image.getRotation(true), 0, 'image has default current rotation');
            assert.strictEqual(image.getRotation(false), 0, 'image has default target rotation');

            image.setRotation(400);
            assert.strictEqual(image.getRotation(true), 0, 'current rotation is not changed');
            assert.strictEqual(image.getRotation(false), 400, 'target rotation is set correctly');

            image.setRotation(200, true);
            assert.strictEqual(image.getRotation(true), 200, 'current rotation is set correctly');
            assert.strictEqual(image.getRotation(false), 200, 'target rotation is set correctly');

            viewer.addOnceHandler('open', testTileSourceRotation);
            viewer.open({
                tileSource: '/test/data/testpattern.dzi',
                degrees: -60
            });
        }

        function testTileSourceRotation() {
            const image = viewer.world.getItemAt(0);
            assert.strictEqual(image.getRotation(true), -60, 'image has correct current rotation');
            assert.strictEqual(image.getRotation(false), -60, 'image has correct target rotation');
            done();
        }

        viewer.addOnceHandler('open', testDefaultRotation);
        viewer.open({
            tileSource: '/test/data/testpattern.dzi',
        });
    });

    QUnit.test('fitBounds', function(assert) {
        const done = assert.async();
        function assertRectEquals(actual, expected, message) {
            assert.ok(actual.equals(expected), message + ' should be ' +
                expected.toString() + ', found ' + actual.toString());
        }

        viewer.addHandler('open', function openHandler() {
            viewer.removeHandler('open', openHandler);

            const squareImage = viewer.world.getItemAt(0);
            squareImage.fitBounds(
                new OpenSeadragon.Rect(0, 0, 1, 2),
                OpenSeadragon.Placement.CENTER,
                true);
            let actualBounds = squareImage.getBounds(true);
            let expectedBounds = new OpenSeadragon.Rect(0, 0.5, 1, 1);
            assertRectEquals(actualBounds, expectedBounds, 'Square image bounds');

            const tallImage = viewer.world.getItemAt(1);
            tallImage.fitBounds(
                new OpenSeadragon.Rect(0, 0, 1, 2),
                OpenSeadragon.Placement.TOP_LEFT,
                true);
            actualBounds = tallImage.getBounds(true);
            expectedBounds = new OpenSeadragon.Rect(0, 0, 0.5, 2);
            assertRectEquals(actualBounds, expectedBounds, 'Tall image bounds');

            const wideImage = viewer.world.getItemAt(2);
            wideImage.fitBounds(
                new OpenSeadragon.Rect(0, 0, 1, 2),
                OpenSeadragon.Placement.BOTTOM_RIGHT,
                true);
            actualBounds = wideImage.getBounds(true);
            expectedBounds = new OpenSeadragon.Rect(0, 1.75, 1, 0.25);
            assertRectEquals(actualBounds, expectedBounds, 'Wide image bounds');
            done();
        });

        viewer.open([
            '/test/data/testpattern.dzi',
            '/test/data/tall.dzi',
            '/test/data/wide.dzi'
        ]);
    });

    // ----------
    QUnit.test('fitBounds in constructor', function(assert) {
        const done = assert.async();
        function assertRectEquals(actual, expected, message) {
            assert.ok(actual.equals(expected), message + ' should be ' +
                expected.toString() + ', found ' + actual.toString());
        }

        viewer.addHandler('open', function openHandler() {
            viewer.removeHandler('open', openHandler);

            const squareImage = viewer.world.getItemAt(0);
            let actualBounds = squareImage.getBounds(true);
            let expectedBounds = new OpenSeadragon.Rect(0, 0.5, 1, 1);
            assertRectEquals(actualBounds, expectedBounds, 'Square image bounds');

            const tallImage = viewer.world.getItemAt(1);
            actualBounds = tallImage.getBounds(true);
            expectedBounds = new OpenSeadragon.Rect(0, 0, 0.5, 2);
            assertRectEquals(actualBounds, expectedBounds, 'Tall image bounds');

            const wideImage = viewer.world.getItemAt(2);
            actualBounds = wideImage.getBounds(true);
            expectedBounds = new OpenSeadragon.Rect(0, 1.75, 1, 0.25);
            assertRectEquals(actualBounds, expectedBounds, 'Wide image bounds');
            done();
        });

        viewer.open([{
                tileSource: '/test/data/testpattern.dzi',
                x: 1, // should be ignored
                y: 1, // should be ignored
                width: 2, // should be ignored
                fitBounds: new OpenSeadragon.Rect(0, 0, 1, 2)
                // No placement specified, should default to CENTER
            }, {
                tileSource: '/test/data/tall.dzi',
                fitBounds: new OpenSeadragon.Rect(0, 0, 1, 2),
                fitBoundsPlacement: OpenSeadragon.Placement.TOP_LEFT
            }, {
                tileSource: '/test/data/wide.dzi',
                fitBounds: new OpenSeadragon.Rect(0, 0, 1, 2),
                fitBoundsPlacement: OpenSeadragon.Placement.BOTTOM_RIGHT
            }]);
    });

    // ----------
    QUnit.test('fitBounds with clipping', function(assert) {
        const done = assert.async();
        function assertRectEquals(actual, expected, message) {
            assert.ok(actual.equals(expected), message + ' should be ' +
                expected.toString() + ', found ' + actual.toString());
        }

        viewer.addHandler('open', function openHandler() {
            viewer.removeHandler('open', openHandler);

            const squareImage = viewer.world.getItemAt(0);
            let actualBounds = squareImage.getBounds(true);
            let expectedBounds = new OpenSeadragon.Rect(-1, -1, 2, 2);
            assertRectEquals(actualBounds, expectedBounds, 'Square image bounds');

            const tallImage = viewer.world.getItemAt(1);
            actualBounds = tallImage.getBounds(true);
            expectedBounds = new OpenSeadragon.Rect(1, 1, 2, 8);
            assertRectEquals(actualBounds, expectedBounds, 'Tall image bounds');

            const wideImage = viewer.world.getItemAt(2);
            actualBounds = wideImage.getBounds(true);
            expectedBounds = new OpenSeadragon.Rect(1, 1, 16, 4);
            assertRectEquals(actualBounds, expectedBounds, 'Wide image bounds');
            done();
        });

        viewer.open([{
                tileSource: '/test/data/testpattern.dzi',
                clip: new OpenSeadragon.Rect(500, 500, 500, 500),
                fitBounds: new OpenSeadragon.Rect(0, 0, 1, 1)
            }, {
                tileSource: '/test/data/tall.dzi',
                clip: new OpenSeadragon.Rect(0, 0, 250, 100),
                fitBounds: new OpenSeadragon.Rect(1, 1, 1, 2),
                fitBoundsPlacement: OpenSeadragon.Placement.TOP
            }, {
                tileSource: '/test/data/wide.dzi',
                clip: new OpenSeadragon.Rect(0, 0, 100, 250),
                fitBounds: new OpenSeadragon.Rect(1, 1, 1, 2),
                fitBoundsPlacement: OpenSeadragon.Placement.TOP_LEFT
            }]);
    });

    // ----------
    QUnit.test('fullyLoaded', function(assert) {
        const done = assert.async();
        viewer.addHandler('open', function openHandler() {
            viewer.removeHandler('open', openHandler);

            const image = viewer.world.getItemAt(0);
            assert.equal(image.getFullyLoaded(), false, 'not fully loaded at first');

            // Zoom out enough that we don't start out with all the tiles loaded.
            viewer.viewport.zoomBy(0.5, null, true);

            let count = 0;

            const fullyLoadedChangeHandler = function(event) {
                if (count === 0) {
                    assert.equal(event.fullyLoaded, true, 'event includes true fullyLoaded property');
                    assert.equal(image.getFullyLoaded(), true, 'image is fully loaded after event');

                    // Zoom in enough that it needs to load some new tiles.
                    viewer.viewport.zoomBy(5, null, true);
                } else if (count === 1) {
                    assert.equal(event.fullyLoaded, false, 'event includes false fullyLoaded property');
                    assert.equal(image.getFullyLoaded(), false, 'image is not fully loaded after zoom');
                } else {
                    image.removeHandler('fully-loaded-change', fullyLoadedChangeHandler);
                    assert.equal(image.getFullyLoaded(), true, 'image is once again fully loaded');
                    done();
                }

                count++;
            };

            image.addHandler('fully-loaded-change', fullyLoadedChangeHandler);
        });

        viewer.open([{
            tileSource: '/test/data/tall.dzi',
        }]);
    });

    QUnit.test('_visitTiles matches Rect.intersection for every candidate tile', function(assert) {
        const done = assert.async();

        viewer.addHandler('open', function() {
            const image = viewer.world.getItemAt(0);
            const level = image.source.maxLevel;
            const tile = image.getTileBounds(level, 1, 1);
            const left = tile.x / 2;
            const top = tile.y / 2;

            const areas = {
                interior: new OpenSeadragon.Rect(0.3, 0.3, 0.2, 0.2),
                'ending on a tile edge': new OpenSeadragon.Rect(left, tile.y + 0.01, left, 0.1),
                'ending on a tile corner': new OpenSeadragon.Rect(left, top, left, top),
                'zero width': new OpenSeadragon.Rect(tile.x, 0.1, 0, 0.5),
                'zero size': new OpenSeadragon.Rect(tile.x, tile.y, 0, 0),
                rotated: new OpenSeadragon.Rect(0.3, 0.3, 0.2, 0.2, 30),
                'past the right of the image': new OpenSeadragon.Rect(0.8, 0.2, 0.5, 0.3),
            };

            function check(label) {
                Object.keys(areas).forEach(function(name) {
                    const area = areas[name];
                    const candidates = [];
                    const getTileBounds = image.getTileBounds;
                    image.getTileBounds = function(l, x, y) {
                        const bounds = getTileBounds.apply(this, arguments);
                        candidates.push({ key: x + ',' + y, bounds: bounds });
                        return bounds;
                    };
                    const visited = new Set();
                    image._visitTiles(level, area, function(x, y) {
                        visited.add(x + ',' + y);
                    });
                    image.getTileBounds = getTileBounds;

                    const mismatches = candidates.filter(function(candidate) {
                        return visited.has(candidate.key) !== (area.intersection(candidate.bounds) !== null);
                    }).map(function(candidate) {
                        return candidate.key;
                    });
                    assert.deepEqual(mismatches, [], label + ', ' + name + ': visits the tiles Rect.intersection reports');
                });
            }

            check('plain');
            image.wrapHorizontal = true;
            check('wrapped');
            image.wrapHorizontal = false;
            image.setFlip(true);
            check('flipped');
            done();
        });

        // Power-of-two sizes put tile edges on exact binary fractions, so an area can end exactly on one
        viewer.open({
            width: 1024,
            height: 1024,
            tileSize: 256,
            getTileUrl: function() {
                return '/test/data/testpattern_files/0/0_0.jpg';
            }
        });
    });

    QUnit.test('_getCornerTiles without wrapping', function(assert) {
        const tiledImageMock = MockSeadragon.getTiledImage(null, {
            wrapHorizontal: false,
            wrapVertical: false,
            source: MockSeadragon.getTileSource({
                width: 1500,
                height: 1000,
                tileWidth: 200,
                tileHeight: 150,
                tileOverlap: 1,
            })
        });
        const _getCornerTiles = OpenSeadragon.TiledImage.prototype._getCornerTiles.bind(tiledImageMock);

        function assertCornerTiles(topLeftBound, bottomRightBound,
            expectedTopLeft, expectedBottomRight) {
            const cornerTiles = _getCornerTiles(11, topLeftBound, bottomRightBound);
            assert.ok(cornerTiles.topLeft.equals(expectedTopLeft),
                'Top left tile should be ' + expectedTopLeft.toString() +
                ' found ' + cornerTiles.topLeft.toString());
            assert.ok(cornerTiles.bottomRight.equals(expectedBottomRight),
                'Bottom right tile should be ' + expectedBottomRight.toString() +
                ' found ' + cornerTiles.bottomRight.toString());
        }

        assertCornerTiles(
            new OpenSeadragon.Point(0, 0),
            new OpenSeadragon.Point(1, 10 / 15),
            new OpenSeadragon.Point(0, 0),
            new OpenSeadragon.Point(7, 6)
        );

        // Floating point errors should be handled
        assertCornerTiles(
            new OpenSeadragon.Point(-1e-14, -1e-14),
            new OpenSeadragon.Point(1 + 1e-14, 10 / 15 + 1e-14),
            new OpenSeadragon.Point(0, 0),
            new OpenSeadragon.Point(7, 6)
        );

        assertCornerTiles(
            new OpenSeadragon.Point(0.3, 0.5),
            new OpenSeadragon.Point(0.5, 0.6),
            new OpenSeadragon.Point(2, 5),
            new OpenSeadragon.Point(3, 6)
        );
    });

    QUnit.test('_getCornerTiles with horizontal wrapping', function(assert) {
        const tiledImageMock = MockSeadragon.getTiledImage(null, {
            wrapHorizontal: true,
            wrapVertical: false,
            source: MockSeadragon.getTileSource({
                tileOverlap: 1
            })
        });
        const _getCornerTiles = OpenSeadragon.TiledImage.prototype._getCornerTiles.bind(tiledImageMock);

        function assertCornerTiles(topLeftBound, bottomRightBound,
            expectedTopLeft, expectedBottomRight) {
            const cornerTiles = _getCornerTiles(11, topLeftBound, bottomRightBound);
            assert.ok(cornerTiles.topLeft.equals(expectedTopLeft),
                'Top left tile should be ' + expectedTopLeft.toString() +
                ' found ' + cornerTiles.topLeft.toString());
            assert.ok(cornerTiles.bottomRight.equals(expectedBottomRight),
                'Bottom right tile should be ' + expectedBottomRight.toString() +
                ' found ' + cornerTiles.bottomRight.toString());
        }

        assertCornerTiles(
            new OpenSeadragon.Point(0, 0),
            new OpenSeadragon.Point(1, 10 / 15),
            new OpenSeadragon.Point(0, 0),
            new OpenSeadragon.Point(8, 6)
        );

        assertCornerTiles(
            new OpenSeadragon.Point(-1, 0),
            new OpenSeadragon.Point(0.5, 10 / 15 + 1e-14),
            new OpenSeadragon.Point(-8, 0),
            new OpenSeadragon.Point(3, 6)
        );

        assertCornerTiles(
            new OpenSeadragon.Point(1.3, 0.5),
            new OpenSeadragon.Point(1.5, 0.6),
            new OpenSeadragon.Point(10, 5),
            new OpenSeadragon.Point(11, 6)
        );
    });

    QUnit.test('_getCornerTiles with vertical wrapping', function(assert) {
        const tiledImageMock = MockSeadragon.getTiledImage(null, {
            wrapHorizontal: false,
            wrapVertical: true,
            source: MockSeadragon.getTileSource({
                tileOverlap: 1
            })
        });
        const _getCornerTiles = OpenSeadragon.TiledImage.prototype._getCornerTiles.bind(tiledImageMock);

        function assertCornerTiles(topLeftBound, bottomRightBound,
            expectedTopLeft, expectedBottomRight) {
            const cornerTiles = _getCornerTiles(11, topLeftBound, bottomRightBound);
            assert.ok(cornerTiles.topLeft.equals(expectedTopLeft),
                'Top left tile should be ' + expectedTopLeft.toString() +
                ' found ' + cornerTiles.topLeft.toString());
            assert.ok(cornerTiles.bottomRight.equals(expectedBottomRight),
                'Bottom right tile should be ' + expectedBottomRight.toString() +
                ' found ' + cornerTiles.bottomRight.toString());
        }

        assertCornerTiles(
            new OpenSeadragon.Point(0, 0),
            new OpenSeadragon.Point(1, 10 / 15),
            new OpenSeadragon.Point(0, 0),
            new OpenSeadragon.Point(7, 7)
        );

        assertCornerTiles(
            new OpenSeadragon.Point(0, -10 / 15 / 2),
            new OpenSeadragon.Point(0.5, 0.5),
            new OpenSeadragon.Point(0, -4),
            new OpenSeadragon.Point(3, 5)
        );

        assertCornerTiles(
            new OpenSeadragon.Point(0, 10 / 15 + 0.1),
            new OpenSeadragon.Point(0.3, 10 / 15 + 0.3),
            new OpenSeadragon.Point(0, 7),
            new OpenSeadragon.Point(2, 9)
        );
    });

})();
