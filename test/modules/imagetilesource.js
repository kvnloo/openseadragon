/* global QUnit, $, testLog */

(function () {
    QUnit.module('ImageTileSource');

    QUnit.test('supports', function(assert) {
        assert.ok(
            OpenSeadragon.ImageTileSource.prototype.supports({ type: 'image' }),
            'should return true for type image'
        );
        assert.notOk(
            OpenSeadragon.ImageTileSource.prototype.supports({ type: 'dzi' }),
            'should return false for non-image type'
        );
        assert.notOk(
            OpenSeadragon.ImageTileSource.prototype.supports({}),
            'should return false for empty object'
        );
    });

    QUnit.test('configure', function(assert) {
        var options = { url: 'test.jpg', buildPyramid: false };
        var result = OpenSeadragon.ImageTileSource.prototype.configure(options, 'http://test', null);
        assert.equal(result, options, 'should return the options object');
    });

    QUnit.test('equals', function(assert) {
        var source1 = new OpenSeadragon.ImageTileSource({ url: 'test.jpg' });
        var source2 = new OpenSeadragon.ImageTileSource({ url: 'test.jpg' });
        var source3 = new OpenSeadragon.ImageTileSource({ url: 'other.jpg' });

        assert.ok(source1.equals(source2), 'same url should be equal');
        assert.notOk(source1.equals(source3), 'different url should not be equal');
    });

    QUnit.test('getTilePostData', function(assert) {
        var source = new OpenSeadragon.ImageTileSource({ url: 'test.jpg' });
        var postData = source.getTilePostData(2, 3, 4);
        assert.equal(postData.level, 2, 'level should be set');
        assert.equal(postData.x, 3, 'x should be set');
        assert.equal(postData.y, 4, 'y should be set');
    });

    QUnit.test('getContext2D deprecated', function(assert) {
    var source = new OpenSeadragon.ImageTileSource({ url: 'test.jpg' });

    source._createContext2D = function() {
        return null;
    };

    var originalError = OpenSeadragon.console.error;
    var errorLogged = false;
    OpenSeadragon.console.error = function(msg) {
        if (msg && msg.indexOf('deprecated') !== -1) {
            errorLogged = true;
        }
        originalError.apply(this, arguments);
    };

    source.getContext2D(0, 0, 0);

    OpenSeadragon.console.error = originalError;

    assert.ok(errorLogged, 'should log deprecation warning');
});

    QUnit.test('downloadTileAbort', function(assert) {
        var source = new OpenSeadragon.ImageTileSource({ url: 'test.jpg' });
        source.downloadTileAbort({});
        assert.ok(true, 'downloadTileAbort should not throw');
    });

    QUnit.test('getTileUrl for non-max level', function(assert) {
        var source = new OpenSeadragon.ImageTileSource({
            url: '/test/data/A.png',
            buildPyramid: false
        });

        source.maxLevel = 1; // Set a fake max level

        var url = source.getTileUrl(0, 0, 0);
        // Non-max levels get query params appended even with buildPyramid: false
        assert.ok(
            url.indexOf('/test/data/A.png') === 0,
            'non-max level URL starts with original url'
        );
        assert.ok(
            url.indexOf('?l=0') !== -1,
            'non-max level URL includes level parameter'
        );
    });

    QUnit.test('builds a pyramid by default', function(assert) {
        var done = assert.async();
        var source = new OpenSeadragon.ImageTileSource({ url: '/test/data/A.png' });
        source.addHandler('ready', function() {
            assert.ok(source.levels.length > 1, 'should build lower levels');
            assert.equal(source.maxLevel, source.levels.length - 1, 'maxLevel should be the top level');
            done();
        });
    });

    QUnit.test('lower pyramid levels downsample from preceding levels', function(assert) {
        // A 16x16 source has levels 1, 2, 4, 8 and 16; requesting 4x4
        // must downsample 16 -> 8 -> 4, not 16 -> 4 in one step.
        var image = { naturalWidth: 16, naturalHeight: 16, src: 'test.png' };
        var source = Object.create(OpenSeadragon.ImageTileSource.prototype);
        var draws = [];
        var result;
        var error;
        var type;

        source.buildPyramid = true;
        source.image = image;
        source.minLevel = 0;
        source.levels = source._buildLevels(image);
        source.maxLevel = source.levels.length - 1;
        source._createContext2D = function(data, width, height) {
            var context = { canvas: { width: width, height: height } };
            draws.push({ data: data, width: width, height: height, context: context });
            return context;
        };

        source.downloadTileStart({
            postData: { level: source.maxLevel - 2 },
            finish: function(data, message, dataType) {
                result = data;
                error = message;
                type = dataType;
            },
            fail: function(message) {
                assert.ok(false, message);
            }
        });

        assert.strictEqual(source.maxLevel, 4, '16px image produces five levels');
        assert.deepEqual(draws.map(function(draw) {
            return [draw.width, draw.height];
        }), [[8, 8], [4, 4]], 'draws the intermediate 8px level before the 4px level');
        assert.strictEqual(draws[0] && draws[0].data, image, 'first draw uses the original image');
        assert.strictEqual(draws[1] && draws[1].data,
            draws[0] && draws[0].context.canvas, 'second draw uses the first level canvas');
        assert.strictEqual(result, draws[1] && draws[1].context, 'returns the final level');
        assert.strictEqual(error, null, 'no error');
        assert.strictEqual(type, 'context2d', 'returns the correct data type');
    });

    QUnit.test('buildPyramid: false keeps a single level', function(assert) {
        var done = assert.async();
        var source = new OpenSeadragon.ImageTileSource({ url: '/test/data/A.png', buildPyramid: false });
        source.addHandler('ready', function() {
            assert.equal(source.levels.length, 1, 'should only have the full-size level');
            done();
        });
    });

    QUnit.test('builds a pyramid when opened by the viewer', function(assert) {
        var done = assert.async();
        $('<div id="imageTileSourceViewer"></div>').appendTo('#qunit-fixture');
        var viewer = OpenSeadragon({
            id: 'imageTileSourceViewer',
            prefixUrl: '/build/openseadragon/images/'
        });
        viewer.addHandler('open', function() {
            var source = viewer.world.getItemAt(0).source;
            assert.ok(source.levels.length > 1, 'should build lower levels');
            viewer.destroy();
            done();
        });
        viewer.open({ type: 'image', url: '/test/data/A.png' });
    });

    QUnit.test('getTileUrl for max level returns original url', function(assert) {
        var source = new OpenSeadragon.ImageTileSource({
            url: '/test/data/A.png',
            buildPyramid: false
        });

        source.maxLevel = 0;

        var url = source.getTileUrl(source.maxLevel, 0, 0);
        assert.equal(url, '/test/data/A.png', 'max level should return original url');
    });

})();
