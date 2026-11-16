/* global QUnit, $, OpenSeadragon, testLog */

(function() {
    let viewer;

    const tileSources = [
        '/test/data/tall.dzi',
        '/test/data/wide.dzi'
    ];

    QUnit.module('ReferenceStrip lifecycle', {
        beforeEach: function() {
            $('<div id="example"></div>').appendTo('#qunit-fixture');
            testLog.reset();
        },
        afterEach: function() {
            if (viewer) {
                viewer.destroy();
            }
            viewer = null;
        }
    });

    function createViewer(options) {
        viewer = OpenSeadragon(OpenSeadragon.extend({
            id: 'example',
            prefixUrl: '/build/openseadragon/images/',
            sequenceMode: true,
            showReferenceStrip: true,
            showNavigator: false,
            showNavigationControl: false,
            showSequenceControl: false,
            springStiffness: 100,
            tileSources: tileSources
        }, options || {}));
        return viewer;
    }

    QUnit.test('creates thumbnail panels and selects the first page', function(assert) {
        createViewer();
        const strip = viewer.referenceStrip;

        assert.ok(strip instanceof OpenSeadragon.ReferenceStrip, 'a ReferenceStrip instance exists');
        assert.ok(document.contains(strip.element), 'the strip is attached to the viewer');
        assert.strictEqual(strip.panels.length, 2, 'one panel is created for each tile source');
        assert.strictEqual(strip.panels[0].id, strip.element.id + '-0', 'first panel has a stable index');
        assert.strictEqual(strip.panels[1].id, strip.element.id + '-1', 'second panel has a stable index');
        assert.ok(strip.miniViewers[strip.panels[0].id], 'first thumbnail viewer is constructed');
        assert.ok(strip.miniViewers[strip.panels[1].id], 'second thumbnail viewer is constructed');
        assert.strictEqual(strip.currentSelected, strip.panels[0], 'first panel is selected');
        assert.strictEqual(strip.currentPage, 0, 'strip starts on the first page');
    });

    QUnit.test('page changes move focus; out-of-range pages are ignored', function(assert) {
        createViewer();
        const strip = viewer.referenceStrip;
        const pageEvents = [];

        viewer.addHandler('page', function(event) {
            pageEvents.push(event.page);
        });

        assert.strictEqual(viewer.goToPage(1), viewer, 'page navigation remains chainable');
        assert.strictEqual(viewer.currentPage(), 1, 'viewer changes to page one');
        assert.strictEqual(strip.currentPage, 1, 'strip tracks the new page');
        assert.strictEqual(strip.currentSelected, strip.panels[1], 'second panel receives focus');
        assert.notStrictEqual(strip.panels[0].style.background, strip.panels[1].style.background,
            'previous and active thumbnail have different backgrounds');

        viewer.goToPage(-1);
        viewer.goToPage(2);
        assert.deepEqual(pageEvents, [1], 'invalid pages do not raise page events');
        assert.strictEqual(viewer.currentPage(), 1, 'invalid pages do not navigate');
        assert.strictEqual(strip.currentSelected, strip.panels[1], 'invalid pages preserve selection');

        viewer.goToPage(0);
        assert.deepEqual(pageEvents, [1, 0], 'return navigation raises the expected page event');
        assert.strictEqual(strip.currentSelected, strip.panels[0], 'first thumbnail becomes active again');
    });

    QUnit.test('vertical strip respects initialPage and direct setFocus', function(assert) {
        createViewer({
            initialPage: 1,
            referenceStripScroll: 'vertical'
        });
        const strip = viewer.referenceStrip;

        assert.strictEqual(strip.scroll, 'vertical', 'vertical orientation is applied');
        assert.strictEqual(viewer.currentPage(), 1, 'initialPage starts on the second image');
        assert.strictEqual(strip.currentPage, 1, 'initialPage also sets strip focus');
        assert.strictEqual(strip.currentSelected, strip.panels[1], 'second panel is initially selected');

        strip.setFocus(0);
        assert.strictEqual(strip.currentSelected, strip.panels[0], 'setFocus selects the requested thumbnail');
        assert.strictEqual(strip.currentPage, 0, 'setFocus updates strip state');
        assert.strictEqual(viewer.currentPage(), 1, 'setFocus does not navigate the viewer');

        strip.setFocus(1);
        assert.strictEqual(strip.currentSelected, strip.panels[1], 'setFocus can restore the active thumbnail');
    });

    QUnit.test('remove, add and destroy detach the strip controls', function(assert) {
        createViewer();
        const first = viewer.referenceStrip.element;

        viewer.removeReferenceStrip();
        assert.notOk(viewer.referenceStrip, 'removeReferenceStrip clears the strip reference');
        assert.strictEqual(viewer.showReferenceStrip, false, 'removeReferenceStrip disables the strip');
        assert.notOk(document.contains(first), 'removed strip is detached from the document');

        viewer.addReferenceStrip();
        const second = viewer.referenceStrip.element;
        assert.strictEqual(viewer.showReferenceStrip, true, 'addReferenceStrip reenables the strip');
        assert.notStrictEqual(second, first, 'adding creates a new strip');
        assert.ok(document.contains(second), 'new strip is attached');

        viewer.destroy();
        viewer = null;
        assert.notOk(document.contains(second), 'destroy detaches the replacement strip');
        assert.notOk(document.contains(first), 'destroy does not reattach the original strip');
    });

    QUnit.test('one-page sequences omit the strip until more pages are opened', function(assert) {
        createViewer({
            tileSources: [tileSources[0]]
        });
        assert.notOk(viewer.referenceStrip, 'a single page has no reference strip');

        viewer.addReferenceStrip();
        assert.notOk(viewer.referenceStrip, 'explicit add still needs at least two pages');

        viewer.open(tileSources);
        const stripElement = viewer.referenceStrip.element;
        assert.strictEqual(viewer.referenceStrip.panels.length, 2, 'opening two pages creates both panels');
        assert.ok(document.contains(stripElement), 'two-page strip is attached');

        viewer.open([tileSources[0]]);
        assert.notOk(viewer.referenceStrip, 'reopening one page removes the strip');
        assert.notOk(document.contains(stripElement), 'old strip is detached after reopen');
    });

})();
