/**
 * One bundle for the dashboard shell. htmx handles the fragments and Alpine
 * handles the local UI state, both served from our own origin.
 */
import htmx from "htmx.org";
import Alpine from "alpinejs";

declare global {
  interface Window {
    htmx: typeof htmx;
    Alpine: typeof Alpine;
  }
}

window.htmx = htmx;
window.Alpine = Alpine;

Alpine.start();
