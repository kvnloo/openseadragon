/*
 * OpenSeadragon - Profiler tests
 */
(function() {
    function withClock(assert, timestamps, test) {
        const originalNow = OpenSeadragon.now;
        let index = 0;

        OpenSeadragon.now = function() {
            if (index >= timestamps.length) {
                throw new Error('Profiler requested an unexpected timestamp');
            }
            return timestamps[index++];
        };

        try {
            test();
            assert.strictEqual(index, timestamps.length, 'all expected timestamps were read');
        } finally {
            OpenSeadragon.now = originalNow;
        }
    }

    QUnit.module('profiler');

    QUnit.test('starts empty and ignores endUpdate without a begin', function(assert) {
        const profiler = new OpenSeadragon.Profiler();

        profiler.endUpdate();

        assert.strictEqual(profiler.midUpdate, false, 'not updating');
        assert.strictEqual(profiler.numUpdates, 0, 'no completed updates');
        assert.strictEqual(profiler.lastBeginTime, null, 'no begin timestamp');
        assert.strictEqual(profiler.lastEndTime, null, 'no end timestamp');
        assert.strictEqual(profiler.minUpdateTime, Infinity, 'update minimum is unset');
        assert.strictEqual(profiler.avgUpdateTime, 0, 'update average starts at zero');
        assert.strictEqual(profiler.maxUpdateTime, 0, 'update maximum starts at zero');
        assert.strictEqual(profiler.minIdleTime, Infinity, 'idle minimum is unset');
        assert.strictEqual(profiler.avgIdleTime, 0, 'idle average starts at zero');
        assert.strictEqual(profiler.maxIdleTime, 0, 'idle maximum starts at zero');
    });

    QUnit.test('first update records duration but no idle interval', function(assert) {
        const profiler = new OpenSeadragon.Profiler();

        withClock(assert, [100, 125], function() {
            profiler.beginUpdate();
            assert.strictEqual(profiler.midUpdate, true, 'begin marks an active update');
            assert.strictEqual(profiler.numUpdates, 0, 'begin does not count as completed');
            assert.strictEqual(profiler.lastBeginTime, 100, 'begin timestamp is stored');

            profiler.endUpdate();
            assert.strictEqual(profiler.midUpdate, false, 'end clears the active flag');
            assert.strictEqual(profiler.lastEndTime, 125, 'end timestamp is stored');
            assert.strictEqual(profiler.numUpdates, 1, 'end counts the update');
            assert.strictEqual(profiler.minUpdateTime, 25, 'minimum update duration');
            assert.strictEqual(profiler.avgUpdateTime, 25, 'average update duration');
            assert.strictEqual(profiler.maxUpdateTime, 25, 'maximum update duration');
            assert.strictEqual(profiler.minIdleTime, Infinity, 'no idle interval before the first update');
            assert.strictEqual(profiler.avgIdleTime, 0, 'idle average remains empty');
            assert.strictEqual(profiler.maxIdleTime, 0, 'idle maximum remains empty');
        });
    });

    QUnit.test('tracks update and idle extrema and rolling averages', function(assert) {
        const profiler = new OpenSeadragon.Profiler();

        // Update durations: 10, 30, 20, 20; idle durations: 7, 5, 20.
        withClock(assert, [100, 110, 117, 147, 152, 172, 192, 212], function() {
            for (let i = 0; i < 4; i++) {
                profiler.beginUpdate();
                profiler.endUpdate();
            }

            assert.strictEqual(profiler.numUpdates, 4, 'counts completed updates');
            assert.strictEqual(profiler.minUpdateTime, 10, 'shortest update');
            assert.strictEqual(profiler.avgUpdateTime, 20, 'update average is (10 + 30 + 20 + 20) / 4');
            assert.strictEqual(profiler.maxUpdateTime, 30, 'longest update');
            assert.strictEqual(profiler.minIdleTime, 5, 'shortest idle period');
            assert.strictEqual(profiler.avgIdleTime, 32 / 3, 'idle average is (7 + 5 + 20) / 3');
            assert.strictEqual(profiler.maxIdleTime, 20, 'longest idle period');
            assert.strictEqual(profiler.lastBeginTime, 192, 'retains most recent begin');
            assert.strictEqual(profiler.lastEndTime, 212, 'retains most recent end');
        });
    });

    QUnit.test('beginUpdate automatically ends a previous active update', function(assert) {
        const profiler = new OpenSeadragon.Profiler();

        withClock(assert, [100, 120, 130, 160], function() {
            profiler.beginUpdate();
            profiler.beginUpdate();

            assert.strictEqual(profiler.midUpdate, true, 'second update is active');
            assert.strictEqual(profiler.numUpdates, 1, 'first update was closed');
            assert.strictEqual(profiler.lastEndTime, 120, 'implicit end uses its own timestamp');
            assert.strictEqual(profiler.lastBeginTime, 130, 'new begin uses the next timestamp');
            assert.strictEqual(profiler.avgIdleTime, 10, 'idle is measured after the implicit end');

            profiler.endUpdate();
            profiler.endUpdate();

            assert.strictEqual(profiler.numUpdates, 2, 'a repeated end does not double-count');
            assert.strictEqual(profiler.minUpdateTime, 20, 'first update is shortest');
            assert.strictEqual(profiler.avgUpdateTime, 25, 'update durations are 20 and 30');
            assert.strictEqual(profiler.maxUpdateTime, 30, 'second update is longest');
        });
    });

    QUnit.test('clearProfile discards an active update and resets every metric', function(assert) {
        const profiler = new OpenSeadragon.Profiler();

        withClock(assert, [10, 20, 23, 100, 102], function() {
            profiler.beginUpdate();
            profiler.endUpdate();
            profiler.beginUpdate();
            profiler.clearProfile();

            assert.strictEqual(profiler.midUpdate, false, 'stops the in-progress update');
            assert.strictEqual(profiler.numUpdates, 0, 'clears the count');
            assert.strictEqual(profiler.lastBeginTime, null, 'clears begin time');
            assert.strictEqual(profiler.lastEndTime, null, 'clears end time');
            assert.strictEqual(profiler.minUpdateTime, Infinity, 'resets update minimum');
            assert.strictEqual(profiler.avgUpdateTime, 0, 'resets update average');
            assert.strictEqual(profiler.maxUpdateTime, 0, 'resets update maximum');
            assert.strictEqual(profiler.minIdleTime, Infinity, 'resets idle minimum');
            assert.strictEqual(profiler.avgIdleTime, 0, 'resets idle average');
            assert.strictEqual(profiler.maxIdleTime, 0, 'resets idle maximum');

            profiler.endUpdate();
            assert.strictEqual(profiler.numUpdates, 0, 'ending a cleared update has no effect');

            profiler.beginUpdate();
            profiler.endUpdate();

            assert.strictEqual(profiler.numUpdates, 1, 'can be reused after clearing');
            assert.strictEqual(profiler.minUpdateTime, 2, 'new sample has no old minimum');
            assert.strictEqual(profiler.avgUpdateTime, 2, 'new sample has no old average');
            assert.strictEqual(profiler.maxUpdateTime, 2, 'new sample has no old maximum');
            assert.strictEqual(profiler.minIdleTime, Infinity, 'the next sample is a first update');
        });
    });

    QUnit.test('zero-duration updates and idle periods remain valid samples', function(assert) {
        const profiler = new OpenSeadragon.Profiler();

        withClock(assert, [500, 500, 500, 500], function() {
            profiler.beginUpdate();
            profiler.endUpdate();
            profiler.beginUpdate();
            profiler.endUpdate();

            assert.strictEqual(profiler.numUpdates, 2, 'counts both zero-duration updates');
            assert.strictEqual(profiler.minUpdateTime, 0, 'zero is a valid update minimum');
            assert.strictEqual(profiler.avgUpdateTime, 0, 'zero is a valid update average');
            assert.strictEqual(profiler.maxUpdateTime, 0, 'zero is a valid update maximum');
            assert.strictEqual(profiler.minIdleTime, 0, 'zero is a valid idle minimum');
            assert.strictEqual(profiler.avgIdleTime, 0, 'zero is a valid idle average');
            assert.strictEqual(profiler.maxIdleTime, 0, 'zero is a valid idle maximum');
        });
    });
}());
