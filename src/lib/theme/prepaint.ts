// The one constant inline script that applies the saved theme before first paint (AD-11).
// It must stay a constant string: its sha256 goes into the CSP (Story 1.6), so any edit changes the hash.
// Behaviour mirrors resolveTheme/parseChoice in ./resolve.ts; tests run this script against that logic.
//
// Sets on <html>: data-theme = "light" | "dark" (what CSS reads) and data-theme-choice = the current choice.
// The attribute is the in-page source of truth after load, so a blocked or failing storage cannot make an
// OS change override an explicit choice. While the choice is "system" it follows OS changes live, and it
// follows choices saved by other tabs through the storage event.
export const PREPAINT_SCRIPT = `(function(){
var d=document.documentElement,k='vm.theme',q=null;
try{q=window.matchMedia('(prefers-color-scheme: dark)')}catch(e){}
function ok(c){return c==='light'||c==='dark'||c==='system'}
function read(){var c=null;try{c=window.localStorage.getItem(k)}catch(e){}return ok(c)?c:'system'}
function apply(c){d.setAttribute('data-theme-choice',c);d.setAttribute('data-theme',c==='system'?(q&&q.matches?'dark':'light'):c)}
function cur(){var a=d.getAttribute('data-theme-choice');return ok(a)?a:read()}
apply(read());
if(q){var f=function(){if(cur()==='system')apply('system')};if(q.addEventListener)q.addEventListener('change',f);else if(q.addListener)q.addListener(f)}
window.addEventListener('storage',function(e){if(e.key===k||e.key===null)apply(read())});
})();`;
