/* global QUnit */

(function() {

    QUnit.module('ZoomifyTileSource');

    QUnit.test('supports only Zoomify service descriptors', function(assert) {
        const supports = OpenSeadragon.ZoomifyTileSource.prototype.supports;

        assert.strictEqual(supports({ type: 'zoomifytileservice' }), true,
            'Zoomify descriptors are supported');
        assert.strictEqual(supports({ type: 'dzi' }), false,
            'a different named format is rejected');
        assert.notOk(supports({}), 'a missing type is not supported');
        assert.notOk(supports({ type: 'ZoomifyTileService' }),
            'the service type is case-sensitive');
    });

    QUnit.test('configure preserves the supplied descriptor', function(assert) {
        const data = {
            type: 'zoomifytileservice',
            width: 1000,
            height: 600,
            tilesUrl: '/zoomify/'
        };
        const original = JSON.stringify(data);
        const result = OpenSeadragon.ZoomifyTileSource.prototype.configure(
            data, '/zoomify/ImageProperties.xml', 'key=value');

        assert.strictEqual(result, data, 'configuration returns the original object');
        assert.strictEqual(JSON.stringify(data), original,
            'configuration does not rewrite metadata or add tiers');
    });

    QUnit.test('single-tile images use the default size and format', function(assert) {
        const source = new OpenSeadragon.ZoomifyTileSource({
            width: 256,
            height: 128,
            tilesUrl: '/zoomify/'
        });

        assert.strictEqual(source.ready, true, 'an object descriptor is ready immediately');
        assert.strictEqual(source.minLevel, 0, 'first tier is level zero');
        assert.strictEqual(source.maxLevel, 0, 'a 256 by 128 image needs one tier');
        assert.strictEqual(source.getTileWidth(0), 256, 'default tile width');
        assert.strictEqual(source.getTileHeight(0), 256, 'default tile height');
        assert.strictEqual(source.fileFormat, 'jpg', 'default file extension');
        assert.deepEqual(source.imageSizes, [{ x: 256, y: 128 }], 'one image tier');
        assert.deepEqual(source.gridSize, [{ x: 1, y: 1 }], 'one tile in the grid');
        assert.strictEqual(source.getLevelScale(0), 1, 'single-tier scale is one');
        assert.strictEqual(source.getTileUrl(0, 0, 0),
            '/zoomify/TileGroup0/0-0-0.jpg', 'the only tile is in group zero');
    });

    QUnit.test('rectangular tiers retain sizes and crop edge tiles', function(assert) {
        const source = new OpenSeadragon.ZoomifyTileSource({
            width: 1000,
            height: 600,
            tileSize: 256,
            tilesUrl: '/zoomify/'
        });

        assert.strictEqual(source.minLevel, 0, 'first tier');
        assert.strictEqual(source.maxLevel, 2, 'three tiers from 250 to 1000 pixels');
        assert.deepEqual(source.imageSizes, [
            { x: 250, y: 150 },
            { x: 500, y: 300 },
            { x: 1000, y: 600 }
        ], 'smallest-to-largest image dimensions');
        assert.deepEqual(source.gridSize, [
            { x: 1, y: 1 },
            { x: 2, y: 2 },
            { x: 4, y: 3 }
        ], 'per-tier tile grids use ceiling division');

        assert.strictEqual(source.getLevelScale(0), 0.25, 'smallest scale');
        assert.strictEqual(source.getLevelScale(1), 0.5, 'middle scale');
        assert.strictEqual(source.getLevelScale(2), 1, 'full-resolution scale');

        const counts = [0, 1, 2].map(function(level) {
            const tiles = source.getNumTiles(level);
            return { x: tiles.x, y: tiles.y };
        });
        assert.deepEqual(counts, [
            { x: 1, y: 1 },
            { x: 2, y: 2 },
            { x: 4, y: 3 }
        ], 'inherited public tile counts match the Zoomify grids');

        const edge = source.getTileBounds(2, 3, 2, true);
        assert.strictEqual(edge.width, 232, 'right edge is 1000 - 3 * 256');
        assert.strictEqual(edge.height, 88, 'bottom edge is 600 - 2 * 256');
    });

    QUnit.test('explicit tile size and file extension are retained', function(assert) {
        const source = new OpenSeadragon.ZoomifyTileSource({
            width: 1024,
            height: 512,
            tileSize: 128,
            fileFormat: 'png',
            tilesUrl: '/custom/'
        });

        assert.strictEqual(source.getTileWidth(3), 128, 'custom tile width');
        assert.strictEqual(source.getTileHeight(3), 128, 'custom tile height');
        assert.strictEqual(source.fileFormat, 'png', 'custom extension');
        assert.strictEqual(source.maxLevel, 3, 'four tiers for 1024 by 512');
        assert.deepEqual(source.imageSizes, [
            { x: 128, y: 64 },
            { x: 256, y: 128 },
            { x: 512, y: 256 },
            { x: 1024, y: 512 }
        ], 'explicit tile size changes where pyramid construction stops');
        assert.deepEqual(source.gridSize, [
            { x: 1, y: 1 },
            { x: 2, y: 1 },
            { x: 4, y: 2 },
            { x: 8, y: 4 }
        ], 'nonsquare tile grids in ascending level order');
        assert.strictEqual(source.getTileUrl(3, 7, 3),
            '/custom/TileGroup0/3-7-3.png', 'URL uses custom extension and tile coordinates');
    });

    QUnit.test('tile URLs count earlier tiers and use row-major coordinates', function(assert) {
        const source = new OpenSeadragon.ZoomifyTileSource({
            width: 1000,
            height: 600,
            tilesUrl: '/zoomify/'
        });

        assert.strictEqual(source.getTileUrl(0, 0, 0),
            '/zoomify/TileGroup0/0-0-0.jpg', 'level zero starts at absolute tile zero');
        assert.strictEqual(source.getTileUrl(1, 0, 0),
            '/zoomify/TileGroup0/1-0-0.jpg', 'level one starts after one tile');
        assert.strictEqual(source.getTileUrl(1, 1, 0),
            '/zoomify/TileGroup0/1-1-0.jpg', 'next column follows the first');
        assert.strictEqual(source.getTileUrl(1, 0, 1),
            '/zoomify/TileGroup0/1-0-1.jpg', 'the second row follows two columns');
        assert.strictEqual(source.getTileUrl(2, 0, 0),
            '/zoomify/TileGroup0/2-0-0.jpg', 'level two starts after 1 + 4 tiles');
        assert.strictEqual(source.getTileUrl(2, 3, 2),
            '/zoomify/TileGroup0/2-3-2.jpg', 'last tile adds 2 * 4 + 3 to tier offset 5');
    });

    QUnit.test('TileGroup changes exactly at absolute tile 256', function(assert) {
        const source = new OpenSeadragon.ZoomifyTileSource({
            width: 4096,
            height: 4096,
            tilesUrl: '/zoomify/'
        });

        assert.strictEqual(source.maxLevel, 4, 'five levels from 256 to 4096');
        assert.deepEqual(source.gridSize, [
            { x: 1, y: 1 },
            { x: 2, y: 2 },
            { x: 4, y: 4 },
            { x: 8, y: 8 },
            { x: 16, y: 16 }
        ], 'lower tiers contribute 1 + 4 + 16 + 64 = 85 tiles');

        assert.strictEqual(source.getTileUrl(3, 7, 7),
            '/zoomify/TileGroup0/3-7-7.jpg', 'level three ends at absolute tile 84');
        assert.strictEqual(source.getTileUrl(4, 0, 0),
            '/zoomify/TileGroup0/4-0-0.jpg', 'level four begins at absolute tile 85');
        assert.strictEqual(source.getTileUrl(4, 10, 10),
            '/zoomify/TileGroup0/4-10-10.jpg', '85 + 10 * 16 + 10 = 255');
        assert.strictEqual(source.getTileUrl(4, 11, 10),
            '/zoomify/TileGroup1/4-11-10.jpg', '85 + 10 * 16 + 11 = 256');
        assert.strictEqual(source.getTileUrl(4, 15, 15),
            '/zoomify/TileGroup1/4-15-15.jpg', 'last tile is 340, still in group one');
    });

    QUnit.test('equals compares tile directories rather than image sizes', function(assert) {
        const first = new OpenSeadragon.ZoomifyTileSource({
            width: 256, height: 256, tilesUrl: '/shared/'
        });
        const sameDirectory = new OpenSeadragon.ZoomifyTileSource({
            width: 1024, height: 512, tilesUrl: '/shared/'
        });
        const differentDirectory = new OpenSeadragon.ZoomifyTileSource({
            width: 256, height: 256, tilesUrl: '/other/'
        });

        assert.ok(first.equals(first), 'a source equals itself');
        assert.ok(first.equals(sameDirectory), 'same directory despite different dimensions');
        assert.notOk(first.equals(differentDirectory), 'different directory is not equal');
        assert.notOk(first.equals(null), 'null is not an equal source');
    });

}());
