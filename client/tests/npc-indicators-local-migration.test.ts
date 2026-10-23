import { strict as assert } from "node:assert";
import { ConfigManager } from "@runelite/client/config/ConfigManager";
import { inject } from "@runelite/client/plugins/PluginInjector";
import { NpcEcs } from "../game/ecs/NpcEcs";
import { NpcIndicatorsPlugin } from "../game/plugins/npcindicators/NpcIndicatorsPlugin";

// The earlier local plugin's settings become RuneLite's on first start (local install only).
async function main(): Promise<void> {
    const config = inject(ConfigManager);
    config.setConfiguration("npcindicators", "names", "Goblin|#00ff00\nMan, goblin|#ff0000\n\nGuard");
    config.setConfiguration("npcindicators", "color", "#123456");
    config.setConfiguration("npcindicators", "fill", "20");
    const plugin = new NpcIndicatorsPlugin({ gameState: 10, npcEcs: new NpcEcs(4) } as any);
    await plugin.start();
    assert.equal(config.getConfiguration("npcindicators", "npcToHighlight"), "Goblin,Man,Guard");
    assert.equal(config.getConfiguration("npcindicators", "npcColor"), "#123456");
    for (const old of ["names", "color", "fill"]) assert.ok(config.getConfiguration("npcindicators", old) == null, old);
    await plugin.stop();
}

main()
    .then(() => console.log("npc indicators local migration tests passed"))
    .catch((err) => {
        console.error(err);
        process.exit(1);
    });
