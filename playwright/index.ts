// The component under test is styled by the app's own stylesheet — the popover
// and the selection marks are positioned by it, so mounting without it would
// test a component that doesn't exist anywhere.
import "../app/globals.css";
