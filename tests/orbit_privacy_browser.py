import asyncio,json
from playwright.async_api import async_playwright

async def create(page):
 await page.goto('http://localhost:8080/create',wait_until='networkidle')
 await page.get_by_placeholder('Your name').fill('Privacy Owner')
 await page.get_by_role('button',name='Continue').click()
 await page.get_by_role('button',name='Continue').click()
 await page.get_by_role('button',name='Continue').click()
 await page.get_by_placeholder('e.g. The Launchpad').fill('Orbit Privacy Review')
 await page.get_by_role('button',name='Enter the house').click()
 await page.wait_for_url('**/house/**',timeout=35000)
 await page.get_by_label('House code').wait_for()
 return await page.get_by_label('House code').inner_text()
async def main():
 async with async_playwright() as p:
  b=await p.chromium.launch(headless=True)
  c=await b.new_context(viewport={'width':1280,'height':1800})
  page=await c.new_page(); errs=[];page.on('pageerror',lambda e:errs.append(str(e)))
  code=await create(page)
  await page.wait_for_timeout(4000)
  await page.screenshot(path='/tmp/browser/orbit-security/owner.png')
  print('Owner URL',page.url,'code length',len(code))
  print('Owner avatar',await page.locator('svg text').all_text_contents())
  c2=await b.new_context(viewport={'width':1280,'height':1800}); guest=await c2.new_page()
  await guest.goto('http://localhost:8080/enter',wait_until='networkidle')
  await guest.get_by_placeholder('Enter house code').fill(code)
  await guest.get_by_role('button',name='Join house').click()
  await guest.get_by_placeholder('Your name').fill('Privacy Guest')
  await guest.get_by_role('button',name='Enter the house').click()
  await guest.wait_for_url('**/house/**',timeout=35000)
  await guest.wait_for_timeout(4000)
  async def floor_click(pg,x,y):
   svg=pg.locator('main svg').first
   pos=await svg.evaluate('(e)=>{const r=e.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height}}')
   point=await svg.evaluate('(e,p)=>{const q=e.createSVGPoint();q.x=p.x;q.y=p.y;const r=q.matrixTransform(e.getScreenCTM());return {x:r.x,y:r.y}}',{'x':x,'y':y})
   await pg.mouse.click(point['x'],point['y'])
  await floor_click(guest,300,500)
  await guest.wait_for_timeout(5000)
  print('Guest movement state',await guest.locator('main').inner_text())
  await page.get_by_role('button',name='Knock',exact=True).click()
  await guest.wait_for_timeout(1000)
  await floor_click(guest,300,230)
  await guest.wait_for_timeout(1500)

  await page.get_by_role('button',name='Not now',exact=True).click(timeout=15000)
  await guest.wait_for_timeout(3000)
  assert await guest.get_by_text("They can't let you in right now",exact=True).count()==1
  print('Knock denial verified')
  await floor_click(guest,300,230)
  await page.get_by_role('button',name='Let in',exact=True).click(timeout=15000)
  await guest.wait_for_timeout(5500)
  print('Allowed entry',await guest.locator('main').inner_text())
  hid=guest.url.rsplit('/',1)[-1]
  lease=await guest.evaluate("""async h=>{const {supabase}=await import('/src/integrations/supabase/client.ts');const {data,error}=await supabase.rpc('orbit_voice',{_house:h,_action:'reserve',_room:'bedroom1'});if(error)throw Error(error.message);return data.id}""",hid)
  await page.get_by_role('button',name='locked',exact=True).click()
  await guest.wait_for_timeout(3500)
  print('Lock evicted guest',await guest.locator('main').inner_text())
  revoked=await guest.evaluate("""async ([h,id])=>{const {supabase}=await import('/src/integrations/supabase/client.ts');const {error}=await supabase.rpc('orbit_voice',{_house:h,_action:'check',_lease:id});return !!error}""",[hid,lease])
  assert revoked
  print('Existing lease revoked on lock')
  await floor_click(guest,300,230)
  await guest.wait_for_timeout(500)
  assert await guest.get_by_text('Bedroom 1 is locked',exact=True).count()==1
  print('Locked entry denial verified')
  hid=guest.url.rsplit('/',1)[-1]
  async def rpc(pg,action,payload):
   return await pg.evaluate("""async ([h,a,p])=>{const {supabase}=await import('/src/integrations/supabase/client.ts');const {data,error}=await supabase.rpc('orbit_action',{_house:h,_action:a,_payload:p});return {ok:!error,data,error:error?.message}}""",[hid,action,payload])
  attacks=[('move',{'x':230,'y':230}),('move',{'x':300,'y':500,'uid':'00000000-0000-4000-8000-000000000001'}),('move',{'x':999999,'y':500}),('reply',{'id':'00000000-0000-4000-8000-000000000001','allow':True}),('door',{'state':'locked','uid':'owner'})]
  for action,payload in attacks:
   result=await rpc(guest,action,payload)
   assert not result['ok'], (action,result)
  denied=await guest.evaluate("""async h=>{const {supabase}=await import('/src/integrations/supabase/client.ts');const {error}=await supabase.rpc('orbit_voice',{_house:h,_action:'reserve',_room:'bedroom1'});return !!error}""",hid)
  assert denied
  print('Database security checks: locked transition, forged movement identity, invalid coordinates, forged approval, forged door identity, wrong-room voice all rejected')
  movement=await rpc(guest,'move',{'x':300,'y':500});assert movement['ok']
  early=await rpc(guest,'arrive',{'motionId':movement['data']['motion_id']}); assert not early['ok']
  print('Early arrival rejected')
  await page.screenshot(path='/tmp/browser/orbit-security/knock-lock.png')
  await guest.wait_for_timeout(4500)
  await guest.set_viewport_size({'width':390,'height':844})
  await guest.screenshot(path='/tmp/browser/orbit-security/phone.png')
  assert not await guest.evaluate('document.documentElement.scrollWidth>innerWidth')
  print('Phone has no horizontal overflow')
  await guest.screenshot(path='/tmp/browser/orbit-security/entry.png')
  print('Errors',errs)
  await b.close()
asyncio.run(main())
