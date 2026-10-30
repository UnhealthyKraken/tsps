const assert=require('node:assert/strict'),path=require('node:path');
const {before,test}=require('node:test');
require('../dist/Server').Server.installProductionPathResolver();
const {CachePipeline}=require('../dist/game/cache/CachePipeline');
const {PluginManager:PM}=require('../dist/plugins/PluginManager');
const Scene=require('../plugins/world/seasonal/Scene.ChristmasDinner');
const data=require('../plugins/world/seasonal/data/christmas-2025-archive.json');
let api,c;
before(async()=>{
  await CachePipeline.initialize(path.resolve(__dirname,'..'));api=PM.createApi('ChristmasDinner');c=api.core;c.RegionManager.init();
  require('../plugins/world/DefinitionArchives.plugin').register(PM.createApi('DefinitionArchives'));
  require('../plugins/npcs/NpcDialogues.plugin').register(PM.createApi('NpcDialogues'));
  require('../plugins/world/ChristmasDinner.plugin').register(api);
  for(const row of data.placements)c.RegionManager.loadMapFiles(row.x,row.y,false);
});
function at(row){return new c.Location(row.x,row.y,row.z);}
function originals(){return data.placements.map(row=>({row,objects:[...(c.MapObjects.mapObjects.get(c.MapObjects.getHash(row.x,row.y,row.z))??[])].filter(o=>o.getLocation().equals(at(row))&&o.getType()===row.shape)}));}
function clipping(){
  const flags=[];
  for(const [minX,maxX,minY,maxY]of [[3214,3245,3393,3417],[3230,3244,9795,9809]])for(let x=minX;x<=maxX;x++)for(let y=minY;y<=maxY;y++)flags.push(c.RegionManager.getClipping(x,y,0));
  return flags;
}
function install(bundles){const request={bundles};PM.emitCustomEvent('definition-archives:install',request);assert.equal(request.handled,true,request.error);}

