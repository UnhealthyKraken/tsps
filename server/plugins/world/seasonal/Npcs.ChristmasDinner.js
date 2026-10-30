"use strict";

const Progress=require('./Progress.ChristmasDinner');
const Dialogue=require('./Dialogue.ChristmasDinner');

function cookVariant(state,hasPlatter){
  if(state.phase==='new')return 'starting-the-event-talking-to-the-cook';
  if(state.phase==='complete')return 'completing-the-event-talking-to-the-cook-after-completing-the-event';
  if(!hasPlatter)return 'starting-the-event-talking-to-the-cook-after-losing-the-serving-tray';
  switch(state.phase){
    case 'queue':return state.customer===0?'starting-the-event-talking-to-the-cook-before-greeting-a-customer':'serving-the-customers-talking-to-the-cook-before-seating-another-customer';
    case 'table':return 'serving-the-customers-talking-to-the-cook-after-greeting-a-customer';
    case 'drink-order':return 'serving-the-customers-talking-to-the-cook-after-seating-a-customer';
    case 'drink':return 'serving-the-customers-talking-to-the-cook-after-taking-a-drink-order';
    case 'food-order':return 'serving-the-customers-talking-to-the-cook-before-taking-a-food-order';
    case 'ingredients':return state.gathered.length===4
      ?(state.customer===0?'serving-the-customers-talking-to-the-cook-with-all-the-ingredients-for-the-first-time':'serving-the-customers-talking-to-the-cook-with-all-the-ingredients-subsequent-times')
      :'serving-the-customers-talking-to-the-cook-after-taking-a-food-order';
    case 'cooked':return 'serving-the-customers-talking-to-the-cook-before-serving-the-meal';
    case 'ready':return 'completing-the-event-talking-to-the-cook';
    default:return null;
  }
}
function interact(api,event){
  const {player,npc}=event;
  const definition=npc.getCurrentDefinition(player);
  if(definition?.getId()!==api.core.CacheDefinitions.getNpcId('fai_varrock_bluemoon_chef')||definition.getActions()?.[event.clickType-1]?.toLowerCase()!=='talk-to')return;
  if(!player.isRegistered()||player.getHitpoints()<=0||player.busy())return;
  const variant=cookVariant(Progress.read(player),Progress.held(api,player));
  // start refuses inactive epochs; the ordinary Cook transcript then remains
  // available through the existing downstream dialogue dispatcher.
  if(variant&&Dialogue.start(api,{player,npc,variant}))event.handled=true;
}

module.exports={interact};
