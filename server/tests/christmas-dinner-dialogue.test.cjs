const assert=require('node:assert/strict'),path=require('node:path');
const {before,test}=require('node:test');
require('../dist/Server').Server.installProductionPathResolver();
const {CachePipeline}=require('../dist/game/cache/CachePipeline');
const {PluginManager:PM}=require('../dist/plugins/PluginManager');
const {Player}=require('../dist/game/entity/impl/player/Player');
const {PlayerSession}=require('../dist/net/PlayerSession');
const {ClientConnection}=require('../dist/net/NetworkBuilder');
const {MultiChatboxPrompt}=require('../dist/game/model/menu/MultiChatboxPrompt');
const Progress=require('../plugins/world/seasonal/Progress.ChristmasDinner');
const Dialogue=require('../plugins/world/seasonal/Dialogue.ChristmasDinner');
const source=require('../plugins/world/seasonal/data/christmas-2025-archive.json');
let api,cook,platter,index=2900;
before(async()=>{
  await CachePipeline.initialize(path.resolve(__dirname,'..'));api=PM.createApi('ChristmasDinner');
  require('../plugins/world/DefinitionArchives.plugin').register(PM.createApi('DefinitionArchives'));
  require('../plugins/npcs/NpcDialogues.plugin').register(PM.createApi('NpcDialogues'));
  const request={bundles:[source.bundle]};PM.emitCustomEvent('definition-archives:install',request);assert.equal(request.handled,true);
  api.onNpcDialogueCondition(Dialogue.condition.bind(null,api));
  api.onCustomEvent('npc-dialogue:line',Dialogue.line.bind(null,api));
  api.onCustomEvent('npc-dialogue:action',Dialogue.action.bind(null,api));
  Dialogue.activate({key:'christmas-2025',active:true});
  cook=api.core.CacheDefinitions.getNpcId('fai_varrock_bluemoon_chef');platter=Progress.platterId(api);
});
function fixture(t){
  const packets=[],channel={kind:'test',remoteAddress:'127.0.0.1',isOpen:()=>true,send:packet=>{packets.push(packet);return true;},close(){},onData(){},onError(){},onClose(){}};
  const player=new Player(new PlayerSession(channel));player.setIndex(index++);player.setRegistered(true);player.setUsername('christmasdialogue');
  const connection=new ClientConnection(channel);connection.player=player;
  const npc=api.core.NPC.create(cook,new api.core.Location(3230,3400));
  t.after(()=>{Dialogue.clear({player});player.closeInterruptibleInterfaces();player.setRegistered(false);api.core.TaskManager.cancelTasks(player.getIndex());});
  return {player,npc,connection,packets};
}
async function resume(f,choice){
  const pending=MultiChatboxPrompt.getPending(f.player);
  const group=[231,217,193,229].find(group=>f.player.getPacketSender().isChatboxInterface(group));
  const packet=pending?{widgetId:MultiChatboxPrompt.OPTIONS_WIDGET_ID,childIndex:choice??1}:{widgetId:(group<<16)|5,childIndex:-1};
  await f.connection.dispatch([{type:'dialogue_continue',...packet}]);f.connection.processTurnPackets();
}
async function finish(f){for(let count=0;count<100;count++){if(!f.player.getDialogueManager().getCurrent()&&!MultiChatboxPrompt.getPending(f.player))return;assert.equal(MultiChatboxPrompt.getPending(f.player),null,'unexpected choice');await resume(f);}assert.fail('dialogue failed to terminate');}
function play(f,variant,options={}){
  let npc=f.npc;
  if(variant.startsWith('serving-the-customers-talking-to-the-customer')||variant.includes('serving-the-table-')){
    const symbol=['xmas25_sir_prysin','xmas25_aggie','xmas25_jobless_jim'][Progress.read(f.player).customer];
    const id=api.core.CacheDefinitions.getArchivedId('christmas-2025','npc',symbol);
    npc=api.core.NPC.create(id,new api.core.Location(3220,3401));
  }
  assert.equal(Dialogue.start(api,{...f,npc,variant,...options}),true);
}
function apply(f,name,...args){return Progress[name](api,f.player,Progress.read(f.player).revision,...args);}
async function start(f){play(f,'starting-the-event-talking-to-the-cook');await resume(f,1);await finish(f);}
test('native choice/continuation reaches canonical platter handout and full inventory refusal',async t=>{
  const f=fixture(t);await start(f);assert.equal(Progress.read(f.player).phase,'queue');assert.equal(f.player.getInventory().getAmount(platter),1);assert.ok(f.packets.length>0);
  const full=fixture(t);for(let slot=0;slot<28;slot++)full.player.getInventory().setItem(slot,new api.core.Item(api.core.ItemIdentifiers.LOGS,1));
  await start(full);assert.equal(Progress.read(full.player).phase,'new');assert.equal(full.player.getInventory().getAmount(platter),0);
});
test('canonical native speech, bar and crate menus drive all three serving cycles',async t=>{
  const f=fixture(t);await start(f);
  for(let customer=0;customer<3;customer++){
  play(f,'serving-the-customers-talking-to-the-customer');await finish(f);assert.equal(Progress.read(f.player).phase,'table');apply(f,'seat',customer);
  play(f,'serving-the-customers-talking-to-the-customer-after-picking-a-table',{drink:'chocolate milk'});await finish(f);assert.equal(Progress.read(f.player).drink,'chocolate milk');
  play(f,'serving-the-customers-searching-the-bar-chocolate-milk',{drink:'chocolate milk'});await finish(f);assert.equal(Progress.read(f.player).drinkHeld,true);
  play(f,'serving-the-customers-serving-the-table-after-getting-the-drink',{table:customer,main:'trout',sides:['cabbage','parsnips','stuffing']});await finish(f);assert.equal(Progress.read(f.player).phase,'ingredients');
  for(const ingredient of ['trout','cabbage','parsnips','stuffing']){
    play(f,ingredient==='trout'?'serving-the-customers-searching-the-main-course-crate':'serving-the-customers-searching-the-side-dish-crate');
    for(let count=0;count<8;count++){
      const pending=MultiChatboxPrompt.getPending(f.player);assert.ok(pending,'source ingredient menu');
      const selected=pending.options.findIndex(name=>name.toLowerCase()===ingredient);
      if(selected>=0){await resume(f,selected+1);break;}
      const next=pending.options.findIndex(name=>name==='Next'||name==='More...');assert.ok(next>=0,'source menu can reach '+ingredient);await resume(f,next+1);
    }
    for(let count=0;count<8&&f.player.getDialogueManager().getCurrent()&&!MultiChatboxPrompt.getPending(f.player);count++)await resume(f);
    f.player.closeInterruptibleInterfaces();
    assert.ok(Progress.read(f.player).gathered.includes(ingredient));
  }
  play(f,customer===0?'serving-the-customers-talking-to-the-cook-with-all-the-ingredients-for-the-first-time':'serving-the-customers-talking-to-the-cook-with-all-the-ingredients-subsequent-times');await finish(f);assert.equal(Progress.read(f.player).phase,'cooked');
  play(f,'serving-the-customers-serving-the-table-with-cooked-food',{table:customer});await finish(f);assert.equal(Progress.read(f.player).customer,customer+1);assert.equal(Progress.read(f.player).phase,customer===2?'ready':'queue');
  }
});
test('scheduler closure invalidates pending native continuation before it can mutate progress',async t=>{
  const f=fixture(t);await start(f);play(f,'serving-the-customers-talking-to-the-customer');
  Dialogue.activate({key:'christmas-2025',active:false});await finish(f);assert.equal(Progress.read(f.player).phase,'queue');
  Dialogue.activate({key:'christmas-2025',active:true});
});
test('a retained platter can begin a new saved activity without a duplicate handout',async t=>{
  const f=fixture(t);f.player.getInventory().addItem(new api.core.Item(platter,1));
  await start(f);assert.equal(Progress.read(f.player).phase,'queue');assert.equal(f.player.getInventory().getAmount(platter),1);
});
test('native platter inspection lists only missing ingredients without blank placeholders',async t=>{
  const f=fixture(t);apply(f,'begin');apply(f,'greet',0);apply(f,'seat',0);apply(f,'orderDrink','beer');apply(f,'takeDrink','beer');apply(f,'serveDrink',0);apply(f,'orderFood','trout',['cabbage','parsnips','stuffing']);apply(f,'collect','trout');
  play(f,'serving-the-customers-inspecting-the-serving-platter');
  const current=f.player.getDialogueManager().getCurrent();
  assert.equal(current.constructor.name,'ItemStatementDialogue');
  assert.equal(current.text,'I still need to get some cabbage, parsnips, stuffing.');
  await finish(f);
});