test('actual Christmas front guest greets, follows its owner and seats through native Table Serve',async t=>{
  const Progress=require('../plugins/world/seasonal/Progress.ChristmasDinner');
  const {Player}=require('../dist/game/entity/impl/player/Player');
  const {PlayerSession}=require('../dist/net/PlayerSession');
  const {ClientConnection}=require('../dist/net/NetworkBuilder');
  const channel={kind:'test',remoteAddress:'127.0.0.1',isOpen:()=>true,send:()=>true,close(){},onData(){},onError(){},onClose(){}};
  const player=new Player(new PlayerSession(channel)),other=new Player(new PlayerSession(channel)),connection=new ClientConnection(channel);connection.player=player;
  assert.equal(c.World.getPlayers().add(player),true);assert.equal(c.World.getPlayers().add(other),true);
  t.after(()=>{player.closeInterruptibleInterfaces();c.TaskManager.cancelTasks(player.getIndex());PM.emitCustomEvent('events:active',{key:'christmas-2025',active:false});c.World.getPlayers().remove(player);c.World.getPlayers().remove(other);});
  PM.emitCustomEvent('events:active',{key:'christmas-2025',active:true});
  const id=symbol=>c.CacheDefinitions.getArchivedId('christmas-2025','npc',symbol);
  const front=[...c.World.getNpcs()].find(npc=>npc?.getId()===id('xmas25_queue_npc_1'));
  assert.ok(front?.isRegistered(),'annual scene must create its actual native queue parent');
  assert.equal(Progress.begin(api,player,0),true);assert.equal(Progress.begin(api,other,0),true);
  player.setLocation(new c.Location(3217,3395));player.setNeedsPlacement(false);
  await connection.dispatch([{type:'npc_option',index:front.getIndex(),clickType:1}]);connection.processTurnPackets();
  for(let tick=0;tick<12;tick++){c.TaskManager.processWalkTo(player.getIndex());player.getMovementQueue().process();c.TaskManager.process();}
  assert.match(player.getDialogueManager().getCurrent()?.getText()??'',/Hello and welcome to the Blue Moon Inn/);
  async function resume(){
    const group=[231,217,193,229].find(group=>player.getPacketSender().isChatboxInterface(group));assert.ok(group);
    await connection.dispatch([{type:'dialogue_continue',widgetId:(group<<16)|5,childIndex:-1}]);connection.processTurnPackets();
  }
  await resume();await resume();assert.match(player.getDialogueManager().getCurrent()?.getText()??'',/Let me show/);
  front.setOwner(other);await resume();
  assert.equal(Progress.read(player).phase,'queue','pending greeting cannot steal a transferred actor');
  assert.equal(Scene.close(api).handled,false);assert.equal(front.getOwner(),other);assert.equal(front.isRegistered(),true);
  front.setOwner(null);PM.emitCustomEvent('events:active',{key:'christmas-2025',active:true});
  await connection.dispatch([{type:'npc_option',index:front.getIndex(),clickType:1}]);connection.processTurnPackets();
  for(let tick=0;tick<8;tick++){c.TaskManager.processWalkTo(player.getIndex());player.getMovementQueue().process();c.TaskManager.process();}
  for(let n=0;n<8&&player.getDialogueManager().getCurrent();n++)await resume();
  assert.equal(Progress.read(player).phase,'table');assert.equal(Progress.read(other).phase,'queue');
  assert.equal(front.getCurrentDefinition(player).getId(),id('xmas25_aggie'),'queue advances for this player only');
  assert.equal(front.getCurrentDefinition(other).getId(),id('xmas25_sir_prysin'));
  let follower=[...c.World.getNpcs()].find(npc=>npc?.getOwner()===player&&npc.getId()===id('xmas25_sir_prysin'));
  assert.ok(follower?.isRegistered());assert.equal(follower.isOwnerOnly(),true);assert.equal(follower.getFollowing(),player);
  const start=follower.getLocation().clone();follower.setNeedsPlacement(false);
  player.getMovementQueue().addSteps(new c.Location(3220,3400));
  for(let tick=0;tick<16;tick++){player.getMovementQueue().process();follower.process();c.TaskManager.process();}
  assert.equal(follower.getLocation().equals(start),false,'real NPC movement must follow beyond its spawn tile');
  const oldFollower=follower;
  PM.emitPlayerLogout({player,username:'christmasescort'});assert.equal(oldFollower.isRegistered(),false);
  PM.emitPlayerLogin({player,username:'christmasescort'});PM.emitPlayerLogin({player,username:'christmasescort'});
  const recovered=[...c.World.getNpcs()].filter(npc=>npc?.getOwner()===player&&npc.getId()===id('xmas25_sir_prysin'));
  assert.equal(recovered.length,1,'login lifecycle recovers one escort without duplicating it');follower=recovered[0];
  assert.notEqual(follower,oldFollower);assert.equal(follower.getFollowing(),player);
  const table=Scene.objects().find(row=>row.symbol==='xmas25_table_1').object,p=table.getLocation();
  await connection.dispatch([{type:'object_option',id:table.getId(),x:p.getX(),y:p.getY(),clickType:1,action:'Serve'}]);connection.processTurnPackets();
  for(let tick=0;tick<16;tick++){c.TaskManager.processWalkTo(player.getIndex());player.getMovementQueue().process();follower.process();c.TaskManager.process();}
  assert.equal(Progress.read(player).phase,'drink-order');assert.deepEqual(Progress.read(player).seats,[0]);
  assert.equal(follower.isRegistered(),false,'a seated guest cannot leave a duplicate following actor');
  const seat=[...c.World.getNpcs()].find(npc=>npc?.getId()===id('xmas25_table_npc_1'));
  assert.ok(seat?.isRegistered());assert.equal(seat.getCurrentDefinition(player).getId(),id('xmas25_sir_prysin'));
  assert.equal(seat.getCurrentDefinition(other).getId(),id('xmas25_stool_empty'));
  // Control only selection RNG; orders must now be reached through actual
  // guest packets/Continue, not supplied directly to Progress.order*.
  const apply=(name,...args)=>assert.equal(Progress[name](api,player,Progress.read(player).revision,...args),true);
  async function talkToSeat(){
    await connection.dispatch([{type:'npc_option',index:seat.getIndex(),clickType:1}]);connection.processTurnPackets();
    for(let tick=0;tick<16;tick++){c.TaskManager.processWalkTo(player.getIndex());player.getMovementQueue().process();c.TaskManager.process();}
  }
  let draws=0;t.mock.method(c.Misc,'randomInclusive',(_min,max)=>{draws++;return max;});
  await talkToSeat();assert.match(player.getDialogueManager().getCurrent()?.getText()??'',/Can I get\s+you something to drink/);
  await resume();assert.match(player.getDialogueManager().getCurrent()?.getText()??'',/Can I have some eggnog/);
  assert.equal(Progress.read(player).phase,'drink');assert.equal(Progress.read(player).drink,'eggnog');
  player.closeInterruptibleInterfaces();const drinkRevision=Progress.read(player).revision,drinkDraws=draws;
  await talkToSeat();await resume();
  assert.match(player.getDialogueManager().getCurrent()?.getText()??'',/Can I have some eggnog/);
  assert.equal(Progress.read(player).revision,drinkRevision);assert.equal(draws,drinkDraws,'a displayed drink cannot reroll');
  player.closeInterruptibleInterfaces();apply('takeDrink','eggnog');
  await talkToSeat();assert.match(player.getDialogueManager().getCurrent()?.getText()??'',/Here is your drink/);
  assert.equal(Progress.read(player).phase,'food-order');assert.equal(Progress.read(player).drinkHeld,false);
  player.closeInterruptibleInterfaces();await talkToSeat();
  assert.match(player.getDialogueManager().getCurrent()?.getText()??'',/Are you ready to order/);
  for(let n=0;n<12&&Progress.read(player).phase!=='ingredients';n++)await resume();
  assert.match(player.getDialogueManager().getCurrent()?.getText()??'',/For my main, I would like trout/);
  const ordered=Progress.read(player),foodDraws=draws;
  assert.equal(ordered.phase,'ingredients');assert.deepEqual(ordered.sides,['stuffing','carrots','parsnips']);
  player.closeInterruptibleInterfaces();await talkToSeat();player.closeInterruptibleInterfaces();
  assert.deepEqual(Progress.read(player),ordered);assert.equal(draws,foodDraws,'a displayed meal cannot reroll');
  // Bar gathering/crate selection and Cook are covered by their focused native
  // path tests; supply their existing real Progress APIs for this entrypoint.
  for(const ingredient of [ordered.main,...ordered.sides])apply('collect',ingredient);
  apply('cook');
  await talkToSeat();assert.match(player.getDialogueManager().getCurrent()?.getText()??'',/Here is your meal/);
  assert.equal(Progress.read(player).phase,'cooked');await resume();
  assert.match(player.getDialogueManager().getCurrent()?.getText()??'',/Thank you/);
  assert.equal(Progress.read(player).phase,'cooked','unacknowledged delivery cannot advance the queue');
  await resume();assert.equal(Progress.read(player).customer,1);assert.equal(Progress.read(player).phase,'queue');
  for(let n=0;n<8&&player.getDialogueManager().getCurrent();n++)await resume();
  const servedRevision=Progress.read(player).revision;await talkToSeat();
  assert.equal(Progress.read(player).revision,servedRevision,'repeat Talk-to cannot deliver the meal twice');
  assert.equal(Progress.read(other).phase,'queue','another player does not inherit the serving result');
  PM.emitCustomEvent('events:active',{key:'christmas-2025',active:false});
  assert.equal(front.isRegistered(),false);assert.equal(seat.isRegistered(),false);
});

