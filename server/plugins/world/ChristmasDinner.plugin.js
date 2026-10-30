"use strict";

const Progress=require('./seasonal/Progress.ChristmasDinner');
const Dialogue=require('./seasonal/Dialogue.ChristmasDinner');
const Scene=require('./seasonal/Scene.ChristmasDinner');

function calendar(api,event){
  if(event.key!=='christmas-2025')return;
  if(!event.active)Dialogue.activate(event);
  const result=event.active?Scene.open(api):Scene.close(api);
  if(result.handled){if(event.active)Dialogue.activate(event);}
  else {Dialogue.activate({key:event.key,active:false});api.log('Christmas scene: '+result.error);}
}
function shutdown(api){calendar(api,{key:'christmas-2025',active:false});}
function regionLoaded(api,event){
  const result=Scene.replay(api,event);
  if(!result.handled){Dialogue.activate({key:'christmas-2025',active:false});api.log('Christmas scene: '+result.error);}
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
    api.onCustomEvent('events:active',calendar.bind(null,api));
    api.onServerShutdown(shutdown.bind(null,api));
    api.onRegionLoaded(regionLoaded.bind(null,api));
    api.onNpcDialogueCondition(Dialogue.condition.bind(null,api));
    api.onCustomEvent('npc-dialogue:line',Dialogue.line.bind(null,api));
    api.onCustomEvent('npc-dialogue:action',Dialogue.action.bind(null,api));
    api.onCanBankItem(canBank.bind(null,api));
    api.onPlayerLogout(Dialogue.clear);
    api.onPlayerDisconnect(Dialogue.clear);
  },
};
