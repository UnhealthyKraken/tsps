// Guards on the imported drop data: a regenerated import that loses the paired
// supply bundles, the Mimic reward path, the God Wars rare drop tables, or the
// hand-verified tables fails here instead of silently changing loot.
// Run after `yarn build`: node --test tests/drop-import-preservation.test.cjs
const assert = require('node:assert/strict');
const { test } = require('node:test');
const { Server } = require('../dist/Server');
Server.installProductionPathResolver();
const { _test: drops } = require('../plugins/npcs/NpcDrops.plugin');
const { isWearingRingOfWealth } = require('../plugins/items/RingOfWealth.plugin');
const dump = require('../data/definitions/npc-drops.json');
const subtables = require('../data/definitions/npc-drop-subtables.json');
const rewards = require('../plugins/bosses/data/reward-tables.json');
const State = require('../plugins/bosses/mimic/State.Mimic');
const Reward = require('../plugins/bosses/mimic/Reward.Mimic');

const all = () => Object.values(dump.tables).flatMap(t => [...(t.entries || []), ...(t.tertiary || [])]);

function pairs(table) {
    return (table.entries || [])
        .flatMap(e => (e.bonus_drops || []).map(b => [e.item_id, b.item_id]))
        .sort((a, b) => a[0] - b[0] || a[1] - b[1]);
}

function usedSlots(table) {
    return (table.entries || [])
        .filter(e => (e.out_of === table.main_max_roll || e.shared_table) && !e.always && !e.separate_roll && !e.pre_roll)
        .reduce((sum, e) => sum + (e.weight || 0), 0);
}

test('Nex keeps her two paired supply slots in a 12-slot pool', () => {
    const nex = dump.tables.nex;
    assert.deepEqual(pairs(nex), [[385, 2434], [6685, 3024]]);
    assert.equal(nex.main_max_roll, 12);
    assert.equal(usedSlots(nex), 12);
    assert.ok(!nex.entries.some(e => e.item_id === 2434 || e.item_id === 3024));
});

const BUNDLED = [
    // LCM(127,381,508,762) includes exact unique fractions in the same exclusive pool.
    ['commander_zilyana', [[163, 3042], [6687, 3024]], 1524, 1524],
    ['kril_tsutsaroth', [[145, 157], [3026, 189]], 1524, 1524],
    ['kreearra', [[169, 163]], 1524, 1524],
    ['general_graardor', [], 1524, 1524],
    ['ammonite_crab', [[21543, 21545]], 128, 128],
    ['chaos_fanatic', [[1035, 1033]], 133, 133],
    ['ancient_zygomite', [[21545, 21543]], 118, 89],
    ['scavenger_beast', [], 18, 18],
];
for (const [id, expected, maxRoll, used] of BUNDLED) {
    test(`${id} keeps its source pairs and pool (${maxRoll}, ${used} used)`, () => {
        const table = dump.tables[id];
        assert.ok(table, id);
        assert.deepEqual(pairs(table), expected);
        assert.equal(table.main_max_roll, maxRoll);
        assert.equal(usedSlots(table), used);
        const partners = new Set(expected.map(([, partner]) => partner));
        assert.ok(!table.entries.some(e => partners.has(e.item_id)));
    });
}

const GWD_BOSSES = ['commander_zilyana', 'kril_tsutsaroth', 'kreearra', 'general_graardor'];
const GWD_TABLES = ['gwdRareDrop', 'gwdGem', 'gwdMegaRare'];

test('the God Wars bosses roll their own rare drop and gem tables, not the regular ones', () => {
    for (const id of GWD_BOSSES) {
        const shared = dump.tables[id].entries
            .filter(e => e.shared_table)
            .map(e => [e.shared_table, e.weight, e.out_of]);
        assert.deepEqual(shared, [['gwdRareDrop', 96, 1524], ['gwdGem', 24, 1524]], id);
    }
});

test('the God Wars exact coin remainders exclude variant-table contributions without rounding uniques', () => {
    // The published coin rate also counts the variant tables' coins, which those tables roll.
    const REMAINDER = {
        commander_zilyana: [330, '31.2/127'],
        kril_tsutsaroth: [396, '36.7/127'],
        kreearra: [480, '43.7/127'],
        general_graardor: [336, '31.7/127'],
    };
    for (const id of GWD_BOSSES) {
        const [weight, published] = REMAINDER[id];
        const filled = dump.tables[id].entries.filter(e => e.weight_basis === 'remainder');
        assert.deepEqual(filled.map(e => [e.item_id, e.weight, e.out_of, e.published_rarity]),
            [[995, weight, 1524, published]], id);
    }
    const others = Object.entries(dump.tables)
        .filter(([id, table]) => !GWD_BOSSES.includes(id) && table.entries.some(e => e.weight_basis === 'remainder'));
    assert.deepEqual(others, []);
});