test('original upstairs carpet boundary clears four modern blue tiles and restores them without stealing foreign floors',t=>{
  // Original l50_53 has no floor decoration in this northmost modern rug row.
  const rows=[['fai_varrock_rugcorner',3219,0],['fai_varrock_rugside',3220,0],['fai_varrock_rugside',3221,0],['fai_varrock_rugcorner',3222,1]];
  const original=rows.map(([symbol,x,rotation])=>{
    const location=new c.Location(x,3401,1),id=c.CacheDefinitions.getLocId(symbol),object=c.MapObjects.get(id,location,null);
    assert.ok(object?.isMapOriginal(),'real active-cache rug '+symbol+' '+x);assert.equal(object.getFace(),rotation);
    return {location,id,object};
  });
  let foreign;
  t.after(()=>{if(foreign)c.ObjectManager.deregister(foreign,true);assert.equal(Scene.close(api).handled,true);});
  assert.equal(Scene.open(api).handled,true);
  for(const row of original)assert.equal(c.MapObjects.get(row.id,row.location,null),null,'blue strip remains outside the original red carpet');
  assert.equal(Scene.objects().length,125,'vacant tiles are not fabricated scenery objects');
  foreign=new c.GameObject(original[0].id,original[0].location.clone(),22,0,null);c.ObjectManager.register(foreign,true);
  assert.equal(Scene.close(api).handled,false,'a later runtime floor keeps its ownership');
  assert.ok(c.World.getObjects().includes(foreign));c.ObjectManager.deregister(foreign,true);foreign=null;
  assert.equal(c.RegionManager.reloadRegion(c.RegionManager.regionIdForTile(3220,3401)),true);
  for(const row of original)assert.equal(c.MapObjects.get(row.id,row.location,null),null,'region reload must replay the empty historical boundary');
  assert.equal(Scene.close(api).handled,true);
  for(const row of original)assert.equal(c.MapObjects.get(row.id,row.location,null),row.object,'exact saved native floor restored');
});

