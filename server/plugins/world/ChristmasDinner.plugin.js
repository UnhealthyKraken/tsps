"use strict";

const Progress=require('./seasonal/Progress.ChristmasDinner');
const Dialogue=require('./seasonal/Dialogue.ChristmasDinner');
const Scene=require('./seasonal/Scene.ChristmasDinner');
const Items=require('./seasonal/Items.ChristmasDinner');
const Npcs=require('./seasonal/Npcs.ChristmasDinner');
const Sync=require('./seasonal/Sync.ChristmasDinner');
const Objects=require('./seasonal/Objects.ChristmasDinner');

function calendar(api,event){
  if(event.key!=='christmas-2025')return;
  if(!event.active){Dialogue.activate(event);Dialogue.cancelAll(api);}
  const result=event.active?Scene.open(api):Scene.close(api);
  if(result.handled){if(event.active)Dialogue.activate(event);}
  else {Dialogue.activate({key:event.key,active:false});Dialogue.cancelAll(api);api.log('Christmas scene: '+result.error);}
  Sync.all(api);
}
function shutdown(api){calendar(api,{key:'christmas-2025',active:false});}
function regionLoaded(api,event){
  const result=Scene.replay(api,event);
  if(!result.handled){Dialogue.activate({key:'christmas-2025',active:false});Dialogue.cancelAll(api);Sync.all(api);api.log('Christmas scene: '+result.error);}
}

function canBank(api,event){
  const platter=Progress.platterId(api);
  if(platter===null||event.item?.getId()!==platter)return;
  event.allow=false;
  // The Wiki establishes that the tool is unbankable, without recording the
  // rejection wording. This explanatory message is not capture evidence.
  event.player.sendMessage("You can't bank the serving platter.");
}

module.exports={
  name:'ChristmasDinner',
  register(api){
    api.persistAttribute(Progress.PROGRESS_ATTRIBUTE,Progress.initial());
    api.onPlayerLogin(Sync.refresh.bind(null,api));
    api.onCustomEvent('christmas-dinner:changed',Sync.refresh.bind(null,api));
    api.onCustomEvent('events:active',calendar.bind(null,api));
    api.onServerShutdown(shutdown.bind(null,api));
    api.onRegionLoaded(regionLoaded.bind(null,api));
    api.onNpcDialogueCondition(Dialogue.condition.bind(null,api));
    api.onBeforeNpcInteraction(Npcs.interact.bind(null,api));
    api.onObjectInteraction('Bar',{'Get Drink From':Objects.drink.bind(null,api)});
    api.onObjectInteraction('Crate',{Search:Objects.search.bind(null,api)});
    api.onCustomEvent('npc-dialogue:line',Dialogue.line.bind(null,api));
    api.onCustomEvent('npc-dialogue:choice',Dialogue.choice.bind(null,api));
    api.onCustomEvent('npc-dialogue:action',Dialogue.action.bind(null,api));
    api.onCanBankItem(canBank.bind(null,api));
    api.onItemAction('Serving platter',{Inspect:Items.inspect.bind(null,api)});
    api.onCustomEvent('destroy-item:prompt',Items.destroyPrompt.bind(null,api));
    api.onCustomEvent('item:discarded',Progress.discard.bind(null,api));
    api.onPlayerLogout(Dialogue.clear);
    api.onPlayerDisconnect(Dialogue.clear);
  },
};
