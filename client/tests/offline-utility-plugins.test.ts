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


    console.log("offline utility plugins tests passed");
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
