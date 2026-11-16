/* global QUnit, $,testLog */

( function() {
    let viewer;
    const drawerTypes = ['webgl','canvas'];
    drawerTypes.forEach(runDrawerTests);

    function runDrawerTests(drawerType){

        QUnit.module( 'Multi-Image-'+drawerType, {
            beforeEach: function() {
                $( '<div id="example"></div>' ).appendTo( "#qunit-fixture" );

                testLog.reset();

                viewer = OpenSeadragon( {
                    id: 'example',
                    prefixUrl: '/build/openseadragon/images/',
                    springStiffness: 100, // Faster animation = faster tests
                    drawer: drawerType
                });
            },
            afterEach: function() {
                if (viewer){
                    viewer.destroy();
                }

                viewer = null;
                $("#example").remove();
            }
        } );

        // ----------
        QUnit.test( 'Multi-image operations', function(assert) {
            const done = assert.async();
            assert.expect( 24 );
            viewer.addHandler( "open", function( ) {
                assert.equal( 1, viewer.world.getItemCount( ),
                    "One item should be present after opening." );
                const options = {
                    tileSource: {
                        type: 'legacy-image-pyramid',
                        levels: [ {
                                url: "data/A.png",
                                width: 1000,
                                height: 1000
                            } ]
                    }
                };
                viewer.addTiledImage( options );
                viewer.world.addHandler( "add-item", function addFirstItemHandler( event ) {
                    viewer.world.removeHandler( "add-item", addFirstItemHandler );
                    const item1 = event.item;
                    assert.equal( viewer.world.getItemCount( ), 2,
                        "2 items should be present after adding a item." );
                    assert.equal( viewer.world.getIndexOfItem( item1 ), 1,
                        "The first added item should have a index of 1" );
                    assert.equal( viewer.world.getItemAt( 1 ), item1,
                        "The item at index 1 should be the first added item." );

                    viewer.addTiledImage( options );
                    viewer.world.addHandler( "add-item", function addSecondItemHandler( event ) {
                        viewer.world.removeHandler( "add-item", addSecondItemHandler );
                        const item2 = event.item;
                        assert.equal( viewer.world.getItemCount( ), 3,
                            "3 items should be present after adding a second item." );
                        assert.equal( viewer.world.getIndexOfItem( item2 ), 2,
                            "If not specified, a item should be added with the highest index." );
                        assert.equal( viewer.world.getItemAt( 2 ), item2,
                            "The item at index 2 should be the second added item." );

                        viewer.world.addHandler( "item-index-change",
                            function itemIndexChangedHandler( event ) {
                                viewer.world.removeHandler( "item-index-change",
                                    itemIndexChangedHandler );
                                assert.equal( event.item, item2,
                                    "The item which changed index should be item2" );
                                assert.equal( event.previousIndex, 2, "Previous index should be 2." );
                                assert.equal( event.newIndex, 1, "New index should be 1." );
                            });
                        viewer.world.setItemIndex( item2, 1 );
                        assert.equal( viewer.world.getIndexOfItem( item2 ), 1,
                            "Item2 index should be 1 after setItemIndex." );
                        assert.equal( viewer.world.getIndexOfItem( item1 ), 2,
                            "Item1 index should be 2 after setItemIndex." );
                        assert.equal( viewer.world.getItemAt( 1 ), item2,
                            "The item at index 1 should be item2." );
                        assert.equal( viewer.world.getItemAt( 2 ), item1,
                            "The item at index 2 should be item1." );

                        options.index = 2;
                        options.tileSource.levels[0].url = "data/CCyan.png";
                        viewer.addTiledImage( options );
                        viewer.world.addHandler( "add-item", function addThirdItemHandler( event ) {
                            viewer.world.removeHandler( "add-item", addThirdItemHandler );
                            const item3 = event.item;
                            assert.equal( viewer.world.getItemCount( ), 4,
                                "4 items should be present after adding a third item." );
                            assert.equal( viewer.world.getIndexOfItem( item3 ), 2,
                                "Item 3 should be added with index 2." );
                            assert.equal( viewer.world.getIndexOfItem( item2 ), 1,
                                "Item 2 should stay at index 1." );

                            options.index = 2;
                            options.replace = true;
                            viewer.addTiledImage( options );
                            viewer.world.addHandler( "add-item", function replaceAddItemHandler( event ) {
                                viewer.world.removeHandler( "add-item", replaceAddItemHandler );
                                const item4 = event.item;
                                assert.equal( viewer.world.getItemCount( ), 4,
                                    "4 items should still be present after replacing the second item." );
                                assert.equal( viewer.world.getIndexOfItem( item4 ), 2,
                                    "Item 4 should be added with index 2." );
                                assert.equal( viewer.world.getIndexOfItem( item3 ), -1,
                                    "Item 3 should be at index -1." );

                                viewer.world.addHandler( "remove-item", function removeItemHandler( event ) {
                                    viewer.world.removeHandler( "remove-item", removeItemHandler );

                                    assert.equal( item2, event.item, "Removed item should be item2." );

                                    assert.equal( viewer.world.getIndexOfItem( item1 ), 2,
                                        "Item 1 should be at index 2." );
                                    assert.equal( viewer.world.getIndexOfItem( item2 ), -1,
                                        "Item 2 should be at index -1." );
                                    assert.equal( viewer.world.getIndexOfItem( item4 ), 1,
                                        "Item 4 should be at index 1." );

                                    done();
                                });

                                viewer.world.removeItem( item2 );
                            });
                        });
                    });
                });
            });
            viewer.open( '/test/data/testpattern.dzi' );
        });

        // ----------
        QUnit.test( 'Sequences as items', function(assert) {
            const done = assert.async();
            const options = {
                tileSource: [{
                        type: 'legacy-image-pyramid',
                        levels: [{
                                url: "data/A.png",
                                width: 1000,
                                height: 1000
                            }]
                    }, {
                        type: 'legacy-image-pyramid',
                        levels: [{
                                url: "data/BBlue.png",
                                width: 1000,
                                height: 1000
                            }]
                    }]
            };

            viewer.addHandler( "open", function openHandler() {
                viewer.removeHandler( "open", openHandler );

                viewer.addHandler( "add-item-failed",
                    function addItemFailedHandler( event ) {
                        viewer.removeHandler( "add-item-failed", addItemFailedHandler );
                        assert.equal( event.message, "[Viewer.addTiledImage] Sequences can not be added; add them one at a time instead." );
                        assert.equal( event.options, options, "Item failed event should give the options." );
                        done();
                    } );
                viewer.addTiledImage( options );

            });
            viewer.open( '/test/data/testpattern.dzi' );
        });

        // ----------
        QUnit.test('items are added in order', function(assert) {
            const done = assert.async();
            viewer.addHandler('open', function(event) {
                assert.equal(viewer.world.getItemAt(0).getContentSize().y, 2000, 'first image is tall');
                assert.equal(viewer.world.getItemAt(0).getBounds().width, 4, 'first image has 4 width');
                assert.equal(viewer.world.getItemAt(1).getContentSize().x, 2000, 'second image is wide');
                assert.equal(viewer.world.getItemAt(1).getBounds().width, 2, 'second image has 2 width');
                done();
            });

            viewer.open([
                {
                    tileSource: '/test/data/tall.dzi',
                    width: 4
                }, {
                    tileSource: '/test/data/wide.dzi',
                    width: 2
                }
            ]);
        });

        QUnit.test('Viewer.addSimpleImage', function(assert) {
            const done = assert.async();
            viewer.addHandler("open", function openHandler() {
                viewer.removeHandler("open", openHandler);
                viewer.world.addHandler('add-item', function itemAdded(event) {
                    viewer.world.removeHandler('add-item', itemAdded);
                    assert.equal(event.item.opacity, 0.5,
                        'Opacity option should be set when using addSimpleImage');
                    done();
                });

                viewer.addSimpleImage({
                    url: '/test/data/A.png',
                    opacity: 0.5
                });
            });
            viewer.open('/test/data/testpattern.dzi');
        });

        QUnit.test('Transparent image on top of others', function(assert) {
            const done = assert.async();
            viewer.open('/test/data/testpattern.dzi');

            function getPixelFromViewerScreenCoords(x, y) {
                const density = OpenSeadragon.pixelDensityRatio;
                const imageData = viewer.drawer.context.getImageData(x * density, y * density, 1, 1);
                return {
                    r: imageData.data[0],
                    g: imageData.data[1],
                    b: imageData.data[2],
                    a: imageData.data[3]
                };
            }

            viewer.addHandler('open', function() {
                const firstImage = viewer.world.getItemAt(0);
                firstImage.addHandler('fully-loaded-change', function() {
                    viewer.addOnceHandler('update-viewport', function(){
                        // Pixel 250,250 will be in the hole of the A
                        const expectedVal = getPixelFromViewerScreenCoords(250, 250);

                        assert.notEqual(expectedVal.r, 0, 'Red channel should not be 0');
                        assert.notEqual(expectedVal.g, 0, 'Green channel should not be 0');
                        assert.notEqual(expectedVal.b, 0, 'Blue channel should not be 0');
                        assert.notEqual(expectedVal.a, 0, 'Alpha channel should not be 0');

                        viewer.addSimpleImage({
                            url: '/test/data/A.png',
                            success: function() {
                                const secondImage = viewer.world.getItemAt(1);
                                secondImage.addHandler('fully-loaded-change',  function() {
                                    viewer.addOnceHandler('update-viewport', function(){
                                        const actualVal = getPixelFromViewerScreenCoords(250, 250);

                                        assert.equal(actualVal.r, expectedVal.r,
                                            'Red channel should not change in transparent part of the A');
                                        assert.equal(actualVal.g, expectedVal.g,
                                            'Green channel should not change in transparent part of the A');
                                        assert.equal(actualVal.b, expectedVal.b,
                                            'Blue channel should not change in transparent part of the A');
                                        assert.equal(actualVal.a, expectedVal.a,
                                            'Alpha channel should not change in transparent part of the A');

                                        const onAVal = getPixelFromViewerScreenCoords(333 , 250);
                                        assert.equal(onAVal.r, 0, 'Red channel should be 0 on the A');
                                        assert.equal(onAVal.g, 0, 'Green channel should be 0 on the A');
                                        assert.equal(onAVal.b, 0, 'Blue channel should be 0 on the A');
                                        assert.equal(onAVal.a, 255, 'Alpha channel should be 255 on the A');

                                        done();
                                    });
                                    // trigger a redraw so the event fires
                                    firstImage.redraw();
                                });
                            }
                        });
                    });
                });
            });
        });

        // #2266: two registered opaque PNG images must not expose the lower image
        // through the right or bottom edge at fractional positions.
        if (drawerType === 'canvas') {
            QUnit.test('registered PNG layers hide the lower image at subpixel edges', function(assert) {
                const done = assert.async();
                const imageWidth = 512;
                const imageHeight = 384;
                const density = OpenSeadragon.pixelDensityRatio;

                function solidImageUrl(color) {
                    const canvas = document.createElement('canvas');
                    canvas.width = imageWidth;
                    canvas.height = imageHeight;
                    const context = canvas.getContext('2d');
                    context.fillStyle = color;
                    context.fillRect(0, 0, imageWidth, imageHeight);
                    return canvas.toDataURL('image/png');
                }

                // Keep both sources on the same image bounds, with no fade between
                // pyramid levels. Force the CanvasDrawer, not the default WebGL drawer.
                viewer.blendTime = 0;
                const neverRound = OpenSeadragon.SUBPIXEL_ROUNDING_OCCURRENCES.NEVER;
                const states = [];
                [0.68, 0.79, 0.90].forEach(function(zoom) {
                    states.push({zoom: zoom, panX: 0, panY: 0});
                    states.push({zoom: zoom, panX: 0.013, panY: -0.011});
                    states.push({zoom: zoom, panX: -0.017, panY: 0.009});
                });

                viewer.addOnceHandler('open', function() {
                    assert.strictEqual(viewer.drawer.getType(), 'canvas', 'uses the CanvasDrawer');
                    assert.strictEqual(viewer.world.getItemCount(), 2, 'two separate TiledImages opened');
                    const lower = viewer.world.getItemAt(0);
                    const upper = viewer.world.getItemAt(1);
                    assert.propEqual(lower.getBoundsNoRotate(true), upper.getBoundsNoRotate(true),
                        'the lower red and upper blue images have identical registered bounds');

                    function inspectState(index) {
                        if (index === states.length) {
                            done();
                            return;
                        }

                        const state = states[index];
                        const label = 'zoom ' + state.zoom + ', pan (' + state.panX + ', ' + state.panY + ')';
                        viewer.viewport.zoomTo(state.zoom, null, true);
                        viewer.viewport.panTo(new OpenSeadragon.Point(
                            0.5 + state.panX, 0.375 + state.panY), true);

                        function onTopDraw(event) {
                            // A loaded image at the previous zoom is not evidence
                            // that both sources have finished loading the new level.
                            if (event.tiledImage !== upper || !viewer.getFullyLoaded()) {
                                return;
                            }
                            viewer.removeHandler('tiled-image-drawn', onTopDraw);

                            const canvas = viewer.drawer.canvas;
                            const context = viewer.drawer.context;
                            const bounds = upper.getBoundsNoRotate(true);
                            const topLeft = viewer.viewport.pixelFromPointNoRotate(
                                bounds.getTopLeft(), true).times(density);
                            const bottomRight = viewer.viewport.pixelFromPointNoRotate(
                                bounds.getBottomRight(), true).times(density);
                            const midX = Math.floor((topLeft.x + bottomRight.x) / 2);
                            const midY = Math.floor((topLeft.y + bottomRight.y) / 2);
                            const rightX = Math.floor(bottomRight.x);
                            const bottomY = Math.floor(bottomRight.y);

                            assert.ok(rightX > 3 && rightX + 2 < canvas.width &&
                                bottomY > 3 && bottomY + 2 < canvas.height,
                                label + ': right and bottom edges remain in the canvas');
                            assert.ok(viewer.drawer.sketchCanvas,
                                label + ': upper PNG renders through the sketch canvas');

                            const center = context.getImageData(midX, midY, 1, 1).data;
                            assert.deepEqual(Array.from(center), [0, 0, 255, 255],
                                label + ': upper blue image is fully drawn in the center');

                            const right = {red: 0, x: 0, y: 0};
                            const bottom = {red: 0, x: 0, y: 0};
                            [0.25, 0.5, 0.75].forEach(function(fraction) {
                                const y = Math.floor(topLeft.y + (bottomRight.y - topLeft.y) * fraction);
                                const x = Math.floor(topLeft.x + (bottomRight.x - topLeft.x) * fraction);
                                for (let offset = -2; offset <= 2; offset++) {
                                    const edgeX = rightX + offset;
                                    const edgeY = bottomY + offset;
                                    const rightRed = context.getImageData(edgeX, y, 1, 1).data[0];
                                    const bottomRed = context.getImageData(x, edgeY, 1, 1).data[0];
                                    if (rightRed > right.red) {
                                        right.red = rightRed;
                                        right.x = edgeX;
                                        right.y = y;
                                    }
                                    if (bottomRed > bottom.red) {
                                        bottom.red = bottomRed;
                                        bottom.x = x;
                                        bottom.y = edgeY;
                                    }
                                }
                            });

                            // A fully opaque blue top layer must not show red through
                            // either outer edge. Allow only 2/255 readback quantization.
                            assert.ok(right.red <= 2, label + ': right edge red=' + right.red +
                                ' at (' + right.x + ', ' + right.y + ')');
                            assert.ok(bottom.red <= 2, label + ': bottom edge red=' + bottom.red +
                                ' at (' + bottom.x + ', ' + bottom.y + ')');

                            // Let the completed draw frame return before changing the view.
                            setTimeout(function() {
                                inspectState(index + 1);
                            }, 0);
                        }

                        viewer.addHandler('tiled-image-drawn', onTopDraw);
                        viewer.forceRedraw();
                    }

                    viewer.whenFullyLoaded(function() {
                        inspectState(0);
                    });
                });

                viewer.open([
                    {
                        tileSource: {type: 'image', url: solidImageUrl('#ff0000'), buildPyramid: true},
                        x: 0, y: 0, width: 1, opacity: 1,
                        subPixelRoundingForTransparency: neverRound
                    },
                    {
                        tileSource: {type: 'image', url: solidImageUrl('#0000ff'), buildPyramid: true},
                        x: 0, y: 0, width: 1, opacity: 1,
                        subPixelRoundingForTransparency: neverRound
                    }
                ]);
            });
        }
    }
})();
