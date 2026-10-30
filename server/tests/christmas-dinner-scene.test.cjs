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
test('original surface/cellar objects and real collision restore after two native scene lifecycles',()=>{
  const before=originals(),flags=clipping(),removed=[...c.World.getRemovedObjects()];
  assert.equal(before.filter(r=>r.objects.length).length,21,'actual current-cache map objects were loaded');
  for(let cycle=0;cycle<2;cycle++){
    assert.equal(Scene.open(api).handled,true);assert.equal(Scene.objects().length,24);
    for(const entry of Scene.objects()){
      const row=data.placements.find(row=>row.symbol===entry.symbol&&at(row).equals(entry.object.getLocation()));assert.ok(row);
      assert.equal(entry.object.getType(),row.shape);assert.equal(entry.object.getFace(),row.rotation);
      assert.equal(c.MapObjects.get(entry.object.getId(),at(row),null),entry.object);
      assert.ok(c.World.getObjects().includes(entry.object),'registered real world owner');
    }
    assert.equal(Scene.open(api).handled,true,'duplicate activation is idempotent');assert.equal(Scene.objects().length,24);
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
