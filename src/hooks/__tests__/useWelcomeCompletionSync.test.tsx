import { act, renderHook, cleanup } from '@testing-library/react';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { useWelcomeCompletionSync } from '../useWelcomeCompletionSync';
const check=vi.hoisted(()=>vi.fn());
vi.mock('@/lib/welcomeCompletion',()=>({isWelcomeCompleted:check,welcomeCompletionKey:(id:string)=>`parium_welcome_completed:${id}`}));
describe('Welcome cross-device synchronization',()=>{
 beforeEach(()=>{vi.useFakeTimers();check.mockReset();check.mockResolvedValue(false);});
 afterEach(()=>{cleanup();vi.useRealTimers();});
 it('checks other device within ten seconds then stops',async()=>{
  const completed=vi.fn();renderHook(()=>useWelcomeCompletionSync('one',false,completed));await act(async()=>{});expect(check).toHaveBeenCalledTimes(1);
  check.mockResolvedValue(true);await act(async()=>{await vi.advanceTimersByTimeAsync(10000);});expect(completed).toHaveBeenCalledTimes(1);
  await act(async()=>{await vi.advanceTimersByTimeAsync(30000);});expect(check).toHaveBeenCalledTimes(2);
 });
 it('ignores foreign account signals',async()=>{
  renderHook(()=>useWelcomeCompletionSync('one',false,vi.fn()));await act(async()=>{});
  await act(async()=>{window.dispatchEvent(new StorageEvent('storage',{key:'parium_welcome_completed:two',newValue:'yes'}));});expect(check).toHaveBeenCalledTimes(1);
  await act(async()=>{window.dispatchEvent(new StorageEvent('storage',{key:'parium_welcome_completed:one',newValue:'yes'}));});expect(check).toHaveBeenCalledTimes(2);
 });
 it('rechecks signal arriving during pending read',async()=>{
  let resolveRead:(v:boolean)=>void=()=>{};check.mockReturnValueOnce(new Promise<boolean>(resolve=>{resolveRead=resolve;})).mockResolvedValue(true);
  const completed=vi.fn();renderHook(()=>useWelcomeCompletionSync('one',false,completed));
  await act(async()=>{window.dispatchEvent(new StorageEvent('storage',{key:'parium_welcome_completed:one',newValue:'yes'}));resolveRead(false);});expect(check).toHaveBeenCalledTimes(2);expect(completed).toHaveBeenCalledTimes(1);
 });
 it('drops old-account response and disables replay checks',async()=>{
  let resolveRead:(v:boolean)=>void=()=>{};check.mockReturnValueOnce(new Promise<boolean>(resolve=>{resolveRead=resolve;}));const completed=vi.fn();
  const {rerender}=renderHook(({id,disabled})=>useWelcomeCompletionSync(id,disabled,completed),{initialProps:{id:'one',disabled:false}});rerender({id:'two',disabled:true});
  await act(async()=>{resolveRead(true);await vi.advanceTimersByTimeAsync(30000);});expect(completed).not.toHaveBeenCalled();expect(check).toHaveBeenCalledTimes(1);
 });
 it('checks immediately when a hidden device returns after five hours',async()=>{
  let visibility='hidden';
  const spy=vi.spyOn(document,'visibilityState','get').mockImplementation(()=>visibility as DocumentVisibilityState);
  try {
   const completed=vi.fn();renderHook(()=>useWelcomeCompletionSync('one',false,completed));
   await act(async()=>{await vi.advanceTimersByTimeAsync(5*60*60*1000);});expect(check).not.toHaveBeenCalled();
   check.mockResolvedValue(true);visibility='visible';
   await act(async()=>{document.dispatchEvent(new Event('visibilitychange'));});
   expect(completed).toHaveBeenCalledTimes(1);expect(check).toHaveBeenCalledWith('one');
  } finally {spy.mockRestore();}
 });
});
