/* global QUnit, OpenSeadragonDrawerBench */
(function () {
    'use strict';

    const bench = OpenSeadragonDrawerBench;

    QUnit.module('DrawerPerformanceBench');

    QUnit.test('percentile handles empty, singleton, odd and even samples', function (assert) {
        assert.strictEqual(bench.percentile([], 0.95), null, 'empty input has no percentile');
        assert.strictEqual(bench.percentile([7], 0.5), 7, 'one sample has its own median');
        assert.strictEqual(bench.percentile([7], 0.95), 7, 'one sample has its own p95');
        assert.strictEqual(bench.percentile([5, 1, 3], 0.5), 3, 'odd median is middle sample');
        assert.strictEqual(bench.percentile([4, 1, 3, 2], 0.5), 2.5, 'even median is interpolated');
        assert.ok(Math.abs(bench.percentile([4, 1, 3, 2], 0.95) - 3.85) < 1e-10,
            'p95 uses linear interpolation at position 2.85');
        const untouched = [4, 1, 3, 2];
        assert.strictEqual(bench.percentile(untouched, 0), 1, 'minimum');
        assert.strictEqual(bench.percentile(untouched, 1), 4, 'maximum');
        assert.deepEqual(untouched, [4, 1, 3, 2], 'input is not mutated');
    });

    QUnit.test('statistics have predictable values and nulls', function (assert) {
        assert.deepEqual(bench.summarizeSamples([]), {
            median: null, p95: null, max: null, mean: null
        }, 'no data is encoded as JSON-safe null');
        const result = bench.summarizeSamples([8, 2, 6, 4]);
        assert.strictEqual(result.median, 5, 'median of four observations');
        assert.ok(Math.abs(result.p95 - 7.7) < 1e-10, 'p95 of four observations');
        assert.strictEqual(result.max, 8, 'maximum');
        assert.strictEqual(result.mean, 5, 'arithmetic mean');
    });

    QUnit.test('seeded rapid-pan and zoom sequence is deterministic', function (assert) {
        const first = bench.generateSequence(17, 12);
        assert.deepEqual(first, bench.generateSequence(17, 12),
            'same seed and steps always generate identical motions');
        assert.notDeepEqual(first, bench.generateSequence(18, 12),
            'changing the seed changes the motions');
        assert.strictEqual(first.length, 12, 'one motion per step');
        assert.deepEqual(bench.generateSequence(17, 0), [], 'zero steps produce no actions');
        first.forEach(function (action) {
            assert.ok(Math.abs(action.dx) <= 0.06 && Math.abs(action.dy) <= 0.06,
                'pan offsets are bounded');
            assert.ok(action.zoom >= 0.92 && action.zoom < 1.08,
                'zoom ratio is bounded');
        });
    });

    QUnit.test('summary exposes the machine-readable contract', function (assert) {
        const summary = bench.makeSummary({
            drawer: 'webgl',
            sources: 2,
            seed: 17,
            steps: 3,
            samples: [
                { update: 2, draw: 4, frame: 7 },
                { update: 4, draw: 6, frame: 11 }
            ],
            counters: { tileRequests: 3, tileLoaded: 2, conversionsStarted: 1 },
            userAgent: 'QUnit'
        });

        assert.deepEqual(Object.keys(summary), [
            'version', 'drawer', 'sources', 'seed', 'steps', 'frames',
            'update', 'draw', 'frame', 'counters', 'userAgent'
        ], 'summary has the requested top-level fields');
        assert.strictEqual(summary.version, 1, 'stable schema version');
        assert.strictEqual(summary.drawer, 'webgl', 'drawer reported');
        assert.strictEqual(summary.frames, 2, 'actual sampled frame count');
        assert.strictEqual(summary.update.median, 3, 'update median');
        assert.strictEqual(summary.update.max, 4, 'update max');
        assert.strictEqual(summary.update.mean, 3, 'update mean');
        assert.ok(Math.abs(summary.update.p95 - 3.9) < 1e-10, 'update p95');
        assert.strictEqual(summary.draw.median, 5, 'draw median');
        assert.strictEqual(summary.draw.max, 6, 'draw max');
        assert.strictEqual(summary.draw.mean, 5, 'draw mean');
        assert.ok(Math.abs(summary.draw.p95 - 5.9) < 1e-10, 'draw p95');
        assert.strictEqual(summary.frame.median, 9, 'frame median');
        assert.strictEqual(summary.frame.max, 11, 'frame max');
        assert.strictEqual(summary.frame.mean, 9, 'frame mean');
        assert.ok(Math.abs(summary.frame.p95 - 10.8) < 1e-10, 'frame p95');
        assert.deepEqual(summary.counters, {
            tileRequests: 3, tileLoaded: 2, conversionsStarted: 1
        }, 'work counters are kept separate');
        assert.strictEqual(summary.userAgent, 'QUnit', 'user agent reported');
        assert.strictEqual(bench.makeSummary({
            drawer: 'canvas', sources: 1, seed: 0, steps: 0,
            samples: [], counters: {}, userAgent: 'QUnit'
        }).frame.median, null, 'empty frame list remains serializable');
    });
})();
