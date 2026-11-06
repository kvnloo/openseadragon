(function() {

    const test = new OpenSeadragon.IIPTileSource();

    // Set options
    test.iipsrv = "http://localhost/fcgi-bin/iipsrv.fcgi";
    test.image = "test.tif";


    QUnit.module('IIP');


    QUnit.test('IIPTileSource metadata URL', function(assert) {

	const url = test.iipsrv + '?FIF=' + test.image + '&obj=IIP,1.0&obj=Max-size&obj=Tile-size&obj=Resolution-number&obj=Resolutions';
	assert.equal( test.getMetadataUrl(), url, "Info URL" );

    });


    QUnit.test('IIPTileSource metadata parsing', function(assert) {

	// Parse metadata
	const metadata = `Max-size:8272 1712\r\nTile-size:256 256\r\nResolution-number:7\r\nResolutions:129 26,258 53,517 107,1034 214,2068 428,4136 856,8272 1712\r\n`;
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
