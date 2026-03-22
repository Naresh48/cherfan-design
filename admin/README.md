# Admin setup: Cloudinary + image optimization

## Cloudinary credentials (not “public key”)

Cloudinary uses **Cloud name** and **API Key** in the CMS (same as in the [Decap Cloudinary docs](https://decapcms.org/docs/cloudinary/)).

1. Sign up or log in at [cloudinary.com](https://cloudinary.com/users/register/free).
2. Open the **Dashboard** (Programmable Media).
3. In the **Account details** / **Product environment credentials** section you’ll see:
   - **Cloud name** — short id (e.g. `demo`). Put this in `admin/config.yml` as `cloud_name`.
   - **API Key** — a numeric string. Put this in `admin/config.yml` as `api_key`.
4. **API Secret** — **do not** put this in `config.yml` or any public file. The Media Library signs in through Cloudinary’s widget with your account; only `cloud_name` + `api_key` are embedded in the public CMS config (this is expected for this integration).

## Config

Edit `admin/config.yml`:

```yaml
media_library:
  name: cloudinary
  config:
    cloud_name: your_cloud_name_here
    api_key: your_api_key_here
```

## How to use

1. Log into the admin and open a page (e.g. Home Page).
2. For an **Image** field, click **Choose**.
3. Cloudinary’s **Media Library** opens: upload from your computer (including Photos on Mac), use **Edit** / transformations to crop or adjust, then insert the image.
4. Save / publish as usual.

## Build: optimized files only on the site

On deploy, `npm run optimize-assets` (included in Netlify build) will:

1. Find **https** image URLs in `content/*.json` (including Cloudinary `res.cloudinary.com` URLs).
2. Download each image, generate **400 / 800 / 1200 / 1600** AVIF + WebP under `assets/final-pics/cms/`.
3. Replace those URLs in JSON with paths like `cms/your-base-name`.
4. Remove any matching originals under `assets/uploads/`.

The live site then loads only optimized assets from `assets/final-pics/cms/`.

## Scripts

Admin loads Decap CMS, Immutable, `decap-cms-lib-util`, and `decap-cms-media-library-cloudinary` from **unpkg** so the CMS works even when `node_modules` is not deployed (e.g. Netlify with `node_modules` in `.netlifyignore`).
