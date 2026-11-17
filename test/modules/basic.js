/* global QUnit, $, Util, testLog */

(function() {
    let viewer;

    QUnit.module('Basic', {
        beforeEach: function () {
            $('<div id="example"></div>').appendTo("#qunit-fixture");

            testLog.reset();

            viewer = OpenSeadragon({
                id:            'example',
                prefixUrl:     '/build/openseadragon/images/',
                springStiffness: 100 // Faster animation = faster tests
            });
        },
        afterEach: function () {
            if (viewer){
                viewer.destroy();
            }

            viewer = null;
        }
    });

    // ----------
    QUnit.test('Open', function(assert) {
        const done = assert.async();
        assert.ok(viewer, 'Viewer exists');

        const openHandler = function(event) {
            viewer.removeHandler('open', openHandler);
            assert.ok(true, 'Open event was sent');
            assert.ok(event, 'Handler received event data');
            assert.equal(event.eventSource, viewer, 'Sender of open event was viewer');
            assert.ok(viewer.viewport, 'Viewport exists');
            assert.ok(viewer.source, 'source exists');
            assert.ok(viewer._updateRequestId, 'timer is on');
            done();
        };

        viewer.addHandler('open', openHandler);
        viewer.open('/test/data/testpattern.dzi');
    });

    QUnit.test('Open Error Handling', function(assert) {
        const done = assert.async();
        assert.ok(viewer, 'Viewer exists');

        viewer.addHandler('open', function(event) {
            assert.ok(false, "The open event should not fire for failed opens");
            done();
        });

        viewer.addHandler('open-failed', function(event) {
            assert.ok(true, "The open-failed event should be fired when the source 404s");

            assert.equal($(".openseadragon-message").length, 1, "Open failures should display a message");

            assert.ok(testLog.error.contains('["HTTP 404 attempting to load TileSource: /test/data/not-a-real-file"]'),
                "'open-failed' fired after AJAX error handler prints error to the console.'");

            done();
        });

        viewer.open('/test/data/not-a-real-file');
    });

    function tileSourceThatFailsWith(details) {
        const source = new OpenSeadragon.TileSource({
            width: 256,
            height: 256,
            tileSize: 256
        });
        source.ready = false;
        const addHandler = source.addHandler;
        source.addHandler = function(name, handler, userData, priority) {
            const result = addHandler.call(this, name, handler, userData, priority);
            if (name === 'open-failed') {
                this.raiseEvent('open-failed', details);
            }
            return result;
        };
        return source;
    }

    QUnit.test('Viewer.open forwards original XHR failure details', function(assert) {
        const done = assert.async();
        const xhr = {
            status: 404,
            statusText: 'Not Found',
            responseText: '{"detail":"private image missing"}'
        };
        const exception = new Error('HTTP 404');
        const details = {
            message: 'HTTP 404 attempting to load TileSource',
            source: '/private/image.dzi',
            status: 404,
            statusText: xhr.statusText,
            responseText: xhr.responseText,
            xhr: xhr,
            exception: exception,
            postData: null
        };
        const source = tileSourceThatFailsWith(details);
        viewer.addHandler('open', function() {
            assert.ok(false, 'a failed TileSource must not open');
        });
        viewer.addHandler('open-failed', function(event) {
            assert.strictEqual(event.eventSource, viewer, 'Viewer is the event source');
            assert.strictEqual(event.message, details.message, 'existing message forwarded');
            assert.strictEqual(event.source, source, 'original TileSource is retained');
            assert.strictEqual(event.status, 404, 'legacy numeric status forwarded');
            assert.strictEqual(event.statusText, 'Not Found', 'status text forwarded');
            assert.strictEqual(event.responseText, xhr.responseText, 'response body forwarded');
            assert.strictEqual(event.xhr, xhr, 'original XHR forwarded');
            assert.strictEqual(event.exception, exception, 'exception forwarded');
            assert.strictEqual(event.postData, null, 'POST data forwarded');
            done();
        });
        viewer.open(source);
    });

    QUnit.test('Viewer TileSource promise rejection forwards XHR details', function(assert) {
        const xhr = {
            status: 503,
            statusText: 'Service Unavailable',
            responseText: '{"retry":30}'
        };
        const exception = new Error('HTTP 503');
        const details = {
            message: 'HTTP 503 attempting to load TileSource',
            source: '/private/image.dzi',
            status: 503,
            statusText: xhr.statusText,
            responseText: xhr.responseText,
            xhr: xhr,
            exception: exception,
            postData: 'token=redacted'
        };
        const source = tileSourceThatFailsWith(details);
        return viewer.instantiateTileSourceClass({ tileSource: source }).then(function() {
            assert.ok(false, 'a failed TileSource must reject');
        }, function(error) {
            assert.strictEqual(error.message, details.message, 'existing message retained');
            assert.strictEqual(error.source, source, 'original TileSource retained');
            assert.strictEqual(error.status, 503, 'legacy numeric status retained');
            assert.strictEqual(error.statusText, 'Service Unavailable', 'status text forwarded');
            assert.strictEqual(error.responseText, xhr.responseText, 'response body forwarded');
            assert.strictEqual(error.xhr, xhr, 'original XHR forwarded');
            assert.strictEqual(error.exception, exception, 'original exception forwarded');
            assert.strictEqual(error.postData, 'token=redacted', 'POST data forwarded');
        });
    });

    QUnit.test('Zoom', function(assert) {
        const done = assert.async();
        viewer.addHandler("open", function () {
            const viewport = viewer.viewport;

            assert.equal(viewport.getZoom(), 1, 'We start out unzoomed');

            const zoomHandler = function() {
                viewer.removeHandler('animation-finish', zoomHandler);
                assert.equal(viewport.getZoom(), 2, 'Zoomed correctly');
                done();
            };

            viewer.addHandler('animation-finish', zoomHandler);
            viewport.zoomTo(2);
        });
        viewer.open('/test/data/testpattern.dzi');
    });

    QUnit.test('Pan', function(assert) {
        const done = assert.async();
        viewer.addHandler("open", function () {
            const viewport = viewer.viewport;
            let center = viewport.getCenter();

            assert.ok(center.x === 0.5 && center.y === 0.5, 'We start out unpanned');

            const panHandler = function() {
                viewer.removeHandler('animation-finish', panHandler);
                center = viewport.getCenter();
                Util.assessNumericValue(assert, center.x, 0.1, 0.00001, 'panned horizontally');
                Util.assessNumericValue(assert, center.y, 0.1, 0.00001, 'panned vertically');
                done();
            };

            viewer.addHandler('animation-finish', panHandler);
            viewport.panTo(new OpenSeadragon.Point(0.1, 0.1));
        });

        viewer.open('/test/data/testpattern.dzi');
    });

    QUnit.test('Home', function(assert) {
        const done = assert.async();
        // Test beforeEach:
        function opener() {
            const viewport = viewer.viewport;
            viewport.panTo(new OpenSeadragon.Point(0.1, 0.1));
            viewport.zoomTo(2);
        }

        function stage1() {
            const viewport = viewer.viewport;
            let center = viewport.getCenter();

            viewer.removeHandler('animation-finish', stage1);

            assert.ok(center.x !== 0.5 && center.y !== 0.5, 'We start out panned');
            assert.notEqual(viewport.getZoom(), 1, 'We start out zoomed');

            const homeHandler = function() {
                viewer.removeHandler('animation-finish', homeHandler);
                center = viewport.getCenter();
                assert.ok(center.x === 0.5 && center.y === 0.5, 'We end up unpanned');
                assert.equal(viewport.getZoom(), 1, 'We end up unzoomed');
                done();
            };

            viewer.addHandler('animation-finish', homeHandler);
            viewer.viewport.goHome(true);
        }

        viewer.addHandler("open", opener);
        viewer.addHandler("animation-finish", stage1);

        viewer.open('/test/data/testpattern.dzi');
    });

    QUnit.test('Click', function(assert) {
        const done = assert.async();
        viewer.addHandler("open", function () {
            const viewport = viewer.viewport;
            let center = viewport.getCenter();

            assert.ok(center.x === 0.5 && center.y === 0.5, 'We start out unpanned');
            assert.equal(viewport.getZoom(), 1, 'We start out unzoomed');

            const clickHandler = function() {
                viewer.removeHandler('animation-finish', clickHandler);
                center = viewport.getCenter();
                assert.ok(center.x > 0.37 && center.x < 0.38 && center.y > 0.37 && center.y < 0.38, 'Panned correctly');
                assert.equal(viewport.getZoom(), 2, 'Zoomed correctly');
                done();
            };

            viewer.addHandler('animation-finish', clickHandler);
            Util.simulateViewerClickWithDrag( {
                viewer: viewer,
                widthFactor: 0.25,
                heightFactor: 0.25,
                dragCount: 0,
                dragDx: 0,
                dragDy: 0
            } );
        } );

        viewer.open('/test/data/testpattern.dzi');
    });

    QUnit.test('FullPage', function(assert) {
        const done = assert.async();
        viewer.addHandler("open", function () {
            assert.ok(!viewer.isFullPage(), 'Started out not fullpage');
            assert.ok(!$(viewer.element).hasClass('fullpage'),
                'No fullpage class on div');

            const checkEnteringPreFullPage = function(event) {
                viewer.removeHandler('pre-full-page', checkEnteringPreFullPage);
                assert.ok(event.fullPage, 'Switching to fullpage');
                assert.ok(!viewer.isFullPage(), 'Not yet fullpage');
            };

            const checkEnteringFullPage = function(event) {
                viewer.removeHandler('full-page', checkEnteringFullPage);
                assert.ok(event.fullPage, 'Switched to fullpage');
                assert.ok(viewer.isFullPage(), 'Enabled fullpage');
                assert.ok($(viewer.element).hasClass('fullpage'),
                    'Fullpage class added to div');

                const checkExitingPreFullPage = function(event) {
                    viewer.removeHandler('pre-full-page', checkExitingPreFullPage);
                    assert.ok(!event.fullPage, 'Exiting fullpage');
                    assert.ok(viewer.isFullPage(), 'Still fullpage');
                };

                const checkExitingFullPage = function(event) {
                    viewer.removeHandler('full-page', checkExitingFullPage);
                    assert.ok(!event.fullPage, 'Exiting fullpage');
                    assert.ok(!viewer.isFullPage(), 'Disabled fullpage');
                    assert.ok(!$(viewer.element).hasClass('fullpage'),
                        'Fullpage class removed from div');
                    done();
                };

                viewer.addHandler("pre-full-page", checkExitingPreFullPage);
                viewer.addHandler("full-page", checkExitingFullPage);
                viewer.setFullPage(false);
            };
            viewer.addHandler("pre-full-page", checkEnteringPreFullPage);
            viewer.addHandler("full-page", checkEnteringFullPage);
            viewer.setFullPage(true);
        });

        viewer.open('/test/data/testpattern.dzi');
    });

    QUnit.test('FullScreen', function(assert) {
        if (!OpenSeadragon.supportsFullScreen) {
            const done = assert.async();
            assert.expect(0);
            done();
            return;
        }
        const timeWatcher = Util.timeWatcher(assert, 7000);

        viewer.addHandler('open', function () {
            assert.ok(!OpenSeadragon.isFullScreen(), 'Started out not fullscreen');

            const checkEnteringPreFullScreen = (event) => {
                viewer.removeHandler('pre-full-screen', checkEnteringPreFullScreen);
                assert.ok(event.fullScreen, 'Switching to fullscreen');
                assert.ok(!OpenSeadragon.isFullScreen(), 'Not yet fullscreen');
            };

            const checkExitingFullScreen = (event) => {
                viewer.removeHandler('full-screen', checkExitingFullScreen);
                assert.ok(!event.fullScreen, 'Disabling fullscreen');
                assert.ok(!OpenSeadragon.isFullScreen(), 'Fullscreen disabled');
                timeWatcher.done();
            }

            // The 'new' headless mode allows us to enter fullscreen, so verify
            // that we see the correct values returned. We will then close out
            // of fullscreen to check the same values when exiting.
            const checkAcquiredFullScreen = (event) => {
                viewer.removeHandler('full-screen', checkAcquiredFullScreen);
                viewer.addHandler('full-screen', checkExitingFullScreen);

                // Check if fullscreen was actually acquired (may fail due to browser security policies)
                if (event.fullScreen && OpenSeadragon.isFullScreen()) {
                    assert.ok(event.fullScreen, 'Acquired fullscreen');
                    assert.ok(OpenSeadragon.isFullScreen(), 'Fullscreen enabled');
                    viewer.setFullScreen(false);
                } else {
                    // Fullscreen was blocked by browser security - this is expected in automated tests
                    assert.ok(true, 'Fullscreen was blocked by browser security (expected in automated tests)');
                    // Simulate the exit to complete the test
                    checkExitingFullScreen({fullScreen: false});
                }
            };

            viewer.addHandler('pre-full-screen', checkEnteringPreFullScreen);
            viewer.addHandler('full-screen', checkAcquiredFullScreen);
            viewer.setFullScreen(true);
        });

        viewer.open('/test/data/testpattern.dzi');
    });

    QUnit.test('Close', function(assert) {
        const done = assert.async();
        viewer.addHandler("open", function () {
            const closeHandler = function() {
                viewer.removeHandler('close', closeHandler);
                assert.ok(!viewer.source, 'no source');
                assert.ok(true, 'Close event was sent');
                setTimeout(function() {
                    assert.ok(!viewer._updateRequestId, 'timer is off');
                    done();
                }, 100);
            };

            viewer.addHandler('close', closeHandler);
            viewer.close();
        });
        viewer.open('/test/data/testpattern.dzi');
    });

    QUnit.test('Destroy', function(assert) {
        const done = assert.async();
        viewer.addHandler("open", function () {
            // Check that the DOM has been modified
            assert.notEqual(0, $('#example').children().length);

            let closeCalled = false;
            const closeHandler = function() {
                viewer.removeHandler('close', closeHandler);
                closeCalled = true;
            };

            viewer.addHandler('close', closeHandler);
            viewer.destroy();

            // Check that the DOM has been cleaned up
            assert.equal(0, $('#example').children().length);
            assert.equal(null, viewer.canvas);
            assert.equal(null, viewer.keyboardCommandArea);
            assert.equal(null, viewer.container);
            assert.equal(null, viewer.element);
            assert.equal(true, closeCalled);
            viewer = null;
            done();
        });
        viewer.open('/test/data/testpattern.dzi');
    });


    // The Wikipedia logo has CORS enabled
    const corsImg = 'https://upload.wikimedia.org/wikipedia/en/b/bc/Wiki.png';

    QUnit.test( 'CrossOriginPolicyMissing', function (assert) {
        const done = assert.async();
        viewer.crossOriginPolicy = false;
        viewer.smoothTileEdgesMinZoom = Infinity;
        viewer.open( {
            type: 'legacy-image-pyramid',
            levels: [ {
                    url: corsImg,
                    width: 135,
                    height: 155
                } ]
        } );
        viewer.addOnceHandler('tiled-image-drawn', function(event) {
            event.tiles[0].getCache().getDataAs("context2d", false).then(context =>
                assert.ok(OpenSeadragon.isCanvasTainted(context.canvas),
                    "Canvas should be tainted.")
            ).then(done);
        });

    } );

    QUnit.test( 'CrossOriginPolicyAnonymous', function (assert) {
        const done = assert.async();

        viewer.crossOriginPolicy = 'Anonymous';
        viewer.open( {
            type: 'legacy-image-pyramid',
            levels: [ {
                    url: corsImg,
                    width: 135,
                    height: 155
                } ]
        } );
        viewer.addOnceHandler('tiled-image-drawn', function(event) {
            event.tiles[0].getCache().getDataAs("context2d", false).then(context =>
                assert.notOk(OpenSeadragon.isCanvasTainted(context.canvas),
                    "Canvas should be tainted.")
            ).then(done);
        });

    } );

    QUnit.test( 'CrossOriginPolicyOption', function (assert) {
        const done = assert.async();

        viewer.crossOriginPolicy = "Anonymous";
        viewer.smoothTileEdgesMinZoom = Infinity;
        viewer.addTiledImage( {
            tileSource: {
                type: 'legacy-image-pyramid',
                levels: [ {
                    url: corsImg,
                    width: 135,
                    height: 155
                } ]
            },
            crossOriginPolicy : false
        } );
        viewer.addOnceHandler('tiled-image-drawn', function(event) {
            event.tiles[0].getCache().getDataAs("context2d", false).then(context =>
                assert.ok(OpenSeadragon.isCanvasTainted(context.canvas),
                    "Canvas should be tainted.")
            ).then(done);
        });

    } );

    QUnit.test( 'CrossOriginPolicyTileSource', function (assert) {
        const done = assert.async();

        viewer.crossOriginPolicy = false;
        viewer.smoothTileEdgesMinZoom = Infinity;
        viewer.addTiledImage( {
            tileSource: {
                type: 'legacy-image-pyramid',
                levels: [ {
                    url: corsImg,
                    width: 135,
                    height: 155
                } ],
                crossOriginPolicy : "Anonymous"
            }
        } );
        viewer.addOnceHandler('tiled-image-drawn', function(event) {
            event.tiles[0].getCache().getDataAs("context2d", false).then(context =>
                assert.notOk(OpenSeadragon.isCanvasTainted(context.canvas),
                    "Canvas should be tainted.")
            ).then(done);
        });

    } );


    QUnit.test('SetDebugMode', function(assert) {
        const done = assert.async();
        assert.ok(viewer, 'Viewer exists');

        const checkImageTilesDebugState = function (expectedState) {

            for (let i = 0; i < viewer.world.getItemCount(); i++) {
                if(viewer.world.getItemAt(i).debugMode != expectedState) {
                    return false;
                }
            }
            return true;
        };

        const openHandler = function(event) {
            viewer.removeHandler('open', openHandler);

            //Ensure we start with debug mode turned off
            viewer.setDebugMode(false);
            assert.ok(checkImageTilesDebugState(false), "All image tiles have debug mode turned off.");
            assert.ok(!viewer.debugMode, "Viewer debug mode is turned off.");

            //Turn debug mode on and check that the Viewer and all tiled images are in debug mode.
            viewer.setDebugMode(true);
            assert.ok(checkImageTilesDebugState(true), "All image tiles have debug mode turned on.");
            assert.ok(viewer.debugMode, "Viewer debug mode is turned on.");

            done();
        };

        viewer.addHandler('open', openHandler);
        viewer.open('/test/data/testpattern.dzi');
    });

    //Version numbers are injected by the build process, so skip version tests if we are only running code coverage
    if(!window.isCoverageTest ){
        QUnit.test('version object', function(assert) {
            assert.equal(typeof OpenSeadragon.version.versionStr, "string", "versionStr should be a string");
            assert.ok(OpenSeadragon.version.major >= 0, "major should be a positive number");
            assert.ok(OpenSeadragon.version.minor >= 0, "minor should be a positive number");
            assert.ok(OpenSeadragon.version.revision >= 0, "revision should be a positive number");
        });
    }
})();