test('native Table Serve routes saved ingredients and cooked meals to their own guest only',async t=>{
  const Progress=require('../plugins/world/seasonal/Progress.ChristmasDinner');
  const {Player}=require('../dist/game/entity/impl/player/Player');
  const {PlayerSession}=require('../dist/net/PlayerSession');
  const {ClientConnection}=require('../dist/net/NetworkBuilder');
  const channel={kind:'test',remoteAddress:'127.0.0.1',isOpen:()=>true,send:()=>true,close(){},onData(){},onError(){},onClose(){}};
  const player=new Player(new PlayerSession(channel)),connection=new ClientConnection(channel);connection.player=player;
  assert.equal(c.World.getPlayers().add(player),true);
  t.after(()=>{player.closeInterruptibleInterfaces();c.TaskManager.cancelTasks(player.getIndex());c.World.getPlayers().remove(player);PM.emitCustomEvent('events:active',{key:'christmas-2025',active:false});});
  PM.emitCustomEvent('events:active',{key:'christmas-2025',active:true});
  const apply=(name,...args)=>assert.equal(Progress[name](api,player,Progress.read(player).revision,...args),true);
  async function click(table){
    player.closeInterruptibleInterfaces();
    const object=Scene.objects().find(row=>row.symbol==='xmas25_table_'+(table+1)).object,p=object.getLocation();
    player.setLocation(new c.Location(3220,3400));player.setNeedsPlacement(false);
    assert.equal(c.RegionManager.getClipping(3220,3400,0)&0x100,0,'actual fixture starts outside solid scenery');
    await connection.dispatch([{type:'object_option',id:object.getId(),x:p.getX(),y:p.getY(),clickType:1,action:'Serve'}]);connection.processTurnPackets();
    for(let tick=0;tick<30;tick++){c.TaskManager.processWalkTo(player.getIndex());player.getMovementQueue().process();c.TaskManager.process();}
  }
  async function resume(){
    const group=[231,217,193,229].find(group=>player.getPacketSender().isChatboxInterface(group));assert.ok(group,'real chatbox is mounted');
    await connection.dispatch([{type:'dialogue_continue',widgetId:(group<<16)|5,childIndex:-1}]);connection.processTurnPackets();
  }
  const text=()=>player.getDialogueManager().getCurrent()?.getText().replace(/\s+/g,' ');
  apply('begin');
  for(let customer=0;customer<3;customer++){
    // Known orders isolate table delivery from unimplemented live order RNG.
    const table=[3,0,2][customer];apply('greet',customer);apply('seat',table);
    apply('orderDrink','beer');apply('takeDrink','beer');apply('serveDrink',table);apply('orderFood','trout',['cabbage','parsnips','stuffing']);
    await click(table);assert.equal(text(),'I should go get all the ingredients for their Christmas dinner.');
    await resume();assert.equal(text(),'I believe they wanted trout, with cabbage, parsnips and stuffing.');
    if(customer===0){
      player.closeInterruptibleInterfaces();
      player.getInventory().deletes(new c.Item(Progress.platterId(api),1));
      const revision=Progress.read(player).revision;
      await click(table);assert.equal(text(),'I should really go get a new serving platter from the Cook before I try to serve a table.');
      assert.equal(Progress.read(player).revision,revision,'missing physical platter refuses delivery');
      player.closeInterruptibleInterfaces();apply('reclaim');
    }
    for(const ingredient of ['trout','cabbage','parsnips','stuffing'])apply('collect',ingredient);
    await click(table);assert.equal(text(),'I should get the Cook to prepare these ingredients before I serve them.');
    apply('cook');
    const revision=Progress.read(player).revision;
    await click(1);assert.equal(Progress.read(player).revision,revision,'empty fourth table must not receive another guest meal');
    await click(table);assert.equal(text(),'Here is your meal. Enjoy!');
    await resume();assert.equal(text(),'Thank you!');
    if(customer===0){
      PM.emitCustomEvent('events:active',{key:'christmas-2025',active:false});
      await connection.dispatch([{type:'dialogue_continue',widgetId:(231<<16)|5,childIndex:-1}]);connection.processTurnPackets();
      assert.equal(Progress.read(player).phase,'cooked','closed annual window cannot complete a pending delivery');
      assert.equal(Progress.read(player).customer,0);
      PM.emitCustomEvent('events:active',{key:'christmas-2025',active:true});
      await click(table);await resume();assert.equal(text(),'Thank you!');
    }
    await resume();assert.equal(Progress.read(player).customer,customer+1);
    assert.equal(Progress.read(player).phase,customer===2?'ready':'queue');
    const served=Progress.read(player).revision;await click(table);
    assert.equal(Progress.read(player).revision,served,'repeat Serve cannot deliver the same meal twice');
  }
  player.closeInterruptibleInterfaces();
});
test('original surface/cellar objects and real collision restore after two native scene lifecycles',()=>{
  const before=originals(),flags=clipping(),removed=[...c.World.getRemovedObjects()];
  assert.equal(before.filter(r=>r.row.symbol.startsWith('xmas25_')&&r.objects.length).length,21,'actual current-cache map objects were loaded');
  const rugs=before.filter(r=>r.row.symbol.startsWith('xmas22_pub01_rug'));
  assert.equal(rugs.filter(r=>r.row.z===0).length,54,'original dining-room rug footprint');
  assert.equal(rugs.filter(r=>r.row.z===1).length,47,'original upstairs rug footprint');
  assert.equal(rugs.filter(r=>r.row.z===0&&r.objects.length).length,42,'actual blue rug tiles replaced downstairs');
  for(let cycle=0;cycle<2;cycle++){
    assert.equal(Scene.open(api).handled,true);assert.equal(Scene.objects().length,125);
    for(const entry of Scene.objects()){
      const row=data.placements.find(row=>row.symbol===entry.symbol&&at(row).equals(entry.object.getLocation()));assert.ok(row);
      assert.equal(entry.object.getType(),row.shape);assert.equal(entry.object.getFace(),row.rotation);
      assert.equal(c.MapObjects.get(entry.object.getId(),at(row),null),entry.object);
      assert.ok(c.World.getObjects().includes(entry.object),'registered real world owner');
    }
    assert.equal(Scene.open(api).handled,true,'duplicate activation is idempotent');assert.equal(Scene.objects().length,125);
    assert.equal(Scene.close(api).handled,true);assert.equal(Scene.objects().length,0);
    for(const entry of before)for(const object of entry.objects)assert.equal(c.MapObjects.get(object.getId(),object.getLocation(),null),object);
    assert.deepEqual(clipping(),flags,'no invisible clipping remains around either original scene');
    assert.deepEqual(c.World.getRemovedObjects(),removed,'no archived/map-removal tombstones leak');
    assert.deepEqual(c.CacheDefinitions.getDefinitionArchiveBundles(),[]);
  }
});
test('scene allocation and teardown preserve independently installed archive content',()=>{
  const original=data.bundle.definitions.find(r=>r.kind==='npc'&&r.symbol==='xmas25_sir_prysin');
  const other={...data.bundle,id:'other-holiday',definitions:[{...original,id:c.CacheDefinitions.getCounts().npcs+10}]};
  install([other]);
  try{
    assert.equal(Scene.open(api).handled,true);
    assert.equal(c.CacheDefinitions.getArchivedId('other-holiday','npc',original.symbol),other.definitions[0].id);
    assert.ok(c.CacheDefinitions.getArchivedId('christmas-2025','npc',original.symbol)>other.definitions[0].id);
    assert.equal(Scene.close(api).handled,true);assert.deepEqual(c.CacheDefinitions.getDefinitionArchiveBundles(),[other]);
  }finally{Scene.close(api);install([]);}
});
test('an existing runtime object refuses activation without replacing it or publishing an archive',()=>{
  const row=data.placements.find(r=>r.symbol==='xmas25_table_1');
  const foreign=new c.GameObject(c.ObjectIdentifiers.CRATE,at(row),row.shape,0,null);
  c.ObjectManager.register(foreign,true);
  try{
    const response=Scene.open(api);assert.equal(response.handled,false);assert.match(response.error,/runtime|owner|occupied/i);
    assert.ok(c.World.getObjects().includes(foreign));assert.deepEqual(c.CacheDefinitions.getDefinitionArchiveBundles(),[]);
  }finally{c.ObjectManager.deregister(foreign,true);}
});
test('a later foreign replacement is not overwritten during teardown and normal cleanup can retry',()=>{
  assert.equal(Scene.open(api).handled,true);
  const entry=Scene.objects().find(r=>r.symbol==='xmas25_table_1');
  const foreign=new c.GameObject(c.ObjectIdentifiers.CRATE,entry.object.getLocation().clone(),entry.object.getType(),0,null);
  c.ObjectManager.register(foreign,true);
  try{
    const response=Scene.close(api);assert.equal(response.handled,false);assert.match(response.error,/runtime|owner|occupied/i);
    assert.ok(c.World.getObjects().includes(foreign));assert.equal(c.CacheDefinitions.getDefinitionArchiveBundles().length,1);
  }finally{c.ObjectManager.deregister(foreign,true);assert.equal(Scene.close(api).handled,true);}
});
test('real region reload keeps exactly one seasonal loc per tile and does not resurrect native interactions',()=>{
  assert.equal(Scene.open(api).handled,true);
  try{
    for(const id of new Set(data.placements.map(row=>c.RegionManager.regionIdForTile(row.x,row.y))))assert.equal(c.RegionManager.reloadRegion(id),true);
    for(const row of Scene.objects()){
      const p=row.object.getLocation();
      const standing=(c.MapObjects.mapObjects.get(c.MapObjects.getHash(p.getX(),p.getY(),p.getZ()))??[])
        .filter(o=>o.getLocation().equals(p)&&o.getType()===row.object.getType());
      assert.deepEqual(standing,[row.object],'native map duplicate reappeared at '+row.symbol);
    }
  }finally{assert.equal(Scene.close(api).handled,true);}
});
test('calendar transitions route through the real plugin and preserve archives installed after activation',()=>{
  PM.emitCustomEvent('events:active',{key:'christmas-2025',active:true});assert.equal(Scene.active(),true);
  const original=data.bundle.definitions.find(r=>r.kind==='npc'&&r.symbol==='xmas25_sir_prysin');
  const other={...data.bundle,id:'late-holiday',definitions:[{...original,id:c.CacheDefinitions.getCounts().npcs+10}]};
  install([...c.CacheDefinitions.getDefinitionArchiveBundles(),other]);
  PM.emitCustomEvent('events:active',{key:'christmas-2025',active:false});
  assert.equal(Scene.active(),false);assert.deepEqual(c.CacheDefinitions.getDefinitionArchiveBundles(),[other]);install([]);
});

