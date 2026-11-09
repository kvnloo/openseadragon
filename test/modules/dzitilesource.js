/* global QUnit, testLog */

(function() {

    QUnit.module('DziTileSource', {
        beforeEach: function() {
            testLog.reset();
        }
    });

    function testImplicitTilesUrl(assert, dziUrl, expected, msg) {
        const source = new OpenSeadragon.DziTileSource();
        const options = source.configure({
            Image: {Size: {Width:0, Height: 0}}
        }, dziUrl);
        assert.equal(options.tilesUrl, expected, msg);
    }

    QUnit.test('test implicit tilesUrl guessed from dzi url', function(assert) {
        testImplicitTilesUrl(
            assert,
            '/path/my.dzi', '/path/my_files/',
            'dzi extension should be stripped');
        testImplicitTilesUrl(
            assert,
            '/path/my', '/path/my_files/',
            'no extension should still produce _files path');
        testImplicitTilesUrl(
            assert,
            '/my/', '/my_files/',
            'no extension with trailing slash should preserve slash');
        testImplicitTilesUrl(
            assert,
            'my.xml', 'my_files/',
            'relative link should stay the same');
        testImplicitTilesUrl(
            assert,
            '/p/foo.dzi?a=1&b=2', '/p/foo_files/',
            'querystring in dzi url should be ignored after slashes');
        testImplicitTilesUrl(
            assert,
                '/iiipsrv?DeepZoom=/path/my.dzi', '/iiipsrv?DeepZoom=/path/my_files/',
                'querystring in dzi url should not be ignored before slashes');
        testImplicitTilesUrl(
            assert,
                '/fcg-bin/iipsrv.fcgi?Deepzoom=123test.tif.dzi', '/fcg-bin/iipsrv.fcgi?Deepzoom=123test.tif_files/',
                'filename in querystring does not have to contain slash');
    });


    // ----------
    QUnit.test('zero-valued DZI level limits reject out-of-range tiles', function(assert) {
        // A one-pixel DZI has exactly level 0. Both boundaries are valid zeroes.
        const source = new OpenSeadragon.DziTileSource({
            width: 1,
            height: 1,
            tileSize: 256,
            tileOverlap: 0,
            tilesUrl: '/tiles/',
            fileFormat: 'jpg',
            minLevel: 0,
            maxLevel: 0
        });

        assert.notOk(source.tileExists(-1, 0, 0), 'level below zero is excluded');
        assert.ok(source.tileExists(0, 0, 0), 'the only level remains available');
        assert.notOk(source.tileExists(1, 0, 0), 'level above zero is excluded');

        // Nonzero bounds remain enforced as before.
        const ranged = new OpenSeadragon.DziTileSource({
            width: 16,
            height: 16,
            tileSize: 256,
            tileOverlap: 0,
            tilesUrl: '/tiles/',
            fileFormat: 'jpg',
            minLevel: 2,
            maxLevel: 4
        });
        assert.notOk(ranged.tileExists(1, 0, 0), 'below nonzero minimum');
        assert.ok(ranged.tileExists(2, 0, 0), 'minimum is included');
        assert.ok(ranged.tileExists(4, 0, 0), 'maximum is included');
        assert.notOk(ranged.tileExists(5, 0, 0), 'above nonzero maximum');
    });

}());
