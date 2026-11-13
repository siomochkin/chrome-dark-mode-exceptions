# Dark Mode Exceptions

A Chrome extension that turns off **Auto Dark Mode for Web Contents**
(`chrome://flags/#enable-force-dark`) for the sites you choose.

## Install

1. Download or clone this repository.
2. Open `chrome://extensions` and turn on **Developer mode** (top right).
3. Click **Load unpacked** and select the `extension` folder.
4. Pin the extension to the toolbar (puzzle-piece icon → pin).

## Use

- On a site that looks wrong in dark mode, **click the toolbar icon**. The site
  is added to your exception list and the tab reloads in its normal light colours.
  A red **OFF** badge shows on that site from then on.
- Click the icon again to remove the site and turn dark mode back on there.
- Right-click the icon → **Options** to see, add or remove sites.

Exceptions apply to the exact hostname (`www.example.com` and `example.com` are
separate sites; all ports on a host share one entry). The list syncs across your
Chrome profiles through Chrome sync.

## Get the best result: set your theme to dark

How well the exception works depends on whether the browser reports a **dark**
colour preference to websites (`prefers-color-scheme: dark`). That comes from
your operating system's light/dark setting.

- **Theme is dark** (recommended, and probably what you use if you want dark
  pages): Chrome skips auto dark mode for any page that sets
  `color-scheme: only light`, which the extension injects. Excluded sites look
  exactly as their designers made them.
- **Theme is light**: Chrome darkens every page whatever it declares, so the
  extension inverts the page back as a fallback. It is close but not exact:
  white comes out as a very light grey, and very saturated colours in images
  can shift (bright yellow turns tan, for example).

## How it works

`background.js` keeps the list of hostnames in `chrome.storage.sync` and
registers one content script for them. The script injects `optout.css` at
`document_start`, before the page first paints, so there is no dark flash.
Each frame is handled on its own, so an embedded frame from another site keeps
dark mode unless you also exclude that site.

## Permissions

- **Access to all sites**: needed to inject the stylesheet on whichever sites
  you add. Nothing is read from or sent from the pages.
- **tabs**: to show the OFF badge and reload the tab when you toggle.
- **storage** and **scripting**: to store the list and register the stylesheet.
