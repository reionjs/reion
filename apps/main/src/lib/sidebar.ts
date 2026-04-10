type SidebarListener = () => void;

let sidebarOpen = false;
const listeners = new Set<SidebarListener>();

function emitChange() {
  listeners.forEach((listener) => listener());
}

export const sidebar = {
  get open() {
    return sidebarOpen;
  },
  setOpen(open: boolean) {
    if (sidebarOpen === open) return;
    sidebarOpen = open;
    emitChange();
  },
  subscribe(listener: SidebarListener) {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
};