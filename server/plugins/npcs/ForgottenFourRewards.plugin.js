const { validKey, record } = require('./OrderedRewards.NpcDrops');
const STATE_ATTRIBUTE = 'forgotten-four:loot-state';
function snapshot(event) {
    if (event.domain !== 'forgotten_four' || !validKey(event.tableId))
        return;
    const saved = event.player?.getAttribute?.(STATE_ATTRIBUTE);
    const all = saved === undefined ? {} : saved;
    if (!record(all))
        throw new Error('Invalid saved Forgotten Four reward state');
    event.state = Object.hasOwn(all, event.tableId) ? all[event.tableId] : {};
    event.handled = true;
}
function commit(event) {
    if (event.domain !== 'forgotten_four' || !validKey(event.tableId) || !record(event.state) || typeof event.player?.setAttribute !== 'function')
        return;
    const saved = event.player.getAttribute(STATE_ATTRIBUTE);
    const all = saved === undefined ? {} : saved;
    if (!record(all))
        throw new Error('Invalid saved Forgotten Four reward state');
    event.player.setAttribute(STATE_ATTRIBUTE, { ...all, [event.tableId]: { ...event.state } });
    event.committed = true;
}
module.exports = { name: 'ForgottenFourRewards', members: true, STATE_ATTRIBUTE, register(api) {
        api.persistAttribute(STATE_ATTRIBUTE, {});
        api.onCustomEvent('npc-drops:reward-state', snapshot);
        api.onCustomEvent('npc-drops:reward-state-commit', commit);
    } };