test('real per-player morph owners expose only the appropriate table and bar operations',t=>{
  const Progress=require('../plugins/world/seasonal/Progress.ChristmasDinner');
  const {Player}=require('../dist/game/entity/impl/player/Player');
  const {PlayerSession}=require('../dist/net/PlayerSession');
  const channel={kind:'test',remoteAddress:'127.0.0.1',isOpen:()=>true,send:()=>true,close(){},onData(){},onError(){},onClose(){}};
  const first=new Player(new PlayerSession(channel)),other=new Player(new PlayerSession(channel));
  assert.equal(c.World.getPlayers().add(first),true);assert.equal(c.World.getPlayers().add(other),true);
  t.after(()=>{PM.emitCustomEvent('events:active',{key:'christmas-2025',active:false});c.World.getPlayers().remove(first);c.World.getPlayers().remove(other);});
  PM.emitCustomEvent('events:active',{key:'christmas-2025',active:true});
  const table=Scene.objects().find(row=>row.symbol==='xmas25_table_1').object;
  const bar=Scene.objects().find(row=>row.symbol==='xmas25_bar_middle').object;
  const definition=(object,player)=>c.ObjectDefinition.forPlayer(object.getId(),player);
  const apply=(name,...args)=>{assert.equal(Progress[name](api,first,Progress.read(first).revision,...args),true);};
  assert.ok(!definition(table,first).getActions()?.includes('Serve'));
  apply('begin');apply('greet',0);
  assert.ok(definition(table,first).getActions()?.includes('Serve'),'greeted customer can be shown to an unused table');
  assert.ok(!definition(table,other).getActions()?.includes('Serve'),'another player retains their own empty tables');
  apply('seat',0);apply('orderDrink','beer');
  assert.ok(definition(bar,first).getActions()?.includes('Get Drink From'));
  assert.ok(!definition(bar,other).getActions()?.includes('Get Drink From'));
  apply('takeDrink','beer');apply('serveDrink',0);
  assert.equal(definition(table,first),c.ObjectDefinition.forId(c.CacheDefinitions.getArchivedId('christmas-2025','loc','xmas25_table01_drink01')));
  assert.ok(!definition(bar,first).getActions()?.includes('Get Drink From'));
  apply('orderFood','trout',['cabbage','parsnips','stuffing']);
  for(const ingredient of ['trout','cabbage','parsnips','stuffing'])apply('collect',ingredient);
  apply('cook');apply('serveMeal',0);
  assert.equal(definition(table,first),c.ObjectDefinition.forId(c.CacheDefinitions.getArchivedId('christmas-2025','loc','xmas25_table01_food01')));
  assert.ok(!definition(table,first).getActions()?.includes('Serve'));
  const reloaded=new Player(new PlayerSession(channel));reloaded.setAttribute(Progress.PROGRESS_ATTRIBUTE,JSON.parse(JSON.stringify(Progress.read(first))));
  reloaded.setUsername('christmasmorphrelog');PM.emitPlayerLogin({player:reloaded,username:reloaded.getUsername()});
  assert.equal(definition(table,reloaded),definition(table,first),'saved progression restores actual native morph selection');
  PM.emitCustomEvent('events:active',{key:'christmas-2025',active:false});
  assert.equal(first.getPacketSender().getVarbit(c.CacheDefinitions.getVarbitId('xmas_25_table_id_1')),0);
  assert.equal(first.getPacketSender().getVarbit(c.CacheDefinitions.getVarbitId('xmas_25_bar_interactable')),0);
  PM.emitCustomEvent('events:active',{key:'christmas-2025',active:true});
  const reopened=Scene.objects().find(row=>row.symbol==='xmas25_table_1').object;
  assert.equal(definition(reopened,first),c.ObjectDefinition.forId(c.CacheDefinitions.getArchivedId('christmas-2025','loc','xmas25_table01_food01')),'reopening derives the original saved meal without resetting progress');
});

