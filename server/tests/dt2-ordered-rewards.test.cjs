const assert = require('node:assert/strict');
const { test } = require('node:test');
const R = require('../plugins/npcs/OrderedRewards.NpcDrops');
const P = require('../plugins/npcs/ForgottenFourRewards.plugin');
function fixture() {
    const handlers = new Map(), attrs = new Map();
    const player = { getAttribute: k => attrs.get(k), setAttribute: (k, v) => attrs.set(k, v) };
    const api = { persistAttribute() { }, onCustomEvent: (k, f) => handlers.set(k, f), emitCustomEvent: (k, v) => handlers.get(k)?.(v) };
    P.register(api);
    const chain = { type: 'ordered_exclusive', state_domain: 'forgotten_four', stages: [{ key: 'unique', weight: 1, out_of: 2, main_max_roll: 1, entries: [{ item_id: 99, quantity: [1, 1], weight: 1, progression: { type: 'cyclic_hits', state_key: 'vestige:99', hits: 3, intermediate_item_id: 1635, intermediate_quantities: [1, 2] } }] }, { key: 'tablet', weight: 1, out_of: 2, main_max_roll: 1, entries: [{ item_id: 100, weight: 1 }], eligibility: { type: 'until_first_received', state_key: 'first:100' }, record_first_received: { state_key: 'first:100' } }] };
    const roll = (values = [0, 0], id = 'boss') => {
        const result = R.select({ table_id: id, reward_chain: chain }, player, api, () => values.shift() ?? .99);
        result.commit?.();
        return result;
    };
    return { roll, attrs, player, api, chain };
}
test('three unique hits award ring1/ring2/vestige/reset', () => {
    const f = fixture();
    assert.equal(f.roll().entry.item_id, 1635);
    assert.deepEqual(f.roll().entry.quantity, [2, 2]);
    assert.equal(f.roll().entry.item_id, 99);
    assert.equal(f.roll().entry.item_id, 1635);
});
test('table isolation and provider reload retain progress', () => {
    const f = fixture();
    f.roll();
    assert.deepEqual(f.roll([0, 0], 'other').entry.quantity, [1, 1]);
    P.register(f.api);
    assert.deepEqual(f.roll().entry.quantity, [2, 2]);
});
test('tablet first-only and main fallback', () => {
    const f = fixture();
    assert.equal(f.roll([.99, 0, 0]).entry.item_id, 100);
    assert.equal(f.roll([.99, 0]).entry, null);
    assert.equal(f.roll([.99, .99]).entry, null);
});
test('missing and corrupt provider fail closed', () => {
    const f = fixture();
    assert.throws(() => R.select({ table_id: 'boss', reward_chain: f.chain }, f.player, { emitCustomEvent() { } }, () => 0), /state provider/);
    f.attrs.set(P.STATE_ATTRIBUTE, { boss: { 'vestige:99': 99 } });
    assert.throws(() => f.roll(), /state/);
});
test('exclusive adjusted clue intervals', () => {
    const rows = [{ name: 'easy', weight: 1, out_of: 160 }, { name: 'elite', weight: 1, out_of: 160 }];
    assert.equal(R.group(rows, () => 2, () => 0), rows[0]);
    assert.equal(R.group(rows, () => 2, () => .015), rows[1]);
    assert.equal(R.group(rows, () => 2, () => .99), null);
});
const { before } = require('node:test');
const H = require('./helpers/duke-sucellus.cjs');
const Drops = require('../plugins/npcs/NpcDrops.plugin');
const dump = require('../data/definitions/npc-drops.json');
before(H.initialize);
for (const id of ['duke_sucellus', 'the_leviathan', 'the_whisperer', 'vardorvis'])
    test(`${id} actual roller has one unique outcome per kill and retained independent pet`, t => {
        const h = H.harness(t);
        h.api.getItemOnGroundManager = () => ({});
        P.register(h.api);
        Drops.register(h.api);
        t.mock.method(Math, 'random', () => 0);
        const rows = Drops.__internals.rollTable(dump.tables[id], h.p, null);
        const pool = dump.tables[id].reward_chain.stages[0].entries;
        const ids = new Set(pool.map(e => e.item_id));
        ids.add(1635);
        assert.equal(rows.filter(r => ids.has(r.itemId)).length, 1);
        assert.equal(rows.find(r => r.itemId === 1635).amount, 1);
        assert.equal(rows.filter(r => dump.tables[id].entries.some(e => e.item_id === r.itemId)).length, 0);
        assert.equal(rows.filter(r => dump.tables[id].tertiary_groups[0].entries.some(e => e.item_id === r.itemId)).length, 1);
        const pet = dump.tables[id].tertiary.find(entry => /pet|butch|lil'|wisp|baron/i.test(entry.name));
        assert.ok(pet, 'canonical pet row');
        assert.ok(rows.some(row => row.itemId === pet.item_id), 'pet survives unique outcome');
    });
test('actual roller preserves perfect quantities after all chain accesses fail', t => {
    const h = H.harness(t);
    h.api.getItemOnGroundManager = () => ({});
    P.register(h.api);
    Drops.register(h.api);
    h.api.onCustomEvent('npc-drops:context', e => {
        e.context.perfectKill = true;
    });
    let call = 0;
    t.mock.method(Math, 'random', () => call++ < 5 ? .99 : .005);
    const rows = Drops.__internals.rollTable(dump.tables.duke_sucellus, h.p, null);
    assert.equal(rows.find(r => r.itemId === 1103).amount, 17);
});
test('actual roller delivers all source supply bundle members without main loot', t => {
    const h = H.harness(t);
    h.api.getItemOnGroundManager = () => ({});
    P.register(h.api);
    Drops.register(h.api);
    let call = 0;
    t.mock.method(Math, 'random', () => call++ < 4 ? .99 : 0);
    const rows = Drops.__internals.rollTable(dump.tables.duke_sucellus, h.p, null);
    const supply = dump.tables.duke_sucellus.reward_chain.stages[4].entries[0];
    for (const e of [supply, ...supply.bonus_drops])
        assert.ok(rows.some(r => r.itemId === e.item_id));
    assert.ok(!rows.some(r => dump.tables.duke_sucellus.entries.some(e => e.item_id === r.itemId)));
});
test('failed actual outcome leaves progress unchanged', t => {
    const h = H.harness(t);
    h.api.getItemOnGroundManager = () => ({});
    P.register(h.api);
    Drops.register(h.api);
    t.mock.method(Math, 'random', () => 0);
    const table = { ...dump.tables.duke_sucellus, tertiary_groups: [{ type: 'unsupported' }] };
    assert.throws(() => Drops.__internals.rollTable(table, h.p, null), /Unsupported tertiary/);
    assert.equal(h.p.getAttribute(P.STATE_ATTRIBUTE), undefined);
});
test('null saved state fails closed instead of resetting progress', () => {
    const f = fixture();
    f.attrs.set(P.STATE_ATTRIBUTE, null);
    assert.throws(() => f.roll(), /Invalid saved/);
});
test('a rejected persistence commit never returns a reward', () => {
    const f = fixture();
    f.api.emitCustomEvent = (name, event) => {
        if (name === 'npc-drops:reward-state') {
            event.state = {};
            event.handled = true;
        }
    };
    assert.throws(() => f.roll(), /commit rejected/);
    assert.equal(f.attrs.has(P.STATE_ATTRIBUTE), false);
});
for (const id of ['duke_sucellus', 'the_leviathan', 'the_whisperer', 'vardorvis']) {
    test(`${id} every conditional resource slot yields main loot`, t => {
        const h = H.harness(t);
        h.api.getItemOnGroundManager = () => ({});
        P.register(h.api);
        Drops.register(h.api);
        const table = dump.tables[id];
        let call = 0, slot = 0;
        t.mock.method(Math, 'random', () => call++ < 5 ? .99 : call === 6 ? (slot + .5) / table.main_max_roll : .99);
        for (slot = 0; slot < table.main_max_roll; slot++) {
            call = 0;
            const rows = Drops.__internals.rollTable(table, h.p, null);
            assert.equal(rows.filter(row => table.entries.some(entry => entry.item_id === row.itemId)).length, 1, `resource slot ${slot}`);
        }
    });
}
for (const id of ['duke_sucellus', 'the_leviathan', 'the_whisperer', 'vardorvis']) {
    test(`${id} actual tablet receipt persists and quartz remains repeatable at documented base`, t => {
        const h = H.harness(t);
        h.api.getItemOnGroundManager = () => ({});
        P.register(h.api);
        Drops.register(h.api);
        const table = dump.tables[id], tablet = table.reward_chain.stages[2], quartz = table.reward_chain.stages[3];
        let values = [.99, .99, 0, 0];
        t.mock.method(Math, 'random', () => values.shift() ?? .99);
        assert.ok(Drops.__internals.rollTable(table, h.p, null).some(row => row.itemId === tablet.entries[0].item_id));
        assert.equal(h.p.getAttribute(P.STATE_ATTRIBUTE)[id][tablet.record_first_received.state_key], true);
        for (let kill = 0; kill < 2; kill++) {
            values = [.99, .99, 0, 0]; // Tablet is skipped; next access is quartz.
            const rows = Drops.__internals.rollTable(table, h.p, null);
            assert.ok(!rows.some(row => row.itemId === tablet.entries[0].item_id));
            assert.ok(rows.some(row => row.itemId === quartz.entries[0].item_id));
            assert.equal(h.p.getAttribute(P.STATE_ATTRIBUTE)[id][quartz.record_first_received.state_key], true);
        }
    });
}
for (const id of ['duke_sucellus', 'the_leviathan', 'the_whisperer', 'vardorvis']) {
    test(`${id} quartz endpoint is active at 300 until first receipt and retained after reload`, t => {
        const h = H.harness(t);
        h.api.getItemOnGroundManager = () => ({});
        let count = 299;
        h.api.onCustomEvent('combat-achievements:count', event => { assert.equal(event.monster, dump.tables[id].wiki_page); event.total = count; });
        P.register(h.api);
        Drops.register(h.api);
        const table = dump.tables[id], quartz = table.reward_chain.stages[3];
        let values;
        t.mock.method(Math, 'random', () => values.shift() ?? .99);
        const roll = () => { values = [.99, .99, .99, .01, 0]; return Drops.__internals.rollTable(table, h.p, null); };
        assert.ok(!roll().some(row => row.itemId === quartz.entries[0].item_id));
        count = 300;
        assert.ok(roll().some(row => row.itemId === quartz.entries[0].item_id));
        h.p.setAttribute(P.STATE_ATTRIBUTE, JSON.parse(JSON.stringify(h.p.getAttribute(P.STATE_ATTRIBUTE))));
        assert.ok(!roll().some(row => row.itemId === quartz.entries[0].item_id));
    });
}
