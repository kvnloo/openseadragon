/* global QUnit, OpenSeadragon, testLog */

(function() {
    QUnit.module('TileSourceCollection-coverage', {
        beforeEach: function() {
            testLog.reset();
        }
    });

    function assertDeprecation(assert) {
        assert.deepEqual(testLog.error,
            ['["TileSourceCollection is deprecated; use World instead"]'],
            'exactly one deprecation warning is logged');
    }

    QUnit.test('default constructor is an empty deprecated object', function(assert) {
        const collection = new OpenSeadragon.TileSourceCollection();

        assert.ok(collection instanceof OpenSeadragon.TileSourceCollection,
            'new returns an instance of the deprecated constructor');
        assert.deepEqual(Object.keys(collection), [],
            'there are no initialized instance fields');
        assert.strictEqual(collection.tileSize, undefined, 'no default tile size is stored');
        assert.strictEqual(collection.tileSources, undefined, 'no default sources are stored');
        assert.strictEqual(collection.rows, undefined, 'no default row count is stored');
        assert.strictEqual(collection.columns, undefined, 'no default column count is stored');
        assert.strictEqual(collection.layout, undefined, 'no default layout is stored');
        assertDeprecation(assert);
    });

    QUnit.test('legacy positional tile size, sources, rows and layout are ignored', function(assert) {
        const sources = [{ width: 100, height: 200 }];
        const collection = new OpenSeadragon.TileSourceCollection(
            256, sources, 2, 'horizontal');

        assert.deepEqual(Object.keys(collection), [], 'provided options create no state');
        assert.strictEqual(collection.tileSize, undefined, 'tile size is ignored');
        assert.strictEqual(collection.tileSources, undefined, 'source list is ignored');
        assert.strictEqual(collection.rows, undefined, 'rows are ignored');
        assert.strictEqual(collection.columns, undefined, 'no columns are calculated');
        assert.strictEqual(collection.layout, undefined, 'layout is ignored');
        assert.strictEqual(sources.length, 1, 'input source list is not changed');
        assertDeprecation(assert);
    });

    QUnit.test('an options object with rows, columns and layout is also ignored', function(assert) {
        const options = {
            tileSize: 512,
            tileSources: [{ width: 500, height: 250 }],
            rows: 3,
            columns: 4,
            layout: 'vertical'
        };
        const collection = new OpenSeadragon.TileSourceCollection(options);

        assert.deepEqual(Object.keys(collection), [], 'object options are not interpreted');
        assert.strictEqual(collection.rows, undefined, 'rows are not applied');
        assert.strictEqual(collection.columns, undefined, 'columns are not applied');
        assert.strictEqual(collection.layout, undefined, 'layout is not applied');
        assert.strictEqual(collection.tileSize, undefined, 'tile size is not applied');
        assert.strictEqual(options.columns, 4, 'input options remain unchanged');
        assertDeprecation(assert);
    });

    QUnit.test('calling the deprecated function without new only warns', function(assert) {
        const result = OpenSeadragon.TileSourceCollection(128, [], 1, 'vertical');

        assert.strictEqual(result, undefined, 'a direct call has no return value');
        assertDeprecation(assert);
    });
})();
