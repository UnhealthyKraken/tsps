"use strict";

const Progress=require('./Progress.ChristmasDinner');
const COSMETICS=Object.freeze(['xmas25_bib','xmas25_christmas_dinner','xmas25_beer_belly_sweater','xmas25_contest_jumper']);
// Original zMOOL1CZhhk6:31 shows individual noted hats, not GE partyhat-set boxes.
const RARES=Object.freeze(['cert_red_partyhat','cert_yellow_partyhat','cert_blue_partyhat',
  'cert_green_partyhat','cert_purple_partyhat','cert_white_partyhat','cert_santa_hat','cert_christmas_cracker']);
// Christmas event rewards template15083464 intersected with Diango15318540 and
// active enum708's nonnegative catalogue slots. Negative enum keys are rare awards,
// not reclaim slots. Transformed gingerbread shields use their green base family.
const UNLOCKS=Object.freeze([
  'xmas_yoyo','win05_hat1','win05_scarf1','win05_hat2','win05_scarf2','win05_hat3','win05_scarf3','win05_hat4','win05_scarf4',
  'win05_marionette_complete_blue_alive','win05_marionette_complete_red_alive','win05_marionette_complete_green_alive',
  'gub_reindeer_hat','gub_wintumber_tree','black_partyhat','rainbow_partyhat',
  'santa_mask','santa_jacket','santa_pants','santa_gloves','santa_boots',
  'antisanta_mask','antisanta_jacket','antisanta_pants','antisanta_gloves','antisanta_boots',
  'black_santa_hat','inverted_santa_hat','xmas16_snowglobe','xmas16_sack','xmas16_chest',
  'xmas17_imp_head','xmas17_imp_body','xmas17_imp_legs','xmas17_imp_tail','xmas17_imp_gloves','xmas17_imp_boots','xmas17_wom_hat',
  'xmas18_hat','xmas18_top','xmas18_legs','xmas18_candycane','xmas19_shield_1','xmas20_boulder','xmas20_decor',
  'xm21_festive_slippers','xm21_festive_hat','xm21_snowman_ring','xm21_present_1',
  'xmas22_cape','xmas22_jumper','xmas22_goggles','xmas22_coal_sack',
  'xmas22_nutcracker_hat01','xmas22_nutcracker_torso01','xmas22_nutcracker_legs01','xmas22_nutcracker_feet01','xmas22_nutcracker_staff01','xmas22_santa_crown',
  'xmas23_helmet','xmas23_jumper','xmas24_present_hat_festive','xmas24_dog_mask','xmas24_festive_scarf','xmas24_dog_boots',
  ...COSMETICS,
]);
const REQUIRED_FREE_SLOTS=12;
const RARE_PLAY_SECONDS=25*60*60;

function itemId(api,symbol){
  const id=api.core.CacheDefinitions.getObjId(symbol);
  if(id===null)throw new Error('Missing Christmas reward '+symbol);
  return id;
}
function eligibleForRares(api,player){
  const request={player};api.emitCustomEvent('player:lifetime-seconds',request);
  return typeof request.seconds==='number'&&Number.isFinite(request.seconds)&&request.seconds>=RARE_PLAY_SECONDS;
}
function plan(api,player,revision){
  const state=Progress.read(player),inventory=player.getInventory();
  if(!player.isRegistered()||player.getHitpoints()<=0||state.phase!=='ready'||state.revision!==revision||
    state.customer!==3||!Progress.held(api,player)||inventory.getFreeSlots()<REQUIRED_FREE_SLOTS)return null;
  const copy=new api.core.Inventory(player).setItems(inventory.getCopiedItems());
  const platter=Progress.platterId(api),slot=inventory.getSlotForItemId(platter);
  copy.deleteAtSlot(slot,1);
  const rewards=COSMETICS.map(symbol=>({symbol,id:itemId(api,symbol),amount:1}));
  if(eligibleForRares(api,player))for(const symbol of RARES)rewards.push({symbol,id:itemId(api,symbol),amount:2});
  for(const row of rewards){
    const item=new api.core.Item(row.id,row.amount);
    if(copy.getAddableAmount(item)!==row.amount)return null;
    copy.add(item,false);
  }
  return {items:copy.getItems(),rewards};
}

module.exports={COSMETICS,RARES,UNLOCKS,REQUIRED_FREE_SLOTS,RARE_PLAY_SECONDS,eligibleForRares,plan};
