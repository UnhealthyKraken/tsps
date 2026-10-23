const assert = require('node:assert/strict');
const { test } = require('node:test');
const { Server } = require('../dist/Server');
Server.installProductionPathResolver();
const plugin = require('../plugins/npcs/NpcDrops.plugin');
const { __internals } = plugin;
const dump = require('../data/definitions/npc-drops.json');

const player = { getEquipment: () => ({ get: () => null, getItems: () => [] }) };

function entryOf(tableId, name, extra = {}) {
    const table = dump.tables[tableId];
    assert.ok(table, `table ${tableId}`);
    const entry = [...(table.entries || []), ...(table.tertiary || [])]
        .find(e => e.name === name && e.quantity_alternatives);
    assert.ok(entry, `${tableId} ${name}`);
    return { ...entry, always: true, ...extra };
}

function demonAshes() {
    const table = Object.values(dump.tables).find(t => t.wiki_page === 'Lesser demon' &&
        (t.entries || []).some(e => e.name === 'Vile ashes' && e.quantity_alternatives));
    assert.ok(table, 'Lesser demon ashes table');
    return { ...table.entries.find(e => e.name === 'Vile ashes' && e.quantity_alternatives), always: true };
}

/** Rolls one always-entry with a fixed Math.random sequence and returns the drops. */
function roll(t, entry, context, randoms = [0]) {
    let i = 0;
    t.mock.method(Math, 'random', () => randoms[Math.min(i++, randoms.length - 1)]);
    return __internals.rollTable({ entries: [entry] }, player, null, context);
}

test('a Desert Treasure II row awards its first-listed quantity without perfect-kill context', t => {
    const coal = entryOf('vardorvis', 'Coal');
    assert.deepEqual(coal.quantity, [130, 130]);
    assert.equal(coal.quantity_selection, 'conditional');
    assert.equal(roll(t, coal, { perfectKill: false })[0].amount, 130);
    assert.equal(roll(t, coal, undefined, [0.999999])[0].amount, 130, 'a top roll stays on the base amount');
});

test('a Desert Treasure II row awards the perfect-kill quantity when the context says so', t => {
    const coal = entryOf('vardorvis', 'Coal');
    assert.equal(roll(t, coal, { perfectKill: true })[0].amount, 195);
});

test('a bounty quantity applies only for the matching bounty task', t => {
    const nails = entryOf('narwhal', 'Dragon nails');
    assert.equal(roll(t, nails, { bountyTask: null })[0].amount, 3);
    assert.equal(roll(t, nails, { bountyTask: null }, [0.999999])[0].amount, 7);
    assert.equal(roll(t, nails, { bountyTask: 'orca' })[0].amount, 3, 'another monster\'s task does not count');
    assert.equal(roll(t, nails, { bountyTask: 'Narwhal' })[0].amount, 5, 'case-insensitive monster match');
    assert.equal(roll(t, nails, { bountyTask: 'narwhal' }, [0.999999])[0].amount, 10);
});

test('demon ashes double only with the Chasm of Fire preferred-method context', t => {
    const ashes = demonAshes();
    assert.equal(roll(t, ashes, {})[0].amount, 1);
    assert.equal(roll(t, ashes, { preferredMethodLocation: 'Chasm of Fire' })[0].amount, 2);
    assert.equal(roll(t, ashes, { preferredMethodLocation: 'Wilderness' })[0].amount, 1);
});

test('rows with no published rule roll uniformly among their listed quantities', t => {
    const lure = entryOf('drake', 'Shark lure');
    assert.equal(lure.quantity_selection, 'unknown');
    assert.equal(roll(t, lure, {}, [0])[0].amount, 8);
    assert.equal(roll(t, lure, {}, [0.4])[0].amount, 10);
    assert.equal(roll(t, lure, {}, [0.8])[0].amount, 12);
    assert.equal(roll(t, lure, { perfectKill: true }, [0.4])[0].amount, 10, 'context does not change an unknown row');
});

test('an alternative row keeps its noted form', t => {
    const essence = entryOf('vardorvis', 'Pure essence');
    assert.equal(essence.noted, true);
    const drop = roll(t, essence, { perfectKill: true })[0];
    assert.deepEqual([drop.amount, drop.noted], [180, true]);
});

test('the kill context is offered to plugins through npc-drops:context', t => {
    const listeners = new Map();
    const seen = [];
    const api = {
        getItemOnGroundManager: () => ({ registerLocation() {} }),
        onCustomEvent: (name, fn) => listeners.set(name, fn),
        emitCustomEvent: (name, event) => { listeners.get(name)?.(event); },
        onNpcDeath() {},
        registerCommand() {},
        log() {},
    };
    plugin.register(api);
    listeners.set('npc-drops:context', event => {
        seen.push(event);
        event.context.perfectKill = true;
    });
    const npc = { getId: () => 12223, getLocation: () => null };
    let random = 0;
    t.mock.method(Math, 'random', () => random);
    const drops = __internals.rollTable({ entries: [entryOf('vardorvis', 'Coal')] }, player, npc);
    assert.equal(drops[0].amount, 195);
    assert.equal(seen.length, 1);
    assert.equal(seen[0].npcId, 12223);
    assert.equal(seen[0].npc, npc);
    assert.deepEqual(Object.keys(seen[0].context).sort(), ['bountyTask', 'perfectKill', 'preferredMethodLocation']);
});

test('Nex sharks and prayer potions arrive together, as do brews and restores', t => {
    const nex = dump.tables.nex;
    const shark = nex.entries.find(e => e.item_id === 385);
    const brew = nex.entries.find(e => e.item_id === 6685);
    assert.deepEqual(shark.bonus_drops.map(b => b.item_id), [2434]);
    assert.deepEqual(brew.bonus_drops.map(b => b.item_id), [3024]);
    assert.ok(!nex.entries.some(e => e.item_id === 2434 || e.item_id === 3024), 'partners are not slots of their own');
    const sharks = roll(t, { ...shark, always: true }, {});
    assert.deepEqual(sharks.map(d => [d.itemId, d.amount]), [[385, 10], [2434, 3]]);
    const brews = roll(t, { ...brew, always: true }, {}, [0.999999]);
    assert.deepEqual(brews.map(d => [d.itemId, d.amount]), [[6685, 10], [3024, 5]]);
});

test('Zilyana brews and restores arrive together', t => {
    const brew = dump.tables.commander_zilyana.entries.find(e => e.item_id === 6687);
    assert.deepEqual(brew.bonus_drops.map(b => b.item_id), [3024]);
    assert.deepEqual(roll(t, { ...brew, always: true }, {}).map(d => [d.itemId, d.amount]), [[6687, 3], [3024, 3]]);
});

test('loading reports the rows that roll on an assumed uniform distribution', () => {
    const stats = __internals.loadDrops();
    assert.equal(stats.assumedQuantityRows, 12);
});
