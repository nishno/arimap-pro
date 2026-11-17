import test from 'node:test';
import assert from 'node:assert/strict';
import {checkModuleAccess, canUseManagementTools, activeMembershipsFor} from '../src/types.ts';
import {readWorkspaceRoute, workspacePath} from '../src/access/routes.ts';
const user = {id:'worker-1', roles:['Employee'], status:'active', isGuest:false, verificationStatus:'verified'};
const org = {id:'farm-a', isPaid:true};
const membership = {id:'m',userId:user.id,organizationId:org.id,role:'Employee',status:'active'};
const management = ['accounting','design','stock','harvesting','system','agronomy','labs','logs','founders','admin'];
test('workers cannot open management modules but retain personal work and communication', () => {
 for(const role of ['Employee','worker','Daily Worker','Foreman']) {
  const member={...membership,role};
  for(const module of management) assert.equal(checkModuleAccess(user,module,org,[member]),'none',`${role}: ${module}`);
  for(const module of ['my-work','profile','community','ai']) assert.equal(checkModuleAccess(user,module,org,[member]),'full');
 }
});
test('privileged tools use active membership in the selected farm or trusted platform claim', () => {
 for(const role of ['Founder','Co-Founder','Admin']) {
  const m={...membership,role};
  assert.equal(canUseManagementTools(user,org.id,[m]),true);
  for(const status of ['suspended','pending','invited']) assert.equal(canUseManagementTools(user,org.id,[{...m,status}]),false);
  assert.equal(canUseManagementTools(user,'farm-b',[m]),false);
  assert.equal(canUseManagementTools(user,org.id,[{...m,userId:'someone-else'}]),false);
 }
 assert.equal(canUseManagementTools({...user,roles:['ROOT_SUPER_ADMIN']},org.id,[]),false);
 assert.equal(canUseManagementTools(user,undefined,[],true),true);
 assert.equal(canUseManagementTools({...user,isGuest:true},org.id,[],true),false);
});
test('foreign and inactive memberships never grant aggregate organization access',()=>{
 const founder={...membership,role:'Founder'};
 assert.deepEqual(activeMembershipsFor(user,[{...founder,userId:'other'},{...founder,status:'suspended'}]),[]);
 assert.equal(checkModuleAccess(user,'accounting',undefined,[{...founder,userId:'other'}]),'none');
 assert.equal(checkModuleAccess(user,'accounting',org,[{...founder,status:'suspended'}]),'none');
 assert.equal(checkModuleAccess({...user,status:'blocked'},'my-work',org,[founder]),'none');
});
test('workspace paths round-trip encoded farm identity; URL does not grant a role',()=>{
 const path=workspacePath('modern','stock','farm/a');
 assert.deepEqual(readWorkspaceRoute(path),{module:'stock',organizationId:'farm/a'});
 assert.deepEqual(readWorkspaceRoute('/classic/worker/my-work'),{module:'my-work'});
 assert.deepEqual(readWorkspaceRoute('/admin'),{module:'admin'});
 assert.equal(readWorkspaceRoute('/modern/farms/%ZZ/stock'),null);
 assert.equal(readWorkspaceRoute('/modern/worker/anything'),null);
 assert.equal(checkModuleAccess(user,readWorkspaceRoute('/admin').module,org,[membership]),'none');
});