test('original seat NPC morphs follow each player and restore through login and window changes',t=>{
  const Progress=require('../plugins/world/seasonal/Progress.ChristmasDinner');
  const {Player}=require('../dist/game/entity/impl/player/Player');
  const {PlayerSession}=require('../dist/net/PlayerSession');
  const channel={kind:'test',remoteAddress:'127.0.0.1',isOpen:()=>true,send:()=>true,close(){},onData(){},onError(){},onClose(){}};
  const player=new Player(new PlayerSession(channel)),other=new Player(new PlayerSession(channel)),actors=[];
  assert.equal(c.World.getPlayers().add(player),true);assert.equal(c.World.getPlayers().add(other),true);
  t.after(()=>{for(const actor of actors)c.World.getNpcs().remove(actor);PM.emitCustomEvent('events:active',{key:'christmas-2025',active:false});c.World.getPlayers().remove(player);c.World.getPlayers().remove(other);});
  PM.emitCustomEvent('events:active',{key:'christmas-2025',active:true});
  // Seeded parent actors check the actual cache/varbit owner, not NPC placement.
  for(let table=0;table<4;table++){
    const actor=c.NPC.create(c.CacheDefinitions.getArchivedId('christmas-2025','npc','xmas25_table_npc_'+(table+1)),new c.Location(3220+table,3400));
    assert.equal(c.World.getNpcs().add(actor),true);actors.push(actor);
  }
  const id=symbol=>c.CacheDefinitions.getArchivedId('christmas-2025','npc',symbol);
  const selected=(actor,owner)=>actor.getCurrentDefinition(owner)?.getId();
  const apply=(name,...args)=>assert.equal(Progress[name](api,player,Progress.read(player).revision,...args),true);
  for(const actor of actors)assert.equal(selected(actor,player),id('xmas25_stool_empty'));
  apply('begin');
  const tables=[3,0,2],guests=['xmas25_sir_prysin','xmas25_aggie','xmas25_jobless_jim'];
  for(let guest=0;guest<3;guest++){
    const table=tables[guest];apply('greet',guest);apply('seat',table);
    assert.equal(selected(actors[table],player),id(guests[guest]),'native parent must become the seated guest');
    assert.equal(selected(actors[table],other),id('xmas25_stool_empty'),'other player retains their own empty seat');
    apply('orderDrink','beer');apply('takeDrink','beer');apply('serveDrink',table);apply('orderFood','trout',['cabbage','parsnips','stuffing']);
    for(const ingredient of ['trout','cabbage','parsnips','stuffing'])apply('collect',ingredient);
    apply('cook');apply('serveMeal',table);
    assert.equal(selected(actors[table],player),id(guests[guest]),'the served guest remains at their table');
  }
  assert.equal(selected(actors[1],player),id('xmas25_stool_empty'),'fourth table remains for the player');
  const reloaded=new Player(new PlayerSession(channel));reloaded.setAttribute(Progress.PROGRESS_ATTRIBUTE,JSON.parse(JSON.stringify(Progress.read(player))));reloaded.setUsername('christmasseatlogin');
  PM.emitPlayerLogin({player:reloaded,username:reloaded.getUsername()});
  for(let table=0;table<4;table++)assert.equal(selected(actors[table],reloaded),selected(actors[table],player));
  // Remove fixture actors before archive teardown; do not bypass its borrower guard.
  for(const actor of actors)c.World.getNpcs().remove(actor);
  PM.emitCustomEvent('events:active',{key:'christmas-2025',active:false});
  for(let table=1;table<=4;table++)assert.equal(player.getPacketSender().getVarbit(c.CacheDefinitions.getVarbitId('xmas_25_seat_id_'+table)),0);
  PM.emitCustomEvent('events:active',{key:'christmas-2025',active:true});
  for(let guest=0;guest<3;guest++)assert.equal(player.getPacketSender().getVarbit(c.CacheDefinitions.getVarbitId('xmas_25_seat_id_'+(tables[guest]+1))),guest+1);
});

test('native bar object packets refuse a wrong drink and load only the requested beverage',async t=>{
  const Progress=require('../plugins/world/seasonal/Progress.ChristmasDinner');
  const {Player}=require('../dist/game/entity/impl/player/Player');
  const {PlayerSession}=require('../dist/net/PlayerSession');
  const {ClientConnection}=require('../dist/net/NetworkBuilder');
  const channel={kind:'test',remoteAddress:'127.0.0.1',isOpen:()=>true,send:()=>true,close(){},onData(){},onError(){},onClose(){}};
  const player=new Player(new PlayerSession(channel)),connection=new ClientConnection(channel);connection.player=player;
  assert.equal(c.World.getPlayers().add(player),true);
  t.after(()=>{player.closeInterruptibleInterfaces();c.TaskManager.cancelTasks(player.getIndex());PM.emitCustomEvent('events:active',{key:'christmas-2025',active:false});c.World.getPlayers().remove(player);});
  PM.emitCustomEvent('events:active',{key:'christmas-2025',active:true});
  const apply=(name,...args)=>assert.equal(Progress[name](api,player,Progress.read(player).revision,...args),true);
  apply('begin');apply('greet',0);apply('seat',0);apply('orderDrink','chocolate milk');
  async function click(symbol){
    const object=Scene.objects().find(row=>row.symbol===symbol).object,p=object.getLocation();
    player.setLocation(new c.Location(3226,p.getY()));player.setNeedsPlacement(false);
    await connection.dispatch([{type:'object_option',id:object.getId(),x:p.getX(),y:p.getY(),clickType:1,action:'Get Drink From'}]);connection.processTurnPackets();
    for(let count=0;count<4;count++){c.TaskManager.processWalkTo(player.getIndex());player.getMovementQueue().process();c.TaskManager.process();}
  }
  await click('xmas25_bar_middle2');
  assert.equal(player.getDialogueManager().getCurrent()?.text,"This part of the bar only has beer. You're trying to find chocolate milk.");
  assert.equal(Progress.read(player).drinkHeld,false);player.closeInterruptibleInterfaces();
  await click('xmas25_bar_drinks_middle2');
  assert.equal(player.getDialogueManager().getCurrent()?.text,'You grab some chocolate milk from the bar and put it on your serving platter.');
  assert.equal(Progress.read(player).drinkHeld,true);player.closeInterruptibleInterfaces();
  const revision=Progress.read(player).revision;await click('xmas25_bar_drinks_middle2');
  assert.equal(player.getDialogueManager().getCurrent()?.text,'You already have the correct drink on your serving platter.');
  assert.equal(Progress.read(player).revision,revision,'repeated bar click cannot duplicate contents');
});

