"use strict";

const Progress=require('./Progress.ChristmasDinner');
const Dialogue=require('./Dialogue.ChristmasDinner');
const Actors=require('./Actors.ChristmasDinner');

const GUESTS=['xmas25_sir_prysin','xmas25_aggie','xmas25_jobless_jim'];
const MISC={
  'Sir Prysin':'sir-prysin',Aggie:'aggie',Hans:'hans',Karim:'karim',Oziach:'oziach',Rommik:'rommik',Doris:'doris',Herquin:'herquin',
};
function customer(api,event,role){
  const {player,npc}=event,state=Progress.read(player);
  let variant,escort=false;
  if(role.kind==='queue'&&state.phase==='queue'&&Progress.held(api,player)&&
    npc.getCurrentDefinition(player)?.getId()===api.core.CacheDefinitions.getArchivedId('christmas-2025','npc',GUESTS[state.customer])){
    variant='serving-the-customers-talking-to-the-customer';escort=true;
  }else if(role.kind==='escort'&&state.phase==='table')variant='serving-the-customers-talking-to-the-customer-before-picking-a-table';
  else{
    const name=npc.getCurrentDefinition(player)?.getName();
    const served=role.kind==='seat'&&state.seats.indexOf(role.table)<state.customer;
    const suffix=name==='Jobless Jim'?'jobless-jim-'+(served?'after-he-had-his-dinner':'before-he-had-his-dinner'):MISC[name];
    if(suffix)variant='misc-npc-dialogue-talking-to-'+suffix;
  }
  if(variant)Dialogue.start(api,{player,npc,variant,escort,guard:()=>Actors.role(api,npc,player)===role});
  // Never route our holiday variants into ordinary Prysin/Aggie quest dialogue.
  event.handled=true;
}

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
  if(definition?.getActions()?.[event.clickType-1]?.toLowerCase()!=='talk-to')return;
  if(!player.isRegistered()||player.getHitpoints()<=0||player.busy())return;
  const role=Actors.role(api,npc,player);
  if(role){customer(api,event,role);return;}
  if(definition.getId()===api.core.CacheDefinitions.getNpcId('bluemoon_bartender')){
    if(npc.getPrivateArea?.()||npc.getOwner?.())return;
    if(Dialogue.startBartender(api,{player,npc}))event.handled=true;
    return;
  }
  if(definition.getId()!==api.core.CacheDefinitions.getNpcId('fai_varrock_bluemoon_chef'))return;
  const variant=cookVariant(Progress.read(player),Progress.held(api,player));
  // start refuses inactive epochs; the ordinary Cook transcript then remains
  // available through the existing downstream dialogue dispatcher.
  if(variant&&Dialogue.start(api,{player,npc,variant}))event.handled=true;
}

module.exports={interact};
