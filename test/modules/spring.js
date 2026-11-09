/* global QUnit, Util, console */

(function () {

    let originalNow;
    let now;

    QUnit.module("spring", {
        beforeEach: function () {
            now = 0;
            originalNow = OpenSeadragon.now;

            OpenSeadragon.now = function() {
                return now;
            };
        },
        afterEach: function () {
            OpenSeadragon.now = originalNow;
        }
    });

    QUnit.test('regular spring', function(assert) {
        const done = assert.async();
        const spring = new OpenSeadragon.Spring({
            initial: 5,
            animationTime: 1,
            springStiffness: 0.000001
        });

        assert.equal(spring.current.value, 5, 'initial current value');
        assert.equal(spring.target.value, 5, 'initial target value');

        spring.springTo(6);
        assert.equal(spring.current.value, 5, 'current value after springTo');
        assert.equal(spring.target.value, 6, 'target value after springTo');

        now = 500;
        spring.update();
        Util.assessNumericValue(assert, spring.current.value, 5.5, 0.00001, 'current value after first update');
        assert.equal(spring.target.value, 6, 'target value after first update');

        now = 1000;
        spring.update();
        assert.equal(spring.current.value, 6, 'current value after second update');
        assert.equal(spring.target.value, 6, 'target value after second update');

        done();
    });

    QUnit.test('exponential spring', function(assert) {
        const done = assert.async();
        const spring = new OpenSeadragon.Spring({
            exponential: true,
            initial: 1,
            animationTime: 1,
            springStiffness: 0.000001
        });

        assert.equal(spring.current.value, 1, 'initial current value');
        assert.equal(spring.target.value, 1, 'initial target value');

        spring.springTo(2);
        assert.equal(spring.current.value, 1, 'current value after springTo');
        assert.equal(spring.target.value, 2, 'target value after springTo');

        now = 500;
        spring.update();
        Util.assessNumericValue(assert, spring.current.value, 1.41421, 0.00001, 'current value after first update');
        assert.equal(spring.target.value, 2, 'target value after first update');

        now = 1000;
        spring.update();
        assert.equal(spring.current.value, 2, 'current value after second update');
        assert.equal(spring.target.value, 2, 'target value after second update');

        done();
    });


    // #2877: count animation updates that do not move a projected CSS pixel.
    // No drawer is created: this is a deterministic spring-level proxy, not a
    // measurement of actual repaint calls or device-pixel-ratio behavior.
    QUnit.test('pixel-position plateaus in fixed-clock spring tails', function(assert) {
        const defaults = OpenSeadragon.DEFAULT_SETTINGS;
        const stepMs = 16;
        const tickCount = defaults.animationTime * 1000 / stepMs;

        assert.strictEqual(defaults.springStiffness, 6.5, 'viewer default spring stiffness');
        assert.strictEqual(defaults.animationTime, 1.2, 'viewer default animation duration');
        assert.strictEqual(tickCount, 75, 'fixed clock lands exactly at the target time');

        // Pan 0 -> 0.2 at 500 CSS px/world unit, or zoom 1 -> 2 for a
        // fixed point 0.2 world units from center (100 px at zoom 1).
        const panPixel = function(value) {
            return Math.round(500 * value);
        };
        const zoomPixel = function(value) {
            return Math.round(100 * value);
        };
        const cases = [
            {
                name: 'pan / default ease-out',
                initial: 0, target: 0.2, exponential: false,
                stiffness: defaults.springStiffness, pixel: panPixel,
                unchangedActive: 38, unchangedAll: 39,
                terminalActive: 15, lastMovingTick: 59
            },
            {
                name: 'pan / near-linear control',
                initial: 0, target: 0.2, exponential: false,
                stiffness: 0.000001, pixel: panPixel,
                unchangedActive: 0, unchangedAll: 0,
                terminalActive: 0, lastMovingTick: 74
            },
            {
                name: 'zoom / default ease-out (exponential)',
                initial: 1, target: 2, exponential: true,
                stiffness: defaults.springStiffness, pixel: zoomPixel,
                unchangedActive: 34, unchangedAll: 35,
                terminalActive: 13, lastMovingTick: 61
            },
            {
                name: 'zoom / near-linear control (exponential)',
                initial: 1, target: 2, exponential: true,
                stiffness: 0.000001, pixel: zoomPixel,
                unchangedActive: 0, unchangedAll: 0,
                terminalActive: 0, lastMovingTick: 74
            }
        ];

        cases.forEach(function(config) {
            now = 0;
            const spring = new OpenSeadragon.Spring({
                initial: config.initial,
                exponential: config.exponential,
                springStiffness: config.stiffness,
                animationTime: defaults.animationTime
            });
            spring.springTo(config.target);

            let previousPixel = config.pixel(spring.current.value);
            let activeUpdates = 0;
            let unchangedActive = 0;
            let unchangedAll = 0;
            let terminalActive = 0;
            let lastMovingTick = 0;
            let lastStepPixels = 0;
            let stillAnimating = true;

            for (let tick = 1; tick <= tickCount; tick++) {
                now = tick * stepMs;
                stillAnimating = spring.update();
                const pixel = config.pixel(spring.current.value);
                lastStepPixels = Math.abs(pixel - previousPixel);
                if (pixel === previousPixel) {
                    unchangedAll++;
                    if (stillAnimating) {
                        unchangedActive++;
                        terminalActive++;
                    }
                } else if (stillAnimating) {
                    terminalActive = 0;
                    lastMovingTick = tick;
                }
                if (stillAnimating) {
                    activeUpdates++;
                }
                previousPixel = pixel;
            }

            assert.strictEqual(activeUpdates, 74, config.name + ': active update count');
            assert.notOk(stillAnimating, config.name + ': finishes at target time');
            assert.strictEqual(spring.current.value, config.target, config.name + ': exact target');
            assert.strictEqual(previousPixel, config.pixel(config.target),
                config.name + ': final projected CSS pixel');
            assert.strictEqual(unchangedActive, config.unchangedActive,
                config.name + ': unchanged-pixel updates while animating');
            assert.strictEqual(unchangedAll, config.unchangedAll,
                config.name + ': unchanged-pixel updates including final tick');
            assert.strictEqual(terminalActive, config.terminalActive,
                config.name + ': consecutive unchanged active tail updates');
            assert.strictEqual(lastMovingTick, config.lastMovingTick,
                config.name + ': last active update moving a pixel');
            assert.ok(lastStepPixels <= 2, config.name + ': no large final-step pixel jump');
        });
    });

})();
