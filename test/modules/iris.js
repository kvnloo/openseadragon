(function() {
    QUnit.module('Iris');

    const mockMetadata = {
        extent: {
            width: 1983,
            height: 1381,
            layers: [
                { x_tiles: 8, y_tiles: 6, scale: 1 },
                { x_tiles: 31, y_tiles: 22, scale: 4.0005 },
                { x_tiles: 124, y_tiles: 87, scale: 16.0035 },
                { x_tiles: 496, y_tiles: 346, scale: 64.0141 }
            ]
        }
    };

    QUnit.test('IrisTileSource getMetadataUrl', function(assert) {
        const test = new OpenSeadragon.IrisTileSource({
            serverUrl: "http://localhost",
            slideId: "12345",
            metadata: mockMetadata
        });

        assert.ok(test.ready, "IrisTileSource should be ready after metadata");

        const expectedWidth = Math.ceil(
            mockMetadata.extent.width * mockMetadata.extent.layers[mockMetadata.extent.layers.length - 1].scale
        );

        assert.equal(test.width, expectedWidth, "Width should be correctly parsed from metadata");

        const expectedUrl = "http://localhost/slides/12345/metadata";
        assert.equal(test.getMetadataUrl(), expectedUrl, "Metadata URL should match expected format");
    });

    QUnit.test('IrisTileSource metadata parsing', function(assert) {
        const test = new OpenSeadragon.IrisTileSource({
            serverUrl: "http://localhost",
            slideId: "12345",
            metadata: mockMetadata
        });

        // Check dimensions
        const expectedWidth = Math.ceil(
            mockMetadata.extent.width * mockMetadata.extent.layers[mockMetadata.extent.layers.length - 1].scale
        );
        const expectedHeight = Math.ceil(
            mockMetadata.extent.height * mockMetadata.extent.layers[mockMetadata.extent.layers.length - 1].scale
        );

        assert.ok(test.width, "Width exists");
        assert.equal(test.width, expectedWidth, "Parsing width correctly");
        assert.equal(test.height, expectedHeight, "Parsing height correctly");

        // Check level sizes and scales
        assert.ok(test.levelSizes, "Level sizes exist");
        assert.ok(Array.isArray(test.levelSizes), "Level sizes is an array");
        assert.equal(test.levelSizes.length, mockMetadata.extent.layers.length, "Number of levels is correct");
        assert.equal(test.maxLevel, mockMetadata.extent.layers.length - 1, "Max level is correctly set");

        assert.ok(test.levelScales, "Level scales exist");
        assert.equal(test.levelScales.length, 4, "Number of scales matches number of levels");
        assert.deepEqual(
            test.levelScales,
            [
                (mockMetadata.extent.layers[0].scale / mockMetadata.extent.layers[3].scale),
                (mockMetadata.extent.layers[1].scale / mockMetadata.extent.layers[3].scale),
                (mockMetadata.extent.layers[2].scale / mockMetadata.extent.layers[3].scale),
                (mockMetadata.extent.layers[3].scale / mockMetadata.extent.layers[3].scale)
            ],
            "Parsing scales correctly"
        );
    });

    QUnit.test('IrisTileSource getTileUrl', function(assert) {
        const test = new OpenSeadragon.IrisTileSource({
            serverUrl: "http://localhost",
            slideId: "12345",
            metadata: mockMetadata
        });

        assert.equal(
            test.getTileUrl(0, 0, 0),
            "http://localhost/slides/12345/layers/0/tiles/0",
            "Tile URL for level 0, x=0, y=0 should match expected format"
        );
        assert.equal(
            test.getTileUrl(1, 1, 0),
            "http://localhost/slides/12345/layers/1/tiles/1",
            "Tile URL for level 1, x=1, y=0 should match expected format"
        );
        assert.equal(
            test.getTileUrl(2, 1, 1),
            "http://localhost/slides/12345/layers/2/tiles/125",
            "Tile URL for level 2, x=1, y=1 should match expected format"
        );
        assert.equal(
            test.getTileUrl(3, 2, 2),
            "http://localhost/slides/12345/layers/3/tiles/994",
            "Tile URL for level 3, x=2, y=2 should match expected format"
        );
        assert.equal(
            test.getTileUrl(3, 3, 2),
            "http://localhost/slides/12345/layers/3/tiles/995",
            "Tile URL for level 3, x=3, y=2 should match expected format"
        );
    });
    QUnit.test('Iris HTTP 404 retains status and exposes response details', function(assert) {
        const originalAjax = OpenSeadragon.makeAjaxRequest;
        let request;
        let failure;

        OpenSeadragon.makeAjaxRequest = function(options) {
            request = options;
        };
        try {
            const source = new OpenSeadragon.IrisTileSource({
                serverUrl: 'http://localhost',
                slideId: '12345'
            });
            source.addHandler('open-failed', function(event) {
                failure = event;
            });

            assert.ok(request, 'Iris metadata GET dispatched');
            if (request) {
                const xhr = {
                    status: 404,
                    statusText: 'Not Found',
                    responseText: '{"detail":"slide missing"}'
                };
                const exception = new Error('HTTP 404');
                request.error(xhr, exception);

                assert.ok(failure, 'open-failed event emitted');
                if (failure) {
                    assert.strictEqual(failure.message,
                        'IrisTileSource: Unable to get metadata from http://localhost/slides/12345/metadata',
                        'existing failure message retained');
                    assert.strictEqual(failure.source, source.getMetadataUrl(), 'metadata source retained');
                    assert.strictEqual(failure.status, 404, 'legacy numeric status retained');
                    assert.strictEqual(failure.statusText, 'Not Found', 'status text exposed');
                    assert.strictEqual(failure.responseText, '{"detail":"slide missing"}',
                        'server error body exposed');
                    assert.strictEqual(failure.xhr, xhr, 'original XHR exposed');
                    assert.strictEqual(failure.exception, exception, 'request exception retained');
                    assert.strictEqual(source.ready, false, 'failed source remains not ready');
                }
            }
        } finally {
            OpenSeadragon.makeAjaxRequest = originalAjax;
        }
    });

    QUnit.test('Iris malformed JSON exposes the successful response and parse exception', function(assert) {
        const originalAjax = OpenSeadragon.makeAjaxRequest;
        const responseText = '{"extent":';
        let request;
        let failure;

        OpenSeadragon.makeAjaxRequest = function(options) {
            request = options;
        };
        try {
            const source = new OpenSeadragon.IrisTileSource({
                serverUrl: 'http://localhost',
                slideId: '12345'
            });
            source.addHandler('open-failed', function(event) {
                failure = event;
            });

            assert.ok(request, 'Iris metadata GET dispatched');
            if (request) {
                const xhr = { status: 200, statusText: 'OK', responseText: responseText };
                request.success(xhr);

                assert.ok(failure, 'malformed JSON emits open-failed');
                if (failure) {
                    assert.ok(failure.message.indexOf('IrisTileSource: Error parsing metadata: ') === 0,
                        'existing parsing error prefix retained');
                    assert.strictEqual(failure.source, source.getMetadataUrl(), 'metadata URL retained');
                    assert.strictEqual(failure.status, 200, 'HTTP success status retained on parse failure');
                    assert.strictEqual(failure.statusText, 'OK', 'status text exposed');
                    assert.strictEqual(failure.responseText, responseText, 'malformed JSON body exposed');
                    assert.strictEqual(failure.xhr, xhr, 'original XHR exposed');
                    assert.ok(failure.exception instanceof SyntaxError, 'JSON parse exception exposed');
                    assert.strictEqual(source.ready, false, 'parse failure does not mark the source ready');
                }
            }
        } finally {
            OpenSeadragon.makeAjaxRequest = originalAjax;
        }
    });
})();