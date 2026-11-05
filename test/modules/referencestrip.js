/* global QUnit, $, testLog */

(function() {
    let viewer;

    QUnit.module('ReferenceStrip', {
        beforeEach: function () {
            $('<div id="example"></div>').appendTo("#qunit-fixture");

            testLog.reset();
        },
        afterEach: function () {
            if (viewer){
                viewer.destroy();
            }

            viewer = null;
        }
    });

    // ----------
    const createViewer = function(options) {
        options = options || {};
        viewer = OpenSeadragon(OpenSeadragon.extend({
            id:            'example',
            prefixUrl:     '/build/openseadragon/images/',
            springStiffness: 100 // Faster animation = faster tests
        }, options));
    };

    // ----------
    QUnit.test('basics', function(assert) {
        const done = assert.async();
        createViewer({
            sequenceMode: true,
            showReferenceStrip: true,
            tileSources: [
                '/test/data/tall.dzi',
                '/test/data/wide.dzi',
            ]
        });

        assert.ok(viewer.referenceStrip, 'referenceStrip exists');
        done();
    });

    // ----------
    QUnit.test('single string source is one sequence page', function(assert) {
        const source = '/test/data/tall.dzi';
        createViewer({
            sequenceMode: true,
            showReferenceStrip: true,
            tileSources: source
        });

        assert.deepEqual(viewer.tileSources, [source], 'the URL is one source, not one page per character');
        assert.strictEqual(viewer.currentPage(), 0, 'starts on its only page');

        viewer.goToNextPage();
        assert.strictEqual(viewer.currentPage(), 0, 'next page does not open a character from the URL');
    });

    // ----------
    QUnit.test('shadow dom', function(assert) {
        if (document.head && document.head.attachShadow) {
            const done = assert.async();

            const shadowDiv = document.createElement('div');
            shadowDiv.attachShadow({
                mode: 'open'
            });
            shadowDiv.shadowRoot.innerHTML = `<div id="shadow-example"></div>`

            createViewer({
                element: shadowDiv.shadowRoot.querySelector('#shadow-example'),
                sequenceMode: true,
                showReferenceStrip: true,
                tileSources: [
                    '/test/data/tall.dzi',
                    '/test/data/wide.dzi'
                ]
            });

            $(shadowDiv).appendTo("#qunit-fixture");

            assert.ok(viewer.referenceStrip, 'referenceStrip exists');
            done();
        } else {
            assert.expect(0);
        }
    })

})();
