# Film spectral data

A small static website that shows the spectral data behind 89 film and paper stocks, with example photos rendered through each one and a link to the manufacturer's original datasheet.

For each stock it shows:

- **Spectral sensitivity:** how strongly each layer responds to each wavelength, drawn the way datasheets draw it (peak at 0, top 3.5 log units).
- **Characteristic curves:** density against log exposure, with the film base added so they start where a datasheet's curves start.
- **Spectral dye density:** each dye, plus the base and a mid-grey patch.
- **Examples:** four raw photos, original and film side by side.
- **Datasheet:** a link to the original PDF where one could be found (70 of 89).

## Where the data comes from

The profiles are the spektrafilm-format JSON files shipped with the [Negs](https://github.com/noahhaasis/negs) engine. Each stock page credits who made its profile:

| Source      | Stocks | Made by                                                             | Licence      |
| ----------- | ------ | ------------------------------------------------------------------- | ------------ |
| spektrafilm | 33     | Andrea Volpato, from manufacturer data                              | CC BY-SA 4.0 |
| Negs        | 27     | Noah Haasis, from manufacturer datasheets with spektrafilm's method | CC BY-SA 4.0 |
| Fotufilm    | 29     | MUAStudio Inc., converted for Negs                                  | CC BY-SA 4.0 |

The full licence texts are copied to `public/data/licenses/` by the export script.

Some values on the site are derived, not measured:

- **Spectral sensitivity:** profiles store it in spektrafilm's own relative units and extrapolate the tails, so the site shifts the peak to 0 and cuts the curve 3.5 log units below it. The shapes match the datasheets; the absolute numbers do not.
- **Base density:** the base added to the characteristic curves is calculated from the profile's base spectrum with standard Status M (negatives) or Status A (slides and papers) densitometer responsivities. For Kodak Portra 800 it comes out about 0.1 below the datasheet.
- **Exposure axis:** the characteristic curves use relative log exposure, not the datasheet's lux-seconds.

## Datasheets

The site never hosts datasheet PDFs. They are copyrighted by their manufacturers, so each stock links to a copy that is already online. Links are listed in `data/datasheets.json`, and the stock page names the host. About 30 point to the manufacturer (Kodak, Fujifilm, Ilford). The rest, mostly discontinued stocks, point to archives such as [125px.com](https://125px.com). For Negs-built stocks, the link is the document the profile was made from.

Every link was checked to return a PDF when it was added. Links can break when hosts move files.

## Example photos

| Photo            | Camera       | Source                                                                         | Licence      |
| ---------------- | ------------ | ------------------------------------------------------------------------------ | ------------ |
| River valley     | Pentax K-1   | [raw.pixls.us](https://raw.pixls.us/)                                          | CC0 1.0      |
| Fruit still life | Canon EOS RP | [raw.pixls.us](https://raw.pixls.us/)                                          | CC0 1.0      |
| Mallow flower    | Canon EOS R7 | [raw.pixls.us](https://raw.pixls.us/)                                          | CC0 1.0      |
| Summer portrait  | Sony (ARW)   | [fwolny on discuss.pixls.us](https://discuss.pixls.us/t/summer-portrait/14077) | CC BY-SA 4.0 |

Each raw is rendered through every stock by the Negs engine with spektrafilm's model, upstream-parity settings and automatic exposure. Paper stocks are shown printing Kodak Portra 400. The original is a neutral rendering of the same raw at the same exposure. The portrait is brightened by 1 EV (`exposureEV` in `data/examples.json`) because it is backlit.

The renders of the portrait keep its CC BY-SA 4.0 licence and must credit fwolny.

## Development

The project uses [Vite+](https://viteplus.dev) (`vp`) and pnpm. See `AGENTS.md` for the toolchain.

```sh
vp install        # install dependencies
vp dev            # local dev server
vp check          # format, lint and type-check
vp run build      # type-check and build into dist/
```

## Updating the data

Both scripts read from the Negs data folder. By default that is the copy pinned in the sibling `spektrafilm-c1-plugin` repository (`../spektrafilm-c1-plugin/vendor/negs`).

**Spectral data**: writes `public/data/`.

```sh
vp run export-data
# or with another Negs data folder:
node scripts/export-profiles.mjs /path/to/negs/data
```

**Example photos**: writes `public/examples/`. It needs [uv](https://docs.astral.sh/uv/) and a built `spektrafilm-native` helper. It downloads the raws once into `examples-cache/` (gitignored), which is about 100 MB.

```sh
uv run scripts/render-examples.py
uv run scripts/render-examples.py --only kodak_portra_400 kodak_ektar_100   # redo a few stocks
uv run scripts/render-examples.py --helper PATH --data DIR                    # other engine paths
```

To add a datasheet link, add an entry to `data/datasheets.json` and rerun `vp run export-data`. To change the example photos, edit `data/examples.json` and rerun the render script.

## Deploying

`wrangler.jsonc` serves `dist/` as static assets on Cloudflare Workers.

```sh
vp run build
npx wrangler deploy
```

## Project layout

```
data/
  datasheets.json        stock id -> datasheet URL and title (hand-edited)
  examples.json          example photos: raw URL, credit, licence, exposure
scripts/
  export-profiles.mjs    profiles -> public/data/
  render-examples.py     raws -> public/examples/ through the Negs engine
src/
  main.ts                loads the data, routes #/<stock-id>
  stock-list.ts          sidebar grouped by kind, with search
  stock-detail.ts        stock page: facts, charts, credits
  line-chart.ts          small SVG line chart, no dependencies
  examples.ts            original and film side by side
  types.ts               shapes written by the export script
public/
  data/                  generated: index.json, stocks/<id>.json, licenses/
  examples/              generated: <photo>/original.jpg, <photo>/<stock>.jpg, index.json
```

## Licence and credits

- **Profiles and spectral data:** CC BY-SA 4.0. spektrafilm by Andrea Volpato, Negs by Noah Haasis, Fotufilm by MUAStudio Inc.
- **Example renders:** CC0 for the raw.pixls.us photos; CC BY-SA 4.0 for the portrait by fwolny.
- **Datasheets:** © their manufacturers. They are linked, not hosted.
- **Site code:** no licence has been chosen yet.
