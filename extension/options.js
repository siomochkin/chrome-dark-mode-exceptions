const list = document.getElementById('list');
const form = document.getElementById('add');
const input = document.getElementById('host');

function render(sites) {
  list.replaceChildren();
  if (!sites || !sites.length) {
    const li = document.createElement('li');
    li.className = 'empty';
    li.textContent = 'No sites yet.';
    list.append(li);
    return;
  }
  for (const host of sites) {
    const li = document.createElement('li');
    const name = document.createElement('span');
    name.textContent = host;
    const btn = document.createElement('button');
    btn.textContent = 'Remove';
    btn.addEventListener('click', async () => {
      render(await chrome.runtime.sendMessage({ type: 'removeSite', host }));
    });
    li.append(name, btn);
    list.append(li);
  }
}

// Accept "example.com", "https://example.com/path", etc.
function normalize(value) {
  value = value.trim();
  if (!value) return '';
  try {
    return new URL(value.includes('://') ? value : `https://${value}`).hostname;
  } catch {
    return '';
  }
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const host = normalize(input.value);
  if (!host) return;
  input.value = '';
  render(await chrome.runtime.sendMessage({ type: 'addSite', host }));
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'sync' && changes.sites) render(changes.sites.newValue || []);
});

chrome.runtime.sendMessage({ type: 'getSites' }).then(render);
