"use strict";

const Progress=require('./Progress.ChristmasDinner');
const Dialogue=require('./Dialogue.ChristmasDinner');
const Scene=require('./Scene.ChristmasDinner');

// Original map placements + Wiki15375309: west half south→north is
// beer/stout/cider; east half south→north eggnog/milk/chocolate milk/wine.
const BAR_DRINKS=Object.freeze({
  xmas25_bar_middle2:'beer',xmas25_bar_middle:'dwarven stout',xmas25_bar_middle3:'cider',
  xmas25_bar_drinks_left:'eggnog',xmas25_bar_drinks_middle:'milk',
  xmas25_bar_drinks_middle2:'chocolate milk',xmas25_bar_drinks_right:'wine',
});
// Original footage zMOOL1CZhhk2:28/2:43 shows vegetable sides and fish mains;
// LYhx7ksRL5E0:56/1:08 independently shows broccoli sides and meat mains.
// Other crates still require their own identity/path evidence.
const CRATE_VARIANTS=Object.freeze({
  xmas25_crate01_fish01:'serving-the-customers-searching-the-main-course-crate',
  xmas25_crate01_meat01:'serving-the-customers-searching-the-main-course-crate',
  xmas25_crate01_vegetable01:'serving-the-customers-searching-the-side-dish-crate',
  xmas25_crate01_broccoli01:'serving-the-customers-searching-the-side-dish-crate',
});
function drink(api,{player,object}){
  if(!Scene.active()||!Dialogue.active())return false;
  const row=Scene.objects().find(row=>row.object===object),beverage=BAR_DRINKS[row?.symbol];
  if(!beverage||!api.core.World.getObjects().includes(object))return false;
  const state=Progress.read(player);
  if(!player.isRegistered()||player.getHitpoints()<=0||player.busy()||state.phase!=='drink'||!Progress.held(api,player))return true;
  const variant=state.drinkHeld?'serving-the-customers-searching-the-bar-searching-with-the-correct-drink-already'
    :'serving-the-customers-searching-the-bar-'+beverage.replaceAll(' ','-');
  return Dialogue.start(api,{player,npcId:api.core.CacheDefinitions.getNpcId('fai_varrock_bluemoon_chef'),variant,drink:beverage});
}
function search(api,{player,object}){
  if(!Scene.active()||!Dialogue.active())return false;
  const row=Scene.objects().find(row=>row.object===object),variant=CRATE_VARIANTS[row?.symbol];
  if(!variant||!api.core.World.getObjects().includes(object))return false;
  if(!player.isRegistered()||player.getHitpoints()<=0||player.busy()||Progress.read(player).phase!=='ingredients'||!Progress.held(api,player))return true;
  return Dialogue.start(api,{player,npcId:api.core.CacheDefinitions.getNpcId('fai_varrock_bluemoon_chef'),variant});
}

module.exports={drink,search};
