// All code comments must be English per user requirement

export function createToast() {
  let node = null;
  function ensure() {
    if (!node) {
      node = document.createElement('div');
      node.className = 'toast';
      document.body.appendChild(node);
    }
    return node;
  }
  let timer = null;
  return {
    show(message, ms = 1500) {
      const el = ensure();
      el.textContent = message;
      el.style.display = 'block';
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        el.style.display = 'none';
      }, ms);
    },
  };
}