test('four original crate packet paths open native main/side menus and collect actual orders',async t=>{
  const Progress=require('../plugins/world/seasonal/Progress.ChristmasDinner');
  const {Player}=require('../dist/game/entity/impl/player/Player');
  const {PlayerSession}=require('../dist/net/PlayerSession');
  const {ClientConnection}=require('../dist/net/NetworkBuilder');
  const {MultiChatboxPrompt}=require('../dist/game/model/menu/MultiChatboxPrompt');
  const channel={kind:'test',remoteAddress:'127.0.0.1',isOpen:()=>true,send:()=>true,close(){},onData(){},onError(){},onClose(){}};
  const player=new Player(new PlayerSession(channel)),connection=new ClientConnection(channel);connection.player=player;
  assert.equal(c.World.getPlayers().add(player),true);
  t.after(()=>{player.closeInterruptibleInterfaces();c.TaskManager.cancelTasks(player.getIndex());PM.emitCustomEvent('events:active',{key:'christmas-2025',active:false});c.World.getPlayers().remove(player);});
  PM.emitCustomEvent('events:active',{key:'christmas-2025',active:true});
  const apply=(name,...args)=>assert.equal(Progress[name](api,player,Progress.read(player).revision,...args),true);
  apply('begin');apply('greet',0);apply('seat',0);apply('orderDrink','beer');apply('takeDrink','beer');apply('serveDrink',0);apply('orderFood','trout',['cabbage','parsnips','stuffing']);
  async function click(symbol){
    const object=Scene.objects().find(row=>row.symbol===symbol).object,p=object.getLocation();
    // Use the broccoli approach shown in the original footage rather than
    // assuming every crate is operated from the same western approach.
    const approach=p.clone().add(symbol==='xmas25_crate01_broccoli01'?1:-1,0);
    assert.equal(c.RegionManager.getClipping(approach.getX(),approach.getY(),approach.getZ())&0x100,0,'fixture must stand outside solid scenery');
    player.setLocation(approach);player.setNeedsPlacement(false);
    await connection.dispatch([{type:'object_option',id:object.getId(),x:p.getX(),y:p.getY(),clickType:1,action:'Search'}]);connection.processTurnPackets();
    for(let count=0;count<4;count++){c.TaskManager.processWalkTo(player.getIndex());player.getMovementQueue().process();c.TaskManager.process();}
  }
  async function choose(text){
    const pending=MultiChatboxPrompt.getPending(player);assert.ok(pending,'native crate menu exists');
    const choice=pending.options.indexOf(text);assert.ok(choice>=0,JSON.stringify(pending.options));
    await connection.dispatch([{type:'dialogue_continue',widgetId:MultiChatboxPrompt.OPTIONS_WIDGET_ID,childIndex:choice+1}]);connection.processTurnPackets();
  }
  await click('xmas25_crate01_fish01');assert.deepEqual(MultiChatboxPrompt.getPending(player)?.options,['Beef','Jubbly','Chicken','Next']);
  await choose('Beef');assert.deepEqual(Progress.read(player).gathered,[],'wrong menu choice cannot add food');
  assert.match(player.getDialogueManager().getCurrent().getText(),/I'm after trout\./);player.closeInterruptibleInterfaces();
  await click('xmas25_crate01_fish01');
  await choose('Next');await choose('Trout');assert.deepEqual(Progress.read(player).gathered,['trout']);player.closeInterruptibleInterfaces();
  await click('xmas25_crate01_meat01');assert.deepEqual(MultiChatboxPrompt.getPending(player)?.options,['Beef','Jubbly','Chicken','Next']);
  await choose('Next');await choose('Trout');assert.deepEqual(Progress.read(player).gathered,['trout'],'the meat main-menu also rejects an already-held main');player.closeInterruptibleInterfaces();
  await click('xmas25_crate01_vegetable01');assert.deepEqual(MultiChatboxPrompt.getPending(player)?.options,['Sprouts','Potatoes','Cauliflower','Next']);
  await choose('Next');await choose('Cabbage');assert.deepEqual(Progress.read(player).gathered,['trout','cabbage']);
  assert.equal(player.getInventory().getAmount(Progress.platterId(api)),1,'ingredients live on the one platter, not as free inventory food');
  player.closeInterruptibleInterfaces();await click('xmas25_crate01_broccoli01');assert.deepEqual(MultiChatboxPrompt.getPending(player)?.options,['Sprouts','Potatoes','Cauliflower','Next']);
  await choose('Next');await choose('Cabbage');assert.deepEqual(Progress.read(player).gathered,['trout','cabbage'],'broccoli side-menu also rejects a duplicate');
  player.closeInterruptibleInterfaces();await click('xmas25_crate01_vegetable01');await choose('Next');await choose('Cabbage');
  assert.deepEqual(Progress.read(player).gathered,['trout','cabbage'],'already-carried side cannot be collected twice');
  player.closeInterruptibleInterfaces();await click('xmas25_crate01_vegetable01');
  const revision=Progress.read(player).revision;
  PM.emitCustomEvent('events:active',{key:'christmas-2025',active:false});
  assert.equal(MultiChatboxPrompt.getPending(player),null,'window closure immediately dismisses its owned crate menu');
  await connection.dispatch([{type:'dialogue_continue',widgetId:MultiChatboxPrompt.OPTIONS_WIDGET_ID,childIndex:2}]);connection.processTurnPackets();
  assert.equal(Progress.read(player).revision,revision,'window closure invalidates the pending native crate choice');
  assert.deepEqual(Progress.read(player).gathered,['trout','cabbage']);
});

test('native cellar crate searches refuse taking food before starting and in a seeded completed state',async t=>{
  const Progress=require('../plugins/world/seasonal/Progress.ChristmasDinner');
  const {Player}=require('../dist/game/entity/impl/player/Player');
  const {PlayerSession}=require('../dist/net/PlayerSession');
  const {ClientConnection}=require('../dist/net/NetworkBuilder');
  const channel={kind:'test',remoteAddress:'127.0.0.1',isOpen:()=>true,send:()=>true,close(){},onData(){},onError(){},onClose(){}};
  const player=new Player(new PlayerSession(channel)),connection=new ClientConnection(channel);connection.player=player;
  assert.equal(c.World.getPlayers().add(player),true);
  t.after(()=>{player.closeInterruptibleInterfaces();c.TaskManager.cancelTasks(player.getIndex());c.World.getPlayers().remove(player);PM.emitCustomEvent('events:active',{key:'christmas-2025',active:false});});
  PM.emitCustomEvent('events:active',{key:'christmas-2025',active:true});
  for(const phase of ['new','complete']){
    player.setAttribute(Progress.PROGRESS_ATTRIBUTE,{...Progress.initial(),phase,...(phase==='complete'?{customer:3,seats:[0,1,2]}:{})});
    for(const row of Scene.objects().filter(row=>row.symbol.includes('_crate01_')&&row.symbol!=='xmas25_crate01_carrot01')){
      player.setLocation(new c.Location(3232,9801));player.setNeedsPlacement(false);const p=row.object.getLocation();
      await connection.dispatch([{type:'object_option',id:row.object.getId(),x:p.getX(),y:p.getY(),clickType:1,action:'Search'}]);connection.processTurnPackets();
      for(let tick=0;tick<80;tick++){c.TaskManager.processWalkTo(player.getIndex());player.getMovementQueue().process();c.TaskManager.process();}
      assert.equal(player.getDialogueManager().getCurrent()?.getText().replace(/\s+/g,' '),"I probably shouldn't take what isn't mine on Christmas.",phase+' '+row.symbol);
      assert.equal(Progress.read(player).phase,phase);assert.equal(player.getInventory().getFreeSlots(),28);
      await connection.dispatch([{type:'interface_close'}]);connection.processTurnPackets();
    }
  }
});

test('real cellar routing reaches six crates from beside the ladder while the source-blocked carrot remains unreachable',t=>{
  const {Player}=require('../dist/game/entity/impl/player/Player');
  const {PlayerSession}=require('../dist/net/PlayerSession');
  const channel={kind:'test',remoteAddress:'127.0.0.1',isOpen:()=>true,send:()=>true,close(){},onData(){},onError(){},onClose(){}};
  const player=new Player(new PlayerSession(channel));assert.equal(c.World.getPlayers().add(player),true);
  t.after(()=>{c.TaskManager.cancelTasks(player.getIndex());c.World.getPlayers().remove(player);PM.emitCustomEvent('events:active',{key:'christmas-2025',active:false});});
  PM.emitCustomEvent('events:active',{key:'christmas-2025',active:true});
  // Actual cache ladder is3232,9802. This walkable adjacent tile is a route
  // fixture, not evidence of the ladder transport's arrival or event timing.
  const start=new c.Location(3232,9801);
  assert.equal(c.RegionManager.getClipping(start.getX(),start.getY(),0)&0x100,0);
  const crates=Scene.objects().filter(row=>row.symbol.includes('_crate01_'));assert.equal(crates.length,7);
  for(const row of crates){
    c.TaskManager.cancelTasks(player.getIndex());player.setLocation(start.clone());player.setNeedsPlacement(false);
    let reached=0;player.getMovementQueue().walkToObject(row.object,{execute(){reached++;}},1);
    for(let tick=0;tick<80;tick++){c.TaskManager.processWalkTo(player.getIndex());player.getMovementQueue().process();c.TaskManager.process();}
    // Wiki Crate (2025 Christmas event) explicitly identifies the carrot
    // crate as blocked by other crates. No route override bypasses that.
    assert.equal(reached,row.symbol==='xmas25_crate01_carrot01'?0:1,row.symbol);
  }
});

test('annual window closure cancels its prior platter view while preserving a later real bank',async t=>{
  const Progress=require('../plugins/world/seasonal/Progress.ChristmasDinner');
  const {Player}=require('../dist/game/entity/impl/player/Player');
  const {PlayerSession}=require('../dist/net/PlayerSession');
  const {ClientConnection}=require('../dist/net/NetworkBuilder');
  const {MAIN_INVENTORY_WIDGET_UID:uid}=require('../dist/net/protocol/ClientProtocol');
  const channel={kind:'test',remoteAddress:'127.0.0.1',isOpen:()=>true,send:()=>true,close(){},onData(){},onError(){},onClose(){}};
  const player=new Player(new PlayerSession(channel)),connection=new ClientConnection(channel);connection.player=player;
  assert.equal(c.World.getPlayers().add(player),true);
  t.after(()=>{player.closeInterruptibleInterfaces();c.TaskManager.cancelTasks(player.getIndex());PM.emitCustomEvent('events:active',{key:'christmas-2025',active:false});c.World.getPlayers().remove(player);});
  PM.emitCustomEvent('events:active',{key:'christmas-2025',active:true});
  assert.equal(Progress.begin(api,player,Progress.read(player).revision),true);
  const platter=Progress.platterId(api);
  player.setNeedsPlacement(false);
  await connection.dispatch([{type:'widget_action',widgetId:uid,groupId:uid>>>16,childId:uid&65535,buttonNum:2,itemId:platter,slot:player.getInventory().getSlotForItemId(platter)}]);connection.processTurnPackets();
  assert.equal(player.getDialogueManager().getCurrent()?.getText(),'The serving platter is empty.');
  const bank=player.getBank(0);bank.addItem(new c.Item(c.ItemIdentifiers.COINS,77));bank.open();
  const modal=player.getInterfaceId();assert.ok(modal>=0,'real Bank.open mounts its interface');
  PM.emitCustomEvent('events:active',{key:'christmas-2025',active:false});
  assert.equal(player.getInterfaceId(),modal,'window cleanup preserves the later bank');
  assert.equal(bank.getAmount(c.ItemIdentifiers.COINS),77,'bank contents remain unchanged');
  assert.equal(player.getDialogueManager().getCurrent(),undefined);
});
test('exhausted native wire allocation refuses before any scenery is removed',()=>{
  const original=data.bundle.definitions.find(r=>r.kind==='npc'&&r.symbol==='xmas25_sir_prysin');
  const other={...data.bundle,id:'last-wire-id',definitions:[{...original,id:65534}]};
  install([other]);const before=originals(),flags=clipping();
  try{
    assert.equal(Scene.open(api).handled,false);assert.equal(Scene.active(),false);
    assert.deepEqual(c.CacheDefinitions.getDefinitionArchiveBundles(),[other]);assert.deepEqual(clipping(),flags);
    for(const entry of before)for(const object of entry.objects)assert.equal(c.MapObjects.get(object.getId(),object.getLocation(),null),object);
  }finally{install([]);}
});
test('an external registered borrower prevents archive removal; partial cleanup cannot pretend to reopen',()=>{
  assert.equal(Scene.open(api).handled,true);
  const table=Scene.objects().find(row=>row.symbol==='xmas25_table_1');
  const borrowed=new c.GameObject(table.object.getId(),new c.Location(3240,3390,0),10,0,null);c.ObjectManager.register(borrowed,true);
  try{
    const response=Scene.close(api);assert.equal(response.handled,false);assert.match(response.error,/despawn/i);
    assert.equal(Scene.active(),false);assert.equal(Scene.open(api).handled,false);
    assert.ok(c.CacheDefinitions.getArchivedId('christmas-2025','loc',table.symbol));
  }finally{c.ObjectManager.deregister(borrowed,true);assert.equal(Scene.close(api).handled,true);}
});
