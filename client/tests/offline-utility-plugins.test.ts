import { strict as assert } from "node:assert";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ConfigManager } from "@runelite/client/config/ConfigManager";
import { PluginInjector, CLIENT_TOKEN } from "@runelite/client/plugins/PluginInjector";
import { ClientToolbar } from "@runelite/client/ui/ClientToolbar";
import { EventBus } from "@runelite/client/eventbus/EventBus";
import { GameTick } from "@runelite/api/events";
import { TileHighlightManager } from "../game/highlights/TileHighlightManager";
import { NPCIndicatorsPlugin, NPCIndicatorsConfig } from "../game/plugins/npcindicators/NPCIndicatorsPlugin";
import { XPTrackerPlugin, XPTrackerConfig, XPSession } from "../game/plugins/xptracker/XPTrackerPlugin";
import { XPTrackerPanel } from "../game/plugins/xptracker/XPTrackerPanel";

async function main() {
    const config = new ConfigManager(undefined);
    const toolbar = new ClientToolbar();
    let xp = 1000;
    let transformed: any = { name: "Goblin" };
    const client: any = {
        gameState: 30, loginState: { username: "Alice" }, controlledPlayerServerId: 1,
        playerEcs: { getIndexForServerId: () => 0, getLevel: () => 0, getName: () => "Alice" },
        cs2Vm: { context: { getStatXp: () => xp } },
        tileHighlightManager: new TileHighlightManager(),
        npcEcs: { getAllActiveIds: () => [1], getLevel: () => 0, getNpcTypeId: () => 7,
            getWorldX: () => 3200 * 128, getWorldY: () => 3201 * 128 },
        npcTypeLoader: { load: () => ({ transforms: [1], transform: () => transformed }) },
        varManager: {}, widgetManager: { getWidgetsForGroup: () => [], isEffectivelyHidden: () => false, getInterfaceParentContainerUid: () => 1 },
    };
    const injector = new PluginInjector(config).provide(ConfigManager, config).provide(ClientToolbar, toolbar).provide(CLIENT_TOKEN, client);
    const npc = injector.runWith(() => new NPCIndicatorsPlugin());
    config.setConfigValue(NPCIndicatorsConfig, "names", "Goblin|#00ff00\nMan");
    await npc.start(); npc.onGameTick();
    assert.equal(client.tileHighlightManager.getRenderEntries().length, 1);
    assert.equal(client.tileHighlightManager.getRenderEntries()[0].colorRgb, 0x00ff00);
    client.tileHighlightManager.configure(4, 0x123456, 1, 50, 0);
    client.tileHighlightManager.set((3200 << 14) | 3200, 4, 0);
    const bus = new EventBus(); bus.register(npc); bus.post(new GameTick());
    assert.equal(client.tileHighlightManager.getRenderEntries().length, 2, "event bus invokes tick and preserves another owner's tile");
    client.tileHighlightManager.clear(4);
    transformed = null; npc.onGameTick();
    assert.equal(client.tileHighlightManager.getRenderEntries().length, 0, "null transformed NPC is invisible");
    transformed = { name: "Man" }; npc.onGameTick();
    assert.equal(client.tileHighlightManager.getRenderEntries().length, 1);
    client.playerEcs.getLevel = () => 1; npc.onGameTick();
    assert.equal(client.tileHighlightManager.getRenderEntries().length, 0, "other plane is excluded");
    client.playerEcs.getLevel = () => 0; npc.onGameTick(); await npc.stop();
    assert.equal(client.tileHighlightManager.getRenderEntries().length, 0, "disable removes owned markers");


    const session = new XPSession();
    session.update("alice", [1000], 0); session.update("alice", [1100], 3600000);
    assert.equal(session.rows(3600000)[0].gained, 100);
    assert.equal(session.rows(3600000)[0].perHour, 100);
    session.pause(3600000); session.resume(7200000); session.update("alice", [1200], 10800000);
    assert.equal(session.rows(10800000)[0].perHour, 100, "offline time excluded");
    session.update("bob", [50000], 11000000);
    assert.equal(session.rows(11000000).length, 0, "account switch establishes fresh baseline");
    session.update("bob", [49900], 11000100);
    assert.equal(session.rows(11000100).length, 0, "XP rollback rebases skill");
    session.update("bob", [50000], 11001100); session.reset(0, 11001100);
    assert.equal(session.rows(11001100).length, 0);
    let now = 0;
    const tracker = injector.runWith(() => new XPTrackerPlugin(undefined, () => now));
    await tracker.start(); tracker.onGameTick(); xp += 50; now = 3600000; tracker.onGameTick();
    assert.equal(tracker.getState().rows[0].gained, 50);
    assert.equal(toolbar.getNavigations().length, 1);
    assert.match(renderToStaticMarkup(React.createElement(XPTrackerPanel, { plugin: tracker })), /Attack/);
    assert.match(renderToStaticMarkup(React.createElement(XPTrackerPanel, { plugin: tracker })), /Reset/);
    client.gameState = 10; tracker.onGameStateChanged();
    now = 7200000; client.gameState = 30; tracker.onGameStateChanged();
    xp += 500; tracker.onGameTick();
    assert.equal(tracker.getState().rows[0].gained, 50, "relogin snapshot after state event is a baseline");
    now += 3600000; xp += 50; tracker.onGameTick();
    assert.equal(tracker.getState().rows[0].perHour, 50, "offline time is excluded by plugin lifecycle");
    config.setConfigValue(XPTrackerConfig, "resetOnLogout", true);
    client.gameState = 25; tracker.onGameStateChanged();
    client.gameState = 30; tracker.onGameTick();
    assert.equal(tracker.getState().rows[0].gained, 100, "region load keeps session even when reset on logout enabled");
    client.gameState = 10; tracker.onGameStateChanged();
    assert.equal(tracker.getState().rows.length, 0, "explicit reset on logout preference");
    await tracker.stop(); assert.equal(toolbar.getNavigations().length, 0);
    console.log("offline utility plugins tests passed");
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
