"use strict";

const {camera}=require('./data/christmas-2025-scene.json');
const INSTANT_CAMERA=Object.freeze({rate:0,rate2:100,heightRelative:false});

function start(api,record){
  const sender=record.player.getPacketSender(),status=api.core.CacheDefinitions.getVarbitId('cutscene_status');
  record.cutsceneStatus=sender.getVarbit(status);
  record.fovClamp=sender.getVarbit(api.core.CacheDefinitions.getVarbitId('fov_clamp'));
  record.cameraStarted=true;
  // The native toplevel redraw reads this varbit; keep its ordinary layout
  // owner instead of individually hiding/chatbox/minimap/sidebar components.
  sender.sendVarbit(status,1);
  // Native toplevel_resize fixes the scene FOV and effective viewport for this
  // mode, instead of magnifying a shot with the player's ordinary zoom/aspect.
  sender.sendVarbit(api.core.CacheDefinitions.getVarbitId('fov_clamp'),1);
  sender.sendCameraMoveTo(...camera.bar.from,INSTANT_CAMERA);
  sender.sendCameraLookAt(...camera.bar.at,INSTANT_CAMERA);
}
function delivery(api,record){
  const sender=record.player.getPacketSender(),shot=camera.delivery[record.table<2?'north':'south'];
  sender.sendCameraMoveTo(...shot.from,INSTANT_CAMERA);
  sender.sendCameraLookAt(...shot.at,INSTANT_CAMERA);
}
function clear(api,record){
  // Called while the player still belongs to this scene, before a foreign
  // Area.enter gets its postEnter and can establish its own camera/layout.
  if(!record.cameraStarted)return;
  const sender=record.player.getPacketSender();
  sender.sendCameraReset();
  sender.sendVarbit(api.core.CacheDefinitions.getVarbitId('cutscene_status'),record.cutsceneStatus);
  sender.sendVarbit(api.core.CacheDefinitions.getVarbitId('fov_clamp'),record.fovClamp);
  record.cameraStarted=false;
}

module.exports={start,delivery,clear};
