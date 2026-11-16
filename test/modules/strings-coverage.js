/* global QUnit, OpenSeadragon, testLog */

(function() {
    let originalHome;
    let originalZoomIn;

    QUnit.module('strings-coverage', {
        beforeEach: function() {
            testLog.reset();
            originalHome = OpenSeadragon.getString('Tooltips.Home');
            originalZoomIn = OpenSeadragon.getString('Tooltips.ZoomIn');
        },
        afterEach: function() {
            OpenSeadragon.setString('Tooltips.Home', originalHome);
            OpenSeadragon.setString('Tooltips.ZoomIn', originalZoomIn);
        }
    });

    QUnit.test('nested built-in strings and numbered arguments', function(assert) {
        assert.strictEqual(OpenSeadragon.getString('Tooltips.Home'), 'Go home',
            'a nested tooltip is available');
        assert.strictEqual(OpenSeadragon.getString('Errors.OpenFailed', 'image.dzi', '404'),
            'Unable to open image.dzi: 404', 'two numbered arguments are substituted');
        assert.strictEqual(OpenSeadragon.getString('GestureHints.Scroll', 'Ctrl'),
            'Use Ctrl + scroll to zoom the image', 'another nested section uses arguments');
        assert.strictEqual(OpenSeadragon.getString('Errors.Status', 'HTTP', 503),
            'This space unintentionally left blank (HTTP 503).', 'numeric arguments are stringified');
        assert.strictEqual(OpenSeadragon.getString('Errors.Status', 'HTTP'),
            'This space unintentionally left blank (HTTP ).', 'omitted arguments become empty strings');
    });

    QUnit.test('setString supports repeated and out-of-order numbered placeholders', function(assert) {
        OpenSeadragon.setString('Tooltips.Home',
            'One {1}; Zero {0}; Again {1}; Missing {2}; literal %s');

        assert.strictEqual(OpenSeadragon.getString('Tooltips.Home', 'alpha', 'beta'),
            'One beta; Zero alpha; Again beta; Missing ; literal %s',
            'out-of-order and repeated indexes work, missing indexes are empty, and %s remains literal');
        assert.strictEqual(OpenSeadragon.getString('Tooltips.Home', 'alpha', 'beta', 'gamma'),
            'One beta; Zero alpha; Again beta; Missing gamma; literal %s',
            'a previously missing argument is used when provided');
    });

    QUnit.test('setString replaces existing nested values independently', function(assert) {
        OpenSeadragon.setString('Tooltips.Home', 'Start');
        OpenSeadragon.setString('Tooltips.ZoomIn', 'Closer');

        assert.strictEqual(OpenSeadragon.getString('Tooltips.Home'), 'Start',
            'first nested value is updated');
        assert.strictEqual(OpenSeadragon.getString('Tooltips.ZoomIn'), 'Closer',
            'another nested value is updated');
        assert.strictEqual(OpenSeadragon.getString('Tooltips.ZoomOut'), 'Zoom out',
            'a sibling key is untouched');

        OpenSeadragon.setString('Tooltips.Home', 'Start again');
        assert.strictEqual(OpenSeadragon.getString('Tooltips.Home'), 'Start again',
            'the last setter value wins');
    });

    QUnit.test('missing nested keys and non-leaf keys log and return empty strings', function(assert) {
        assert.strictEqual(OpenSeadragon.getString('Errors.NotHere'), '',
            'missing leaf returns empty string');
        assert.strictEqual(OpenSeadragon.getString('MissingBranch.Nested.Key'), '',
            'missing parent returns empty string');
        assert.strictEqual(OpenSeadragon.getString('Errors'), '',
            'a namespace object is not a translatable string');
        assert.deepEqual(testLog.error, [
            '["Untranslated source string:","Errors.NotHere"]',
            '["Untranslated source string:","MissingBranch.Nested.Key"]',
            '["Untranslated source string:","Errors"]'
        ], 'each invalid lookup logs its full key');
    });

    QUnit.test('non-string values log but empty strings remain valid', function(assert) {
        OpenSeadragon.setString('Tooltips.Home', 42);
        assert.strictEqual(OpenSeadragon.getString('Tooltips.Home'), '',
            'a non-string value cannot be translated');
        assert.deepEqual(testLog.error,
            ['["Untranslated source string:","Tooltips.Home"]'],
            'invalid value is logged');

        OpenSeadragon.setString('Tooltips.Home', '');
        testLog.reset();
        assert.strictEqual(OpenSeadragon.getString('Tooltips.Home'), '',
            'an explicitly blank translation remains blank');
        assert.deepEqual(testLog.error, [], 'a blank string does not log an error');
    });
})();
