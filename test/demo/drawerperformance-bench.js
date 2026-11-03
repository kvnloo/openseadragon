/*
 * Pure statistics and repeatable camera inputs for drawerperformance.html.
 * No OpenSeadragon, DOM or timing dependencies; loaded by the QUnit suite too.
 */
(function (root) {
    'use strict';

    function percentile(samples, fraction) {
        if (samples.length === 0) {
            return null;
        }

        const sorted = samples.slice().sort(function (a, b) {
            return a - b;
        });
        const position = (sorted.length - 1) * Math.max(0, Math.min(1, fraction));
        const lower = Math.floor(position);
        const upper = Math.ceil(position);
        const remainder = position - lower;
        return sorted[lower] + (sorted[upper] - sorted[lower]) * remainder;
    }

    function summarizeSamples(samples) {
        if (samples.length === 0) {
            return { median: null, p95: null, max: null, mean: null };
        }

        let sum = 0;
        let max = -Infinity;
        samples.forEach(function (value) {
            sum += value;
            max = Math.max(max, value);
        });

        return {
            median: percentile(samples, 0.5),
            p95: percentile(samples, 0.95),
            max: max,
            mean: sum / samples.length
        };
    }

    // LCG uses uint32 arithmetic so a seed yields identical inputs across browsers.
    function generateSequence(seed, steps) {
        let state = seed >>> 0;
        const sequence = [];
        function next() {
            state = (Math.imul(1664525, state) + 1013904223) >>> 0;
            return state / 4294967296;
        }

        for (let i = 0; i < steps; i++) {
            sequence.push({
                dx: (next() - 0.5) * 0.12,
                dy: (next() - 0.5) * 0.12,
                zoom: 0.92 + next() * 0.16
            });
        }
        return sequence;
    }

    function makeSummary(options) {
        const samples = options.samples;
        return {
            version: 1,
            drawer: options.drawer,
            sources: options.sources,
            seed: options.seed,
            steps: options.steps,
            frames: samples.length,
            update: summarizeSamples(samples.map(function (sample) { return sample.update; })),
            draw: summarizeSamples(samples.map(function (sample) { return sample.draw; })),
            frame: summarizeSamples(samples.map(function (sample) { return sample.frame; })),
            counters: Object.assign({}, options.counters),
            userAgent: options.userAgent
        };
    }

    root.OpenSeadragonDrawerBench = {
        percentile: percentile,
        summarizeSamples: summarizeSamples,
        generateSequence: generateSequence,
        makeSummary: makeSummary
    };
})(window);
