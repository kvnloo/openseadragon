(function() {

    const metadata = `Max-size:8272 1712\r\nTile-size:256 256\r\nResolution-number:7\r\nResolutions:129 26,258 53,517 107,1034 214,2068 428,4136 856,8272 1712\r\n`;

    let test;

    QUnit.module('IIP', {
        beforeEach: function() {
            // Fresh, fully-initialized instance for every test so no test
            // depends on another test having run (works with QUnit filtering)
            test = new OpenSeadragon.IIPTileSource();
            test.iipsrv = "http://localhost/fcgi-bin/iipsrv.fcgi";
            test.image = "test.tif";
            test.parseIIP(metadata);
        }
    });

    QUnit.test('IIPTileSource metadata URL', function(assert) {
        const url = test.iipsrv + '?FIF=' + test.image + '&obj=IIP,1.0&obj=Max-size&obj=Tile-size&obj=Resolution-number&obj=Resolutions';
        assert.equal( test.getMetadataUrl(), url, "Info URL" );
    });

    QUnit.test('IIPTileSource metadata parsing', function(assert) {

        // Re-parse here since this test is specifically about parsing
        test.parseIIP( metadata );

        // Check dimensions
        assert.ok( test.width, "Width exists" );
        assert.equal( test.width, 8272, "Parsing width");
        assert.equal( test.height, 1712, "Parsing height");

        // Check tile size
        assert.ok( test._tileWidth, "Tile width provided" );
        assert.equal( test._tileWidth, 256, "Parsing tile width" );

        // Check resolution levels
        assert.ok( test.levelSizes, "Resolution levels exist" );
        assert.equal( typeof test.levelSizes, "object", "Resolution sizes array" );
        assert.equal( test.levelSizes.length, 7, "Number of resolution sizes" );
        assert.equal( test.maxLevel, test.levelSizes.length-1, "Max levels equals number of resolution sizes" );

    });

    QUnit.test('IIPTileSource tile URLs', function(assert) {

        // Basic tile URLs
        assert.equal( test.getTileUrl(0,0,0), `http://localhost/fcgi-bin/iipsrv.fcgi?FIF=test.tif&JTL=0,0` );
        assert.equal( test.getTileUrl(1,1,0), `http://localhost/fcgi-bin/iipsrv.fcgi?FIF=test.tif&JTL=1,1` );
        assert.equal( test.getTileUrl(4,1,1), `http://localhost/fcgi-bin/iipsrv.fcgi?FIF=test.tif&JTL=4,10` );

        // Test format change
        test.format = "webp";
        assert.equal( test.getTileUrl(0,0,0), `http://localhost/fcgi-bin/iipsrv.fcgi?FIF=test.tif&WTL=0,0` );

        // Test example transforms
        test.transform = { invert: true };
        assert.equal( test.getTileUrl(0,0,0), `http://localhost/fcgi-bin/iipsrv.fcgi?FIF=test.tif&INV&WTL=0,0` );

        test.transform = { contrast: 1.5 };
        assert.equal( test.getTileUrl(0,0,0), `http://localhost/fcgi-bin/iipsrv.fcgi?FIF=test.tif&CNT=1.5&WTL=0,0` );

    });

    QUnit.test('IIPTileSource supports', function(assert) {
        assert.ok(
            OpenSeadragon.IIPTileSource.prototype.supports({
                iipsrv: "http://localhost/fcgi-bin/iipsrv.fcgi",
                image: "test.tif"
            }),
            'should return true for valid IIP data'
        );

        assert.notOk(
            OpenSeadragon.IIPTileSource.prototype.supports({
                type: "dzi"
            }),
            'should return false for non-IIP data'
        );

        assert.notOk(
            OpenSeadragon.IIPTileSource.prototype.supports(null),
            'should return false for null'
        );

        assert.notOk(
            OpenSeadragon.IIPTileSource.prototype.supports({}),
            'should return false for empty object'
        );

        assert.notOk(
            OpenSeadragon.IIPTileSource.prototype.supports({ iipsrv: "http://test" }),
            'should return false without image'
        );

        assert.notOk(
            OpenSeadragon.IIPTileSource.prototype.supports({ image: "test.tif" }),
            'should return false without iipsrv'
        );
    });

    QUnit.test('IIPTileSource parseIIP errors', function(assert) {
        // No Max-size
        assert.throws(function() {
            test.parseIIP("Tile-size:256 256\r\nResolution-number:1\r\nResolutions:256 256\r\n");
        }, /No Max-size returned/, 'should throw when no Max-size');

        // No Tile-size
        assert.throws(function() {
            test.parseIIP("Max-size:256 256\r\nResolution-number:1\r\nResolutions:256 256\r\n");
        }, /No Tile-size returned/, 'should throw when no Tile-size');
    });

    QUnit.test('IIPTileSource configure', function(assert) {
        var options = { iipsrv: "http://test", image: "test.tif" };
        var result = OpenSeadragon.IIPTileSource.prototype.configure(options, "http://url", null);
        assert.equal(result, options, 'should return the options object');
    });

    QUnit.test('IIPTileSource getNumTiles', function(assert) {
        // levelSizes is initialized in beforeEach; no dependency on other tests

        // Level 0: 129x26 image, 256x256 tiles = 1x1 tiles
        var tiles0 = test.getNumTiles(0);
        assert.equal(tiles0.x, 1, 'level 0 x tiles');
        assert.equal(tiles0.y, 1, 'level 0 y tiles');

        // Level 6 (max): 8272x1712 image, 256x256 tiles = 33x7 tiles
        var tiles6 = test.getNumTiles(6);
        assert.equal(tiles6.x, 33, 'level 6 x tiles');
        assert.equal(tiles6.y, 7, 'level 6 y tiles');
    });

    QUnit.test('IIPTileSource getTileUrl with all transforms', function(assert) {
        test.format = "jpg";
        test.transform = {
            stack: "0,1,2",
            contrast: 1.5,
            gamma: 0.8,
            invert: true,
            color: "1,2,3",
            twist: 45,
            convolution: "sharpen",
            quality: 90,
            colormap: "hot",
            minmax: "0,255",
            hillshade: "azimuth=315,elevation=45"
        };

        var url = test.getTileUrl(0, 0, 0);

        assert.ok(url.includes('SDS=0,1,2'), 'includes stack transform');
        assert.ok(url.includes('CNT=1.5'), 'includes contrast transform');
        assert.ok(url.includes('GAM=0.8'), 'includes gamma transform');
        assert.ok(url.includes('INV'), 'includes invert transform');
        assert.ok(url.includes('COL=1,2,3'), 'includes color transform');
        assert.ok(url.includes('CTW=45'), 'includes twist transform');
        assert.ok(url.includes('CNV=sharpen'), 'includes convolution transform');
        assert.ok(url.includes('QLT=90'), 'includes quality transform');
        assert.ok(url.includes('CMP=hot'), 'includes colormap transform');
        assert.ok(url.includes('MINMAX=0,255'), 'includes minmax transform');
        assert.ok(url.includes('SHD=azimuth=315,elevation=45'), 'includes hillshade transform');
        assert.ok(url.includes('JTL=0,0'), 'includes tile coordinates');
    });

    QUnit.test('IIPTileSource getTileUrl with png format', function(assert) {
        test.format = "png";
        test.transform = null;
        var url = test.getTileUrl(0, 0, 0);
        assert.ok(url.includes('PTL=0,0'), 'png format should use PTL');
    });

    QUnit.test('IIPTileSource getTileUrl with avif format', function(assert) {
        test.format = "avif";
        test.transform = null;
        var url = test.getTileUrl(0, 0, 0);
        assert.ok(url.includes('ATL=0,0'), 'avif format should use ATL');
    });


    QUnit.test('IIP metadata request preserves constructor and authentication options', function(assert) {
        const originalAjax = OpenSeadragon.makeAjaxRequest;
        const originalConstructor = OpenSeadragon.IIPTileSource;
        const requests = [];

        OpenSeadragon.makeAjaxRequest = function(options) {
            requests.push(options);
        };

        try {
            const source = new originalConstructor({
                iipsrv: "http://localhost/fcgi-bin/iipsrv.fcgi",
                image: "test.tif",
                ajaxWithCredentials: true,
                ajaxHeaders: { 'X-Test': 'IIP' }
            });

            assert.strictEqual(requests.length, 1, 'one metadata request dispatched');
            assert.strictEqual(OpenSeadragon.IIPTileSource, originalConstructor, 'constructor identity preserved');
            assert.strictEqual(source.ready, false, 'source remains pending until metadata arrives');

            if (requests.length === 1) {
                assert.strictEqual(requests[0].url, source.getMetadataUrl(), 'metadata URL preserved');
                assert.strictEqual(requests[0].type, 'GET', 'request uses GET');
                assert.strictEqual(requests[0].async, false, 'request remains synchronous');
                assert.strictEqual(requests[0].withCredentials, true, 'credentials forwarded');
                assert.deepEqual(requests[0].headers, { 'X-Test': 'IIP' }, 'custom headers forwarded');
            }
        } finally {
            OpenSeadragon.makeAjaxRequest = originalAjax;
            OpenSeadragon.IIPTileSource = originalConstructor;
        }
    });

    QUnit.test('IIP successful metadata request initializes the image pyramid', function(assert) {
        const originalAjax = OpenSeadragon.makeAjaxRequest;
        const originalConstructor = OpenSeadragon.IIPTileSource;
        const metadata = 'Max-size:8272 1712\r\nTile-size:256 256\r\n' +
            'Resolution-number:7\r\nResolutions:129 26,258 53,517 107,' +
            '1034 214,2068 428,4136 856,8272 1712\r\n';
        let requestCount = 0;

        OpenSeadragon.makeAjaxRequest = function(options) {
            requestCount++;
            options.success({ responseText: metadata, status: 200, statusText: 'OK' });
        };

        try {
            const source = new originalConstructor({
                iipsrv: "http://localhost/fcgi-bin/iipsrv.fcgi",
                image: "test.tif"
            });

            assert.strictEqual(requestCount, 1, 'one successful metadata GET');
            assert.strictEqual(source.ready, true, 'source is ready');
            assert.strictEqual(source.width, 8272, 'full image width');
            assert.strictEqual(source.height, 1712, 'full image height');
            assert.strictEqual(source._tileWidth, 256, 'tile width parsed');
            assert.strictEqual(source.maxLevel, 6, 'seven resolutions produce levels 0 through 6');
            assert.strictEqual(source.levelSizes && source.levelSizes.length, 7, 'seven resolution sizes parsed');
            if (source.ready) {
                const tiles = source.getNumTiles(6);
                assert.strictEqual(tiles.x, 33, '8272 pixels require 33 tiles at 256 pixels each');
                assert.strictEqual(tiles.y, 7, '1712 pixels require 7 tiles at 256 pixels each');
            }
        } finally {
            OpenSeadragon.makeAjaxRequest = originalAjax;
            OpenSeadragon.IIPTileSource = originalConstructor;
        }
    });

    QUnit.test('IIP malformed metadata exposes XHR and parse exception', function(assert) {
        const originalAjax = OpenSeadragon.makeAjaxRequest;
        const originalConstructor = OpenSeadragon.IIPTileSource;
        const responseText = 'Tile-size:256 256\r\n';
        let request;
        let failure;

        OpenSeadragon.makeAjaxRequest = function(options) {
            request = options;
        };
        try {
            const source = new originalConstructor({
                iipsrv: 'http://localhost/fcgi-bin/iipsrv.fcgi',
                image: 'test.tif'
            });
            source.addHandler('open-failed', function(event) {
                failure = event;
            });

            assert.ok(request, 'IIP metadata GET dispatched');
            if (request) {
                const xhr = { status: 200, statusText: 'OK', responseText: responseText };
                request.success(xhr);

                assert.ok(failure, 'malformed IIP metadata emits open-failed');
                if (failure) {
                    assert.strictEqual(failure.source, source.getMetadataUrl(), 'metadata URL retained');
                    assert.strictEqual(failure.message,
                        'IIPTileSource: Error parsing IIP metadata: No Max-size returned',
                        'original parse error message retained');
                    assert.strictEqual(failure.status, 200, 'successful HTTP status retained on parse failure');
                    assert.strictEqual(failure.statusText, 'OK', 'HTTP status text exposed');
                    assert.strictEqual(failure.responseText, responseText, 'malformed response body exposed');
                    assert.strictEqual(failure.xhr, xhr, 'original XHR exposed');
                    assert.ok(failure.exception instanceof Error, 'parse exception object exposed');
                    assert.strictEqual(failure.exception.message, 'No Max-size returned',
                        'original parsing exception preserved');
                    assert.strictEqual(source.ready, false, 'parse failure does not mark the source ready');
                }
            }
        } finally {
            OpenSeadragon.makeAjaxRequest = originalAjax;
            OpenSeadragon.IIPTileSource = originalConstructor;
        }
    });

    QUnit.test('IIP HTTP failure emits status, response and original exception', function(assert) {
        const originalAjax = OpenSeadragon.makeAjaxRequest;
        const originalConstructor = OpenSeadragon.IIPTileSource;
        let request;

        OpenSeadragon.makeAjaxRequest = function(options) {
            request = options;
        };

        try {
            const source = new originalConstructor({
                iipsrv: "http://localhost/fcgi-bin/iipsrv.fcgi",
                image: "test.tif"
            });
            let failure;
            source.addHandler('open-failed', function(event) {
                failure = event;
            });

            assert.ok(request, 'metadata request dispatched');
            if (request) {
                const xhr = {
                    status: 503,
                    statusText: 'Service Unavailable',
                    responseText: '{"retry":30}'
                };
                const error = new Error('HTTP 503');
                request.error(xhr, error);

                assert.ok(failure, 'open-failed event delivered');
                if (failure) {
                    assert.strictEqual(failure.source, source.getMetadataUrl(), 'metadata source retained');
                    assert.strictEqual(failure.status, 503, 'HTTP status retained');
                    assert.strictEqual(failure.statusText, 'Service Unavailable', 'status text retained');
                    assert.strictEqual(failure.responseText, '{"retry":30}', 'server response retained');
                    assert.strictEqual(failure.xhr, xhr, 'original XHR exposed');
                    assert.strictEqual(failure.exception, error, 'original exception exposed');
                    assert.strictEqual(source.ready, false, 'failed source remains not ready');
                }
            }
        } finally {
            OpenSeadragon.makeAjaxRequest = originalAjax;
            OpenSeadragon.IIPTileSource = originalConstructor;
        }
    });

})();
