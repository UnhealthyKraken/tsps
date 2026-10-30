"use strict";

const Progress=require('./seasonal/Progress.ChristmasDinner');
const Dialogue=require('./seasonal/Dialogue.ChristmasDinner');

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
    api.onCustomEvent('events:active',Dialogue.activate);
    api.onNpcDialogueCondition(Dialogue.condition.bind(null,api));
    api.onCustomEvent('npc-dialogue:line',Dialogue.line.bind(null,api));
    api.onCustomEvent('npc-dialogue:action',Dialogue.action.bind(null,api));
    api.onCanBankItem(canBank.bind(null,api));
    api.onPlayerLogout(Dialogue.clear);
    api.onPlayerDisconnect(Dialogue.clear);
  },
};
