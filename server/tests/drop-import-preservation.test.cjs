// Guards on the imported drop data: a regenerated import that loses the paired
// supply bundles, the Mimic reward path, or the hand-verified tables fails here
// instead of silently changing loot.
const assert = require('node:assert/strict');
const { test } = require('node:test');
const dump = require('../data/definitions/npc-drops.json');
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
    ['commander_zilyana', [[163, 3042], [6687, 3024]], 127, 119],
    ['kril_tsutsaroth', [[145, 157], [3026, 189]], 127, 120],
    ['kreearra', [[169, 163]], 127, 119],
    ['general_graardor', [], 127, 119],
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
    assert.equal(Object.keys(dump.npcs).length, 3089);
});
