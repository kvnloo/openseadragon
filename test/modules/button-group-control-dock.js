/* global QUnit, OpenSeadragon */

(function () {
    const OSD = OpenSeadragon;
    let group;
    let buttons;

    function makeButton() {
        const button = new OSD.Button({
            element: document.createElement('button'),
            tooltip: 'Test button'
        });
        buttons.push(button);
        return button;
    }

    QUnit.module('ButtonGroup', {
        beforeEach: function () {
            group = null;
            buttons = [];
        },
        afterEach: function () {
            if (group) {
                group.destroy();
                group = null;
            }
            buttons.forEach(function (button) {
                if (button.element) {
                    button.destroy();
                }
            });
        }
    });

    QUnit.test('constructor mounts buttons in order in a supplied container', function (assert) {
        const host = document.createElement('nav');
        document.getElementById('qunit-fixture').appendChild(host);
        const first = makeButton();
        const second = makeButton();

        group = new OSD.ButtonGroup({
            buttons: [first, second],
            element: host
        });

        assert.strictEqual(group.element, host, 'reuses the supplied element');
        assert.deepEqual(group.buttons, [first, second], 'preserves the supplied button order');
        assert.deepEqual(Array.from(host.children), [first.element, second.element],
            'mounts the button elements in the same order');
        assert.strictEqual(host.style.display, 'inline-block', 'lays out the container inline');
        assert.ok(group.tracker, 'creates a shared mouse tracker');
    });

    QUnit.test('addButton appends buttons; destroy removes and destroys owned buttons', function (assert) {
        group = new OSD.ButtonGroup({ buttons: [] });
        document.getElementById('qunit-fixture').appendChild(group.element);
        const first = makeButton();
        const second = makeButton();
        const firstElement = first.element;
        const secondElement = second.element;
        const host = group.element;

        group.addButton(first);
        group.addButton(second);

        assert.deepEqual(group.buttons, [first, second], 'tracks newly added buttons in order');
        assert.deepEqual(Array.from(host.children), [firstElement, secondElement],
            'appends both elements to the group');

        const ownedGroup = group;
        group.destroy();
        group = null;

        assert.strictEqual(ownedGroup.buttons.length, 0, 'removes all owned buttons');
        assert.strictEqual(ownedGroup.element, null, 'releases the container reference');
        assert.strictEqual(firstElement.parentNode, null, 'removes the first button element');
        assert.strictEqual(secondElement.parentNode, null, 'removes the second button element');
        assert.strictEqual(first.element, null, 'destroys the first button');
        assert.strictEqual(second.element, null, 'destroys the second button');
    });

    QUnit.test('group entry and exit update every button, except pressed-inside leave', function (assert) {
        const first = makeButton();
        const second = makeButton();
        group = new OSD.ButtonGroup({ buttons: [first, second] });

        assert.deepEqual([first.currentState, second.currentState],
            [OSD.ButtonState.REST, OSD.ButtonState.REST], 'both begin at rest');

        group.emulateEnter();
        assert.deepEqual([first.currentState, second.currentState],
            [OSD.ButtonState.GROUP, OSD.ButtonState.GROUP], 'entry activates both buttons');

        group.tracker.leaveHandler({ insideElementPressed: true });
        assert.deepEqual([first.currentState, second.currentState],
            [OSD.ButtonState.GROUP, OSD.ButtonState.GROUP],
            'leaving while pressed inside does not deactivate the group');

        group.emulateLeave();
        assert.deepEqual([first.currentState, second.currentState],
            [OSD.ButtonState.REST, OSD.ButtonState.REST], 'ordinary exit rests both buttons');
    });

    QUnit.test('group entry leaves disabled buttons at rest', function (assert) {
        const disabled = makeButton();
        const enabled = makeButton();
        group = new OSD.ButtonGroup({ buttons: [disabled, enabled] });
        disabled.disable();

        group.emulateEnter();
        assert.ok(disabled.isDisabled(), 'first button remains disabled');
        assert.strictEqual(disabled.currentState, OSD.ButtonState.REST,
            'disabled button ignores group entry');
        assert.strictEqual(enabled.currentState, OSD.ButtonState.GROUP,
            'enabled sibling responds to group entry');

        disabled.enable();
        group.emulateLeave();
        assert.deepEqual([disabled.currentState, enabled.currentState],
            [OSD.ButtonState.REST, OSD.ButtonState.REST],
            'both return to rest after the disabled button is re-enabled');
    });

    let dock;

    QUnit.module('ControlDock', {
        beforeEach: function () {
            dock = null;
        },
        afterEach: function () {
            if (dock) {
                dock.clearControls();
                dock = null;
            }
        }
    });

    QUnit.test('constructor mounts the four anchored containers and disables submit', function (assert) {
        const host = document.createElement('div');
        document.getElementById('qunit-fixture').appendChild(host);
        dock = new OSD.ControlDock({ element: host });

        assert.strictEqual(dock.container.parentNode, host, 'mounts inside the supplied host');
        assert.strictEqual(host.style.position, 'relative', 'positions a static host relatively');
        assert.strictEqual(dock.container.style.width, '100%', 'fills host width');
        assert.strictEqual(dock.container.style.height, '100%', 'fills host height');
        assert.deepEqual(Array.from(dock.container.children), [
            dock.controls.topleft,
            dock.controls.topright,
            dock.controls.bottomright,
            dock.controls.bottomleft
        ], 'creates four corner containers in layout order');
        assert.strictEqual(dock.controls.topleft.style.top, '0px', 'top-left is top anchored');
        assert.strictEqual(dock.controls.topleft.style.left, '0px', 'top-left is left anchored');
        assert.strictEqual(dock.controls.bottomright.style.bottom, '0px', 'bottom-right is bottom anchored');
        assert.strictEqual(dock.controls.bottomright.style.right, '0px', 'bottom-right is right anchored');
        assert.strictEqual(dock.container.onsubmit(), false, 'form submission is suppressed');
        assert.strictEqual(dock.controls.length, 0, 'corner containers are not individual controls');
    });

    QUnit.test('all four anchors choose the correct container; right anchors prepend', function (assert) {
        dock = new OSD.ControlDock();
        const topLeft = document.createElement('span');
        const topRight = document.createElement('span');
        const topRightSecond = document.createElement('span');
        const bottomRight = document.createElement('span');
        const bottomLeft = document.createElement('span');

        dock.addControl(topLeft, { anchor: OSD.ControlAnchor.TOP_LEFT });
        dock.addControl(topRight, { anchor: OSD.ControlAnchor.TOP_RIGHT });
        dock.addControl(topRightSecond, { anchor: OSD.ControlAnchor.TOP_RIGHT });
        dock.addControl(bottomRight, { anchor: OSD.ControlAnchor.BOTTOM_RIGHT });
        dock.addControl(bottomLeft, { anchor: OSD.ControlAnchor.BOTTOM_LEFT });

        assert.strictEqual(dock.controls.length, 5, 'tracks each distinct control');
        assert.strictEqual(dock.controls[0].wrapper.parentNode, dock.controls.topleft, 'top-left parent');
        assert.strictEqual(dock.controls[1].wrapper.parentNode, dock.controls.topright, 'top-right parent');
        assert.strictEqual(dock.controls[3].wrapper.parentNode, dock.controls.bottomright, 'bottom-right parent');
        assert.strictEqual(dock.controls[4].wrapper.parentNode, dock.controls.bottomleft, 'bottom-left parent');
        assert.deepEqual(Array.from(dock.controls.topright.children), [
            dock.controls[2].wrapper, dock.controls[1].wrapper
        ], 'later right-anchored controls appear first');
        assert.strictEqual(topRight.style.position, 'relative', 'anchors make controls positioned');
        assert.strictEqual(topRight.style.paddingRight, '0px', 'top-right clears right padding');
        assert.strictEqual(topRight.style.paddingTop, '0px', 'top-right clears top padding');
    });

    QUnit.test('duplicate add is ignored; removing a missing control is harmless', function (assert) {
        dock = new OSD.ControlDock();
        const element = document.createElement('span');
        const unknown = document.createElement('span');
        dock.addControl(element, { anchor: OSD.ControlAnchor.TOP_LEFT });
        const firstControl = dock.controls[0];

        dock.addControl(element, { anchor: OSD.ControlAnchor.BOTTOM_RIGHT });
        assert.strictEqual(dock.controls.length, 1, 'duplicate does not create another control');
        assert.strictEqual(dock.controls[0], firstControl, 'duplicate preserves original wrapper');
        assert.strictEqual(firstControl.wrapper.parentNode, dock.controls.topleft,
            'duplicate does not move the original');

        assert.strictEqual(dock.removeControl(unknown), dock, 'missing removal is chainable');
        assert.strictEqual(dock.controls.length, 1, 'missing removal leaves controls alone');
        assert.strictEqual(dock.removeControl(element), dock, 'actual removal is chainable');
        assert.strictEqual(dock.controls.length, 0, 'removes the registered control');
        assert.strictEqual(firstControl.wrapper.parentNode, null, 'removes its wrapper');
        assert.strictEqual(element.parentNode, null, 'detaches the control element');

        dock.addControl(element, { anchor: OSD.ControlAnchor.BOTTOM_RIGHT });
        assert.strictEqual(dock.controls.length, 1, 'removed element can be registered again');
        assert.strictEqual(dock.controls[0].wrapper.parentNode, dock.controls.bottomright,
            'new anchor applies on re-registration');
    });

    QUnit.test('visibility toggles all controls and stays false when empty', function (assert) {
        dock = new OSD.ControlDock();
        const normal = document.createElement('span');
        const absolute = document.createElement('span');
        dock.addControl(normal, { anchor: OSD.ControlAnchor.TOP_LEFT });
        dock.addControl(absolute, {
            anchor: OSD.ControlAnchor.ABSOLUTE,
            top: 12, left: 8, width: 40, height: 20
        });
        const normalWrapper = dock.controls[0].wrapper;
        const absoluteWrapper = dock.controls[1].wrapper;

        assert.ok(dock.areControlsEnabled(), 'at least one visible control enables the dock');
        assert.strictEqual(dock.setControlsEnabled(false), dock, 'disable is chainable');
        assert.notOk(dock.areControlsEnabled(), 'all controls are hidden');
        assert.strictEqual(normalWrapper.style.display, 'none', 'normal control hidden');
        assert.strictEqual(absoluteWrapper.style.display, 'none', 'absolute control hidden');

        assert.strictEqual(dock.setControlsEnabled(true), dock, 'enable is chainable');
        assert.ok(dock.areControlsEnabled(), 'controls become visible again');
        assert.strictEqual(normalWrapper.style.display, 'inline-block', 'normal wrapper restored');
        assert.strictEqual(absoluteWrapper.style.display, 'block', 'absolute wrapper restored');

        assert.strictEqual(dock.clearControls(), dock, 'clear is chainable');
        assert.strictEqual(dock.controls.length, 0, 'clears registered controls');
        assert.notOk(dock.areControlsEnabled(), 'empty dock reports no visible controls');
        assert.strictEqual(dock.setControlsEnabled(true), dock, 'enabling an empty dock is harmless');
        assert.notOk(dock.areControlsEnabled(), 'empty dock stays disabled');
    });

    QUnit.test('absolute offsets and unanchored controls use the root container', function (assert) {
        dock = new OSD.ControlDock();
        const absolute = document.createElement('span');
        const unanchored = document.createElement('span');
        dock.addControl(absolute, {
            anchor: OSD.ControlAnchor.ABSOLUTE,
            top: 12, left: '15%', width: 40, height: 20
        });
        dock.addControl(unanchored, { anchor: OSD.ControlAnchor.NONE });

        const absoluteWrapper = dock.controls[0].wrapper;
        const unanchoredWrapper = dock.controls[1].wrapper;
        assert.strictEqual(absoluteWrapper.parentNode, dock.container, 'absolute wrapper uses root');
        assert.strictEqual(absoluteWrapper.style.position, 'absolute', 'absolute positioning');
        assert.strictEqual(absoluteWrapper.style.top, '12px', 'numeric top uses pixels');
        assert.strictEqual(absoluteWrapper.style.left, '15%', 'CSS percentage left preserved');
        assert.strictEqual(absoluteWrapper.style.width, '40px', 'numeric width uses pixels');
        assert.strictEqual(absoluteWrapper.style.height, '20px', 'numeric height uses pixels');
        assert.strictEqual(absolute.style.width, '100%', 'control fills absolute wrapper width');
        assert.strictEqual(absolute.style.height, '100%', 'control fills absolute wrapper height');
        assert.strictEqual(unanchoredWrapper.parentNode, dock.container, 'NONE wrapper uses root');
        assert.strictEqual(unanchoredWrapper.style.width, '100%', 'NONE wrapper fills root width');
        assert.strictEqual(unanchoredWrapper.style.height, '100%', 'NONE wrapper fills root height');
        assert.strictEqual(unanchored.style.margin, '0px', 'NONE control clears margin');
        assert.strictEqual(unanchored.style.padding, '0px', 'NONE control clears padding');
    });

    QUnit.test('attachToViewer false retains the control in its original parent', function (assert) {
        const originalParent = document.createElement('div');
        document.getElementById('qunit-fixture').appendChild(originalParent);
        const element = document.createElement('span');
        originalParent.appendChild(element);
        dock = new OSD.ControlDock();

        dock.addControl(element, {
            anchor: OSD.ControlAnchor.TOP_RIGHT,
            attachToViewer: false
        });

        assert.strictEqual(dock.controls.length, 1, 'control is still registered with the dock');
        assert.strictEqual(dock.controls[0].container, dock.controls.topright,
            'anchor is retained in the registered control');
        assert.strictEqual(dock.controls[0].wrapper.parentNode, originalParent,
            'wrapper stays with the original parent');
        assert.strictEqual(element.parentNode, dock.controls[0].wrapper,
            'element is inside the wrapper');
        assert.strictEqual(dock.controls.topright.children.length, 0,
            'the dock does not adopt the wrapper');
    });
})();
