/* global QUnit, testLog, Util */
(function() {

    QUnit.module('TileSource', {
        beforeEach: function() {
            testLog.reset();
        }
    });


    QUnit.test("should set sane tile size defaults", function(assert) {
        const source = new OpenSeadragon.TileSource();

        assert.equal(source.getTileWidth(), 0, "getTileWidth() should return 0 if not provided a size");
        assert.equal(source.getTileHeight(), 0, "getTileHeight() should return 0 if not provided a size");
    });

    QUnit.test("providing tileSize", function(assert){
        const tileSize = 256;
        const source = new OpenSeadragon.TileSource({
                tileSize: tileSize
            });

        assert.equal(source.tileSize, undefined, "tileSize should not be set on the tileSource");
        assert.equal(source.getTileWidth(), tileSize, "getTileWidth() should equal tileSize");
        assert.equal(source.getTileHeight(), tileSize, "getTileHeight() should equal tileSize");
    });


    QUnit.test("providing tileWidth and tileHeight", function(assert){
        const tileWidth = 256;
        const tileHeight = 512;
        const source = new OpenSeadragon.TileSource({
                tileWidth: tileWidth,
                tileHeight: tileHeight
            });

        assert.equal(source._tileWidth, tileWidth, "tileWidth option should set _tileWidth");
        assert.equal(source._tileHeight, tileHeight, "tileHeight option should set _tileHeight");
        assert.equal(source.tileWidth, undefined, "tileWidth should be renamed _tileWidth");
        assert.equal(source.tileHeight, undefined, "tileHeight should be renamed _tileHeight");
        assert.equal(source.getTileWidth(), tileWidth, "getTileWidth() should equal tileWidth");
        assert.equal(source.getTileHeight(), tileHeight, "getTileHeight() should equal tileHeight");
    });

    QUnit.test('getTileSize() deprecation', function(assert) {
        const source = new OpenSeadragon.TileSource();
        Util.testDeprecation(assert, source, 'getTileSize');
    });

    QUnit.test('getTileAtPoint', function(assert) {
        let tileSource = new OpenSeadragon.TileSource({
            width: 1500,
            height: 1000,
            tileWidth: 200,
            tileHeight: 150,
            tileOverlap: 1,
        });

        assert.equal(tileSource.maxLevel, 11, "The max level should be 11.");

        function assertTileAtPoint(level, position, expected) {
            const actual = tileSource.getTileAtPoint(level, position);
            assert.ok(actual.equals(expected), "The tile at level " + level +
                ", position " + position.toString() +
                " should be tile " + expected.toString() +
                " got " + actual.toString());
        }

        assertTileAtPoint(11, new OpenSeadragon.Point(0, 0), new OpenSeadragon.Point(0, 0));
        assertTileAtPoint(11, new OpenSeadragon.Point(0.5, 0.5), new OpenSeadragon.Point(3, 5));
        assertTileAtPoint(11, new OpenSeadragon.Point(1, 10 / 15), new OpenSeadragon.Point(7, 6));

        assertTileAtPoint(10, new OpenSeadragon.Point(0, 0), new OpenSeadragon.Point(0, 0));
        assertTileAtPoint(10, new OpenSeadragon.Point(0.5, 0.5), new OpenSeadragon.Point(1, 2));
        assertTileAtPoint(10, new OpenSeadragon.Point(1, 10 / 15), new OpenSeadragon.Point(3, 3));

        assertTileAtPoint(9, new OpenSeadragon.Point(0, 0), new OpenSeadragon.Point(0, 0));
        assertTileAtPoint(9, new OpenSeadragon.Point(0.5, 0.5), new OpenSeadragon.Point(0, 1));
        assertTileAtPoint(9, new OpenSeadragon.Point(1, 10 / 15), new OpenSeadragon.Point(1, 1));

        // For all other levels, there is only one tile.
        for (let level = 8; level >= 0; level--) {
            assertTileAtPoint(level, new OpenSeadragon.Point(0, 0), new OpenSeadragon.Point(0, 0));
            assertTileAtPoint(level, new OpenSeadragon.Point(0.5, 0.5), new OpenSeadragon.Point(0, 0));
            assertTileAtPoint(level, new OpenSeadragon.Point(1, 10 / 15), new OpenSeadragon.Point(0, 0));
        }

        // Test for issue #1113
        tileSource = new OpenSeadragon.TileSource({
            width: 1006,
            height: 1009,
            tileWidth: 1006,
            tileHeight: 1009,
            tileOverlap: 0,
            maxLevel: 0,
        });
        assertTileAtPoint(0, new OpenSeadragon.Point(1, 1009 / 1006), new OpenSeadragon.Point(0, 0));

        // Test for issue #1276
        tileSource = new OpenSeadragon.TileSource({
            width: 4036,
            height: 1239,
            tileWidth: 4036,
            tileHeight: 1239,
            tileOverlap: 0,
            maxLevel: 0,
        });
        assertTileAtPoint(0, new OpenSeadragon.Point(1, 1239 / 4036), new OpenSeadragon.Point(0, 0));

        // Test for issue #1362
        tileSource = new OpenSeadragon.TileSource({
            width: 2000,
            height: 3033,
            tileWidth: 2000,
            tileHeight: 3033,
            tileOverlap: 0,
            maxLevel: 0,
        });
        assertTileAtPoint(0, new OpenSeadragon.Point(1, 3033 / 2000), new OpenSeadragon.Point(0, 0));
    });

    QUnit.test('Zoomify: odd dimensions preserve pyramid tiles (#1169)', function(assert) {
        const source = new OpenSeadragon.ZoomifyTileSource({
            width: 513,
            height: 257,
            tileSize: 256,
            tilesUrl: '/zoomify/'
        });

        // libvips dzsave Zoomify: ceil-half until both dimensions fit one tile.
        // 513x257 -> 257x129 -> 129x65, then stop (tile size 256).
        // Tile counts from smallest to largest: 1, 2, 3*2 = 6.
        // Absolute tile indices: level 0 = 0; level 1 = 1..2;
        // level 2 = 3..8. All are in TileGroup floor(index / 256) = 0.
        assert.equal(source.maxLevel, 2, 'the 129 by 65 level fits one tile');
        assert.deepEqual(source.imageSizes, [
            { x: 129, y: 65 },
            { x: 257, y: 129 },
            { x: 513, y: 257 }
        ], 'odd dimensions round up until both fit one tile');
        assert.deepEqual(source.gridSize, [
            { x: 1, y: 1 },
            { x: 2, y: 1 },
            { x: 3, y: 2 }
        ], 'tile grids match the ceil-rounded libvips pyramid');
        assert.equal(source._calculateAbsoluteTileNumber(2, 2, 1), 8,
            'six full-resolution tiles follow three smaller-level tiles');
        assert.equal(source.getTileUrl(1, 1, 0),
            '/zoomify/TileGroup0/1-1-0.jpg',
            'intermediate second tile has absolute index 2');
        assert.equal(source.getTileUrl(2, 2, 1),
            '/zoomify/TileGroup0/2-2-1.jpg',
            'last full-resolution tile has absolute index 8');
    });

    QUnit.test('changing maxLevel', function(assert) {
        const tileSource = new OpenSeadragon.TileSource({
            width: 4096,
            height: 4096,
        });

        assert.equal(tileSource.maxLevel, 12, 'The initial max level should be 12.');

        function assertLevelScale(level, expected) {
            const actual = tileSource.getLevelScale(level);
            assert.ok(Math.abs(actual - expected) < Number.EPSILON, "The scale at level " + level +
                " should be " + expected.toString() +
                " got " + actual.toString());
        }

        assertLevelScale(12, 1);
        assertLevelScale(10, 1 / 4);
        assertLevelScale(8, 1 / 16);
        assertLevelScale(6, 1 / 64);

        tileSource.setMaxLevel(9);

        assertLevelScale(9, 1);
        assertLevelScale(7, 1 / 4);
        assertLevelScale(5, 1 / 16);
        assertLevelScale(3, 1 / 64);
    });


    QUnit.test('batch loading: respects TileSource.batchEnabled()', function (assert) {
        const done = assert.async();

        const source = new CountingBatchTileSource({
            enabled: false,  // explicitly disabled
            timeout: 1,
            maxJobs: 10,
            group: 'A'
        });

        const loader = new OpenSeadragon.ImageLoader({
            jobLimit: 0,                 // unlimited so jobs start immediately
            timeout: 1000,
            batchImageLoading: true,     // globally on
            batchWaitTimeout: 999,       // should NOT matter if TileSource-driven
            batchMaxJobs: 999
        });

        for (let i = 0; i < 3; i++) {
            loader.addJob({
                src: 'test://' + i,
                source: source,
                callback: function () {}
            });
        }

        // Let any timers/queue settle
        setTimeout(function () {
            assert.equal(source.singleRequests, 3, 'disabled batch => 3 single requests');
            assert.equal(source.batchRequests, 0, 'disabled batch => 0 batch requests');
            done();
        }, 25);
    });


    QUnit.test('batch loading: TileSource.batchTimeout() overrides ImageLoader.batchWaitTimeout', function (assert) {
        const done = assert.async();

        const source = new CountingBatchTileSource({
            enabled: true,
            timeout: 1,   // flush quickly
            maxJobs: -1,  // no max-jobs flush
            group: 'A'
        });

        const loader = new OpenSeadragon.ImageLoader({
            jobLimit: 0,
            timeout: 1000,
        });

        for (let i = 0; i < 3; i++) {
            loader.addJob({
                src: 'test://t' + i,
                source: source,
                callback: function () {}
            });
        }

        setTimeout(function () {
            assert.equal(source.singleRequests, 0, 'enabled batch => 0 single requests');
            assert.equal(source.batchRequests, 1, 'TileSource timeout => single batch request');
            assert.deepEqual(source.batchSizes, [3], 'all 3 tiles should be in one batch');
            done();
        }, 25);
    });


    QUnit.test('batch loading: TileSource.batchMaxJobs() overrides ImageLoader.batchMaxJobs', function (assert) {
        const done = assert.async();

        const source = new CountingBatchTileSource({
            enabled: true,
            timeout: 1,  // flush remainder quickly
            maxJobs: 2,  // force split into batches of 2
            group: 'A'
        });

        const loader = new OpenSeadragon.ImageLoader({
            jobLimit: 0,
            timeout: 1000,
        });

        for (let i = 0; i < 3; i++) {
            loader.addJob({
                src: 'test://m' + i,
                source: source,
                callback: function () {}
            });
        }

        setTimeout(function () {
            assert.equal(source.singleRequests, 0, 'enabled batch => 0 single requests');
            assert.equal(source.batchRequests, 2, 'maxJobs=2 => two batch requests (2 + 1)');
            assert.deepEqual(source.batchSizes, [2, 1], 'batch sizes should be [2, 1]');
            done();
        }, 25);
    });


    QUnit.test('batch loading: TileSource.batchCompatible() splits incompatible sources into separate requests', function (assert) {
        const done = assert.async();

        const sourceA = new CountingBatchTileSource({
            enabled: true,
            timeout: 1,
            maxJobs: -1,
            group: 'A'
        });

        const sourceB = new CountingBatchTileSource({
            enabled: true,
            timeout: 1,
            maxJobs: -1,
            group: 'B' // incompatible with A
        });

        const loader = new OpenSeadragon.ImageLoader({
            jobLimit: 0,
            timeout: 1000,
            batchImageLoading: true,
            batchWaitTimeout: 999,
            batchMaxJobs: 999
        });

        loader.addJob({ src: 'test://a0', source: sourceA, callback: function () {} });
        loader.addJob({ src: 'test://b0', source: sourceB, callback: function () {} });

        setTimeout(function () {
            const totalBatch = sourceA.batchRequests + sourceB.batchRequests;
            assert.equal(totalBatch, 2, 'incompatible sources => two separate batch requests');
            done();
        }, 25);
    });

    class CountingBatchTileSource extends OpenSeadragon.TileSource{
        constructor(cfg) {
            super({
                width: 1,
                height: 1,
                tileWidth: 1,
                tileHeight: 1
            });
            this._cfg = cfg || {};
            this.singleRequests = 0;
            this.batchRequests = 0;
            this.batchSizes = [];
        }

        batchEnabled() {
            return !!this._cfg.enabled;
        }

        batchTimeout() {
            return (typeof this._cfg.timeout === 'number') ? this._cfg.timeout : 5;
        }

        batchMaxJobs() {
            return (typeof this._cfg.maxJobs === 'number') ? this._cfg.maxJobs : -1;
        }

        // Default behavior we want for the tests:
        // - compatible with itself
        // - compatible with other CountingBatchTileSource instances that share the same group id
        batchCompatible(otherSource) {
            if (!otherSource) {
                return false;
            }
            if (otherSource === this) {
                return true;
            }
            return otherSource instanceof this.constructor &&
                this._cfg.group != null &&
                otherSource._cfg &&
                otherSource._cfg.group === this._cfg.group;
        }

        // Count a single "request" and immediately finish the job.
        downloadTileStart(job) {
            this.singleRequests++;
            job.finish({ ok: true }, null, 'test');
        }

        downloadTileAbort() {
        }

        // Count ONE "request" for the entire batch and finish each child job.
        downloadTileBatchStart(batchJob) {
            this.batchRequests++;
            this.batchSizes.push(batchJob.jobs.length);

            for (let i = 0; i < batchJob.jobs.length; i++) {
                batchJob.jobs[i].finish({ ok: true }, null, 'test');
            }
        }

        downloadTileBatchAbort() {
            // no-op for tests
        }
    }
}());