test('the God Wars variant tables load whole and every slot lands, ring of wealth or not', (t) => {
    drops.loadDrops();
    const { rollSharedTable } = require('../plugins/npcs/NpcDrops.plugin').__internals;
    const plain = { getEquipment: () => ({ get: () => null }) };
    const wealthy = { getEquipment: () => ({ get: () => ({ getId: () => 11980 }) }) };
    assert.ok(isWearingRingOfWealth(wealthy));
    let value = 0;
    t.mock.method(Math, 'random', () => value);
    for (const key of GWD_TABLES) {
        const rows = drops.sharedTables.get(key);
        assert.ok(rows, key);
        assert.equal(rows.length, subtables[key].entries.length, `${key} lost rows on load`);
        assert.equal(rows.reduce((sum, row) => sum + row.weight, 0), 128, key);
        assert.ok(rows.every(row => row.outOf === 128 && !row.nothing), key);
        for (let slot = 0; slot < 128; slot++) {
            value = (slot + 0.5) / 128;
            const drop = rollSharedTable(key, plain);
            assert.equal(drop.length, 1, `${key} slot ${slot}`);
            assert.deepEqual(rollSharedTable(key, wealthy), drop, `${key} slot ${slot} with a ring of wealth`);
        }
    }
});

test('the Scavenger beast secondary ingredients stay three slots of 2/18', () => {
    const rows = dump.tables.scavenger_beast.entries.filter(e => e.weight === 2 && e.out_of === 18);
    assert.ok(rows.length >= 3);
    assert.ok(rows.every(e => !e.bonus_drops));
});

test('the Bandit champion keeps both blackjack-conditional rows', () => {
    const rows = dump.tables.bandit_champion.entries;
    assert.equal(rows.length, 3);
    const blackjack = rows.find(e => e.item_id === 4600);
    const scimitar = rows.find(e => e.item_id === 1331);
    assert.ok(blackjack.notes.some(n => /does not have a willow blackjack/i.test(n)));
    assert.ok(scimitar.notes.some(n => /already has a willow blackjack/i.test(n)));
});

test('the Thermonuclear smoke devil keeps the occult necklace at 1/350', () => {
    const necklace = dump.tables.thermonuclear_smoke_devil.entries.find(e => e.item_id === 12002);
    assert.deepEqual([necklace.weight, necklace.out_of], [1, 350]);
});

test('Mimic rewards come from complete elite and master tables, not the NPC table', () => {
    // These five rows scale with failed attempts; losing their per-attempt quantities
    // would silently pay a flat amount, so the set is pinned, not just checked if present.
    const PER_ATTEMPT = ['Blood rune', 'Death rune', 'Grimy ranarr weed', 'Raw manta ray', 'Wine of Zamorak'];
    for (const tier of ['elite', 'master']) {
        const table = rewards.tables[`the_mimic_${tier}`];
        assert.equal(table.entries.length, 31, tier);
        const scaled = table.entries.filter(row => row.quantity_options);
        assert.deepEqual(scaled.map(row => row.name).sort(), PER_ATTEMPT, `${tier} per-attempt rows`);
        for (const row of scaled) {
            assert.equal(row.quantity_options.length, State.ATTEMPTS[tier], `${tier} ${row.name}`);
        }
    }
    const registered = [];
    Reward.attach({
        persistAttribute() {},
        onItemAction() {},
        onCustomEvent: name => registered.push(name),
    });
    assert.ok(registered.includes('npc-drops:generated'), 'Reward.Mimic takes over the Mimic kill\'s drops');
});

test('every quantity resolves and exactly the known alternative rows carry conditions', () => {
    const rows = all();
    assert.equal(rows.filter(e => e.quantity_raw !== undefined && e.quantity === undefined).length, 0);
    const bonus = rows.flatMap(e => e.bonus_drops || []);
    assert.equal(bonus.filter(b => b.quantity === undefined).length, 0);
    const alternatives = rows.filter(e => e.quantity_alternatives);
    assert.equal(alternatives.length, 116);
    const byType = {};
    for (const e of alternatives) {
        const type = e.quantity_selection === 'unknown' ? 'unknown' : e.quantity_alternatives[1].condition.type;
        byType[type] = (byType[type] || 0) + 1;
    }
    assert.deepEqual(byType, { perfect_kill: 99, bounty_task: 2, preferred_method: 3, unknown: 12 });
    assert.ok(alternatives.every(e => e.quantity_selection !== 'conditional' ||
        e.quantity_alternatives.slice(1).every(a => a.condition && a.condition.type)));
});

test('the import keeps its table and mapping counts', () => {
    assert.equal(Object.keys(dump.tables).length, 1112);
    assert.equal(Object.keys(dump.npcs).length, 3092);
    for (const id of [8058, 8060, 13686]) assert.deepEqual(dump.npcs[id].tables, [], `quest-only NPC ${id}`);
});

test('God Wars uniques share one outcome with main loot rather than rolling independently', t => {
    const roller = require('../plugins/npcs/NpcDrops.plugin').__internals;
    roller.loadDrops(); t.mock.method(Math, 'random', () => 0);
    for (const id of GWD_BOSSES) {
        const table = dump.tables[id];
        assert.ok(!table.entries.some(entry => entry.separate_roll || entry.pre_roll), id);
        const npc = Object.values(dump.npcs).find(npc => npc.tables.includes(id));
        const loaded = roller.tablesByNpc.get(npc.npc_id).find(table => table.table_id === id);
        const mainOnly = { ...loaded, entries: loaded.entries.filter(entry => !entry.always), tertiary: [] };
        const rolled = roller.rollTable(mainOnly, {}, null);
        assert.equal(rolled.length, 1, `${id}: one unique, no extra main or unique`);
        assert.equal(rolled[0].itemId, mainOnly.entries[0].item_id);
    }
});
